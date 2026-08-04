import re
import uuid
from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File

from ..database import db
from ..config import UPLOADS_DIR
from ..deps import require_permission, get_current_user, get_optional_user
from ..utils import slugify, log_action, _validate_file, _IMAGE_MIMES
from ..rate_limit import limiter
from ..schemas import (
    StudioAppCreateRequest, StudioAppUpdateRequest, StudioAppStatusRequest, StudioAppVisibilityRequest,
)

router = APIRouter()

# ============================================================
# STUDIO APP BUILDER — a "studio app" is a small multi-screen mini-app
# (flat component tree per screen, no free-form canvas) assembled visually
# and published either as a public mini-app or a private one, at
# /apps/{slug}. Two ways to own one:
#   - Staff, via the admin dashboard (require_permission("manage_studio_apps"))
#     — these have no `user_id` (they're "house" tools, not owned by an
#     individual) and aren't quota'd.
#   - Any logged-in user, via the public self-service /my/studio-apps
#     endpoints below — these carry `user_id` and are quota'd by
#     is_vakar_plus, which is also what gates premium component types and
#     themes server-side (never trust the client to enforce this, it's a
#     real paywall now that this is public).
# Screens/variables are stored as loosely-typed dicts (matching this
# codebase's existing pattern for variable-shape nested content, e.g.
# GameCreateRequest.platforms) rather than a strict recursive model.
# ============================================================

MAX_SCREENS = 30
MAX_COMPONENTS_PER_SCREEN = 120

FREE_MAX_APPS = 2
FREE_MAX_SCREENS_PER_APP = 15
PLUS_MAX_APPS = 20
# "Unlimited" for Vakar+ in practice means the same hard technical ceiling
# every app is built against (MAX_SCREENS) — there's no separate, lower
# Vakar+ cap to enforce, and _validate_screens() only shows the "upgrade"
# upsell when max_screens < MAX_SCREENS, so this reads as truly unlimited.
PLUS_MAX_SCREENS_PER_APP = MAX_SCREENS

# Mirrors the `tier` tags in frontend/src/constants/appBuilder.js — kept as
# a small independent list rather than importing frontend code, same as
# every other cross-stack constant in this codebase. Update both together.
PREMIUM_COMPONENT_TYPES = {"icon", "list", "toggle"}
FREE_THEME_IDS = {"mint"}

# App storage quota — every file (icon + any uploaded image component) an
# app references, combined. Recomputed on demand from what's actually on
# disk (see _compute_storage_bytes) rather than tracked as a running
# counter, so deleting/replacing an image can never let usage drift upward
# forever.
FREE_MAX_APP_BYTES = 20 * 1024 * 1024
PLUS_MAX_APP_BYTES = 1024 * 1024 * 1024
ALLOWED_ASSET_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# Android build config (APK export, Phase E). Reverse-DNS package name,
# letters/digits/underscores per segment, each segment starting with a
# letter — the exact rule Android's AAPT enforces (this is the same class
# of bug the "6a725abcd..." package-name incident hit: a segment starting
# with a digit is rejected by the Android build, not by us).
PACKAGE_ID_RE = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$')
MIN_SDK_FLOOR = 22   # Capacitor 6's own minimum
MAX_SDK_CEIL = 35


def _default_package_id(doc):
    # Prefixed with a letter for the same reason genId()-derived build IDs
    # are — slugs are lowercase/hyphenated but aren't guaranteed to start
    # with a letter (slugify() just strips characters, doesn't enforce it).
    return f"com.vakargames.studioapp.app{doc.get('slug', 'app').replace('-', '')}"

def _validate_build_config(update):
    if update.get("package_id"):
        if not PACKAGE_ID_RE.match(update["package_id"]):
            raise HTTPException(
                status_code=400,
                detail="Invalid package name — use reverse-DNS style like com.yourname.appname (letters, numbers, underscores, at least one dot, no segment starting with a number).",
            )
    min_sdk = update.get("min_sdk")
    target_sdk = update.get("target_sdk")
    if min_sdk is not None and not (MIN_SDK_FLOOR <= min_sdk <= MAX_SDK_CEIL):
        raise HTTPException(status_code=400, detail=f"Min SDK must be between {MIN_SDK_FLOOR} and {MAX_SDK_CEIL}.")
    if target_sdk is not None and not (MIN_SDK_FLOOR <= target_sdk <= MAX_SDK_CEIL):
        raise HTTPException(status_code=400, detail=f"Target SDK must be between {MIN_SDK_FLOOR} and {MAX_SDK_CEIL}.")
    if min_sdk is not None and target_sdk is not None and target_sdk < min_sdk:
        raise HTTPException(status_code=400, detail="Target SDK must be greater than or equal to Min SDK.")


