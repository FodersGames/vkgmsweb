from datetime import datetime, timezone
from .database import db

TIER_THRESHOLDS = [("diamond", 25000), ("gold", 10000), ("silver", 2500), ("bronze", 0)]
TIER_DISCOUNTS  = {"bronze": 0, "silver": 5, "gold": 10, "diamond": 15}

def get_tier(total_cents: int) -> str:
    for tier, threshold in TIER_THRESHOLDS:
        if total_cents >= threshold:
            return tier
    return "bronze"

async def _update_loyalty(email: str, amount_cents: int):
    """Atomically increment total_spent and recalculate tier."""
    result = await db.user_points.find_one_and_update(
        {"email": email},
        {"$inc": {"total_spent_cents": amount_cents}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=True,
    )
    new_total = result.get("total_spent_cents", amount_cents) if result else amount_cents
    tier = get_tier(new_total)
    await db.user_points.update_one({"email": email}, {"$set": {"tier": tier}})
