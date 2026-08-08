import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from ..database import db
from ..deps import require_permission
from ..utils import slugify, serialize_doc, log_action
from ..schemas import GameCreateRequest, GameUpdateRequest, BlogCreateRequest, BlogUpdateRequest, WebsiteSettingsRequest

router = APIRouter()

# ============== WEBSITE: GAMES ==============
@router.post("/website/games")
async def create_game(req: GameCreateRequest, user=Depends(require_permission("create_games"))):
    slug = slugify(req.name)
    if await db.website_games.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Game with this name already exists")
    if req.featured:
        await db.website_games.update_many({}, {"$set": {"featured": False}})
    doc = {"name": req.name, "slug": slug, "description": req.description, "logo_url": req.logo_url,
           "screenshots": req.screenshots, "platforms": req.platforms, "status": req.status, "featured": req.featured,
           "price_cents": req.price_cents, "product_type": req.product_type,
           "created_at": datetime.now(timezone.utc), "created_by": user["username"],
           "updated_at": datetime.now(timezone.utc)}
    await db.website_games.insert_one(doc)
    await log_action("website", f"Game '{req.name}' created", user=user["username"])
    return {"success": True, "game": serialize_doc(doc)}

@router.get("/website/games")
async def list_games_admin(user=Depends(require_permission("create_games"))):
    games = await db.website_games.find().sort("created_at", -1).to_list(1000)
    return {"games": [serialize_doc(g) for g in games]}

@router.get("/website/games/public")
async def list_games_public():
    games = await db.website_games.find({"status": {"$in": ["published", "coming_soon"]}}).sort("created_at", -1).to_list(1000)
    return {"games": [serialize_doc(g) for g in games]}

@router.get("/website/games/featured")
async def get_featured_game():
    game = await db.website_games.find_one({"featured": True, "status": "published"})
    if not game:
        return {"game": None}
    return {"game": serialize_doc(game)}

@router.put("/website/games/{game_slug}")
async def update_game(game_slug: str, req: GameUpdateRequest, user=Depends(require_permission("edit_games"))):
    game = await db.website_games.find_one({"slug": game_slug})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    # price_cents=0 is valid (free game), handle it explicitly
    if req.price_cents is not None:
        updates["price_cents"] = req.price_cents
    updates["updated_at"] = datetime.now(timezone.utc)
    if updates.get("featured"):
        await db.website_games.update_many({"slug": {"$ne": game_slug}}, {"$set": {"featured": False}})
    if "name" in updates:
        updates["slug"] = slugify(updates["name"])
    await db.website_games.update_one({"slug": game_slug}, {"$set": updates})
    await log_action("website", f"Game '{game_slug}' updated", user=user["username"])
    updated = await db.website_games.find_one({"slug": updates.get("slug", game_slug)})
    return {"success": True, "game": serialize_doc(updated)}

