import math
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_permission, get_current_user
from ..utils import log_action
from ..schemas import MissionCreateRequest, MissionUpdateRequest, MissionCompleteRequest, MissionReopenRequest

router = APIRouter()

# ============== MISSIONS ==============
@router.get("/projects/{slug}/missions")
async def list_missions(slug: str, status: str = None, page: int = 1, limit: int = 50, user=Depends(get_current_user)):

    query = {"project_slug": slug}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    total = await db.missions.count_documents(query)
    missions = await db.missions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for m in missions:
        m["id"] = str(m.pop("_id"))
    return {"missions": missions, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

@router.post("/projects/{slug}/missions")
async def create_mission(slug: str, req: MissionCreateRequest, user=Depends(require_permission("create_missions"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    doc = {
        "project_slug": slug,
        "title": req.title.strip(),
        "description": req.description.strip(),
        "style_description": req.style_description.strip(),
        "reference_images": req.reference_images,
        "priority": req.priority,
        "status": "open",
        "created_by": user["username"],
        "created_at": datetime.now(timezone.utc),
        "claimed_by": None,
        "claimed_at": None,
        "completed_at": None,
    }
    result = await db.missions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    await log_action("missions", f"Mission created: {req.title}", user=user["username"], project_slug=slug)
    return doc

@router.put("/projects/{slug}/missions/{mission_id}")
async def update_mission(slug: str, mission_id: str, req: MissionUpdateRequest, user=Depends(get_current_user)):
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_creator = mission["created_by"] == user["username"]
    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Not authorized to edit this mission")
    update = {k: v for k, v in req.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.missions.update_one({"_id": ObjectId(mission_id)}, {"$set": update})
    return {"success": True}

@router.delete("/projects/{slug}/missions/{mission_id}")
async def delete_mission(slug: str, mission_id: str, user=Depends(get_current_user)):
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_creator = mission["created_by"] == user["username"]
    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Not authorized to delete this mission")
    await db.missions.delete_one({"_id": ObjectId(mission_id)})
    await log_action("missions", f"Mission deleted: {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

@router.post("/projects/{slug}/missions/{mission_id}/claim")
async def claim_mission(slug: str, mission_id: str, user=Depends(require_permission("claim_missions"))):
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if mission["status"] != "open":
        raise HTTPException(status_code=409, detail="Mission is not available (already claimed or closed)")
    now = datetime.now(timezone.utc)
    await db.missions.update_one(
        {"_id": ObjectId(mission_id)},
        {"$set": {"status": "in_progress", "claimed_by": user["username"], "claimed_at": now}}
    )
    await log_action("missions", f"Mission claimed: {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

@router.post("/projects/{slug}/missions/{mission_id}/unclaim")
async def unclaim_mission(slug: str, mission_id: str, user=Depends(get_current_user)):
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_claimant = mission.get("claimed_by") == user["username"]
    if not is_admin and not is_claimant:
        raise HTTPException(status_code=403, detail="You did not claim this mission")
    await db.missions.update_one(
        {"_id": ObjectId(mission_id)},
        {"$set": {"status": "open", "claimed_by": None, "claimed_at": None}}
    )
    return {"success": True}

@router.post("/projects/{slug}/missions/{mission_id}/complete")
async def complete_mission(slug: str, mission_id: str, req: MissionCompleteRequest = None, user=Depends(get_current_user)):
    if req is None:
        req = MissionCompleteRequest()
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_claimant = mission.get("claimed_by") == user["username"]
    if not is_admin and not is_claimant:
        raise HTTPException(status_code=403, detail="Only the assigned member or an admin can complete this mission")
    now = datetime.now(timezone.utc)
    round_num = len(mission.get("revisions", [])) + 1
    revision = {
        "round": round_num,
        "delivery_files": req.delivery_files,
        "delivered_by": user["username"],
        "delivered_at": now.isoformat(),
        "feedback": None,
        "feedback_by": None,
        "feedback_at": None,
    }
    await db.missions.update_one(
        {"_id": ObjectId(mission_id)},
        {
            "$set": {
                "status": "completed",
                "completed_at": now,
                "delivery_files": req.delivery_files,
            },
            "$push": {"revisions": revision},
        }
    )
    await log_action("missions", f"Mission completed (round {round_num}): {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

@router.post("/projects/{slug}/missions/{mission_id}/reopen")
async def reopen_mission(slug: str, mission_id: str, req: MissionReopenRequest, user=Depends(get_current_user)):
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_creator = mission["created_by"] == user["username"]
    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Only the mission creator or an admin can reopen a mission")
    if mission["status"] != "completed":
        raise HTTPException(status_code=409, detail="Only completed missions can be reopened")
    now = datetime.now(timezone.utc)
    revisions = mission.get("revisions", [])
    last_idx = len(revisions) - 1
    new_status = "in_progress" if req.keep_assigned else "open"
    update: dict = {
        "$set": {
            "status": new_status,
            "completed_at": None,
            "delivery_files": [],
        }
    }
    if last_idx >= 0:
        update["$set"][f"revisions.{last_idx}.feedback"] = req.feedback
        update["$set"][f"revisions.{last_idx}.feedback_by"] = user["username"]
        update["$set"][f"revisions.{last_idx}.feedback_at"] = now.isoformat()
    if not req.keep_assigned:
        update["$set"]["claimed_by"] = None
        update["$set"]["claimed_at"] = None
    await db.missions.update_one({"_id": ObjectId(mission_id)}, update)
    await log_action("missions", f"Mission reopened: {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}
