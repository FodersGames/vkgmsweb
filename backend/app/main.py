import os
import asyncio
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import config
from .database import db, client
from .security import SecurityHeadersMiddleware
from .rate_limit import limiter
from .deps import ALL_PERMISSIONS, _ensure_super_admin

from .routers import (
    auth, users, website, admin_system, tickets, careers, roles, uploads, surveys, dino_admin,
)

logger = logging.getLogger(__name__)


app = FastAPI(title="Vakar Games API", version=config.VERSION)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Vakar Games API",
        "version": config.VERSION,
        "docs": "/docs"
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Extensions served inline in the browser (images); everything else forces a download.
_INLINE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif"}

@app.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    # Path(filename).name strips any directory components → prevents path traversal
    safe_name = Path(filename).name

    # Check MongoDB first (Serverless compatible)
    try:
        doc = await db.uploads.find_one({"filename": safe_name})
        if doc and "data" in doc:
            return Response(
                content=doc["data"],
                media_type=doc.get("content_type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=31536000, immutable"}
            )
    except Exception:
        pass

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
    auth, users, website, admin_system, tickets, careers, roles, uploads, surveys, dino_admin,
):
    app.include_router(_router_module.router, prefix="/api")

# CORS
_cors_raw = os.environ.get('CORS_ORIGINS', '*').strip()
if _cors_raw == '*':
    _cors_origins = ['*']
    _cors_creds = False
elif _cors_raw:
    _cors_origins = [o.strip() for o in _cors_raw.split(',') if o.strip()]
    for _domain in [
        'https://vakargames.com', 'http://vakargames.com',
        'https://www.vakargames.com', 'https://admin.vakargames.com', 'http://admin.vakargames.com',
        'https://fodersgames.github.io'
    ]:
        if _domain not in _cors_origins:
            _cors_origins.append(_domain)
    _cors_creds = True
else:
    _cors_origins = ['*']
    _cors_creds = False

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_cors_creds,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)


async def _init_db_indexes_and_migrations():
    try:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True, sparse=True)
        await db.website_games.create_index("slug", unique=True)
        await db.blog_posts.create_index("slug", unique=True)
        await db.support_tickets.create_index("ticket_number", unique=True)
        await db.support_tickets.create_index([("user_email", 1), ("created_at", -1)])
        await db.support_tickets.create_index([("status", 1), ("updated_at", -1)])
        await db.careers.create_index("created_at")
        await db.careers.create_index("is_open")
        await db.surveys.create_index("slug", unique=True)
        await db.surveys.create_index("created_at")
        await db.survey_responses.create_index([("survey_id", 1), ("submitted_at", -1)])
        await db.cli_destructive_log.create_index([("username", 1), ("timestamp", 1)])
        await db.cli_lockouts.create_index([("username", 1), ("locked_at", -1)])
        await db.logs.create_index("timestamp")
        logger.info("Database indexes initialized")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    # Create initial super admin if not already present
    try:
        await _ensure_super_admin()
    except Exception as e:
        logger.error(f"Super admin initialization error: {e}")


@app.on_event("startup")
async def startup_event():
    # Security warnings for missing env vars
    if config._JWT_EPHEMERAL:
        logger.warning("⚠ JWT_SECRET not set in environment : using ephemeral random secret. All tokens will be invalidated on every restart!")
    if not config.SUPER_ADMIN_EMAIL or not config.SUPER_ADMIN_PASSWORD:
        logger.warning("⚠ SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set in .env : super admin auto-creation disabled")
    if not config.SETUP_KEY:
        logger.warning("⚠ MASTER_KEY not set in environment : /auth/init-superadmin endpoint is disabled")

    # In serverless environments (e.g. Vercel), do not block HTTP request startup
    # by running 40+ MongoDB index checks and data migrations synchronously.
    # Instead, run them asynchronously in the background so the API responds instantly (<100ms).
    if os.environ.get("VERCEL"):
        if os.environ.get("RUN_MIGRATIONS") == "1":
            asyncio.create_task(_init_db_indexes_and_migrations())
        else:
            asyncio.create_task(_ensure_super_admin())
    else:
        asyncio.create_task(_init_db_indexes_and_migrations())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
