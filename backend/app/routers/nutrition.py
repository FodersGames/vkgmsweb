from datetime import datetime, timezone, timedelta

import aiohttp
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Query

from ..database import db
from ..deps import get_current_user
from ..utils import serialize_doc
from ..schemas import (
    NutritionGoalsRequest, NutritionGoalsEstimateRequest, MealEntryCreateRequest,
    MealEntryUpdateRequest, FavoriteFoodCreateRequest,
)

router = APIRouter()

DEFAULT_GOALS = {"daily_calories": 2000, "daily_protein_g": 120, "daily_carbs_g": 250, "daily_fat_g": 65}

PROFILE_FIELDS = ("weight_kg", "height_cm", "age", "sex", "activity_level", "goal_type")

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}
GOAL_CALORIE_ADJUSTMENT = {"lose": -500, "maintain": 0, "gain": 300}
MIN_CALORIES = 1200

# ============================================================
# GOALS
# ============================================================

@router.get("/nutrition/goals")
async def get_goals(user=Depends(get_current_user)):
    doc = await db.nutrition_goals.find_one({"user_id": ObjectId(user["id"])})
    if not doc:
        return {**DEFAULT_GOALS, **{f: None for f in PROFILE_FIELDS}}
    result = {
        "daily_calories": doc.get("daily_calories", DEFAULT_GOALS["daily_calories"]),
        "daily_protein_g": doc.get("daily_protein_g", DEFAULT_GOALS["daily_protein_g"]),
        "daily_carbs_g": doc.get("daily_carbs_g", DEFAULT_GOALS["daily_carbs_g"]),
        "daily_fat_g": doc.get("daily_fat_g", DEFAULT_GOALS["daily_fat_g"]),
    }
    for f in PROFILE_FIELDS:
        result[f] = doc.get(f)
    return result

