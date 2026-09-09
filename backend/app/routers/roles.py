import re
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_permission, ALL_PERMISSIONS
from ..utils import log_action
from ..schemas import RoleCreateRequest, RoleUpdateRequest

router = APIRouter()

DEFAULT_ROLES = [
    {
        "id": "moderator",
        "name": "Moderator",
        "color": "#3B82F6",
        "icon": "Shield",
        "description": "Community moderation, support tickets and game chat management.",
        "permissions": ["manage_chat", "manage_tickets"],
        "is_system": False,
    },
    {
        "id": "game_dev",
        "name": "Game Developer",
        "color": "#10B981",
        "icon": "Gamepad2",
        "description": "Game publishing, development panel, missions and logs.",
        "permissions": ["create_games", "edit_games", "game_dev_panel", "game_logs_panel"],
        "is_system": False,
    },
    {
        "id": "community_manager",
        "name": "Community Manager",
        "color": "#EC4899",
        "icon": "Sparkles",
        "description": "Blog posting, player announcements and community engagement.",
        "permissions": ["create_blog", "edit_blog", "manage_chat", "create_missions"],
        "is_system": False,
    },
    {
        "id": "vip",
        "name": "VIP Player",
        "color": "#F59E0B",
        "icon": "Crown",
        "description": "Distinguished studio supporter and community VIP.",
        "permissions": [],
        "is_system": False,
    },
]

async def _ensure_default_roles():
    count = await db.roles.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc)
        docs = []
        for r in DEFAULT_ROLES:
            docs.append({
                **r,
                "created_at": now,
                "updated_at": now,
            })
        if docs:
            await db.roles.insert_many(docs)

@router.get("/roles")
async def get_roles():
    await _ensure_default_roles()
    roles = await db.roles.find({}).sort("created_at", 1).to_list(100)
    return {
        "roles": [
            {
                "id": r.get("id") or str(r["_id"]),
                "_id": str(r["_id"]),
                "name": r.get("name", ""),
                "color": r.get("color", "#4ECDC4"),
                "icon": r.get("icon", "Shield"),
                "description": r.get("description", ""),
            }
            for r in roles
        ]
    }

@router.get("/admin/roles")
async def list_roles(admin=Depends(require_permission("manage_users"))):
    await _ensure_default_roles()
    roles = await db.roles.find({}).sort("created_at", 1).to_list(100)

    # Compute member counts
    res = []
    for r in roles:
        role_id = r.get("id") or str(r["_id"])
        user_count = await db.users.count_documents({
            "$or": [
                {"role": role_id},
                {"custom_roles": role_id},
            ]
        })
        res.append({
            "id": role_id,
            "_id": str(r["_id"]),
            "name": r.get("name", ""),
            "color": r.get("color", "#4ECDC4"),
            "icon": r.get("icon", "Shield"),
            "description": r.get("description", ""),
            "permissions": r.get("permissions", []),
            "is_system": r.get("is_system", False),
            "user_count": user_count,
            "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
        })
    return {"roles": res}

@router.post("/admin/roles")
async def create_role(req: RoleCreateRequest, admin=Depends(require_permission("manage_users"))):
    name = req.name.strip()
    if not name or len(name) > 40:
        raise HTTPException(status_code=400, detail="Role name must be between 1 and 40 characters")

    slug = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower()).strip('_')
    if not slug:
        slug = f"role_{int(datetime.now(timezone.utc).timestamp())}"
    slug = slug[:30]

    # Ensure uniqueness
    if await db.roles.find_one({"$or": [{"id": slug}, {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}]}):
        raise HTTPException(status_code=400, detail="A role with this name or identifier already exists")

    # Validate permissions
    invalid_perms = [p for p in req.permissions if p not in ALL_PERMISSIONS and not p.startswith("project:")]
    if invalid_perms:
        raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid_perms)}")

    now = datetime.now(timezone.utc)
    doc = {
        "id": slug,
        "name": name,
        "color": req.color.strip() if req.color else "#4ECDC4",
        "icon": req.icon.strip() if req.icon else "Shield",
        "description": (req.description or "").strip()[:200],
        "permissions": req.permissions,
        "is_system": False,
        "created_at": now,
        "updated_at": now,
        "created_by": admin.get("username", "admin"),
    }
    await db.roles.insert_one(doc)
    await log_action("roles", f"Created role '{name}' ({slug})", user=admin.get("username"))
    return {
        "success": True,
        "role": {
            "id": slug,
            "name": name,
            "color": doc["color"],
            "icon": doc["icon"],
            "description": doc["description"],
            "permissions": doc["permissions"],
            "is_system": False,
        }
    }

@router.put("/admin/roles/{role_id}")
async def update_role(role_id: str, req: RoleUpdateRequest, admin=Depends(require_permission("manage_users"))):
    role = await db.roles.find_one({"$or": [{"id": role_id}, {"_id": ObjectId(role_id) if ObjectId.is_valid(role_id) else None}]})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    updates = {"updated_at": datetime.now(timezone.utc)}
    if req.name is not None:
        name = req.name.strip()
        if not name or len(name) > 40:
            raise HTTPException(status_code=400, detail="Role name must be between 1 and 40 characters")
        updates["name"] = name
    if req.color is not None:
        updates["color"] = req.color.strip() or "#4ECDC4"
    if req.icon is not None:
        updates["icon"] = req.icon.strip() or "Shield"
    if req.description is not None:
        updates["description"] = req.description.strip()[:200]
    if req.permissions is not None:
        invalid_perms = [p for p in req.permissions if p not in ALL_PERMISSIONS and not p.startswith("project:")]
        if invalid_perms:
            raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid_perms)}")
        updates["permissions"] = req.permissions

    await db.roles.update_one({"_id": role["_id"]}, {"$set": updates})
    await log_action("roles", f"Updated role '{role.get('name', role_id)}'", user=admin.get("username"))
    updated = await db.roles.find_one({"_id": role["_id"]})
    return {
        "success": True,
        "role": {
            "id": updated.get("id", str(updated["_id"])),
            "name": updated.get("name", ""),
            "color": updated.get("color", "#4ECDC4"),
            "icon": updated.get("icon", "Shield"),
            "description": updated.get("description", ""),
            "permissions": updated.get("permissions", []),
            "is_system": updated.get("is_system", False),
        }
    }

@router.delete("/admin/roles/{role_id}")
async def delete_role(role_id: str, admin=Depends(require_permission("manage_users"))):
    role = await db.roles.find_one({"$or": [{"id": role_id}, {"_id": ObjectId(role_id) if ObjectId.is_valid(role_id) else None}]})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system role")

    role_key = role.get("id") or str(role["_id"])
    # Remove role from all users who have it
    await db.users.update_many(
        {"custom_roles": role_key},
        {"$pull": {"custom_roles": role_key}}
    )
    await db.roles.delete_one({"_id": role["_id"]})
    await log_action("roles", f"Deleted role '{role.get('name', role_id)}'", user=admin.get("username"))
    return {"success": True, "message": f"Role '{role.get('name')}' deleted"}
