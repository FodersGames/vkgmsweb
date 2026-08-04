import os
import re
import logging
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException

from .database import db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── MIME validation ──────────────────────────────────────────────────────────
try:
    import magic as _magic
    _MAGIC_AVAILABLE = True
except ImportError:
    _MAGIC_AVAILABLE = False
    logger.error(
        "python-magic not installed — MIME content validation disabled. "
        "Install: pip install python-magic && apt-get install libmagic1"
    )

# Allowed real MIME types per extension for /api/upload (images only)
_IMAGE_MIMES: dict = {
    ".jpg":  {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png":  {"image/png"},
    ".gif":  {"image/gif"},
    ".webp": {"image/webp"},
    ".bmp":  {"image/bmp", "image/x-bmp", "image/x-ms-bmp"},
    ".tiff": {"image/tiff"},
    ".tif":  {"image/tiff"},
    # .svg handled separately by _sanitize_svg
}

# Allowed real MIME types per extension for /api/upload-delivery
_DELIVERY_MIMES: dict = {
    **_IMAGE_MIMES,
    ".pdf":   {"application/pdf"},
    ".zip":   {"application/zip", "application/x-zip-compressed", "application/x-zip"},
    ".rar":   {"application/x-rar-compressed", "application/vnd.rar", "application/x-rar"},
    ".7z":    {"application/x-7z-compressed"},
    ".psd":   {"image/vnd.adobe.photoshop", "application/x-photoshop"},
    ".ai":    {"application/postscript", "application/pdf"},
    ".mp4":   {"video/mp4", "video/x-m4v"},
    ".mov":   {"video/quicktime", "video/x-quicktime"},
    ".xcf":   {"image/x-xcf", "application/x-xcf"},
    ".blend": {"application/x-blender"},
    # .svg handled separately by _sanitize_svg
}

def _has_prefix(*prefixes):
    return lambda content: any(content[: len(p)] == p for p in prefixes)

def _is_webp(content: bytes) -> bool:
    return content[:4] == b"RIFF" and len(content) >= 12 and content[8:12] == b"WEBP"

# Raw magic-byte checkers, keyed by extension. Covers every standard image
# format with well-known, stable signatures so uploads never depend on the
# `libmagic` system library being installed — only PDF/ZIP/RAR/7z/AI/MP4/MOV
# (delivery-only formats without a simple fixed signature) still fall back to
# libmagic when available, or fail closed (503) if it isn't.
_FORMAT_MAGIC_BYTES: dict = {
    ".psd":   _has_prefix(b"8BPS"),
    ".blend": _has_prefix(b"BLENDER"),
    ".jpg":   _has_prefix(b"\xff\xd8\xff"),
    ".jpeg":  _has_prefix(b"\xff\xd8\xff"),
    ".png":   _has_prefix(b"\x89PNG\r\n\x1a\n"),
    ".gif":   _has_prefix(b"GIF87a", b"GIF89a"),
    ".bmp":   _has_prefix(b"BM"),
    ".tiff":  _has_prefix(b"II*\x00", b"MM\x00*"),
    ".tif":   _has_prefix(b"II*\x00", b"MM\x00*"),
    ".webp":  _is_webp,
}


def _detect_mime(content: bytes) -> str | None:
    if not _MAGIC_AVAILABLE:
        return None
    try:
        return _magic.from_buffer(content, mime=True)
    except Exception as exc:
        logger.warning("MIME detection error: %s", exc)
        return None


def _check_magic_bytes(content: bytes, ext: str) -> bool:
    """Check raw magic bytes for formats where libmagic is unreliable or unavailable."""
    checker = _FORMAT_MAGIC_BYTES.get(ext)
    if checker is None:
        return True
    return checker(content)


def _sanitize_svg(content: bytes) -> bytes:
    """
    Sanitize SVG content before storage. Applies in order:
      1. Reject CDATA, DOCTYPE and non-xml processing instructions (can hide code pre-parse).
      2. Strip dangerous block elements: script, foreignObject, iframe, object, embed.
      3. Strip all on* event handlers (double-quoted, single-quoted, unquoted).
      4. Strip javascript: and data: protocols from href/src/action/xlink:href.
      5. Strip protocol-relative and external http(s) URLs from href/src/xlink:href.
      6. Strip style attributes that embed url() or javascript expressions.
      7. Final XML well-formedness check — rejects encoding tricks that survive regex.
    Raises ValueError on anything that cannot be safely cleaned.
    """
    try:
        text = content.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        raise ValueError("SVG must be valid UTF-8")

    if not re.search(r"<svg[\s>/]|<svg$", text, re.IGNORECASE):
        raise ValueError("File does not appear to be a valid SVG")

    # Step 1 — reject constructs that can hide payloads before sanitization
    if re.search(r"<!\[CDATA\[", text, re.IGNORECASE):
        raise ValueError("SVG with CDATA sections is not allowed")
    if re.search(r"<!DOCTYPE", text, re.IGNORECASE):
        raise ValueError("SVG with DOCTYPE declarations is not allowed")
    if re.search(r"<\?(?!xml[\s?])", text, re.IGNORECASE):
        raise ValueError("SVG with non-XML processing instructions is not allowed")

    # Step 2 — strip dangerous block elements (paired + self-closing).
    # Includes SMIL animation tags (animate/set/animateTransform/animateMotion/
    # animateColor): these can indirectly assign a javascript: value to href/
    # xlink:href over time (e.g. <animate attributeName="xlink:href"
    # values="javascript:..." begin="0"/>), bypassing the static href="..."
    # regex checks in steps 4-5 entirely — a known SVG-sanitizer bypass class.
    for _tag in ("script", "foreignObject", "iframe", "object", "embed",
                 "animate", "set", "animateTransform", "animateMotion", "animateColor"):
        text = re.sub(rf"<{_tag}[\s\S]*?</{_tag}\s*>", "", text, flags=re.IGNORECASE)
        text = re.sub(rf"<{_tag}\b[^>]*/?>", "", text, flags=re.IGNORECASE)

    # Step 2.5 — strip <style> blocks entirely (can contain @import, url() exfiltration)
    text = re.sub(r"<style[\s\S]*?</style\s*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<style\b[^>]*/?>", "", text, flags=re.IGNORECASE)  # self-closing <style/>

    # Step 3 — strip all on* event handlers
    text = re.sub(r'\s+on\w+\s*=\s*"[^"]*"', "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+on\w+\s*=\s*'[^']*'", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+on\w+\s*=[^\s>\"']*", "", text, flags=re.IGNORECASE)  # unquoted

    # Step 4 — strip javascript: and data: protocols from link/src attributes
    for _attr in ("href", "xlink:href", "src", "action"):
        text = re.sub(
            rf'{_attr}\s*=\s*"(?:javascript|data):[^"]*"', "", text, flags=re.IGNORECASE
        )
        text = re.sub(
            rf"{_attr}\s*=\s*'(?:javascript|data):[^']*'", "", text, flags=re.IGNORECASE
        )

    # Step 5 — strip external URLs (http/https and protocol-relative) from link attributes
    for _attr in ("href", "xlink:href", "src"):
        text = re.sub(rf'{_attr}\s*=\s*"(?:https?:)?//[^"]*"', "", text, flags=re.IGNORECASE)
        text = re.sub(rf"{_attr}\s*=\s*'(?:https?:)?//[^']*'", "", text, flags=re.IGNORECASE)

    # Step 6 — strip style attributes that embed url() or javascript expressions
    text = re.sub(
        r'style\s*=\s*"[^"]*(?:url\s*\(|javascript\s*:)[^"]*"', "", text, flags=re.IGNORECASE
    )
    text = re.sub(
        r"style\s*=\s*'[^']*(?:url\s*\(|javascript\s*:)[^']*'", "", text, flags=re.IGNORECASE
    )

    # Step 7 — XML well-formedness check (catches encoding tricks that survive regex)
    try:
        import xml.etree.ElementTree as _ET
        _ET.fromstring(text)
    except Exception as exc:
        raise ValueError(f"SVG failed XML well-formedness validation: {exc}")

    return text.encode("utf-8")


def _validate_file(content: bytes, ext: str, mime_table: dict) -> bytes:
    """
    Full upload validation pipeline:
    1. SVG → sanitize (see _sanitize_svg) and return cleaned bytes.
    2. PSD/Blend → verify raw magic bytes (libmagic is unreliable for these).
    3. All other formats → verify real MIME type via libmagic.
       Fail closed: if libmagic is unavailable and no magic-byte fallback exists,
       the upload is rejected with HTTP 503 rather than silently bypassing validation.
    Returns (possibly sanitized) content bytes.
    Raises HTTPException on rejection.
    """
    if ext == ".svg":
        try:
            return _sanitize_svg(content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    # Magic-byte check for formats with unreliable libmagic detection
    has_magic_check = ext in _FORMAT_MAGIC_BYTES
    if has_magic_check and not _check_magic_bytes(content, ext):
        raise HTTPException(
            status_code=400,
            detail="Le contenu du fichier ne correspond pas au type de fichier autorisé.",
        )

    if _MAGIC_AVAILABLE:
        detected = _detect_mime(content)
        if detected is not None:
            allowed = mime_table.get(ext, set())
            # Files that passed magic-byte check allow octet-stream as well
            # (libmagic may return generic binary for some PSD/Blend versions)
            if has_magic_check:
                allowed = allowed | {"application/octet-stream"}
            if detected not in allowed:
                logger.warning(
                    "MIME mismatch — ext=%s detected=%s allowed=%s", ext, detected, allowed
                )
                raise HTTPException(
                    status_code=400,
                    detail="Le contenu du fichier ne correspond pas au type de fichier autorisé.",
                )
    elif not has_magic_check:
        # Fail closed: python-magic unavailable and no magic-byte fallback for this format.
        # Refusing is safer than silently accepting based on extension alone.
        logger.error(
            "Upload rejected — python-magic unavailable for ext=%s. "
            "Install: pip install python-magic && apt-get install libmagic1",
            ext,
        )
        raise HTTPException(
            status_code=503,
            detail="La validation du fichier est temporairement indisponible. Veuillez réessayer.",
        )
    # else: has_magic_check passed above, magic-byte verified — accept even without libmagic

    return content


# ============== GENERIC HELPERS ==============
def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

async def get_project_or_404(slug):
    p = await db.projects.find_one({"slug": slug})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

def serialize_doc(doc):
    """Convert MongoDB doc to JSON-safe dict"""
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if k == "_id":
            result["id"] = str(v)
        elif isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result

async def log_action(log_type, message, project_slug=None, user=None, uid=None, variable=None, amount=None):
    await db.logs.insert_one({"type": log_type, "project_slug": project_slug, "user": user, "uid": uid,
                              "variable": variable, "amount": amount, "timestamp": datetime.now(timezone.utc), "message": message})
    logger.info(f"[{log_type}] {message}")

async def _create_notification(user_id: str, message: str, notif_type: str = "info", link: str = ""):
    try:
        await db.notifications.insert_one({
            "userId": ObjectId(user_id),
            "message": message,
            "type": notif_type,
            "link": link,
            "read": False,
            "createdAt": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.error(f"_create_notification error: {e}")

def _get_origin(request=None) -> str:
    # Always prefer server-side env var — never trust client Origin/Referer for Stripe URLs
    return os.environ.get("FRONTEND_URL", "").rstrip("/")
