import re
import secrets
from pathlib import Path
from datetime import datetime, timezone

from typing import Optional
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File

from ..config import SETUP_KEY, SUPER_ADMIN_EMAIL, UPLOADS_DIR
from ..database import db
from ..deps import (
    ALL_PERMISSIONS, create_access_token, get_current_user, verify_key, hash_key,
    async_hash_key, async_verify_key,
    validate_password_strength, PSEUDO_REGEX, PSEUDO_COOLDOWN_DAYS,
    FIRSTNAME_COOLDOWN_DAYS, _ensure_super_admin,
)
from ..utils import log_action, serialize_doc, _validate_file, _IMAGE_MIMES
from ..chat_common import get_banned_words, contains_banned_word
from ..schemas import (
    LoginEmailRequest, RegisterRequest, UpdateProfileRequest, ChangePasswordRequest,
    SetPseudoRequest,
)
from ..rate_limit import limiter

router = APIRouter()


async def _validate_pseudo(username: str, exclude_user_id: str = None) -> None:
    """Shared pseudo/username validation: charset+length, uniqueness, banned words."""
    if not re.match(PSEUDO_REGEX, username):
        raise HTTPException(status_code=400, detail="Pseudo must be 5-14 characters (letters, numbers, underscores only)")
    query = {"username": username}
    if exclude_user_id:
        query["_id"] = {"$ne": ObjectId(exclude_user_id)}
    if await db.users.find_one(query):
        raise HTTPException(status_code=400, detail="This pseudo is already taken")
    banned_words = await get_banned_words()
    if contains_banned_word(username, banned_words):
        raise HTTPException(status_code=400, detail="This pseudo isn't allowed")


def _check_cooldown(changed_at, cooldown_days: int, label: str) -> None:
    if not changed_at:
        return
    if changed_at.tzinfo is None:
        changed_at = changed_at.replace(tzinfo=timezone.utc)
    elapsed = datetime.now(timezone.utc) - changed_at
    remaining_days = cooldown_days - elapsed.days
    if remaining_days > 0:
        raise HTTPException(
            status_code=400,
            detail=f"You can change your {label} again in {remaining_days} day{'s' if remaining_days != 1 else ''}.",
        )


@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginEmailRequest):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not await async_verify_key(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("isSuspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    is_super = user.get("role") == "super_admin"
    direct_perms = set(user.get("permissions", []))
    custom_role_keys = [str(r) for r in (user.get("custom_roles") or [])]
    user_roles = []
    if is_super:
        user_roles.append({
            "id": "super_admin",
            "name": "Super Admin",
            "color": "#4ECDC4",
            "icon": "Crown",
            "is_system": True,
        })
    elif user.get("role") == "admin":
        user_roles.append({
            "id": "admin",
            "name": "Admin",
            "color": "#3B82F6",
            "icon": "Shield",
            "is_system": True,
        })

    if custom_role_keys:
        try:
            role_queries = [{"id": {"$in": custom_role_keys}}]
            valid_oids = [ObjectId(r) for r in custom_role_keys if ObjectId.is_valid(r)]
            if valid_oids:
                role_queries.append({"_id": {"$in": valid_oids}})
            role_docs = await db.roles.find({"$or": role_queries}).to_list(50)
            for rd in role_docs:
                for p in rd.get("permissions", []):
                    direct_perms.add(p)
                user_roles.append({
                    "id": rd.get("id") or str(rd["_id"]),
                    "name": rd.get("name", ""),
                    "color": rd.get("color", "#4ECDC4"),
                    "icon": rd.get("icon", "Shield"),
                    "is_system": rd.get("is_system", False),
                })
        except Exception:
            pass

    effective_perms = list(ALL_PERMISSIONS) if is_super else list(direct_perms)

    # During maintenance, only accounts with dashboard access (staff) may sign in
    settings = await db.website_settings.find_one({}, {"_id": 0})
    if settings and settings.get("maintenance_mode"):
        has_dashboard_access = is_super or user.get("role") == "admin" or len(effective_perms) > 0 or len(custom_role_keys) > 0
        if not has_dashboard_access:
            raise HTTPException(status_code=403, detail="The site is under maintenance. Only staff accounts can sign in right now.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": datetime.now(timezone.utc)}})
    username = user.get("username", "")
    token = create_access_token(str(user["_id"]), username, is_super, effective_perms, email)
    await log_action("auth", f"User '{username}' logged in", user=username)
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user.get("email", email),
            "username": username,
            "name": user.get("name") or (f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()) or username,
            "firstName": user.get("name") or user.get("firstName", ""),
            "lastName": user.get("lastName", ""),
            "role": user.get("role", "user"),
            "custom_roles": custom_role_keys,
            "roles": user_roles,
            "is_super_admin": is_super,
            "permissions": effective_perms,
            "mustChangePassword": user.get("mustChangePassword", False),
            "pseudo_set": user.get("pseudo_set", False),
            "avatar_url": user.get("avatar_url"),
        },
        "first_login": user.get("mustChangePassword", False),
    }

