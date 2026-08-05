import re
import json
import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone

import stripe
from bson import ObjectId
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Response

from ..database import db
from ..config import UPLOADS_DIR, VAKARSTUDIO_FILE_KEY
from ..deps import require_permission, get_current_user, get_optional_user
from ..utils import slugify, log_action, _validate_file, _IMAGE_MIMES, _create_notification, _get_origin
from ..rate_limit import limiter
from ..schemas import (
    StudioAppCreateRequest, StudioAppUpdateRequest, StudioAppStatusRequest, StudioAppVisibilityRequest,
    StudioAppSubmitReviewRequest, StudioAppReviewDecisionRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)

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

# Paid apps — a creator can charge for access to their published app. Setting
# a price at all requires Vakar+ (checked in submit_my_studio_app_review);
# the split is fixed platform-wide, not per-app, so it's a constant here
# rather than a document field. Payout to creators is a manual/admin process
# for now (creator_earnings_cents accumulates as a ledger on the app doc) —
# deliberately NOT wired to a Stripe Connect payout flow, which would need
# its own onboarding/KYC/tax decisions well beyond this feature's ask.
MIN_APP_PRICE_CENTS = 100
CREATOR_SHARE_PCT = 60

# .vakarstudio export/import — an app's building blocks (screens, variables,
# theme, build config) as Fernet-encrypted JSON, importable only by this
# backend (see config.VAKARSTUDIO_FILE_KEY). Deliberately excludes ownership,
# review/showcase, and pricing fields — those are per-listing decisions the
# importer should re-make, not inherit silently from someone else's export.
VAKARSTUDIO_FORMAT = "vakarstudio"
VAKARSTUDIO_VERSION = 1
VAKARSTUDIO_EXPORT_FIELDS = (
    "name", "description", "accent_color", "theme", "screens", "variables",
    "package_id", "min_sdk", "target_sdk", "app_display_name", "app_icon_url",
)

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
        # Review/showcase submission — separate from the builder's own
        # name/icon above, since the public storefront presentation is
        # independent of the internal project identity. "none" means never
        # submitted; a self-service app can only be publicly reachable once
        # this is "approved" (see get_public_studio_app / the visibility guard).
        "review_status": doc.get("review_status", "none"),
        "review_name": doc.get("review_name") or "",
        "review_description": doc.get("review_description") or "",
        "review_tags": doc.get("review_tags") or [],
        "review_logo_url": doc.get("review_logo_url") or "",
        "review_banner_url": doc.get("review_banner_url") or "",
        "review_rejection_reason": doc.get("review_rejection_reason") or "",
        # Public — needed to render the paywall/price tag. creator_earnings_cents
        # is deliberately NOT here (it's only attached in owner-scoped self-service
        # responses — see get_my_studio_app/list_my_studio_apps — never in the
        # public showcase, which anyone can fetch).
        "price_cents": doc.get("price_cents", 0),
        "submitted_at": doc["submitted_at"].isoformat() if doc.get("submitted_at") else None,
        "reviewed_at": doc["reviewed_at"].isoformat() if doc.get("reviewed_at") else None,
        "reviewed_by": doc.get("reviewed_by") or "",
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

def _with_earnings(result, doc):
    """Attaches the creator's own earnings ledger — only ever called from
    owner-scoped self-service responses (get/list my-studio-apps), never
    the public showcase, since revealing another creator's earnings would
    be a privacy leak."""
    result["creator_earnings_cents"] = doc.get("creator_earnings_cents", 0)
    result["total_sales_cents"] = doc.get("total_sales_cents", 0)
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

# Registered ahead of GET /admin/studio-apps/{app_id} on purpose — "reviews"
# would otherwise be swallowed by that path param and fail ObjectId parsing.
@router.get("/admin/studio-apps/reviews")
async def list_studio_app_reviews(status: str = "pending", user=Depends(require_permission("manage_studio_apps"))):
    if status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status filter")
    docs = await db.studio_apps.find({"review_status": status}).sort("submitted_at", -1).to_list(200)
    return {"reviews": [_serialize(d, include_owner=True) for d in docs]}

@router.post("/admin/studio-apps/reviews/{app_id}/approve")
async def approve_studio_app_review(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or doc.get("review_status") != "pending":
        raise HTTPException(status_code=404, detail="No pending submission found for this app")
    now = datetime.now(timezone.utc)
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "review_status": "approved", "status": "published", "visibility": "public",
        "reviewed_at": now, "reviewed_by": user["username"], "updated_at": now,
    }})
    await log_action("studio_apps", f"App '{doc['name']}' review approved", user=user["username"])
    if doc.get("user_id"):
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"🎉 Your app \"{doc.get('review_name') or doc['name']}\" was approved and is now live on Applications!",
            notif_type="studio_app_approved", link=f"/apps/{doc['slug']}",
        )
    return {"ok": True}

