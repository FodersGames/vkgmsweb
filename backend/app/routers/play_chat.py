from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from ..database import db
from ..deps import require_permission
from ..utils import serialize_doc, log_action
from ..chat_common import get_banned_words, censor_message, _get_chat_maintenance
from ..play_auth import _get_play_user_from_access, _is_project_banned
from ..rate_limit import limiter
from ..schemas import PlayChatSendRequest, ChatReactionRequest, ChatBanRequest, ChatMuteRequest, ChatMaintenanceRequest

router = APIRouter()

CHAT_MAX_LEN   = 200
CHAT_HISTORY_CAP = 150
REACTION_EMOJIS = {"👍", "❤️", "😂", "😮", "😢", "🔥"}

# ── Messaging ─────────────────────────────────────────────────────────────────

@router.post("/play/chat/send")
@limiter.limit("1/2seconds")
async def play_chat_send(request: Request, req: PlayChatSendRequest, play_user=Depends(_get_play_user_from_access)):
    project_slug = req.project_slug.strip()
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    if await db.chat_bans.find_one({"user_id": play_user["_id"], "project_slug": project_slug}):
        raise HTTPException(403, "You are blocked from chat in this game")
    mute = await db.chat_mutes.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    now = datetime.now(timezone.utc)
    if mute and mute["muted_until"] > now:
        raise HTTPException(403, f"Muted for {int((mute['muted_until'] - now).total_seconds())} more seconds")

    maintenance = await _get_chat_maintenance(project_slug)
    membership = await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug})

    guild_id = None
    if req.channel == "global":
        if not maintenance["chat_global_enabled"]:
            raise HTTPException(503, "Global chat is currently disabled")
    else:
        if not maintenance["chat_guilds_enabled"]:
            raise HTTPException(503, "The guild system is currently disabled")
        if not membership:
            raise HTTPException(400, "You are not in a guild")
        guild_id = membership["guild_id"]

    guild_badge = None
    if membership:
        guild_doc = await db.guilds.find_one({"_id": membership["guild_id"]}, {"logo_id": 1, "color": 1, "name": 1})
        if guild_doc:
            guild_badge = {"logo_id": guild_doc.get("logo_id"), "color": guild_doc.get("color"), "name": guild_doc.get("name")}

    message = req.message.strip()[:CHAT_MAX_LEN]
    if not message:
        raise HTTPException(400, "Message required")
    banned_words = await get_banned_words()
    clean_message = censor_message(message, banned_words)

    nickname_doc = await db.play_nicknames.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    username = nickname_doc["nickname"] if nickname_doc else play_user["username"]

    doc = {
        "project_slug": project_slug, "channel": req.channel, "guild_id": guild_id,
        "user_id": play_user["_id"], "username": username, "level": None,
        "message": clean_message, "reactions": [], "timestamp": now,
        "guild_badge": guild_badge,
    }
    result = await db.chat_messages.insert_one(doc)
    doc["_id"] = result.inserted_id

    scope_query: dict = {"project_slug": project_slug, "channel": req.channel}
    if guild_id:
        scope_query["guild_id"] = guild_id
    count = await db.chat_messages.count_documents(scope_query)
    if count > CHAT_HISTORY_CAP:
        oldest = await db.chat_messages.find(scope_query).sort("timestamp", 1).limit(count - CHAT_HISTORY_CAP).to_list(count - CHAT_HISTORY_CAP)
        await db.chat_messages.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})

    return {"success": True, "message_data": serialize_doc(doc)}

@router.get("/play/chat")
async def play_chat_get(project_slug: str, channel: str = "global", limit: int = 50,
                         play_user=Depends(_get_play_user_from_access)):
    limit = min(max(limit, 1), 100)
    blocked = await db.chat_bans.find_one({"user_id": play_user["_id"], "project_slug": project_slug}) is not None
    mute = await db.chat_mutes.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    muted_until = None
    if mute and mute["muted_until"] > datetime.now(timezone.utc):
        muted_until = mute["muted_until"].isoformat()

    maintenance = await _get_chat_maintenance(project_slug)
    channel_enabled = maintenance["chat_global_enabled"] if channel == "global" else maintenance["chat_guilds_enabled"]

    my_guild = None
    query: dict = {"project_slug": project_slug, "channel": channel}
    if channel == "guild":
        membership = await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
        if not membership:
            return {"messages": [], "blocked": blocked, "muted_until": muted_until,
                     "channel_enabled": channel_enabled, "in_guild": False}
        query["guild_id"] = membership["guild_id"]
        my_guild = membership["guild_id"]
    messages = await db.chat_messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    messages.reverse()
    return {
        "messages": [serialize_doc(m) for m in messages], "blocked": blocked, "muted_until": muted_until,
        "channel_enabled": channel_enabled, "in_guild": my_guild is not None,
    }

