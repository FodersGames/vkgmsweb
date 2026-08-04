import re
import json
import math
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
    PLAY_REFRESH_TOKEN_DAYS,
    _create_play_access_token, _create_play_refresh_token, _get_play_user_from_access,
    _is_project_banned, _check_first_time_and_mark,
    _get_project_categories, _category_allowed,
)
from ..schemas import NicknameRequest, PlaySaveCategoryRequest, PlaySaveBulkUpdateRequest

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
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if not await _category_allowed(project_slug, category, play_user["_id"]):
        raise HTTPException(400, "Catégorie invalide ou non autorisée pour ce joueur")
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
    if not await _category_allowed(project_slug, category, play_user["_id"]):
        raise HTTPException(400, "Catégorie invalide ou non autorisée pour ce joueur")
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
async def admin_play_players(slug: str, search: str = "", page: int = 1, limit: int = 30, user=Depends(require_permission("manage_play"))):
    saves = await db.play_saves.find({"project_slug": slug}, {"user_id": 1, "category": 1}).to_list(None)
    p_ids = list({s["user_id"] for s in saves})
    if not p_ids:
        return {"players": [], "total": 0, "page": page, "limit": limit, "pages": 1}

    query = {"_id": {"$in": p_ids}}
    if search.strip():
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"username": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
        ]
    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    players = await db.users.find(query).sort("lastLogin", -1).skip(skip).limit(limit).to_list(limit)

    bans = await db.play_bans.find({"project_slug": slug}).to_list(None)
    banned_ids = {b["user_id"] for b in bans}
    result = []
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
    return {"players": result, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

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
    ban = await db.play_bans.find_one({"user_id": oid, "project_slug": slug})
    nickname_doc = await db.play_nicknames.find_one({"user_id": oid, "project_slug": slug})
    guild_info = None
    membership = await db.guild_members.find_one({"user_id": oid, "project_slug": slug})
    if membership:
        guild = await db.guilds.find_one({"_id": membership["guild_id"]})
        if guild:
            guild_info = {"id": str(guild["_id"]), "name": guild.get("name", ""), "role": membership.get("role", "member")}
    return {
        "player": {
            "id": str(player["_id"]), "username": player["username"], "email": player["email"],
            "created_at": str(player.get("createdAt", "")),
            "last_seen":  str(player.get("lastLogin", "")),
            "banned": ban is not None,
            "nickname": nickname_doc["nickname"] if nickname_doc else None,
            "guild": guild_info,
        },
        "saves": {s["category"]: s["data"] for s in saves}
    }

@router.patch("/admin/projects/{slug}/play/players/{player_id}/saves/{category}")
async def admin_play_update_save(slug: str, player_id: str, category: str, request: Request, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    cat_doc = await db.play_save_categories.find_one({"project_slug": slug, "name": category})
    if not cat_doc:
        raise HTTPException(400, "Catégorie invalide — créez-la d'abord dans l'onglet Categories")
    if cat_doc.get("player_scope") == "specific" and oid not in cat_doc.get("target_user_ids", []):
        raise HTTPException(400, "Cette catégorie n'est pas autorisée pour ce joueur")
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
    await log_action("player", f"Admin '{user['username']}' updated save '{category}' for player {player_id}", project_slug=slug, user=user["username"])
    return {"ok": True}

@router.delete("/admin/projects/{slug}/play/players/{player_id}/saves/{category}")
async def admin_play_delete_save(slug: str, player_id: str, category: str, user=Depends(require_permission("manage_play"))):
    """Manually delete a single save slot — the missing piece next to the
    upsert-only PATCH above (which creates/updates but never removes)."""
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    r = await db.play_saves.delete_one({"user_id": oid, "project_slug": slug, "category": category})
    if r.deleted_count == 0:
        raise HTTPException(404, "Save slot not found")
    await log_action("player", f"Admin '{user['username']}' deleted save slot '{category}' for player {player_id}", project_slug=slug, user=user["username"])
    return {"ok": True}

@router.post("/admin/projects/{slug}/play/saves/bulk")
async def admin_play_bulk_update_saves(slug: str, req: PlaySaveBulkUpdateRequest, user=Depends(require_permission("manage_play"))):
    """Applies the same save data to multiple players at once."""
    if not req.user_ids:
        raise HTTPException(400, "No players selected")
    try:
        json.loads(req.data)
    except Exception:
        raise HTTPException(400, "JSON invalide")
    cat_doc = await db.play_save_categories.find_one({"project_slug": slug, "name": req.category})
    if not cat_doc:
        raise HTTPException(400, "Catégorie invalide — créez-la d'abord dans l'onglet Categories")
    try:
        oids = [ObjectId(uid) for uid in req.user_ids]
    except Exception:
        raise HTTPException(400, "ID invalide dans la sélection")
    if cat_doc.get("player_scope") == "specific":
        allowed = set(cat_doc.get("target_user_ids", []))
        oids = [oid for oid in oids if oid in allowed]
        if not oids:
            raise HTTPException(400, "Aucun des joueurs sélectionnés n'est autorisé pour cette catégorie")
    now = datetime.now(timezone.utc)
    for oid in oids:
        await db.play_saves.update_one(
            {"user_id": oid, "project_slug": slug, "category": req.category},
            {"$set": {"data": req.data, "updated_at": now}},
            upsert=True,
        )
    await log_action("player", f"Admin '{user['username']}' bulk-updated save '{req.category}' for {len(oids)} player(s)", project_slug=slug, user=user["username"])
    return {"ok": True, "updated": len(oids)}

# ── Admin: save-slot category definitions ───────────────────────────────────

@router.get("/admin/projects/{slug}/play/categories")
async def admin_list_categories(slug: str, user=Depends(require_permission("manage_play"))):
    docs = await _get_project_categories(slug)
    # Resolve target usernames once so the admin UI can show who a
    # player-specific category actually applies to, not just a raw ID count.
    all_target_ids = {uid for c in docs for uid in c.get("target_user_ids", [])}
    users_by_id = {}
    if all_target_ids:
        found = await db.users.find({"_id": {"$in": list(all_target_ids)}}, {"username": 1}).to_list(None)
        users_by_id = {str(u["_id"]): u.get("username", "?") for u in found}
    return {"categories": [
        {
            "id": str(c["_id"]), "name": c["name"], "label": c.get("label", c["name"]),
            "player_scope": c.get("player_scope", "all"),
            "target_user_ids": [str(u) for u in c.get("target_user_ids", [])],
            "target_usernames": [users_by_id.get(str(u), "?") for u in c.get("target_user_ids", [])],
            "created_at": str(c.get("created_at", "")),
            "created_by": c.get("created_by", ""),
        }
        for c in docs
    ]}

@router.post("/admin/projects/{slug}/play/categories")
async def admin_create_category(slug: str, req: PlaySaveCategoryRequest, user=Depends(require_permission("manage_play"))):
    name = req.name.strip().lower()
    if not re.match(r'^[a-z0-9_]{2,32}$', name):
        raise HTTPException(400, "Name must be 2-32 characters (lowercase letters, numbers, underscores)")
    if await db.play_save_categories.find_one({"project_slug": slug, "name": name}):
        raise HTTPException(400, f"Category '{name}' already exists for this project")
    if req.player_scope not in ("all", "specific"):
        raise HTTPException(400, "player_scope must be 'all' or 'specific'")
    target_user_ids = []
    if req.player_scope == "specific":
        if not req.target_user_ids:
            raise HTTPException(400, "Select at least one player for a player-specific category")
        try:
            target_user_ids = [ObjectId(uid) for uid in req.target_user_ids]
        except Exception:
            raise HTTPException(400, "Invalid player ID in selection")
    doc = {
        "project_slug": slug, "name": name, "label": (req.label or name).strip()[:50],
        "player_scope": req.player_scope, "target_user_ids": target_user_ids,
        "created_at": datetime.now(timezone.utc), "created_by": user["username"],
    }
    await db.play_save_categories.insert_one(doc)
    await log_action("player", f"Admin '{user['username']}' created save category '{name}'", project_slug=slug, user=user["username"])
    return {"success": True, "id": str(doc["_id"])}

@router.delete("/admin/projects/{slug}/play/categories/{category_id}")
async def admin_delete_category(slug: str, category_id: str, user=Depends(require_permission("manage_play"))):
    """Removes the category DEFINITION only — existing play_saves documents
    under that name are left untouched (delete those via the per-slot DELETE
    endpoint above if you also want the data gone)."""
    try:
        oid = ObjectId(category_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    r = await db.play_save_categories.delete_one({"_id": oid, "project_slug": slug})
    if r.deleted_count == 0:
        raise HTTPException(404, "Category not found")
    await log_action("player", f"Admin '{user['username']}' deleted a save category", project_slug=slug, user=user["username"])
    return {"success": True}

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
