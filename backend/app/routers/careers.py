from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_any_of
from ..utils import log_action
from ..schemas import CareerCreateRequest, CareerUpdateRequest

router = APIRouter()

# ============================================================
# CAREERS
# ============================================================

@router.get("/careers")
async def list_careers_public():
    """Public — returns only open positions."""
    docs = await db.careers.find({"is_open": True}).sort("created_at", -1).to_list(100)
    return {"careers": [{**{k: str(v) if k == "_id" else v for k, v in d.items()}} for d in docs]}

@router.get("/admin/careers")
async def list_careers_admin(user=Depends(require_any_of("manager_careers"))):
    """Admin — returns all positions (open and closed), each with its
    application count (recruitment tickets linked via career_id)."""
    docs = await db.careers.find().sort("created_at", -1).to_list(200)
    counts_raw = await db.support_tickets.aggregate([
        {"$match": {"career_id": {"$ne": None}}},
        {"$group": {"_id": "$career_id", "count": {"$sum": 1}}},
    ]).to_list(500)
    counts = {str(c["_id"]): c["count"] for c in counts_raw}
    return {"careers": [
        {**{k: str(v) if k == "_id" else v for k, v in d.items()}, "application_count": counts.get(str(d["_id"]), 0)}
        for d in docs
    ]}

@router.get("/admin/careers/{career_id}/applications")
async def list_career_applications(career_id: str, user=Depends(require_any_of("manager_careers"))):
    """Recruitment tickets linked to this position, most recent first."""
    try:
        oid = ObjectId(career_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    tickets = await db.support_tickets.find({"career_id": oid}).sort("created_at", -1).to_list(500)
    return {"applications": [
        {
            "ticket_number": t.get("ticket_number", ""),
            "status": t.get("status", "open"),
            "username": t.get("username", ""),
            "user_email": t.get("user_email", ""),
            "created_at": t["created_at"].isoformat() if isinstance(t.get("created_at"), datetime) else str(t.get("created_at", "")),
        }
        for t in tickets
    ]}

@router.post("/admin/careers")
async def create_career(body: CareerCreateRequest, user=Depends(require_any_of("manager_careers"))):
    now = datetime.now(timezone.utc)
    doc = {**body.dict(), "created_at": now, "updated_at": now, "author": user["username"]}
    result = await db.careers.insert_one(doc)
    await log_action("careers", f"Career '{body.title}' created", user=user["username"])
    return {"id": str(result.inserted_id)}

@router.put("/admin/careers/{career_id}")
async def update_career(career_id: str, body: CareerUpdateRequest, user=Depends(require_any_of("manager_careers"))):
    try:
        oid = ObjectId(career_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.careers.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}

@router.delete("/admin/careers/{career_id}")
async def delete_career(career_id: str, user=Depends(require_any_of("manager_careers"))):
    try:
        oid = ObjectId(career_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    await db.careers.delete_one({"_id": oid})
    return {"ok": True}
