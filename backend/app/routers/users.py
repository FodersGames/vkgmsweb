import re
import math
import secrets
from typing import Optional
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import (
    require_permission, require_super_admin, ALL_PERMISSIONS, hash_key, async_hash_key, validate_password_strength, is_valid_permission,
    PSEUDO_REGEX, PSEUDO_COOLDOWN_DAYS, FIRSTNAME_COOLDOWN_DAYS,
)
from ..utils import log_action, _create_notification
from ..chat_common import get_banned_words, contains_banned_word
from ..schemas import (
    AdminCreateUserRequest, SuspendUserRequest, UpdateUserPermissionsRequest,
    AdminUpdateUserProfileRequest, ResetCooldownRequest,
    UpdateUserCustomRolesRequest, UpdateUserRoleRequest,
)

router = APIRouter()

def _user_summary(u: dict) -> dict:
    def _iso(dt):
        return dt.isoformat() if isinstance(dt, datetime) else None
    return {
        "id": str(u["_id"]),
        "email": u.get("email", ""),
        "username": u.get("username", ""),
        "name": u.get("name") or (f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()) or u.get("username", ""),
        "firstName": u.get("name") or u.get("firstName", ""),
        "lastName": u.get("lastName", ""),
        "role": u.get("role", "user"),
        "custom_roles": [str(r) for r in (u.get("custom_roles") or [])],
        "permissions": u.get("permissions", []),
        "isSuspended": u.get("isSuspended", False),
        "createdAt": _iso(u.get("createdAt")) or u.get("created_at", ""),
        "lastLogin": _iso(u.get("lastLogin")),
        "pseudo_set": u.get("pseudo_set", False),
        "firstNameChangedAt": _iso(u.get("firstNameChangedAt")),
        "nameChangedAt": _iso(u.get("nameChangedAt")),
        "usernameChangedAt": _iso(u.get("usernameChangedAt")),
    }


