import re
import json
import secrets
import jwt
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, HTTPException, Depends, Request, Response

from ..config import JWT_SECRET, JWT_ALGORITHM
from ..database import db
from ..deps import ALL_PERMISSIONS, require_permission, hash_key, verify_key
from ..utils import log_action
from ..rate_limit import limiter
from ..play_auth import (
    PLAY_REFRESH_TOKEN_DAYS, PLAY_SAVE_CATEGORIES,
    _create_play_access_token, _create_play_refresh_token, _get_play_user_from_access,
    _is_project_banned, _check_first_time_and_mark,
)
from ..schemas import NicknameRequest

router = APIRouter()

# ── Public play routes ───────────────────────────────────────────────────────

@router.post("/play/register")
@limiter.limit("10/minute")
async def play_register(request: Request):
    body     = await request.json()
    username     = str(body.get("username", "")).strip()
    email        = str(body.get("email", "")).strip().lower()
    password     = str(body.get("password", ""))
    project_slug = str(body.get("project_slug", "")).strip()

    if not username or not email or not password:
        raise HTTPException(400, "Tous les champs sont requis")
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        raise HTTPException(400, "Pseudo : 3-20 caractères (lettres, chiffres, _)")
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(400, "Email invalide")
    if len(password) < 6:
        raise HTTPException(400, "Mot de passe trop court (minimum 6 caractères)")

    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email déjà utilisé")
    if await db.users.find_one({"username": username}):
        raise HTTPException(400, "Pseudo déjà utilisé")

    now = datetime.now(timezone.utc)
    try:
        result = await db.users.insert_one({
            "username": username, "email": email,
            "password_hash": hash_key(password),
            "firstName": username, "lastName": "",
            "role": "player", "permissions": [],
            "isVerified": True, "isSuspended": False,
            "mustChangePassword": False,
            "createdAt": now, "lastLogin": now,
        })
    except DuplicateKeyError:
        raise HTTPException(400, "Email ou pseudo déjà utilisé")

    user_id = str(result.inserted_id)
    jti = secrets.token_urlsafe(32)
    refresh_token = _create_play_refresh_token(user_id, username, jti)
    access_token  = _create_play_access_token(user_id, username)
    await db.play_refresh_tokens.insert_one({
        "jti": jti, "user_id": result.inserted_id,
        "created_at": now, "last_used": now,
        "expires_at": now + timedelta(days=PLAY_REFRESH_TOKEN_DAYS),
        "is_revoked": False,
    })
    is_first_time = await _check_first_time_and_mark(result.inserted_id, project_slug)
    return {"access_token": access_token, "refresh_token": refresh_token,
            "player": {"id": user_id, "username": username}, "is_first_time": is_first_time}

@router.post("/play/login")
@limiter.limit("15/minute")
async def play_login(request: Request):
    body         = await request.json()
    login        = str(body.get("login", "")).strip()
    password     = str(body.get("password", ""))
    project_slug = str(body.get("project_slug", "")).strip()
    if not login or not password:
        raise HTTPException(400, "Champs requis manquants")
    user = await db.users.find_one({"$or": [{"username": login}, {"email": login.lower()}]})
    if not user or not verify_key(password, user.get("password_hash", "")):
        raise HTTPException(400, "Identifiants incorrects")
    if user.get("isSuspended"):
        raise HTTPException(403, "Compte suspendu")
    if await _is_project_banned(user["_id"], project_slug):
        raise HTTPException(403, {"error": "banned", "uid": str(user["_id"])})
    user_id  = str(user["_id"])
    username = user["username"]
    now = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": now}})
    jti = secrets.token_urlsafe(32)
    refresh_token = _create_play_refresh_token(user_id, username, jti)
    access_token  = _create_play_access_token(user_id, username)
    await db.play_refresh_tokens.insert_one({
        "jti": jti, "user_id": user["_id"],
        "created_at": now, "last_used": now,
        "expires_at": now + timedelta(days=PLAY_REFRESH_TOKEN_DAYS),
        "is_revoked": False,
    })
    is_first_time = await _check_first_time_and_mark(user["_id"], project_slug)
    return {"access_token": access_token, "refresh_token": refresh_token,
            "player": {"id": user_id, "username": username}, "is_first_time": is_first_time}

