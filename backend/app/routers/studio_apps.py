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
PLUS_MAX_APPS = 50
# "Unlimited" for Vakar+ in practice means the same hard technical ceiling
# every app is built against (MAX_SCREENS) — there's no separate, lower
# Vakar+ cap to enforce, and _validate_screens() only shows the "upgrade"
# upsell when max_screens < MAX_SCREENS, so this reads as truly unlimited.
PLUS_MAX_SCREENS_PER_APP = MAX_SCREENS

# Mirrors the `tier` tags in frontend/src/constants/appBuilder.js — kept as
# a small independent list rather than importing frontend code, same as
# every other cross-stack constant in this codebase. Update both together.
PREMIUM_COMPONENT_TYPES = {"icon", "list", "toggle", "slider", "date", "video", "webview"}
FREE_THEME_IDS = {"mint"}
# Mirrors ANIMATION_TYPES' tier tags in appBuilder.js — 'fade' is free, the
# rest are a Vakar+ perk on props.animation (any component type).
PREMIUM_ANIMATIONS = {"slide-up", "slide-down", "pop"}

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

# Submission tags — a fixed taxonomy the submitter picks from, not free
# text (mirrors APP_TAGS/MIN_APP_TAGS/MAX_APP_TAGS in
# frontend/src/constants/appBuilder.js — keep both in sync by hand).
ALLOWED_APP_TAGS = {
    "Productivity", "Games", "Social", "Education", "Finance",
    "Health & Fitness", "Entertainment", "Business", "Utilities", "Lifestyle",
    "Photo & Video", "Travel", "Food & Drink", "Sports", "Kids & Family", "Other",
}
MIN_APP_TAGS = 1
MAX_APP_TAGS = 3

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

# ============================================================
# VERSION SNAPSHOTS — like a real app store, editing a self-service app's
# project after submitting it for review must never change what's already
# under review or already live. `screens`/`variables`/`theme`/etc. at the
# top level of the doc remain the live-editing DRAFT (what the builder
# reads/writes, unchanged). Two frozen copies of that content live
# alongside it:
#   - pending_snapshot — taken the instant "Submit Version" is clicked;
#     this is what an admin actually reviews, immune to further edits.
#   - published_snapshot — taken the instant an admin approves a
#     submission (copied straight from that submission's pending_snapshot);
#     this is what strangers actually see at /apps/{slug}.
# Both are None for every app that existed before this shipped — no DB
# migration needed, see _apply_snapshot's no-op fallback below.
# ============================================================
STUDIO_APP_SNAPSHOT_FIELDS = (
    "name", "description", "accent_color", "theme", "screens", "variables",
    "package_id", "min_sdk", "target_sdk", "app_display_name", "app_icon_url",
    "price_cents", "review_name", "review_description", "review_tags",
    "review_logo_url", "review_banner_url",
)

def _make_snapshot(doc):
    return {f: doc.get(f) for f in STUDIO_APP_SNAPSHOT_FIELDS}

def _apply_snapshot(doc, snapshot):
    """Overlays a frozen snapshot's content/listing fields onto doc for
    rendering. Workflow fields (review_status, submitted_at, ever_approved,
    admin_takedown, _id, slug, ...) always stay live — they describe review
    process state, not app content, and aren't part of what got submitted."""
    if not snapshot:
        return doc
    merged = dict(doc)
    merged.update({k: v for k, v in snapshot.items() if k in STUDIO_APP_SNAPSHOT_FIELDS})
    return merged

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


# ============================================================
# PUBLIC IDS — the actual public URL (/apps/{public_id}) is an opaque
# generated token, deliberately decoupled from `slug` (which stays a
# name-derived, human-readable internal identifier only — used for
# .vakarstudio filenames, the admin/owner UI's small "/slug" label, and the
# package-name fallback). Renaming an app never changes its public_id, and
# the public_id never reveals the app's name.
# ============================================================

def _generate_public_id() -> str:
    return uuid.uuid4().hex[:12]

async def _unique_public_id() -> str:
    while True:
        pid = _generate_public_id()
        if not await db.studio_apps.find_one({"public_id": pid}, {"_id": 1}):
            return pid