@router.post("/admin/studio-apps/reviews/{app_id}/reject")
async def reject_studio_app_review(app_id: str, body: StudioAppReviewDecisionRequest, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or doc.get("review_status") != "pending":
        raise HTTPException(status_code=404, detail="No pending submission found for this app")
    reason = body.reason.strip()[:500]
    now = datetime.now(timezone.utc)
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "review_status": "rejected", "review_rejection_reason": reason,
        "reviewed_at": now, "reviewed_by": user["username"], "updated_at": now,
    }})
    await log_action("studio_apps", f"App '{doc['name']}' review rejected", user=user["username"])
    if doc.get("user_id"):
        reason_suffix = f" Reason: {reason}" if reason else ""
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"Your app \"{doc.get('review_name') or doc['name']}\" submission wasn't approved.{reason_suffix}",
            notif_type="studio_app_rejected", link="/my-apps",
        )
    return {"ok": True}

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

# ============================================================
# .vakarstudio EXPORT/IMPORT — an app's building blocks as Fernet-encrypted
# JSON (see VAKARSTUDIO_* constants above and config.VAKARSTUDIO_FILE_KEY).
# The file is opaque without this backend's key — there is no client-side
# involvement in the encryption, so it can't be reproduced or read by
# inspecting the frontend bundle, unlike a "secret embedded in JS" scheme.
# ============================================================

def _encrypt_vakarstudio_file(doc) -> bytes:
    payload = {"format": VAKARSTUDIO_FORMAT, "version": VAKARSTUDIO_VERSION}
    for field in VAKARSTUDIO_EXPORT_FIELDS:
        payload[field] = doc.get(field)
    return Fernet(VAKARSTUDIO_FILE_KEY).encrypt(json.dumps(payload).encode())

def _decrypt_vakarstudio_file(content: bytes) -> dict:
    try:
        raw = Fernet(VAKARSTUDIO_FILE_KEY).decrypt(content)
        payload = json.loads(raw)
    except (InvalidToken, ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid or corrupted .vakarstudio file")
    if payload.get("format") != VAKARSTUDIO_FORMAT:
        raise HTTPException(status_code=400, detail="Not a valid .vakarstudio file")
    return payload

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

@router.get("/admin/studio-apps/{app_id}/export-file")
async def export_studio_app_file(app_id: str, user=Depends(require_permission("manage_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    token = _encrypt_vakarstudio_file(doc)
    return Response(content=token, media_type="application/octet-stream", headers={
        "Content-Disposition": f'attachment; filename="{doc["slug"]}.vakarstudio"',
    })

@router.post("/admin/studio-apps/import")
async def import_studio_app_file(file: UploadFile = File(...), user=Depends(require_permission("manage_studio_apps"))):
    payload = _decrypt_vakarstudio_file(await file.read())
    name = (payload.get("name") or "Imported app").strip()[:80]
    base_slug = slugify(name) or "app"
    slug = await _unique_slug(base_slug)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "description": payload.get("description") or "",
        "accent_color": payload.get("accent_color") or "#4ECDC4",
        "theme": payload.get("theme") or "mint",
        "visibility": "private",
        "status": "draft",
        "screens": payload.get("screens") or [{"id": "home", "name": "Home", "components": []}],
        "variables": payload.get("variables") or [],
        "package_id": payload.get("package_id"),
        "min_sdk": payload.get("min_sdk"),
        "target_sdk": payload.get("target_sdk"),
        "app_display_name": payload.get("app_display_name") or "",
        "app_icon_url": payload.get("app_icon_url") or "",
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
        "user_id": None,
    }
    _validate_screens(doc["screens"])
    result = await db.studio_apps.insert_one(doc)
    await log_action("studio_apps", f"App '{name}' imported from .vakarstudio", user=user["username"])
    return {"id": str(result.inserted_id), "slug": slug}

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
        "apps": [_with_earnings(_serialize(d), d) for d in docs],
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
    return _with_earnings(_serialize(doc, full=True, is_vakar_plus=user.get("is_vakar_plus", False)), doc)

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
    oid, doc = await _get_owned_app(app_id, user)
    # Public reachability is gated by admin review now — going public without
    # ever having an approved submission isn't allowed. Once review_status is
    # "approved" this stays permissive (toggling private/public freely) until
    # a new "Submit Version" resets it to "pending".
    if body.visibility == "public" and doc.get("review_status") != "approved":
        raise HTTPException(status_code=402, detail="Submit this app for review before making it public.")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {"visibility": body.visibility, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}

@router.post("/my/studio-apps/{app_id}/submit-review")
@limiter.limit("10/hour")
async def submit_my_studio_app_review(request: Request, app_id: str, body: StudioAppSubmitReviewRequest, user=Depends(get_current_user)):
    """Sends the current app for admin review — this is the ONLY path to
    public reachability for a self-service app (see the visibility guard
    above and the review gate in get_public_studio_app). Submitting again
    (e.g. after edits to an already-approved app) resets review_status to
    "pending", which makes the app unreachable to strangers again until the
    new version is reviewed — a deliberate simplification, not a bug: there
    is no versioning system to keep the previously-approved copy live during
    re-review."""
    oid, doc = await _get_owned_app(app_id, user)
    if not doc.get("screens"):
        raise HTTPException(status_code=400, detail="Add at least one screen before submitting for review")
    name = body.name.strip()[:80]
    description = body.description.strip()[:600]
    logo_url = body.logo_url.strip()
    if not name or not description:
        raise HTTPException(status_code=400, detail="Name and description are required")
    if not logo_url:
        raise HTTPException(status_code=400, detail="A logo is required")
    tags = [t.strip()[:24] for t in body.tags if t.strip()][:10]
    price_cents = max(0, int(body.price_cents))
    if price_cents > 0:
        if not user.get("is_vakar_plus"):
            raise HTTPException(status_code=402, detail="Publishing a paid app requires Vakar+.")
        if price_cents < MIN_APP_PRICE_CENTS:
            raise HTTPException(status_code=400, detail=f"Minimum price is ${MIN_APP_PRICE_CENTS / 100:.2f}.")
    now = datetime.now(timezone.utc)
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "review_status": "pending",
        "review_name": name,
        "review_description": description,
        "review_tags": tags,
        "review_logo_url": logo_url,
        "review_banner_url": body.banner_url.strip(),
        "review_rejection_reason": "",
        "price_cents": price_cents,
        "submitted_at": now,
        "updated_at": now,
    }})
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

