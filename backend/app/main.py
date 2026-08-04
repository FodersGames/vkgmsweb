import os
import logging
from pathlib import Path
from datetime import datetime, timezone

import stripe
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import config
from .database import db, client
from .security import SecurityHeadersMiddleware, PlayCORSMiddleware
from .rate_limit import limiter
from .play_auth import _ensure_super_admin, LEGACY_PLAY_SAVE_CATEGORIES
from .deps import ALL_PERMISSIONS

from .routers import (
    auth, uploads, projects, users, website, admin_system, chat_legacy,
    shop, me, files, coupons, tickets, missions, notifications,
    play, play_chat, guilds, careers,
)

logger = logging.getLogger(__name__)

stripe.api_key = config.STRIPE_SECRET_KEY

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Extensions served inline in the browser (images); everything else forces a download.
_INLINE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif"}

@app.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    # Path(filename).name strips any directory components → prevents path traversal
    safe_name = Path(filename).name
    filepath = (config.UPLOADS_DIR / safe_name).resolve()
    # Defence-in-depth: ensure resolved path stays inside UPLOADS_DIR
    if not str(filepath).startswith(str(config.UPLOADS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    ext = filepath.suffix.lower()
    if ext in _INLINE_EXTS:
        return FileResponse(filepath)
    # Binary deliverables (ZIP, PSD, PDF, video…): force download, never execute in browser
    return FileResponse(
        filepath,
        headers={"Content-Disposition": f'attachment; filename="{filepath.name}"'},
    )

@app.get("/api/version")
async def get_version():
    return {"version": config.VERSION, "name": "Vakar Games Admin API"}

@app.get("/api/permissions")
async def get_all_permissions():
    return {"permissions": ALL_PERMISSIONS}

for _router_module in (
    auth, uploads, projects, users, website, admin_system, chat_legacy,
    shop, me, files, coupons, tickets, missions, notifications,
    play, play_chat, guilds, careers,
):
    app.include_router(_router_module.router, prefix="/api")

# CORS — reads CORS_ORIGINS from env; falls back to localhost only (never wildcard in prod)
_cors_raw = os.environ.get('CORS_ORIGINS', '').strip()
if _cors_raw:
    _cors_origins = [o.strip() for o in _cors_raw.split(',') if o.strip()]
else:
    logger.warning(
        "CORS_ORIGINS not set — allowing localhost:3000 only. "
        "Set CORS_ORIGINS=https://yourdomain.com in production."
    )
    _cors_origins = ['http://localhost:3000']

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Chat-Api-Key", "X-Files-Api-Key"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(PlayCORSMiddleware)  # must be last — runs first, intercepts /api/play/* before CORSMiddleware


@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True, sparse=True)
        await db.projects.create_index("slug", unique=True)
        await db.items.create_index([("project_slug", 1), ("uid", 1)])
        await db.logs.create_index([("project_slug", 1), ("type", 1)])
        await db.logs.create_index("timestamp")
        # Sparse: legacy docs only have "variable_name", new docs only have "name" — sparse
        # keeps each shape's uniqueness constraint from colliding with the other on the
        # "missing field" (null) case. The old index is dropped/recreated as sparse since a
        # non-sparse unique index with the same key pattern already existed pre-migration.
        try:
            await db.variables.drop_index("project_slug_1_variable_name_1")
        except Exception:
            pass
        await db.variables.create_index([("project_slug", 1), ("variable_name", 1)], unique=True, sparse=True)
        await db.variables.create_index([("project_slug", 1), ("name", 1)], unique=True, sparse=True)
        await db.website_games.create_index("slug", unique=True)
        await db.blog_posts.create_index("slug", unique=True)
        await db.chat_messages.create_index([("project_slug", 1), ("timestamp", 1)])
        await db.website_shop_products.create_index([("game_slug", 1), ("active", 1)])
        await db.missions.create_index([("project_slug", 1), ("status", 1)])
        await db.missions.create_index("created_at")
        await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
        await db.support_tickets.create_index("ticket_number", unique=True)
        await db.support_tickets.create_index([("user_email", 1), ("created_at", -1)])
        await db.support_tickets.create_index([("status", 1), ("updated_at", -1)])
        await db.game_purchases.create_index([("email", 1), ("game_slug", 1)], unique=True)
        await db.game_purchases.create_index("purchased_at")
        await db.user_points.create_index("email", unique=True)
        await db.website_shop_global_settings.create_index("_id")
        await db.play_saves.create_index([("user_id", 1), ("project_slug", 1), ("category", 1)], unique=True)
        await db.play_save_categories.create_index([("project_slug", 1), ("name", 1)], unique=True)
        await db.play_refresh_tokens.create_index("jti", unique=True)
        await db.play_refresh_tokens.create_index([("user_id", 1), ("is_revoked", 1)])
        await db.careers.create_index("created_at")
        await db.careers.create_index("is_open")
        await db.play_nicknames.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.play_bans.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.play_first_seen.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.chat_messages.create_index([("project_slug", 1), ("channel", 1), ("guild_id", 1), ("timestamp", 1)])
        await db.guilds.create_index([("project_slug", 1), ("name", 1)])
        await db.guild_members.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.guild_members.create_index([("guild_id", 1)])
        await db.chat_bans.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.chat_mutes.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.cli_destructive_log.create_index([("username", 1), ("timestamp", 1)])
        await db.cli_lockouts.create_index([("username", 1), ("locked_at", -1)])
        logger.info("Database indexes initialized")

        # Migration: merge the old per-game shop categories (now retired in favor of one
        # global category list) into website_shop_global_settings. Non-destructive — only
        # runs while the global list is still empty, and never touches/deletes the old
        # per-game website_shop_settings documents themselves.
        global_shop = await db.website_shop_global_settings.find_one({})
        if not global_shop or not global_shop.get("categories"):
            merged, seen_labels = [], set()
            async for doc in db.website_shop_settings.find({}):
                for cat in doc.get("categories", []):
                    label = (cat.get("label") or "").strip()
                    if label and label.lower() not in seen_labels:
                        seen_labels.add(label.lower())
                        merged.append(cat)
            if merged:
                await db.website_shop_global_settings.update_one({}, {"$set": {"categories": merged}}, upsert=True)
                logger.info(f"Shop categories migration: merged {len(merged)} categories from per-game settings")

        # Migration: backfill stable_id on files cloned before the stable-ID
        # system existed, so every version shares the original asset's ID.
        legacy = await db.game_files.find(
            {"cloned_from": {"$exists": True}, "stable_id": {"$exists": False}}
        ).to_list(2000)
        for f in legacy:
            root_id = f["cloned_from"]
            seen = set()
            while root_id not in seen:
                seen.add(root_id)
                try:
                    src = await db.game_files.find_one({"_id": ObjectId(root_id)})
                except Exception:
                    src = None
                if src and src.get("stable_id"):
                    root_id = src["stable_id"]
                    break
                if src and src.get("cloned_from"):
                    root_id = src["cloned_from"]
                else:
                    break
            await db.game_files.update_one({"_id": f["_id"]}, {"$set": {"stable_id": root_id}})
        if legacy:
            logger.info(f"Backfilled stable_id on {len(legacy)} cloned game files")

        # Migration: save-slot categories used to be one hardcoded global enum
        # (inventory/stats/craft/tech/others) — they're now per-project and
        # admin-defined, with nothing pre-created by default. For every
        # project that already has play_saves under one of those legacy
        # names, backfill a matching "all players" category definition so
        # existing live data keeps working; a brand-new project is left
        # untouched (genuinely empty, as intended going forward).
        legacy_slugs = await db.play_saves.distinct("project_slug", {"category": {"$in": list(LEGACY_PLAY_SAVE_CATEGORIES)}})
        backfilled = 0
        for slug in legacy_slugs:
            used_categories = await db.play_saves.distinct("category", {"project_slug": slug, "category": {"$in": list(LEGACY_PLAY_SAVE_CATEGORIES)}})
            for cat_name in used_categories:
                if await db.play_save_categories.find_one({"project_slug": slug, "name": cat_name}):
                    continue
                await db.play_save_categories.update_one(
                    {"project_slug": slug, "name": cat_name},
                    {"$setOnInsert": {
                        "project_slug": slug, "name": cat_name, "label": cat_name.capitalize(),
                        "player_scope": "all", "target_user_ids": [],
                        "created_at": datetime.now(timezone.utc), "created_by": "system-migration",
                    }},
                    upsert=True,
                )
                backfilled += 1
        if backfilled:
            logger.info(f"Backfilled {backfilled} legacy save-category definition(s) across {len(legacy_slugs)} project(s)")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    # Security warnings for missing env vars
    if config._JWT_EPHEMERAL:
        logger.warning("⚠ JWT_SECRET not set in environment — using ephemeral random secret. All tokens will be invalidated on every restart!")
    if not config.SUPER_ADMIN_EMAIL or not config.SUPER_ADMIN_PASSWORD:
        logger.warning("⚠ SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set in .env — super admin auto-creation disabled")
    if not config.SETUP_KEY:
        logger.warning("⚠ MASTER_KEY not set in environment — /auth/init-superadmin endpoint is disabled")

    # Create initial super admin if not already present
    await _ensure_super_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
