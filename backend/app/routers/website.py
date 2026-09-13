import re
import time
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends

from ..database import db, client
from ..deps import require_permission, get_optional_user
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
def user_can_access_post(user: dict, post: dict) -> bool:
    allowed_roles = post.get("allowed_roles") or []
    if not allowed_roles:
        return True  # Public to everyone
    if not user:
        return False  # Visitor, but restricted
    if user.get("is_super_admin") or user.get("role") == "super_admin":
        return True  # Super admin has full access

    # Author can always view their own post
    if user.get("username") and user.get("username") == post.get("author"):
        return True

    # Check staff permissions (authors / editors can always view)
    user_perms = user.get("permissions") or []
    if "edit_blog" in user_perms or "create_blog" in user_perms:
        return True

    # Check direct role (e.g. "admin", "super_admin") and custom roles
    user_base_role = str(user.get("role", "")).lower().strip()
    user_custom_roles = [str(r).lower().strip() for r in (user.get("custom_roles") or [])]
    for r in allowed_roles:
        r_clean = str(r).lower().strip()
        if r_clean == user_base_role or r_clean in user_custom_roles:
            return True

    return False

@router.post("/website/blog")
async def create_blog_post(req: BlogCreateRequest, user=Depends(require_permission("create_blog"))):
    slug = slugify(req.title)
    if await db.blog_posts.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    doc = {
        "title": req.title,
        "slug": slug,
        "content": req.content,
        "image_url": req.image_url,
        "published": req.published,
        "allowed_roles": [r.strip() for r in (req.allowed_roles or []) if r.strip()],
        "author": user["username"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.blog_posts.insert_one(doc)
    await log_action("website", f"Blog post '{req.title}' created", user=user["username"])
    return {"success": True, "post": serialize_doc(doc)}

@router.get("/website/blog")
async def list_blog_admin(user=Depends(require_permission("create_blog"))):
    posts = await db.blog_posts.find().sort("created_at", -1).to_list(1000)
    return {"posts": [serialize_doc(p) for p in posts]}

@router.get("/website/blog/public")
async def list_blog_public(user=Depends(get_optional_user)):
    posts = await db.blog_posts.find({"published": True}).sort("created_at", -1).to_list(1000)
    result = []
    for p in posts:
        has_access = user_can_access_post(user, p)
        serialized = serialize_doc(p)
        serialized["is_locked"] = not has_access
        serialized["allowed_roles"] = p.get("allowed_roles", [])
        if not has_access:
            serialized["content"] = "This post is restricted to specific studio roles."
        result.append(serialized)
    return {"posts": result}

@router.get("/website/blog/{post_slug}")
async def get_blog_post(post_slug: str, user=Depends(get_optional_user)):
    post = await db.blog_posts.find_one({"slug": post_slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Unpublished posts are only viewable by blog editors
    if not post.get("published", False):
        if not user or (not user.get("is_super_admin") and "create_blog" not in (user.get("permissions") or [])):
            raise HTTPException(status_code=404, detail="Post not found")

    has_access = user_can_access_post(user, post)
    serialized = serialize_doc(post)
    serialized["is_locked"] = not has_access
    serialized["allowed_roles"] = post.get("allowed_roles", [])
    if not has_access:
        serialized["content"] = ""  # Protect real content from unauthorized clients

    return {"post": serialized, "is_locked": not has_access}

@router.put("/website/blog/{post_slug}")
async def update_blog_post(post_slug: str, req: BlogUpdateRequest, user=Depends(require_permission("edit_blog"))):
    post = await db.blog_posts.find_one({"slug": post_slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if "allowed_roles" in updates and updates["allowed_roles"] is not None:
        updates["allowed_roles"] = [r.strip() for r in updates["allowed_roles"] if r.strip()]
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
    # job : a scheduled window can span far longer than a single process's
    # lifetime, so this stays correct across a manual VPS restart with zero
    # extra infrastructure. Once the scheduled time is reached the schedule
    # itself is left in place (not cleared here) so the response still says
    # WHY maintenance is on; an explicit manual toggle is what clears it.
    effective_mode = bool(doc.get("maintenance_mode", False))
    if not effective_mode and isinstance(scheduled_at, datetime) and datetime.now(timezone.utc) >= scheduled_at:
        effective_mode = True
    return {
        "maintenance_mode": effective_mode,
        "maintenance_active": effective_mode,
        "maintenance_started_at": doc.get("maintenance_started_at").isoformat() if isinstance(doc.get("maintenance_started_at"), datetime) else doc.get("maintenance_started_at"),
        "maintenance_scheduled_at": scheduled_at.isoformat() if isinstance(scheduled_at, datetime) else scheduled_at,
        "maintenance_announcement": doc.get("maintenance_announcement", ""),
        "dino_maintenance_mode": bool(doc.get("dino_maintenance_mode", False)),
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
        # An explicit manual on/off always wins over a pending/past schedule :
        # otherwise a stale schedule could silently re-trigger maintenance
        # (or fight an admin who just turned it back off) on a later read.
        updates["maintenance_scheduled_at"] = None
        updates["maintenance_announcement"] = ""
        now_utc = datetime.now(timezone.utc)
        if req.maintenance_mode:
            updates["maintenance_started_at"] = now_utc
            await db.maintenance_history.insert_one({
                "service": "website",
                "type": "maintenance",
                "status": "active",
                "started_at": now_utc,
                "ended_at": None,
                "message": req.maintenance_announcement or "",
            })
        else:
            updates["maintenance_started_at"] = None
            active_sessions = await db.maintenance_history.find({
                "service": "website", "status": "active"
            }).to_list(10)
            for s in active_sessions:
                started = s.get("started_at") or (now_utc - timedelta(minutes=15))
                duration = max(1.0, (now_utc - started).total_seconds() / 60)
                await db.maintenance_history.update_one(
                    {"_id": s["_id"]},
                    {"$set": {"status": "completed", "ended_at": now_utc, "duration_minutes": duration}}
                )
        log_parts.append(f"maintenance {'enabled' if req.maintenance_mode else 'disabled'}")
    if req.maintenance_scheduled_at is not None:
        if req.maintenance_scheduled_at == "":
            # Empty string is the explicit "clear the schedule" signal : a
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
        # Small fixed set of known keys : avoids storing arbitrary attacker-controlled
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

# ============== PUBLIC: SYSTEM STATUS ==============
@router.get("/public/status")
async def get_public_system_status():
    db_connected = False
    try:
        await client.admin.command("ping")
        db_connected = True
    except Exception:
        db_connected = False

    doc = await db.website_settings.find_one({}, {"_id": 0}) or {}
    settings = _serialize_settings(doc)
    website_maintenance = bool(settings.get("maintenance_mode"))
    dino_maintenance = bool(doc.get("dino_maintenance_mode", False))
    is_maintenance = website_maintenance or dino_maintenance

    if not db_connected:
        overall_status = "incident"
    elif is_maintenance:
        overall_status = "maintenance"
    else:
        overall_status = "operational"

    now = datetime.now(timezone.utc)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_short_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # Fetch maintenance events within the last 8 days
    eight_days_ago = now - timedelta(days=8)
    events = await db.maintenance_history.find({
        "$or": [
            {"started_at": {"$gte": eight_days_ago}},
            {"ended_at": {"$gte": eight_days_ago}},
            {"status": "active"},
        ]
    }).to_list(150)

    history = []
    for i in range(6, -1, -1):
        day_date = now - timedelta(days=i)
        is_today = (i == 0)

        # UTC calendar day boundaries [00:00:00, 23:59:59.999]
        day_start = datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0, tzinfo=timezone.utc)
        day_end = datetime(day_date.year, day_date.month, day_date.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
        if is_today and now < day_end:
            day_end = now

        downtime_mins = 0.0
        day_has_maintenance = False
        day_has_incident = False

        for ev in events:
            ev_start = ev.get("started_at")
            if not ev_start:
                continue
            if isinstance(ev_start, str):
                try:
                    ev_start = datetime.fromisoformat(ev_start.replace("Z", "+00:00"))
                except Exception:
                    continue
            if ev_start.tzinfo is None:
                ev_start = ev_start.replace(tzinfo=timezone.utc)

            ev_end = ev.get("ended_at")
            if not ev_end:
                ev_end = now if ev.get("status") == "active" else ev_start + timedelta(minutes=20)
            elif isinstance(ev_end, str):
                try:
                    ev_end = datetime.fromisoformat(ev_end.replace("Z", "+00:00"))
                except Exception:
                    ev_end = now
            if ev_end.tzinfo is None:
                ev_end = ev_end.replace(tzinfo=timezone.utc)

            # Calculate overlap with day
            overlap_start = max(day_start, ev_start)
            overlap_end = min(day_end, ev_end)
            if overlap_end > overlap_start:
                overlap_seconds = (overlap_end - overlap_start).total_seconds()
                downtime_mins += (overlap_seconds / 60.0)
                if ev.get("type") == "incident":
                    day_has_incident = True
                else:
                    day_has_maintenance = True

        # If today is currently active in maintenance or incident, reflect elapsed downtime
        if is_today:
            if not db_connected:
                downtime_mins = max(downtime_mins, 180.0)
                day_has_incident = True
            elif is_maintenance:
                maint_start = settings.get("maintenance_started_at") or doc.get("dino_maintenance_started_at") or doc.get("updated_at")
                if maint_start:
                    if isinstance(maint_start, str):
                        try:
                            maint_start = datetime.fromisoformat(maint_start.replace("Z", "+00:00"))
                        except Exception:
                            maint_start = now
                    if maint_start.tzinfo is None:
                        maint_start = maint_start.replace(tzinfo=timezone.utc)
                    elapsed = max(10.0, (now - maint_start).total_seconds() / 60.0)
                    downtime_mins = max(downtime_mins, elapsed)
                else:
                    downtime_mins = max(downtime_mins, 20.0)
                day_has_maintenance = True

        downtime_mins = round(downtime_mins, 1)
        if downtime_mins <= 0:
            uptime_pct = 100.0
            color_stage = "green"
            day_status = "operational"
            downtime_mins = 0
        else:
            uptime_pct = max(0.0, min(100.0, round((1440.0 - downtime_mins) / 1440.0 * 100.0, 2)))
            if day_has_incident or uptime_pct < 85:
                color_stage = "red"
                day_status = "incident"
            elif uptime_pct < 97:
                color_stage = "yellow_red"
                day_status = "partial_outage"
            elif day_has_maintenance or uptime_pct < 99.5:
                color_stage = "yellow"
                day_status = "maintenance"
            else:
                color_stage = "green_yellow"
                day_status = "nominal"

        label = "Today" if is_today else ("Yesterday" if i == 1 else day_names[day_date.weekday()])
        short_label = "Today" if is_today else ("Yest" if i == 1 else day_short_names[day_date.weekday()])

        history.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "label": label,
            "short_label": short_label,
            "status": day_status,
            "uptime_percent": uptime_pct,
            "color_stage": color_stage,
            "downtime_minutes": int(downtime_mins),
        })

    # Mathematical 7-day average
    avg_7d = round(sum(d["uptime_percent"] for d in history) / len(history), 2)
    uptime_7d = f"{avg_7d:.2f}%"

    announcement = settings.get("maintenance_announcement") or ""
    if not announcement and dino_maintenance:
        announcement = "Game server maintenance in progress."

    return {
        "status": overall_status,
        "uptime_7d": uptime_7d,
        "history": history,
        "maintenance": {
            "active": is_maintenance,
            "website_active": website_maintenance,
            "game_active": dino_maintenance,
            "announcement": announcement,
            "scheduled_at": settings.get("maintenance_scheduled_at"),
        },
        "updated_at": now.isoformat(),
    }