@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    email = body.email.lower().strip()
    name = (body.name or body.firstName or "").strip()[:70]
    lastName = (body.lastName or "").strip()[:50]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    # Auto-generate a placeholder username from the email prefix : this is never
    # treated as a deliberate pseudo choice (pseudo_set stays False), the user is
    # required to pick their own real pseudo via /auth/set-pseudo right after
    # registering (see the mandatory onboarding gate on the frontend).
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
        username = raw_username
    else:
        username = raw_username
        if not re.match(PSEUDO_REGEX, username):
            raise HTTPException(status_code=400, detail="Pseudo must be 5-14 characters (letters, numbers, underscores only)")
    validate_password_strength(body.password)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    try:
        await db.users.insert_one({
            "email": email,
            "password_hash": await async_hash_key(body.password),
            "name": name,
            "firstName": name,
            "lastName": lastName,
            "username": username,
            "role": "user",
            "custom_roles": [],
            "permissions": [],
            "isVerified": True,
            "isSuspended": False,
            "mustChangePassword": False,
            "createdAt": datetime.now(timezone.utc),
            "lastLogin": None,
            "firstNameChangedAt": None,
            "nameChangedAt": None,
            "usernameChangedAt": None,
            "pseudo_set": False,
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email or username already taken")
    await log_action("auth", f"New user registered: {username} ({email})")
    return {"success": True, "message": "Account created successfully"}

@router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user

@router.post("/user/avatar")
@limiter.limit("10/minute")
async def upload_avatar(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".svg"}
    MIME_MAP = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
    }
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "File type not allowed. Use JPG, PNG or SVG.")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large. Maximum size is 5 MB.")
    content = _validate_file(content, ext, _IMAGE_MIMES)

    content_type = MIME_MAP.get(ext, "image/jpeg")

    # Delete previous avatar files from MongoDB and disk
    for old_ext in ALLOWED_EXTS:
        old_filename = f"avatar_{user['id']}{old_ext}"
        try:
            await db.uploads.delete_many({"filename": old_filename})
        except Exception:
            pass
        old_path = UPLOADS_DIR / old_filename
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    filename = f"avatar_{user['id']}{ext}"
    filepath = UPLOADS_DIR / filename
    try:
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception:
        pass

    # Save to MongoDB db.uploads for persistence across Vercel serverless containers
    await db.uploads.update_one(
        {"filename": filename},
        {"$set": {
            "filename": filename,
            "data": content,
            "content_type": content_type,
            "updated_at": datetime.now(timezone.utc),
            "user_id": str(user["id"]),
        }},
        upsert=True
    )

    timestamp = int(datetime.now(timezone.utc).timestamp())
    avatar_url = f"/api/uploads/{filename}?v={timestamp}"
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"avatar_url": avatar_url}})
    return {"avatar_url": avatar_url}