@router.post("/play/refresh")
@limiter.limit("30/minute")
async def play_refresh(request: Request):
    body = await request.json()
    refresh_token = str(body.get("refresh_token", ""))
    project_slug  = str(body.get("project_slug", "")).strip()
    if not refresh_token:
        raise HTTPException(401, "Refresh token manquant")
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(401, "Refresh token invalide ou expiré")
    if payload.get("type") != "play_refresh":
        raise HTTPException(401, "Token invalide")
    jti     = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise HTTPException(401, "Token invalide")
    stored = await db.play_refresh_tokens.find_one({"jti": jti})
    if not stored or stored.get("is_revoked"):
        raise HTTPException(401, "Session révoquée")
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(401, "Compte introuvable")
    if not user:
        raise HTTPException(401, "Compte introuvable")
    if user.get("isSuspended"):
        raise HTTPException(403, "Compte suspendu")
    if await _is_project_banned(user["_id"], project_slug):
        raise HTTPException(403, {"error": "banned", "uid": str(user["_id"])})
    now = datetime.now(timezone.utc)
    await db.play_refresh_tokens.update_one({"jti": jti}, {"$set": {"last_used": now}})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": now}})
    access_token = _create_play_access_token(user_id, user["username"])
    is_first_time = await _check_first_time_and_mark(user["_id"], project_slug)
    return {"access_token": access_token, "player": {"id": user_id, "username": user["username"]}, "is_first_time": is_first_time}