# ============== USERS ==============
@router.post("/admin/users/create")
async def admin_create_user(body: AdminCreateUserRequest, admin=Depends(require_permission("manage_users"))):
    email = body.email.lower().strip()
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    name = (body.name or body.firstName or "").strip()[:70]
    lastName = (body.lastName or "").strip()[:50]
    # Auto-generate username if not provided
    raw_username = (body.username or "").strip()
    if not raw_username:
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', email.split('@')[0]).strip('_')
        if len(clean) < 5:
            base = f"user_{clean}"[:14]
            if len(base) < 5:
                base = f"user_{secrets.token_hex(4)}"[:14]
        else:
            base = clean[:14]
        if not re.match(PSEUDO_REGEX, base):
            base = f"user_{secrets.token_hex(4)}"[:14]

        raw_username = base
        suffix = 0
        while await db.users.find_one({"username": raw_username}):
            suffix += 1
            suffix_str = str(suffix)
            avail = 14 - len(suffix_str)
            raw_base = base[:avail]
            if len(raw_base) + len(suffix_str) < 5:
                raw_base = f"u_{raw_base}"[:avail]
            raw_username = f"{raw_base}{suffix_str}"
            if not re.match(PSEUDO_REGEX, raw_username):
                raw_username = f"u{suffix}_{secrets.token_hex(4)}"[:14]
    else:
        if not re.match(PSEUDO_REGEX, raw_username):
            raise HTTPException(status_code=400, detail="Pseudo must be 5-14 characters (letters, numbers, underscores only)")
    if await db.users.find_one({"username": raw_username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    # Auto-generate password if not provided
    password = body.password.strip() if body.password else secrets.token_urlsafe(12)
    validate_password_strength(password)
    for p in body.permissions:
        if not is_valid_permission(p):
            raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")
    await db.users.insert_one({
        "email": email,
        "password_hash": await async_hash_key(password),
        "name": name,
        "firstName": name,
        "lastName": lastName,
        "username": raw_username,
        "role": body.role,
        "custom_roles": getattr(body, "custom_roles", []) or [],
        "permissions": body.permissions,
        "isVerified": True,
        "isSuspended": False,
        "mustChangePassword": bool(not body.password),
        "createdAt": datetime.now(timezone.utc),
        "lastLogin": None,
        "createdByAdmin": admin["username"],
        "nameChangedAt": None,
        "firstNameChangedAt": None,
        "usernameChangedAt": None,
        # An admin-chosen pseudo counts as deliberately set; an auto-generated
        # placeholder still routes the new user through the onboarding pick.
        "pseudo_set": bool((body.username or "").strip()),
    })
    await log_action("user_action", f"Admin '{admin['username']}' created user account: {raw_username} ({email})", user=admin["username"])
    return {
        "success": True,
        "username": raw_username,
        "email": email,
        "generated_password": password if not body.password else None,
    }

@router.get("/users")
async def list_users(
    page: int = 1, limit: int = 100,
    search: str = "", role: Optional[str] = None, suspended: Optional[bool] = None,
    admin=Depends(require_permission("manage_users")),
):
    skip = (page - 1) * limit
    query = {}
    if search.strip():
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"username": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
            {"firstName": {"$regex": pattern, "$options": "i"}},
            {"lastName": {"$regex": pattern, "$options": "i"}},
        ]
    if role:
        query["role"] = role
    if suspended is not None:
        query["isSuspended"] = suspended
    total = await db.users.count_documents(query)
    raw = await db.users.find(query, {"password_hash": 0, "access_key_hash": 0}) \
        .sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    result = [_user_summary(u) for u in raw]
    return {"users": result, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

@router.get("/users/{user_id}")
async def get_user(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0, "access_key_hash": 0})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_summary(u)

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot delete a super admin account")
    if str(target["_id"]) == admin["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete your own account")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await log_action("user_action", f"User '{target.get('username', user_id)}' deleted", user=admin["username"])
    return {"success": True, "message": f"User '{target.get('username', user_id)}' deleted"}

@router.patch("/users/{user_id}/suspend")
async def suspend_user(user_id: str, req: SuspendUserRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot suspend a super admin account")
    if str(target["_id"]) == admin["id"]:
        raise HTTPException(status_code=403, detail="Cannot suspend your own account")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"isSuspended": req.suspended}})
    action = "suspended" if req.suspended else "reactivated"
    await log_action("user_action", f"User '{target.get('username', user_id)}' {action}", user=admin["username"])
    return {"success": True, "suspended": req.suspended}

@router.put("/users/{user_id}/permissions")
async def update_perms(user_id: str, req: UpdateUserPermissionsRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent privilege escalation: non-super-admin can only grant permissions they themselves hold
    # manage_users is super-admin-only to prevent lateral propagation of admin access
    _SUPER_ADMIN_ONLY_PERMS = {"manage_users"}
    if not admin.get("is_super_admin") and admin.get("role") not in ("super_admin",):
        admin_perms = set(admin.get("permissions", []))
        for perm in req.permissions:
            if perm in _SUPER_ADMIN_ONLY_PERMS:
                raise HTTPException(status_code=403, detail=f"'{perm}' can only be granted by a super admin")
            if perm not in admin_perms:
                raise HTTPException(status_code=403, detail=f"Cannot grant permission '{perm}' : you do not hold it yourself")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"permissions": req.permissions}})
    await log_action("user_action", f"User '{target.get('username', user_id)}' permissions updated", user=admin["username"])
    return {"success": True, "id": user_id, "permissions": req.permissions}

@router.put("/admin/users/{user_id}/role")
async def update_user_system_role(user_id: str, req: UpdateUserRoleRequest, admin=Depends(require_super_admin)):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent demoting the last super admin
    if target.get("role") == "super_admin" and req.role != "super_admin":
        super_admin_count = await db.users.count_documents({"role": "super_admin"})
        if super_admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last remaining super admin")

    updates = {"role": req.role}
    if req.role == "super_admin":
        updates["permissions"] = list(ALL_PERMISSIONS)
        updates["isSuspended"] = False

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    await log_action("user_action", f"User '{target.get('username', user_id)}' role updated to {req.role}", user=admin["username"])
    return {"success": True, "id": user_id, "role": req.role}

