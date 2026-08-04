import re
import json
import math
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request

from ..database import db
from ..deps import require_permission, get_current_user
from ..utils import slugify, get_project_or_404, log_action
from ..rate_limit import limiter
from ..schemas import (
    CreateProjectRequest, SendItemRequest, ServerStatusRequest, ServerStatusResponse,
    ServerVariableRequest, ServerVariableUpdateRequest, VAR_TYPES,
)

router = APIRouter()

# ============== PROJECTS ==============
@router.post("/projects")
async def create_project(req: CreateProjectRequest, user=Depends(require_permission("create_projects"))):
    slug = slugify(req.name)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid project name")
    if await db.projects.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Project already exists")
    doc = {"name": req.name, "slug": slug, "created_at": datetime.now(timezone.utc), "created_by": user["username"],
           "chat_api_key": secrets.token_urlsafe(24)}
    await db.projects.insert_one(doc)
    await db.server_status.update_one({"project_slug": slug}, {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc), "updated_by": "system"}}, upsert=True)
    await log_action("project", f"Project '{req.name}' created", project_slug=slug, user=user["username"])
    return {"success": True, "name": req.name, "slug": slug, "created_at": doc["created_at"].isoformat(), "created_by": user["username"]}

@router.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    if user["is_super_admin"] or "view_all_projects" in user["permissions"]:
        projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    else:
        allowed = [p.split(":", 1)[1] for p in user["permissions"] if p.startswith("project:")]
        if not allowed:
            return {"projects": []}
        projects = await db.projects.find({"slug": {"$in": allowed}}, {"_id": 0}).to_list(1000)
    for p in projects:
        if isinstance(p.get("created_at"), datetime):
            p["created_at"] = p["created_at"].isoformat()
    return {"projects": projects}

@router.delete("/projects/{slug}")
async def delete_project(slug: str, user=Depends(require_permission("delete_projects"))):
    p = await db.projects.find_one({"slug": slug})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for col in ["projects", "items", "server_status", "variables"]:
        if col == "projects":
            await db[col].delete_one({"slug": slug})
        else:
            await db[col].delete_many({"project_slug": slug})
    await db.logs.delete_many({"project_slug": slug})
    await log_action("project", f"Project '{p['name']}' deleted", user=user["username"])
    return {"success": True, "message": f"Project '{p['name']}' deleted"}

# ============== PROJECT-SCOPED: ITEMS ==============
@router.post("/projects/{slug}/items/send")
async def send_items(slug: str, req: SendItemRequest, user=Depends(require_permission("send_items"))):
    await get_project_or_404(slug)
    await db.items.insert_one({"project_slug": slug, "uid": req.uid, "variable": req.variable, "amount": req.amount,
                               "created_at": datetime.now(timezone.utc), "created_by": user["username"]})
    await log_action("send", f"Sent {req.amount}x {req.variable} to {req.uid}", project_slug=slug, user=user["username"],
                     uid=req.uid, variable=req.variable, amount=req.amount)
    return {"success": True, "message": f"Sent {req.amount}x {req.variable} to {req.uid}"}

@router.delete("/projects/{slug}/items/{uid}")
async def delete_items(slug: str, uid: str, user=Depends(require_permission("delete_items"))):
    await get_project_or_404(slug)
    r = await db.items.delete_many({"project_slug": slug, "uid": uid})
    await log_action("delete", f"Deleted {r.deleted_count} item(s) for {uid}", project_slug=slug, user=user["username"], uid=uid)
    return {"success": True, "deleted_count": r.deleted_count}

@router.get("/projects/{slug}/claimgift/{uid}")
@limiter.limit("30/minute")
async def claim_gift(request: Request, slug: str, uid: str):
    await get_project_or_404(slug)
    items = await db.items.find({"project_slug": slug, "uid": uid}).sort("created_at", 1).to_list(1000)
    if not items:
        return {"length": 0}
    resp = [{"variable": i["variable"], "amount": i["amount"], "from_name": i.get("from_name"), "product_name": i.get("product_name")} for i in items]
    await db.items.delete_one({"_id": items[0]["_id"]})
    await log_action("claim", f"User {uid} claimed: {items[0]['variable']} x{items[0]['amount']}", project_slug=slug, uid=uid)
    result = {
        "length": len(resp), "variable": resp[0]["variable"], "amount": resp[0]["amount"],
        "from_name": resp[0].get("from_name"), "product_name": resp[0].get("product_name"),
    }
    if len(resp) > 1:
        result["items"] = resp[1:]
    return result

