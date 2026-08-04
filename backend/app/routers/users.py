import re
import math
import secrets
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_permission, hash_key, validate_password_strength, is_valid_permission
from ..utils import log_action, _create_notification
from ..loyalty import get_tier
from ..schemas import (
    AdminCreateUserRequest, SuspendUserRequest, UpdateUserPermissionsRequest, LoyaltyAdjustRequest,
)

router = APIRouter()

# ============== USERS ==============
@router.post("/admin/users/create")
async def admin_create_user(body: AdminCreateUserRequest, admin=Depends(require_permission("manage_users"))):
    email = body.email.lower().strip()
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    firstName = (body.firstName or "").strip()[:50]
    lastName = (body.lastName or "").strip()[:50]
    # Auto-generate username if not provided
    raw_username = (body.username or "").strip()
    if not raw_username:
        base = re.sub(r'[^a-zA-Z0-9_]', '_', email.split('@')[0])[:24]
        raw_username = base
        suffix = 0
        while await db.users.find_one({"username": raw_username}):
            suffix += 1
            raw_username = f"{base}_{suffix}"
    if not re.match(r'^[a-zA-Z0-9_]{3,32}$', raw_username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters (letters, numbers, underscores only)")
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
        "password_hash": hash_key(password),
        "firstName": firstName,
        "lastName": lastName,
        "username": raw_username,
        "role": body.role,
        "permissions": body.permissions,
        "isVerified": True,
        "isSuspended": False,
        "mustChangePassword": bool(not body.password),
        "createdAt": datetime.now(timezone.utc),
        "lastLogin": None,
        "createdByAdmin": admin["username"],
    })
    await log_action("user_action", f"Admin '{admin['username']}' created user account: {raw_username} ({email})", user=admin["username"])
    return {
        "success": True,
        "username": raw_username,
        "email": email,
        "generated_password": password if not body.password else None,
    }

@router.get("/users")
async def list_users(page: int = 1, limit: int = 100, admin=Depends(require_permission("manage_users"))):
    skip = (page - 1) * limit
    total = await db.users.count_documents({})
    raw = await db.users.find({}, {"password_hash": 0, "access_key_hash": 0}).skip(skip).limit(limit).to_list(limit)
    result = []
    for u in raw:
        result.append({
            "id": str(u["_id"]),
            "email": u.get("email", ""),
            "username": u.get("username", ""),
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "role": u.get("role", "user"),
            "permissions": u.get("permissions", []),
            "isSuspended": u.get("isSuspended", False),
            "createdAt": u["createdAt"].isoformat() if isinstance(u.get("createdAt"), datetime) else u.get("created_at", ""),
            "lastLogin": u["lastLogin"].isoformat() if isinstance(u.get("lastLogin"), datetime) else None,
        })
    return {"users": result, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

@router.get("/users/{user_id}")
async def get_user(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0, "access_key_hash": 0})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(u["_id"]),
        "email": u.get("email", ""),
        "username": u.get("username", ""),
        "firstName": u.get("firstName", ""),
        "lastName": u.get("lastName", ""),
        "role": u.get("role", "user"),
        "permissions": u.get("permissions", []),
        "isSuspended": u.get("isSuspended", False),
        "createdAt": u["createdAt"].isoformat() if isinstance(u.get("createdAt"), datetime) else u.get("created_at", ""),
        "lastLogin": u["lastLogin"].isoformat() if isinstance(u.get("lastLogin"), datetime) else None,
    }

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
                raise HTTPException(status_code=403, detail=f"Cannot grant permission '{perm}' — you do not hold it yourself")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"permissions": req.permissions}})
    await log_action("user_action", f"User '{target.get('username', user_id)}' permissions updated", user=admin["username"])
    return {"success": True, "id": user_id, "permissions": req.permissions}

@router.patch("/admin/users/{user_id}/loyalty")
async def adjust_user_loyalty(user_id: str, req: LoyaltyAdjustRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    adjust_cents = round(req.adjust_dollars * 100)
    if adjust_cents == 0:
        raise HTTPException(status_code=400, detail="Adjustment cannot be zero")
    user_email = target.get("email", "")
    current = await db.user_points.find_one({"email": user_email})
    current_total = current.get("total_spent_cents", 0) if current else 0
    previous_tier = get_tier(current_total)
    new_total = max(0, current_total + adjust_cents)
    new_tier = get_tier(new_total)
    await db.user_points.update_one(
        {"email": user_email},
        {"$set": {"total_spent_cents": new_total, "tier": new_tier, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    reason_str = f" (reason: {req.reason})" if req.reason else ""
    await log_action("user_action",
        f"Admin '{admin['username']}' adjusted loyalty for '{target.get('username', user_email)}': "
        f"${req.adjust_dollars:+.2f}{reason_str} → {new_total}cts ({new_tier})",
        user=admin["username"])
    await _create_notification(
        user_id=user_id,
        message=f"{'🏆' if adjust_cents > 0 else '📉'} Your loyalty balance was adjusted by ${abs(req.adjust_dollars):.2f}. Current tier: {new_tier.capitalize()}.",
        notif_type="loyalty_adjustment",
    )
    return {
        "success": True,
        "previous_total_cents": current_total,
        "new_total_cents": new_total,
        "previous_tier": previous_tier,
        "new_tier": new_tier,
    }

@router.get("/admin/users/{user_id}/export")
async def export_user_data(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    email = target.get("email", "")
    loyalty = await db.user_points.find_one({"email": email})
    purchases = await db.game_purchases.find({"email": email}).to_list(500)
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
        "loyalty": {
            "tier": loyalty.get("tier", "bronze"),
            "total_spent_cents": loyalty.get("total_spent_cents", 0),
            "total_spent_dollars": round(loyalty.get("total_spent_cents", 0) / 100, 2),
        } if loyalty else None,
        "game_purchases": [
            {
                "game_slug": p.get("game_slug"),
                "game_name": p.get("game_name"),
                "purchased_at": _serialize_date(p.get("purchased_at")),
                "amount_paid_cents": p.get("amount_paid_cents"),
            }
            for p in purchases
        ],
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
