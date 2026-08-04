import logging
import secrets
import uuid
from datetime import datetime, timezone

import aiohttp
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request

from ..config import (
    UPLOADS_DIR, BACKEND_PUBLIC_URL, GITHUB_PAT, GITHUB_REPO, GITHUB_WORKFLOW_FILE, GITHUB_WORKFLOW_REF,
)
from ..database import db
from ..deps import get_current_user
from ..utils import _FORMAT_MAGIC_BYTES
from ..rate_limit import limiter
from ..schemas import ApkBuildTriggerRequest
from .studio_apps import _default_package_id

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================
# APK EXPORT (Phase E) — deliberately off the production VPS: the trigger
# endpoint asks a GitHub Actions workflow in this repo (.github/workflows/
# build-apk.yml) to wrap the app's exported HTML/CSS/JS bundle (produced
# client-side by frontend/src/utils/exportApp.js — reused, not
# reimplemented) with Capacitor and run a debug Gradle build on a
# GitHub-hosted runner. The runner POSTs the finished (unsigned, debug-only)
# APK back to the /internal/apk-builds/{id}/callback endpoint below, which
# is NOT JWT-gated (GitHub Actions has no user session) — it's gated by a
# random per-build token instead, generated at trigger time and never
# reused. NOT Vakar+-gated (unlike premium components/themes/export) — the
# user didn't ask for that when scoping Vakar+ gating, only rate-limited to
# bound CI usage.
# ============================================================

MAX_BUNDLE_SIZE = 5 * 1024 * 1024   # a static HTML/CSS/JS export is tiny
MAX_APK_SIZE = 80 * 1024 * 1024     # generous ceiling for a debug APK


async def _get_owned_app_doc(app_id: str, user):
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or str(doc.get("user_id")) != user["id"]:
        raise HTTPException(status_code=404, detail="App not found")
    return doc