# ============== PROJECT-SCOPED: STATUS ==============
@router.post("/projects/{slug}/status")
async def change_status(slug: str, req: ServerStatusRequest, user=Depends(require_permission("change_status"))):
    await get_project_or_404(slug)
    await db.server_status.update_one({"project_slug": slug}, {"$set": {"status": req.status, "updated_at": datetime.now(timezone.utc), "updated_by": user["username"]}}, upsert=True)
    await log_action("status", f"Status -> '{req.status}'", project_slug=slug, user=user["username"])
    return {"success": True, "status": req.status}

@router.get("/projects/{slug}/status", response_model=ServerStatusResponse)
async def get_status(slug: str):
    await get_project_or_404(slug)
    doc = await db.server_status.find_one({"project_slug": slug})
    if not doc:
        return ServerStatusResponse(status="open")
    updated_at = doc.get("updated_at")
    return ServerStatusResponse(
        status=doc["status"],
        updated_at=updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
        updated_by=doc.get("updated_by"),
    )

# ============== PROJECT-SCOPED: LOGS ==============
# Curated set of log types that are meaningful in a per-project activity feed.
# (Account-level/global actions — auth, website content, support, careers — never carry a
# project_slug and are therefore already excluded from this view by the query below.)
PROJECT_LOG_TYPES = (
    "files", "variable_action", "shop", "status", "chat", "guild",
    "missions", "player", "send", "claim", "delete", "project",
)

