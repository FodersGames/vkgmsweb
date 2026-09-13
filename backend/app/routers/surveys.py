import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from ..database import db
from ..deps import require_any_of, get_optional_user
from ..utils import slugify, serialize_doc, log_action
from ..schemas import SurveyCreateRequest, SurveyUpdateRequest, SurveySubmitRequest
from ..rate_limit import limiter

router = APIRouter()

# Helper to find a survey by ObjectId or slug
async def _get_survey_by_id_or_slug(slug_or_id: str):
    query = {"slug": slug_or_id}
    if ObjectId.is_valid(slug_or_id):
        query = {"$or": [{"_id": ObjectId(slug_or_id)}, {"slug": slug_or_id}]}
    survey = await db.surveys.find_one(query)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return survey


# ====================================================================
# PUBLIC SURVEY ENDPOINTS
# ====================================================================

@router.get("/public/surveys/{slug}")
async def get_public_survey(slug: str):
    survey = await db.surveys.find_one({"slug": slug})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    # Return survey definition (excluding sensitive admin metadata)
    return {
        "survey": {
            "id": str(survey["_id"]),
            "slug": survey["slug"],
            "title": survey.get("title", ""),
            "description": survey.get("description", ""),
            "status": survey.get("status", "active"),
            "allow_anonymous": survey.get("allow_anonymous", True),
            "questions": survey.get("questions", []),
            "created_at": survey.get("created_at"),
        }
    }


