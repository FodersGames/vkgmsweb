import secrets
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_permission, get_current_user
from ..utils import serialize_doc, log_action, _create_notification
from ..loyalty import get_tier
from ..schemas import CouponCampaignRequest, CouponValidateRequest

router = APIRouter()

# ── Coupon campaign endpoints ────────────────────────────────────────────────

@router.post("/admin/coupons/campaign")
async def create_coupon_campaign(req: CouponCampaignRequest, user=Depends(require_permission("manage_shop"))):
    if not 1 <= req.discount_pct <= 99:
        raise HTTPException(status_code=400, detail="Discount must be between 1 and 99%")
    if req.valid_days < 1:
        raise HTTPException(status_code=400, detail="Valid days must be at least 1")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Campaign name is required")

    # Resolve target users
    if req.target_type == "tier":
        if not req.target_tiers:
            raise HTTPException(status_code=400, detail="Select at least one tier")
        all_points = await db.user_points.find({}).to_list(10000)
        target_emails = [p["email"] for p in all_points if get_tier(p.get("total_spent_cents", 0)) in req.target_tiers]
        target_users = await db.users.find({"email": {"$in": target_emails}}).to_list(10000)
    else:
        if not req.target_user_ids:
            raise HTTPException(status_code=400, detail="Select at least one user")
        oids = []
        for uid in req.target_user_ids:
            try:
                oids.append(ObjectId(uid))
            except Exception:
                pass
        target_users = await db.users.find({"_id": {"$in": oids}}).to_list(10000)

    if not target_users:
        raise HTTPException(status_code=400, detail="No users found for the selected target")

    valid_until = datetime.now(timezone.utc) + timedelta(days=req.valid_days)
    campaign_id = ObjectId()
    now = datetime.now(timezone.utc)

    scope_str = ""
    if req.scope == "product" and req.scope_name:
        scope_str = f" (for: {req.scope_name})"
    elif req.scope == "game" and req.scope_name:
        scope_str = f" (for game: {req.scope_name})"

    codes_sent = 0
    for u in target_users:
        # Generate a unique code
        code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        while await db.coupons.find_one({"code": code}):
            code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))

        await db.coupons.insert_one({
            "code": code,
            "campaign_id": campaign_id,
            "discount_pct": req.discount_pct,
            "valid_until": valid_until,
            "scope": req.scope,
            "scope_id": req.scope_id,
            "scope_name": req.scope_name,
            "assigned_to_user_id": u["_id"],
            "assigned_to_email": u["email"],
            "used": False,
            "used_at": None,
            "created_at": now,
            "created_by": user["username"],
        })

        msg = (
            f"🎁 You received a promo code: {code} — {req.discount_pct}% off{scope_str}. "
            f"Valid until {valid_until.strftime('%Y-%m-%d')}. Enter it at checkout!"
        )
        coupon_link = "/games" if req.scope == "game" else "/shop"
        await _create_notification(str(u["_id"]), msg, notif_type="coupon", link=coupon_link)
        codes_sent += 1

    await db.coupon_campaigns.insert_one({
        "_id": campaign_id,
        "name": req.name.strip(),
        "target_type": req.target_type,
        "target_tiers": req.target_tiers,
        "discount_pct": req.discount_pct,
        "valid_days": req.valid_days,
        "valid_until": valid_until,
        "scope": req.scope,
        "scope_id": req.scope_id,
        "scope_name": req.scope_name,
        "codes_count": codes_sent,
        "created_by": user["username"],
        "created_at": now,
    })
    await log_action("website", f"Coupon campaign '{req.name}' created: {codes_sent} codes sent", user=user["username"])
    return {"success": True, "campaign_id": str(campaign_id), "codes_sent": codes_sent}


@router.get("/admin/coupons/campaigns")
async def list_coupon_campaigns(user=Depends(require_permission("manage_shop"))):
    campaigns = await db.coupon_campaigns.find({}).sort("created_at", -1).to_list(200)
    return {"campaigns": [serialize_doc(c) for c in campaigns]}


@router.get("/admin/coupons/campaign/{campaign_id}")
async def get_coupon_campaign_detail(campaign_id: str, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.coupon_campaigns.find_one({"_id": oid})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    codes = await db.coupons.find({"campaign_id": oid}).sort("assigned_to_email", 1).to_list(10000)
    return {"campaign": serialize_doc(campaign), "codes": [serialize_doc(c) for c in codes]}


@router.post("/coupons/validate")
async def validate_coupon(req: CouponValidateRequest, user=Depends(get_current_user)):
    code = req.code.strip().upper()
    coupon = await db.coupons.find_one({"code": code, "assigned_to_user_id": ObjectId(user["id"])})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if coupon["used"]:
        raise HTTPException(status_code=400, detail="This coupon has already been used")
    if coupon["valid_until"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This coupon has expired")
    if coupon["scope"] == "product" and req.product_id and coupon["scope_id"] != req.product_id:
        scope_name = coupon.get("scope_name") or "a specific product"
        raise HTTPException(status_code=400, detail=f"This coupon is only valid for: {scope_name}")
    if coupon["scope"] == "game" and req.game_slug and coupon["scope_id"] != req.game_slug:
        scope_name = coupon.get("scope_name") or "a specific game"
        raise HTTPException(status_code=400, detail=f"This coupon is only valid for: {scope_name}")
    return {
        "valid": True,
        "discount_pct": coupon["discount_pct"],
        "scope": coupon["scope"],
        "scope_name": coupon.get("scope_name", ""),
        "valid_until": coupon["valid_until"].isoformat(),
    }
