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

@router.get("/website/settings")
async def get_website_settings():
    doc = await db.website_settings.find_one({}, {"_id": 0})
    if not doc:
        return {"maintenance_mode": False, "support_email": DEFAULT_SUPPORT_EMAIL}
    updated_at = doc.get("updated_at")
    return {
        "maintenance_mode": doc.get("maintenance_mode", False),
        "support_email": doc.get("support_email") or DEFAULT_SUPPORT_EMAIL,
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
        "updated_by": doc.get("updated_by"),
    }

@router.put("/website/settings")
async def update_website_settings(req: WebsiteSettingsRequest, user=Depends(require_permission("manage_website"))):
    updates = {"updated_at": datetime.now(timezone.utc), "updated_by": user["username"]}
    log_parts = []
    if req.maintenance_mode is not None:
        updates["maintenance_mode"] = req.maintenance_mode
        log_parts.append(f"maintenance {'enabled' if req.maintenance_mode else 'disabled'}")
    if req.support_email is not None:
        email = req.support_email.strip()
        if email and not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
            raise HTTPException(status_code=400, detail="Invalid email address")
        updates["support_email"] = email or DEFAULT_SUPPORT_EMAIL
        log_parts.append(f"support email set to '{updates['support_email']}'")
    await db.website_settings.update_one({}, {"$set": updates}, upsert=True)
    if log_parts:
        await log_action("website", "Settings updated: " + ", ".join(log_parts), user=user["username"])
    doc = await db.website_settings.find_one({}, {"_id": 0})
    return {
        "success": True,
        "maintenance_mode": doc.get("maintenance_mode", False),
        "support_email": doc.get("support_email") or DEFAULT_SUPPORT_EMAIL,
    }
