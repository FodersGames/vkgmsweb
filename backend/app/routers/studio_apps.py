from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_permission, get_optional_user
from ..utils import slugify, log_action
from ..schemas import (
    StudioAppCreateRequest, StudioAppUpdateRequest, StudioAppStatusRequest, StudioAppVisibilityRequest,
)

router = APIRouter()

# ============================================================
# STUDIO APP BUILDER — internal low-code tool. A "studio app" is a small
# multi-screen mini-app (flat component tree per screen, no free-form
# canvas) that staff assemble visually and publish either as a public
# player-facing mini-app or a private internal tool. Screens/variables are
# stored as loosely-typed dicts (matching this codebase's existing pattern
# for variable-shape nested content, e.g. GameCreateRequest.platforms)
# rather than a strict recursive Pydantic model — the builder UI is the
# only writer, and only staff with manage_studio_apps can reach it.
# ============================================================

MAX_SCREENS = 30
MAX_COMPONENTS_PER_SCREEN = 120


async def _unique_slug(base_slug: str, exclude_id=None) -> str:
    slug = base_slug
    n = 1
    while True:
        q = {"slug": slug}
        if exclude_id is not None:
            q["_id"] = {"$ne": exclude_id}
        if not await db.studio_apps.find_one(q):
            return slug
        n += 1
        slug = f"{base_slug}-{n}"


def _validate_screens(screens):
    if not isinstance(screens, list) or len(screens) == 0:
        raise HTTPException(status_code=400, detail="An app needs at least one screen")
    if len(screens) > MAX_SCREENS:
        raise HTTPException(status_code=400, detail=f"Too many screens (max {MAX_SCREENS})")
    for s in screens:
        if len(s.get("components", [])) > MAX_COMPONENTS_PER_SCREEN:
            raise HTTPException(status_code=400, detail="Too many components on one screen")


def _serialize(doc, full=False):
    result = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "description": doc.get("description", ""),
        "accent_color": doc.get("accent_color", "#4ECDC4"),
        "visibility": doc.get("visibility", "private"),
        "status": doc.get("status", "draft"),
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat(),
    }
    if full:
        result["screens"] = doc.get("screens", [])
        result["variables"] = doc.get("variables", [])
    return result

# ============================================================
# ADMIN — builder CRUD
# ============================================================

@router.get("/admin/studio-apps")
async def list_studio_apps(user=Depends(require_permission("manage_studio_apps"))):
    docs = await db.studio_apps.find().sort("updated_at", -1).to_list(200)
    return {"apps": [_serialize(d) for d in docs]}

@router.post("/admin/studio-apps")
async def create_studio_app(body: StudioAppCreateRequest, user=Depends(require_permission("manage_studio_apps"))):
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    base_slug = slugify(body.slug or name) or "app"
    slug = await _unique_slug(base_slug)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "description": "",
        "accent_color": "#4ECDC4",
        "visibility": "private",
        "status": "draft",
        "screens": [{"id": "home", "name": "Home", "components": []}],
        "variables": [],
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
    }
    result = await db.studio_apps.insert_one(doc)
    await log_action("studio_apps", f"App '{name}' created", user=user["username"])
    return {"id": str(result.inserted_id), "slug": slug}

@router.get("/admin/studio-apps/{app_id}")
async def get_studio_app(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    return _serialize(doc, full=True)

@router.put("/admin/studio-apps/{app_id}")
async def update_studio_app(app_id: str, body: StudioAppUpdateRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "screens" in update:
        _validate_screens(update["screens"])
    if "name" in update:
        update["name"] = update["name"].strip()[:80] or "Untitled app"
    if not update:
        return {"ok": True}
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.studio_apps.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="App not found")
    return {"ok": True}

@router.patch("/admin/studio-apps/{app_id}/status")
async def set_studio_app_status(app_id: str, body: StudioAppStatusRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    if body.status == "published" and not doc.get("screens"):
        raise HTTPException(status_code=400, detail="Add at least one screen before publishing")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}})
    await log_action("studio_apps", f"App '{doc['name']}' set to {body.status}", user=user["username"])
    return {"ok": True}

@router.patch("/admin/studio-apps/{app_id}/visibility")
async def set_studio_app_visibility(app_id: str, body: StudioAppVisibilityRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.studio_apps.update_one({"_id": oid}, {"$set": {"visibility": body.visibility, "updated_at": datetime.now(timezone.utc)}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="App not found")
    return {"ok": True}

@router.delete("/admin/studio-apps/{app_id}")
async def delete_studio_app(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.studio_apps.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="App not found")
    return {"ok": True}

@router.post("/admin/studio-apps/{app_id}/duplicate")
async def duplicate_studio_app(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    slug = await _unique_slug(f"{doc['slug']}-copy")
    now = datetime.now(timezone.utc)
    new_doc = {
        **{k: v for k, v in doc.items() if k not in ("_id", "created_at", "updated_at", "status")},
        "name": f"{doc['name']} (Copy)",
        "slug": slug,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
    }
    result = await db.studio_apps.insert_one(new_doc)
    return {"id": str(result.inserted_id), "slug": slug}

# ============================================================
# PUBLIC / RUNTIME — served to whoever loads /apps/{slug}. Public apps are
# open to anyone; private apps are gated to logged-in staff (admin or
# super_admin role) since "private" here means "internal studio tool",
# not "requires a specific permission" — any staff member should be able
# to use an internal tool once it's published, only building/editing it
# is gated by manage_studio_apps.
# ============================================================

@router.get("/apps/{slug}")
async def get_public_studio_app(slug: str, user=Depends(get_optional_user)):
    doc = await db.studio_apps.find_one({"slug": slug, "status": "published"})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    if doc.get("visibility") == "private":
        if not user or user.get("role") not in ("admin", "super_admin"):
            raise HTTPException(status_code=404, detail="App not found")
    return _serialize(doc, full=True)
