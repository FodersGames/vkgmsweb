import re
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from ..config import UPLOADS_DIR
from ..deps import get_current_user
from ..utils import _validate_file, _IMAGE_MIMES, _DELIVERY_MIMES

router = APIRouter()

# ============== FILE UPLOAD ==============
@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif"}
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Only image files allowed")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 5 MB.")
    content = _validate_file(content, ext, _IMAGE_MIMES)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    return {"url": f"/api/uploads/{filename}", "filename": filename}

@router.post("/upload-delivery")
async def upload_delivery_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    ALLOWED = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif",
               ".zip", ".rar", ".7z", ".psd", ".ai", ".pdf", ".mp4", ".mov", ".xcf", ".blend"}
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 50 MB.")
    content = _validate_file(content, ext, _DELIVERY_MIMES)
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", Path(file.filename).stem)[:40]
    filename = f"{uuid.uuid4().hex}_{safe_stem}{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    return {"url": f"/api/uploads/{filename}", "filename": file.filename, "size": len(content)}