async def _unique_slug(base_slug: str, exclude_id=None) -> str:
    slug = base_slug
    n = 1
    while True:
        q = {"slug": slug}
        if exclude_id is not None:
            q["_id"] = {"$ne": exclude_id}
        if not await db.studio_apps.find_one(q):
            return slug
        n += 1
        slug = f"{base_slug}-{n}"


def _validate_screens(screens, max_screens=MAX_SCREENS):
    if not isinstance(screens, list) or len(screens) == 0:
        raise HTTPException(status_code=400, detail="An app needs at least one screen")
    if len(screens) > max_screens:
        raise HTTPException(status_code=400, detail=f"Too many screens (max {max_screens}). Upgrade to Vakar+ for more." if max_screens < MAX_SCREENS else f"Too many screens (max {max_screens})")
    for s in screens:
        if len(s.get("components", [])) > MAX_COMPONENTS_PER_SCREEN:
            raise HTTPException(status_code=400, detail="Too many components on one screen")


def _check_component_tier(comp):
    if comp.get("type") in PREMIUM_COMPONENT_TYPES:
        raise HTTPException(status_code=402, detail="This component requires Vakar+.")
    # A text's exact-pixel custom size (vs. the sm/md/lg/xl presets) is a
    # Vakar+ perk on an otherwise-free component type, so it's checked here
    # per-instance rather than via PREMIUM_COMPONENT_TYPES (which gates a
    # whole type, not one prop value of it).
    if comp.get("type") == "text" and (comp.get("props") or {}).get("size") == "custom":
        raise HTTPException(status_code=402, detail="Custom text sizing requires Vakar+.")
    for child in comp.get("children") or []:
        _check_component_tier(child)

def _validate_tier(screens, theme, is_vakar_plus):
    if is_vakar_plus:
        return
    if theme and theme not in FREE_THEME_IDS:
        raise HTTPException(status_code=402, detail="This theme requires Vakar+.")
    for s in screens or []:
        for c in s.get("components", []):
            _check_component_tier(c)


# ============================================================
# STORAGE QUOTA — every file an app references (icon + any uploaded image
# component), combined. Recomputed on demand from actual file sizes on disk
# rather than tracked as a running counter that could drift after an image
# is replaced or deleted.
# ============================================================

def _local_upload_path(url):
    """Resolves a `/api/uploads/<filename>` URL to its file on disk, or None
    if it's not a local upload (an external image URL someone pasted in
    doesn't count toward this app's storage — we don't host it)."""
    if not url or not isinstance(url, str) or not url.startswith("/api/uploads/"):
        return None
    filename = url[len("/api/uploads/"):]
    if "/" in filename or ".." in filename:
        return None
    path = UPLOADS_DIR / filename
    return path if path.is_file() else None

def _collect_asset_urls(doc):
    urls = []
    if doc.get("app_icon_url"):
        urls.append(doc["app_icon_url"])

    def walk(comp):
        if comp.get("type") == "image" and comp.get("props", {}).get("url"):
            urls.append(comp["props"]["url"])
        for child in comp.get("children") or []:
            walk(child)

    for s in doc.get("screens") or []:
        for c in s.get("components", []):
            walk(c)
    return urls

def _compute_storage_bytes(doc):
    total = 0
    for url in _collect_asset_urls(doc):
        path = _local_upload_path(url)
        if path:
            total += path.stat().st_size
    return total


