import os
import re
import io
import json
import shutil
import secrets
import zipfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, Response

from ..config import GAME_FILES_DIR
from ..database import db
from ..deps import require_permission, require_any_of
from ..utils import serialize_doc, log_action, _sanitize_svg
from ..schemas import GameFileUpdateRequest, VersionCloneRequest, LiveVersionRequest

router = APIRouter()

# ── Game files ───────────────────────────────────────────────────────────────

_GAME_FILE_EXTS = {
    ".zip", ".rar", ".7z",
    ".exe", ".msi", ".dmg", ".pkg",
    ".apk", ".ipa",
    ".pak", ".dat", ".bin", ".unity3d",
    ".json", ".xml", ".yaml", ".toml", ".cfg", ".ini",
    ".js", ".ts",
    ".svg", ".png", ".jpg", ".jpeg", ".webp",
    ".pdf",
    ".mp4", ".mov",
    ".mp3", ".wav", ".ogg",
}
_PREVIEW_TYPES = {
    ".svg":  "image/svg+xml",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp3":  "audio/mpeg",
    ".wav":  "audio/wav",
    ".ogg":  "audio/ogg",
}
_AUDIO_EXTS = {".mp3", ".wav", ".ogg"}
_GAME_FILE_MAX_BYTES = 500 * 1024 * 1024  # 500 MB

async def _verify_files_api_key(project_slug: str, request: Request):
    api_key = request.headers.get("X-Files-Api-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-Files-Api-Key header")
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    stored = project.get("files_api_key") or ""
    if not stored or not secrets.compare_digest(stored, api_key):
        raise HTTPException(status_code=403, detail="Invalid API key")
    return project

def _game_file_path(project_slug: str, file_id: str) -> Path:
    project_dir = GAME_FILES_DIR / project_slug
    project_dir.mkdir(exist_ok=True)
    return project_dir / file_id  # stored without extension; original name in Content-Disposition

# ── Admin: get / regenerate files API key ────────────────────────────────────