async def _ensure_public_id(doc):
    """Self-heals apps created before public_id existed — lazily assigns
    and persists one the first time the app is read by any endpoint that
    exposes/links to it. No manual migration needed: this repo has no
    live-Mongo access to run one from, and the real production DB already
    has apps with real bookmarked/shared links, so this must be transparent."""
    if not doc.get("public_id"):
        doc["public_id"] = await _unique_public_id()
        await db.studio_apps.update_one({"_id": doc["_id"]}, {"$set": {"public_id": doc["public_id"]}})
    return doc


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
    # Entrance animation — 'fade' is free, the rest are a per-instance perk
    # on any component type, same pattern as custom text sizing above.
    if (comp.get("props") or {}).get("animation") in PREMIUM_ANIMATIONS:
        raise HTTPException(status_code=402, detail="This animation requires Vakar+.")
    # Declarative conditional visibility (auto show/hide based on a live
    # variable) is a Vakar+ perk on any component type — the imperative
    # "show/hide an element" action (set_visibility) stays free and isn't
    # checked here, it's a plain action, not a component property.
    if (comp.get("visible_if") or {}).get("variable"):
        raise HTTPException(status_code=402, detail="Conditional visibility requires Vakar+.")
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
        # The real public identifier — /apps/{public_id} — decoupled from
        # slug/name on purpose (see the PUBLIC IDS section above). May be
        # empty only for a doc that hasn't passed through _ensure_public_id
        # yet; every call site that links to an app calls that first.
        "public_id": doc.get("public_id") or "",
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
        "review_changelog": doc.get("review_changelog") or "",
        # True once this app has been approved at least once — after that,
        # every new submission is treated as an update and requires a
        # changelog (see submit_my_studio_app_review). Never cleared, even
        # if a later submission is rejected.
        "ever_approved": bool(doc.get("ever_approved")),
        # Admin moderation kill-switch — see the Published Apps tab and
        # takedown_studio_app/restore_studio_app. Independent of
        # status/visibility so an owner can never route around it by
        # flipping those flags back themselves.
        "admin_takedown": bool(doc.get("admin_takedown")),
        "admin_takedown_reason": doc.get("admin_takedown_reason") or "",
        # Delisting is the lighter, independent lever — hides an app from
        # GET /apps (discovery) without blocking a direct /apps/{public_id}
        # link, unlike admin_takedown which blocks both.
        "admin_delisted": bool(doc.get("admin_delisted")),
        "admin_delisted_reason": doc.get("admin_delisted_reason") or "",
        # Set when the OWNER pulls their own app down (see withdraw_my_studio_app)
        # — distinguishes "owner chose to withdraw this" from "just never
        # published"/"admin suspended it", each shown differently in the UI.
        "owner_withdrawal_reason": doc.get("owner_withdrawal_reason") or "",
        "owner_withdrawn_at": doc["owner_withdrawn_at"].isoformat() if doc.get("owner_withdrawn_at") else None,
        # Public — needed to render the paywall/price tag. creator_earnings_cents
        # is deliberately NOT here (it's only attached in owner-scoped self-service
        # responses — see get_my_studio_app/list_my_studio_apps — never in the
        # public showcase, which anyone can fetch).
        "price_cents": doc.get("price_cents", 0),
        # Cheap to compute (just a list length) so richer admin list views
        # don't need a full=True fetch per app just to show a screen count.
        "screens_count": len(doc.get("screens") or []),
        # Append-only "What's New" trail, one entry per approved submission —
        # see approve_studio_app_review. Small enough to always include, not
        # gated behind full=True, since this is literally public-facing data.
        "version_number": int(doc.get("version_number") or 0),
        "version_history": [
            {
                "version": v.get("version"),
                "changelog": v.get("changelog", ""),
                "approved_at": v["approved_at"].isoformat() if v.get("approved_at") else None,
            }
            for v in (doc.get("version_history") or [])
        ],
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
    # Earnings are attached here too (not just /my/studio-apps) since staff
    # already see owner identity via include_owner — no new privacy leak,
    # just useful context for a management console.
    return {"apps": [_with_earnings(_serialize(await _ensure_public_id(d), include_owner=True), d) for d in docs]}

# Registered ahead of GET /admin/studio-apps/{app_id} on purpose — "reviews"
# would otherwise be swallowed by that path param and fail ObjectId parsing.
@router.get("/admin/studio-apps/reviews")
async def list_studio_app_reviews(status: str = "pending", user=Depends(require_permission("review_studio_apps"))):
    if status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status filter")
    docs = await db.studio_apps.find({"review_status": status}).sort("submitted_at", -1).to_list(200)
    return {"reviews": [_serialize(await _ensure_public_id(d), include_owner=True) for d in docs]}