def _serialize(doc, full=False, include_owner=False, is_vakar_plus=None):
    result = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "description": doc.get("description", ""),
        "accent_color": doc.get("accent_color", "#4ECDC4"),
        "theme": doc.get("theme", "mint"),
        "visibility": doc.get("visibility", "private"),
        "status": doc.get("status", "draft"),
        "package_id": doc.get("package_id") or _default_package_id(doc),
        "min_sdk": doc.get("min_sdk", MIN_SDK_FLOOR),
        "target_sdk": doc.get("target_sdk", 34),
        "app_display_name": doc.get("app_display_name") or "",
        "app_icon_url": doc.get("app_icon_url") or "",
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat(),
    }
    if full:
        result["screens"] = doc.get("screens", [])
        result["variables"] = doc.get("variables", [])
        # Staff/house apps (no user_id) aren't storage-quota'd, same as
        # they aren't app/screen quota'd — only self-service apps are.
        result["storage_used_bytes"] = _compute_storage_bytes(doc)
        result["storage_max_bytes"] = (
            PLUS_MAX_APP_BYTES if (not doc.get("user_id") or is_vakar_plus) else FREE_MAX_APP_BYTES
        )
    if include_owner:
        result["owner"] = doc.get("created_by", "")
        result["is_user_app"] = doc.get("user_id") is not None
    return result

# ============================================================
# ADMIN — builder CRUD for staff-owned apps + moderation surface. Since
# `db.studio_apps` holds both staff and public user apps in one collection,
# this list also doubles as the moderation console: any app (owner or
# staff-made) can be force-unpublished here via the status endpoint below,
# regardless of who created it — no separate moderation code needed.
# ============================================================

@router.get("/admin/studio-apps")
async def list_studio_apps(user=Depends(require_permission("manage_studio_apps"))):
    docs = await db.studio_apps.find().sort("updated_at", -1).to_list(500)
    return {"apps": [_serialize(d, include_owner=True) for d in docs]}

@router.post("/admin/studio-apps")
async def create_studio_app(body: StudioAppCreateRequest, user=Depends(require_permission("manage_studio_apps"))):
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    base_slug = slugify(body.slug or name) or "app"
    slug = await _unique_slug(base_slug)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "description": "",
        "accent_color": "#4ECDC4",
        "theme": "mint",
        "visibility": "private",
        "status": "draft",
        "screens": [{"id": "home", "name": "Home", "components": []}],
        "variables": [],
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
        "user_id": None,
    }
    result = await db.studio_apps.insert_one(doc)
    await log_action("studio_apps", f"App '{name}' created", user=user["username"])
    return {"id": str(result.inserted_id), "slug": slug}

@router.get("/admin/studio-apps/{app_id}")
async def get_studio_app(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    return _serialize(doc, full=True)

@router.put("/admin/studio-apps/{app_id}")
async def update_studio_app(app_id: str, body: StudioAppUpdateRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "screens" in update:
        _validate_screens(update["screens"])
    if "name" in update:
        update["name"] = update["name"].strip()[:80] or "Untitled app"
    _validate_build_config(update)
    if not update:
        return {"ok": True}
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.studio_apps.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="App not found")
    return {"ok": True}

@router.patch("/admin/studio-apps/{app_id}/status")
async def set_studio_app_status(app_id: str, body: StudioAppStatusRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    if body.status == "published" and not doc.get("screens"):
        raise HTTPException(status_code=400, detail="Add at least one screen before publishing")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}})
    await log_action("studio_apps", f"App '{doc['name']}' set to {body.status}", user=user["username"])
    return {"ok": True}

