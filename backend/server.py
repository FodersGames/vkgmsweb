from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import secrets
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import stripe
import asyncio
import math

VERSION = "1.3.0"

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

_jwt_secret_env = os.environ.get('JWT_SECRET', '')
JWT_SECRET = _jwt_secret_env if _jwt_secret_env else secrets.token_urlsafe(64)
_JWT_EPHEMERAL = not bool(_jwt_secret_env)  # True = no env var set → tokens die on restart
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Initial setup key — only works ONCE to bootstrap the Super Admin
SETUP_KEY = os.environ.get('MASTER_KEY', '')

# Super admin credentials from environment (never hardcode in source)
SUPER_ADMIN_EMAIL    = os.environ.get('SUPER_ADMIN_EMAIL', '')
SUPER_ADMIN_PASSWORD = os.environ.get('SUPER_ADMIN_PASSWORD', '')

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

GAME_FILES_DIR = ROOT_DIR / "uploads" / "game_files"
GAME_FILES_DIR.mkdir(exist_ok=True, parents=True)

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Extensions served inline in the browser (images); everything else forces a download.
_INLINE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif"}

@app.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    # Path(filename).name strips any directory components → prevents path traversal
    safe_name = Path(filename).name
    filepath = (UPLOADS_DIR / safe_name).resolve()
    # Defence-in-depth: ensure resolved path stays inside UPLOADS_DIR
    if not str(filepath).startswith(str(UPLOADS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    ext = filepath.suffix.lower()
    if ext in _INLINE_EXTS:
        return FileResponse(filepath)
    # Binary deliverables (ZIP, PSD, PDF, video…): force download, never execute in browser
    return FileResponse(
        filepath,
        headers={"Content-Disposition": f'attachment; filename="{filepath.name}"'},
    )

api_router = APIRouter(prefix="/api")

# ── Security headers middleware ──────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # CSP: allow Stripe, Google Fonts, and same-origin resources
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' https://api.stripe.com; "
            "frame-src https://js.stripe.com https://hooks.stripe.com; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
        return response

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

# Raw magic-byte signatures for formats libmagic sometimes misidentifies
_FORMAT_MAGIC_BYTES: dict = {
    ".psd":   b"8BPS",
    ".blend": b"BLENDER",
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
    """Check raw magic bytes for formats where libmagic is unreliable."""
    expected = _FORMAT_MAGIC_BYTES.get(ext)
    if expected is None:
        return True
    return content[: len(expected)] == expected


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

    # Step 2 — strip dangerous block elements (paired + self-closing)
    for _tag in ("script", "foreignObject", "iframe", "object", "embed"):
        text = re.sub(rf"<{_tag}[\s\S]*?</{_tag}\s*>", "", text, flags=re.IGNORECASE)
        text = re.sub(rf"<{_tag}\b[^>]*/?>", "", text, flags=re.IGNORECASE)

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

# ============== PERMISSIONS ==============
# Static permissions (project:slug permissions are dynamic, not listed here)
ALL_PERMISSIONS = [
    "view_all_projects", "create_projects", "delete_projects",
    "send_items", "delete_items",
    "change_status",
    "view_variables", "create_variables", "edit_variables", "delete_variables",
    "view_logs", "view_api_docs",
    "manage_users",
    "manage_website",
    "create_games", "edit_games", "delete_games",
    "create_blog", "edit_blog", "delete_blog",
    "manage_chat",
    "manage_shop",
    "create_missions", "claim_missions", "manage_missions",
    "manage_tickets",
]

def is_valid_permission(p: str) -> bool:
    return p in ALL_PERMISSIONS or bool(re.match(r'^project:[a-z0-9_-]+$', p))

# ============== MODELS ==============
class LoginRequest(BaseModel):
    key: str

class LoginResponse(BaseModel):
    token: str
    user: dict
    first_login: bool = False
    new_key: Optional[str] = None

class CreateUserRequest(BaseModel):
    username: str
    permissions: List[str]

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

class CreateUserResponse(BaseModel):
    username: str
    access_key: str
    permissions: List[str]

class SendItemRequest(BaseModel):
    uid: str
    variable: str
    amount: str

class ServerStatusRequest(BaseModel):
    status: Literal["open", "maintenance", "closed"]

class ServerStatusResponse(BaseModel):
    status: str

class UpdateUserPermissionsRequest(BaseModel):
    permissions: List[str]

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

class VariableCreateRequest(BaseModel):
    variable_name: str
    values: List[str]

class VariableUpdateRequest(BaseModel):
    values: List[str]

class CreateProjectRequest(BaseModel):
    name: str

class GameCreateRequest(BaseModel):
    name: str
    description: str
    logo_url: Optional[str] = ""
    screenshots: List[str] = []
    platforms: List[dict] = []  # [{name, url}]
    status: Literal["published", "draft", "coming_soon"] = "draft"
    featured: bool = False
    price_cents: int = 0

class GameUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    screenshots: Optional[List[str]] = None
    platforms: Optional[List[dict]] = None
    status: Optional[Literal["published", "draft", "coming_soon"]] = None
    featured: Optional[bool] = None
    price_cents: Optional[int] = None

class BlogCreateRequest(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = ""
    published: bool = False

class BlogUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    published: Optional[bool] = None

class WebsiteSettingsRequest(BaseModel):
    maintenance_mode: bool

class ChatMessageRequest(BaseModel):
    username: str
    message: str
    level: Optional[int] = None

class BannedWordsUpdateRequest(BaseModel):
    words: List[str]

class ShopProductCreateRequest(BaseModel):
    name: str
    description: str = ""
    price: int
    image_url: str = ""
    badge: Optional[str] = None
    discount_pct: Optional[int] = None
    project_slug: str
    variable: str
    amount: str
    active: bool = True
    category: Optional[str] = None
    subcategory: Optional[str] = None
    featured: bool = False

class ShopProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    image_url: Optional[str] = None
    badge: Optional[str] = None
    discount_pct: Optional[int] = None
    project_slug: Optional[str] = None
    variable: Optional[str] = None
    amount: Optional[str] = None
    active: Optional[bool] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    featured: Optional[bool] = None

class DailyGiftConfigRequest(BaseModel):
    active: bool = True
    title: str = "Daily Gift"
    description: str = ""
    image_url: str = ""
    project_slug: str = ""
    variable: str = ""
    amount: str = ""

class DailyGiftClaimRequest(BaseModel):
    player_uid: str

class ShopCheckoutRequest(BaseModel):
    product_id: str
    player_uid: str
    coupon_code: Optional[str] = ""

class ShopSettingsRequest(BaseModel):
    # Banner
    shop_title: str = ""
    banner_url: str = ""
    banner_title: str = ""
    banner_subtitle: str = ""
    banner_height: str = "md"
    banner_overlay: str = "rgba(0,0,0,0.55)"
    # Colors
    primary_color: str = "#6C5CE7"
    accent_color: str = "#A29BFE"
    background_color: str = ""
    surface_color: str = ""
    border_color: str = ""
    text_color: str = ""
    text_muted_color: str = ""
    price_color: str = ""
    # Background texture
    bg_texture_url: str = ""
    bg_texture_opacity: float = 0.05
    # Cards
    card_style: str = "rounded"
    card_shadow: str = "sm"
    # Layout & sections
    featured_section_title: str = "Featured Offers"
    footer_text: str = ""
    categories: List[dict] = []

class ShopGlobalSettingsRequest(BaseModel):
    shop_title: str = "Shop"
    footer_text: str = ""

class GamePurchaseCheckoutRequest(BaseModel):
    coupon_code: Optional[str] = ""

class GameFileUpdateRequest(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    platform: Optional[str] = None
    file_type: Optional[str] = None
    description: Optional[str] = None
    is_latest: Optional[bool] = None
    rotation_center_x: Optional[float] = None
    rotation_center_y: Optional[float] = None

class CouponCampaignRequest(BaseModel):
    name: str
    target_type: Literal["tier", "users"]
    target_tiers: List[str] = []
    target_user_ids: List[str] = []
    discount_pct: int
    valid_days: int
    scope: Literal["all", "product", "game"] = "all"
    scope_id: str = ""
    scope_name: str = ""

class CouponValidateRequest(BaseModel):
    code: str
    product_id: Optional[str] = None
    game_slug: Optional[str] = None

class MissionCreateRequest(BaseModel):
    title: str
    description: str = ""
    style_description: str = ""
    reference_images: List[str] = []
    priority: Literal["low", "medium", "high", "urgent"] = "medium"

class MissionUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    style_description: Optional[str] = None
    reference_images: Optional[List[str]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    status: Optional[Literal["open", "in_progress", "completed", "cancelled"]] = None

class MissionCompleteRequest(BaseModel):
    delivery_files: List[dict] = []  # [{url, filename, size}]

class MissionReopenRequest(BaseModel):
    feedback: str = ""
    keep_assigned: bool = True

class TicketCreateRequest(BaseModel):
    subject: str
    category: Literal["general", "technical", "billing", "account"] = "general"
    message: str

class TicketReplyRequest(BaseModel):
    content: str

class TicketStatusUpdateRequest(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved", "closed"]] = None
    priority: Optional[Literal["normal", "high", "urgent"]] = None

class LoyaltyAdjustRequest(BaseModel):
    adjust_dollars: float
    reason: str = ""

class RegisterRequest(BaseModel):
    email: str
    password: str
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: Optional[str] = ""

class LoginEmailRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

class SuspendUserRequest(BaseModel):
    suspended: bool
    reason: Optional[str] = ""

class UpdateProfileRequest(BaseModel):
    firstName: str
    lastName: str
    username: str

class UpdateUserRoleRequest(BaseModel):
    role: Literal["user", "admin", "super_admin"]
    permissions: List[str] = []

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

# ============== HELPERS ==============
def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def hash_key(key: str) -> str:
    return bcrypt.hashpw(key.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def verify_key(key: str, hashed: str) -> bool:
    return bcrypt.checkpw(key.encode('utf-8'), hashed.encode('utf-8'))

def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[a-zA-Z]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")
    if not re.search(r'[0-9]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

def create_access_token(user_id, username, is_super_admin, permissions, email=""):
    payload = {"sub": user_id, "username": username, "email": email, "is_super_admin": is_super_admin, "permissions": permissions,
               "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(auth_header[7:])
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("isSuspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    is_super = user.get("role") == "super_admin"
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "role": user.get("role", "user"),
        "is_super_admin": is_super,
        "permissions": ALL_PERMISSIONS if is_super else user.get("permissions", []),
        "mustChangePassword": user.get("mustChangePassword", False),
    }

async def get_optional_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        payload = verify_token(auth_header[7:])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("isSuspended"):
            return None
        return {
            "id": str(user["_id"]),
            "email": user.get("email", ""),
            "username": user.get("username", ""),
            "role": user.get("role", "user"),
            "is_super_admin": user.get("role") == "super_admin",
        }
    except Exception:
        return None

def require_permission(permission):
    async def check(user=Depends(get_current_user)):
        if user["is_super_admin"]:
            return user
        if permission not in user["permissions"]:
            raise HTTPException(status_code=403, detail=f"Missing: {permission}")
        return user
    return check

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

async def get_banned_words():
    doc = await db.chat_settings.find_one({"key": "banned_words"})
    if not doc:
        return []
    return doc.get("words", [])

def censor_message(text: str, banned_words: List[str]) -> str:
    """Replace each banned word (whole-word, case-insensitive) with asterisks matching its length."""
    if not banned_words:
        return text
    for word in banned_words:
        word = word.strip()
        if not word:
            continue
        pattern = re.compile(r'\b' + re.escape(word) + r'\b', re.IGNORECASE)
        text = pattern.sub(lambda m: '*' * len(m.group(0)), text)
    return text

async def verify_chat_api_key(project_slug: str, request: Request):
    api_key = request.headers.get("X-Chat-Api-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing chat API key")
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    stored_key = project.get("chat_api_key") or ""
    if not secrets.compare_digest(stored_key, api_key):
        raise HTTPException(status_code=401, detail="Invalid chat API key")
    return project

# ============== AUTH ==============
@api_router.get("/version")
async def get_version():
    return {"version": VERSION, "name": "Vakar Games Admin API"}

@api_router.get("/permissions")
async def get_all_permissions():
    return {"permissions": ALL_PERMISSIONS}

@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginEmailRequest):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_key(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("isSuspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": datetime.now(timezone.utc)}})
    is_super = user.get("role") == "super_admin"
    permissions = ALL_PERMISSIONS if is_super else user.get("permissions", [])
    token = create_access_token(str(user["_id"]), user["username"], is_super, permissions, email)
    await log_action("auth", f"User '{user['username']}' logged in", user=user["username"])
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "username": user["username"],
            "firstName": user.get("firstName", ""),
            "lastName": user.get("lastName", ""),
            "role": user.get("role", "user"),
            "is_super_admin": is_super,
            "permissions": permissions,
            "mustChangePassword": user.get("mustChangePassword", False),
        },
        "first_login": user.get("mustChangePassword", False),
    }

@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    email = body.email.lower().strip()
    firstName = (body.firstName or "").strip()[:50]
    lastName = (body.lastName or "").strip()[:50]
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    # Auto-generate username from email prefix if not provided
    raw_username = (body.username or "").strip()
    if not raw_username:
        base = re.sub(r'[^a-zA-Z0-9_]', '_', email.split('@')[0])[:24]
        raw_username = base
        suffix = 0
        while await db.users.find_one({"username": raw_username}):
            suffix += 1
            raw_username = f"{base}_{suffix}"
    username = raw_username
    if not re.match(r'^[a-zA-Z0-9_]{3,32}$', username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters (letters, numbers, underscores only)")
    validate_password_strength(body.password)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    try:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_key(body.password),
            "firstName": firstName,
            "lastName": lastName,
            "username": username,
            "role": "user",
            "permissions": [],
            "isVerified": True,
            "isSuspended": False,
            "mustChangePassword": False,
            "createdAt": datetime.now(timezone.utc),
            "lastLogin": None,
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email or username already taken")
    await log_action("auth", f"New user registered: {username} ({email})")
    return {"success": True, "message": "Account created successfully"}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user

@api_router.patch("/auth/profile")
async def update_profile(body: UpdateProfileRequest, user=Depends(get_current_user)):
    firstName = body.firstName.strip()
    lastName = body.lastName.strip()
    username = body.username.strip()
    if not (1 <= len(firstName) <= 50):
        raise HTTPException(status_code=400, detail="First name must be 1-50 characters")
    if not (1 <= len(lastName) <= 50):
        raise HTTPException(status_code=400, detail="Last name must be 1-50 characters")
    if not re.match(r'^[a-zA-Z0-9_]{3,32}$', username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters (letters, numbers, underscores only)")
    conflict = await db.users.find_one({"username": username, "_id": {"$ne": ObjectId(user["id"])}})
    if conflict:
        raise HTTPException(status_code=400, detail="Username already taken")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"firstName": firstName, "lastName": lastName, "username": username}}
    )
    await log_action("auth", f"User '{user['username']}' updated their profile")
    return {"success": True}

@api_router.post("/auth/change-password")
@limiter.limit("5/minute")
async def change_password(request: Request, body: ChangePasswordRequest, user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if not u.get("mustChangePassword"):
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_key(body.current_password, u.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password_strength(body.new_password)
    await db.users.update_one(
        {"_id": u["_id"]},
        {"$set": {"password_hash": hash_key(body.new_password), "mustChangePassword": False}}
    )
    await log_action("auth", f"User '{u['username']}' changed their password")
    return {"success": True, "message": "Password updated successfully"}

@api_router.get("/auth/verify")
async def verify(user=Depends(get_current_user)):
    return {"valid": True, "user": user}

@api_router.post("/auth/init-superadmin")
async def init_superadmin(request: Request):
    """Emergency endpoint to (re)create the super admin account. Requires MASTER_KEY header."""
    master_key = request.headers.get("X-Master-Key", "")
    if not master_key or master_key != SETUP_KEY or not SETUP_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    await _ensure_super_admin()
    existing = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"password_hash": 0})
    return {"success": True, "user": serialize_doc(existing) if existing else None}

# ============== FILE UPLOAD ==============
@api_router.post("/upload")
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

@api_router.post("/upload-delivery")
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

# ============== PROJECTS ==============
@api_router.post("/projects")
async def create_project(req: CreateProjectRequest, user=Depends(require_permission("create_projects"))):
    slug = slugify(req.name)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid project name")
    if await db.projects.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Project already exists")
    doc = {"name": req.name, "slug": slug, "created_at": datetime.now(timezone.utc), "created_by": user["username"],
           "chat_api_key": secrets.token_urlsafe(24)}
    await db.projects.insert_one(doc)
    await db.server_status.update_one({"project_slug": slug}, {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc), "updated_by": "system"}}, upsert=True)
    await log_action("project", f"Project '{req.name}' created", project_slug=slug, user=user["username"])
    return {"success": True, "name": req.name, "slug": slug, "created_at": doc["created_at"].isoformat(), "created_by": user["username"]}

@api_router.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    if user["is_super_admin"] or "view_all_projects" in user["permissions"]:
        projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    else:
        allowed = [p.split(":", 1)[1] for p in user["permissions"] if p.startswith("project:")]
        if not allowed:
            return {"projects": []}
        projects = await db.projects.find({"slug": {"$in": allowed}}, {"_id": 0}).to_list(1000)
    for p in projects:
        if isinstance(p.get("created_at"), datetime):
            p["created_at"] = p["created_at"].isoformat()
    return {"projects": projects}

@api_router.delete("/projects/{slug}")
async def delete_project(slug: str, user=Depends(require_permission("delete_projects"))):
    p = await db.projects.find_one({"slug": slug})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for col in ["projects", "items", "server_status", "variables"]:
        if col == "projects":
            await db[col].delete_one({"slug": slug})
        else:
            await db[col].delete_many({"project_slug": slug})
    await db.logs.delete_many({"project_slug": slug})
    await log_action("project", f"Project '{p['name']}' deleted", user=user["username"])
    return {"success": True, "message": f"Project '{p['name']}' deleted"}

# ============== USERS ==============
class AdminCreateUserRequest(BaseModel):
    email: str
    password: Optional[str] = ""
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    username: Optional[str] = ""
    role: Literal["user", "admin"] = "user"
    permissions: List[str] = []

@api_router.post("/admin/users/create")
async def admin_create_user(body: AdminCreateUserRequest, admin=Depends(require_permission("manage_users"))):
    email = body.email.lower().strip()
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    firstName = (body.firstName or "").strip()[:50]
    lastName = (body.lastName or "").strip()[:50]
    # Auto-generate username if not provided
    raw_username = (body.username or "").strip()
    if not raw_username:
        base = re.sub(r'[^a-zA-Z0-9_]', '_', email.split('@')[0])[:24]
        raw_username = base
        suffix = 0
        while await db.users.find_one({"username": raw_username}):
            suffix += 1
            raw_username = f"{base}_{suffix}"
    if not re.match(r'^[a-zA-Z0-9_]{3,32}$', raw_username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters (letters, numbers, underscores only)")
    if await db.users.find_one({"username": raw_username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    # Auto-generate password if not provided
    password = body.password.strip() if body.password else secrets.token_urlsafe(12)
    validate_password_strength(password)
    for p in body.permissions:
        if not is_valid_permission(p):
            raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")
    await db.users.insert_one({
        "email": email,
        "password_hash": hash_key(password),
        "firstName": firstName,
        "lastName": lastName,
        "username": raw_username,
        "role": body.role,
        "permissions": body.permissions,
        "isVerified": True,
        "isSuspended": False,
        "mustChangePassword": bool(not body.password),
        "createdAt": datetime.now(timezone.utc),
        "lastLogin": None,
        "createdByAdmin": admin["username"],
    })
    await log_action("user_action", f"Admin '{admin['username']}' created user account: {raw_username} ({email})", user=admin["username"])
    return {
        "success": True,
        "username": raw_username,
        "email": email,
        "generated_password": password if not body.password else None,
    }

@api_router.get("/users")
async def list_users(page: int = 1, limit: int = 100, admin=Depends(require_permission("manage_users"))):
    skip = (page - 1) * limit
    total = await db.users.count_documents({})
    raw = await db.users.find({}, {"password_hash": 0, "access_key_hash": 0}).skip(skip).limit(limit).to_list(limit)
    result = []
    for u in raw:
        result.append({
            "id": str(u["_id"]),
            "email": u.get("email", ""),
            "username": u.get("username", ""),
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "role": u.get("role", "user"),
            "permissions": u.get("permissions", []),
            "isSuspended": u.get("isSuspended", False),
            "createdAt": u["createdAt"].isoformat() if isinstance(u.get("createdAt"), datetime) else u.get("created_at", ""),
            "lastLogin": u["lastLogin"].isoformat() if isinstance(u.get("lastLogin"), datetime) else None,
        })
    return {"users": result, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0, "access_key_hash": 0})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(u["_id"]),
        "email": u.get("email", ""),
        "username": u.get("username", ""),
        "firstName": u.get("firstName", ""),
        "lastName": u.get("lastName", ""),
        "role": u.get("role", "user"),
        "permissions": u.get("permissions", []),
        "isSuspended": u.get("isSuspended", False),
        "createdAt": u["createdAt"].isoformat() if isinstance(u.get("createdAt"), datetime) else u.get("created_at", ""),
        "lastLogin": u["lastLogin"].isoformat() if isinstance(u.get("lastLogin"), datetime) else None,
    }

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot delete a super admin account")
    if str(target["_id"]) == admin["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete your own account")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await log_action("user_action", f"User '{target.get('username', user_id)}' deleted", user=admin["username"])
    return {"success": True, "message": f"User '{target.get('username', user_id)}' deleted"}

@api_router.patch("/users/{user_id}/suspend")
async def suspend_user(user_id: str, req: SuspendUserRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot suspend a super admin account")
    if str(target["_id"]) == admin["id"]:
        raise HTTPException(status_code=403, detail="Cannot suspend your own account")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"isSuspended": req.suspended}})
    action = "suspended" if req.suspended else "reactivated"
    await log_action("user_action", f"User '{target.get('username', user_id)}' {action}", user=admin["username"])
    return {"success": True, "suspended": req.suspended}

@api_router.put("/users/{user_id}/permissions")
async def update_perms(user_id: str, req: UpdateUserPermissionsRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent privilege escalation: non-super-admin can only grant permissions they themselves hold
    if not admin.get("is_super_admin") and admin.get("role") not in ("super_admin",):
        admin_perms = set(admin.get("permissions", []))
        for perm in req.permissions:
            if perm not in admin_perms:
                raise HTTPException(status_code=403, detail=f"Cannot grant permission '{perm}' — you do not hold it yourself")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"permissions": req.permissions}})
    await log_action("user_action", f"User '{target.get('username', user_id)}' permissions updated", user=admin["username"])
    return {"success": True, "id": user_id, "permissions": req.permissions}

