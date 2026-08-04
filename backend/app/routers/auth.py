import re
from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File

from ..config import SETUP_KEY, SUPER_ADMIN_EMAIL, UPLOADS_DIR
from ..database import db
from ..deps import (
    ALL_PERMISSIONS, create_access_token, get_current_user, verify_key,
    hash_key, validate_password_strength, PSEUDO_REGEX, PSEUDO_COOLDOWN_DAYS,
    FIRSTNAME_COOLDOWN_DAYS,
)
from ..utils import log_action, serialize_doc, _validate_file, _IMAGE_MIMES
from ..play_auth import _ensure_super_admin
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
    if not user or not verify_key(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("isSuspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    is_super = user.get("role") == "super_admin"
    permissions = ALL_PERMISSIONS if is_super else user.get("permissions", [])
    # During maintenance, only accounts with dashboard access (staff) may sign in
    settings = await db.website_settings.find_one({}, {"_id": 0})
    if settings and settings.get("maintenance_mode"):
        has_dashboard_access = is_super or user.get("role") == "admin" or len(permissions) > 0
        if not has_dashboard_access:
            raise HTTPException(status_code=403, detail="The site is under maintenance. Only staff accounts can sign in right now.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": datetime.now(timezone.utc)}})
    token = create_access_token(str(user["_id"]), user["username"], is_super, permissions, email)
    await log_action("auth", f"User '{user['username']}' logged in", user=user["username"])
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "username": user["username"],
            "firstName": user.get("firstName", ""),
            "lastName": user.get("lastName", ""),
            "role": user.get("role", "user"),
            "is_super_admin": is_super,
            "permissions": permissions,
            "mustChangePassword": user.get("mustChangePassword", False),
            # Existing accounts predate this field and default to False — under
            # the new rules their current username was never a deliberate pseudo
            # choice, so they're routed through the same mandatory pick as a
            # brand-new signup the next time they log in.
            "pseudo_set": user.get("pseudo_set", False),
        },
        "first_login": user.get("mustChangePassword", False),
    }

@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    email = body.email.lower().strip()
    firstName = (body.firstName or "").strip()[:50]
    lastName = (body.lastName or "").strip()[:50]
    if not firstName:
        raise HTTPException(status_code=400, detail="First name is required")
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    # Auto-generate a placeholder username from the email prefix — this is never
    # treated as a deliberate pseudo choice (pseudo_set stays False), the user is
    # required to pick their own real pseudo via /auth/set-pseudo right after
    # registering (see the mandatory onboarding gate on the frontend).
    raw_username = (body.username or "").strip()
    if not raw_username:
        base = re.sub(r'[^a-zA-Z0-9_]', '_', email.split('@')[0])[:14] or "player"
        raw_username = base
        suffix = 0
        while await db.users.find_one({"username": raw_username}):
            suffix += 1
            raw_username = f"{base[:14 - len(str(suffix))]}{suffix}"
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
            "password_hash": hash_key(body.password),
            "firstName": firstName,
            "lastName": lastName,
            "username": username,
            "role": "user",
            "permissions": [],
            "isVerified": True,
            "isSuspended": False,
            "mustChangePassword": False,
            "createdAt": datetime.now(timezone.utc),
            "lastLogin": None,
            "firstNameChangedAt": None,
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
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "File type not allowed. Use JPG, PNG or SVG.")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large. Maximum size is 5 MB.")
    # Same validation pipeline as /api/upload: sanitizes SVGs, verifies real
    # MIME type for raster formats — avatars are user-uploaded and served
    # inline, so this can't be skipped like it was before.
    content = _validate_file(content, ext, _IMAGE_MIMES)
    # Delete previous avatar file if it exists
    for old_ext in ALLOWED_EXTS:
        old_path = UPLOADS_DIR / f"avatar_{user['id']}{old_ext}"
        if old_path.exists():
            old_path.unlink(missing_ok=True)
    filename = f"avatar_{user['id']}{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    avatar_url = f"/api/uploads/{filename}"
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"avatar_url": avatar_url}})
    return {"avatar_url": avatar_url}

@router.patch("/auth/profile")
async def update_profile(body: UpdateProfileRequest, user=Depends(get_current_user)):
    firstName = body.firstName.strip()
    lastName = (body.lastName or "").strip()
    username = body.username.strip()
    if not (1 <= len(firstName) <= 50):
        raise HTTPException(status_code=400, detail="First name must be 1-50 characters")
    if len(lastName) > 50:
        raise HTTPException(status_code=400, detail="Last name must be at most 50 characters")
    if not re.match(PSEUDO_REGEX, username):
        raise HTTPException(status_code=400, detail="Pseudo must be 5-14 characters (letters, numbers, underscores only)")

    current = await db.users.find_one({"_id": ObjectId(user["id"])})
    now = datetime.now(timezone.utc)
    updates = {"lastName": lastName}

    firstName_changed = firstName != current.get("firstName", "")
    if firstName_changed:
        _check_cooldown(current.get("firstNameChangedAt"), FIRSTNAME_COOLDOWN_DAYS, "first name")
        updates["firstName"] = firstName
        updates["firstNameChangedAt"] = now
    else:
        updates["firstName"] = firstName

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
    No cooldown — this is the user's first deliberate choice, not a change."""
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
        if not verify_key(body.current_password, u.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password_strength(body.new_password)
    await db.users.update_one(
        {"_id": u["_id"]},
        {"$set": {"password_hash": hash_key(body.new_password), "mustChangePassword": False}}
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