@router.delete("/website/games/{game_slug}")
async def delete_game(game_slug: str, user=Depends(require_permission("delete_games"))):
    r = await db.website_games.delete_one({"slug": game_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    await log_action("website", f"Game '{game_slug}' deleted", user=user["username"])
    return {"success": True, "message": f"Game deleted"}

# ============== WEBSITE: BLOG ==============
@router.post("/website/blog")
async def create_blog_post(req: BlogCreateRequest, user=Depends(require_permission("create_blog"))):
    slug = slugify(req.title)
    if await db.blog_posts.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    doc = {"title": req.title, "slug": slug, "content": req.content, "image_url": req.image_url,
           "published": req.published, "author": user["username"],
           "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
    await db.blog_posts.insert_one(doc)
    await log_action("website", f"Blog post '{req.title}' created", user=user["username"])
    return {"success": True, "post": serialize_doc(doc)}

@router.get("/website/blog")
async def list_blog_admin(user=Depends(require_permission("create_blog"))):
    posts = await db.blog_posts.find().sort("created_at", -1).to_list(1000)
    return {"posts": [serialize_doc(p) for p in posts]}

@router.get("/website/blog/public")
async def list_blog_public():
    posts = await db.blog_posts.find({"published": True}).sort("created_at", -1).to_list(1000)
    return {"posts": [serialize_doc(p) for p in posts]}

@router.get("/website/blog/{post_slug}")
async def get_blog_post(post_slug: str):
    post = await db.blog_posts.find_one({"slug": post_slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"post": serialize_doc(post)}

@router.put("/website/blog/{post_slug}")
async def update_blog_post(post_slug: str, req: BlogUpdateRequest, user=Depends(require_permission("edit_blog"))):
    post = await db.blog_posts.find_one({"slug": post_slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.blog_posts.update_one({"slug": post_slug}, {"$set": updates})
    updated = await db.blog_posts.find_one({"slug": post_slug})
    await log_action("website", f"Blog post '{post_slug}' updated", user=user["username"])
    return {"success": True, "post": serialize_doc(updated)}

@router.delete("/website/blog/{post_slug}")
async def delete_blog_post(post_slug: str, user=Depends(require_permission("delete_blog"))):
    r = await db.blog_posts.delete_one({"slug": post_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    await log_action("website", f"Blog post '{post_slug}' deleted", user=user["username"])
    return {"success": True, "message": "Post deleted"}

# ============== WEBSITE: SETTINGS ==============
DEFAULT_SUPPORT_EMAIL = "support@vakargames.com"

def _serialize_settings(doc: dict) -> dict:
    doc = doc or {}
    updated_at = doc.get("updated_at")
    scheduled_at = doc.get("maintenance_scheduled_at")
    # Effective mode is computed on every read, not written by a background
    # job — a scheduled window can span far longer than a single process's
    # lifetime, so this stays correct across a manual VPS restart with zero
    # extra infrastructure. Once the scheduled time is reached the schedule
    # itself is left in place (not cleared here) so the response still says
    # WHY maintenance is on; an explicit manual toggle is what clears it.
    effective_mode = bool(doc.get("maintenance_mode", False))
    if not effective_mode and isinstance(scheduled_at, datetime) and datetime.now(timezone.utc) >= scheduled_at:
        effective_mode = True
    return {
        "maintenance_mode": effective_mode,
        "maintenance_scheduled_at": scheduled_at.isoformat() if isinstance(scheduled_at, datetime) else scheduled_at,
        "maintenance_announcement": doc.get("maintenance_announcement", ""),
        "support_email": doc.get("support_email") or DEFAULT_SUPPORT_EMAIL,
        "announcement_banner": doc.get("announcement_banner", ""),
        "announcement_active": doc.get("announcement_active", False),
        "social_links": doc.get("social_links", {}),
        "seo_description": doc.get("seo_description", ""),
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
        "updated_by": doc.get("updated_by"),
    }

@router.get("/website/settings")
async def get_website_settings():
    doc = await db.website_settings.find_one({}, {"_id": 0})
    return _serialize_settings(doc)

@router.put("/website/settings")
async def update_website_settings(req: WebsiteSettingsRequest, user=Depends(require_permission("manage_website"))):
    updates = {"updated_at": datetime.now(timezone.utc), "updated_by": user["username"]}
    log_parts = []
    if req.maintenance_mode is not None:
        updates["maintenance_mode"] = req.maintenance_mode
        # An explicit manual on/off always wins over a pending/past schedule —
        # otherwise a stale schedule could silently re-trigger maintenance
        # (or fight an admin who just turned it back off) on a later read.
        updates["maintenance_scheduled_at"] = None
        updates["maintenance_announcement"] = ""
        log_parts.append(f"maintenance {'enabled' if req.maintenance_mode else 'disabled'}")
    if req.maintenance_scheduled_at is not None:
        if req.maintenance_scheduled_at == "":
            # Empty string is the explicit "clear the schedule" signal — a
            # bare `null`/omitted field is indistinguishable from "not
            # provided" once it round-trips through JSON, so it can't carry
            # that meaning instead.
            updates["maintenance_scheduled_at"] = None
            updates["maintenance_announcement"] = ""
            log_parts.append("scheduled maintenance cancelled")
        else:
            try:
                parsed = datetime.fromisoformat(req.maintenance_scheduled_at.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid maintenance_scheduled_at datetime")
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            updates["maintenance_scheduled_at"] = parsed
            log_parts.append(f"maintenance scheduled for {parsed.isoformat()}")
    if req.maintenance_announcement is not None:
        updates["maintenance_announcement"] = req.maintenance_announcement.strip()[:280]
        log_parts.append("maintenance announcement updated")
    if req.support_email is not None:
        email = req.support_email.strip()
        if email and not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
            raise HTTPException(status_code=400, detail="Invalid email address")
        updates["support_email"] = email or DEFAULT_SUPPORT_EMAIL
        log_parts.append(f"support email set to '{updates['support_email']}'")
    if req.announcement_banner is not None:
        updates["announcement_banner"] = req.announcement_banner.strip()[:280]
        log_parts.append("announcement banner updated")
    if req.announcement_active is not None:
        updates["announcement_active"] = req.announcement_active
        log_parts.append(f"announcement {'activated' if req.announcement_active else 'deactivated'}")
    if req.social_links is not None:
        # Small fixed set of known keys — avoids storing arbitrary attacker-controlled
        # key names if this endpoint's permission were ever misconfigured.
        allowed_keys = {"discord", "twitter", "youtube", "tiktok", "instagram"}
        updates["social_links"] = {k: str(v)[:300] for k, v in req.social_links.items() if k in allowed_keys and v}
        log_parts.append("social links updated")
    if req.seo_description is not None:
        updates["seo_description"] = req.seo_description.strip()[:300]
        log_parts.append("SEO description updated")
    await db.website_settings.update_one({}, {"$set": updates}, upsert=True)
    if log_parts:
        await log_action("website", "Settings updated: " + ", ".join(log_parts), user=user["username"])
    doc = await db.website_settings.find_one({}, {"_id": 0})
    result = _serialize_settings(doc)
    result["success"] = True
    return result