@router.get("/projects/{slug}/logs")
async def get_logs(slug: str, log_type: Optional[str] = None, user_filter: Optional[str] = None,
                   uid: Optional[str] = None, search: Optional[str] = None,
                   limit: int = 100, page: int = 1,
                   user=Depends(require_permission("view_logs"))):
    await get_project_or_404(slug)
    q = {"project_slug": slug}
    if log_type:
        types = [t.strip() for t in log_type.split(",") if t.strip()]
        if types:
            q["type"] = {"$in": types}
    if user_filter: q["user"] = user_filter
    if uid: q["uid"] = uid
    if search:
        q["message"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    skip = (page - 1) * limit
    total = await db.logs.count_documents(q)
    logs = await db.logs.find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    for l in logs:
        if isinstance(l.get("timestamp"), datetime):
            l["timestamp"] = l["timestamp"].isoformat()
    return {"logs": logs, "count": len(logs), "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

# ============== PROJECT-SCOPED: SERVER VARIABLES ==============
# A "server variable" is a per-project, admin-controlled config value the live game can read
# (if public) without needing a new build — e.g. a maintenance message, an event multiplier, a
# drop table. Old documents (pre-typed system) only have {variable_name, values: [str, ...]};
# _normalize_variable_doc reads those transparently as a "list" type without ever rewriting or
# deleting them — they only get upgraded to the new shape if an admin explicitly edits them.

def _normalize_variable_doc(v: dict) -> dict:
    if "var_type" not in v:
        return {
            "name": v.get("variable_name", v.get("name", "")),
            "var_type": "list",
            "value": v.get("values", []),
            "description": "",
            "is_public": True,
            "created_at": v.get("created_at"),
            "created_by": v.get("created_by"),
            "updated_at": v.get("updated_at"),
            "updated_by": v.get("updated_by"),
        }
    return {
        "name": v.get("name", v.get("variable_name", "")),
        "var_type": v.get("var_type", "string"),
        "value": v.get("value"),
        "description": v.get("description", ""),
        "is_public": v.get("is_public", True),
        "created_at": v.get("created_at"),
        "created_by": v.get("created_by"),
        "updated_at": v.get("updated_at"),
        "updated_by": v.get("updated_by"),
    }

def _validate_variable_value(var_type: str, value):
    if var_type == "string":
        return str(value) if value is not None else ""
    if var_type == "number":
        try:
            f = float(value)
        except (TypeError, ValueError):
            raise HTTPException(400, "Value must be a number")
        return int(f) if f.is_integer() else f
    if var_type == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes")
        return bool(value)
    if var_type == "list":
        if not isinstance(value, list):
            raise HTTPException(400, "Value must be a list")
        return [str(v) for v in value]
    if var_type == "json":
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                raise HTTPException(400, "Value must be valid JSON")
        if value is None:
            return {}
        return value
    raise HTTPException(400, f"Invalid var_type. Must be one of: {', '.join(VAR_TYPES)}")

async def _find_variable_doc(slug: str, name: str):
    return await db.variables.find_one({"project_slug": slug, "$or": [{"name": name}, {"variable_name": name}]})

@router.post("/projects/{slug}/variables")
async def create_variable(slug: str, req: ServerVariableRequest, user=Depends(require_permission("create_variables"))):
    await get_project_or_404(slug)
    if await _find_variable_doc(slug, req.name):
        raise HTTPException(status_code=400, detail="Variable exists")
    value = _validate_variable_value(req.var_type, req.value)
    now = datetime.now(timezone.utc)
    await db.variables.insert_one({
        "project_slug": slug, "name": req.name, "var_type": req.var_type, "value": value,
        "description": req.description, "is_public": req.is_public,
        "created_at": now, "created_by": user["username"],
        "updated_at": now, "updated_by": user["username"],
    })
    await log_action("variable_action",
        f"Variable '{req.name}' created ({req.var_type}, {'public' if req.is_public else 'private'})",
        project_slug=slug, user=user["username"], variable=req.name)
    return {"success": True, "name": req.name, "var_type": req.var_type, "value": value,
            "description": req.description, "is_public": req.is_public}

@router.get("/projects/{slug}/variables")
async def list_variables(slug: str, page: int = 1, limit: int = 200, user=Depends(require_permission("view_variables"))):
    await get_project_or_404(slug)

    skip = (page - 1) * limit
    total = await db.variables.count_documents({"project_slug": slug})
    vs = await db.variables.find({"project_slug": slug}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    result = []
    for v in vs:
        nv = _normalize_variable_doc(v)
        for k in ("created_at", "updated_at"):
            if isinstance(nv.get(k), datetime):
                nv[k] = nv[k].isoformat()
        result.append(nv)
    return {"variables": result, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

# Bulk, unauthenticated: lets the running game preload every public config value in one call.
@router.get("/projects/{slug}/variables/public")
async def list_public_variables(slug: str):
    await get_project_or_404(slug)
    vs = await db.variables.find({"project_slug": slug}).to_list(1000)
    result = {}
    for v in vs:
        nv = _normalize_variable_doc(v)
        if nv["is_public"] and nv["name"]:
            result[nv["name"]] = {"type": nv["var_type"], "value": nv["value"]}
    return {"variables": result}

@router.get("/projects/{slug}/variable/{name}")
async def get_variable(slug: str, name: str):
    await get_project_or_404(slug)
    v = await _find_variable_doc(slug, name)
    if not v:
        raise HTTPException(status_code=404, detail="Variable not found")
    nv = _normalize_variable_doc(v)
    if not nv["is_public"]:
        raise HTTPException(status_code=404, detail="Variable not found")
    return {"name": nv["name"], "type": nv["var_type"], "value": nv["value"]}

@router.put("/projects/{slug}/variables/{name}")
async def update_variable(slug: str, name: str, req: ServerVariableUpdateRequest, user=Depends(require_permission("edit_variables"))):
    await get_project_or_404(slug)
    existing = await _find_variable_doc(slug, name)
    if not existing:
        raise HTTPException(status_code=404, detail="Variable not found")
    nv = _normalize_variable_doc(existing)
    var_type    = req.var_type if req.var_type is not None else nv["var_type"]
    value       = _validate_variable_value(var_type, req.value) if req.value is not None else nv["value"]
    description = req.description if req.description is not None else nv["description"]
    is_public   = req.is_public if req.is_public is not None else nv["is_public"]
    now = datetime.now(timezone.utc)
    await db.variables.replace_one(
        {"_id": existing["_id"]},
        {
            "project_slug": slug, "name": name, "var_type": var_type, "value": value,
            "description": description, "is_public": is_public,
            "created_at": nv.get("created_at") or now, "created_by": nv.get("created_by") or user["username"],
            "updated_at": now, "updated_by": user["username"],
        }
    )
    await log_action("variable_action", f"Variable '{name}' updated", project_slug=slug, user=user["username"], variable=name)
    return {"success": True, "name": name, "var_type": var_type, "value": value,
            "description": description, "is_public": is_public}

@router.delete("/projects/{slug}/variables/{name}")
async def delete_variable(slug: str, name: str, user=Depends(require_permission("delete_variables"))):
    await get_project_or_404(slug)
    r = await db.variables.delete_one({"project_slug": slug, "$or": [{"name": name}, {"variable_name": name}]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Variable not found")
    await log_action("variable_action", f"Variable '{name}' deleted", project_slug=slug, user=user["username"], variable=name)
    return {"success": True, "message": f"Variable '{name}' deleted"}