@router.patch("/admin/studio-apps/{app_id}/visibility")
async def set_studio_app_visibility(app_id: str, body: StudioAppVisibilityRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.studio_apps.update_one({"_id": oid}, {"$set": {"visibility": body.visibility, "updated_at": datetime.now(timezone.utc)}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="App not found")
    return {"ok": True}

@router.delete("/admin/studio-apps/{app_id}")
async def delete_studio_app(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.studio_apps.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="App not found")
    return {"ok": True}

@router.post("/admin/studio-apps/{app_id}/duplicate")
async def duplicate_studio_app(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    slug = await _unique_slug(f"{doc['slug']}-copy")
    now = datetime.now(timezone.utc)
    new_doc = {
        **{k: v for k, v in doc.items() if k not in ("_id", "created_at", "updated_at", "status")},
        "name": f"{doc['name']} (Copy)",
        "slug": slug,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
    }
    result = await db.studio_apps.insert_one(new_doc)
    return {"id": str(result.inserted_id), "slug": slug}

async def _read_validated_asset_image(file: UploadFile):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_ASSET_EXTS:
        raise HTTPException(status_code=400, detail="Only image files allowed (jpg, png, gif, webp).")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 5 MB per file.")
    content = _validate_file(content, ext, _IMAGE_MIMES)
    return content, ext

def _write_asset_file(content: bytes, ext: str) -> str:
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(UPLOADS_DIR / filename, "wb") as f:
        f.write(content)
    return f"/api/uploads/{filename}"

@router.post("/admin/studio-apps/{app_id}/asset")
async def upload_studio_app_asset(app_id: str, file: UploadFile = File(...), user=Depends(require_permission("manage_studio_apps"))):
    """Staff/house apps aren't storage-quota'd, same as they aren't
    app/screen quota'd — this just saves the file."""
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    if not await db.studio_apps.find_one({"_id": oid}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="App not found")
    content, ext = await _read_validated_asset_image(file)
    return {"url": _write_asset_file(content, ext)}

# ============================================================
# SELF-SERVICE — public "My Apps": any logged-in user can build their own,
# quota'd by is_vakar_plus. This is the public rollout surface (Phase B) —
# the admin endpoints above remain for staff/internal tools only.
# ============================================================

async def _get_owned_app(app_id: str, user):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or str(doc.get("user_id")) != user["id"]:
        raise HTTPException(status_code=404, detail="App not found")
    return oid, doc

@router.get("/my/studio-apps")
async def list_my_studio_apps(user=Depends(get_current_user)):
    docs = await db.studio_apps.find({"user_id": ObjectId(user["id"])}).sort("updated_at", -1).to_list(100)
    max_apps = PLUS_MAX_APPS if user.get("is_vakar_plus") else FREE_MAX_APPS
    return {
        "apps": [_serialize(d) for d in docs],
        "quota": {"used": len(docs), "max": max_apps, "is_vakar_plus": user.get("is_vakar_plus", False)},
    }

@router.post("/my/studio-apps")
@limiter.limit("20/hour")
async def create_my_studio_app(request: Request, body: StudioAppCreateRequest, user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    max_apps = PLUS_MAX_APPS if user.get("is_vakar_plus") else FREE_MAX_APPS
    existing_count = await db.studio_apps.count_documents({"user_id": uid})
    if existing_count >= max_apps:
        raise HTTPException(status_code=402, detail=f"You've reached your app limit ({max_apps}). Upgrade to Vakar+ for more.")
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    base_slug = slugify(body.slug or name) or "app"
    slug = await _unique_slug(base_slug)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "description": "",
        "accent_color": "#4ECDC4",
        "theme": "mint",
        "visibility": "private",
        "status": "draft",
        "screens": [{"id": "home", "name": "Home", "components": []}],
        "variables": [],
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
        "user_id": uid,
    }
    result = await db.studio_apps.insert_one(doc)
    return {"id": str(result.inserted_id), "slug": slug}

@router.get("/my/studio-apps/{app_id}")
async def get_my_studio_app(app_id: str, user=Depends(get_current_user)):
    _oid, doc = await _get_owned_app(app_id, user)
    return _serialize(doc, full=True, is_vakar_plus=user.get("is_vakar_plus", False))

@router.put("/my/studio-apps/{app_id}")
async def update_my_studio_app(app_id: str, body: StudioAppUpdateRequest, user=Depends(get_current_user)):
    oid, doc = await _get_owned_app(app_id, user)
    is_plus = user.get("is_vakar_plus", False)
    max_screens = PLUS_MAX_SCREENS_PER_APP if is_plus else FREE_MAX_SCREENS_PER_APP

    update = {k: v for k, v in body.dict().items() if v is not None}
    if "screens" in update:
        _validate_screens(update["screens"], max_screens=max_screens)
        _validate_tier(update["screens"], update.get("theme", doc.get("theme")), is_plus)
    elif "theme" in update:
        _validate_tier(doc.get("screens", []), update["theme"], is_plus)
    if "name" in update:
        update["name"] = update["name"].strip()[:80] or "Untitled app"
    _validate_build_config(update)
    if not update:
        return {"ok": True}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.studio_apps.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}

@router.patch("/my/studio-apps/{app_id}/status")
async def set_my_studio_app_status(app_id: str, body: StudioAppStatusRequest, user=Depends(get_current_user)):
    oid, doc = await _get_owned_app(app_id, user)
    if body.status == "published" and not doc.get("screens"):
        raise HTTPException(status_code=400, detail="Add at least one screen before publishing")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}

@router.patch("/my/studio-apps/{app_id}/visibility")
async def set_my_studio_app_visibility(app_id: str, body: StudioAppVisibilityRequest, user=Depends(get_current_user)):
    oid, _doc = await _get_owned_app(app_id, user)
    await db.studio_apps.update_one({"_id": oid}, {"$set": {"visibility": body.visibility, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}

@router.delete("/my/studio-apps/{app_id}")
async def delete_my_studio_app(app_id: str, user=Depends(get_current_user)):
    oid, _doc = await _get_owned_app(app_id, user)
    await db.studio_apps.delete_one({"_id": oid})
    return {"ok": True}

@router.post("/my/studio-apps/{app_id}/asset")
async def upload_my_studio_app_asset(app_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    """App icon or an image component's picture — counts toward this app's
    storage quota (20MB free / 1GB Vakar+), checked against every asset the
    app currently references (recomputed from disk, see
    _compute_storage_bytes) plus this new file, before it's written."""
    _oid, doc = await _get_owned_app(app_id, user)
    content, ext = await _read_validated_asset_image(file)
    is_plus = user.get("is_vakar_plus", False)
    max_bytes = PLUS_MAX_APP_BYTES if is_plus else FREE_MAX_APP_BYTES
    current = _compute_storage_bytes(doc)
    if current + len(content) > max_bytes:
        limit_label = "1GB" if is_plus else "20MB"
        raise HTTPException(status_code=402, detail=f"This app has reached its storage limit ({limit_label})." + ("" if is_plus else " Upgrade to Vakar+ for up to 1GB."))
    return {"url": _write_asset_file(content, ext)}

@router.post("/my/studio-apps/{app_id}/duplicate")
async def duplicate_my_studio_app(app_id: str, user=Depends(get_current_user)):
    _oid, doc = await _get_owned_app(app_id, user)
    max_apps = PLUS_MAX_APPS if user.get("is_vakar_plus") else FREE_MAX_APPS
    existing_count = await db.studio_apps.count_documents({"user_id": ObjectId(user["id"])})
    if existing_count >= max_apps:
        raise HTTPException(status_code=402, detail=f"You've reached your app limit ({max_apps}). Upgrade to Vakar+ for more.")
    slug = await _unique_slug(f"{doc['slug']}-copy")
    now = datetime.now(timezone.utc)
    new_doc = {
        **{k: v for k, v in doc.items() if k not in ("_id", "created_at", "updated_at", "status")},
        "name": f"{doc['name']} (Copy)",
        "slug": slug,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    result = await db.studio_apps.insert_one(new_doc)
    return {"id": str(result.inserted_id), "slug": slug}

# ============================================================
# PUBLIC / RUNTIME — served to whoever loads /apps/{slug}. Public apps are
# open to anyone; private apps are visible to their owner (self-service
# apps) or to staff (admin/super_admin — covers both "internal staff tool"
# apps and moderation review of a user's private app).
# ============================================================

@router.get("/apps/{slug}")
async def get_public_studio_app(slug: str, user=Depends(get_optional_user)):
    doc = await db.studio_apps.find_one({"slug": slug, "status": "published"})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    if doc.get("visibility") == "private":
        is_owner = bool(user and doc.get("user_id") and str(doc["user_id"]) == user.get("id"))
        is_staff = bool(user and user.get("role") in ("admin", "super_admin"))
        if not (is_owner or is_staff):
            raise HTTPException(status_code=404, detail="App not found")
    result = _serialize(doc, full=True)
    # Staff/"house" apps (no owner) never show the free-tier watermark —
    # only self-service apps built by a non-Vakar+ user do.
    if doc.get("user_id"):
        owner = await db.users.find_one({"_id": doc["user_id"]}, {"vakar_plus_status": 1})
        result["owner_is_vakar_plus"] = bool(owner and owner.get("vakar_plus_status") == "active")
    else:
        result["owner_is_vakar_plus"] = True
    return result