@api_router.patch("/admin/users/{user_id}/loyalty")
async def adjust_user_loyalty(user_id: str, req: LoyaltyAdjustRequest, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    adjust_cents = round(req.adjust_dollars * 100)
    if adjust_cents == 0:
        raise HTTPException(status_code=400, detail="Adjustment cannot be zero")
    user_email = target.get("email", "")
    current = await db.user_points.find_one({"email": user_email})
    current_total = current.get("total_spent_cents", 0) if current else 0
    previous_tier = get_tier(current_total)
    new_total = max(0, current_total + adjust_cents)
    new_tier = get_tier(new_total)
    await db.user_points.update_one(
        {"email": user_email},
        {"$set": {"total_spent_cents": new_total, "tier": new_tier, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    reason_str = f" (reason: {req.reason})" if req.reason else ""
    await log_action("user_action",
        f"Admin '{admin['username']}' adjusted loyalty for '{target.get('username', user_email)}': "
        f"${req.adjust_dollars:+.2f}{reason_str} → {new_total}cts ({new_tier})",
        user=admin["username"])
    await _create_notification(
        user_id=user_id,
        message=f"{'🏆' if adjust_cents > 0 else '📉'} Your loyalty balance was adjusted by ${abs(req.adjust_dollars):.2f}. Current tier: {new_tier.capitalize()}.",
        notif_type="loyalty_adjustment",
    )
    return {
        "success": True,
        "previous_total_cents": current_total,
        "new_total_cents": new_total,
        "previous_tier": previous_tier,
        "new_tier": new_tier,
    }

@api_router.get("/admin/users/{user_id}/export")
async def export_user_data(user_id: str, admin=Depends(require_permission("manage_users"))):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    email = target.get("email", "")
    loyalty = await db.user_points.find_one({"email": email})
    purchases = await db.game_purchases.find({"email": email}).to_list(500)
    tickets = await db.support_tickets.find({"user_email": email}).to_list(500)

    def _serialize_date(v):
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v) if v else None

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "id": str(target["_id"]),
            "email": email,
            "username": target.get("username"),
            "firstName": target.get("firstName"),
            "lastName": target.get("lastName"),
            "role": target.get("role"),
            "created_at": _serialize_date(target.get("created_at")),
            "isSuspended": target.get("isSuspended", False),
        },
        "loyalty": {
            "tier": loyalty.get("tier", "bronze"),
            "total_spent_cents": loyalty.get("total_spent_cents", 0),
            "total_spent_dollars": round(loyalty.get("total_spent_cents", 0) / 100, 2),
        } if loyalty else None,
        "game_purchases": [
            {
                "game_slug": p.get("game_slug"),
                "game_name": p.get("game_name"),
                "purchased_at": _serialize_date(p.get("purchased_at")),
                "amount_paid_cents": p.get("amount_paid_cents"),
            }
            for p in purchases
        ],
        "support_tickets": [
            {
                "ticket_number": t.get("ticket_number"),
                "subject": t.get("subject"),
                "status": t.get("status"),
                "category": t.get("category"),
                "created_at": _serialize_date(t.get("created_at")),
                "message_count": len(t.get("messages", [])),
            }
            for t in tickets
        ],
    }

# ============== PROJECT-SCOPED: ITEMS ==============
@api_router.post("/projects/{slug}/items/send")
async def send_items(slug: str, req: SendItemRequest, user=Depends(require_permission("send_items"))):
    await get_project_or_404(slug)
    await db.items.insert_one({"project_slug": slug, "uid": req.uid, "variable": req.variable, "amount": req.amount,
                               "created_at": datetime.now(timezone.utc), "created_by": user["username"]})
    await log_action("send", f"Sent {req.amount}x {req.variable} to {req.uid}", project_slug=slug, user=user["username"],
                     uid=req.uid, variable=req.variable, amount=req.amount)
    return {"success": True, "message": f"Sent {req.amount}x {req.variable} to {req.uid}"}

@api_router.delete("/projects/{slug}/items/{uid}")
async def delete_items(slug: str, uid: str, user=Depends(require_permission("delete_items"))):
    await get_project_or_404(slug)
    r = await db.items.delete_many({"project_slug": slug, "uid": uid})
    await log_action("delete", f"Deleted {r.deleted_count} item(s) for {uid}", project_slug=slug, user=user["username"], uid=uid)
    return {"success": True, "deleted_count": r.deleted_count}

@api_router.get("/projects/{slug}/claimgift/{uid}")
@limiter.limit("30/minute")
async def claim_gift(request: Request, slug: str, uid: str):
    await get_project_or_404(slug)
    items = await db.items.find({"project_slug": slug, "uid": uid}).sort("created_at", 1).to_list(1000)
    if not items:
        return {"length": 0}
    resp = [{"variable": i["variable"], "amount": i["amount"]} for i in items]
    await db.items.delete_one({"_id": items[0]["_id"]})
    await log_action("claim", f"User {uid} claimed: {items[0]['variable']} x{items[0]['amount']}", project_slug=slug, uid=uid)
    result = {"length": len(resp), "variable": resp[0]["variable"], "amount": resp[0]["amount"]}
    if len(resp) > 1:
        result["items"] = resp[1:]
    return result

# ============== PROJECT-SCOPED: STATUS ==============
@api_router.post("/projects/{slug}/status")
async def change_status(slug: str, req: ServerStatusRequest, user=Depends(require_permission("change_status"))):
    await get_project_or_404(slug)
    await db.server_status.update_one({"project_slug": slug}, {"$set": {"status": req.status, "updated_at": datetime.now(timezone.utc), "updated_by": user["username"]}}, upsert=True)
    await log_action("status", f"Status -> '{req.status}'", project_slug=slug, user=user["username"])
    return {"success": True, "status": req.status}

@api_router.get("/projects/{slug}/status", response_model=ServerStatusResponse)
async def get_status(slug: str):
    await get_project_or_404(slug)
    doc = await db.server_status.find_one({"project_slug": slug})
    return ServerStatusResponse(status=doc["status"] if doc else "open")

# ============== PROJECT-SCOPED: LOGS ==============
@api_router.get("/projects/{slug}/logs")
async def get_logs(slug: str, log_type: Optional[str] = None, user_filter: Optional[str] = None,
                   uid: Optional[str] = None, limit: int = 100, page: int = 1,
                   user=Depends(require_permission("view_logs"))):
    await get_project_or_404(slug)
    q = {"project_slug": slug}
    if log_type: q["type"] = log_type
    if user_filter: q["user"] = user_filter
    if uid: q["uid"] = uid

    skip = (page - 1) * limit
    total = await db.logs.count_documents(q)
    logs = await db.logs.find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    for l in logs:
        if isinstance(l.get("timestamp"), datetime):
            l["timestamp"] = l["timestamp"].isoformat()
    return {"logs": logs, "count": len(logs), "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

# ============== PROJECT-SCOPED: VARIABLES ==============
@api_router.post("/projects/{slug}/variables")
async def create_variable(slug: str, req: VariableCreateRequest, user=Depends(require_permission("create_variables"))):
    await get_project_or_404(slug)
    if await db.variables.find_one({"project_slug": slug, "variable_name": req.variable_name}):
        raise HTTPException(status_code=400, detail="Variable exists")
    await db.variables.insert_one({"project_slug": slug, "variable_name": req.variable_name, "values": req.values,
                                   "created_at": datetime.now(timezone.utc), "created_by": user["username"],
                                   "updated_at": datetime.now(timezone.utc), "updated_by": user["username"]})
    await log_action("variable_action", f"Variable '{req.variable_name}' created", project_slug=slug, user=user["username"])
    return {"success": True, "variable_name": req.variable_name, "values": req.values}

@api_router.get("/projects/{slug}/variables")
async def list_variables(slug: str, page: int = 1, limit: int = 200, user=Depends(require_permission("view_variables"))):
    await get_project_or_404(slug)

    skip = (page - 1) * limit
    total = await db.variables.count_documents({"project_slug": slug})
    vs = await db.variables.find({"project_slug": slug}, {"_id": 0, "project_slug": 0}).skip(skip).limit(limit).to_list(limit)
    for v in vs:
        for k in ["created_at", "updated_at"]:
            if isinstance(v.get(k), datetime):
                v[k] = v[k].isoformat()
    return {"variables": vs, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

@api_router.get("/projects/{slug}/variable/{name}")
async def get_variable(slug: str, name: str):
    await get_project_or_404(slug)
    v = await db.variables.find_one({"project_slug": slug, "variable_name": name}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Variable not found")
    result = {"variable_name": name}
    for i, val in enumerate(v.get("values", [])):
        result[f"value_{i}"] = val
    result["count"] = len(v.get("values", []))
    return result

@api_router.put("/projects/{slug}/variables/{name}")
async def update_variable(slug: str, name: str, req: VariableUpdateRequest, user=Depends(require_permission("edit_variables"))):
    await get_project_or_404(slug)
    if not await db.variables.find_one({"project_slug": slug, "variable_name": name}):
        raise HTTPException(status_code=404, detail="Variable not found")
    await db.variables.update_one({"project_slug": slug, "variable_name": name},
                                  {"$set": {"values": req.values, "updated_at": datetime.now(timezone.utc), "updated_by": user["username"]}})
    await log_action("variable_action", f"Variable '{name}' updated", project_slug=slug, user=user["username"], variable=name)
    return {"success": True, "variable_name": name, "values": req.values}

@api_router.delete("/projects/{slug}/variables/{name}")
async def delete_variable(slug: str, name: str, user=Depends(require_permission("delete_variables"))):
    await get_project_or_404(slug)
    r = await db.variables.delete_one({"project_slug": slug, "variable_name": name})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Variable not found")
    await log_action("variable_action", f"Variable '{name}' deleted", project_slug=slug, user=user["username"], variable=name)
    return {"success": True, "message": f"Variable '{name}' deleted"}

# ============== WEBSITE: GAMES ==============
@api_router.post("/website/games")
async def create_game(req: GameCreateRequest, user=Depends(require_permission("create_games"))):
    slug = slugify(req.name)
    if await db.website_games.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Game with this name already exists")
    if req.featured:
        await db.website_games.update_many({}, {"$set": {"featured": False}})
    doc = {"name": req.name, "slug": slug, "description": req.description, "logo_url": req.logo_url,
           "screenshots": req.screenshots, "platforms": req.platforms, "status": req.status, "featured": req.featured,
           "price_cents": req.price_cents,
           "created_at": datetime.now(timezone.utc), "created_by": user["username"],
           "updated_at": datetime.now(timezone.utc)}
    await db.website_games.insert_one(doc)
    await log_action("website", f"Game '{req.name}' created", user=user["username"])
    return {"success": True, "game": serialize_doc(doc)}

@api_router.get("/website/games")
async def list_games_admin(user=Depends(require_permission("create_games"))):
    games = await db.website_games.find().sort("created_at", -1).to_list(1000)
    return {"games": [serialize_doc(g) for g in games]}

@api_router.get("/website/games/public")
async def list_games_public():
    games = await db.website_games.find({"status": {"$in": ["published", "coming_soon"]}}).sort("created_at", -1).to_list(1000)
    return {"games": [serialize_doc(g) for g in games]}

@api_router.get("/website/games/featured")
async def get_featured_game():
    game = await db.website_games.find_one({"featured": True, "status": "published"})
    if not game:
        return {"game": None}
    return {"game": serialize_doc(game)}

@api_router.put("/website/games/{game_slug}")
async def update_game(game_slug: str, req: GameUpdateRequest, user=Depends(require_permission("edit_games"))):
    game = await db.website_games.find_one({"slug": game_slug})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    # price_cents=0 is valid (free game), handle it explicitly
    if req.price_cents is not None:
        updates["price_cents"] = req.price_cents
    updates["updated_at"] = datetime.now(timezone.utc)
    if updates.get("featured"):
        await db.website_games.update_many({"slug": {"$ne": game_slug}}, {"$set": {"featured": False}})
    if "name" in updates:
        updates["slug"] = slugify(updates["name"])
    await db.website_games.update_one({"slug": game_slug}, {"$set": updates})
    await log_action("website", f"Game '{game_slug}' updated", user=user["username"])
    updated = await db.website_games.find_one({"slug": updates.get("slug", game_slug)})
    return {"success": True, "game": serialize_doc(updated)}

@api_router.delete("/website/games/{game_slug}")
async def delete_game(game_slug: str, user=Depends(require_permission("delete_games"))):
    r = await db.website_games.delete_one({"slug": game_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    await log_action("website", f"Game '{game_slug}' deleted", user=user["username"])
    return {"success": True, "message": f"Game deleted"}

# ============== WEBSITE: BLOG ==============
@api_router.post("/website/blog")
async def create_blog_post(req: BlogCreateRequest, user=Depends(require_permission("create_blog"))):
    slug = slugify(req.title)
    if await db.blog_posts.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    doc = {"title": req.title, "slug": slug, "content": req.content, "image_url": req.image_url,
           "published": req.published, "author": user["username"],
           "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
    await db.blog_posts.insert_one(doc)
    await log_action("website", f"Blog post '{req.title}' created", user=user["username"])
    return {"success": True, "post": serialize_doc(doc)}

@api_router.get("/website/blog")
async def list_blog_admin(user=Depends(require_permission("create_blog"))):
    posts = await db.blog_posts.find().sort("created_at", -1).to_list(1000)
    return {"posts": [serialize_doc(p) for p in posts]}

@api_router.get("/website/blog/public")
async def list_blog_public():
    posts = await db.blog_posts.find({"published": True}).sort("created_at", -1).to_list(1000)
    return {"posts": [serialize_doc(p) for p in posts]}

@api_router.get("/website/blog/{post_slug}")
async def get_blog_post(post_slug: str):
    post = await db.blog_posts.find_one({"slug": post_slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"post": serialize_doc(post)}

@api_router.put("/website/blog/{post_slug}")
async def update_blog_post(post_slug: str, req: BlogUpdateRequest, user=Depends(require_permission("edit_blog"))):
    post = await db.blog_posts.find_one({"slug": post_slug})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.blog_posts.update_one({"slug": post_slug}, {"$set": updates})
    updated = await db.blog_posts.find_one({"slug": post_slug})
    await log_action("website", f"Blog post '{post_slug}' updated", user=user["username"])
    return {"success": True, "post": serialize_doc(updated)}

@api_router.delete("/website/blog/{post_slug}")
async def delete_blog_post(post_slug: str, user=Depends(require_permission("delete_blog"))):
    r = await db.blog_posts.delete_one({"slug": post_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    await log_action("website", f"Blog post '{post_slug}' deleted", user=user["username"])
    return {"success": True, "message": "Post deleted"}

# ============== WEBSITE: SETTINGS ==============
@api_router.get("/website/settings")
async def get_website_settings():
    doc = await db.website_settings.find_one({}, {"_id": 0})
    if not doc:
        return {"maintenance_mode": False}
    return {"maintenance_mode": doc.get("maintenance_mode", False)}

@api_router.put("/website/settings")
async def update_website_settings(req: WebsiteSettingsRequest, user=Depends(require_permission("manage_website"))):
    await db.website_settings.update_one({}, {"$set": {"maintenance_mode": req.maintenance_mode, "updated_at": datetime.now(timezone.utc),
                                                        "updated_by": user["username"]}}, upsert=True)
    await log_action("website", f"Maintenance mode {'enabled' if req.maintenance_mode else 'disabled'}", user=user["username"])
    return {"success": True, "maintenance_mode": req.maintenance_mode}

# ============== CHAT (per-project, public POST/GET + admin moderation) ==============
@api_router.post("/projects/{project_slug}/chat")
@limiter.limit("1/3seconds")
async def post_chat_message(request: Request, project_slug: str):
    await verify_chat_api_key(project_slug, request)
    body = await request.json()
    try:
        req = ChatMessageRequest(**body)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid request body")

    username = req.username.strip()[:32]
    message = req.message.strip()[:200]
    level = max(1, min(int(req.level), 9999)) if req.level is not None else None

    if not username or not message:
        raise HTTPException(status_code=400, detail="Username and message are required")

    banned_words = await get_banned_words()
    clean_message = censor_message(message, banned_words)

    doc = {"project_slug": project_slug, "username": username, "level": level,
           "message": clean_message, "timestamp": datetime.now(timezone.utc)}
    result = await db.chat_messages.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Keep only the last 100 messages per project
    count = await db.chat_messages.count_documents({"project_slug": project_slug})
    if count > 100:
        oldest = await db.chat_messages.find({"project_slug": project_slug}).sort("timestamp", 1).limit(count - 100).to_list(count - 100)
        await db.chat_messages.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})

    return {"success": True, "message_data": serialize_doc(doc)}

@api_router.get("/projects/{project_slug}/chat")
async def get_chat_messages(project_slug: str, limit: int = 50):
    limit = min(max(limit, 1), 100)
    messages = await db.chat_messages.find({"project_slug": project_slug}).sort("timestamp", -1).limit(limit).to_list(limit)
    messages.reverse()
    return {"messages": [serialize_doc(m) for m in messages]}

@api_router.delete("/projects/{project_slug}/chat/{message_id}")
async def delete_chat_message(project_slug: str, message_id: str, user=Depends(require_permission("manage_chat"))):
    r = await db.chat_messages.delete_one({"_id": ObjectId(message_id), "project_slug": project_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    await log_action("chat", f"Chat message deleted in '{project_slug}'", project_slug=project_slug, user=user["username"])
    return {"success": True}

@api_router.post("/projects/{project_slug}/chat/regenerate-key")
async def regenerate_chat_key(project_slug: str, user=Depends(require_permission("manage_chat"))):
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    new_key = secrets.token_urlsafe(24)
    await db.projects.update_one({"slug": project_slug}, {"$set": {"chat_api_key": new_key}})
    await log_action("chat", f"Chat API key regenerated for '{project_slug}'", project_slug=project_slug, user=user["username"])
    return {"success": True, "chat_api_key": new_key}

@api_router.get("/website/chat/banned-words")
async def list_banned_words(user=Depends(require_permission("manage_chat"))):
    return {"words": await get_banned_words()}

@api_router.put("/website/chat/banned-words")
async def update_banned_words(req: BannedWordsUpdateRequest, user=Depends(require_permission("manage_chat"))):
    words = [w.strip() for w in req.words if w.strip()]
    await db.chat_settings.update_one({"key": "banned_words"}, {"$set": {"words": words}}, upsert=True)
    await log_action("chat", "Banned words list updated", user=user["username"])
    return {"success": True, "words": words}

# ============== SHOP ==============

# ── Global shop settings ─────────────────────────────────────────────────────
@api_router.get("/shop/settings")
async def get_global_shop_settings():
    doc = await db.website_shop_global_settings.find_one({})
    if not doc:
        return {"shop_title": "Shop", "footer_text": ""}
    return serialize_doc(doc)

@api_router.put("/shop/settings")
async def update_global_shop_settings(req: ShopGlobalSettingsRequest, user=Depends(require_permission("manage_shop"))):
    updates = req.dict()
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.website_shop_global_settings.update_one({}, {"$set": updates}, upsert=True)
    await log_action("website", "Global shop settings updated", user=user["username"])
    return serialize_doc(await db.website_shop_global_settings.find_one({}))

# ── Global products list ──────────────────────────────────────────────────────
@api_router.get("/shop/products")
async def list_all_shop_products(game_slug: Optional[str] = None, category: Optional[str] = None):
    query: dict = {"active": True}
    if game_slug:
        query["game_slug"] = game_slug
    if category:
        query["category"] = category
    products = await db.website_shop_products.find(query).sort([("featured", -1), ("created_at", 1)]).to_list(500)
    return {"products": [serialize_doc(p) for p in products]}

@api_router.get("/shop/products/admin")
async def list_all_shop_products_admin(game_slug: Optional[str] = None, user=Depends(require_permission("manage_shop"))):
    query: dict = {}
    if game_slug:
        query["game_slug"] = game_slug
    products = await db.website_shop_products.find(query).sort([("game_slug", 1), ("created_at", 1)]).to_list(500)
    return {"products": [serialize_doc(p) for p in products]}

# ── Categories (derived from games with active products) ──────────────────────
@api_router.get("/shop/categories")
async def get_shop_categories():
    games = await db.website_games.find({"status": {"$in": ["published", "coming_soon"]}}).sort("name", 1).to_list(200)
    categories = []
    for g in games:
        count = await db.website_shop_products.count_documents({"game_slug": g["slug"], "active": True})
        if count > 0:
            categories.append({
                "id": g["slug"],
                "label": g["name"],
                "product_count": count,
                "logo_url": g.get("logo_url", ""),
            })
    return {"categories": categories}

# ── User loyalty ──────────────────────────────────────────────────────────────
@api_router.get("/user/loyalty")
async def get_user_loyalty(user=Depends(get_current_user)):
    doc = await db.user_points.find_one({"email": user["email"]})
    total = doc.get("total_spent_cents", 0) if doc else 0
    tier = get_tier(total)
    discount = TIER_DISCOUNTS.get(tier, 0)
    # next tier threshold
    next_tier = None
    next_threshold = None
    for t_name, t_thresh in TIER_THRESHOLDS:
        if total < t_thresh:
            next_tier = t_name
            next_threshold = t_thresh
    return {
        "total_spent_cents": total,
        "tier": tier,
        "discount_pct": discount,
        "next_tier": next_tier,
        "next_threshold_cents": next_threshold,
    }

# ── Unified shop checkout (auth required, applies loyalty discount) ────────────
@api_router.post("/shop/checkout")
@limiter.limit("10/minute")
async def create_unified_checkout(request: Request, req: ShopCheckoutRequest, user=Depends(get_current_user)):
    if not req.player_uid.strip():
        raise HTTPException(status_code=400, detail="Player ID required")
    try:
        oid = ObjectId(req.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Apply loyalty discount
    loyalty_doc = await db.user_points.find_one({"email": user["email"]})
    total_spent = loyalty_doc.get("total_spent_cents", 0) if loyalty_doc else 0
    tier = get_tier(total_spent)
    discount_pct = TIER_DISCOUNTS.get(tier, 0)
    base_price = product["price"]

    # Apply coupon if provided
    coupon_discount_pct = 0
    coupon_code_used = ""
    if req.coupon_code and req.coupon_code.strip():
        code_upper = req.coupon_code.strip().upper()
        coupon = await db.coupons.find_one({
            "code": code_upper,
            "assigned_to_user_id": user["_id"],
            "used": False,
        })
        if coupon and coupon["valid_until"] > datetime.now(timezone.utc):
            scope_ok = (
                coupon["scope"] == "all"
                or (coupon["scope"] == "product" and coupon["scope_id"] == str(product["_id"]))
            )
            if scope_ok:
                coupon_discount_pct = coupon["discount_pct"]
                coupon_code_used = code_upper

    total_discount = min(99, discount_pct + coupon_discount_pct)
    final_price = max(50, int(base_price * (1 - total_discount / 100))) if total_discount > 0 else base_price

    origin = _get_origin(request)
    images = [product["image_url"]] if (product.get("image_url") and product["image_url"].startswith("http")) else []
    desc_parts = []
    if product.get("description"):
        desc_parts.append(product["description"])
    if discount_pct > 0:
        desc_parts.append(f"{discount_pct}% {tier.capitalize()} loyalty discount applied")
    if coupon_discount_pct > 0:
        desc_parts.append(f"{coupon_discount_pct}% promo code discount applied")
    description = " · ".join(desc_parts) or ""

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": product["name"],
                        "description": description,
                        "images": images,
                    },
                    "unit_amount": final_price,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/shop/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/shop",
            metadata={
                "checkout_type": "shop_item",
                "player_uid": req.player_uid.strip(),
                "product_id": str(product["_id"]),
                "game_slug": product.get("game_slug", ""),
                "user_email": user["email"],
                "original_price": str(base_price),
                "final_price": str(final_price),
                "discount_pct": str(total_discount),
                "coupon_code": coupon_code_used,
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Stripe unified checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "final_price": final_price,
        "discount_pct": total_discount,
        "coupon_applied": coupon_discount_pct > 0,
        "coupon_discount_pct": coupon_discount_pct,
    }

# ── Game purchase checkout ────────────────────────────────────────────────────
@api_router.post("/games/{game_slug}/checkout")
@limiter.limit("10/minute")
async def create_game_checkout(request: Request, game_slug: str, req: GamePurchaseCheckoutRequest, user=Depends(get_current_user)):
    game = await db.website_games.find_one({"slug": game_slug, "status": "published"})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    base_price = game.get("price_cents", 0)
    if base_price <= 0:
        raise HTTPException(status_code=400, detail="This game is free")

    # Check if already purchased
    existing = await db.game_purchases.find_one({"email": user["email"], "game_slug": game_slug})
    if existing:
        raise HTTPException(status_code=409, detail="You already own this game")

    # Apply coupon if provided
    coupon_discount_pct = 0
    coupon_code_used = ""
    if req.coupon_code and req.coupon_code.strip():
        code_upper = req.coupon_code.strip().upper()
        coupon = await db.coupons.find_one({
            "code": code_upper,
            "assigned_to_user_id": user["_id"],
            "used": False,
        })
        if coupon and coupon["valid_until"] > datetime.now(timezone.utc):
            scope_ok = (
                coupon["scope"] == "all"
                or (coupon["scope"] == "game" and coupon["scope_id"] == game_slug)
            )
            if scope_ok:
                coupon_discount_pct = coupon["discount_pct"]
                coupon_code_used = code_upper

    price = max(50, int(base_price * (1 - coupon_discount_pct / 100))) if coupon_discount_pct > 0 else base_price

    origin = _get_origin(request)
    images = [game["logo_url"]] if (game.get("logo_url") and game["logo_url"].startswith("http")) else []
    desc_parts = [game.get("description") or ""]
    if coupon_discount_pct > 0:
        desc_parts.append(f"{coupon_discount_pct}% promo code discount applied")
    description = " · ".join(p for p in desc_parts if p)

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": game["name"],
                        "description": description,
                        "images": images,
                    },
                    "unit_amount": price,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/shop/success?session_id={{CHECKOUT_SESSION_ID}}&type=game",
            cancel_url=f"{origin}/games",
            metadata={
                "checkout_type": "game_purchase",
                "game_slug": game_slug,
                "game_name": game["name"],
                "user_email": user["email"],
                "coupon_code": coupon_code_used,
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Stripe game checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {"checkout_url": session.url, "session_id": session.id}

# ── Check if user purchased a game ───────────────────────────────────────────
@api_router.get("/games/{game_slug}/purchased")
async def check_game_purchased(game_slug: str, user=Depends(get_current_user)):
    purchase = await db.game_purchases.find_one({"email": user["email"], "game_slug": game_slug})
    return {"purchased": purchase is not None, "game_slug": game_slug}

# ── List game purchases (admin) ──────────────────────────────────────────────
@api_router.get("/games/{game_slug}/purchases")
async def list_game_purchases(game_slug: str, user=Depends(require_permission("manage_shop"))):
    purchases = await db.game_purchases.find({"game_slug": game_slug}).sort("purchased_at", -1).to_list(1000)
    return {"purchases": [serialize_doc(p) for p in purchases]}

@api_router.get("/shop/{game_slug}/products")
async def list_shop_products_public(game_slug: str):
    products = await db.website_shop_products.find({"game_slug": game_slug, "active": True}).sort("created_at", 1).to_list(200)
    return {"products": [serialize_doc(p) for p in products]}

@api_router.get("/shop/{game_slug}/products/admin")
async def list_shop_products_admin(game_slug: str, user=Depends(require_permission("manage_shop"))):
    products = await db.website_shop_products.find({"game_slug": game_slug}).sort("created_at", 1).to_list(200)
    return {"products": [serialize_doc(p) for p in products]}

@api_router.post("/shop/{game_slug}/products")
async def create_shop_product(game_slug: str, req: ShopProductCreateRequest, user=Depends(require_permission("manage_shop"))):
    if not await db.projects.find_one({"slug": req.project_slug}):
        raise HTTPException(status_code=404, detail="Project not found")
    doc = {
        "game_slug": game_slug,
        "name": req.name,
        "description": req.description,
        "price": req.price,
        "image_url": req.image_url,
        "badge": req.badge,
        "discount_pct": req.discount_pct,
        "project_slug": req.project_slug,
        "variable": req.variable,
        "amount": req.amount,
        "active": req.active,
        "category": req.category,
        "subcategory": req.subcategory,
        "featured": req.featured,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["username"],
    }
    result = await db.website_shop_products.insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_action("website", f"Shop product '{req.name}' created for game '{game_slug}'", user=user["username"])
    return {"success": True, "product": serialize_doc(doc)}

@api_router.put("/shop/{game_slug}/products/{product_id}")
async def update_shop_product(game_slug: str, product_id: str, req: ShopProductUpdateRequest, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid, "game_slug": game_slug})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if "project_slug" in updates and not await db.projects.find_one({"slug": updates["project_slug"]}):
        raise HTTPException(status_code=404, detail="Project not found")
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.website_shop_products.update_one({"_id": oid}, {"$set": updates})
    updated = await db.website_shop_products.find_one({"_id": oid})
    await log_action("website", f"Shop product '{product_id}' updated for '{game_slug}'", user=user["username"])
    return {"success": True, "product": serialize_doc(updated)}

@api_router.delete("/shop/{game_slug}/products/{product_id}")
async def delete_shop_product(game_slug: str, product_id: str, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    r = await db.website_shop_products.delete_one({"_id": oid, "game_slug": game_slug})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await log_action("website", f"Shop product '{product_id}' deleted from '{game_slug}'", user=user["username"])
    return {"success": True}

@api_router.get("/shop/{game_slug}/settings")
async def get_shop_settings(game_slug: str):
    doc = await db.website_shop_settings.find_one({"game_slug": game_slug})
    if not doc:
        return {"game_slug": game_slug, "shop_title": "", "banner_url": "", "banner_title": "", "banner_subtitle": "",
                "banner_height": "md", "banner_overlay": "rgba(0,0,0,0.55)",
                "primary_color": "#6C5CE7", "accent_color": "#A29BFE",
                "background_color": "", "surface_color": "", "border_color": "",
                "text_color": "", "text_muted_color": "", "price_color": "",
                "bg_texture_url": "", "bg_texture_opacity": 0.05,
                "card_style": "rounded", "card_shadow": "sm",
                "featured_section_title": "Featured Offers", "footer_text": "", "categories": []}
    return serialize_doc(doc)

@api_router.put("/shop/{game_slug}/settings")
async def update_shop_settings(game_slug: str, req: ShopSettingsRequest, user=Depends(require_permission("manage_shop"))):
    updates = req.dict()
    updates["game_slug"] = game_slug
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = user["username"]
    await db.website_shop_settings.update_one({"game_slug": game_slug}, {"$set": updates}, upsert=True)
    await log_action("website", f"Shop settings updated for '{game_slug}'", user=user["username"])
    result = await db.website_shop_settings.find_one({"game_slug": game_slug})
    return serialize_doc(result)

@api_router.post("/shop/{game_slug}/checkout")
@limiter.limit("10/minute")
async def create_checkout_session(request: Request, game_slug: str, req: ShopCheckoutRequest, user=Depends(get_current_user)):
    if not req.player_uid.strip():
        raise HTTPException(status_code=400, detail="Player UID required")
    try:
        oid = ObjectId(req.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid, "game_slug": game_slug, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    origin = _get_origin()
    images = [product["image_url"]] if (product.get("image_url") and product["image_url"].startswith("http")) else []

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": product["name"],
                        "description": product.get("description") or "",
                        "images": images,
                    },
                    "unit_amount": product["price"],
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/shop/{game_slug}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/shop/{game_slug}",
            metadata={
                "player_uid": req.player_uid.strip(),
                "product_id": str(product["_id"]),
                "game_slug": game_slug,
            },
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable")

    return {"checkout_url": session.url, "session_id": session.id}

@api_router.get("/shop/session/{session_id}/status")
@limiter.limit("60/minute")
async def get_session_status(request: Request, session_id: str):
    def _retrieve():
        return stripe.checkout.Session.retrieve(session_id)
    try:
        session = await asyncio.to_thread(_retrieve)
        return {"status": session.status, "payment_status": session.payment_status}
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

# ── Daily Gift ──────────────────────────────────────────────────────────────
@api_router.get("/shop/{game_slug}/daily-gift")
@limiter.limit("60/minute")
async def get_daily_gift(request: Request, game_slug: str, player_uid: Optional[str] = None):
    gift = await db.website_shop_daily_gifts.find_one({"game_slug": game_slug})
    if not gift or not gift.get("active"):
        return {"active": False}
    result = serialize_doc(gift)
    now = datetime.now(timezone.utc)
    tomorrow = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) + timedelta(days=1)
    result["resets_at"] = tomorrow.isoformat()
    result["seconds_until_reset"] = int((tomorrow - now).total_seconds())
    if player_uid:
        date_key = now.date().isoformat()
        existing = await db.website_shop_daily_claims.find_one({
            "game_slug": game_slug, "player_uid": player_uid.strip(),
            "date_key": date_key,
        })
        result["claimed"] = existing is not None
    else:
        result["claimed"] = None
    return result

@api_router.post("/shop/{game_slug}/daily-gift/claim")
@limiter.limit("10/minute")
async def claim_daily_gift(request: Request, game_slug: str, req: DailyGiftClaimRequest):
    player_uid = req.player_uid.strip()
    if not player_uid:
        raise HTTPException(status_code=400, detail="Player UID required")
    gift = await db.website_shop_daily_gifts.find_one({"game_slug": game_slug, "active": True})
    if not gift:
        raise HTTPException(status_code=404, detail="No active daily gift")
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    tomorrow = today_start + timedelta(days=1)
    date_key = today_start.date().isoformat()
    seconds_left = int((tomorrow - now).total_seconds())

    # Atomic claim slot reservation using find_one_and_update + upsert.
    # MongoDB guarantees only one concurrent request can perform the insert —
    # all others will find the document already exists and get it returned.
    # return_document=False → returns the PRE-UPDATE doc (None if newly inserted).
    existing = await db.website_shop_daily_claims.find_one_and_update(
        {"game_slug": game_slug, "player_uid": player_uid, "date_key": date_key},
        {"$setOnInsert": {"claimed_at": now}},
        upsert=True,
        return_document=False,
    )
    if existing is not None:
        # Document existed before → already claimed today
        raise HTTPException(status_code=409, detail=f"Already claimed today. Resets in {seconds_left} seconds.")

    # Also block old-format claims (records without date_key, from before this fix)
    old_claim = await db.website_shop_daily_claims.find_one({
        "game_slug": game_slug, "player_uid": player_uid,
        "date_key": {"$exists": False},
        "claimed_at": {"$gte": today_start},
    })
    if old_claim:
        # Rollback the slot we just reserved, then reject
        await db.website_shop_daily_claims.delete_one(
            {"game_slug": game_slug, "player_uid": player_uid, "date_key": date_key}
        )
        raise HTTPException(status_code=409, detail=f"Already claimed today. Resets in {seconds_left} seconds.")

    project = await db.projects.find_one({"slug": gift["project_slug"]})
    if not project:
        raise HTTPException(status_code=500, detail="Daily gift project configuration error")
    await db.items.insert_one({
        "project_slug": gift["project_slug"],
        "uid": player_uid,
        "variable": gift["variable"],
        "amount": gift["amount"],
        "created_at": now,
        "created_by": "daily_gift",
    })
    return {"success": True, "item": gift["variable"], "amount": gift["amount"]}

@api_router.get("/shop/{game_slug}/daily-gift/admin")
async def get_daily_gift_admin(game_slug: str, user=Depends(require_permission("manage_shop"))):
    gift = await db.website_shop_daily_gifts.find_one({"game_slug": game_slug})
    if not gift:
        return {"game_slug": game_slug, "active": False, "title": "Daily Gift",
                "description": "", "image_url": "", "project_slug": "", "variable": "", "amount": ""}
    return serialize_doc(gift)

@api_router.put("/shop/{game_slug}/daily-gift")
async def update_daily_gift(game_slug: str, req: DailyGiftConfigRequest, user=Depends(require_permission("manage_shop"))):
    updates = req.dict()
    updates["game_slug"] = game_slug
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = user["username"]
    await db.website_shop_daily_gifts.update_one({"game_slug": game_slug}, {"$set": updates}, upsert=True)
    await log_action("website", f"Daily gift updated for '{game_slug}'", user=user["username"])
    return serialize_doc(await db.website_shop_daily_gifts.find_one({"game_slug": game_slug}))

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
}
_PREVIEW_TYPES = {
    ".svg":  "image/svg+xml",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}
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

@api_router.get("/admin/projects/{slug}/files-api-key")
async def get_files_api_key(slug: str, user=Depends(require_permission("view_projects"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"files_api_key": project.get("files_api_key") or None}

@api_router.post("/admin/projects/{slug}/files-api-key/regenerate")
async def regenerate_files_api_key(slug: str, user=Depends(require_permission("view_projects"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    new_key = secrets.token_urlsafe(32)
    await db.projects.update_one({"slug": slug}, {"$set": {"files_api_key": new_key}})
    await log_action("website", f"Files API key regenerated for project '{slug}'", user=user["username"])
    return {"files_api_key": new_key}

# ── Admin: upload file ────────────────────────────────────────────────────────

@api_router.post("/admin/projects/{slug}/files")
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
    user=Depends(require_permission("view_projects")),
):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _GAME_FILE_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext or '(none)'}")

    content = await file.read()
    if len(content) > _GAME_FILE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 500 MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    file_id = ObjectId()
    file_id_hex = str(file_id)

    dest = _game_file_path(slug, file_id_hex)
    with open(dest, "wb") as f:
        f.write(content)

    display_name = name.strip() or Path(file.filename or "").stem or "Unnamed file"
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
        "download_count": 0,
        "uploaded_by": user["username"],
        "uploaded_at": datetime.now(timezone.utc),
    }
    await db.game_files.insert_one(doc)
    await log_action("website", f"Game file '{display_name}' uploaded for project '{slug}'", user=user["username"])
    return {"success": True, "file": serialize_doc(doc)}

# ── Admin: replace file content (keeps same ID) ───────────────────────────────

@api_router.put("/admin/projects/{slug}/files/{file_id}/replace")
async def replace_game_file(
    slug: str,
    file_id: str,
    file: UploadFile = File(...),
    user=Depends(require_permission("view_projects")),
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

    dest = _game_file_path(slug, file_id)
    with open(dest, "wb") as f:
        f.write(content)

    updates = {
        "original_filename": file.filename or doc["original_filename"],
        "size_bytes": len(content),
        "uploaded_by": user["username"],
        "uploaded_at": datetime.now(timezone.utc),
    }
    await db.game_files.update_one({"_id": oid}, {"$set": updates})
    await log_action("website", f"Game file '{doc['name']}' replaced for project '{slug}'", user=user["username"])
    updated = await db.game_files.find_one({"_id": oid})
    return {"success": True, "file": serialize_doc(updated)}

# ── Admin: update metadata ────────────────────────────────────────────────────

@api_router.put("/admin/projects/{slug}/files/{file_id}")
async def update_game_file_meta(
    slug: str,
    file_id: str,
    req: GameFileUpdateRequest,
    user=Depends(require_permission("view_projects")),
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

@api_router.delete("/admin/projects/{slug}/files/{file_id}")
async def delete_game_file(slug: str, file_id: str, user=Depends(require_permission("view_projects"))):
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
    await log_action("website", f"Game file '{doc['name']}' deleted from project '{slug}'", user=user["username"])
    return {"success": True}

# ── Admin: preview image file ─────────────────────────────────────────────────

@api_router.get("/admin/projects/{slug}/files/{file_id}/preview")
async def preview_game_file_admin(slug: str, file_id: str, user=Depends(require_permission("view_projects"))):
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
        raise HTTPException(status_code=400, detail="Not a previewable image file")
    dest = _game_file_path(slug, file_id)
    if not dest.exists():
        raise HTTPException(status_code=404, detail="File data missing on server")
    return FileResponse(dest, media_type=media_type)

# ── Admin: list files ─────────────────────────────────────────────────────────

@api_router.get("/admin/projects/{slug}/files")
async def list_game_files_admin(
    slug: str,
    version_tag: Optional[str] = None,
    user=Depends(require_permission("view_projects")),
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

@api_router.get("/game/{slug}/files")
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
        doc["download_url"] = f"{base_url}/api/game/{slug}/files/{doc['id']}/download"
        doc["resolved_version"] = resolved_version
        result.append(doc)
    return {"files": result, "resolved_version": resolved_version}

# ── Game client: download file (API key auth) ─────────────────────────────────

@api_router.get("/game/{slug}/files/{file_id}/download")
async def download_game_file_client(slug: str, file_id: str, request: Request):
    await _verify_files_api_key(slug, request)
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
    await db.game_files.update_one({"_id": oid}, {"$inc": {"download_count": 1}})
    safe_name = re.sub(r"[^\w.\- ]", "_", doc.get("original_filename") or doc["name"])
    return FileResponse(
        dest,
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )

# ── Game file versions ────────────────────────────────────────────────────────

@api_router.get("/admin/projects/{slug}/versions")
async def list_file_versions(slug: str, user=Depends(require_permission("view_projects"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    pipeline = [
        {"$match": {"project_slug": slug}},
        {"$group": {"_id": "$version_tag"}},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.game_files.aggregate(pipeline).to_list(200)
    tags = []
    for r in raw:
        t = r["_id"]
        if t is None:
            t = "default"
        if t not in tags:
            tags.append(t)
    if "default" not in tags:
        tags.insert(0, "default")
    return {"versions": tags, "live_version": project.get("live_version") or "default"}

class VersionCloneRequest(BaseModel):
    new_tag: str

@api_router.post("/admin/projects/{slug}/versions")
async def clone_file_version(slug: str, req: VersionCloneRequest, user=Depends(require_permission("view_projects"))):
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

        import shutil
        shutil.copy2(src_path, dest_path)

        new_doc = {k: v for k, v in src.items() if k != "_id"}
        new_doc["_id"] = new_id
        new_doc["version_tag"] = new_tag
        new_doc["download_count"] = 0
        new_doc["uploaded_at"] = datetime.now(timezone.utc)
        new_doc["cloned_from"] = src_id
        await db.game_files.insert_one(new_doc)
        cloned += 1

    await log_action("website", f"Version '{new_tag}' cloned from existing files for project '{slug}' ({cloned} files)", user=user["username"])
    return {"success": True, "version_tag": new_tag, "files_cloned": cloned}

# ── Live version (public + admin) ─────────────────────────────────────────────

@api_router.get("/game/{slug}/live-version")
async def get_live_version_client(slug: str, request: Request):
    await _verify_files_api_key(slug, request)
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"live_version": project.get("live_version") or "default"}

class LiveVersionRequest(BaseModel):
    live_version: str

@api_router.put("/admin/projects/{slug}/live-version")
async def set_live_version(slug: str, req: LiveVersionRequest, user=Depends(require_permission("view_projects"))):
    tag = req.live_version.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="Version tag required")
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.projects.update_one({"slug": slug}, {"$set": {"live_version": tag}})
    await log_action("website", f"Live version set to '{tag}' for project '{slug}'", user=user["username"])
    return {"success": True, "live_version": tag}

# ── Coupon campaign endpoints ────────────────────────────────────────────────

@api_router.post("/admin/coupons/campaign")
async def create_coupon_campaign(req: CouponCampaignRequest, user=Depends(require_permission("manage_shop"))):
    if not 1 <= req.discount_pct <= 99:
        raise HTTPException(status_code=400, detail="Discount must be between 1 and 99%")
    if req.valid_days < 1:
        raise HTTPException(status_code=400, detail="Valid days must be at least 1")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Campaign name is required")

    # Resolve target users
    if req.target_type == "tier":
        if not req.target_tiers:
            raise HTTPException(status_code=400, detail="Select at least one tier")
        all_points = await db.user_points.find({}).to_list(10000)
        target_emails = [p["email"] for p in all_points if get_tier(p.get("total_spent_cents", 0)) in req.target_tiers]
        target_users = await db.users.find({"email": {"$in": target_emails}}).to_list(10000)
    else:
        if not req.target_user_ids:
            raise HTTPException(status_code=400, detail="Select at least one user")
        oids = []
        for uid in req.target_user_ids:
            try:
                oids.append(ObjectId(uid))
            except Exception:
                pass
        target_users = await db.users.find({"_id": {"$in": oids}}).to_list(10000)

    if not target_users:
        raise HTTPException(status_code=400, detail="No users found for the selected target")

    valid_until = datetime.now(timezone.utc) + timedelta(days=req.valid_days)
    campaign_id = ObjectId()
    now = datetime.now(timezone.utc)

    scope_str = ""
    if req.scope == "product" and req.scope_name:
        scope_str = f" (for: {req.scope_name})"
    elif req.scope == "game" and req.scope_name:
        scope_str = f" (for game: {req.scope_name})"

    codes_sent = 0
    for u in target_users:
        # Generate a unique code
        code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        while await db.coupons.find_one({"code": code}):
            code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))

        await db.coupons.insert_one({
            "code": code,
            "campaign_id": campaign_id,
            "discount_pct": req.discount_pct,
            "valid_until": valid_until,
            "scope": req.scope,
            "scope_id": req.scope_id,
            "scope_name": req.scope_name,
            "assigned_to_user_id": u["_id"],
            "assigned_to_email": u["email"],
            "used": False,
            "used_at": None,
            "created_at": now,
            "created_by": user["username"],
        })

        msg = (
            f"🎁 You received a promo code: {code} — {req.discount_pct}% off{scope_str}. "
            f"Valid until {valid_until.strftime('%Y-%m-%d')}. Enter it at checkout!"
        )
        await _create_notification(str(u["_id"]), msg, notif_type="coupon", link="/shop")
        codes_sent += 1

    await db.coupon_campaigns.insert_one({
        "_id": campaign_id,
        "name": req.name.strip(),
        "target_type": req.target_type,
        "target_tiers": req.target_tiers,
        "discount_pct": req.discount_pct,
        "valid_days": req.valid_days,
        "valid_until": valid_until,
        "scope": req.scope,
        "scope_id": req.scope_id,
        "scope_name": req.scope_name,
        "codes_count": codes_sent,
        "created_by": user["username"],
        "created_at": now,
    })
    await log_action("website", f"Coupon campaign '{req.name}' created: {codes_sent} codes sent", user=user["username"])
    return {"success": True, "campaign_id": str(campaign_id), "codes_sent": codes_sent}


@api_router.get("/admin/coupons/campaigns")
async def list_coupon_campaigns(user=Depends(require_permission("manage_shop"))):
    campaigns = await db.coupon_campaigns.find({}).sort("created_at", -1).to_list(200)
    return {"campaigns": [serialize_doc(c) for c in campaigns]}


@api_router.get("/admin/coupons/campaign/{campaign_id}")
async def get_coupon_campaign_detail(campaign_id: str, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.coupon_campaigns.find_one({"_id": oid})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    codes = await db.coupons.find({"campaign_id": oid}).sort("assigned_to_email", 1).to_list(10000)
    return {"campaign": serialize_doc(campaign), "codes": [serialize_doc(c) for c in codes]}


@api_router.post("/coupons/validate")
async def validate_coupon(req: CouponValidateRequest, user=Depends(get_current_user)):
    code = req.code.strip().upper()
    coupon = await db.coupons.find_one({"code": code, "assigned_to_user_id": user["_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if coupon["used"]:
        raise HTTPException(status_code=400, detail="This coupon has already been used")
    if coupon["valid_until"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This coupon has expired")
    if coupon["scope"] == "product" and req.product_id and coupon["scope_id"] != req.product_id:
        scope_name = coupon.get("scope_name") or "a specific product"
        raise HTTPException(status_code=400, detail=f"This coupon is only valid for: {scope_name}")
    if coupon["scope"] == "game" and req.game_slug and coupon["scope_id"] != req.game_slug:
        scope_name = coupon.get("scope_name") or "a specific game"
        raise HTTPException(status_code=400, detail=f"This coupon is only valid for: {scope_name}")
    return {
        "valid": True,
        "discount_pct": coupon["discount_pct"],
        "scope": coupon["scope"],
        "scope_name": coupon.get("scope_name", ""),
        "valid_until": coupon["valid_until"].isoformat(),
    }

# ── Stripe webhook ────────────────────────────────────────────────────────────

@api_router.post("/shop/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    def _construct():
        return stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)

    try:
        event = await asyncio.to_thread(_construct)
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        checkout_type = meta.get("checkout_type", "")
        amount_paid = session.get("amount_total", 0)

        if checkout_type == "shop_item":
            uid = meta.get("player_uid", "").strip()
            product_id = meta.get("product_id", "")
            game_slug_meta = meta.get("game_slug", "")
            user_email = meta.get("user_email", "")
            product = None
            # Deliver item
            if uid and product_id:
                try:
                    product = await db.website_shop_products.find_one({"_id": ObjectId(product_id)})
                    if product:
                        await db.items.insert_one({
                            "project_slug": product["project_slug"],
                            "uid": uid,
                            "variable": product["variable"],
                            "amount": product["amount"],
                            "created_at": datetime.now(timezone.utc),
                            "created_by": "stripe_shop",
                        })
                        await log_action("send",
                            f"Shop: {product['amount']}x {product['variable']} → {uid} (Stripe)",
                            project_slug=product["project_slug"], user="stripe_shop",
                            uid=uid, variable=product["variable"], amount=product["amount"])
                        logger.info(f"Shop delivery OK: {product['amount']}x {product['variable']} to {uid}")
                except Exception as e:
                    logger.error(f"Shop delivery error: {e}")
            # Update loyalty (only shop items give points)
            if user_email and amount_paid > 0:
                try:
                    await _update_loyalty(user_email, amount_paid)
                    logger.info(f"Loyalty updated for {user_email}: +{amount_paid} cents")
                except Exception as e:
                    logger.error(f"Loyalty update error: {e}")
            # Mark coupon as used
            coupon_code = meta.get("coupon_code", "")
            if coupon_code:
                try:
                    await db.coupons.update_one(
                        {"code": coupon_code},
                        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
                    )
                except Exception as e:
                    logger.error(f"Coupon mark-used error: {e}")
            # Notify user of successful purchase
            if user_email:
                try:
                    u = await db.users.find_one({"email": user_email})
                    if u:
                        product_name = product.get("name", "item") if product else "item"
                        await _create_notification(
                            user_id=str(u["_id"]),
                            message=f"✅ Purchase confirmed: {product_name} — ${amount_paid/100:.2f}. Your items will be delivered in-game at next login.",
                            notif_type="purchase_success",
                        )
                except Exception as e:
                    logger.error(f"Purchase notification error: {e}")

        elif checkout_type == "game_purchase":
            game_slug_meta = meta.get("game_slug", "")
            game_name = meta.get("game_name", "")
            user_email = meta.get("user_email", "")
            if user_email and game_slug_meta:
                try:
                    await db.game_purchases.update_one(
                        {"email": user_email, "game_slug": game_slug_meta},
                        {"$setOnInsert": {
                            "email": user_email,
                            "game_slug": game_slug_meta,
                            "game_name": game_name,
                            "stripe_session_id": session.get("id", ""),
                            "amount_paid_cents": amount_paid,
                            "purchased_at": datetime.now(timezone.utc),
                        }},
                        upsert=True,
                    )
                    logger.info(f"Game purchase recorded: {user_email} → {game_slug_meta}")
                    # Mark coupon as used
                    coupon_code = meta.get("coupon_code", "")
                    if coupon_code:
                        await db.coupons.update_one(
                            {"code": coupon_code},
                            {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
                        )
                    # Notify user
                    u = await db.users.find_one({"email": user_email})
                    if u:
                        await _create_notification(
                            user_id=str(u["_id"]),
                            message=f"🎮 Game unlocked: {game_name} — ${amount_paid/100:.2f}. Sign in to start playing.",
                            notif_type="game_purchase_success",
                        )
                except Exception as e:
                    logger.error(f"Game purchase record error: {e}")

        else:
            # Backward compat: old sessions without checkout_type metadata
            uid = meta.get("player_uid", "").strip()
            product_id = meta.get("product_id", "")
            game_slug_meta = meta.get("game_slug", "")
            if uid and product_id and game_slug_meta:
                try:
                    product = await db.website_shop_products.find_one({"_id": ObjectId(product_id), "game_slug": game_slug_meta})
                    if product:
                        await db.items.insert_one({
                            "project_slug": product["project_slug"],
                            "uid": uid,
                            "variable": product["variable"],
                            "amount": product["amount"],
                            "created_at": datetime.now(timezone.utc),
                            "created_by": "stripe_shop",
                        })
                        await log_action("send",
                            f"Shop: {product['amount']}x {product['variable']} → {uid} (Stripe legacy)",
                            project_slug=product["project_slug"], user="stripe_shop",
                            uid=uid, variable=product["variable"], amount=product["amount"])
                except Exception as e:
                    logger.error(f"Legacy shop webhook error: {e}")

    elif event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        user_email = meta.get("user_email", "")
        checkout_type = meta.get("checkout_type", "")
        subject = meta.get("game_name") if checkout_type == "game_purchase" else "your purchase"
        if user_email:
            try:
                u = await db.users.find_one({"email": user_email})
                if u:
                    await _create_notification(
                        user_id=str(u["_id"]),
                        message=f"❌ Payment failed or expired for {subject}. Please try again from the shop.",
                        notif_type="purchase_failed",
                    )
            except Exception as e:
                logger.error(f"Failed purchase notification error: {e}")

    return {"received": True}

# ============== SUPPORT TICKETS ==============

@api_router.post("/tickets")
@limiter.limit("5/hour")
async def create_ticket(request: Request, req: TicketCreateRequest, user=Depends(get_current_user)):
    subject = req.subject.strip()[:200]
    message = req.message.strip()[:2000]
    email = user["email"]
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required")
    ticket_number = "TKT-" + secrets.token_hex(3).upper()
    while await db.support_tickets.find_one({"ticket_number": ticket_number}):
        ticket_number = "TKT-" + secrets.token_hex(3).upper()
    user_id_oid = ObjectId(user["id"])
    username = user.get("username", user["email"])
    doc = {
        "ticket_number": ticket_number,
        "subject": subject,
        "category": req.category,
        "status": "open",
        "priority": "normal",
        "user_email": email,
        "user_id": user_id_oid,
        "username": username,
        "messages": [{
            "sender": "user",
            "author_name": username,
            "content": message,
            "timestamp": datetime.now(timezone.utc),
        }],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.support_tickets.insert_one(doc)
    await log_action("support", f"New ticket {ticket_number}: '{subject}' from {email}")
    return {"success": True, "ticket_number": ticket_number}

@api_router.get("/tickets/mine")
async def list_my_tickets(user=Depends(get_current_user)):
    email = user.get("email", "").lower()
    tickets = await db.support_tickets.find({"user_email": email}).sort("created_at", -1).to_list(50)
    return {"tickets": [serialize_doc(t) for t in tickets]}

@api_router.get("/tickets/{ticket_number}")
async def get_ticket(ticket_number: str, user=Depends(get_current_user)):
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    is_owner = t.get("user_email", "").lower() == user.get("email", "").lower()
    has_perm = user.get("is_super_admin") or "manage_tickets" in user.get("permissions", [])
    if not is_owner and not has_perm:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"ticket": serialize_doc(t)}

@api_router.post("/tickets/{ticket_number}/reply")
@limiter.limit("20/hour")
async def reply_to_ticket(request: Request, ticket_number: str, req: TicketReplyRequest, user=Depends(get_current_user)):
    content = req.content.strip()[:2000]
    if not content:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if t.get("user_email", "").lower() != user.get("email", "").lower():
        raise HTTPException(status_code=403, detail="Not your ticket")
    if t.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Ticket is closed")
    await db.support_tickets.update_one(
        {"ticket_number": ticket_number.upper()},
        {
            "$push": {"messages": {"sender": "user", "author_name": user.get("username", "User"), "content": content, "timestamp": datetime.now(timezone.utc)}},
            "$set": {"updated_at": datetime.now(timezone.utc), "status": "open"},
        }
    )
    return {"success": True}

@api_router.get("/admin/tickets")
async def list_all_tickets(status: Optional[str] = None, priority: Optional[str] = None,
                            page: int = 1, limit: int = 50,
                            user=Depends(require_permission("manage_tickets"))):
    q: dict = {}
    if status:
        q["status"] = status
    if priority:
        q["priority"] = priority
    skip = (page - 1) * limit
    total = await db.support_tickets.count_documents(q)
    tickets = await db.support_tickets.find(q).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    return {
        "tickets": [serialize_doc(t) for t in tickets],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }

@api_router.patch("/admin/tickets/{ticket_number}")
async def update_ticket_status(ticket_number: str, req: TicketStatusUpdateRequest, user=Depends(require_permission("manage_tickets"))):
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if req.status is not None:
        updates["status"] = req.status
    if req.priority is not None:
        updates["priority"] = req.priority
    await db.support_tickets.update_one({"ticket_number": ticket_number.upper()}, {"$set": updates})
    return {"success": True}

@api_router.post("/admin/tickets/{ticket_number}/reply")
async def admin_reply_to_ticket(ticket_number: str, req: TicketReplyRequest, user=Depends(require_permission("manage_tickets"))):
    content = req.content.strip()[:2000]
    if not content:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.support_tickets.update_one(
        {"ticket_number": ticket_number.upper()},
        {
            "$push": {"messages": {"sender": "support", "author_name": user.get("username", "Support"), "content": content, "timestamp": datetime.now(timezone.utc)}},
            "$set": {"updated_at": datetime.now(timezone.utc), "status": "in_progress"},
        }
    )
    user_account = await db.users.find_one({"email": t.get("user_email", "")})
    if user_account:
        await _create_notification(
            user_id=str(user_account["_id"]),
            message=f"💬 Support replied to your ticket [{ticket_number.upper()}]: \"{content[:80]}{'...' if len(content) > 80 else ''}\"",
            notif_type="ticket_reply",
            link="/profile",
        )
    await log_action("support", f"Admin '{user['username']}' replied to ticket {ticket_number.upper()}")
    return {"success": True}

# ============== MISSIONS ==============
@api_router.get("/projects/{slug}/missions")
async def list_missions(slug: str, status: str = None, page: int = 1, limit: int = 50, user=Depends(get_current_user)):

    query = {"project_slug": slug}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    total = await db.missions.count_documents(query)
    missions = await db.missions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for m in missions:
        m["id"] = str(m.pop("_id"))
    return {"missions": missions, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

@api_router.post("/projects/{slug}/missions")
async def create_mission(slug: str, req: MissionCreateRequest, user=Depends(require_permission("create_missions"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    doc = {
        "project_slug": slug,
        "title": req.title.strip(),
        "description": req.description.strip(),
        "style_description": req.style_description.strip(),
        "reference_images": req.reference_images,
        "priority": req.priority,
        "status": "open",
        "created_by": user["username"],
        "created_at": datetime.now(timezone.utc),
        "claimed_by": None,
        "claimed_at": None,
        "completed_at": None,
    }
    result = await db.missions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    await log_action("missions", f"Mission created: {req.title}", user=user["username"], project_slug=slug)
    return doc

@api_router.put("/projects/{slug}/missions/{mission_id}")
async def update_mission(slug: str, mission_id: str, req: MissionUpdateRequest, user=Depends(get_current_user)):
    from bson import ObjectId
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_creator = mission["created_by"] == user["username"]
    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Not authorized to edit this mission")
    update = {k: v for k, v in req.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.missions.update_one({"_id": ObjectId(mission_id)}, {"$set": update})
    return {"success": True}

@api_router.delete("/projects/{slug}/missions/{mission_id}")
async def delete_mission(slug: str, mission_id: str, user=Depends(get_current_user)):
    from bson import ObjectId
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_creator = mission["created_by"] == user["username"]
    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Not authorized to delete this mission")
    await db.missions.delete_one({"_id": ObjectId(mission_id)})
    await log_action("missions", f"Mission deleted: {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

@api_router.post("/projects/{slug}/missions/{mission_id}/claim")
async def claim_mission(slug: str, mission_id: str, user=Depends(require_permission("claim_missions"))):
    from bson import ObjectId
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if mission["status"] != "open":
        raise HTTPException(status_code=409, detail="Mission is not available (already claimed or closed)")
    now = datetime.now(timezone.utc)
    await db.missions.update_one(
        {"_id": ObjectId(mission_id)},
        {"$set": {"status": "in_progress", "claimed_by": user["username"], "claimed_at": now}}
    )
    await log_action("missions", f"Mission claimed: {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

@api_router.post("/projects/{slug}/missions/{mission_id}/unclaim")
async def unclaim_mission(slug: str, mission_id: str, user=Depends(get_current_user)):
    from bson import ObjectId
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_claimant = mission.get("claimed_by") == user["username"]
    if not is_admin and not is_claimant:
        raise HTTPException(status_code=403, detail="You did not claim this mission")
    await db.missions.update_one(
        {"_id": ObjectId(mission_id)},
        {"$set": {"status": "open", "claimed_by": None, "claimed_at": None}}
    )
    return {"success": True}

@api_router.post("/projects/{slug}/missions/{mission_id}/complete")
async def complete_mission(slug: str, mission_id: str, req: MissionCompleteRequest = None, user=Depends(get_current_user)):
    from bson import ObjectId
    if req is None:
        req = MissionCompleteRequest()
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_claimant = mission.get("claimed_by") == user["username"]
    if not is_admin and not is_claimant:
        raise HTTPException(status_code=403, detail="Only the assigned member or an admin can complete this mission")
    now = datetime.now(timezone.utc)
    round_num = len(mission.get("revisions", [])) + 1
    revision = {
        "round": round_num,
        "delivery_files": req.delivery_files,
        "delivered_by": user["username"],
        "delivered_at": now.isoformat(),
        "feedback": None,
        "feedback_by": None,
        "feedback_at": None,
    }
    await db.missions.update_one(
        {"_id": ObjectId(mission_id)},
        {
            "$set": {
                "status": "completed",
                "completed_at": now,
                "delivery_files": req.delivery_files,
            },
            "$push": {"revisions": revision},
        }
    )
    await log_action("missions", f"Mission completed (round {round_num}): {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

@api_router.post("/projects/{slug}/missions/{mission_id}/reopen")
async def reopen_mission(slug: str, mission_id: str, req: MissionReopenRequest, user=Depends(get_current_user)):
    from bson import ObjectId
    mission = await db.missions.find_one({"_id": ObjectId(mission_id), "project_slug": slug})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    is_admin = user["is_super_admin"] or "manage_missions" in user["permissions"]
    is_creator = mission["created_by"] == user["username"]
    if not is_admin and not is_creator:
        raise HTTPException(status_code=403, detail="Only the mission creator or an admin can reopen a mission")
    if mission["status"] != "completed":
        raise HTTPException(status_code=409, detail="Only completed missions can be reopened")
    now = datetime.now(timezone.utc)
    revisions = mission.get("revisions", [])
    last_idx = len(revisions) - 1
    new_status = "in_progress" if req.keep_assigned else "open"
    update: dict = {
        "$set": {
            "status": new_status,
            "completed_at": None,
            "delivery_files": [],
        }
    }
    if last_idx >= 0:
        update["$set"][f"revisions.{last_idx}.feedback"] = req.feedback
        update["$set"][f"revisions.{last_idx}.feedback_by"] = user["username"]
        update["$set"][f"revisions.{last_idx}.feedback_at"] = now.isoformat()
    if not req.keep_assigned:
        update["$set"]["claimed_by"] = None
        update["$set"]["claimed_at"] = None
    await db.missions.update_one({"_id": ObjectId(mission_id)}, update)
    await log_action("missions", f"Mission reopened: {mission['title']}", user=user["username"], project_slug=slug)
    return {"success": True}

# ============== NOTIFICATIONS ==============
@api_router.get("/notifications")
async def get_notifications(page: int = 1, limit: int = 20, notif_type: Optional[str] = None, user=Depends(get_current_user)):
    user_oid = ObjectId(user["id"])
    q: dict = {"userId": user_oid}
    if notif_type:
        q["type"] = notif_type
    skip = (page - 1) * limit
    total = await db.notifications.count_documents(q)
    unread = await db.notifications.count_documents({**q, "read": False})
    notifs = await db.notifications.find(q).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    return {
        "notifications": [serialize_doc(n) for n in notifs],
        "total": total,
        "unread": unread,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }

@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(notif_type: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {"userId": ObjectId(user["id"]), "read": False}
    if notif_type:
        q["type"] = notif_type
    await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"success": True}

@api_router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    n = await db.notifications.find_one({"_id": oid, "userId": ObjectId(user["id"])})
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.notifications.update_one({"_id": oid}, {"$set": {"read": True}})
    return {"success": True}

@api_router.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: str, user=Depends(get_current_user)):
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    r = await db.notifications.delete_one({"_id": oid, "userId": ObjectId(user["id"])})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}

# ============== SETUP ==============
app.include_router(api_router)

# CORS — reads CORS_ORIGINS from env; falls back to localhost only (never wildcard in prod)
_cors_raw = os.environ.get('CORS_ORIGINS', '').strip()
if _cors_raw:
    _cors_origins = [o.strip() for o in _cors_raw.split(',') if o.strip()]
else:
    logger.warning(
        "CORS_ORIGINS not set — allowing localhost:3000 only. "
        "Set CORS_ORIGINS=https://yourdomain.com in production."
    )
    _cors_origins = ['http://localhost:3000']

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Chat-Api-Key", "X-Files-Api-Key"],
)

app.add_middleware(SecurityHeadersMiddleware)

TIER_THRESHOLDS = [("diamond", 25000), ("gold", 10000), ("silver", 2500), ("bronze", 0)]
TIER_DISCOUNTS  = {"bronze": 0, "silver": 5, "gold": 10, "diamond": 15}

def get_tier(total_cents: int) -> str:
    for tier, threshold in TIER_THRESHOLDS:
        if total_cents >= threshold:
            return tier
    return "bronze"

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

async def _update_loyalty(email: str, amount_cents: int):
    """Atomically increment total_spent and recalculate tier."""
    result = await db.user_points.find_one_and_update(
        {"email": email},
        {"$inc": {"total_spent_cents": amount_cents}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=True,
    )
    new_total = result.get("total_spent_cents", amount_cents) if result else amount_cents
    tier = get_tier(new_total)
    await db.user_points.update_one({"email": email}, {"$set": {"tier": tier}})

def _get_origin(request=None) -> str:
    # Always prefer server-side env var — never trust client Origin/Referer for Stripe URLs
    return os.environ.get("FRONTEND_URL", "").rstrip("/")

async def _ensure_super_admin():
    """Idempotent: create the super admin account if it doesn't exist yet."""
    if not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
        logger.warning("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in environment — skipping super admin auto-creation")
        return
    try:
        existing = await db.users.find_one({"email": SUPER_ADMIN_EMAIL})
        if existing:
            # Account exists — make sure it has super_admin role (migration guard)
            if existing.get("role") != "super_admin":
                await db.users.update_one(
                    {"email": SUPER_ADMIN_EMAIL},
                    {"$set": {"role": "super_admin", "permissions": ALL_PERMISSIONS, "isSuspended": False}}
                )
                logger.info("Upgraded existing account to super_admin")
            else:
                logger.info(f"Super admin already exists: {SUPER_ADMIN_EMAIL}")
            return

        # Generate a free username (superadmin might be taken)
        base_username = "superadmin"
        username = base_username
        counter = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{counter}"
            counter += 1

        await db.users.insert_one({
            "email": SUPER_ADMIN_EMAIL,
            "password_hash": hash_key(SUPER_ADMIN_PASSWORD),
            "firstName": "Admin",
            "lastName": "Vakar",
            "username": username,
            "role": "super_admin",
            "permissions": ALL_PERMISSIONS,
            "isVerified": True,
            "isSuspended": False,
            "mustChangePassword": True,
            "createdAt": datetime.now(timezone.utc),
            "lastLogin": None,
        })
        logger.info(f"Super admin created: {SUPER_ADMIN_EMAIL} (username: {username})")
    except Exception as e:
        logger.error(f"Super admin init error: {e}")

@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True, sparse=True)
        await db.projects.create_index("slug", unique=True)
        await db.items.create_index([("project_slug", 1), ("uid", 1)])
        await db.logs.create_index([("project_slug", 1), ("type", 1)])
        await db.logs.create_index("timestamp")
        await db.variables.create_index([("project_slug", 1), ("variable_name", 1)], unique=True)
        await db.website_games.create_index("slug", unique=True)
        await db.blog_posts.create_index("slug", unique=True)
        await db.chat_messages.create_index([("project_slug", 1), ("timestamp", 1)])
        await db.website_shop_products.create_index([("game_slug", 1), ("active", 1)])
        await db.website_shop_settings.create_index("game_slug", unique=True)
        await db.website_shop_daily_claims.create_index(
            [("game_slug", 1), ("player_uid", 1), ("date_key", 1)], unique=True
        )
        await db.website_shop_daily_gifts.create_index("game_slug", unique=True)
        await db.missions.create_index([("project_slug", 1), ("status", 1)])
        await db.missions.create_index("created_at")
        await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
        await db.support_tickets.create_index("ticket_number", unique=True)
        await db.support_tickets.create_index([("user_email", 1), ("created_at", -1)])
        await db.support_tickets.create_index([("status", 1), ("updated_at", -1)])
        await db.game_purchases.create_index([("email", 1), ("game_slug", 1)], unique=True)
        await db.game_purchases.create_index("purchased_at")
        await db.user_points.create_index("email", unique=True)
        await db.website_shop_global_settings.create_index("_id")
        logger.info("Database indexes initialized")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    # Security warnings for missing env vars
    if _JWT_EPHEMERAL:
        logger.warning("⚠ JWT_SECRET not set in environment — using ephemeral random secret. All tokens will be invalidated on every restart!")
    if not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
        logger.warning("⚠ SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set in .env — super admin auto-creation disabled")
    if not SETUP_KEY:
        logger.warning("⚠ MASTER_KEY not set in environment — /auth/init-superadmin endpoint is disabled")

    # Create initial super admin if not already present
    await _ensure_super_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