@router.post("/admin/studio-apps/reviews/{app_id}/approve")
async def approve_studio_app_review(app_id: str, user=Depends(require_permission("review_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or doc.get("review_status") != "pending":
        raise HTTPException(status_code=404, detail="No pending submission found for this app")
    await _ensure_public_id(doc)
    now = datetime.now(timezone.utc)
    new_version = int(doc.get("version_number") or 0) + 1
    await db.studio_apps.update_one({"_id": oid}, {
        "$set": {
            "review_status": "approved", "status": "published", "visibility": "public",
            "ever_approved": True, "reviewed_at": now, "reviewed_by": user["username"], "updated_at": now,
            # Freezes exactly the version that was reviewed as the new live
            # version — any draft edits made after this submission was sent
            # stay invisible to the public until they're submitted and approved
            # in their own right.
            "published_snapshot": doc.get("pending_snapshot") or _make_snapshot(doc),
            "pending_snapshot": None,
            "version_number": new_version,
        },
        # version_history is append-only — a real "What's New" trail per
        # version, unlike review_changelog which just holds the latest
        # submission's text. Rejections never append (nothing was published).
        "$push": {"version_history": {"version": new_version, "changelog": doc.get("review_changelog") or "", "approved_at": now}},
    })
    await log_action("studio_apps", f"App '{doc['name']}' review approved", user=user["username"])
    if doc.get("user_id"):
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"🎉 Your app \"{doc.get('review_name') or doc['name']}\" was approved and is now live on Applications!",
            notif_type="studio_app_approved", link=f"/apps/{doc['public_id']}",
        )
    return {"ok": True}

@router.post("/admin/studio-apps/reviews/{app_id}/reject")
async def reject_studio_app_review(app_id: str, body: StudioAppReviewDecisionRequest, user=Depends(require_permission("review_studio_apps"))):
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

# Registered ahead of GET /admin/studio-apps/{app_id} for the same reason
# /reviews is above — "published" would otherwise be swallowed as an
# ObjectId path param and fail to parse. Scoped to self-service apps only —
# staff/house apps are already fully managed in the App Builder tab above
# and were never part of the review/abuse-control workflow.
@router.get("/admin/studio-apps/published")
async def list_published_studio_apps(user=Depends(require_permission("review_studio_apps"))):
    docs = await db.studio_apps.find({
        "user_id": {"$ne": None}, "status": "published",
    }).sort("reviewed_at", -1).to_list(200)
    return {"apps": [_serialize(await _ensure_public_id(d), include_owner=True) for d in docs]}

@router.post("/admin/studio-apps/{app_id}/takedown")
async def takedown_studio_app(app_id: str, body: StudioAppReviewDecisionRequest, user=Depends(require_permission("review_studio_apps"))):
    """Suspends an already-published app — an owner-proof kill switch for
    abuse (see get_public_studio_app, which checks this before anything
    else and can't be routed around by the owner flipping status/visibility
    back themselves)."""
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    reason = body.reason.strip()[:500]
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "admin_takedown": True, "admin_takedown_reason": reason, "updated_at": datetime.now(timezone.utc),
    }})
    await log_action("studio_apps", f"App '{doc['name']}' suspended by moderation", user=user["username"])
    if doc.get("user_id"):
        reason_suffix = f" Reason: {reason}" if reason else ""
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"Your app \"{doc.get('review_name') or doc['name']}\" was suspended and is no longer publicly reachable.{reason_suffix}",
            notif_type="studio_app_takedown", link="/my-apps",
        )
    return {"ok": True}

@router.post("/admin/studio-apps/{app_id}/restore")
async def restore_studio_app(app_id: str, user=Depends(require_permission("review_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "admin_takedown": False, "admin_takedown_reason": "", "updated_at": datetime.now(timezone.utc),
    }})
    await log_action("studio_apps", f"App '{doc['name']}' restored", user=user["username"])
    if doc.get("user_id"):
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"Your app \"{doc.get('review_name') or doc['name']}\" was restored and is publicly reachable again.",
            notif_type="studio_app_restored", link="/my-apps",
        )
    return {"ok": True}

