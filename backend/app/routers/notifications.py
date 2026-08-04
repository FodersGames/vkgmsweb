import math
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import get_current_user
from ..utils import serialize_doc

router = APIRouter()

# ============== NOTIFICATIONS ==============
@router.get("/notifications")
async def get_notifications(page: int = 1, limit: int = 20, notif_type: Optional[str] = None, user=Depends(get_current_user)):
    user_oid = ObjectId(user["id"])
    q: dict = {"userId": user_oid}
    if notif_type:
        q["type"] = notif_type
    skip = (page - 1) * limit
    total = await db.notifications.count_documents(q)
    unread = await db.notifications.count_documents({**q, "read": False})
    notifs = await db.notifications.find(q).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    return {
        "notifications": [serialize_doc(n) for n in notifs],
        "total": total,
        "unread": unread,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }

@router.patch("/notifications/read-all")
async def mark_all_notifications_read(notif_type: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {"userId": ObjectId(user["id"]), "read": False}
    if notif_type:
        q["type"] = notif_type
    await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"success": True}

@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    n = await db.notifications.find_one({"_id": oid, "userId": ObjectId(user["id"])})
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.notifications.update_one({"_id": oid}, {"$set": {"read": True}})
    return {"success": True}

@router.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: str, user=Depends(get_current_user)):
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    r = await db.notifications.delete_one({"_id": oid, "userId": ObjectId(user["id"])})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}
