import re
import asyncio
import functools
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import HTTPException, Request, Depends

import logging

from .config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
from .database import db

logger = logging.getLogger(__name__)

# ============== PERMISSIONS ==============
ALL_PERMISSIONS = [
    # Users & Roles
    "manage_users",
    # Website CMS & Games
    "manage_website",
    "create_games",
    "edit_games",
    "delete_games",
    "create_blog",
    "edit_blog",
    "delete_blog",
    # Support & Careers & Surveys
    "manage_tickets",
    "manage_surveys",
    "manage_careers",
    "manager_careers",  # compatibility alias
    # System & Logs & VPS
    "view_logs",
    "use_cli",
    "view_vps",
    # In-Game Dev
    "game_dev_panel",
]


def is_valid_permission(p: str) -> bool:
    return p in ALL_PERMISSIONS

async def _ensure_super_admin():
    if not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
        return
    try:
        existing = await db.users.find_one({"email": SUPER_ADMIN_EMAIL.lower().strip()})
        if existing:
            if existing.get("role") != "super_admin":
                await db.users.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"role": "super_admin", "permissions": ALL_PERMISSIONS}}
                )
                logger.info("Upgraded existing account to super_admin")
            else:
                logger.info(f"Super admin already exists: {SUPER_ADMIN_EMAIL}")
            return

        base_username = "superadmin"
        username = base_username
        counter = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{counter}"
            counter += 1

        await db.users.insert_one({
            "email": SUPER_ADMIN_EMAIL.lower().strip(),
            "password_hash": hash_key(SUPER_ADMIN_PASSWORD),
            "firstName": "Admin",
            "lastName": "Vakar",
            "username": username,
            "role": "super_admin",
            "permissions": ALL_PERMISSIONS,
            "isVerified": True,
            "isSuspended": False,
            "mustChangePassword": True,
            "createdAt": datetime.now(timezone.utc),
            "lastLogin": None,
        })
        logger.info(f"Super admin created: {SUPER_ADMIN_EMAIL} (username: {username})")
    except Exception as e:
        logger.error(f"Super admin init error: {e}")

# ============== PSEUDO (username) RULES ==============
# The field is still called "username" in the DB/JWT : it's embedded in the
# play-token contract consumed by the external TurboWarp game-client extension,
# so only the rules and the user-facing label ("Pseudo") changed, not the field
# name. Shared here since both auth.py (self-service) and users.py (admin)
# enforce the same charset/length.
PSEUDO_REGEX = r'^[a-zA-Z0-9_]{5,14}$'
PSEUDO_COOLDOWN_DAYS = 7
FIRSTNAME_COOLDOWN_DAYS = 30

# ============== AUTH / PASSWORD HELPERS ==============
# Bcrypt cost factor: 10 is the OWASP-recommended minimum and runs in ~100ms
# on commodity hardware. We keep it synchronous for places that run outside an
# async context (tests, CLI scripts) and provide async wrappers for the
# request path so we don't block Vercel's single-threaded event loop.
_BCRYPT_ROUNDS = 10

def hash_key(key: str) -> str:
    return bcrypt.hashpw(key.encode('utf-8'), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode('utf-8')

def verify_key(key: str, hashed: str) -> bool:
    return bcrypt.checkpw(key.encode('utf-8'), hashed.encode('utf-8'))

async def async_hash_key(key: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, hash_key, key)

async def async_verify_key(key: str, hashed: str) -> bool:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(verify_key, key, hashed))

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
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user = await db.users.find_one({"_id": oid})
    except Exception:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
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

    def _iso(dt):
        return dt.isoformat() if dt else None

    vakar_plus_status = user.get("vakar_plus_status", "none")
    display_name = user.get("name") or (f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()) or user.get("username", "")

    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "name": display_name,
        "firstName": user.get("name") or user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "role": user.get("role", "user"),
        "custom_roles": custom_role_keys,
        "roles": user_roles,
        "is_super_admin": is_super,
        "permissions": effective_perms,
        "mustChangePassword": user.get("mustChangePassword", False),
        "avatar_url": user.get("avatar_url"),
        "pseudo_set": user.get("pseudo_set", False),
        "firstNameChangedAt": _iso(user.get("firstNameChangedAt")),
        "nameChangedAt": _iso(user.get("nameChangedAt")),
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
            "custom_roles": [str(r) for r in (user.get("custom_roles") or [])],
            "permissions": user.get("permissions") or [],
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