@router.get("/play/permissions")
async def play_permissions(request: Request, response: Response, play_user=Depends(_get_play_user_from_access)):
    """Live permission check for in-game admin tools (dev panel, logs panel).
    Always re-reads role/permissions from the DB — never trusts a cached client value."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    is_super = play_user.get("role") == "super_admin"
    permissions = ALL_PERMISSIONS if is_super else play_user.get("permissions", [])
    return {"is_super_admin": is_super, "permissions": permissions}

@router.post("/play/save")
async def play_save(request: Request, play_user=Depends(_get_play_user_from_access)):
    body = await request.json()
    category     = str(body.get("category", "")).strip()
    data         = str(body.get("data", "{}"))
    project_slug = str(body.get("project_slug", "")).strip()
    if category not in PLAY_SAVE_CATEGORIES:
        raise HTTPException(400, f"Catégorie invalide. Valeurs: {', '.join(sorted(PLAY_SAVE_CATEGORIES))}")
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    try:
        json.loads(data)
    except json.JSONDecodeError:
        raise HTTPException(400, "Les données doivent être du JSON valide")
    await db.play_saves.update_one(
        {"user_id": play_user["_id"], "project_slug": project_slug, "category": category},
        {"$set": {"data": data, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"ok": True}

@router.get("/play/load")
async def play_load(request: Request, category: str, project_slug: str, response: Response, play_user=Depends(_get_play_user_from_access)):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    if category not in PLAY_SAVE_CATEGORIES:
        raise HTTPException(400, "Catégorie invalide")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    save = await db.play_saves.find_one({
        "user_id": play_user["_id"], "project_slug": project_slug, "category": category
    })
    return {"data": save["data"] if save else "{}"}

@router.post("/play/nickname")
async def play_set_nickname(body: NicknameRequest, play_user=Depends(_get_play_user_from_access)):
    nickname = body.nickname.strip()
    if not (1 <= len(nickname) <= 24):
        raise HTTPException(400, "Nickname must be 1-24 characters")
    if not body.project_slug:
        raise HTTPException(400, "project_slug requis")
    await db.play_nicknames.update_one(
        {"user_id": play_user["_id"], "project_slug": body.project_slug},
        {"$set": {"nickname": nickname, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"nickname": nickname}

@router.get("/play/nickname")
async def play_get_nickname(project_slug: str, response: Response, play_user=Depends(_get_play_user_from_access)):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    doc = await db.play_nicknames.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    return {"nickname": doc["nickname"] if doc else play_user["username"]}

# ── Admin play routes ────────────────────────────────────────────────────────

@router.get("/admin/projects/{slug}/play/players")
async def admin_play_players(slug: str, user=Depends(require_permission("manage_play"))):
    saves   = await db.play_saves.find({"project_slug": slug}).to_list(None)
    p_ids   = list({s["user_id"] for s in saves})
    players = await db.users.find({"_id": {"$in": p_ids}}).to_list(None)
    bans    = await db.play_bans.find({"project_slug": slug}).to_list(None)
    banned_ids = {b["user_id"] for b in bans}
    result  = []
    for p in players:
        p_saves = [s for s in saves if s["user_id"] == p["_id"]]
        result.append({
            "id":         str(p["_id"]),
            "username":   p["username"],
            "email":      p["email"],
            "created_at": str(p.get("createdAt", "")),
            "last_seen":  str(p.get("lastLogin", "")),
            "categories": [s["category"] for s in p_saves],
            "banned":     p["_id"] in banned_ids,
        })
    return {"players": result}

@router.patch("/admin/projects/{slug}/play/players/{player_id}/ban")
async def admin_ban_player(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_bans.update_one(
        {"user_id": oid, "project_slug": slug},
        {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": user["username"]}},
        upsert=True
    )
    await log_action("player", f"Player {player_id} banned", project_slug=slug, user=user["username"])
    return {"success": True, "banned": True}

@router.delete("/admin/projects/{slug}/play/players/{player_id}/ban")
async def admin_unban_player(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_bans.delete_one({"user_id": oid, "project_slug": slug})
    await log_action("player", f"Player {player_id} unbanned", project_slug=slug, user=user["username"])
    return {"success": True, "banned": False}

@router.get("/admin/projects/{slug}/play/players/{player_id}")
async def admin_play_player_detail(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    player = await db.users.find_one({"_id": oid})
    if not player:
        raise HTTPException(404, "Joueur introuvable")
    saves = await db.play_saves.find({"user_id": oid, "project_slug": slug}).to_list(None)
    return {
        "player": {
            "id": str(player["_id"]), "username": player["username"], "email": player["email"],
            "created_at": str(player.get("createdAt", "")),
            "last_seen":  str(player.get("lastLogin", "")),
        },
        "saves": {s["category"]: s["data"] for s in saves}
    }

@router.patch("/admin/projects/{slug}/play/players/{player_id}/saves/{category}")
async def admin_play_update_save(slug: str, player_id: str, category: str, request: Request, user=Depends(require_permission("manage_play"))):
    if category not in PLAY_SAVE_CATEGORIES:
        raise HTTPException(400, "Catégorie invalide")
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    body = await request.json()
    data = str(body.get("data", "{}"))
    try:
        json.loads(data)
    except Exception:
        raise HTTPException(400, "JSON invalide")
    await db.play_saves.update_one(
        {"user_id": oid, "project_slug": slug, "category": category},
        {"$set": {"data": data, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"ok": True}

@router.delete("/admin/projects/{slug}/play/players/{player_id}/tokens")
async def admin_play_revoke_tokens(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    """Force-disconnect a player from all devices."""
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_refresh_tokens.update_many({"user_id": oid}, {"$set": {"is_revoked": True}})
    return {"ok": True}

@router.delete("/admin/projects/{slug}/play/players/{player_id}")
async def admin_play_delete_player(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    """Deletes play saves for this project + revokes play tokens. Does NOT delete the shared user account."""
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_saves.delete_many({"user_id": oid, "project_slug": slug})
    await db.play_refresh_tokens.delete_many({"user_id": oid})
    return {"ok": True}
