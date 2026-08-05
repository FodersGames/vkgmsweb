import re
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import HTTPException, Request, Depends

from .config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS
from .database import db

# ============== PERMISSIONS ==============
# Static permissions (project:slug permissions are dynamic, not listed here)
ALL_PERMISSIONS = [
    "view_all_projects", "create_projects", "delete_projects",
    "send_items", "delete_items",
    "change_status",
    "view_variables", "create_variables", "edit_variables", "delete_variables",
    "view_logs",
    "manage_users",
    "view_vps",
    "manage_website",
    "create_games", "edit_games", "delete_games",
    "create_blog", "edit_blog", "delete_blog",
    "manage_chat",
    "manage_shop",
    "manage_files",
    "create_missions", "claim_missions", "manage_missions",
    "manage_tickets",
    "manage_play",
    "manager_careers",
    "game_dev_panel",
    "game_logs_panel",
    "manage_studio_apps",
    "review_studio_apps",
]

def is_valid_permission(p: str) -> bool:
    return p in ALL_PERMISSIONS or bool(re.match(r'^project:[a-z0-9_-]+$', p))

# ============== PSEUDO (username) RULES ==============
# The field is still called "username" in the DB/JWT — it's embedded in the
# play-token contract consumed by the external TurboWarp game-client extension,
# so only the rules and the user-facing label ("Pseudo") changed, not the field
# name. Shared here since both auth.py (self-service) and users.py (admin)
# enforce the same charset/length.
PSEUDO_REGEX = r'^[a-zA-Z0-9_]{5,14}$'
PSEUDO_COOLDOWN_DAYS = 7
FIRSTNAME_COOLDOWN_DAYS = 30

# ============== AUTH / PASSWORD HELPERS ==============
def hash_key(key: str) -> str:
    return bcrypt.hashpw(key.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def verify_key(key: str, hashed: str) -> bool:
    return bcrypt.checkpw(key.encode('utf-8'), hashed.encode('utf-8'))

def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[a-zA-Z]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")
    if not re.search(r'[0-9]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

def create_access_token(user_id, username, is_super_admin, permissions, email=""):
    payload = {"sub": user_id, "username": username, "email": email, "is_super_admin": is_super_admin, "permissions": permissions,
               "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(auth_header[7:])
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("isSuspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    is_super = user.get("role") == "super_admin"

    def _iso(dt):
        return dt.isoformat() if dt else None

    vakar_plus_status = user.get("vakar_plus_status", "none")

    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "role": user.get("role", "user"),
        "is_super_admin": is_super,
        "permissions": ALL_PERMISSIONS if is_super else user.get("permissions", []),
        "mustChangePassword": user.get("mustChangePassword", False),
        "avatar_url": user.get("avatar_url"),
        "pseudo_set": user.get("pseudo_set", False),
        "firstNameChangedAt": _iso(user.get("firstNameChangedAt")),
        "usernameChangedAt": _iso(user.get("usernameChangedAt")),
        "stripe_customer_id": user.get("stripe_customer_id"),
        "is_vakar_plus": vakar_plus_status == "active",
        "vakar_plus_status": vakar_plus_status,
        "vakar_plus_plan": user.get("vakar_plus_plan"),
        "vakar_plus_current_period_end": _iso(user.get("vakar_plus_current_period_end")),
        "vakar_plus_cancel_at_period_end": user.get("vakar_plus_cancel_at_period_end", False),
    }

async def get_optional_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        payload = verify_token(auth_header[7:])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("isSuspended"):
            return None
        return {
            "id": str(user["_id"]),
            "email": user.get("email", ""),
            "username": user.get("username", ""),
            "role": user.get("role", "user"),
            "is_super_admin": user.get("role") == "super_admin",
        }
    except Exception:
        return None

def require_permission(permission):
    async def check(user=Depends(get_current_user)):
        if user["is_super_admin"]:
            return user
        if permission not in user["permissions"]:
            raise HTTPException(status_code=403, detail=f"Missing: {permission}")
        return user
    return check

def require_any_of(*permissions):
    async def check(user=Depends(get_current_user)):
        if user["is_super_admin"]:
            return user
        if not any(p in user.get("permissions", []) for p in permissions):
            raise HTTPException(status_code=403, detail=f"Missing one of: {', '.join(permissions)}")
        return user
    return check

async def require_super_admin(user=Depends(get_current_user)):
    if not user["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user
