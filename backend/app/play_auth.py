import jwt
import logging
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import HTTPException, Request

from .config import JWT_SECRET, JWT_ALGORITHM, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
from .database import db
from .deps import ALL_PERMISSIONS, hash_key

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
#  VAKAR GAMES PLAY — Player Auth + Cloud Saves (comptes unifiés db.users)
# ═══════════════════════════════════════════════════════════════════════════════

PLAY_ACCESS_TOKEN_HOURS  = 1
PLAY_REFRESH_TOKEN_DAYS  = 365

# Legacy fixed category names — no longer a global whitelist (categories are
# now per-project, admin-defined in db.play_save_categories), kept only as the
# seed list for the one-time backward-compat migration in main.py's startup
# event (see the "auto-migrate legacy save categories" block there).
LEGACY_PLAY_SAVE_CATEGORIES = {"inventory", "stats", "craft", "tech", "others"}

async def _get_project_categories(project_slug: str):
    """All category definitions an admin has created for this project."""
    return await db.play_save_categories.find({"project_slug": project_slug}).to_list(None)

async def _category_allowed(project_slug: str, category: str, user_id) -> bool:
    """A save/load is only allowed if an admin has explicitly defined this
    category for this project — "no data slots exist by default" — and, for
    a category scoped to specific players, only if this player is targeted."""
    cat = await db.play_save_categories.find_one({"project_slug": project_slug, "name": category})
    if not cat:
        return False
    if cat.get("player_scope") == "specific":
        return user_id in cat.get("target_user_ids", [])
    return True

def _create_play_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id, "username": username, "type": "play",
        "exp": datetime.now(timezone.utc) + timedelta(hours=PLAY_ACCESS_TOKEN_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def _create_play_refresh_token(user_id: str, username: str, jti: str) -> str:
    payload = {
        "sub": user_id, "username": username, "type": "play_refresh", "jti": jti,
        "exp": datetime.now(timezone.utc) + timedelta(days=PLAY_REFRESH_TOKEN_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def _get_play_user_from_access(request: Request):
    """Validates a play access token (1h, in-memory on client). Uses shared db.users."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requis")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(401, "Token invalide ou expiré")
    if payload.get("type") != "play":
        raise HTTPException(401, "Token invalide")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Token invalide")
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(401, "Token invalide")
    if not user:
        raise HTTPException(401, "Compte introuvable")
    if user.get("isSuspended"):
        raise HTTPException(403, "Compte suspendu")
    return user

async def _is_project_banned(user_id, project_slug: str) -> bool:
    if not project_slug:
        return False
    ban = await db.play_bans.find_one({"user_id": user_id, "project_slug": project_slug})
    return ban is not None

async def _check_first_time_and_mark(user_id, project_slug: str) -> bool:
    """Atomically records a player's first connection to a project. Returns True only the very first time."""
    if not project_slug:
        return False
    try:
        result = await db.play_first_seen.update_one(
            {"user_id": user_id, "project_slug": project_slug},
            {"$setOnInsert": {"first_seen_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return result.upserted_id is not None
    except DuplicateKeyError:
        return False

async def _ensure_super_admin():
    """Idempotent: create the super admin account if it doesn't exist yet."""
    if not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
        logger.warning("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in environment — skipping super admin auto-creation")
        return
    try:
        existing = await db.users.find_one({"email": SUPER_ADMIN_EMAIL})
        if existing:
            # Account exists — make sure it has super_admin role (migration guard)
            if existing.get("role") != "super_admin":
                await db.users.update_one(
                    {"email": SUPER_ADMIN_EMAIL},
                    {"$set": {"role": "super_admin", "permissions": ALL_PERMISSIONS, "isSuspended": False}}
                )
                logger.info("Upgraded existing account to super_admin")
            else:
                logger.info(f"Super admin already exists: {SUPER_ADMIN_EMAIL}")
            return

        # Generate a free username (superadmin might be taken)
        base_username = "superadmin"
        username = base_username
        counter = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{counter}"
            counter += 1

        await db.users.insert_one({
            "email": SUPER_ADMIN_EMAIL,
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
