import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from ..database import db
from ..deps import require_permission
from ..utils import serialize_doc, log_action
from ..chat_common import get_banned_words, censor_message
from ..schemas import ChatMessageRequest, BannedWordsUpdateRequest
from ..rate_limit import limiter

router = APIRouter()


async def verify_chat_api_key(project_slug: str, request: Request):
    api_key = request.headers.get("X-Chat-Api-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing chat API key")
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    stored_key = project.get("chat_api_key") or ""
    if not secrets.compare_digest(stored_key, api_key):
        raise HTTPException(status_code=401, detail="Invalid chat API key")
    return project

# ============== CHAT (per-project, public POST/GET + admin moderation) ==============
@router.post("/projects/{project_slug}/chat")
@limiter.limit("1/3seconds")
async def post_chat_message(request: Request, project_slug: str):
    await verify_chat_api_key(project_slug, request)
    body = await request.json()
    try:
        req = ChatMessageRequest(**body)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid request body")

    username = req.username.strip()[:32]
    message = req.message.strip()[:200]
    level = max(1, min(int(req.level), 9999)) if req.level is not None else None

    if not username or not message:
        raise HTTPException(status_code=400, detail="Username and message are required")

    banned_words = await get_banned_words()
    clean_message = censor_message(message, banned_words)

    doc = {"project_slug": project_slug, "username": username, "level": level,
           "message": clean_message, "timestamp": datetime.now(timezone.utc)}
    result = await db.chat_messages.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Keep only the last 100 messages per project
    count = await db.chat_messages.count_documents({"project_slug": project_slug})
    if count > 100:
        oldest = await db.chat_messages.find({"project_slug": project_slug}).sort("timestamp", 1).limit(count - 100).to_list(count - 100)
        await db.chat_messages.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})

    return {"success": True, "message_data": serialize_doc(doc)}

@router.get("/projects/{project_slug}/chat")
async def get_chat_messages(project_slug: str, limit: int = 50, channel: Optional[str] = None, guild_id: Optional[str] = None):
    limit = min(max(limit, 1), 100)
    query: dict = {"project_slug": project_slug}
    if channel:
        query["channel"] = channel
    if guild_id:
        try:
            query["guild_id"] = ObjectId(guild_id)
        except Exception:
            pass
    messages = await db.chat_messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    messages.reverse()
    return {"messages": [serialize_doc(m) for m in messages]}

@router.delete("/projects/{project_slug}/chat/{message_id}")
async def delete_chat_message(project_slug: str, message_id: str, user=Depends(require_permission("manage_chat"))):
    r = await db.chat_messages.delete_one({"_id": ObjectId(message_id), "project_slug": project_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    await log_action("chat", f"Chat message deleted in '{project_slug}'", project_slug=project_slug, user=user["username"])
    return {"success": True}

@router.post("/projects/{project_slug}/chat/regenerate-key")
async def regenerate_chat_key(project_slug: str, user=Depends(require_permission("manage_chat"))):
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    new_key = secrets.token_urlsafe(24)
    await db.projects.update_one({"slug": project_slug}, {"$set": {"chat_api_key": new_key}})
    await log_action("chat", f"Chat API key regenerated for '{project_slug}'", project_slug=project_slug, user=user["username"])
    return {"success": True, "chat_api_key": new_key}

@router.get("/website/chat/banned-words")
async def list_banned_words(user=Depends(require_permission("manage_chat"))):
    return {"words": await get_banned_words()}

@router.put("/website/chat/banned-words")
async def update_banned_words(req: BannedWordsUpdateRequest, user=Depends(require_permission("manage_chat"))):
    words = [w.strip() for w in req.words if w.strip()]
    await db.chat_settings.update_one({"key": "banned_words"}, {"$set": {"words": words}}, upsert=True)
    await log_action("chat", "Banned words list updated", user=user["username"])
    return {"success": True, "words": words}
