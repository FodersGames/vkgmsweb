import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request
import stripe

from ..config import STRIPE_WEBHOOK_SECRET
from ..database import db
from ..deps import require_permission, get_current_user
from ..utils import serialize_doc, log_action, _get_origin, _create_notification
from ..loyalty import get_tier, TIER_DISCOUNTS, _update_loyalty
from ..rate_limit import limiter
from ..schemas import (
    ShopProductCreateRequest, ShopProductUpdateRequest, ShopCheckoutRequest, GamePurchaseCheckoutRequest,
)
from .studio_apps import CREATOR_SHARE_PCT

router = APIRouter()
logger = logging.getLogger(__name__)

# ============== SHOP ==============
async def _get_shop_categories() -> List[dict]:
    doc = await db.website_shop_global_settings.find_one({}, {"categories": 1})
    return (doc or {}).get("categories", [])

async def _validate_game_slug(game_slug: str):
    if not await db.website_games.find_one({"slug": game_slug}):
        raise HTTPException(status_code=404, detail=f"Game '{game_slug}' not found")

# ── Global products list ──────────────────────────────────────────────────────
@router.get("/shop/products")
async def list_all_shop_products(game_slug: Optional[str] = None, category: Optional[str] = None):
    query: dict = {"active": True}
    if game_slug:
        query["game_slug"] = game_slug
    if category:
        query["category"] = category
    products = await db.website_shop_products.find(query).sort([("featured", -1), ("created_at", 1)]).to_list(500)
    categories = await _get_shop_categories()
    return {"products": [serialize_doc(p) for p in products], "categories": categories}

@router.get("/shop/products/admin")
async def list_all_shop_products_admin(game_slug: Optional[str] = None, category: Optional[str] = None,
                                        user=Depends(require_permission("manage_shop"))):
    query: dict = {}
    if game_slug:
        query["game_slug"] = game_slug
    if category:
        query["category"] = category
    products = await db.website_shop_products.find(query).sort([("game_slug", 1), ("created_at", 1)]).to_list(500)
    return {"products": [serialize_doc(p) for p in products]}

@router.post("/shop/products")
async def create_shop_product_global(req: ShopProductCreateRequest, user=Depends(require_permission("manage_shop"))):
    await _validate_game_slug(req.game_slug)
    if not await db.projects.find_one({"slug": req.project_slug}):
        raise HTTPException(status_code=404, detail="Project not found")
    doc = {
        "game_slug": req.game_slug,
        "name": req.name,
        "description": req.description,
        "price": req.price,
        "image_url": req.image_url,
        "badge": req.badge,
        "discount_pct": req.discount_pct,
        "project_slug": req.project_slug,
        "variable": req.variable,
        "amount": req.amount,
        "active": req.active,
        "category": req.category,
        "subcategory": req.subcategory,
        "featured": req.featured,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["username"],
    }
    result = await db.website_shop_products.insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_action("shop", f"Shop product '{req.name}' created", project_slug=req.project_slug, user=user["username"])
    return {"success": True, "product": serialize_doc(doc)}

