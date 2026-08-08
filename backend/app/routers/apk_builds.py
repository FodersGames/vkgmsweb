import base64
import json
import logging
import secrets
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import aiohttp
from bson import ObjectId
from cryptography import x509
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form

from ..config import (
    UPLOADS_DIR, BACKEND_PUBLIC_URL, GITHUB_PAT, GITHUB_REPO, GITHUB_WORKFLOW_FILE, GITHUB_WORKFLOW_REF,
    STUDIO_SIGNING_KEY,
)
from ..database import db
from ..deps import get_current_user
from ..utils import _FORMAT_MAGIC_BYTES
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
# reused. NOT Vakar+-gated (unlike premium components/themes/export), and
# deliberately not rate-limited either (owner wants an MIT-App-Inventor-like
# "build as often as you want" experience) — only the per-file size caps
# below still apply.
#
# AAB (Google Play) export reuses the exact same workflow run: pass
# build_aab=true and it additionally produces a *signed* .aab, using a
# per-app PKCS12 keystore (see SIGNING KEYS below). NOTE: this repo is
# PUBLIC — workflow_dispatch inputs are visible forever in the Actions run
# history to anyone, so signing material is never put in an input directly.
# It's fetched by the runner from a one-time unguessable URL and masked in
# the workflow the instant it's read. Unlike the debug APK path, this AAB
# signing path has NOT been verified on a real dispatch yet — watch the
# first real run closely.
# ============================================================

MAX_BUNDLE_SIZE = 5 * 1024 * 1024   # a static HTML/CSS/JS export is tiny
MAX_APK_SIZE = 80 * 1024 * 1024     # generous ceiling for a debug APK
MAX_AAB_SIZE = 80 * 1024 * 1024
MAX_KEYSTORE_UPLOAD_SIZE = 64 * 1024


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
async def upload_apk_bundle(app_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
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


# ============================================================
# SIGNING KEYS (Google Play .aab export) — one PKCS12 keystore per app.
# By default one is generated automatically the first time an .aab build is
# requested; the owner can instead import their own (e.g. an existing Play
# Console upload key) or download the generated one as a backup. Stored
# Fernet-encrypted (config.STUDIO_SIGNING_KEY, same derivation pattern as
# the existing .vakarstudio export encryption) in its own collection —
# never logged, never returned to the frontend except via the explicit
# "download my key" backup endpoint. Losing this key (and not having a
# backup) means never being able to push another Play Store update under it
# again, so it is NEVER silently regenerated/overwritten — the owner has to
# explicitly delete it first.
# ============================================================

def _generate_pkcs12_keystore(app_name: str) -> dict:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name_attrs = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, (app_name or "Vakar Studio App")[:64]),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Vakar Games"),
    ])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name_attrs)
        .issuer_name(name_attrs)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=365 * 30))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    password = secrets.token_urlsafe(18)
    alias = "upload"
    p12 = pkcs12.serialize_key_and_certificates(
        name=alias.encode(), key=key, cert=cert, cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode()),
    )
    fingerprint = cert.fingerprint(hashes.SHA256()).hex(":").upper()
    return {
        "keystore_b64": base64.b64encode(p12).decode(),
        "store_password": password, "key_password": password, "key_alias": alias,
        "fingerprint": fingerprint,
    }


def _encrypt_signing_material(material: dict) -> bytes:
    return Fernet(STUDIO_SIGNING_KEY).encrypt(json.dumps(material).encode())


def _decrypt_signing_material(blob) -> dict:
    return json.loads(Fernet(STUDIO_SIGNING_KEY).decrypt(bytes(blob)))


async def _get_or_create_signing_key(app_doc) -> dict:
    rec = await db.studio_signing_keys.find_one({"app_id": app_doc["_id"]})
    if rec:
        return _decrypt_signing_material(rec["enc"])
    material = _generate_pkcs12_keystore(app_doc.get("app_display_name") or app_doc.get("name") or "Vakar Studio App")
    await db.studio_signing_keys.insert_one({
        "app_id": app_doc["_id"], "enc": _encrypt_signing_material(material),
        "source": "generated", "fingerprint": material["fingerprint"],
        "created_at": datetime.now(timezone.utc),
    })
    return material