@router.get("/admin/projects/{slug}/files-api-key")
async def get_files_api_key(slug: str, user=Depends(require_permission("manage_files"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"files_api_key": project.get("files_api_key") or None}

@router.post("/admin/projects/{slug}/files-api-key/regenerate")
async def regenerate_files_api_key(slug: str, user=Depends(require_permission("manage_files"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    new_key = secrets.token_urlsafe(32)
    await db.projects.update_one({"slug": slug}, {"$set": {"files_api_key": new_key}})
    await log_action("files", f"Files API key regenerated", project_slug=slug, user=user["username"])
    return {"files_api_key": new_key}

# ── Admin: upload file ────────────────────────────────────────────────────────

@router.post("/admin/projects/{slug}/files")
async def upload_game_file(
    slug: str,
    file: UploadFile = File(...),
    name: str = Form(""),
    version: str = Form(""),
    platform: str = Form("all"),
    file_type: str = Form("build"),
    description: str = Form(""),
    version_tag: str = Form("1.0"),
    rotation_center_x: Optional[float] = Form(None),
    rotation_center_y: Optional[float] = Form(None),
    group_id: Optional[str] = Form(None),
    group_name: Optional[str] = Form(None),
    user=Depends(require_permission("manage_files")),
):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = Path(file.filename or "").suffix.lower()

    content = await file.read()
    if len(content) > _GAME_FILE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 500 MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # ── .sprite3 import : extract all costumes into the text engine group ──────
    if ext == '.sprite3':
        gid_s3 = (group_id or "").strip()
        if file_type != 'text_engine' or not gid_s3:
            raise HTTPException(status_code=400, detail="Les fichiers .sprite3 ne peuvent être importés que dans un groupe Text Engine")
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                sprite_data = json.loads(zf.read('sprite.json').decode('utf-8'))
                costumes = sprite_data.get('costumes', [])
                if not costumes:
                    raise HTTPException(status_code=400, detail="Aucun costume trouvé dans ce sprite")

                now = datetime.now(timezone.utc)
                gname = (group_name or "").strip() or sprite_data.get('name', '')
                created_docs, replaced_docs = [], []

                for costume in costumes:
                    md5ext       = costume.get('md5ext', '')
                    costume_name = costume.get('name', '') or Path(md5ext).stem
                    rot_x        = costume.get('rotationCenterX')
                    rot_y        = costume.get('rotationCenterY')
                    c_ext        = Path(md5ext).suffix.lower()

                    if c_ext not in ('.svg', '.png', '.jpg', '.jpeg', '.webp'):
                        continue
                    try:
                        costume_bytes = zf.read(md5ext)
                    except KeyError:
                        continue

                    if c_ext == '.svg':
                        try:
                            costume_bytes = _sanitize_svg(costume_bytes)
                        except ValueError:
                            continue  # costume SVG invalide → ignoré silencieusement

                    existing = await db.game_files.find_one({
                        "project_slug": slug, "group_id": gid_s3, "name": costume_name
                    })
                    if existing:
                        dest = _game_file_path(slug, str(existing["_id"]))
                        with open(dest, "wb") as f:
                            f.write(costume_bytes)
                        upd = {"original_filename": md5ext, "size_bytes": len(costume_bytes),
                               "uploaded_at": now, "updated_at": now,
                               "rotation_center_x": rot_x, "rotation_center_y": rot_y,
                               "group_name": gname}
                        await db.game_files.update_one({"_id": existing["_id"]}, {"$set": upd})
                        replaced_docs.append(str(existing["_id"]))
                    else:
                        fid = ObjectId()
                        dest = _game_file_path(slug, str(fid))
                        with open(dest, "wb") as f:
                            f.write(costume_bytes)
                        doc = {
                            "_id": fid, "project_slug": slug,
                            "name": costume_name, "original_filename": md5ext,
                            "size_bytes": len(costume_bytes),
                            "version": "", "version_tag": version_tag.strip() or "default",
                            "platform": platform, "file_type": "text_engine",
                            "description": description.strip(), "is_latest": False,
                            "rotation_center_x": rot_x, "rotation_center_y": rot_y,
                            "group_id": gid_s3, "group_name": gname,
                            "download_count": 0, "uploaded_by": user["username"],
                            "uploaded_at": now, "updated_at": now,
                        }
                        await db.game_files.insert_one(doc)
                        created_docs.append(str(fid))

        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Fichier .sprite3 invalide (ZIP corrompu)")

        total = len(created_docs) + len(replaced_docs)
        await log_action("files", f"Sprite '{file.filename}' imported: {len(created_docs)} created, {len(replaced_docs)} replaced in group '{gid_s3}'", project_slug=slug, user=user["username"])
        return {"success": True, "sprite3": True, "created": len(created_docs), "replaced": len(replaced_docs), "count": total}

    if ext not in _GAME_FILE_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext or '(none)'}")

    # Sanitize SVG content before any write (covers main upload + text engine in-place replace)
    if ext == '.svg':
        try:
            content = _sanitize_svg(content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"SVG rejeté : {e}")

    display_name = name.strip() or Path(file.filename or "").stem or "Unnamed file"
    now = datetime.now(timezone.utc)

    # Text engine group: replace in place if a file with the same name already exists
    gid = group_id.strip() if group_id else None
    if file_type == "text_engine" and gid:
        existing = await db.game_files.find_one({
            "project_slug": slug,
            "group_id": gid,
            "name": display_name,
        })
        if existing:
            dest = _game_file_path(slug, str(existing["_id"]))
            with open(dest, "wb") as f:
                f.write(content)
            updates = {
                "original_filename": file.filename or existing["original_filename"],
                "size_bytes": len(content),
                "uploaded_at": now,
                "updated_at":  now,
            }
            if group_name:
                updates["group_name"] = group_name.strip()
            await db.game_files.update_one({"_id": existing["_id"]}, {"$set": updates})
            updated = await db.game_files.find_one({"_id": existing["_id"]})
            await log_action("files", f"Text engine file '{display_name}' replaced in group '{gid}'", project_slug=slug, user=user["username"])
            return {"success": True, "file": serialize_doc(updated), "replaced": True}

    file_id = ObjectId()
    file_id_hex = str(file_id)

    dest = _game_file_path(slug, file_id_hex)
    with open(dest, "wb") as f:
        f.write(content)

    doc = {
        "_id": file_id,
        "project_slug": slug,
        "name": display_name,
        "original_filename": file.filename or "",
        "size_bytes": len(content),
        "version": version.strip(),
        "version_tag": version_tag.strip() or "default",
        "platform": platform,
        "file_type": file_type,
        "description": description.strip(),
        "is_latest": False,
        "rotation_center_x": rotation_center_x,
        "rotation_center_y": rotation_center_y,
        "group_id":   gid,
        "group_name": group_name.strip() if group_name else None,
        "download_count": 0,
        "uploaded_by": user["username"],
        "uploaded_at": now,
        "updated_at":  now,
    }
    await db.game_files.insert_one(doc)
    await log_action("files", f"Game file '{display_name}' uploaded", project_slug=slug, user=user["username"])
    return {"success": True, "file": serialize_doc(doc)}

# ── Admin: replace file content (keeps same ID) ───────────────────────────────

@router.put("/admin/projects/{slug}/files/{file_id}/replace")
async def replace_game_file(
    slug: str,
    file_id: str,
    file: UploadFile = File(...),
    user=Depends(require_permission("manage_files")),
):
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    doc = await db.game_files.find_one({"_id": oid, "project_slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _GAME_FILE_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext or '(none)'}")

    content = await file.read()
    if len(content) > _GAME_FILE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 500 MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if ext == '.svg':
        try:
            content = _sanitize_svg(content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"SVG rejeté : {e}")

    dest = _game_file_path(slug, file_id)
    with open(dest, "wb") as f:
        f.write(content)

    now = datetime.now(timezone.utc)
    updates = {
        "original_filename": file.filename or doc["original_filename"],
        "size_bytes": len(content),
        "uploaded_by": user["username"],
        "uploaded_at": now,
        "updated_at":  now,
    }
    await db.game_files.update_one({"_id": oid}, {"$set": updates})
    await log_action("files", f"Game file '{doc['name']}' replaced", project_slug=slug, user=user["username"])
    updated = await db.game_files.find_one({"_id": oid})
    return {"success": True, "file": serialize_doc(updated)}

# ── Admin: update metadata ────────────────────────────────────────────────────

@router.put("/admin/projects/{slug}/files/{file_id}")
async def update_game_file_meta(
    slug: str,
    file_id: str,
    req: GameFileUpdateRequest,
    user=Depends(require_permission("manage_files")),
):
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    doc = await db.game_files.find_one({"_id": oid, "project_slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    _rot_fields = {"rotation_center_x", "rotation_center_y"}
    payload = req.dict()
    # rotation_center peut être 0.0 (valide) → garder si présent et numérique; ignorer string vide
    def _keep(k, v):
        if k in _rot_fields:
            return isinstance(v, (int, float))
        return v is not None
    updates = {k: v for k, v in payload.items() if _keep(k, v)}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.game_files.update_one({"_id": oid}, {"$set": updates})
    updated = await db.game_files.find_one({"_id": oid})
    return {"success": True, "file": serialize_doc(updated)}

# ── Admin: delete file ────────────────────────────────────────────────────────

@router.delete("/admin/projects/{slug}/files/{file_id}")
async def delete_game_file(slug: str, file_id: str, user=Depends(require_permission("manage_files"))):
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    doc = await db.game_files.find_one({"_id": oid, "project_slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    dest = _game_file_path(slug, file_id)
    if dest.exists():
        dest.unlink()
    await db.game_files.delete_one({"_id": oid})
    await log_action("files", f"Game file '{doc['name']}' deleted", project_slug=slug, user=user["username"])
    return {"success": True}

# ── Admin: delete entire text engine group ───────────────────────────────────

@router.delete("/admin/projects/{slug}/files/group/{group_id}")
async def delete_file_group(slug: str, group_id: str, user=Depends(require_permission("manage_files"))):
    docs = await db.game_files.find({"project_slug": slug, "group_id": group_id}).to_list(1000)
    if not docs:
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    for doc in docs:
        dest = _game_file_path(slug, str(doc["_id"]))
        if dest.exists():
            dest.unlink()
    await db.game_files.delete_many({"project_slug": slug, "group_id": group_id})
    await log_action("files", f"Text engine group '{group_id}' deleted ({len(docs)} files)", project_slug=slug, user=user["username"])
    return {"success": True, "deleted": len(docs)}

# ── Admin: preview image file ─────────────────────────────────────────────────

@router.get("/admin/projects/{slug}/files/{file_id}/preview")
async def preview_game_file_admin(slug: str, file_id: str, user=Depends(require_any_of("manage_files", "claim_missions"))):
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    doc = await db.game_files.find_one({"_id": oid, "project_slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    ext = Path(doc.get("original_filename", "")).suffix.lower()
    media_type = _PREVIEW_TYPES.get(ext)
    if not media_type:
        raise HTTPException(status_code=400, detail="Not a previewable file")
    dest = _game_file_path(slug, file_id)
    if not dest.exists():
        raise HTTPException(status_code=404, detail="File data missing on server")
    return FileResponse(dest, media_type=media_type)

@router.get("/admin/projects/{slug}/files/{file_id}/download")
async def download_game_file_admin(slug: str, file_id: str, user=Depends(require_any_of("manage_files", "claim_missions"))):
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    doc = await db.game_files.find_one({"_id": oid, "project_slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    dest = _game_file_path(slug, file_id)
    if not dest.exists():
        raise HTTPException(status_code=404, detail="File data missing on server")
    safe_name = re.sub(r"[^\w.\- ]", "_", doc.get("original_filename") or doc["name"])
    return FileResponse(
        dest,
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )

# ── Admin: list files ─────────────────────────────────────────────────────────

@router.get("/admin/projects/{slug}/files")
async def list_game_files_admin(
    slug: str,
    version_tag: Optional[str] = None,
    user=Depends(require_any_of("manage_files", "claim_missions")),
):
    query: dict = {"project_slug": slug}
    if version_tag:
        if version_tag == "default":
            query["$or"] = [{"version_tag": "default"}, {"version_tag": {"$exists": False}}]
        else:
            query["version_tag"] = version_tag
    files = await db.game_files.find(query).sort("uploaded_at", -1).to_list(500)
    return {"files": [serialize_doc(f) for f in files]}

# ── Game client: list files (API key auth) ────────────────────────────────────

@router.get("/game/{slug}/files")
async def list_game_files_client(slug: str, request: Request, version: Optional[str] = None):
    project = await _verify_files_api_key(slug, request)
    base_url = str(request.base_url).rstrip("/")

    # Resolve "live" version from project settings
    resolved_version = version
    if version == "live" or not version:
        resolved_version = project.get("live_version") or "default"

    query: dict = {"project_slug": slug}
    if resolved_version == "default":
        query["$or"] = [{"version_tag": "default"}, {"version_tag": {"$exists": False}}]
    else:
        query["version_tag"] = resolved_version

    files = await db.game_files.find(query).sort("uploaded_at", -1).to_list(500)
    result = []
    for f in files:
        doc = serialize_doc(f)
        # Stable asset ID — identical across all cloned versions of the asset
        asset_id = doc.get("stable_id") or doc["id"]
        doc["asset_id"] = asset_id
        doc["download_url"] = f"{base_url}/api/game/{slug}/files/{asset_id}/download?version={resolved_version}"
        doc["resolved_version"] = resolved_version
        result.append(doc)
    return {"files": result, "resolved_version": resolved_version}

# ── Game client: download file (API key auth) ─────────────────────────────────

@router.get("/game/{slug}/files/{file_id}/download")
async def download_game_file_client(slug: str, file_id: str, request: Request, version: Optional[str] = None):
    project = await _verify_files_api_key(slug, request)

    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    # Resolve target version ("live" or explicit ?version= param)
    resolved_version = version
    if version == "live" or not version:
        resolved_version = project.get("live_version") or "default"

    exact = await db.game_files.find_one({"_id": oid, "project_slug": slug})

    # Stable asset ID resolution: the requested ID identifies the asset across
    # all versions (clones share the original's ID via stable_id). Serve the
    # file belonging to the resolved version when a counterpart exists.
    stable = (exact.get("stable_id") if exact else None) or file_id
    stable_or = [{"stable_id": stable}]
    try:
        stable_or.append({"_id": ObjectId(stable)})
    except Exception:
        pass
    if resolved_version == "default":
        version_or = [{"version_tag": "default"}, {"version_tag": {"$exists": False}}]
    else:
        version_or = [{"version_tag": resolved_version}]

    doc = await db.game_files.find_one({
        "project_slug": slug,
        "$and": [{"$or": version_or}, {"$or": stable_or}],
    })
    if not doc:
        doc = exact  # no counterpart in the resolved version — serve the exact file
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    dest = _game_file_path(slug, str(doc["_id"]))
    if not dest.exists():
        raise HTTPException(status_code=404, detail="File data missing on server")
    await db.game_files.update_one({"_id": doc["_id"]}, {"$inc": {"download_count": 1}})
    safe_name = re.sub(r"[^\w.\- ]", "_", doc.get("original_filename") or doc["name"])
    return FileResponse(
        dest,
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )

# ── Game file versions ────────────────────────────────────────────────────────

@router.get("/admin/projects/{slug}/versions")
async def list_file_versions(slug: str, user=Depends(require_permission("manage_files"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    pipeline = [
        {"$match": {"project_slug": slug}},
        {"$group": {"_id": "$version_tag", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.game_files.aggregate(pipeline).to_list(200)
    counts = {}
    for r in raw:
        t = r["_id"] or "default"
        counts[t] = counts.get(t, 0) + r["count"]
    if "default" not in counts:
        counts["default"] = 0
    tags = sorted(counts.keys(), key=lambda t: (t != "default", t))
    lv_updated_at = project.get("live_version_updated_at")
    return {
        "versions": tags,
        "file_counts": counts,
        "live_version": project.get("live_version") or "default",
        "live_version_updated_at": lv_updated_at.isoformat() if isinstance(lv_updated_at, datetime) else lv_updated_at,
        "live_version_updated_by": project.get("live_version_updated_by"),
    }

@router.get("/admin/projects/{slug}/versions/{tag}/download")
async def download_file_version_zip(slug: str, tag: str, user=Depends(require_any_of("manage_files", "claim_missions"))):
    tag = tag.strip()
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if tag == "default":
        query = {"project_slug": slug, "$or": [{"version_tag": "default"}, {"version_tag": {"$exists": False}}]}
    else:
        query = {"project_slug": slug, "version_tag": tag}

    docs = await db.game_files.find(query).to_list(1000)
    if not docs:
        raise HTTPException(status_code=404, detail=f"Version '{tag}' not found or has no files")

    buffer = io.BytesIO()
    used_names = set()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in docs:
            src = _game_file_path(slug, str(doc["_id"]))
            if not src.exists():
                continue
            base_name = re.sub(r"[^\w.\- ]", "_", doc.get("original_filename") or doc.get("name") or str(doc["_id"]))
            arcname = base_name
            n = 1
            while arcname in used_names:
                stem, ext = os.path.splitext(base_name)
                arcname = f"{stem}_{n}{ext}"
                n += 1
            used_names.add(arcname)
            zf.write(src, arcname=arcname)

    buffer.seek(0)
    safe_tag = re.sub(r"[^\w.\-]", "_", tag)
    zip_filename = f"{slug}_{safe_tag}.zip"
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )

@router.post("/admin/projects/{slug}/versions")
async def clone_file_version(slug: str, req: VersionCloneRequest, user=Depends(require_permission("manage_files"))):
    new_tag = req.new_tag.strip()
    if not new_tag:
        raise HTTPException(status_code=400, detail="Version tag is required")
    if not re.match(r"^[a-zA-Z0-9._\-]+$", new_tag):
        raise HTTPException(status_code=400, detail="Version tag must be alphanumeric with dots, dashes or underscores")
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check tag doesn't already exist
    existing = await db.game_files.find_one({"project_slug": slug, "version_tag": new_tag})
    if existing:
        raise HTTPException(status_code=409, detail=f"Version '{new_tag}' already exists")

    # Get all files marked is_latest (or all files if none marked)
    source_files = await db.game_files.find({"project_slug": slug, "is_latest": True}).to_list(500)
    if not source_files:
        source_files = await db.game_files.find({"project_slug": slug}).to_list(500)
    if not source_files:
        raise HTTPException(status_code=400, detail="No files to clone")

    cloned = 0
    project_dir = GAME_FILES_DIR / slug
    project_dir.mkdir(exist_ok=True)

    for src in source_files:
        src_id = str(src["_id"])
        src_path = _game_file_path(slug, src_id)
        if not src_path.exists():
            continue

        new_id = ObjectId()
        new_id_hex = str(new_id)
        dest_path = _game_file_path(slug, new_id_hex)

        shutil.copy2(src_path, dest_path)

        new_doc = {k: v for k, v in src.items() if k != "_id"}
        new_doc["_id"] = new_id
        new_doc["version_tag"] = new_tag
        new_doc["download_count"] = 0
        new_doc["uploaded_at"] = datetime.now(timezone.utc)
        new_doc["cloned_from"] = src_id
        # Stable asset ID: clones keep the original asset's ID so the game
        # can reference the same ID across all versions
        new_doc["stable_id"] = src.get("stable_id") or src_id
        await db.game_files.insert_one(new_doc)
        cloned += 1

    await log_action("files", f"Version '{new_tag}' cloned from existing files ({cloned} files)", project_slug=slug, user=user["username"])
    return {"success": True, "version_tag": new_tag, "files_cloned": cloned}

@router.delete("/admin/projects/{slug}/versions/{tag}")
async def delete_file_version(slug: str, tag: str, user=Depends(require_permission("manage_files"))):
    tag = tag.strip()
    if not tag or tag == "default":
        raise HTTPException(status_code=400, detail="The default version cannot be deleted")
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if (project.get("live_version") or "default") == tag:
        raise HTTPException(status_code=400, detail="Cannot delete the live version. Switch the live version first.")

    files = await db.game_files.find({"project_slug": slug, "version_tag": tag}).to_list(1000)
    if not files:
        raise HTTPException(status_code=404, detail=f"Version '{tag}' not found")

    for f in files:
        path = _game_file_path(slug, str(f["_id"]))
        if path.exists():
            path.unlink(missing_ok=True)
    result = await db.game_files.delete_many({"project_slug": slug, "version_tag": tag})

    await log_action("files", f"Version '{tag}' deleted ({result.deleted_count} files)", project_slug=slug, user=user["username"])
    return {"success": True, "version_tag": tag, "files_deleted": result.deleted_count}

# ── Live version (public + admin) ─────────────────────────────────────────────

@router.get("/game/{slug}/live-version")
async def get_live_version_client(slug: str, request: Request):
    await _verify_files_api_key(slug, request)
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"live_version": project.get("live_version") or "default"}

@router.put("/admin/projects/{slug}/live-version")
async def set_live_version(slug: str, req: LiveVersionRequest, user=Depends(require_permission("manage_files"))):
    tag = req.live_version.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Version tag required")
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    now = datetime.now(timezone.utc)
    await db.projects.update_one({"slug": slug}, {"$set": {
        "live_version": tag, "live_version_updated_at": now, "live_version_updated_by": user["username"],
    }})
    await log_action("files", f"Live version set to '{tag}'", project_slug=slug, user=user["username"])
    return {"success": True, "live_version": tag}