@router.get("/my/studio-apps/{app_id}/export-file")
async def export_my_studio_app_file(app_id: str, user=Depends(get_current_user)):
    _oid, doc = await _get_owned_app(app_id, user)
    token = _encrypt_vakarstudio_file(doc)
    return Response(content=token, media_type="application/octet-stream", headers={
        "Content-Disposition": f'attachment; filename="{doc["slug"]}.vakarstudio"',
    })

@router.post("/my/studio-apps/import")
@limiter.limit("20/hour")
async def import_my_studio_app_file(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    max_apps = PLUS_MAX_APPS if user.get("is_vakar_plus") else FREE_MAX_APPS
    existing_count = await db.studio_apps.count_documents({"user_id": ObjectId(user["id"])})
    if existing_count >= max_apps:
        raise HTTPException(status_code=402, detail=f"You've reached your app limit ({max_apps}). Upgrade to Vakar+ for more.")
    payload = _decrypt_vakarstudio_file(await file.read())
    is_plus = user.get("is_vakar_plus", False)
    max_screens = PLUS_MAX_SCREENS_PER_APP if is_plus else FREE_MAX_SCREENS_PER_APP
    screens = payload.get("screens") or [{"id": "home", "name": "Home", "components": []}]
    _validate_screens(screens, max_screens=max_screens)
    theme = payload.get("theme") or "mint"
    # Importing content built under a Vakar+ plan doesn't bypass tier gating
    # for a free-tier importer — same premium-component/theme check as any
    # other save, just run once up front here.
    _validate_tier(screens, theme, is_plus)
    name = (payload.get("name") or "Imported app").strip()[:80]
    base_slug = slugify(name) or "app"
    slug = await _unique_slug(base_slug)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "description": payload.get("description") or "",
        "accent_color": payload.get("accent_color") or "#4ECDC4",
        "theme": theme,
        "visibility": "private",
        "status": "draft",
        "screens": screens,
        "variables": payload.get("variables") or [],
        "package_id": payload.get("package_id"),
        "min_sdk": payload.get("min_sdk"),
        "target_sdk": payload.get("target_sdk"),
        "app_display_name": payload.get("app_display_name") or "",
        "app_icon_url": payload.get("app_icon_url") or "",
        "created_at": now,
        "updated_at": now,
        "created_by": user["username"],
        "user_id": ObjectId(user["id"]),
    }
    result = await db.studio_apps.insert_one(doc)
    return {"id": str(result.inserted_id), "slug": slug}

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