@router.post("/admin/studio-apps/{app_id}/delist")
async def delist_studio_app(app_id: str, body: StudioAppReviewDecisionRequest, user=Depends(require_permission("review_studio_apps"))):
    """The lighter lever, distinct from takedown/restore above — removes an
    app from GET /apps (the community showcase/search) without blocking a
    direct /apps/{public_id} link, matching Apple's "remove from sale" vs.
    actually pulling the app. See get_public_studio_app and
    list_public_studio_apps for the two enforcement points."""
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    reason = body.reason.strip()[:500]
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "admin_delisted": True, "admin_delisted_reason": reason, "updated_at": datetime.now(timezone.utc),
    }})
    await log_action("studio_apps", f"App '{doc['name']}' delisted from catalog", user=user["username"])
    if doc.get("user_id"):
        reason_suffix = f" Reason: {reason}" if reason else ""
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"Your app \"{doc.get('review_name') or doc['name']}\" was removed from the Applications catalog. Anyone with a direct link can still use it.{reason_suffix}",
            notif_type="studio_app_delisted", link="/my-apps",
        )
    return {"ok": True}

@router.post("/admin/studio-apps/{app_id}/relist")
async def relist_studio_app(app_id: str, user=Depends(require_permission("review_studio_apps"))):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "admin_delisted": False, "admin_delisted_reason": "", "updated_at": datetime.now(timezone.utc),
    }})
    await log_action("studio_apps", f"App '{doc['name']}' relisted", user=user["username"])
    if doc.get("user_id"):
        await _create_notification(
            user_id=str(doc["user_id"]),
            message=f"Your app \"{doc.get('review_name') or doc['name']}\" is back in the Applications catalog.",
            notif_type="studio_app_relisted", link="/my-apps",
        )
    return {"ok": True}

@router.post("/admin/studio-apps")
async def create_studio_app(body: StudioAppCreateRequest, user=Depends(require_permission("manage_studio_apps"))):
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    base_slug = slugify(body.slug or name) or "app"
    slug = await _unique_slug(base_slug)
    screens = body.screens or [{"id": "home", "name": "Home", "components": []}]
    _validate_screens(screens)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "public_id": await _unique_public_id(),
        "description": "",
        "accent_color": "#4ECDC4",
        "theme": body.theme or "mint",
        "visibility": "private",
        "status": "draft",
        "screens": screens,
        "variables": body.variables or [],
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
    return _serialize(await _ensure_public_id(doc), full=True)

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
        "public_id": await _unique_public_id(),
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
        "public_id": await _unique_public_id(),
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
        "apps": [_with_earnings(_serialize(await _ensure_public_id(d)), d) for d in docs],
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
    is_plus = user.get("is_vakar_plus", False)
    theme = body.theme or "mint"
    screens = body.screens or [{"id": "home", "name": "Home", "components": []}]
    max_screens = PLUS_MAX_SCREENS_PER_APP if is_plus else FREE_MAX_SCREENS_PER_APP
    _validate_screens(screens, max_screens=max_screens)
    # Covers a starter template's own theme/components, same tier gate as
    # any other save — a free-tier request can't use a premium template by
    # sending its content directly, even bypassing the picker UI.
    _validate_tier(screens, theme, is_plus)
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "slug": slug,
        "public_id": await _unique_public_id(),
        "description": "",
        "accent_color": "#4ECDC4",
        "theme": theme,
        "visibility": "private",
        "status": "draft",
        "screens": screens,
        "variables": body.variables or [],
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
    await _ensure_public_id(doc)
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
    # ever having an approved submission isn't allowed. Once the app has
    # been approved at least once, this stays permissive (toggling
    # private/public freely) even while a newer resubmission is pending —
    # the live (already-approved) version keeps serving from
    # published_snapshot regardless, see get_public_studio_app.
    if body.visibility == "public" and not doc.get("ever_approved"):
        raise HTTPException(status_code=402, detail="Submit this app for review before making it public.")
    if doc.get("admin_takedown"):
        raise HTTPException(status_code=403, detail="This app has been suspended by moderation. Contact support to appeal.")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {"visibility": body.visibility, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}