@router.post("/public/surveys/{slug}/submit")
@limiter.limit("30/minute")
async def submit_public_survey(request: Request, slug: str, req: SurveySubmitRequest):
    survey = await db.surveys.find_one({"slug": slug})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    if survey.get("status") == "closed":
        raise HTTPException(status_code=400, detail="This survey is currently closed and no longer accepting responses.")

    # Check optional auth
    current_user = await get_optional_user(request)
    if not survey.get("allow_anonymous", True) and not current_user:
        raise HTTPException(status_code=401, detail="Authentication is required to submit this survey.")

    # Validate required questions
    questions = survey.get("questions", [])
    for q in questions:
        qid = q.get("id")
        is_required = q.get("required", False)
        if is_required:
            ans = req.answers.get(qid)
            if ans is None or ans == "" or (isinstance(ans, list) and len(ans) == 0):
                raise HTTPException(status_code=400, detail=f"Question '{q.get('title', 'Question')}' is required.")

    # Compute IP hash for spam deterrence without saving raw IP
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(f"vkgms_survey_{client_ip}".encode()).hexdigest()[:16]

    # Build response document
    response_doc = {
        "survey_id": str(survey["_id"]),
        "survey_slug": survey["slug"],
        "user_id": current_user["id"] if current_user else None,
        "username": current_user["username"] if current_user else (req.username.strip() if req.username else "Anonymous"),
        "ip_hash": ip_hash,
        "answers": req.answers,
        "submitted_at": datetime.now(timezone.utc),
    }

    await db.survey_responses.insert_one(response_doc)

    # Increment response count
    await db.surveys.update_one(
        {"_id": survey["_id"]},
        {
            "$inc": {"responses_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )

    return {
        "success": True,
        "message": "Thank you! Your response has been submitted successfully."
    }


# ====================================================================
# ADMIN SURVEY ENDPOINTS
# ====================================================================

@router.get("/admin/surveys")
async def list_surveys_admin(user=Depends(require_any_of("manage_surveys", "manage_website"))):
    surveys = await db.surveys.find().sort("created_at", -1).to_list(1000)
    return {"surveys": [serialize_doc(s) for s in surveys]}


@router.post("/admin/surveys")
async def create_survey_admin(req: SurveyCreateRequest, user=Depends(require_any_of("manage_surveys", "manage_website"))):
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Survey title is required.")

    base_slug = slugify(req.slug.strip() if req.slug else title)
    if not base_slug:
        base_slug = f"survey-{secrets.token_hex(4)}"

    # Ensure uniqueness of slug
    slug = base_slug
    counter = 1
    while await db.surveys.find_one({"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Ensure each question has a valid unique ID
    prepared_questions = []
    for idx, q in enumerate(req.questions):
        q_dict = q.dict()
        if not q_dict.get("id"):
            q_dict["id"] = f"q_{idx + 1}_{secrets.token_hex(3)}"
        prepared_questions.append(q_dict)

    now = datetime.now(timezone.utc)
    doc = {
        "title": title,
        "description": req.description.strip() if req.description else "",
        "slug": slug,
        "status": req.status,
        "allow_anonymous": req.allow_anonymous,
        "questions": prepared_questions,
        "responses_count": 0,
        "created_by": user["username"],
        "created_at": now,
        "updated_at": now,
    }

    result = await db.surveys.insert_one(doc)
    doc["_id"] = result.inserted_id

    await log_action("surveys", f"Survey '{title}' created (slug: {slug})", user=user["username"])
    return {"success": True, "survey": serialize_doc(doc)}


@router.get("/admin/surveys/{slug_or_id}")
async def get_survey_detail_admin(slug_or_id: str, user=Depends(require_any_of("manage_surveys", "manage_website"))):
    survey = await _get_survey_by_id_or_slug(slug_or_id)
    survey_id_str = str(survey["_id"])

    # Fetch all responses for analytical breakdown
    responses = await db.survey_responses.find({"survey_id": survey_id_str}).sort("submitted_at", -1).to_list(10000)
    total_responses = len(responses)

    # Compute per-question analytics
    questions = survey.get("questions", [])
    questions_analytics = {}

    for q in questions:
        qid = q.get("id")
        qtype = q.get("type", "choice")
        qtitle = q.get("title", "")
        options = q.get("options", [])

        if qtype in ("choice", "multiple_choice"):
            counts = {opt: 0 for opt in options}
            answered_count = 0
            for r in responses:
                val = r.get("answers", {}).get(qid)
                if val:
                    answered_count += 1
                    if isinstance(val, list):
                        for item in val:
                            if item in counts:
                                counts[item] += 1
                            else:
                                counts[item] = counts.get(item, 0) + 1
                    else:
                        if val in counts:
                            counts[val] += 1
                        else:
                            counts[val] = counts.get(val, 0) + 1

            # Build options with percentages
            option_stats = []
            for opt, count in counts.items():
                pct = round((count / total_responses * 100), 1) if total_responses > 0 else 0
                option_stats.append({
                    "option": opt,
                    "count": count,
                    "percentage": pct,
                })

            questions_analytics[qid] = {
                "id": qid,
                "title": qtitle,
                "type": qtype,
                "answered_count": answered_count,
                "options": option_stats,
            }

        elif qtype == "rating":
            distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            total_stars = 0
            rating_count = 0

            for r in responses:
                val = r.get("answers", {}).get(qid)
                if val is not None:
                    try:
                        num = int(val)
                        if 1 <= num <= 5:
                            distribution[num] += 1
                            total_stars += num
                            rating_count += 1
                    except (ValueError, TypeError):
                        pass

            avg_rating = round(total_stars / rating_count, 2) if rating_count > 0 else 0
            dist_stats = []
            for star in range(1, 6):
                c = distribution[star]
                pct = round((c / rating_count * 100), 1) if rating_count > 0 else 0
                dist_stats.append({
                    "stars": star,
                    "count": c,
                    "percentage": pct,
                })

            questions_analytics[qid] = {
                "id": qid,
                "title": qtitle,
                "type": qtype,
                "answered_count": rating_count,
                "average_rating": avg_rating,
                "distribution": dist_stats,
            }

        elif qtype in ("text", "long_text"):
            text_feedbacks = []
            for r in responses:
                val = r.get("answers", {}).get(qid)
                if val and str(val).strip():
                    submitted = r.get("submitted_at")
                    submitted_str = submitted.isoformat() if isinstance(submitted, datetime) else str(submitted)
                    text_feedbacks.append({
                        "id": str(r["_id"]),
                        "text": str(val).strip(),
                        "submitted_at": submitted_str,
                        "username": r.get("username", "Anonymous"),
                    })

            questions_analytics[qid] = {
                "id": qid,
                "title": qtitle,
                "type": qtype,
                "answered_count": len(text_feedbacks),
                "feedbacks": text_feedbacks,
            }

    return {
        "survey": serialize_doc(survey),
        "analytics": {
            "total_responses": total_responses,
            "questions": questions_analytics,
        }
    }


@router.put("/admin/surveys/{slug_or_id}")
async def update_survey_admin(slug_or_id: str, req: SurveyUpdateRequest, user=Depends(require_any_of("manage_surveys", "manage_website"))):
    survey = await _get_survey_by_id_or_slug(slug_or_id)
    updates = {}

    if req.title is not None:
        title = req.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        updates["title"] = title

    if req.description is not None:
        updates["description"] = req.description.strip()

    if req.status is not None:
        updates["status"] = req.status

    if req.allow_anonymous is not None:
        updates["allow_anonymous"] = req.allow_anonymous

    if req.slug is not None:
        new_slug = slugify(req.slug.strip())
        if new_slug and new_slug != survey["slug"]:
            existing = await db.surveys.find_one({"slug": new_slug, "_id": {"$ne": survey["_id"]}})
            if existing:
                raise HTTPException(status_code=400, detail="A survey with this slug already exists.")
            updates["slug"] = new_slug
            # Keep survey_responses in sync with slug
            await db.survey_responses.update_many(
                {"survey_id": str(survey["_id"])},
                {"$set": {"survey_slug": new_slug}}
            )

    if req.questions is not None:
        prepared_questions = []
        for idx, q in enumerate(req.questions):
            q_dict = q.dict()
            if not q_dict.get("id"):
                q_dict["id"] = f"q_{idx + 1}_{secrets.token_hex(3)}"
            prepared_questions.append(q_dict)
        updates["questions"] = prepared_questions

    updates["updated_at"] = datetime.now(timezone.utc)

    await db.surveys.update_one({"_id": survey["_id"]}, {"$set": updates})
    updated_doc = await db.surveys.find_one({"_id": survey["_id"]})

    await log_action("surveys", f"Survey '{survey.get('title')}' updated", user=user["username"])
    return {"success": True, "survey": serialize_doc(updated_doc)}


@router.delete("/admin/surveys/{slug_or_id}")
async def delete_survey_admin(slug_or_id: str, user=Depends(require_any_of("manage_surveys", "manage_website"))):
    survey = await _get_survey_by_id_or_slug(slug_or_id)
    survey_id_str = str(survey["_id"])

    await db.surveys.delete_one({"_id": survey["_id"]})
    await db.survey_responses.delete_many({"survey_id": survey_id_str})

    await log_action("surveys", f"Survey '{survey.get('title')}' deleted", user=user["username"])
    return {"success": True, "message": "Survey and responses deleted successfully"}


@router.get("/admin/surveys/{slug_or_id}/responses")
async def list_survey_responses_admin(slug_or_id: str, user=Depends(require_any_of("manage_surveys", "manage_website"))):
    survey = await _get_survey_by_id_or_slug(slug_or_id)
    survey_id_str = str(survey["_id"])
    responses = await db.survey_responses.find({
        "survey_id": {"$in": [survey_id_str, survey["_id"]]}
    }).sort("submitted_at", -1).to_list(1000)
    return {
        "survey": serialize_doc(survey),
        "responses": [serialize_doc(r) for r in responses],
    }


@router.delete("/admin/surveys/{slug_or_id}/responses/{response_id}")
async def delete_survey_response_admin(
    slug_or_id: str,
    response_id: str,
    user=Depends(require_any_of("manage_surveys", "manage_website"))
):
    survey = await _get_survey_by_id_or_slug(slug_or_id)
    survey_id_str = str(survey["_id"])

    resp_query = {
        "survey_id": {"$in": [survey_id_str, survey["_id"]]},
    }
    if ObjectId.is_valid(response_id):
        resp_query["$or"] = [{"_id": ObjectId(response_id)}, {"_id": response_id}]
    else:
        resp_query["_id"] = response_id

    response_doc = await db.survey_responses.find_one(resp_query)
    if not response_doc:
        raise HTTPException(status_code=404, detail="Survey response not found")

    await db.survey_responses.delete_one({"_id": response_doc["_id"]})

    # Recalculate remaining responses count
    remaining_count = await db.survey_responses.count_documents({
        "survey_id": {"$in": [survey_id_str, survey["_id"]]}
    })
    await db.surveys.update_one(
        {"_id": survey["_id"]},
        {
            "$set": {
                "responses_count": remaining_count,
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )

    await log_action(
        "surveys",
        f"Deleted response {response_id} from survey '{survey.get('title')}'",
        user=user["username"]
    )

    return {
        "success": True,
        "message": "Survey response deleted successfully",
        "remaining_count": remaining_count,
    }


@router.delete("/admin/surveys/{slug_or_id}/responses")
async def delete_all_survey_responses_admin(
    slug_or_id: str,
    user=Depends(require_any_of("manage_surveys", "manage_website"))
):
    survey = await _get_survey_by_id_or_slug(slug_or_id)
    survey_id_str = str(survey["_id"])

    res = await db.survey_responses.delete_many({
        "survey_id": {"$in": [survey_id_str, survey["_id"]]}
    })

    await db.surveys.update_one(
        {"_id": survey["_id"]},
        {
            "$set": {
                "responses_count": 0,
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )

    await log_action(
        "surveys",
        f"Deleted all {res.deleted_count} response(s) from survey '{survey.get('title')}'",
        user=user["username"]
    )

    return {
        "success": True,
        "message": f"Successfully deleted {res.deleted_count} response(s)",
        "deleted_count": res.deleted_count,
    }