@router.put("/shop/products/{product_id}")
async def update_shop_product_global(product_id: str, req: ShopProductUpdateRequest, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if "game_slug" in updates:
        await _validate_game_slug(updates["game_slug"])
    if "project_slug" in updates and not await db.projects.find_one({"slug": updates["project_slug"]}):
        raise HTTPException(status_code=404, detail="Project not found")
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.website_shop_products.update_one({"_id": oid}, {"$set": updates})
    updated = await db.website_shop_products.find_one({"_id": oid})
    await log_action("shop", f"Shop product '{updated.get('name', product_id)}' updated",
                      project_slug=updated.get("project_slug"), user=user["username"])
    return {"success": True, "product": serialize_doc(updated)}

@router.delete("/shop/products/{product_id}")
async def delete_shop_product_global(product_id: str, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.website_shop_products.delete_one({"_id": oid})
    await log_action("shop", f"Shop product '{product.get('name', product_id)}' deleted",
                      project_slug=product.get("project_slug"), user=user["username"])
    return {"success": True}

# ── Categories (derived from games with active products) ──────────────────────
@router.get("/shop/categories")
async def get_shop_categories():
    games = await db.website_games.find({"status": {"$in": ["published", "coming_soon"]}}).sort("name", 1).to_list(200)
    categories = []
    for g in games:
        count = await db.website_shop_products.count_documents({"game_slug": g["slug"], "active": True})
        if count > 0:
            categories.append({
                "id": g["slug"],
                "label": g["name"],
                "product_count": count,
                "logo_url": g.get("logo_url", ""),
                "product_type": g.get("product_type", "game"),
            })
    return {"categories": categories}

# ── Unified shop checkout (auth required, applies loyalty discount) ────────────
@router.post("/shop/checkout")
@limiter.limit("10/minute")
async def create_unified_checkout(request: Request, req: ShopCheckoutRequest, user=Depends(get_current_user)):
    if not req.player_uid.strip():
        raise HTTPException(status_code=400, detail="Player ID required")
    try:
        oid = ObjectId(req.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Apply loyalty discount
    loyalty_doc = await db.user_points.find_one({"email": user["email"]})
    total_spent = loyalty_doc.get("total_spent_cents", 0) if loyalty_doc else 0
    tier = get_tier(total_spent)
    discount_pct = TIER_DISCOUNTS.get(tier, 0)
    base_price = product["price"]

    # Apply coupon if provided
    coupon_discount_pct = 0
    coupon_code_used = ""
    if req.coupon_code and req.coupon_code.strip():
        code_upper = req.coupon_code.strip().upper()
        coupon = await db.coupons.find_one({
            "code": code_upper,
            "assigned_to_user_id": ObjectId(user["id"]),
            "used": False,
        })
        if coupon and coupon["valid_until"] > datetime.now(timezone.utc):
            scope_ok = (
                coupon["scope"] == "all"
                or (coupon["scope"] == "product" and coupon["scope_id"] == str(product["_id"]))
            )
            if scope_ok:
                coupon_discount_pct = coupon["discount_pct"]
                coupon_code_used = code_upper

    total_discount = min(99, discount_pct + coupon_discount_pct)
    final_price = max(50, int(base_price * (1 - total_discount / 100))) if total_discount > 0 else base_price

    origin = _get_origin(request)
    images = [product["image_url"]] if (product.get("image_url") and product["image_url"].startswith("http")) else []
    desc_parts = []
    if product.get("description"):
        desc_parts.append(product["description"])
    if discount_pct > 0:
        desc_parts.append(f"{discount_pct}% {tier.capitalize()} loyalty discount applied")
    if coupon_discount_pct > 0:
        desc_parts.append(f"{coupon_discount_pct}% promo code discount applied")
    description = " · ".join(desc_parts) or ""

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": product["name"],
                        "description": description,
                        "images": images,
                    },
                    "unit_amount": final_price,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/shop/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/shop",
            metadata={
                "checkout_type": "shop_item",
                "player_uid": req.player_uid.strip(),
                "product_id": str(product["_id"]),
                "game_slug": product.get("game_slug", ""),
                "user_email": user["email"],
                "original_price": str(base_price),
                "final_price": str(final_price),
                "discount_pct": str(total_discount),
                "coupon_code": coupon_code_used,
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Stripe unified checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "final_price": final_price,
        "discount_pct": total_discount,
        "coupon_applied": coupon_discount_pct > 0,
        "coupon_discount_pct": coupon_discount_pct,
    }

# ── Game purchase checkout ────────────────────────────────────────────────────
@router.post("/games/{game_slug}/checkout")
@limiter.limit("10/minute")
async def create_game_checkout(request: Request, game_slug: str, req: GamePurchaseCheckoutRequest, user=Depends(get_current_user)):
    game = await db.website_games.find_one({"slug": game_slug, "status": "published"})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    base_price = game.get("price_cents", 0)
    if base_price <= 0:
        raise HTTPException(status_code=400, detail="This game is free")

    # Check if already purchased
    existing = await db.game_purchases.find_one({"email": user["email"], "game_slug": game_slug})
    if existing:
        raise HTTPException(status_code=409, detail="You already own this game")

    # Apply coupon if provided
    coupon_discount_pct = 0
    coupon_code_used = ""
    if req.coupon_code and req.coupon_code.strip():
        code_upper = req.coupon_code.strip().upper()
        coupon = await db.coupons.find_one({
            "code": code_upper,
            "assigned_to_user_id": ObjectId(user["id"]),
            "used": False,
        })
        if coupon and coupon["valid_until"] > datetime.now(timezone.utc):
            scope_ok = (
                coupon["scope"] == "all"
                or (coupon["scope"] == "game" and coupon["scope_id"] == game_slug)
            )
            if scope_ok:
                coupon_discount_pct = coupon["discount_pct"]
                coupon_code_used = code_upper

    price = max(50, int(base_price * (1 - coupon_discount_pct / 100))) if coupon_discount_pct > 0 else base_price

    origin = _get_origin(request)
    images = [game["logo_url"]] if (game.get("logo_url") and game["logo_url"].startswith("http")) else []
    desc_parts = [game.get("description") or ""]
    if coupon_discount_pct > 0:
        desc_parts.append(f"{coupon_discount_pct}% promo code discount applied")
    description = " · ".join(p for p in desc_parts if p)

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": game["name"],
                        "description": description,
                        "images": images,
                    },
                    "unit_amount": price,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/shop/success?session_id={{CHECKOUT_SESSION_ID}}&type=game",
            cancel_url=f"{origin}/games",
            metadata={
                "checkout_type": "game_purchase",
                "game_slug": game_slug,
                "game_name": game["name"],
                "user_email": user["email"],
                "coupon_code": coupon_code_used,
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Stripe game checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {"checkout_url": session.url, "session_id": session.id}

# ── Check if user purchased a game ───────────────────────────────────────────
@router.get("/games/{game_slug}/purchased")
async def check_game_purchased(game_slug: str, user=Depends(get_current_user)):
    purchase = await db.game_purchases.find_one({"email": user["email"], "game_slug": game_slug})
    return {"purchased": purchase is not None, "game_slug": game_slug}

# ── List game purchases (admin) ──────────────────────────────────────────────
@router.get("/games/{game_slug}/purchases")
async def list_game_purchases(game_slug: str, user=Depends(require_permission("manage_shop"))):
    purchases = await db.game_purchases.find({"game_slug": game_slug}).sort("purchased_at", -1).to_list(1000)
    return {"purchases": [serialize_doc(p) for p in purchases]}

@router.post("/shop/{game_slug}/checkout")
@limiter.limit("10/minute")
async def create_checkout_session(request: Request, game_slug: str, req: ShopCheckoutRequest, user=Depends(get_current_user)):
    if not req.player_uid.strip():
        raise HTTPException(status_code=400, detail="Player UID required")
    try:
        oid = ObjectId(req.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid, "game_slug": game_slug, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    origin = _get_origin()
    images = [product["image_url"]] if (product.get("image_url") and product["image_url"].startswith("http")) else []

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": product["name"],
                        "description": product.get("description") or "",
                        "images": images,
                    },
                    "unit_amount": product["price"],
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/shop/{game_slug}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/shop/{game_slug}",
            metadata={
                "player_uid": req.player_uid.strip(),
                "product_id": str(product["_id"]),
                "game_slug": game_slug,
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {"checkout_url": session.url, "session_id": session.id}

@router.get("/shop/session/{session_id}/status")
@limiter.limit("60/minute")
async def get_session_status(request: Request, session_id: str):
    def _retrieve():
        return stripe.checkout.Session.retrieve(session_id)
    try:
        session = await asyncio.to_thread(_retrieve)
        return {"status": session.status, "payment_status": session.payment_status}
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

# ── Stripe webhook ────────────────────────────────────────────────────────────

@router.post("/shop/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    def _construct():
        return stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)

    try:
        event = await asyncio.to_thread(_construct)
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        checkout_type = meta.get("checkout_type", "")
        amount_paid = session.get("amount_total", 0)

        if checkout_type == "shop_item":
            uid = meta.get("player_uid", "").strip()
            product_id = meta.get("product_id", "")
            game_slug_meta = meta.get("game_slug", "")
            user_email = meta.get("user_email", "")
            product = None
            # Deliver item
            if uid and product_id:
                try:
                    product = await db.website_shop_products.find_one({"_id": ObjectId(product_id)})
                    if product:
                        buyer_name = "Vakar Games Shop"
                        if user_email:
                            buyer = await db.users.find_one({"email": user_email})
                            if buyer:
                                buyer_name = buyer.get("firstName") or buyer.get("username") or buyer_name
                        await db.items.insert_one({
                            "project_slug": product["project_slug"],
                            "uid": uid,
                            "variable": product["variable"],
                            "amount": product["amount"],
                            "created_at": datetime.now(timezone.utc),
                            "created_by": "stripe_shop",
                            "from_name": buyer_name,
                            "product_name": product.get("name", "Item"),
                        })
                        await log_action("send",
                            f"Shop: {product['amount']}x {product['variable']} → {uid} (Stripe, from {buyer_name})",
                            project_slug=product["project_slug"], user="stripe_shop",
                            uid=uid, variable=product["variable"], amount=product["amount"])
                        logger.info(f"Shop delivery OK: {product['amount']}x {product['variable']} to {uid}")
                except Exception as e:
                    logger.error(f"Shop delivery error: {e}")
            # Update loyalty (only shop items give points)
            if user_email and amount_paid > 0:
                try:
                    await _update_loyalty(user_email, amount_paid)
                    logger.info(f"Loyalty updated for {user_email}: +{amount_paid} cents")
                except Exception as e:
                    logger.error(f"Loyalty update error: {e}")
            # Mark coupon as used
            coupon_code = meta.get("coupon_code", "")
            if coupon_code:
                try:
                    await db.coupons.update_one(
                        {"code": coupon_code},
                        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
                    )
                except Exception as e:
                    logger.error(f"Coupon mark-used error: {e}")
            # Notify user of successful purchase
            if user_email:
                try:
                    u = await db.users.find_one({"email": user_email})
                    if u:
                        product_name = product.get("name", "item") if product else "item"
                        await _create_notification(
                            user_id=str(u["_id"]),
                            message=f"✅ Purchase confirmed: {product_name} — ${amount_paid/100:.2f}. Your items will be delivered in-game at next login.",
                            notif_type="purchase_success",
                        )
                except Exception as e:
                    logger.error(f"Purchase notification error: {e}")

        elif checkout_type == "game_purchase":
            game_slug_meta = meta.get("game_slug", "")
            game_name = meta.get("game_name", "")
            user_email = meta.get("user_email", "")
            if user_email and game_slug_meta:
                try:
                    await db.game_purchases.update_one(
                        {"email": user_email, "game_slug": game_slug_meta},
                        {"$setOnInsert": {
                            "email": user_email,
                            "game_slug": game_slug_meta,
                            "game_name": game_name,
                            "stripe_session_id": session.get("id", ""),
                            "amount_paid_cents": amount_paid,
                            "purchased_at": datetime.now(timezone.utc),
                        }},
                        upsert=True,
                    )
                    logger.info(f"Game purchase recorded: {user_email} → {game_slug_meta}")
                    # Mark coupon as used
                    coupon_code = meta.get("coupon_code", "")
                    if coupon_code:
                        await db.coupons.update_one(
                            {"code": coupon_code},
                            {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
                        )
                    # Notify user
                    u = await db.users.find_one({"email": user_email})
                    if u:
                        await _create_notification(
                            user_id=str(u["_id"]),
                            message=f"🎮 Game unlocked: {game_name} — ${amount_paid/100:.2f}. Sign in to start playing.",
                            notif_type="game_purchase_success",
                        )
                except Exception as e:
                    logger.error(f"Game purchase record error: {e}")

        elif checkout_type == "studio_app_purchase":
            app_id_meta = meta.get("app_id", "")
            app_slug_meta = meta.get("app_slug", "")
            app_name = meta.get("app_name", "")
            user_email = meta.get("user_email", "")
            creator_user_id = meta.get("creator_user_id", "")
            if user_email and app_id_meta:
                try:
                    app_oid = ObjectId(app_id_meta)
                    creator_cents = round(amount_paid * CREATOR_SHARE_PCT / 100)
                    await db.studio_app_purchases.update_one(
                        {"email": user_email, "app_id": app_oid},
                        {"$setOnInsert": {
                            "email": user_email,
                            "app_id": app_oid,
                            "app_slug": app_slug_meta,
                            "app_name": app_name,
                            "stripe_session_id": session.get("id", ""),
                            "amount_paid_cents": amount_paid,
                            "creator_earnings_cents": creator_cents,
                            "purchased_at": datetime.now(timezone.utc),
                        }},
                        upsert=True,
                    )
                    logger.info(f"Studio app purchase recorded: {user_email} → {app_slug_meta}")
                    await db.studio_apps.update_one(
                        {"_id": app_oid},
                        {"$inc": {"creator_earnings_cents": creator_cents, "total_sales_cents": amount_paid}},
                    )
                    u = await db.users.find_one({"email": user_email})
                    if u:
                        await _create_notification(
                            user_id=str(u["_id"]),
                            message=f"✅ Unlocked: {app_name} — ${amount_paid/100:.2f}.",
                            notif_type="studio_app_purchase_success", link=f"/apps/{app_slug_meta}",
                        )
                    if creator_user_id:
                        await _create_notification(
                            user_id=creator_user_id,
                            message=f"💰 Someone bought \"{app_name}\" for ${amount_paid/100:.2f} — you earned ${creator_cents/100:.2f} ({CREATOR_SHARE_PCT}% share).",
                            notif_type="studio_app_sale", link="/my-apps",
                        )
                except Exception as e:
                    logger.error(f"Studio app purchase record error: {e}")

        elif checkout_type == "vakar_plus_subscription":
            user_id = meta.get("user_id", "")
            plan = meta.get("plan", "")
            if user_id:
                try:
                    await db.users.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {
                            "stripe_customer_id": session.get("customer"),
                            "stripe_subscription_id": session.get("subscription"),
                            "vakar_plus_plan": plan,
                        }},
                    )
                    # Status/period_end are set authoritatively by the
                    # customer.subscription.* handler below, which Stripe
                    # fires for every new subscription right alongside this
                    # event — this just links the Stripe customer/plan.
                    await _create_notification(
                        user_id=user_id,
                        message=f"✨ Welcome to Vakar+! Your {plan} subscription is now active.",
                        notif_type="vakar_plus_started",
                    )
                except Exception as e:
                    logger.error(f"Vakar+ activation error: {e}")

        else:
            # Backward compat: old sessions without checkout_type metadata
            uid = meta.get("player_uid", "").strip()
            product_id = meta.get("product_id", "")
            game_slug_meta = meta.get("game_slug", "")
            if uid and product_id and game_slug_meta:
                try:
                    product = await db.website_shop_products.find_one({"_id": ObjectId(product_id), "game_slug": game_slug_meta})
                    if product:
                        await db.items.insert_one({
                            "project_slug": product["project_slug"],
                            "uid": uid,
                            "variable": product["variable"],
                            "amount": product["amount"],
                            "created_at": datetime.now(timezone.utc),
                            "created_by": "stripe_shop",
                        })
                        await log_action("send",
                            f"Shop: {product['amount']}x {product['variable']} → {uid} (Stripe legacy)",
                            project_slug=product["project_slug"], user="stripe_shop",
                            uid=uid, variable=product["variable"], amount=product["amount"])
                except Exception as e:
                    logger.error(f"Legacy shop webhook error: {e}")

    elif event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        user_email = meta.get("user_email", "")
        checkout_type = meta.get("checkout_type", "")
        if checkout_type == "game_purchase":
            subject = meta.get("game_name")
        elif checkout_type == "studio_app_purchase":
            subject = meta.get("app_name")
        else:
            subject = "your purchase"
        if user_email:
            try:
                u = await db.users.find_one({"email": user_email})
                if u:
                    await _create_notification(
                        user_id=str(u["_id"]),
                        message=f"❌ Payment failed or expired for {subject}. Please try again from the shop.",
                        notif_type="purchase_failed",
                    )
            except Exception as e:
                logger.error(f"Failed purchase notification error: {e}")

    # ── Vakar+ subscription lifecycle ────────────────────────────────────────
    elif event["type"] in ("customer.subscription.created", "customer.subscription.updated"):
        sub = event["data"]["object"]
        user_id = sub.get("metadata", {}).get("user_id", "")
        if user_id:
            try:
                status = sub.get("status", "")
                period_end = sub.get("current_period_end")
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {
                        "vakar_plus_status": "active" if status in ("active", "trialing") else status,
                        "stripe_subscription_id": sub.get("id"),
                        "stripe_customer_id": sub.get("customer"),
                        "vakar_plus_current_period_end": datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None,
                        "vakar_plus_cancel_at_period_end": sub.get("cancel_at_period_end", False),
                    }},
                )
            except Exception as e:
                logger.error(f"Vakar+ subscription sync error: {e}")

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        user_id = sub.get("metadata", {}).get("user_id", "")
        if user_id:
            try:
                await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"vakar_plus_status": "canceled"}})
                await _create_notification(
                    user_id=user_id,
                    message="Your Vakar+ subscription has ended. You can resubscribe anytime from your account.",
                    notif_type="vakar_plus_ended",
                )
            except Exception as e:
                logger.error(f"Vakar+ cancellation error: {e}")

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        if customer_id:
            try:
                u = await db.users.find_one({"stripe_customer_id": customer_id})
                if u:
                    await db.users.update_one({"_id": u["_id"]}, {"$set": {"vakar_plus_status": "past_due"}})
                    await _create_notification(
                        user_id=str(u["_id"]),
                        message="⚠️ Your Vakar+ payment failed — please update your payment method to keep your subscription active.",
                        notif_type="vakar_plus_payment_failed",
                    )
            except Exception as e:
                logger.error(f"Vakar+ payment-failed handling error: {e}")

    return {"received": True}
