import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from ..config import UPLOADS_DIR
from ..database import db
from ..deps import get_current_user
from ..utils import _validate_file, _IMAGE_MIMES

router = APIRouter()

# Allowed image extensions for general uploads (games, blog, website)
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}

@router.post("/upload")
async def upload_image(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Only image files (JPG, PNG, GIF, WEBP, SVG) are allowed")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB max
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    content = _validate_file(content, ext, _IMAGE_MIMES)
    filename = f"{uuid.uuid4().hex}{ext}"

    content_type = file.content_type or ("image/svg+xml" if ext == ".svg" else f"image/{ext.replace('.', '')}")

    # Store in MongoDB for Vercel serverless persistence
    try:
        await db.uploads.update_one(
            {"filename": filename},
            {"$set": {
                "filename": filename,
                "content_type": content_type,
                "data": content,
                "size": len(content),
                "created_at": datetime.now(timezone.utc),
                "uploaded_by": current_user.get("username", "admin"),
            }},
            upsert=True
        )
    except Exception:
        pass

    # Also save to local uploads dir if filesystem allows
    try:
        filepath = UPLOADS_DIR / filename
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception:
        pass

    return {
        "url": f"/api/uploads/{filename}",
        "filename": filename,
        "size": len(content)
    }
