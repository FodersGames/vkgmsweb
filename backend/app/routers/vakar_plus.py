import asyncio
import logging

import stripe
from fastapi import APIRouter, HTTPException, Depends, Request

from ..config import STRIPE_VAKAR_PLUS_PRICE_MONTHLY, STRIPE_VAKAR_PLUS_PRICE_YEARLY
from ..deps import get_current_user
from ..utils import _get_origin
from ..rate_limit import limiter
from ..schemas import VakarPlusCheckoutRequest

router = APIRouter()
logger = logging.getLogger(__name__)

PRICE_IDS = {"monthly": STRIPE_VAKAR_PLUS_PRICE_MONTHLY, "yearly": STRIPE_VAKAR_PLUS_PRICE_YEARLY}

# ============================================================
# VAKAR+ — recurring Stripe subscription. Fulfillment (setting
# vakar_plus_status/plan/period on the user doc) happens entirely in the
# webhook handler in routers/shop.py, which already owns the single Stripe
# webhook endpoint configured in the Stripe Dashboard — see the
# "checkout_type": "vakar_plus_subscription" branch there, plus the
# customer.subscription.* / invoice.payment_failed branches.
# ============================================================

@router.get("/vakar-plus/pricing")
async def get_vakar_plus_pricing():
    """Public — echoes whatever is actually configured in Stripe, never a
    guessed/hardcoded amount. Returns null for a plan whose Price ID isn't
    set yet, so the frontend can show a honest "coming soon" state."""
    result = {}
    for plan, price_id in PRICE_IDS.items():
        if not price_id:
            result[plan] = None
            continue
        try:
            price = await asyncio.to_thread(stripe.Price.retrieve, price_id)
            result[plan] = {
                "amount_cents": price.unit_amount,
                "currency": price.currency,
                "interval": price.recurring.interval if price.recurring else None,
            }
        except Exception as e:
            logger.error(f"Vakar+ price fetch error ({plan}): {e}")
            result[plan] = None
    return {"plans": result}

@router.get("/vakar-plus/status")
async def get_vakar_plus_status(user=Depends(get_current_user)):
    return {
        "status": user.get("vakar_plus_status", "none"),
        "is_active": user.get("is_vakar_plus", False),
        "plan": user.get("vakar_plus_plan"),
        "current_period_end": user.get("vakar_plus_current_period_end"),
        "cancel_at_period_end": user.get("vakar_plus_cancel_at_period_end", False),
    }

@router.post("/vakar-plus/checkout")
@limiter.limit("10/minute")
async def create_vakar_plus_checkout(request: Request, req: VakarPlusCheckoutRequest, user=Depends(get_current_user)):
    price_id = PRICE_IDS.get(req.plan)
    if not price_id:
        raise HTTPException(status_code=503, detail="Vakar+ isn't available yet. Please check back soon.")
    if user.get("is_vakar_plus"):
        raise HTTPException(status_code=400, detail="You're already a Vakar+ subscriber.")

    origin = _get_origin(request)

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            subscription_data={"metadata": {"user_id": user["id"]}},
            success_url=f"{origin}/vakar-plus?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/vakar-plus",
            metadata={"checkout_type": "vakar_plus_subscription", "user_id": user["id"], "plan": req.plan},
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Vakar+ checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {"checkout_url": session.url, "session_id": session.id}

@router.post("/vakar-plus/billing-portal")
async def create_vakar_plus_billing_portal(request: Request, user=Depends(get_current_user)):
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Vakar+ subscription found for this account")

    origin = _get_origin(request)

    def _create():
        return stripe.billing_portal.Session.create(customer=customer_id, return_url=f"{origin}/profile")

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Vakar+ billing portal error: {e}")
        raise HTTPException(status_code=500, detail="Could not open the billing portal")

    return {"url": session.url}