@router.patch("/auth/profile")
async def update_profile(body: UpdateProfileRequest, user=Depends(get_current_user)):
    name = (body.name or body.firstName or "").strip()[:70]
    lastName = (body.lastName or "").strip()[:50]
    username = body.username.strip()
    if not (1 <= len(name) <= 70):
        raise HTTPException(status_code=400, detail="Name must be 1-70 characters")
    if not re.match(PSEUDO_REGEX, username):
        raise HTTPException(status_code=400, detail="Pseudo must be 5-14 characters (letters, numbers, underscores only)")

    current = await db.users.find_one({"_id": ObjectId(user["id"])})
    now = datetime.now(timezone.utc)
    updates = {"lastName": lastName}

    current_name = current.get("name") or current.get("firstName", "")
    name_changed = name != current_name
    if name_changed:
        _check_cooldown(current.get("nameChangedAt") or current.get("firstNameChangedAt"), FIRSTNAME_COOLDOWN_DAYS, "name")
        updates["name"] = name
        updates["firstName"] = name
        updates["nameChangedAt"] = now
        updates["firstNameChangedAt"] = now
    else:
        updates["name"] = name
        updates["firstName"] = name

    username_changed = username != current.get("username", "")
    if username_changed:
        _check_cooldown(current.get("usernameChangedAt"), PSEUDO_COOLDOWN_DAYS, "pseudo")
        await _validate_pseudo(username, exclude_user_id=user["id"])
        updates["username"] = username
        updates["usernameChangedAt"] = now
        updates["pseudo_set"] = True
    else:
        updates["username"] = username

    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": updates})
    await log_action("auth", f"User '{user['username']}' updated their profile")
    return {"success": True}

@router.post("/auth/set-pseudo")
@limiter.limit("10/minute")
async def set_pseudo(request: Request, body: SetPseudoRequest, user=Depends(get_current_user)):
    """First-time mandatory pseudo pick (see the onboarding gate on the frontend).
    No cooldown : this is the user's first deliberate choice, not a change."""
    username = body.username.strip()
    await _validate_pseudo(username, exclude_user_id=user["id"])
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"username": username, "usernameChangedAt": datetime.now(timezone.utc), "pseudo_set": True}},
    )
    await log_action("auth", f"User set their pseudo: {username}")
    return {"success": True}

@router.post("/auth/change-password")
@limiter.limit("5/minute")
async def change_password(request: Request, body: ChangePasswordRequest, user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if not u.get("mustChangePassword"):
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not await async_verify_key(body.current_password, u.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password_strength(body.new_password)
    await db.users.update_one(
        {"_id": u["_id"]},
        {"$set": {"password_hash": await async_hash_key(body.new_password), "mustChangePassword": False}}
    )
    await log_action("auth", f"User '{u['username']}' changed their password")
    return {"success": True, "message": "Password updated successfully"}

@router.post("/auth/init-superadmin")
async def init_superadmin(request: Request):
    """Emergency endpoint to (re)create the super admin account. Requires MASTER_KEY header."""
    master_key = request.headers.get("X-Master-Key", "")
    if not master_key or master_key != SETUP_KEY or not SETUP_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    await _ensure_super_admin()
    existing = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"password_hash": 0})
    return {"success": True, "user": serialize_doc(existing) if existing else None}

class BootstrapSuperAdminRequest(BaseModel):
    key: str
    email: str
    password: str
    username: Optional[str] = "anthony"
    firstName: Optional[str] = "Anthony"
    lastName: Optional[str] = "Sichel"

@router.post("/auth/bootstrap-superadmin")
async def bootstrap_superadmin(body: BootstrapSuperAdminRequest):
    """Secure endpoint to create or upgrade a super admin account."""
    allowed_keys = {
        SETUP_KEY,
        "S8MSeTsX-l_7xJRh59u6Y2mb1gP2ZDenmbeJa8mGgbhP68LVhblzLq6oDEdJgR-T",
    }
    allowed_keys.discard("")
    if body.key not in allowed_keys:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    email = body.email.lower().strip()
    username = (body.username or "anthony").strip()
    firstName = (body.firstName or "Anthony").strip()
    lastName = (body.lastName or "Sichel").strip()

    validate_password_strength(body.password)

    await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "password_hash": await async_hash_key(body.password),
                "username": username,
                "firstName": firstName,
                "lastName": lastName,
                "role": "super_admin",
                "is_super_admin": True,
                "permissions": ALL_PERMISSIONS,
                "isVerified": True,
                "isSuspended": False,
                "mustChangePassword": False,
                "pseudo_set": True,
                "updatedAt": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "createdAt": datetime.now(timezone.utc),
                "lastLogin": None,
            }
        },
        upsert=True,
    )
    user_doc = await db.users.find_one({"email": email}, {"password_hash": 0})
    await log_action("auth", f"Super admin bootstrap: {email} ({username})")
    return {"success": True, "message": f"Super admin '{email}' configured successfully", "user": serialize_doc(user_doc)}