@router.get("/my/studio-apps/{app_id}/signing-key")
async def get_signing_key_info(app_id: str, user=Depends(get_current_user)):
    doc = await _get_owned_app_doc(app_id, user)
    rec = await db.studio_signing_keys.find_one({"app_id": doc["_id"]})
    if not rec:
        return {"exists": False}
    return {
        "exists": True, "source": rec.get("source", "generated"),
        "fingerprint": rec.get("fingerprint", ""), "created_at": rec["created_at"].isoformat(),
    }


@router.post("/my/studio-apps/{app_id}/signing-key/generate")
async def generate_signing_key(app_id: str, user=Depends(get_current_user)):
    doc = await _get_owned_app_doc(app_id, user)
    if await db.studio_signing_keys.find_one({"app_id": doc["_id"]}):
        raise HTTPException(status_code=400, detail="This app already has a signing key. Delete it first if you want to replace it.")
    material = await _get_or_create_signing_key(doc)
    return {"exists": True, "source": "generated", "fingerprint": material["fingerprint"]}


@router.post("/my/studio-apps/{app_id}/signing-key/import")
async def import_signing_key(
    app_id: str,
    store_password: str = Form(...),
    key_password: str = Form(...),
    key_alias: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    doc = await _get_owned_app_doc(app_id, user)
    content = await file.read()
    if len(content) > MAX_KEYSTORE_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Keystore file too large.")
    try:
        loaded_key, loaded_cert, _extra = pkcs12.load_key_and_certificates(content, key_password.encode() or None)
        if loaded_key is None or loaded_cert is None:
            raise ValueError("missing key or certificate")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this keystore. It must be a PKCS12 file (.p12/.pfx) and the key password must be "
                   "correct. Legacy .jks files aren't supported yet — convert one first with: keytool -importkeystore "
                   "-srckeystore old.jks -destkeystore new.p12 -deststoretype PKCS12",
        )
    fingerprint = loaded_cert.fingerprint(hashes.SHA256()).hex(":").upper()
    material = {
        "keystore_b64": base64.b64encode(content).decode(),
        "store_password": store_password, "key_password": key_password, "key_alias": key_alias,
        "fingerprint": fingerprint,
    }
    await db.studio_signing_keys.delete_one({"app_id": doc["_id"]})
    await db.studio_signing_keys.insert_one({
        "app_id": doc["_id"], "enc": _encrypt_signing_material(material),
        "source": "imported", "fingerprint": fingerprint,
        "created_at": datetime.now(timezone.utc),
    })
    return {"exists": True, "source": "imported", "fingerprint": fingerprint}


@router.get("/my/studio-apps/{app_id}/signing-key/download")
async def download_signing_key(app_id: str, user=Depends(get_current_user)):
    """One-time backup export — returns the raw keystore + passwords. The
    owner is expected to store this somewhere safe themselves; we don't
    keep a second copy anywhere outside the encrypted DB record."""
    doc = await _get_owned_app_doc(app_id, user)
    rec = await db.studio_signing_keys.find_one({"app_id": doc["_id"]})
    if not rec:
        raise HTTPException(status_code=404, detail="This app has no signing key yet.")
    material = _decrypt_signing_material(rec["enc"])
    return {
        "keystore_b64": material["keystore_b64"],
        "store_password": material["store_password"],
        "key_password": material["key_password"],
        "key_alias": material["key_alias"],
        "filename": f"{doc.get('slug') or app_id}-upload-key.p12",
    }


@router.delete("/my/studio-apps/{app_id}/signing-key")
async def delete_signing_key(app_id: str, user=Depends(get_current_user)):
    doc = await _get_owned_app_doc(app_id, user)
    await db.studio_signing_keys.delete_one({"app_id": doc["_id"]})
    return {"ok": True}