@router.patch("/admin/users/{user_id}/profile")
async def admin_update_user_profile(user_id: str, body: AdminUpdateUserProfileRequest, admin=Depends(require_permission("manage_users"))):
    """Admin direct-edit of a user's identity fields. Unlike the self-service
    PATCH /auth/profile, this bypasses the firstName/pseudo cooldowns entirely :
    an admin action isn't a self-service change : but still enforces the same
    length/regex/uniqueness/banned-word rules, and still records the change
    timestamp so a subsequent self-service change still respects its cooldown
    starting from here."""
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    now = datetime.now(timezone.utc)
    if body.name is not None or body.firstName is not None:
        name_val = (body.name if body.name is not None else body.firstName).strip()[:70]
        if not name_val:
            raise HTTPException(status_code=400, detail="Name is required")
        updates["name"] = name_val
        updates["firstName"] = name_val
        updates["nameChangedAt"] = now
        updates["firstNameChangedAt"] = now
    if body.lastName is not None:
        updates["lastName"] = body.lastName.strip()[:50]
    if body.username is not None:
        username = body.username.strip()
        if username != target.get("username", ""):
            if not re.match(PSEUDO_REGEX, username):
                raise HTTPException(status_code=400, detail="Pseudo must be 5-14 characters (letters, numbers, underscores only)")
            if await db.users.find_one({"username": username, "_id": {"$ne": ObjectId(user_id)}}):
                raise HTTPException(status_code=400, detail="This pseudo is already taken")
            banned_words = await get_banned_words()
            if contains_banned_word(username, banned_words):
                raise HTTPException(status_code=400, detail="This pseudo isn't allowed")
            updates["username"] = username
            updates["usernameChangedAt"] = now
            updates["pseudo_set"] = True
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    await log_action("user_action", f"Admin '{admin['username']}' edited profile of '{target.get('username', user_id)}'", user=admin["username"])
    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    return _user_summary(updated)

@router.put("/admin/users/{user_id}/custom-roles")
async def update_user_custom_roles(user_id: str, req: UpdateUserCustomRolesRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"custom_roles": req.custom_roles}})
    await log_action("user_action", f"Admin '{admin['username']}' updated custom roles of '{target.get('username', user_id)}' to {req.custom_roles}", user=admin["username"])
    return {"success": True, "id": user_id, "custom_roles": req.custom_roles}

@router.post("/admin/users/{user_id}/reset-cooldown")
async def admin_reset_cooldown(user_id: str, body: ResetCooldownRequest, admin=Depends(require_permission("manage_users"))):
    """Clears the change-cooldown timestamp for one field so the USER's own next
    self-service change is unblocked immediately : the alternative to an admin
    picking the new value directly via admin_update_user_profile above."""
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    field_key = "nameChangedAt" if body.field in ("name", "firstName") else "usernameChangedAt"
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {field_key: None, "firstNameChangedAt": None}})
    await log_action("user_action", f"Admin '{admin['username']}' reset {body.field} cooldown for '{target.get('username', user_id)}'", user=admin["username"])
    return {"success": True}

@router.get("/admin/users/{user_id}/export")
async def export_user_data(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    email = target.get("email", "")
    tickets = await db.support_tickets.find({"user_email": email}).to_list(500)

    def _serialize_date(v):
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v) if v else None

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "id": str(target["_id"]),
            "email": email,
            "username": target.get("username"),
            "firstName": target.get("firstName"),
            "lastName": target.get("lastName"),
            "role": target.get("role"),
            "created_at": _serialize_date(target.get("created_at")),
            "isSuspended": target.get("isSuspended", False),
        },

        "support_tickets": [
            {
                "ticket_number": t.get("ticket_number"),
                "subject": t.get("subject"),
                "status": t.get("status"),
                "category": t.get("category"),
                "created_at": _serialize_date(t.get("created_at")),
                "message_count": len(t.get("messages", [])),
            }
            for t in tickets
        ],
    }