@router.post("/my/studio-apps/{app_id}/withdraw")
async def withdraw_my_studio_app(app_id: str, body: StudioAppReviewDecisionRequest, user=Depends(get_current_user)):
    """Lets an owner voluntarily pull their own live app down — distinct
    from admin takedown/delist above. Reuses `visibility` as the actual
    reachability lever (already fully enforced everywhere, see
    get_public_studio_app) rather than a third independent flag; the
    reason/timestamp are just recorded for context. Reversible by the
    owner themselves via republish_my_studio_app below, unlike an admin
    suspension — the required reason + the frontend's own double-confirmation
    step (typing the app's name) is the safety net here, not irreversibility."""
    oid, doc = await _get_owned_app(app_id, user)
    if doc.get("admin_takedown"):
        raise HTTPException(status_code=403, detail="This app has been suspended by moderation. Contact support to appeal.")
    if doc.get("visibility") != "public":
        raise HTTPException(status_code=400, detail="This app isn't currently public.")
    reason = body.reason.strip()[:500]
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required.")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "visibility": "private", "owner_withdrawal_reason": reason,
        "owner_withdrawn_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    }})
    return {"ok": True}

@router.post("/my/studio-apps/{app_id}/republish")
async def republish_my_studio_app(app_id: str, user=Depends(get_current_user)):
    oid, doc = await _get_owned_app(app_id, user)
    if doc.get("admin_takedown"):
        raise HTTPException(status_code=403, detail="This app has been suspended by moderation. Contact support to appeal.")
    if not doc.get("ever_approved"):
        raise HTTPException(status_code=402, detail="Submit this app for review before making it public.")
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "visibility": "public", "owner_withdrawal_reason": "", "owner_withdrawn_at": None,
        "updated_at": datetime.now(timezone.utc),
    }})
    return {"ok": True}