async def _cleanup_upload_later(filename: str, delay_seconds: int = 1200):
    """Best-effort deletion of the transient signing-material file some
    time after it was published for the runner to fetch. The workflow
    itself times out (15 min) well before this fires, so by then the runner
    has either already fetched it or the build has already failed."""
    await asyncio.sleep(delay_seconds)
    try:
        (UPLOADS_DIR / filename).unlink(missing_ok=True)
    except Exception:
        pass


@router.post("/my/studio-apps/{app_id}/build-apk")
async def trigger_apk_build(app_id: str, body: ApkBuildTriggerRequest, user=Depends(get_current_user)):
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
        "aab_url": None,
        "error": None,
        "callback_token": callback_token,
        "created_at": now,
        "updated_at": now,
    })
    build_id = str(result.inserted_id)

    bundle_url = body.bundle_url if body.bundle_url.startswith("http") else f"{BACKEND_PUBLIC_URL}{body.bundle_url}"
    callback_url = f"{BACKEND_PUBLIC_URL}/api/internal/apk-builds/{build_id}/callback"
    icon_url = doc.get("app_icon_url") or ""
    inputs = {
        "build_id": build_id,
        "bundle_url": bundle_url,
        "callback_url": callback_url,
        "callback_token": callback_token,
        "app_name": (doc.get("app_display_name") or doc.get("name") or "Studio App")[:50],
        "package_id": doc.get("package_id") or _default_package_id(doc),
        "min_sdk": str(doc.get("min_sdk") or 22),
        "target_sdk": str(doc.get("target_sdk") or 34),
        "version_code": str(doc.get("version_code") or 1),
        "version_name": doc.get("version_name") or "1.0",
        "icon_url": icon_url if icon_url.startswith("http") else (f"{BACKEND_PUBLIC_URL}{icon_url}" if icon_url else ""),
        "build_aab": "false",
    }

    signing_filename = None
    if body.build_aab:
        material = await _get_or_create_signing_key(doc)
        signing_filename = f"{uuid.uuid4().hex}.json"
        with open(UPLOADS_DIR / signing_filename, "w") as f:
            json.dump({
                "keystore_b64": material["keystore_b64"],
                "store_password": material["store_password"],
                "key_password": material["key_password"],
                "key_alias": material["key_alias"],
            }, f)
        inputs["build_aab"] = "true"
        inputs["signing_url"] = f"{BACKEND_PUBLIC_URL}/api/uploads/{signing_filename}"

    payload = {"ref": GITHUB_WORKFLOW_REF, "inputs": inputs}
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
                    resp_body = await resp.text()
                    logger.error(
                        "GitHub workflow_dispatch failed: status=%s repo=%s workflow=%s ref=%s body=%s",
                        resp.status, GITHUB_REPO, GITHUB_WORKFLOW_FILE, GITHUB_WORKFLOW_REF, resp_body[:500],
                    )
                    await db.apk_builds.update_one({"_id": result.inserted_id}, {"$set": {"status": "failed", "error": "Could not start the build."}})
                    raise HTTPException(status_code=502, detail="Could not start the build. Please try again later.")
    except HTTPException:
        raise
    except aiohttp.ClientError as e:
        logger.error("GitHub workflow_dispatch request error: %s", e)
        await db.apk_builds.update_one({"_id": result.inserted_id}, {"$set": {"status": "failed", "error": "Could not reach the build service."}})
        raise HTTPException(status_code=502, detail="Could not reach the build service.")
    finally:
        if signing_filename:
            asyncio.create_task(_cleanup_upload_later(signing_filename))

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
        "aab_url": build.get("aab_url"),
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
    aab: UploadFile = File(None),
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

    if status == "ready" and aab is not None:
        content = await aab.read()
        checker = _FORMAT_MAGIC_BYTES.get(".aab")
        if len(content) <= MAX_AAB_SIZE and checker and checker(content):
            filename = f"{uuid.uuid4().hex}.aab"
            with open(UPLOADS_DIR / filename, "wb") as f:
                f.write(content)
            update["aab_url"] = f"/api/uploads/{filename}"

    await db.apk_builds.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}
