import uuid
from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from ..database import db
from ..config import UPLOADS_DIR
from ..deps import require_permission, get_current_user
from ..utils import slugify, log_action, _validate_file, _IMAGE_MIMES, _AUDIO_MIMES
from ..schemas import VakarBlockCreateRequest, VakarBlockUpdateRequest

router = APIRouter()

# ============================================================
# VAKAR BLOCK — a second, Scratch-style visual editor, deliberately
# separate from the Studio App Builder (studio_apps.py): sprites with
# costumes on a resizable stage, scripted with Blockly (drag-and-snap
# blocks) rather than the App Builder's screens/components/actions model.
# Same ownership split as studio_apps: `user_id` null = staff/house
# project (built via /admin/vakar-block-projects), set = self-service
# (via /my/vakar-block-projects, quota'd by is_vakar_plus).
#
# Round 1 scope, deliberately: editor + player only — no public runtime
# route, no submit-for-review/publish workflow, no Stripe wiring. That's
# the same review/publish machinery studio_apps.py already has; wiring
# Vakar Block into it is a distinct future round once the editor itself
# is proven, not bundled in here.
# ============================================================

FREE_MAX_BLOCK_PROJECTS = 2
PLUS_MAX_BLOCK_PROJECTS = 20
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_SOUND_EXTS = {".mp3", ".wav", ".ogg"}

DEFAULT_STAGE = {"width": 480, "height": 360, "backdrops": [], "current_backdrop_id": None}


def _new_sprite_id() -> str:
    return uuid.uuid4().hex[:8]


def _default_sprite() -> dict:
    return {
        "id": _new_sprite_id(), "name": "Sprite1",
        "x": 0, "y": 0, "direction": 90, "size": 100, "visible": True,
        "costumes": [], "current_costume_id": None, "sounds": [], "workspace": None,
    }


async def _unique_slug(base_slug: str) -> str:
    slug = base_slug
    n = 1
    while True:
        if not await db.vakar_block_projects.find_one({"slug": slug}):
            return slug
        n += 1
        slug = f"{base_slug}-{n}"


async def _unique_public_id() -> str:
    while True:
        pid = uuid.uuid4().hex[:12]
        if not await db.vakar_block_projects.find_one({"public_id": pid}, {"_id": 1}):
            return pid


def _serialize(doc, include_owner=False):
    result = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "public_id": doc.get("public_id") or "",
        "stage": doc.get("stage") or DEFAULT_STAGE,
        "sprites": doc.get("sprites") or [],
        "variables": doc.get("variables") or [],
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat(),
    }
    if include_owner:
        result["owner"] = doc.get("created_by", "")
        result["is_user_app"] = doc.get("user_id") is not None
    return result


def _new_doc(name: str, slug: str, public_id: str, user_id, username: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "name": name, "slug": slug, "public_id": public_id,
        "stage": dict(DEFAULT_STAGE),
        "sprites": [_default_sprite()],
        "variables": [],
        "created_at": now, "updated_at": now,
        "created_by": username, "user_id": user_id,
    }


async def _read_validated_asset(file: UploadFile):
    """Costume/backdrop images or sprite sounds — same upload endpoint,
    dispatched by extension to the right MIME validation table."""
    ext = Path(file.filename).suffix.lower()
    if ext in ALLOWED_IMAGE_EXTS:
        mime_table = _IMAGE_MIMES
    elif ext in ALLOWED_SOUND_EXTS:
        mime_table = _AUDIO_MIMES
    else:
        raise HTTPException(status_code=400, detail="Fichiers autorisés : images (jpg, png, gif, webp) ou sons (mp3, wav, ogg).")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 5 MB per file.")
    content = _validate_file(content, ext, mime_table)
    return content, ext


def _write_asset_file(content: bytes, ext: str) -> str:
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(UPLOADS_DIR / filename, "wb") as f:
        f.write(content)
    return f"/api/uploads/{filename}"


# ============================================================
# ADMIN — staff-owned "house" projects, unquota'd. Same moderation-surface
# reasoning as studio_apps.py's admin list (one collection, staff can see
# everything) — not built out further this round since there's no
# public/review surface yet to moderate.
# ============================================================

@router.get("/admin/vakar-block-projects")
async def list_vakar_block_projects(user=Depends(require_permission("manage_vakar_block"))):
    docs = await db.vakar_block_projects.find().sort("updated_at", -1).to_list(500)
    return {"projects": [_serialize(d, include_owner=True) for d in docs]}

@router.post("/admin/vakar-block-projects")
async def create_vakar_block_project(body: VakarBlockCreateRequest, user=Depends(require_permission("manage_vakar_block"))):
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    slug = await _unique_slug(slugify(body.slug or name) or "project")
    public_id = await _unique_public_id()
    doc = _new_doc(name, slug, public_id, None, user["username"])
    result = await db.vakar_block_projects.insert_one(doc)
    await log_action("vakar_block", f"Project '{name}' created", user=user["username"])
    return {"id": str(result.inserted_id), "slug": slug}