@router.put("/nutrition/goals")
async def set_goals(body: NutritionGoalsRequest, user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    await db.nutrition_goals.update_one(
        {"user_id": uid},
        {"$set": {**body.dict(), "user_id": uid, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}

@router.post("/nutrition/goals/estimate")
async def estimate_goals(body: NutritionGoalsEstimateRequest, user=Depends(get_current_user)):
    """Mifflin-St Jeor BMR -> TDEE -> goal calories, with a common protein/fat/carb
    split (protein by bodyweight, fat as a fixed share of calories, carbs fill the rest).
    Stateless — the caller still confirms via PUT /nutrition/goals to persist."""
    if body.sex == "male":
        bmr = 10 * body.weight_kg + 6.25 * body.height_cm - 5 * body.age + 5
    else:
        bmr = 10 * body.weight_kg + 6.25 * body.height_cm - 5 * body.age - 161
    tdee = bmr * ACTIVITY_MULTIPLIERS[body.activity_level]
    calories = max(MIN_CALORIES, round(tdee + GOAL_CALORIE_ADJUSTMENT[body.goal_type]))

    protein_per_kg = 2.2 if body.goal_type == "lose" else 1.8
    protein_g = round(body.weight_kg * protein_per_kg)
    fat_g = round((calories * 0.25) / 9)
    remaining_calories = max(0, calories - (protein_g * 4) - (fat_g * 9))
    carbs_g = round(remaining_calories / 4)

    return {
        "daily_calories": calories,
        "daily_protein_g": protein_g,
        "daily_carbs_g": carbs_g,
        "daily_fat_g": fat_g,
    }

# ============================================================
# MEAL ENTRIES
# ============================================================

def _day_bounds(date_str):
    """Parses a YYYY-MM-DD string into [start, end) UTC datetimes for that day."""
    try:
        day = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date, expected YYYY-MM-DD")
    return day, day + timedelta(days=1)

@router.get("/nutrition/entries")
async def list_entries(date: str = Query(None), user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start, end = _day_bounds(target)
    docs = await db.meal_entries.find({
        "user_id": uid,
        "logged_at": {"$gte": start, "$lt": end},
    }).sort("logged_at", 1).to_list(200)
    entries = [serialize_doc(d) for d in docs]
    for e in entries:
        e.pop("user_id", None)
    totals = {
        "calories": sum(e.get("calories", 0) for e in entries),
        "protein_g": sum(e.get("protein_g", 0) for e in entries),
        "carbs_g": sum(e.get("carbs_g", 0) for e in entries),
        "fat_g": sum(e.get("fat_g", 0) for e in entries),
    }
    return {"date": target, "entries": entries, "totals": totals}

@router.get("/nutrition/entries/stats")
async def entries_stats(days: int = Query(7, ge=1, le=90), user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    raw = await db.meal_entries.aggregate([
        {"$match": {"user_id": uid, "logged_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$logged_at"}},
            "calories": {"$sum": "$calories"},
            "protein_g": {"$sum": "$protein_g"},
            "carbs_g": {"$sum": "$carbs_g"},
            "fat_g": {"$sum": "$fat_g"},
        }},
    ]).to_list(days)
    by_date = {d["_id"]: d for d in raw}
    result = []
    for i in range(days):
        day = (since + timedelta(days=i)).strftime("%Y-%m-%d")
        d = by_date.get(day)
        result.append({
            "date": day,
            "calories": round(d["calories"], 1) if d else 0,
            "protein_g": round(d["protein_g"], 1) if d else 0,
            "carbs_g": round(d["carbs_g"], 1) if d else 0,
            "fat_g": round(d["fat_g"], 1) if d else 0,
        })
    return {"days": result}

@router.post("/nutrition/entries")
async def create_entry(body: MealEntryCreateRequest, user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    logged_at = datetime.now(timezone.utc)
    if body.logged_at:
        try:
            logged_at = datetime.fromisoformat(body.logged_at.replace("Z", "+00:00"))
        except ValueError:
            pass
    doc = {
        "user_id": uid,
        "name": body.name.strip()[:120],
        "meal_type": body.meal_type,
        "quantity_g": body.quantity_g,
        "photo_url": body.photo_url or "",
        "calories": max(0, body.calories),
        "protein_g": max(0, body.protein_g),
        "carbs_g": max(0, body.carbs_g),
        "fat_g": max(0, body.fat_g),
        "notes": (body.notes or "")[:500],
        "logged_at": logged_at,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.meal_entries.insert_one(doc)
    return {"id": str(result.inserted_id)}

@router.put("/nutrition/entries/{entry_id}")
async def update_entry(entry_id: str, body: MealEntryUpdateRequest, user=Depends(get_current_user)):
    try:
        oid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    existing = await db.meal_entries.find_one({"_id": oid, "user_id": ObjectId(user["id"])})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "logged_at" in update:
        try:
            update["logged_at"] = datetime.fromisoformat(update["logged_at"].replace("Z", "+00:00"))
        except ValueError:
            update.pop("logged_at")
    if update:
        await db.meal_entries.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}

@router.delete("/nutrition/entries/{entry_id}")
async def delete_entry(entry_id: str, user=Depends(get_current_user)):
    try:
        oid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.meal_entries.delete_one({"_id": oid, "user_id": ObjectId(user["id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}

# ============================================================
# FAVORITE FOODS
# ============================================================

@router.get("/nutrition/favorites")
async def list_favorites(user=Depends(get_current_user)):
    docs = await db.favorite_foods.find({"user_id": ObjectId(user["id"])}).sort("created_at", -1).to_list(200)
    favorites = [serialize_doc(d) for d in docs]
    for f in favorites:
        f.pop("user_id", None)
    return {"favorites": favorites}

@router.post("/nutrition/favorites")
async def create_favorite(body: FavoriteFoodCreateRequest, user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    doc = {
        "user_id": uid,
        "name": body.name.strip()[:120],
        "meal_type": body.meal_type,
        "quantity_g": body.quantity_g,
        "photo_url": body.photo_url or "",
        "calories": max(0, body.calories),
        "protein_g": max(0, body.protein_g),
        "carbs_g": max(0, body.carbs_g),
        "fat_g": max(0, body.fat_g),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.favorite_foods.insert_one(doc)
    return {"id": str(result.inserted_id)}

@router.delete("/nutrition/favorites/{favorite_id}")
async def delete_favorite(favorite_id: str, user=Depends(get_current_user)):
    try:
        oid = ObjectId(favorite_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.favorite_foods.delete_one({"_id": oid, "user_id": ObjectId(user["id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"ok": True}

# ============================================================
# FOOD SEARCH (Open Food Facts — public, no API key required)
# ============================================================

@router.get("/nutrition/search")
async def search_food(q: str = Query(..., min_length=2, max_length=80), user=Depends(get_current_user)):
    url = "https://world.openfoodfacts.org/cgi/search.pl"
    params = {
        "search_terms": q,
        "search_simple": "1",
        "action": "process",
        "json": "1",
        "page_size": "20",
        "fields": "product_name,brands,nutriments,image_front_small_url,code",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=6)) as resp:
                if resp.status != 200:
                    return {"results": []}
                data = await resp.json()
    except Exception:
        return {"results": []}

    results = []
    for p in data.get("products", []):
        name = (p.get("product_name") or "").strip()
        if not name:
            continue
        nutriments = p.get("nutriments") or {}
        results.append({
            "id": p.get("code", ""),
            "name": name,
            "brand": (p.get("brands") or "").split(",")[0].strip(),
            "image_url": p.get("image_front_small_url") or "",
            "calories_per_100g": nutriments.get("energy-kcal_100g", 0) or 0,
            "protein_per_100g": nutriments.get("proteins_100g", 0) or 0,
            "carbs_per_100g": nutriments.get("carbohydrates_100g", 0) or 0,
            "fat_per_100g": nutriments.get("fat_100g", 0) or 0,
        })
        if len(results) >= 15:
            break
    return {"results": results}