@router.post("/my/studio-apps/{app_id}/apk-bundle")
@limiter.limit("20/hour")
async def upload_apk_bundle(request: Request, app_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    """Stashes the client-generated export .zip somewhere the (external,
    unauthenticated-to-us) GitHub Actions runner can fetch it by URL."""
    await _get_owned_app_doc(app_id, user)
    content = await file.read()
    if len(content) > MAX_BUNDLE_SIZE:
        raise HTTPException(status_code=413, detail="Bundle too large")
    checker = _FORMAT_MAGIC_BYTES.get(".zip")
    if not checker or not checker(content):
        raise HTTPException(status_code=400, detail="Expected a ZIP bundle")
    filename = f"{uuid.uuid4().hex}.zip"
    with open(UPLOADS_DIR / filename, "wb") as f:
        f.write(content)
    return {"url": f"/api/uploads/{filename}"}


@router.post("/my/studio-apps/{app_id}/build-apk")
@limiter.limit("5/hour")
async def trigger_apk_build(request: Request, app_id: str, body: ApkBuildTriggerRequest, user=Depends(get_current_user)):
    if not GITHUB_PAT or not BACKEND_PUBLIC_URL:
        raise HTTPException(status_code=503, detail="APK builds aren't configured yet.")
    doc = await _get_owned_app_doc(app_id, user)

    callback_token = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    result = await db.apk_builds.insert_one({
        "app_id": doc["_id"],
        "user_id": ObjectId(user["id"]),
        "status": "queued",
        "apk_url": None,
        "error": None,
        "callback_token": callback_token,
        "created_at": now,
        "updated_at": now,
    })
    build_id = str(result.inserted_id)

    bundle_url = body.bundle_url if body.bundle_url.startswith("http") else f"{BACKEND_PUBLIC_URL}{body.bundle_url}"
    callback_url = f"{BACKEND_PUBLIC_URL}/api/internal/apk-builds/{build_id}/callback"
    icon_url = doc.get("app_icon_url") or ""
    payload = {
        "ref": GITHUB_WORKFLOW_REF,
        "inputs": {
            "build_id": build_id,
            "bundle_url": bundle_url,
            "callback_url": callback_url,
            "callback_token": callback_token,
            "app_name": (doc.get("app_display_name") or doc.get("name") or "Studio App")[:50],
            "package_id": doc.get("package_id") or _default_package_id(doc),
            "min_sdk": str(doc.get("min_sdk") or 22),
            "target_sdk": str(doc.get("target_sdk") or 34),
            "icon_url": icon_url if icon_url.startswith("http") else (f"{BACKEND_PUBLIC_URL}{icon_url}" if icon_url else ""),
        },
    }
    headers = {
        "Authorization": f"Bearer {GITHUB_PAT}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/{GITHUB_WORKFLOW_FILE}/dispatches"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status not in (200, 204):
                    body = await resp.text()
                    logger.error(
                        "GitHub workflow_dispatch failed: status=%s repo=%s workflow=%s ref=%s body=%s",
                        resp.status, GITHUB_REPO, GITHUB_WORKFLOW_FILE, GITHUB_WORKFLOW_REF, body[:500],
                    )
                    await db.apk_builds.update_one({"_id": result.inserted_id}, {"$set": {"status": "failed", "error": "Could not start the build."}})
                    raise HTTPException(status_code=502, detail="Could not start the build. Please try again later.")
    except HTTPException:
        raise
    except aiohttp.ClientError as e:
        logger.error("GitHub workflow_dispatch request error: %s", e)
        await db.apk_builds.update_one({"_id": result.inserted_id}, {"$set": {"status": "failed", "error": "Could not reach the build service."}})
        raise HTTPException(status_code=502, detail="Could not reach the build service.")

    await db.apk_builds.update_one({"_id": result.inserted_id}, {"$set": {"status": "building", "updated_at": datetime.now(timezone.utc)}})
    return {"build_id": build_id}


@router.get("/my/studio-apps/{app_id}/build-apk/latest")
async def get_latest_apk_build(app_id: str, user=Depends(get_current_user)):
    doc = await _get_owned_app_doc(app_id, user)
    build = await db.apk_builds.find_one({"app_id": doc["_id"]}, sort=[("created_at", -1)])
    if not build:
        return {"build": None}
    return {"build": {
        "id": str(build["_id"]),
        "status": build.get("status"),
        "apk_url": build.get("apk_url"),
        "error": build.get("error"),
        "created_at": build["created_at"].isoformat(),
    }}


@router.post("/internal/apk-builds/{build_id}/callback")
async def apk_build_callback(
    build_id: str,
    callback_token: str = Form(...),
    status: str = Form(...),
    error: str = Form(None),
    apk: UploadFile = File(None),
):
    """Called by the GitHub Actions runner, not a logged-in user — auth is
    the one-time callback_token generated in trigger_apk_build above, never
    a JWT (the runner has no Vakar Games session)."""
    try:
        oid = ObjectId(build_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build ID")
    build = await db.apk_builds.find_one({"_id": oid})
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    if not secrets.compare_digest(callback_token, build.get("callback_token", "")):
        raise HTTPException(status_code=403, detail="Invalid callback token")

    update = {"updated_at": datetime.now(timezone.utc)}
    if status == "ready" and apk is not None:
        content = await apk.read()
        if len(content) > MAX_APK_SIZE:
            raise HTTPException(status_code=413, detail="APK too large")
        checker = _FORMAT_MAGIC_BYTES.get(".apk")
        if not checker or not checker(content):
            update.update({"status": "failed", "error": "Build service returned an invalid file."})
        else:
            filename = f"{uuid.uuid4().hex}.apk"
            with open(UPLOADS_DIR / filename, "wb") as f:
                f.write(content)
            update.update({"status": "ready", "apk_url": f"/api/uploads/{filename}"})
    else:
        update.update({"status": "failed", "error": (error or "Build failed.")[:300]})

    await db.apk_builds.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}