@router.get("/admin/vakar-block-projects/{project_id}")
async def get_vakar_block_project(project_id: str, user=Depends(require_permission("manage_vakar_block"))):
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.vakar_block_projects.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return _serialize(doc)

@router.put("/admin/vakar-block-projects/{project_id}")
async def update_vakar_block_project(project_id: str, body: VakarBlockUpdateRequest, user=Depends(require_permission("manage_vakar_block"))):
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "name" in update:
        update["name"] = update["name"].strip()[:80] or "Untitled project"
    if not update:
        return {"ok": True}
    update["updated_at"] = datetime.now(timezone.utc)
    result = await db.vakar_block_projects.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}

@router.delete("/admin/vakar-block-projects/{project_id}")
async def delete_vakar_block_project(project_id: str, user=Depends(require_permission("manage_vakar_block"))):
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.vakar_block_projects.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}

@router.post("/admin/vakar-block-projects/{project_id}/asset")
async def upload_vakar_block_admin_asset(project_id: str, file: UploadFile = File(...), user=Depends(require_permission("manage_vakar_block"))):
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    if not await db.vakar_block_projects.find_one({"_id": oid}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Project not found")
    content, ext = await _read_validated_asset(file)
    return {"url": _write_asset_file(content, ext)}


# ============================================================
# SELF-SERVICE — public "My Vakar Block" projects, quota'd by is_vakar_plus,
# same shape as studio_apps.py's /my/studio-apps.
# ============================================================

async def _get_owned_project(project_id: str, user):
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.vakar_block_projects.find_one({"_id": oid})
    if not doc or str(doc.get("user_id")) != user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    return oid, doc

@router.get("/my/vakar-block-projects")
async def list_my_vakar_block_projects(user=Depends(get_current_user)):
    docs = await db.vakar_block_projects.find({"user_id": ObjectId(user["id"])}).sort("updated_at", -1).to_list(100)
    max_projects = PLUS_MAX_BLOCK_PROJECTS if user.get("is_vakar_plus") else FREE_MAX_BLOCK_PROJECTS
    return {
        "projects": [_serialize(d) for d in docs],
        "quota": {"used": len(docs), "max": max_projects, "is_vakar_plus": user.get("is_vakar_plus", False)},
    }

@router.post("/my/vakar-block-projects")
async def create_my_vakar_block_project(body: VakarBlockCreateRequest, user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    max_projects = PLUS_MAX_BLOCK_PROJECTS if user.get("is_vakar_plus") else FREE_MAX_BLOCK_PROJECTS
    existing_count = await db.vakar_block_projects.count_documents({"user_id": uid})
    if existing_count >= max_projects:
        raise HTTPException(status_code=402, detail=f"You've reached your project limit ({max_projects}). Upgrade to Vakar+ for more.")
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    slug = await _unique_slug(slugify(body.slug or name) or "project")
    public_id = await _unique_public_id()
    doc = _new_doc(name, slug, public_id, uid, user["username"])
    result = await db.vakar_block_projects.insert_one(doc)
    return {"id": str(result.inserted_id), "slug": slug}

@router.get("/my/vakar-block-projects/{project_id}")
async def get_my_vakar_block_project(project_id: str, user=Depends(get_current_user)):
    _oid, doc = await _get_owned_project(project_id, user)
    return _serialize(doc)

@router.put("/my/vakar-block-projects/{project_id}")
async def update_my_vakar_block_project(project_id: str, body: VakarBlockUpdateRequest, user=Depends(get_current_user)):
    oid, _doc = await _get_owned_project(project_id, user)
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "name" in update:
        update["name"] = update["name"].strip()[:80] or "Untitled project"
    if not update:
        return {"ok": True}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.vakar_block_projects.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}

@router.delete("/my/vakar-block-projects/{project_id}")
async def delete_my_vakar_block_project(project_id: str, user=Depends(get_current_user)):
    oid, _doc = await _get_owned_project(project_id, user)
    await db.vakar_block_projects.delete_one({"_id": oid})
    return {"ok": True}

@router.post("/my/vakar-block-projects/{project_id}/asset")
async def upload_my_vakar_block_asset(project_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    """Costume/backdrop image upload — no storage-quota check this round
    (studio_apps.py's app/screen-image quota was a deliberate later
    addition there too; kept out of Vakar Block's round-1 scope, same as
    the rest of the review/paywall machinery)."""
    await _get_owned_project(project_id, user)
    content, ext = await _read_validated_asset(file)
    return {"url": _write_asset_file(content, ext)}