@router.post("/play/chat/{message_id}/react")
async def play_chat_react(message_id: str, req: ChatReactionRequest, play_user=Depends(_get_play_user_from_access)):
    if req.emoji not in REACTION_EMOJIS:
        raise HTTPException(400, "Invalid emoji")
    try:
        oid = ObjectId(message_id)
    except Exception:
        raise HTTPException(400, "Invalid message ID")
    msg = await db.chat_messages.find_one({"_id": oid})
    if not msg:
        raise HTTPException(404, "Message not found")
    uid_str = str(play_user["_id"])
    reactions = msg.get("reactions", [])
    entry = next((r for r in reactions if r["emoji"] == req.emoji), None)
    if entry and uid_str in entry.get("user_ids", []):
        entry["user_ids"].remove(uid_str)
        if not entry["user_ids"]:
            reactions = [r for r in reactions if r["emoji"] != req.emoji]
    elif entry:
        entry["user_ids"].append(uid_str)
    else:
        reactions.append({"emoji": req.emoji, "user_ids": [uid_str]})
    await db.chat_messages.update_one({"_id": oid}, {"$set": {"reactions": reactions}})
    return {"success": True, "reactions": reactions}

# ── Dashboard moderation (chat bans/mutes, maintenance) ──────────────────────

@router.get("/admin/projects/{slug}/chat/moderation")
async def admin_chat_moderation_list(slug: str, user=Depends(require_permission("manage_chat"))):
    bans = await db.chat_bans.find({"project_slug": slug}).to_list(500)
    mutes = await db.chat_mutes.find({"project_slug": slug}).to_list(500)
    now = datetime.now(timezone.utc)
    user_ids = list({b["user_id"] for b in bans} | {m["user_id"] for m in mutes})
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(500) if user_ids else []
    users_by_id = {u["_id"]: u for u in users}
    return {
        "bans": [
            {"user_id": str(b["user_id"]), "username": users_by_id.get(b["user_id"], {}).get("username", "?"),
             "banned_at": b["banned_at"].isoformat(), "banned_by": b.get("banned_by")}
            for b in bans
        ],
        "mutes": [
            {"user_id": str(m["user_id"]), "username": users_by_id.get(m["user_id"], {}).get("username", "?"),
             "muted_until": m["muted_until"].isoformat(), "active": m["muted_until"] > now,
             "reason": m.get("reason", ""), "muted_by": m.get("muted_by")}
            for m in mutes
        ],
    }

@router.post("/admin/projects/{slug}/chat/ban")
async def admin_chat_ban(slug: str, req: ChatBanRequest, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(req.user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await db.chat_bans.update_one(
        {"user_id": oid, "project_slug": slug},
        {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": user["username"]}},
        upsert=True,
    )
    await log_action("chat", f"Player {req.user_id} blocked from chat", project_slug=slug, user=user["username"])
    return {"success": True}

@router.delete("/admin/projects/{slug}/chat/ban/{user_id}")
async def admin_chat_unban(slug: str, user_id: str, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await db.chat_bans.delete_one({"user_id": oid, "project_slug": slug})
    await log_action("chat", f"Player {user_id} unblocked from chat", project_slug=slug, user=user["username"])
    return {"success": True}

@router.post("/admin/projects/{slug}/chat/mute")
async def admin_chat_mute(slug: str, req: ChatMuteRequest, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(req.user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    if req.duration_minutes <= 0:
        raise HTTPException(400, "Duration must be positive")
    muted_until = datetime.now(timezone.utc) + timedelta(minutes=req.duration_minutes)
    await db.chat_mutes.update_one(
        {"user_id": oid, "project_slug": slug},
        {"$set": {"muted_until": muted_until, "muted_by": user["username"], "reason": req.reason.strip()}},
        upsert=True,
    )
    await log_action("chat", f"Player {req.user_id} muted for {req.duration_minutes} minutes", project_slug=slug, user=user["username"])
    return {"success": True, "muted_until": muted_until.isoformat()}

@router.delete("/admin/projects/{slug}/chat/mute/{user_id}")
async def admin_chat_unmute(slug: str, user_id: str, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await db.chat_mutes.delete_one({"user_id": oid, "project_slug": slug})
    await log_action("chat", f"Player {user_id} unmuted", project_slug=slug, user=user["username"])
    return {"success": True}

@router.get("/admin/projects/{slug}/chat/settings")
async def admin_get_chat_settings(slug: str, user=Depends(require_permission("manage_chat"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(404, "Project not found")
    return {
        "chat_global_enabled": project.get("chat_global_enabled", True),
        "chat_guilds_enabled": project.get("chat_guilds_enabled", True),
    }

@router.put("/admin/projects/{slug}/chat/settings")
async def admin_update_chat_settings(slug: str, req: ChatMaintenanceRequest, user=Depends(require_permission("manage_chat"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    await db.projects.update_one({"slug": slug}, {"$set": updates})
    parts = [f"{k.replace('chat_', '').replace('_enabled', '')}: {'on' if v else 'off'}" for k, v in updates.items()]
    await log_action("chat", "Chat settings updated (" + ", ".join(parts) + ")", project_slug=slug, user=user["username"])
    return {"success": True, **updates}