@router.post("/my/studio-apps/{app_id}/submit-review")
@limiter.limit("10/hour")
async def submit_my_studio_app_review(request: Request, app_id: str, body: StudioAppSubmitReviewRequest, user=Depends(get_current_user)):
    """Sends the current app for admin review — this is the ONLY path to
    public reachability for a self-service app (see the visibility guard
    above and the review gate in get_public_studio_app). The draft is
    frozen into pending_snapshot right here, at submission time, so any
    further edits to the project afterward can never leak into what the
    admin reviews. Submitting again after an app is already live does NOT
    take the live version down — it keeps serving from published_snapshot
    until this new submission is itself approved (see
    approve_studio_app_review)."""
    oid, doc = await _get_owned_app(app_id, user)
    if doc.get("admin_takedown"):
        raise HTTPException(status_code=403, detail="This app has been suspended by moderation. Contact support to appeal.")
    if not doc.get("screens"):
        raise HTTPException(status_code=400, detail="Add at least one screen before submitting for review")
    if not body.charter_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Studio Publisher Charter before submitting.")
    name = body.name.strip()[:80]
    description = body.description.strip()[:600]
    logo_url = body.logo_url.strip()
    if not name or not description:
        raise HTTPException(status_code=400, detail="Name and description are required")
    if not logo_url:
        raise HTTPException(status_code=400, detail="A logo is required")
    tags = list(dict.fromkeys(t.strip() for t in body.tags if t.strip()))
    if not (MIN_APP_TAGS <= len(tags) <= MAX_APP_TAGS):
        raise HTTPException(status_code=400, detail=f"Choose between {MIN_APP_TAGS} and {MAX_APP_TAGS} tags.")
    invalid_tags = [t for t in tags if t not in ALLOWED_APP_TAGS]
    if invalid_tags:
        raise HTTPException(status_code=400, detail=f"Unknown tag(s): {', '.join(invalid_tags)}")
    price_cents = max(0, int(body.price_cents))
    if price_cents > 0:
        if not user.get("is_vakar_plus"):
            raise HTTPException(status_code=402, detail="Publishing a paid app requires Vakar+.")
        if price_cents < MIN_APP_PRICE_CENTS:
            raise HTTPException(status_code=400, detail=f"Minimum price is ${MIN_APP_PRICE_CENTS / 100:.2f}.")
    changelog = body.changelog.strip()[:600]
    if doc.get("ever_approved") and not changelog:
        raise HTTPException(status_code=400, detail="Describe what changed in this update before submitting it for review.")
    now = datetime.now(timezone.utc)
    banner_url = body.banner_url.strip()
    # Freeze exactly what's being submitted: the draft's current project
    # content (doc, untouched by this request) plus this request's own
    # listing fields (name/description/tags/logo/banner/price) — not doc's
    # OLD listing fields from a previous submission.
    pending_snapshot = _make_snapshot(doc)
    pending_snapshot.update({
        "review_name": name, "review_description": description, "review_tags": tags,
        "review_logo_url": logo_url, "review_banner_url": banner_url, "price_cents": price_cents,
    })
    await db.studio_apps.update_one({"_id": oid}, {"$set": {
        "review_status": "pending",
        "review_name": name,
        "review_description": description,
        "review_tags": tags,
        "review_logo_url": logo_url,
        "review_banner_url": banner_url,
        "review_changelog": changelog,
        "review_rejection_reason": "",
        "price_cents": price_cents,
        "pending_snapshot": pending_snapshot,
        "submitted_at": now,
        "updated_at": now,
        "charter_accepted_at": now,
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
        "public_id": await _unique_public_id(),
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
        "public_id": await _unique_public_id(),
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        # A duplicate is a brand-new, never-submitted app — none of the
        # original's review/moderation state should carry over, otherwise
        # duplicating an already-approved app would let its copy skip
        # review entirely (ever_approved gates visibility, see
        # set_my_studio_app_visibility) or inherit a suspension that was
        # never actually placed on this specific copy.
        "visibility": "private",
        "review_status": "none",
        "ever_approved": False,
        "submitted_at": None,
        "reviewed_at": None,
        "reviewed_by": "",
        "review_rejection_reason": "",
        "review_changelog": "",
        "pending_snapshot": None,
        "published_snapshot": None,
        "admin_takedown": False,
        "admin_takedown_reason": "",
        "admin_delisted": False,
        "admin_delisted_reason": "",
        "owner_withdrawal_reason": "",
        "owner_withdrawn_at": None,
        "version_number": 0,
        "version_history": [],
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
        "ever_approved": True,
        "status": "published",
        "visibility": "public",
        "admin_takedown": {"$ne": True},
        # Delisting is deliberately independent of suspension (admin_takedown)
        # — a delisted app disappears from this showcase/search listing but a
        # direct /apps/{public_id} link still works, matching Apple's "remove
        # from sale" vs. actually pulling the app.
        "admin_delisted": {"$ne": True},
    }).sort("reviewed_at", -1).to_list(200)
    # Shows the last-approved snapshot's listing (name/description/icon/
    # price), not a newer-but-not-yet-approved resubmission's — matches
    # what a stranger actually sees at /apps/{public_id} below.
    return {"apps": [_serialize(_apply_snapshot(await _ensure_public_id(d), d.get("published_snapshot"))) for d in docs]}

@router.get("/apps/{app_id}")
async def get_public_studio_app(app_id: str, rev: str = "live", user=Depends(get_optional_user)):
    # public_id is the real, opaque public identifier; slug is accepted too
    # as a fallback purely so links shared/bookmarked before this shipped
    # keep working — every freshly generated link uses public_id only.
    doc = await db.studio_apps.find_one({"public_id": app_id}) or await db.studio_apps.find_one({"slug": app_id})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    await _ensure_public_id(doc)
    is_owner = bool(user and doc.get("user_id") and str(doc["user_id"]) == user.get("id"))
    is_staff = bool(user and user.get("role") in ("admin", "super_admin"))
    if not (is_owner or is_staff):
        # Everything below only gates strangers — the owner and staff can
        # always preview an app regardless of publish/review state (e.g. to
        # review a pending resubmission from the Reviews queue). Note
        # admin_delisted is NOT checked here — delisting only removes an app
        # from GET /apps above, a direct link must keep working.
        if doc.get("admin_takedown"):
            raise HTTPException(status_code=404, detail="App not found")
        if doc.get("status") != "published":
            raise HTTPException(status_code=404, detail="App not found")
        if doc.get("visibility") == "private":
            raise HTTPException(status_code=404, detail="App not found")
        if doc.get("user_id") and not doc.get("ever_approved"):
            # A self-service app only becomes reachable once it's been
            # approved for the first time. After that, submitting an update
            # for review does NOT take the live app down — strangers keep
            # seeing the last-approved snapshot below until the new
            # submission is itself approved (see approve_studio_app_review).
            raise HTTPException(status_code=404, detail="App not found")
        view_doc = _apply_snapshot(doc, doc.get("published_snapshot"))
    else:
        # Owner/staff can inspect any of three versions of their own app:
        #   ?rev=pending    — exactly what was frozen at the last "Submit
        #                     Version" click, used by the admin Reviews
        #                     queue's Preview link so further edits can
        #                     never leak into what's actually being judged.
        #   ?rev=published  — exactly what's currently live to the public.
        #   (default)       — the live draft, as currently being edited.
        if rev == "pending" and doc.get("pending_snapshot"):
            view_doc = _apply_snapshot(doc, doc["pending_snapshot"])
        elif rev == "published" and doc.get("published_snapshot"):
            view_doc = _apply_snapshot(doc, doc["published_snapshot"])
        else:
            view_doc = doc

    price_cents = view_doc.get("price_cents", 0)
    if price_cents > 0 and not (is_owner or is_staff):
        purchased = user and await db.studio_app_purchases.find_one({"app_id": doc["_id"], "email": user.get("email")}, {"_id": 1})
        if not purchased:
            # A paid app that's legitimately public but unpaid-for shows a
            # paywall, not a 404 — it genuinely exists and is discoverable
            # (e.g. from the Applications showcase); returning full screens
            # data here would defeat the paywall entirely, so only the
            # minimum needed to render a "Buy access" screen is sent.
            return {
                "id": str(doc["_id"]), "slug": doc["slug"], "public_id": doc["public_id"],
                "name": view_doc.get("review_name") or view_doc["name"],
                "description": view_doc.get("review_description") or "",
                "app_icon_url": view_doc.get("review_logo_url") or view_doc.get("app_icon_url") or "",
                "price_cents": price_cents,
                "requires_purchase": True,
            }

    result = _serialize(view_doc, full=True)
    result["requires_purchase"] = False
    # Staff/"house" apps (no owner) never show the free-tier watermark —
    # only self-service apps built by a non-Vakar+ user do.
    if doc.get("user_id"):
        owner = await db.users.find_one({"_id": doc["user_id"]}, {"vakar_plus_status": 1})
        result["owner_is_vakar_plus"] = bool(owner and owner.get("vakar_plus_status") == "active")
    else:
        result["owner_is_vakar_plus"] = True
    return result

@router.post("/apps/{app_id}/checkout")
@limiter.limit("10/minute")
async def create_studio_app_checkout(request: Request, app_id: str, user=Depends(get_current_user)):
    """Buy access to a paid app. Fulfillment (recording the purchase, crediting
    the creator's share, notifying both sides) happens in the Stripe webhook —
    see routers/shop.py's checkout_type == "studio_app_purchase" branch, the
    same split-fulfillment pattern already used for Vakar+ subscriptions."""
    common_filter = {
        "status": "published", "ever_approved": True, "visibility": "public",
        "admin_takedown": {"$ne": True},
    }
    doc = await db.studio_apps.find_one({"public_id": app_id, **common_filter}) or await db.studio_apps.find_one({"slug": app_id, **common_filter})
    if not doc or not doc.get("user_id"):
        raise HTTPException(status_code=404, detail="App not found")
    await _ensure_public_id(doc)
    # Always sell exactly what's currently live (the approved snapshot), not
    # whatever price/listing the owner might be mid-editing in their draft.
    view_doc = _apply_snapshot(doc, doc.get("published_snapshot"))
    price_cents = view_doc.get("price_cents", 0)
    if price_cents <= 0:
        raise HTTPException(status_code=400, detail="This app is free")
    if str(doc["user_id"]) == user["id"]:
        raise HTTPException(status_code=400, detail="You already own this app")
    if await db.studio_app_purchases.find_one({"app_id": doc["_id"], "email": user["email"]}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="You already own this app")

    origin = _get_origin(request)
    app_name = view_doc.get("review_name") or view_doc["name"]
    images = [view_doc["review_logo_url"]] if (view_doc.get("review_logo_url") or "").startswith("http") else []

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": app_name, "description": view_doc.get("review_description") or "", "images": images},
                    "unit_amount": price_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/apps/{doc['public_id']}?purchased=1",
            cancel_url=f"{origin}/apps/{doc['public_id']}",
            metadata={
                "checkout_type": "studio_app_purchase",
                "app_id": str(doc["_id"]),
                "app_public_id": doc["public_id"],
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
