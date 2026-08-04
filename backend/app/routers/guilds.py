import re
from datetime import datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional

from ..database import db
from ..deps import require_permission
from ..utils import serialize_doc, log_action
from ..chat_common import _get_chat_maintenance
from ..guild_common import _serialize_guild
from ..play_auth import _get_play_user_from_access, _is_project_banned
from ..rate_limit import limiter
from ..schemas import PlayGuildCreateRequest, PlayGuildUpdateRequest, GuildMemberRoleRequest

router = APIRouter()

GUILD_LOGOS = ["shield", "sword", "flame", "star", "wolf", "dragon", "crown", "skull", "eagle", "lion", "anchor", "leaf"]
GUILD_NAME_MIN, GUILD_NAME_MAX = 3, 30
GUILD_MAX_MEMBERS = 10

# ── Guilds ────────────────────────────────────────────────────────────────────

@router.post("/play/guilds")
@limiter.limit("5/hour")
async def play_create_guild(request: Request, req: PlayGuildCreateRequest, play_user=Depends(_get_play_user_from_access)):
    project_slug = req.project_slug.strip()
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    if not (await _get_chat_maintenance(project_slug))["chat_guilds_enabled"]:
        raise HTTPException(503, "The guild system is currently disabled")
    if await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug}):
        raise HTTPException(400, "You are already in a guild")
    name = req.name.strip()
    if not (GUILD_NAME_MIN <= len(name) <= GUILD_NAME_MAX):
        raise HTTPException(400, f"Guild name must be {GUILD_NAME_MIN}-{GUILD_NAME_MAX} characters")
    if req.logo_id not in GUILD_LOGOS:
        raise HTTPException(400, "Invalid logo")
    if await db.guilds.find_one({"project_slug": project_slug, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
        raise HTTPException(400, "A guild with this name already exists")
    now = datetime.now(timezone.utc)
    doc = {
        "project_slug": project_slug, "name": name, "description": req.description.strip()[:200],
        "color": req.color, "logo_id": req.logo_id, "owner_id": play_user["_id"],
        "member_count": 1, "created_at": now,
    }
    result = await db.guilds.insert_one(doc)
    doc["_id"] = result.inserted_id
    await db.guild_members.insert_one({
        "guild_id": result.inserted_id, "project_slug": project_slug,
        "user_id": play_user["_id"], "role": "owner", "joined_at": now,
    })
    await log_action("guild", f"Guild '{name}' created", project_slug=project_slug, user=play_user["username"])
    return {"success": True, "guild": _serialize_guild(doc, my_role="owner")}

@router.get("/play/guilds")
async def play_list_guilds(project_slug: str, search: Optional[str] = None, play_user=Depends(_get_play_user_from_access)):
    query: dict = {"project_slug": project_slug}
    if search:
        query["name"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    guilds = await db.guilds.find(query).sort("member_count", -1).to_list(200)
    return {"guilds": [serialize_doc(g) for g in guilds]}

@router.get("/play/guilds/mine")
async def play_my_guild(project_slug: str, play_user=Depends(_get_play_user_from_access)):
    membership = await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    if not membership:
        return {"guild": None}
    guild = await db.guilds.find_one({"_id": membership["guild_id"]})
    if not guild:
        return {"guild": None}
    return {"guild": _serialize_guild(guild, my_role=membership["role"])}

@router.get("/play/guilds/{guild_id}/members")
async def play_list_guild_members(guild_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership:
        raise HTTPException(403, "Not a member of this guild")
    members = await db.guild_members.find({"guild_id": oid}).sort("joined_at", 1).to_list(500)
    users = await db.users.find({"_id": {"$in": [m["user_id"] for m in members]}}).to_list(500)
    users_by_id = {u["_id"]: u for u in users}
    return {"members": [
        {"user_id": str(m["user_id"]), "username": users_by_id.get(m["user_id"], {}).get("username", "?"),
         "role": m["role"], "joined_at": m["joined_at"].isoformat()}
        for m in members
    ]}

@router.post("/play/guilds/{guild_id}/join")
@limiter.limit("10/minute")
async def play_join_guild(request: Request, guild_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    guild = await db.guilds.find_one({"_id": oid})
    if not guild:
        raise HTTPException(404, "Guild not found")
    project_slug = guild["project_slug"]
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    if not (await _get_chat_maintenance(project_slug))["chat_guilds_enabled"]:
        raise HTTPException(503, "The guild system is currently disabled")
    if await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug}):
        raise HTTPException(400, "You are already in a guild")
    if guild.get("member_count", 0) >= GUILD_MAX_MEMBERS:
        raise HTTPException(400, f"This guild is full ({GUILD_MAX_MEMBERS}/{GUILD_MAX_MEMBERS} members)")
    try:
        await db.guild_members.insert_one({
            "guild_id": oid, "project_slug": project_slug,
            "user_id": play_user["_id"], "role": "member", "joined_at": datetime.now(timezone.utc),
        })
    except DuplicateKeyError:
        raise HTTPException(400, "You are already in a guild")
    await db.guilds.update_one({"_id": oid}, {"$inc": {"member_count": 1}})
    return {"success": True}

@router.post("/play/guilds/{guild_id}/leave")
async def play_leave_guild(guild_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership:
        raise HTTPException(404, "Not a member of this guild")
    await db.guild_members.delete_one({"_id": membership["_id"]})
    await db.guilds.update_one({"_id": oid}, {"$inc": {"member_count": -1}})

    if membership["role"] == "owner":
        # Auto-promote: longest-standing officer, else longest-standing member, else disband.
        next_owner = await db.guild_members.find_one({"guild_id": oid, "role": "officer"}, sort=[("joined_at", 1)])
        if not next_owner:
            next_owner = await db.guild_members.find_one({"guild_id": oid}, sort=[("joined_at", 1)])
        if next_owner:
            await db.guild_members.update_one({"_id": next_owner["_id"]}, {"$set": {"role": "owner"}})
        else:
            await db.guilds.delete_one({"_id": oid})
            await db.chat_messages.delete_many({"guild_id": oid})
    return {"success": True}

@router.patch("/play/guilds/{guild_id}")
async def play_update_guild(guild_id: str, req: PlayGuildUpdateRequest, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership or membership["role"] not in ("owner", "officer"):
        raise HTTPException(403, "Only the owner or an officer can edit the guild")
    guild = await db.guilds.find_one({"_id": oid})
    if not guild:
        raise HTTPException(404, "Guild not found")
    updates: dict = {}
    if req.name is not None:
        name = req.name.strip()
        if not (GUILD_NAME_MIN <= len(name) <= GUILD_NAME_MAX):
            raise HTTPException(400, f"Guild name must be {GUILD_NAME_MIN}-{GUILD_NAME_MAX} characters")
        if await db.guilds.find_one({"project_slug": guild["project_slug"], "_id": {"$ne": oid},
                                      "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
            raise HTTPException(400, "A guild with this name already exists")
        updates["name"] = name
    if req.description is not None:
        updates["description"] = req.description.strip()[:200]
    if req.color is not None:
        updates["color"] = req.color
    if req.logo_id is not None:
        if req.logo_id not in GUILD_LOGOS:
            raise HTTPException(400, "Invalid logo")
        updates["logo_id"] = req.logo_id
    if updates:
        await db.guilds.update_one({"_id": oid}, {"$set": updates})
    updated = await db.guilds.find_one({"_id": oid})
    return {"success": True, "guild": _serialize_guild(updated, my_role=membership["role"])}

@router.patch("/play/guilds/{guild_id}/members/{member_user_id}")
async def play_set_member_role(guild_id: str, member_user_id: str, req: GuildMemberRoleRequest,
                                play_user=Depends(_get_play_user_from_access)):
    try:
        oid, member_oid = ObjectId(guild_id), ObjectId(member_user_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership or membership["role"] != "owner":
        raise HTTPException(403, "Only the owner can change roles")
    target = await db.guild_members.find_one({"guild_id": oid, "user_id": member_oid})
    if not target:
        raise HTTPException(404, "Member not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot change the owner's role")
    await db.guild_members.update_one({"_id": target["_id"]}, {"$set": {"role": req.role}})
    return {"success": True}

@router.delete("/play/guilds/{guild_id}/members/{member_user_id}")
async def play_kick_member(guild_id: str, member_user_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid, member_oid = ObjectId(guild_id), ObjectId(member_user_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership or membership["role"] not in ("owner", "officer"):
        raise HTTPException(403, "Only the owner or an officer can kick members")
    target = await db.guild_members.find_one({"guild_id": oid, "user_id": member_oid})
    if not target:
        raise HTTPException(404, "Member not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot kick the owner")
    if membership["role"] == "officer" and target["role"] == "officer":
        raise HTTPException(403, "Officers cannot kick other officers")
    await db.guild_members.delete_one({"_id": target["_id"]})
    await db.guilds.update_one({"_id": oid}, {"$inc": {"member_count": -1}})
    return {"success": True}

# ── Dashboard oversight (list / disband guilds) ──────────────────────────────

@router.get("/admin/projects/{slug}/guilds")
async def admin_list_guilds(slug: str, user=Depends(require_permission("manage_chat"))):
    guilds = await db.guilds.find({"project_slug": slug}).sort("member_count", -1).to_list(500)
    return {"guilds": [serialize_doc(g) for g in guilds]}

@router.delete("/admin/projects/{slug}/guilds/{guild_id}")
async def admin_delete_guild(slug: str, guild_id: str, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    guild = await db.guilds.find_one({"_id": oid, "project_slug": slug})
    if not guild:
        raise HTTPException(404, "Guild not found")
    await db.guild_members.delete_many({"guild_id": oid})
    await db.chat_messages.delete_many({"guild_id": oid})
    await db.guilds.delete_one({"_id": oid})
    await log_action("guild", f"Guild '{guild['name']}' disbanded by admin", project_slug=slug, user=user["username"])
    return {"success": True}