# The community showcase — "Applications" on the public site. Scoped
# specifically to self-service apps with an approved submission; staff/house
# apps aren't included here (they're internal tools, not community content).
@router.get("/apps")
async def list_public_studio_apps():
    docs = await db.studio_apps.find({
        "user_id": {"$ne": None},
        "review_status": "approved",
        "status": "published",
        "visibility": "public",
    }).sort("reviewed_at", -1).to_list(200)
    return {"apps": [_serialize(d) for d in docs]}

@router.get("/apps/{slug}")
async def get_public_studio_app(slug: str, user=Depends(get_optional_user)):
    doc = await db.studio_apps.find_one({"slug": slug, "status": "published"})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    is_owner = bool(user and doc.get("user_id") and str(doc["user_id"]) == user.get("id"))
    is_staff = bool(user and user.get("role") in ("admin", "super_admin"))
    if doc.get("visibility") == "private":
        if not (is_owner or is_staff):
            raise HTTPException(status_code=404, detail="App not found")
    elif doc.get("user_id") and doc.get("review_status") != "approved":
        # Public self-service apps only stay actually reachable to strangers
        # while their latest submitted version is approved — owner/staff can
        # still preview it (e.g. to review a pending resubmission).
        if not (is_owner or is_staff):
            raise HTTPException(status_code=404, detail="App not found")

    price_cents = doc.get("price_cents", 0)
    if price_cents > 0 and not (is_owner or is_staff):
        purchased = user and await db.studio_app_purchases.find_one({"app_id": doc["_id"], "email": user.get("email")}, {"_id": 1})
        if not purchased:
            # A paid app that's legitimately public but unpaid-for shows a
            # paywall, not a 404 — it genuinely exists and is discoverable
            # (e.g. from the Applications showcase); returning full screens
            # data here would defeat the paywall entirely, so only the
            # minimum needed to render a "Buy access" screen is sent.
            return {
                "id": str(doc["_id"]), "slug": doc["slug"],
                "name": doc.get("review_name") or doc["name"],
                "description": doc.get("review_description") or "",
                "app_icon_url": doc.get("review_logo_url") or doc.get("app_icon_url") or "",
                "price_cents": price_cents,
                "requires_purchase": True,
            }

    result = _serialize(doc, full=True)
    result["requires_purchase"] = False
    # Staff/"house" apps (no owner) never show the free-tier watermark —
    # only self-service apps built by a non-Vakar+ user do.
    if doc.get("user_id"):
        owner = await db.users.find_one({"_id": doc["user_id"]}, {"vakar_plus_status": 1})
        result["owner_is_vakar_plus"] = bool(owner and owner.get("vakar_plus_status") == "active")
    else:
        result["owner_is_vakar_plus"] = True
    return result

@router.post("/apps/{slug}/checkout")
@limiter.limit("10/minute")
async def create_studio_app_checkout(request: Request, slug: str, user=Depends(get_current_user)):
    """Buy access to a paid app. Fulfillment (recording the purchase, crediting
    the creator's share, notifying both sides) happens in the Stripe webhook —
    see routers/shop.py's checkout_type == "studio_app_purchase" branch, the
    same split-fulfillment pattern already used for Vakar+ subscriptions."""
    doc = await db.studio_apps.find_one({"slug": slug, "status": "published", "review_status": "approved", "visibility": "public"})
    if not doc or not doc.get("user_id"):
        raise HTTPException(status_code=404, detail="App not found")
    price_cents = doc.get("price_cents", 0)
    if price_cents <= 0:
        raise HTTPException(status_code=400, detail="This app is free")
    if str(doc["user_id"]) == user["id"]:
        raise HTTPException(status_code=400, detail="You already own this app")
    if await db.studio_app_purchases.find_one({"app_id": doc["_id"], "email": user["email"]}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="You already own this app")

    origin = _get_origin(request)
    app_name = doc.get("review_name") or doc["name"]
    images = [doc["review_logo_url"]] if (doc.get("review_logo_url") or "").startswith("http") else []

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": app_name, "description": doc.get("review_description") or "", "images": images},
                    "unit_amount": price_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/apps/{slug}?purchased=1",
            cancel_url=f"{origin}/apps/{slug}",
            metadata={
                "checkout_type": "studio_app_purchase",
                "app_id": str(doc["_id"]),
                "app_slug": slug,
                "app_name": app_name,
                "user_email": user["email"],
                "creator_user_id": str(doc["user_id"]),
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Studio app checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {"checkout_url": session.url, "session_id": session.id}
