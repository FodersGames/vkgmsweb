from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
import shutil
import time
import psutil
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Any
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
import zipfile
import io
import json
import shlex

VERSION = "1.3.0"

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
# tz_aware=True: without it, datetimes read back from Mongo are naive (no tzinfo), which crashes
# any comparison against a freshly-created datetime.now(timezone.utc) (e.g. mute/ban expiry checks).
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
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

class PlayCORSMiddleware:
    """Pure ASGI CORS middleware for /api/play/* and /api/game/* — never buffers responses, safe for FileResponse/streaming."""
    _PREFIXES = ("/api/play/", "/api/game/")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not any(path.startswith(p) for p in self._PREFIXES):
            await self.app(scope, receive, send)
            return

        headers_dict = dict(scope.get("headers", []))
        origin = headers_dict.get(b"origin", b"*").decode()

        if scope.get("method") == "OPTIONS":
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    [b"access-control-allow-origin",  origin.encode()],
                    [b"access-control-allow-methods", b"GET, POST, OPTIONS"],
                    [b"access-control-allow-headers", b"Authorization, Content-Type, X-Files-Api-Key, X-Chat-Api-Key"],
                    [b"access-control-max-age",       b"86400"],
                    [b"content-length",               b"0"],
                ],
            })
            await send({"type": "http.response.body", "body": b""})
            return

        cors_pair = [b"access-control-allow-origin", origin.encode()]
        injected  = False

        async def send_with_cors(message):
            nonlocal injected
            if message["type"] == "http.response.start" and not injected:
                injected = True
                existing = [h for h in message.get("headers", [])
                            if h[0].lower() != b"access-control-allow-origin"]
                message = {**message, "headers": existing + [cors_pair, [b"vary", b"Origin"]]}
            await send(message)

        await self.app(scope, receive, send_with_cors)

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

# ============== PERMISSIONS ==============
# Static permissions (project:slug permissions are dynamic, not listed here)
ALL_PERMISSIONS = [
    "view_all_projects", "create_projects", "delete_projects",
    "send_items", "delete_items",
    "change_status",
    "view_variables", "create_variables", "edit_variables", "delete_variables",
    "view_logs", "view_api_docs",
    "manage_users",
    "view_vps",
    "manage_website",
    "create_games", "edit_games", "delete_games",
    "create_blog", "edit_blog", "delete_blog",
    "manage_chat",
    "manage_shop",
    "manage_files",
    "create_missions", "claim_missions", "manage_missions",
    "manage_tickets",
    "manage_play",
    "manager_careers",
    "game_dev_panel",
    "game_logs_panel",
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
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

class UpdateUserPermissionsRequest(BaseModel):
    permissions: List[str]

    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, perms):
        for p in perms:
            if not is_valid_permission(p):
                raise ValueError(f"Invalid permission: {p}")
        return perms

VAR_TYPES = ("string", "number", "boolean", "list", "json")

class ServerVariableRequest(BaseModel):
    name: str
    var_type: Literal["string", "number", "boolean", "list", "json"] = "string"
    value: Any = None
    description: str = ""
    is_public: bool = True

class ServerVariableUpdateRequest(BaseModel):
    var_type: Optional[Literal["string", "number", "boolean", "list", "json"]] = None
    value: Any = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

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
    maintenance_mode: Optional[bool] = None
    support_email: Optional[str] = None

class ChatMessageRequest(BaseModel):
    username: str
    message: str
    level: Optional[int] = None

# ── Chat & Guilds (Play — JWT-authenticated, channel-aware) ──────────────────
class PlayChatSendRequest(BaseModel):
    project_slug: str
    channel: Literal["global", "guild"]
    message: str

class ChatReactionRequest(BaseModel):
    emoji: str

class PlayGuildCreateRequest(BaseModel):
    project_slug: str
    name: str
    description: str = ""
    color: str = "#4ECDC4"
    logo_id: str = "shield"

class PlayGuildUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    logo_id: Optional[str] = None

class GuildMemberRoleRequest(BaseModel):
    role: Literal["officer", "member"]

class ChatBanRequest(BaseModel):
    user_id: str

class ChatMuteRequest(BaseModel):
    user_id: str
    duration_minutes: int
    reason: str = ""

class ChatMaintenanceRequest(BaseModel):
    chat_global_enabled: Optional[bool] = None
    chat_guilds_enabled: Optional[bool] = None

class BannedWordsUpdateRequest(BaseModel):
    words: List[str]

class ShopProductCreateRequest(BaseModel):
    name: str
    description: str = ""
    price: int
    image_url: str = ""
    badge: Optional[str] = None
    discount_pct: Optional[int] = None
    game_slug: str
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
    game_slug: Optional[str] = None
    project_slug: Optional[str] = None
    variable: Optional[str] = None
    amount: Optional[str] = None
    active: Optional[bool] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    featured: Optional[bool] = None

class ShopCheckoutRequest(BaseModel):
    product_id: str
    player_uid: str
    coupon_code: Optional[str] = ""

class ShopGlobalSettingsRequest(BaseModel):
    shop_title: Optional[str] = None
    footer_text: Optional[str] = None
    categories: Optional[List[dict]] = None

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
    category: Literal["general", "technical", "billing", "account", "recruitment"] = "general"
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

class CliExecuteRequest(BaseModel):
    command: str
    confirm: bool = False

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
        "avatar_url": user.get("avatar_url"),
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

def require_any_of(*permissions):
    async def check(user=Depends(get_current_user)):
        if user["is_super_admin"]:
            return user
        if not any(p in user.get("permissions", []) for p in permissions):
            raise HTTPException(status_code=403, detail=f"Missing one of: {', '.join(permissions)}")
        return user
    return check

async def require_super_admin(user=Depends(get_current_user)):
    if not user["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

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
    is_super = user.get("role") == "super_admin"
    permissions = ALL_PERMISSIONS if is_super else user.get("permissions", [])
    # During maintenance, only accounts with dashboard access (staff) may sign in
    settings = await db.website_settings.find_one({}, {"_id": 0})
    if settings and settings.get("maintenance_mode"):
        has_dashboard_access = is_super or user.get("role") == "admin" or len(permissions) > 0
        if not has_dashboard_access:
            raise HTTPException(status_code=403, detail="The site is under maintenance. Only staff accounts can sign in right now.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": datetime.now(timezone.utc)}})
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

@api_router.post("/user/avatar")
@limiter.limit("10/minute")
async def upload_avatar(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".svg"}
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "File type not allowed. Use JPG, PNG or SVG.")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large. Maximum size is 5 MB.")
    # Delete previous avatar file if it exists
    for old_ext in ALLOWED_EXTS:
        old_path = UPLOADS_DIR / f"avatar_{user['id']}{old_ext}"
        if old_path.exists():
            old_path.unlink(missing_ok=True)
    filename = f"avatar_{user['id']}{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    avatar_url = f"/api/uploads/{filename}"
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"avatar_url": avatar_url}})
    return {"avatar_url": avatar_url}

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
    # manage_users is super-admin-only to prevent lateral propagation of admin access
    _SUPER_ADMIN_ONLY_PERMS = {"manage_users"}
    if not admin.get("is_super_admin") and admin.get("role") not in ("super_admin",):
        admin_perms = set(admin.get("permissions", []))
        for perm in req.permissions:
            if perm in _SUPER_ADMIN_ONLY_PERMS:
                raise HTTPException(status_code=403, detail=f"'{perm}' can only be granted by a super admin")
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
    resp = [{"variable": i["variable"], "amount": i["amount"], "from_name": i.get("from_name"), "product_name": i.get("product_name")} for i in items]
    await db.items.delete_one({"_id": items[0]["_id"]})
    await log_action("claim", f"User {uid} claimed: {items[0]['variable']} x{items[0]['amount']}", project_slug=slug, uid=uid)
    result = {
        "length": len(resp), "variable": resp[0]["variable"], "amount": resp[0]["amount"],
        "from_name": resp[0].get("from_name"), "product_name": resp[0].get("product_name"),
    }
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
    if not doc:
        return ServerStatusResponse(status="open")
    updated_at = doc.get("updated_at")
    return ServerStatusResponse(
        status=doc["status"],
        updated_at=updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
        updated_by=doc.get("updated_by"),
    )

# ============== PROJECT-SCOPED: LOGS ==============
# Curated set of log types that are meaningful in a per-project activity feed.
# (Account-level/global actions — auth, website content, support, careers — never carry a
# project_slug and are therefore already excluded from this view by the query below.)
PROJECT_LOG_TYPES = (
    "files", "variable_action", "shop", "status", "chat", "guild",
    "missions", "player", "send", "claim", "delete", "project",
)

@api_router.get("/projects/{slug}/logs")
async def get_logs(slug: str, log_type: Optional[str] = None, user_filter: Optional[str] = None,
                   uid: Optional[str] = None, search: Optional[str] = None,
                   limit: int = 100, page: int = 1,
                   user=Depends(require_permission("view_logs"))):
    await get_project_or_404(slug)
    q = {"project_slug": slug}
    if log_type:
        types = [t.strip() for t in log_type.split(",") if t.strip()]
        if types:
            q["type"] = {"$in": types}
    if user_filter: q["user"] = user_filter
    if uid: q["uid"] = uid
    if search:
        q["message"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    skip = (page - 1) * limit
    total = await db.logs.count_documents(q)
    logs = await db.logs.find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    for l in logs:
        if isinstance(l.get("timestamp"), datetime):
            l["timestamp"] = l["timestamp"].isoformat()
    return {"logs": logs, "count": len(logs), "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

# ============== PROJECT-SCOPED: SERVER VARIABLES ==============
# A "server variable" is a per-project, admin-controlled config value the live game can read
# (if public) without needing a new build — e.g. a maintenance message, an event multiplier, a
# drop table. Old documents (pre-typed system) only have {variable_name, values: [str, ...]};
# _normalize_variable_doc reads those transparently as a "list" type without ever rewriting or
# deleting them — they only get upgraded to the new shape if an admin explicitly edits them.

def _normalize_variable_doc(v: dict) -> dict:
    if "var_type" not in v:
        return {
            "name": v.get("variable_name", v.get("name", "")),
            "var_type": "list",
            "value": v.get("values", []),
            "description": "",
            "is_public": True,
            "created_at": v.get("created_at"),
            "created_by": v.get("created_by"),
            "updated_at": v.get("updated_at"),
            "updated_by": v.get("updated_by"),
        }
    return {
        "name": v.get("name", v.get("variable_name", "")),
        "var_type": v.get("var_type", "string"),
        "value": v.get("value"),
        "description": v.get("description", ""),
        "is_public": v.get("is_public", True),
        "created_at": v.get("created_at"),
        "created_by": v.get("created_by"),
        "updated_at": v.get("updated_at"),
        "updated_by": v.get("updated_by"),
    }

def _validate_variable_value(var_type: str, value):
    if var_type == "string":
        return str(value) if value is not None else ""
    if var_type == "number":
        try:
            f = float(value)
        except (TypeError, ValueError):
            raise HTTPException(400, "Value must be a number")
        return int(f) if f.is_integer() else f
    if var_type == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes")
        return bool(value)
    if var_type == "list":
        if not isinstance(value, list):
            raise HTTPException(400, "Value must be a list")
        return [str(v) for v in value]
    if var_type == "json":
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                raise HTTPException(400, "Value must be valid JSON")
        if value is None:
            return {}
        return value
    raise HTTPException(400, f"Invalid var_type. Must be one of: {', '.join(VAR_TYPES)}")

async def _find_variable_doc(slug: str, name: str):
    return await db.variables.find_one({"project_slug": slug, "$or": [{"name": name}, {"variable_name": name}]})

@api_router.post("/projects/{slug}/variables")
async def create_variable(slug: str, req: ServerVariableRequest, user=Depends(require_permission("create_variables"))):
    await get_project_or_404(slug)
    if await _find_variable_doc(slug, req.name):
        raise HTTPException(status_code=400, detail="Variable exists")
    value = _validate_variable_value(req.var_type, req.value)
    now = datetime.now(timezone.utc)
    await db.variables.insert_one({
        "project_slug": slug, "name": req.name, "var_type": req.var_type, "value": value,
        "description": req.description, "is_public": req.is_public,
        "created_at": now, "created_by": user["username"],
        "updated_at": now, "updated_by": user["username"],
    })
    await log_action("variable_action",
        f"Variable '{req.name}' created ({req.var_type}, {'public' if req.is_public else 'private'})",
        project_slug=slug, user=user["username"], variable=req.name)
    return {"success": True, "name": req.name, "var_type": req.var_type, "value": value,
            "description": req.description, "is_public": req.is_public}

@api_router.get("/projects/{slug}/variables")
async def list_variables(slug: str, page: int = 1, limit: int = 200, user=Depends(require_permission("view_variables"))):
    await get_project_or_404(slug)

    skip = (page - 1) * limit
    total = await db.variables.count_documents({"project_slug": slug})
    vs = await db.variables.find({"project_slug": slug}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    result = []
    for v in vs:
        nv = _normalize_variable_doc(v)
        for k in ("created_at", "updated_at"):
            if isinstance(nv.get(k), datetime):
                nv[k] = nv[k].isoformat()
        result.append(nv)
    return {"variables": result, "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit) if limit else 1}

# Bulk, unauthenticated: lets the running game preload every public config value in one call.
@api_router.get("/projects/{slug}/variables/public")
async def list_public_variables(slug: str):
    await get_project_or_404(slug)
    vs = await db.variables.find({"project_slug": slug}).to_list(1000)
    result = {}
    for v in vs:
        nv = _normalize_variable_doc(v)
        if nv["is_public"] and nv["name"]:
            result[nv["name"]] = {"type": nv["var_type"], "value": nv["value"]}
    return {"variables": result}

@api_router.get("/projects/{slug}/variable/{name}")
async def get_variable(slug: str, name: str):
    await get_project_or_404(slug)
    v = await _find_variable_doc(slug, name)
    if not v:
        raise HTTPException(status_code=404, detail="Variable not found")
    nv = _normalize_variable_doc(v)
    if not nv["is_public"]:
        raise HTTPException(status_code=404, detail="Variable not found")
    return {"name": nv["name"], "type": nv["var_type"], "value": nv["value"]}

@api_router.put("/projects/{slug}/variables/{name}")
async def update_variable(slug: str, name: str, req: ServerVariableUpdateRequest, user=Depends(require_permission("edit_variables"))):
    await get_project_or_404(slug)
    existing = await _find_variable_doc(slug, name)
    if not existing:
        raise HTTPException(status_code=404, detail="Variable not found")
    nv = _normalize_variable_doc(existing)
    var_type    = req.var_type if req.var_type is not None else nv["var_type"]
    value       = _validate_variable_value(var_type, req.value) if req.value is not None else nv["value"]
    description = req.description if req.description is not None else nv["description"]
    is_public   = req.is_public if req.is_public is not None else nv["is_public"]
    now = datetime.now(timezone.utc)
    await db.variables.replace_one(
        {"_id": existing["_id"]},
        {
            "project_slug": slug, "name": name, "var_type": var_type, "value": value,
            "description": description, "is_public": is_public,
            "created_at": nv.get("created_at") or now, "created_by": nv.get("created_by") or user["username"],
            "updated_at": now, "updated_by": user["username"],
        }
    )
    await log_action("variable_action", f"Variable '{name}' updated", project_slug=slug, user=user["username"], variable=name)
    return {"success": True, "name": name, "var_type": var_type, "value": value,
            "description": description, "is_public": is_public}

@api_router.delete("/projects/{slug}/variables/{name}")
async def delete_variable(slug: str, name: str, user=Depends(require_permission("delete_variables"))):
    await get_project_or_404(slug)
    r = await db.variables.delete_one({"project_slug": slug, "$or": [{"name": name}, {"variable_name": name}]})
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
DEFAULT_SUPPORT_EMAIL = "support@vakargames.com"

@api_router.get("/website/settings")
async def get_website_settings():
    doc = await db.website_settings.find_one({}, {"_id": 0})
    if not doc:
        return {"maintenance_mode": False, "support_email": DEFAULT_SUPPORT_EMAIL}
    updated_at = doc.get("updated_at")
    return {
        "maintenance_mode": doc.get("maintenance_mode", False),
        "support_email": doc.get("support_email") or DEFAULT_SUPPORT_EMAIL,
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
        "updated_by": doc.get("updated_by"),
    }

@api_router.put("/website/settings")
async def update_website_settings(req: WebsiteSettingsRequest, user=Depends(require_permission("manage_website"))):
    updates = {"updated_at": datetime.now(timezone.utc), "updated_by": user["username"]}
    log_parts = []
    if req.maintenance_mode is not None:
        updates["maintenance_mode"] = req.maintenance_mode
        log_parts.append(f"maintenance {'enabled' if req.maintenance_mode else 'disabled'}")
    if req.support_email is not None:
        email = req.support_email.strip()
        if email and not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
            raise HTTPException(status_code=400, detail="Invalid email address")
        updates["support_email"] = email or DEFAULT_SUPPORT_EMAIL
        log_parts.append(f"support email set to '{updates['support_email']}'")
    await db.website_settings.update_one({}, {"$set": updates}, upsert=True)
    if log_parts:
        await log_action("website", "Settings updated: " + ", ".join(log_parts), user=user["username"])
    doc = await db.website_settings.find_one({}, {"_id": 0})
    return {
        "success": True,
        "maintenance_mode": doc.get("maintenance_mode", False),
        "support_email": doc.get("support_email") or DEFAULT_SUPPORT_EMAIL,
    }

@api_router.get("/admin/system/health")
async def get_system_health(user=Depends(require_permission("manage_website"))):
    stripe_key = os.environ.get('STRIPE_SECRET_KEY', '')
    return {
        "version": VERSION,
        "jwt_persistent": not _JWT_EPHEMERAL,
        "master_key_configured": bool(SETUP_KEY),
        "stripe_configured": bool(stripe_key),
        "stripe_mode": "live" if stripe_key.startswith("sk_live_") else ("test" if stripe_key.startswith("sk_test_") else None),
        "stripe_webhook_configured": bool(STRIPE_WEBHOOK_SECRET),
    }

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
async def get_chat_messages(project_slug: str, limit: int = 50, channel: Optional[str] = None, guild_id: Optional[str] = None):
    limit = min(max(limit, 1), 100)
    query: dict = {"project_slug": project_slug}
    if channel:
        query["channel"] = channel
    if guild_id:
        try:
            query["guild_id"] = ObjectId(guild_id)
        except Exception:
            pass
    messages = await db.chat_messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
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

# ── Global shop settings (title, footer, and the cross-game category list) ───
@api_router.get("/shop/settings")
async def get_global_shop_settings():
    doc = await db.website_shop_global_settings.find_one({})
    if not doc:
        return {"shop_title": "Shop", "footer_text": "", "categories": []}
    result = serialize_doc(doc)
    result.setdefault("categories", [])
    return result

@api_router.put("/shop/settings")
async def update_global_shop_settings(req: ShopGlobalSettingsRequest, user=Depends(require_permission("manage_shop"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.website_shop_global_settings.update_one({}, {"$set": updates}, upsert=True)
    await log_action("shop", "Global shop settings updated", user=user["username"])
    return serialize_doc(await db.website_shop_global_settings.find_one({}))

async def _get_shop_categories() -> List[dict]:
    doc = await db.website_shop_global_settings.find_one({}, {"categories": 1})
    return (doc or {}).get("categories", [])

async def _validate_game_slug(game_slug: str):
    if not await db.website_games.find_one({"slug": game_slug}):
        raise HTTPException(status_code=404, detail=f"Game '{game_slug}' not found")

# ── Global products list ──────────────────────────────────────────────────────
@api_router.get("/shop/products")
async def list_all_shop_products(game_slug: Optional[str] = None, category: Optional[str] = None):
    query: dict = {"active": True}
    if game_slug:
        query["game_slug"] = game_slug
    if category:
        query["category"] = category
    products = await db.website_shop_products.find(query).sort([("featured", -1), ("created_at", 1)]).to_list(500)
    categories = await _get_shop_categories()
    return {"products": [serialize_doc(p) for p in products], "categories": categories}

@api_router.get("/shop/products/admin")
async def list_all_shop_products_admin(game_slug: Optional[str] = None, category: Optional[str] = None,
                                        user=Depends(require_permission("manage_shop"))):
    query: dict = {}
    if game_slug:
        query["game_slug"] = game_slug
    if category:
        query["category"] = category
    products = await db.website_shop_products.find(query).sort([("game_slug", 1), ("created_at", 1)]).to_list(500)
    return {"products": [serialize_doc(p) for p in products]}

@api_router.post("/shop/products")
async def create_shop_product_global(req: ShopProductCreateRequest, user=Depends(require_permission("manage_shop"))):
    await _validate_game_slug(req.game_slug)
    if not await db.projects.find_one({"slug": req.project_slug}):
        raise HTTPException(status_code=404, detail="Project not found")
    doc = {
        "game_slug": req.game_slug,
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
    await log_action("shop", f"Shop product '{req.name}' created", project_slug=req.project_slug, user=user["username"])
    return {"success": True, "product": serialize_doc(doc)}

@api_router.put("/shop/products/{product_id}")
async def update_shop_product_global(product_id: str, req: ShopProductUpdateRequest, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if "game_slug" in updates:
        await _validate_game_slug(updates["game_slug"])
    if "project_slug" in updates and not await db.projects.find_one({"slug": updates["project_slug"]}):
        raise HTTPException(status_code=404, detail="Project not found")
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.website_shop_products.update_one({"_id": oid}, {"$set": updates})
    updated = await db.website_shop_products.find_one({"_id": oid})
    await log_action("shop", f"Shop product '{updated.get('name', product_id)}' updated",
                      project_slug=updated.get("project_slug"), user=user["username"])
    return {"success": True, "product": serialize_doc(updated)}

@api_router.delete("/shop/products/{product_id}")
async def delete_shop_product_global(product_id: str, user=Depends(require_permission("manage_shop"))):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.website_shop_products.delete_one({"_id": oid})
    await log_action("shop", f"Shop product '{product.get('name', product_id)}' deleted",
                      project_slug=product.get("project_slug"), user=user["username"])
    return {"success": True}

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

# ── Player game stats ─────────────────────────────────────────────────────────
@api_router.get("/user/play-stats")
async def get_play_stats(user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    saves = await db.play_saves.find({"user_id": uid}).to_list(None)
    by_game: dict = {}
    for s in saves:
        slug = s["project_slug"]
        if slug not in by_game:
            by_game[slug] = {"slug": slug, "categories": [], "last_updated": None, "saves_count": 0}
        by_game[slug]["categories"].append(s["category"])
        by_game[slug]["saves_count"] += 1
        upd = s.get("updated_at")
        if upd and (by_game[slug]["last_updated"] is None or upd > by_game[slug]["last_updated"]):
            by_game[slug]["last_updated"] = upd
    slugs = list(by_game.keys())
    games = await db.website_games.find({"slug": {"$in": slugs}}).to_list(None) if slugs else []
    projects = await db.projects.find({"slug": {"$in": slugs}}).to_list(None) if slugs else []
    game_map = {g["slug"]: g for g in games}
    project_map = {p["slug"]: p for p in projects}
    result = []
    for slug, data in by_game.items():
        wg = game_map.get(slug, {})
        pr = project_map.get(slug, {})
        result.append({
            "slug": slug,
            "name": wg.get("title") or pr.get("name") or slug,
            "cover_image": wg.get("cover_image_url") or wg.get("image_url"),
            "platform_links": wg.get("platform_links") or [],
            "categories": list(set(data["categories"])),
            "saves_count": data["saves_count"],
            "last_updated": data["last_updated"].isoformat() if data["last_updated"] else None,
        })
    result.sort(key=lambda x: x["last_updated"] or "", reverse=True)
    return {"games": result, "total_games": len(result)}

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
            "assigned_to_user_id": ObjectId(user["id"]),
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
            "assigned_to_user_id": ObjectId(user["id"]),
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

@api_router.get("/admin/projects/{slug}/files-api-key")
async def get_files_api_key(slug: str, user=Depends(require_permission("manage_files"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"files_api_key": project.get("files_api_key") or None}

@api_router.post("/admin/projects/{slug}/files-api-key/regenerate")
async def regenerate_files_api_key(slug: str, user=Depends(require_permission("manage_files"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    new_key = secrets.token_urlsafe(32)
    await db.projects.update_one({"slug": slug}, {"$set": {"files_api_key": new_key}})
    await log_action("files", f"Files API key regenerated", project_slug=slug, user=user["username"])
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

@api_router.put("/admin/projects/{slug}/files/{file_id}/replace")
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

@api_router.put("/admin/projects/{slug}/files/{file_id}")
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

@api_router.delete("/admin/projects/{slug}/files/{file_id}")
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

@api_router.delete("/admin/projects/{slug}/files/group/{group_id}")
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

@api_router.get("/admin/projects/{slug}/files/{file_id}/preview")
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

@api_router.get("/admin/projects/{slug}/files/{file_id}/download")
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

@api_router.get("/admin/projects/{slug}/files")
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
        # Stable asset ID — identical across all cloned versions of the asset
        asset_id = doc.get("stable_id") or doc["id"]
        doc["asset_id"] = asset_id
        doc["download_url"] = f"{base_url}/api/game/{slug}/files/{asset_id}/download?version={resolved_version}"
        doc["resolved_version"] = resolved_version
        result.append(doc)
    return {"files": result, "resolved_version": resolved_version}

# ── Game client: download file (API key auth) ─────────────────────────────────

@api_router.get("/game/{slug}/files/{file_id}/download")
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

@api_router.get("/admin/projects/{slug}/versions")
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

@api_router.get("/admin/projects/{slug}/versions/{tag}/download")
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

class VersionCloneRequest(BaseModel):
    new_tag: str

@api_router.post("/admin/projects/{slug}/versions")
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

        import shutil
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

@api_router.delete("/admin/projects/{slug}/versions/{tag}")
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
    coupon = await db.coupons.find_one({"code": code, "assigned_to_user_id": ObjectId(user["id"])})
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
                        buyer_name = "Vakar Games Shop"
                        if user_email:
                            buyer = await db.users.find_one({"email": user_email})
                            if buyer:
                                buyer_name = buyer.get("firstName") or buyer.get("username") or buyer_name
                        await db.items.insert_one({
                            "project_slug": product["project_slug"],
                            "uid": uid,
                            "variable": product["variable"],
                            "amount": product["amount"],
                            "created_at": datetime.now(timezone.utc),
                            "created_by": "stripe_shop",
                            "from_name": buyer_name,
                            "product_name": product.get("name", "Item"),
                        })
                        await log_action("send",
                            f"Shop: {product['amount']}x {product['variable']} → {uid} (Stripe, from {buyer_name})",
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

# ── System stats ─────────────────────────────────────────────────────────────

@api_router.get("/admin/system/stats")
async def get_system_stats(user=Depends(require_permission("view_vps"))):
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_count   = psutil.cpu_count(logical=True)

    ram  = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    uptime_seconds = time.time() - psutil.boot_time()

    load_avg = None
    try:
        load_avg = list(psutil.getloadavg())
    except Exception:
        pass

    return {
        "cpu":    {"percent": cpu_percent, "count": cpu_count},
        "ram":    {"total": ram.total,  "used": ram.used,  "free": ram.available, "percent": ram.percent},
        "disk":   {"total": disk.total, "used": disk.used, "free": disk.free,     "percent": disk.percent},
        "uptime_seconds": uptime_seconds,
        "load_avg": load_avg,
    }

# ============== SETUP ==============  (include_router moved after play routes — see below)

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
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Chat-Api-Key", "X-Files-Api-Key"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(PlayCORSMiddleware)  # must be last — runs first, intercepts /api/play/* before CORSMiddleware

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

# ═══════════════════════════════════════════════════════════════════════════════
#  VAKAR GAMES PLAY — Player Auth + Cloud Saves (comptes unifiés db.users)
# ═══════════════════════════════════════════════════════════════════════════════

PLAY_ACCESS_TOKEN_HOURS  = 1
PLAY_REFRESH_TOKEN_DAYS  = 365
PLAY_SAVE_CATEGORIES     = {"inventory", "stats", "craft", "tech", "others"}

def _create_play_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id, "username": username, "type": "play",
        "exp": datetime.now(timezone.utc) + timedelta(hours=PLAY_ACCESS_TOKEN_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def _create_play_refresh_token(user_id: str, username: str, jti: str) -> str:
    payload = {
        "sub": user_id, "username": username, "type": "play_refresh", "jti": jti,
        "exp": datetime.now(timezone.utc) + timedelta(days=PLAY_REFRESH_TOKEN_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def _get_play_user_from_access(request: Request):
    """Validates a play access token (1h, in-memory on client). Uses shared db.users."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requis")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(401, "Token invalide ou expiré")
    if payload.get("type") != "play":
        raise HTTPException(401, "Token invalide")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Token invalide")
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(401, "Token invalide")
    if not user:
        raise HTTPException(401, "Compte introuvable")
    if user.get("isSuspended"):
        raise HTTPException(403, "Compte suspendu")
    return user

async def _is_project_banned(user_id, project_slug: str) -> bool:
    if not project_slug:
        return False
    ban = await db.play_bans.find_one({"user_id": user_id, "project_slug": project_slug})
    return ban is not None

async def _check_first_time_and_mark(user_id, project_slug: str) -> bool:
    """Atomically records a player's first connection to a project. Returns True only the very first time."""
    if not project_slug:
        return False
    try:
        result = await db.play_first_seen.update_one(
            {"user_id": user_id, "project_slug": project_slug},
            {"$setOnInsert": {"first_seen_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return result.upserted_id is not None
    except DuplicateKeyError:
        return False

# ── Public play routes ───────────────────────────────────────────────────────

@api_router.post("/play/register")
@limiter.limit("10/minute")
async def play_register(request: Request):
    body     = await request.json()
    username     = str(body.get("username", "")).strip()
    email        = str(body.get("email", "")).strip().lower()
    password     = str(body.get("password", ""))
    project_slug = str(body.get("project_slug", "")).strip()

    if not username or not email or not password:
        raise HTTPException(400, "Tous les champs sont requis")
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        raise HTTPException(400, "Pseudo : 3-20 caractères (lettres, chiffres, _)")
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(400, "Email invalide")
    if len(password) < 6:
        raise HTTPException(400, "Mot de passe trop court (minimum 6 caractères)")

    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email déjà utilisé")
    if await db.users.find_one({"username": username}):
        raise HTTPException(400, "Pseudo déjà utilisé")

    now = datetime.now(timezone.utc)
    try:
        result = await db.users.insert_one({
            "username": username, "email": email,
            "password_hash": hash_key(password),
            "firstName": username, "lastName": "",
            "role": "player", "permissions": [],
            "isVerified": True, "isSuspended": False,
            "mustChangePassword": False,
            "createdAt": now, "lastLogin": now,
        })
    except DuplicateKeyError:
        raise HTTPException(400, "Email ou pseudo déjà utilisé")

    user_id = str(result.inserted_id)
    jti = secrets.token_urlsafe(32)
    refresh_token = _create_play_refresh_token(user_id, username, jti)
    access_token  = _create_play_access_token(user_id, username)
    await db.play_refresh_tokens.insert_one({
        "jti": jti, "user_id": result.inserted_id,
        "created_at": now, "last_used": now,
        "expires_at": now + timedelta(days=PLAY_REFRESH_TOKEN_DAYS),
        "is_revoked": False,
    })
    is_first_time = await _check_first_time_and_mark(result.inserted_id, project_slug)
    return {"access_token": access_token, "refresh_token": refresh_token,
            "player": {"id": user_id, "username": username}, "is_first_time": is_first_time}

@api_router.post("/play/login")
@limiter.limit("15/minute")
async def play_login(request: Request):
    body         = await request.json()
    login        = str(body.get("login", "")).strip()
    password     = str(body.get("password", ""))
    project_slug = str(body.get("project_slug", "")).strip()
    if not login or not password:
        raise HTTPException(400, "Champs requis manquants")
    user = await db.users.find_one({"$or": [{"username": login}, {"email": login.lower()}]})
    if not user or not verify_key(password, user.get("password_hash", "")):
        raise HTTPException(400, "Identifiants incorrects")
    if user.get("isSuspended"):
        raise HTTPException(403, "Compte suspendu")
    if await _is_project_banned(user["_id"], project_slug):
        raise HTTPException(403, {"error": "banned", "uid": str(user["_id"])})
    user_id  = str(user["_id"])
    username = user["username"]
    now = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": now}})
    jti = secrets.token_urlsafe(32)
    refresh_token = _create_play_refresh_token(user_id, username, jti)
    access_token  = _create_play_access_token(user_id, username)
    await db.play_refresh_tokens.insert_one({
        "jti": jti, "user_id": user["_id"],
        "created_at": now, "last_used": now,
        "expires_at": now + timedelta(days=PLAY_REFRESH_TOKEN_DAYS),
        "is_revoked": False,
    })
    is_first_time = await _check_first_time_and_mark(user["_id"], project_slug)
    return {"access_token": access_token, "refresh_token": refresh_token,
            "player": {"id": user_id, "username": username}, "is_first_time": is_first_time}

@api_router.post("/play/refresh")
@limiter.limit("30/minute")
async def play_refresh(request: Request):
    body = await request.json()
    refresh_token = str(body.get("refresh_token", ""))
    project_slug  = str(body.get("project_slug", "")).strip()
    if not refresh_token:
        raise HTTPException(401, "Refresh token manquant")
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(401, "Refresh token invalide ou expiré")
    if payload.get("type") != "play_refresh":
        raise HTTPException(401, "Token invalide")
    jti     = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise HTTPException(401, "Token invalide")
    stored = await db.play_refresh_tokens.find_one({"jti": jti})
    if not stored or stored.get("is_revoked"):
        raise HTTPException(401, "Session révoquée")
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(401, "Compte introuvable")
    if not user:
        raise HTTPException(401, "Compte introuvable")
    if user.get("isSuspended"):
        raise HTTPException(403, "Compte suspendu")
    if await _is_project_banned(user["_id"], project_slug):
        raise HTTPException(403, {"error": "banned", "uid": str(user["_id"])})
    now = datetime.now(timezone.utc)
    await db.play_refresh_tokens.update_one({"jti": jti}, {"$set": {"last_used": now}})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": now}})
    access_token = _create_play_access_token(user_id, user["username"])
    is_first_time = await _check_first_time_and_mark(user["_id"], project_slug)
    return {"access_token": access_token, "player": {"id": user_id, "username": user["username"]}, "is_first_time": is_first_time}

@api_router.get("/play/me")
async def play_me(request: Request, play_user=Depends(_get_play_user_from_access)):
    return {"id": str(play_user["_id"]), "username": play_user["username"]}

@api_router.get("/play/permissions")
async def play_permissions(request: Request, response: Response, play_user=Depends(_get_play_user_from_access)):
    """Live permission check for in-game admin tools (dev panel, logs panel).
    Always re-reads role/permissions from the DB — never trusts a cached client value."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    is_super = play_user.get("role") == "super_admin"
    permissions = ALL_PERMISSIONS if is_super else play_user.get("permissions", [])
    return {"is_super_admin": is_super, "permissions": permissions}

@api_router.post("/play/save")
async def play_save(request: Request, play_user=Depends(_get_play_user_from_access)):
    body = await request.json()
    category     = str(body.get("category", "")).strip()
    data         = str(body.get("data", "{}"))
    project_slug = str(body.get("project_slug", "")).strip()
    if category not in PLAY_SAVE_CATEGORIES:
        raise HTTPException(400, f"Catégorie invalide. Valeurs: {', '.join(sorted(PLAY_SAVE_CATEGORIES))}")
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    try:
        json.loads(data)
    except json.JSONDecodeError:
        raise HTTPException(400, "Les données doivent être du JSON valide")
    await db.play_saves.update_one(
        {"user_id": play_user["_id"], "project_slug": project_slug, "category": category},
        {"$set": {"data": data, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"ok": True}

@api_router.get("/play/load")
async def play_load(request: Request, category: str, project_slug: str, response: Response, play_user=Depends(_get_play_user_from_access)):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    if category not in PLAY_SAVE_CATEGORIES:
        raise HTTPException(400, "Catégorie invalide")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    save = await db.play_saves.find_one({
        "user_id": play_user["_id"], "project_slug": project_slug, "category": category
    })
    return {"data": save["data"] if save else "{}"}

class NicknameRequest(BaseModel):
    project_slug: str
    nickname: str

@api_router.post("/play/nickname")
async def play_set_nickname(body: NicknameRequest, play_user=Depends(_get_play_user_from_access)):
    nickname = body.nickname.strip()
    if not (1 <= len(nickname) <= 24):
        raise HTTPException(400, "Nickname must be 1-24 characters")
    if not body.project_slug:
        raise HTTPException(400, "project_slug requis")
    await db.play_nicknames.update_one(
        {"user_id": play_user["_id"], "project_slug": body.project_slug},
        {"$set": {"nickname": nickname, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"nickname": nickname}

@api_router.get("/play/nickname")
async def play_get_nickname(project_slug: str, response: Response, play_user=Depends(_get_play_user_from_access)):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    doc = await db.play_nicknames.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    return {"nickname": doc["nickname"] if doc else play_user["username"]}

# ── Admin play routes ────────────────────────────────────────────────────────

@api_router.get("/admin/projects/{slug}/play/players")
async def admin_play_players(slug: str, user=Depends(require_permission("manage_play"))):
    saves   = await db.play_saves.find({"project_slug": slug}).to_list(None)
    p_ids   = list({s["user_id"] for s in saves})
    players = await db.users.find({"_id": {"$in": p_ids}}).to_list(None)
    bans    = await db.play_bans.find({"project_slug": slug}).to_list(None)
    banned_ids = {b["user_id"] for b in bans}
    result  = []
    for p in players:
        p_saves = [s for s in saves if s["user_id"] == p["_id"]]
        result.append({
            "id":         str(p["_id"]),
            "username":   p["username"],
            "email":      p["email"],
            "created_at": str(p.get("createdAt", "")),
            "last_seen":  str(p.get("lastLogin", "")),
            "categories": [s["category"] for s in p_saves],
            "banned":     p["_id"] in banned_ids,
        })
    return {"players": result}

@api_router.patch("/admin/projects/{slug}/play/players/{player_id}/ban")
async def admin_ban_player(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_bans.update_one(
        {"user_id": oid, "project_slug": slug},
        {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": user["username"]}},
        upsert=True
    )
    await log_action("player", f"Player {player_id} banned", project_slug=slug, user=user["username"])
    return {"success": True, "banned": True}

@api_router.delete("/admin/projects/{slug}/play/players/{player_id}/ban")
async def admin_unban_player(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_bans.delete_one({"user_id": oid, "project_slug": slug})
    await log_action("player", f"Player {player_id} unbanned", project_slug=slug, user=user["username"])
    return {"success": True, "banned": False}

@api_router.get("/admin/projects/{slug}/play/players/{player_id}")
async def admin_play_player_detail(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    player = await db.users.find_one({"_id": oid})
    if not player:
        raise HTTPException(404, "Joueur introuvable")
    saves = await db.play_saves.find({"user_id": oid, "project_slug": slug}).to_list(None)
    return {
        "player": {
            "id": str(player["_id"]), "username": player["username"], "email": player["email"],
            "created_at": str(player.get("createdAt", "")),
            "last_seen":  str(player.get("lastLogin", "")),
        },
        "saves": {s["category"]: s["data"] for s in saves}
    }

@api_router.patch("/admin/projects/{slug}/play/players/{player_id}/saves/{category}")
async def admin_play_update_save(slug: str, player_id: str, category: str, request: Request, user=Depends(require_permission("manage_play"))):
    if category not in PLAY_SAVE_CATEGORIES:
        raise HTTPException(400, "Catégorie invalide")
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    body = await request.json()
    data = str(body.get("data", "{}"))
    try:
        json.loads(data)
    except Exception:
        raise HTTPException(400, "JSON invalide")
    await db.play_saves.update_one(
        {"user_id": oid, "project_slug": slug, "category": category},
        {"$set": {"data": data, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"ok": True}

@api_router.delete("/admin/projects/{slug}/play/players/{player_id}/tokens")
async def admin_play_revoke_tokens(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    """Force-disconnect a player from all devices."""
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_refresh_tokens.update_many({"user_id": oid}, {"$set": {"is_revoked": True}})
    return {"ok": True}

@api_router.delete("/admin/projects/{slug}/play/players/{player_id}")
async def admin_play_delete_player(slug: str, player_id: str, user=Depends(require_permission("manage_play"))):
    """Deletes play saves for this project + revokes play tokens. Does NOT delete the shared user account."""
    try:
        oid = ObjectId(player_id)
    except Exception:
        raise HTTPException(400, "ID invalide")
    await db.play_saves.delete_many({"user_id": oid, "project_slug": slug})
    await db.play_refresh_tokens.delete_many({"user_id": oid})
    return {"ok": True}

# ═══════════════════════════════════════════════════════════════════════════════
#  CHAT & GUILDS (Play — Global channel + per-project guilds)
# ═══════════════════════════════════════════════════════════════════════════════
# Separate from the legacy shared-API-key chat above: these routes authenticate
# via the Play JWT (same as saves/nicknames/bans), so a message's sender identity
# can never be spoofed by the client. The legacy raw blocks/endpoints are untouched.

CHAT_MAX_LEN   = 200
CHAT_HISTORY_CAP = 150
REACTION_EMOJIS = {"👍", "❤️", "😂", "😮", "😢", "🔥"}
GUILD_LOGOS = ["shield", "sword", "flame", "star", "wolf", "dragon", "crown", "skull", "eagle", "lion", "anchor", "leaf"]
GUILD_NAME_MIN, GUILD_NAME_MAX = 3, 30

async def _get_chat_maintenance(project_slug: str) -> dict:
    project = await db.projects.find_one({"slug": project_slug}, {"chat_global_enabled": 1, "chat_guilds_enabled": 1})
    if not project:
        return {"chat_global_enabled": True, "chat_guilds_enabled": True}
    return {
        "chat_global_enabled": project.get("chat_global_enabled", True),
        "chat_guilds_enabled": project.get("chat_guilds_enabled", True),
    }

def _serialize_guild(g: dict, my_role: Optional[str] = None) -> dict:
    out = serialize_doc(g)
    if my_role is not None:
        out["my_role"] = my_role
    return out

# ── Messaging ─────────────────────────────────────────────────────────────────

@api_router.post("/play/chat/send")
@limiter.limit("1/2seconds")
async def play_chat_send(request: Request, req: PlayChatSendRequest, play_user=Depends(_get_play_user_from_access)):
    project_slug = req.project_slug.strip()
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    if await db.chat_bans.find_one({"user_id": play_user["_id"], "project_slug": project_slug}):
        raise HTTPException(403, "You are blocked from chat in this game")
    mute = await db.chat_mutes.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    now = datetime.now(timezone.utc)
    if mute and mute["muted_until"] > now:
        raise HTTPException(403, f"Muted for {int((mute['muted_until'] - now).total_seconds())} more seconds")

    maintenance = await _get_chat_maintenance(project_slug)
    guild_id = None
    if req.channel == "global":
        if not maintenance["chat_global_enabled"]:
            raise HTTPException(503, "Global chat is currently disabled")
    else:
        if not maintenance["chat_guilds_enabled"]:
            raise HTTPException(503, "The guild system is currently disabled")
        membership = await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
        if not membership:
            raise HTTPException(400, "You are not in a guild")
        guild_id = membership["guild_id"]

    message = req.message.strip()[:CHAT_MAX_LEN]
    if not message:
        raise HTTPException(400, "Message required")
    banned_words = await get_banned_words()
    clean_message = censor_message(message, banned_words)

    nickname_doc = await db.play_nicknames.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    username = nickname_doc["nickname"] if nickname_doc else play_user["username"]

    doc = {
        "project_slug": project_slug, "channel": req.channel, "guild_id": guild_id,
        "user_id": play_user["_id"], "username": username, "level": None,
        "message": clean_message, "reactions": [], "timestamp": now,
    }
    result = await db.chat_messages.insert_one(doc)
    doc["_id"] = result.inserted_id

    scope_query: dict = {"project_slug": project_slug, "channel": req.channel}
    if guild_id:
        scope_query["guild_id"] = guild_id
    count = await db.chat_messages.count_documents(scope_query)
    if count > CHAT_HISTORY_CAP:
        oldest = await db.chat_messages.find(scope_query).sort("timestamp", 1).limit(count - CHAT_HISTORY_CAP).to_list(count - CHAT_HISTORY_CAP)
        await db.chat_messages.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})

    return {"success": True, "message_data": serialize_doc(doc)}

@api_router.get("/play/chat")
async def play_chat_get(project_slug: str, channel: str = "global", limit: int = 50,
                         play_user=Depends(_get_play_user_from_access)):
    limit = min(max(limit, 1), 100)
    blocked = await db.chat_bans.find_one({"user_id": play_user["_id"], "project_slug": project_slug}) is not None
    mute = await db.chat_mutes.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    muted_until = None
    if mute and mute["muted_until"] > datetime.now(timezone.utc):
        muted_until = mute["muted_until"].isoformat()

    query: dict = {"project_slug": project_slug, "channel": channel}
    if channel == "guild":
        membership = await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
        if not membership:
            return {"messages": [], "blocked": blocked, "muted_until": muted_until}
        query["guild_id"] = membership["guild_id"]
    messages = await db.chat_messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    messages.reverse()
    return {"messages": [serialize_doc(m) for m in messages], "blocked": blocked, "muted_until": muted_until}

@api_router.post("/play/chat/{message_id}/react")
async def play_chat_react(message_id: str, req: ChatReactionRequest, play_user=Depends(_get_play_user_from_access)):
    if req.emoji not in REACTION_EMOJIS:
        raise HTTPException(400, "Invalid emoji")
    try:
        oid = ObjectId(message_id)
    except Exception:
        raise HTTPException(400, "Invalid message ID")
    msg = await db.chat_messages.find_one({"_id": oid})
    if not msg:
        raise HTTPException(404, "Message not found")
    uid_str = str(play_user["_id"])
    reactions = msg.get("reactions", [])
    entry = next((r for r in reactions if r["emoji"] == req.emoji), None)
    if entry and uid_str in entry.get("user_ids", []):
        entry["user_ids"].remove(uid_str)
        if not entry["user_ids"]:
            reactions = [r for r in reactions if r["emoji"] != req.emoji]
    elif entry:
        entry["user_ids"].append(uid_str)
    else:
        reactions.append({"emoji": req.emoji, "user_ids": [uid_str]})
    await db.chat_messages.update_one({"_id": oid}, {"$set": {"reactions": reactions}})
    return {"success": True, "reactions": reactions}

# ── Guilds ────────────────────────────────────────────────────────────────────

@api_router.post("/play/guilds")
@limiter.limit("5/hour")
async def play_create_guild(request: Request, req: PlayGuildCreateRequest, play_user=Depends(_get_play_user_from_access)):
    project_slug = req.project_slug.strip()
    if not project_slug:
        raise HTTPException(400, "project_slug requis")
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    if not (await _get_chat_maintenance(project_slug))["chat_guilds_enabled"]:
        raise HTTPException(503, "The guild system is currently disabled")
    if await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug}):
        raise HTTPException(400, "You are already in a guild")
    name = req.name.strip()
    if not (GUILD_NAME_MIN <= len(name) <= GUILD_NAME_MAX):
        raise HTTPException(400, f"Guild name must be {GUILD_NAME_MIN}-{GUILD_NAME_MAX} characters")
    if req.logo_id not in GUILD_LOGOS:
        raise HTTPException(400, "Invalid logo")
    if await db.guilds.find_one({"project_slug": project_slug, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
        raise HTTPException(400, "A guild with this name already exists")
    now = datetime.now(timezone.utc)
    doc = {
        "project_slug": project_slug, "name": name, "description": req.description.strip()[:200],
        "color": req.color, "logo_id": req.logo_id, "owner_id": play_user["_id"],
        "member_count": 1, "created_at": now,
    }
    result = await db.guilds.insert_one(doc)
    doc["_id"] = result.inserted_id
    await db.guild_members.insert_one({
        "guild_id": result.inserted_id, "project_slug": project_slug,
        "user_id": play_user["_id"], "role": "owner", "joined_at": now,
    })
    await log_action("guild", f"Guild '{name}' created", project_slug=project_slug, user=play_user["username"])
    return {"success": True, "guild": _serialize_guild(doc, my_role="owner")}

@api_router.get("/play/guilds")
async def play_list_guilds(project_slug: str, search: Optional[str] = None, play_user=Depends(_get_play_user_from_access)):
    query: dict = {"project_slug": project_slug}
    if search:
        query["name"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    guilds = await db.guilds.find(query).sort("member_count", -1).to_list(200)
    return {"guilds": [serialize_doc(g) for g in guilds]}

@api_router.get("/play/guilds/mine")
async def play_my_guild(project_slug: str, play_user=Depends(_get_play_user_from_access)):
    membership = await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug})
    if not membership:
        return {"guild": None}
    guild = await db.guilds.find_one({"_id": membership["guild_id"]})
    if not guild:
        return {"guild": None}
    return {"guild": _serialize_guild(guild, my_role=membership["role"])}

@api_router.get("/play/guilds/{guild_id}/members")
async def play_list_guild_members(guild_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership:
        raise HTTPException(403, "Not a member of this guild")
    members = await db.guild_members.find({"guild_id": oid}).sort("joined_at", 1).to_list(500)
    users = await db.users.find({"_id": {"$in": [m["user_id"] for m in members]}}).to_list(500)
    users_by_id = {u["_id"]: u for u in users}
    return {"members": [
        {"user_id": str(m["user_id"]), "username": users_by_id.get(m["user_id"], {}).get("username", "?"),
         "role": m["role"], "joined_at": m["joined_at"].isoformat()}
        for m in members
    ]}

@api_router.post("/play/guilds/{guild_id}/join")
@limiter.limit("10/minute")
async def play_join_guild(request: Request, guild_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    guild = await db.guilds.find_one({"_id": oid})
    if not guild:
        raise HTTPException(404, "Guild not found")
    project_slug = guild["project_slug"]
    if await _is_project_banned(play_user["_id"], project_slug):
        raise HTTPException(403, "Banned from this game")
    if not (await _get_chat_maintenance(project_slug))["chat_guilds_enabled"]:
        raise HTTPException(503, "The guild system is currently disabled")
    if await db.guild_members.find_one({"user_id": play_user["_id"], "project_slug": project_slug}):
        raise HTTPException(400, "You are already in a guild")
    try:
        await db.guild_members.insert_one({
            "guild_id": oid, "project_slug": project_slug,
            "user_id": play_user["_id"], "role": "member", "joined_at": datetime.now(timezone.utc),
        })
    except DuplicateKeyError:
        raise HTTPException(400, "You are already in a guild")
    await db.guilds.update_one({"_id": oid}, {"$inc": {"member_count": 1}})
    return {"success": True}

@api_router.post("/play/guilds/{guild_id}/leave")
async def play_leave_guild(guild_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership:
        raise HTTPException(404, "Not a member of this guild")
    await db.guild_members.delete_one({"_id": membership["_id"]})
    await db.guilds.update_one({"_id": oid}, {"$inc": {"member_count": -1}})

    if membership["role"] == "owner":
        # Auto-promote: longest-standing officer, else longest-standing member, else disband.
        next_owner = await db.guild_members.find_one({"guild_id": oid, "role": "officer"}, sort=[("joined_at", 1)])
        if not next_owner:
            next_owner = await db.guild_members.find_one({"guild_id": oid}, sort=[("joined_at", 1)])
        if next_owner:
            await db.guild_members.update_one({"_id": next_owner["_id"]}, {"$set": {"role": "owner"}})
        else:
            await db.guilds.delete_one({"_id": oid})
            await db.chat_messages.delete_many({"guild_id": oid})
    return {"success": True}

@api_router.patch("/play/guilds/{guild_id}")
async def play_update_guild(guild_id: str, req: PlayGuildUpdateRequest, play_user=Depends(_get_play_user_from_access)):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership or membership["role"] not in ("owner", "officer"):
        raise HTTPException(403, "Only the owner or an officer can edit the guild")
    guild = await db.guilds.find_one({"_id": oid})
    if not guild:
        raise HTTPException(404, "Guild not found")
    updates: dict = {}
    if req.name is not None:
        name = req.name.strip()
        if not (GUILD_NAME_MIN <= len(name) <= GUILD_NAME_MAX):
            raise HTTPException(400, f"Guild name must be {GUILD_NAME_MIN}-{GUILD_NAME_MAX} characters")
        if await db.guilds.find_one({"project_slug": guild["project_slug"], "_id": {"$ne": oid},
                                      "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
            raise HTTPException(400, "A guild with this name already exists")
        updates["name"] = name
    if req.description is not None:
        updates["description"] = req.description.strip()[:200]
    if req.color is not None:
        updates["color"] = req.color
    if req.logo_id is not None:
        if req.logo_id not in GUILD_LOGOS:
            raise HTTPException(400, "Invalid logo")
        updates["logo_id"] = req.logo_id
    if updates:
        await db.guilds.update_one({"_id": oid}, {"$set": updates})
    updated = await db.guilds.find_one({"_id": oid})
    return {"success": True, "guild": _serialize_guild(updated, my_role=membership["role"])}

@api_router.patch("/play/guilds/{guild_id}/members/{member_user_id}")
async def play_set_member_role(guild_id: str, member_user_id: str, req: GuildMemberRoleRequest,
                                play_user=Depends(_get_play_user_from_access)):
    try:
        oid, member_oid = ObjectId(guild_id), ObjectId(member_user_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership or membership["role"] != "owner":
        raise HTTPException(403, "Only the owner can change roles")
    target = await db.guild_members.find_one({"guild_id": oid, "user_id": member_oid})
    if not target:
        raise HTTPException(404, "Member not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot change the owner's role")
    await db.guild_members.update_one({"_id": target["_id"]}, {"$set": {"role": req.role}})
    return {"success": True}

@api_router.delete("/play/guilds/{guild_id}/members/{member_user_id}")
async def play_kick_member(guild_id: str, member_user_id: str, play_user=Depends(_get_play_user_from_access)):
    try:
        oid, member_oid = ObjectId(guild_id), ObjectId(member_user_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    membership = await db.guild_members.find_one({"guild_id": oid, "user_id": play_user["_id"]})
    if not membership or membership["role"] not in ("owner", "officer"):
        raise HTTPException(403, "Only the owner or an officer can kick members")
    target = await db.guild_members.find_one({"guild_id": oid, "user_id": member_oid})
    if not target:
        raise HTTPException(404, "Member not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot kick the owner")
    if membership["role"] == "officer" and target["role"] == "officer":
        raise HTTPException(403, "Officers cannot kick other officers")
    await db.guild_members.delete_one({"_id": target["_id"]})
    await db.guilds.update_one({"_id": oid}, {"$inc": {"member_count": -1}})
    return {"success": True}

# ── Dashboard moderation (chat bans/mutes, guild oversight, maintenance) ─────

@api_router.get("/admin/projects/{slug}/chat/moderation")
async def admin_chat_moderation_list(slug: str, user=Depends(require_permission("manage_chat"))):
    bans = await db.chat_bans.find({"project_slug": slug}).to_list(500)
    mutes = await db.chat_mutes.find({"project_slug": slug}).to_list(500)
    now = datetime.now(timezone.utc)
    user_ids = list({b["user_id"] for b in bans} | {m["user_id"] for m in mutes})
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(500) if user_ids else []
    users_by_id = {u["_id"]: u for u in users}
    return {
        "bans": [
            {"user_id": str(b["user_id"]), "username": users_by_id.get(b["user_id"], {}).get("username", "?"),
             "banned_at": b["banned_at"].isoformat(), "banned_by": b.get("banned_by")}
            for b in bans
        ],
        "mutes": [
            {"user_id": str(m["user_id"]), "username": users_by_id.get(m["user_id"], {}).get("username", "?"),
             "muted_until": m["muted_until"].isoformat(), "active": m["muted_until"] > now,
             "reason": m.get("reason", ""), "muted_by": m.get("muted_by")}
            for m in mutes
        ],
    }

@api_router.post("/admin/projects/{slug}/chat/ban")
async def admin_chat_ban(slug: str, req: ChatBanRequest, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(req.user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await db.chat_bans.update_one(
        {"user_id": oid, "project_slug": slug},
        {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": user["username"]}},
        upsert=True,
    )
    await log_action("chat", f"Player {req.user_id} blocked from chat", project_slug=slug, user=user["username"])
    return {"success": True}

@api_router.delete("/admin/projects/{slug}/chat/ban/{user_id}")
async def admin_chat_unban(slug: str, user_id: str, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await db.chat_bans.delete_one({"user_id": oid, "project_slug": slug})
    await log_action("chat", f"Player {user_id} unblocked from chat", project_slug=slug, user=user["username"])
    return {"success": True}

@api_router.post("/admin/projects/{slug}/chat/mute")
async def admin_chat_mute(slug: str, req: ChatMuteRequest, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(req.user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    if req.duration_minutes <= 0:
        raise HTTPException(400, "Duration must be positive")
    muted_until = datetime.now(timezone.utc) + timedelta(minutes=req.duration_minutes)
    await db.chat_mutes.update_one(
        {"user_id": oid, "project_slug": slug},
        {"$set": {"muted_until": muted_until, "muted_by": user["username"], "reason": req.reason.strip()}},
        upsert=True,
    )
    await log_action("chat", f"Player {req.user_id} muted for {req.duration_minutes} minutes", project_slug=slug, user=user["username"])
    return {"success": True, "muted_until": muted_until.isoformat()}

@api_router.delete("/admin/projects/{slug}/chat/mute/{user_id}")
async def admin_chat_unmute(slug: str, user_id: str, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await db.chat_mutes.delete_one({"user_id": oid, "project_slug": slug})
    await log_action("chat", f"Player {user_id} unmuted", project_slug=slug, user=user["username"])
    return {"success": True}

@api_router.get("/admin/projects/{slug}/guilds")
async def admin_list_guilds(slug: str, user=Depends(require_permission("manage_chat"))):
    guilds = await db.guilds.find({"project_slug": slug}).sort("member_count", -1).to_list(500)
    return {"guilds": [serialize_doc(g) for g in guilds]}

@api_router.delete("/admin/projects/{slug}/guilds/{guild_id}")
async def admin_delete_guild(slug: str, guild_id: str, user=Depends(require_permission("manage_chat"))):
    try:
        oid = ObjectId(guild_id)
    except Exception:
        raise HTTPException(400, "Invalid guild ID")
    guild = await db.guilds.find_one({"_id": oid, "project_slug": slug})
    if not guild:
        raise HTTPException(404, "Guild not found")
    await db.guild_members.delete_many({"guild_id": oid})
    await db.chat_messages.delete_many({"guild_id": oid})
    await db.guilds.delete_one({"_id": oid})
    await log_action("guild", f"Guild '{guild['name']}' disbanded by admin", project_slug=slug, user=user["username"])
    return {"success": True}

@api_router.get("/admin/projects/{slug}/chat/settings")
async def admin_get_chat_settings(slug: str, user=Depends(require_permission("manage_chat"))):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(404, "Project not found")
    return {
        "chat_global_enabled": project.get("chat_global_enabled", True),
        "chat_guilds_enabled": project.get("chat_guilds_enabled", True),
    }

@api_router.put("/admin/projects/{slug}/chat/settings")
async def admin_update_chat_settings(slug: str, req: ChatMaintenanceRequest, user=Depends(require_permission("manage_chat"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    await db.projects.update_one({"slug": slug}, {"$set": updates})
    parts = [f"{k.replace('chat_', '').replace('_enabled', '')}: {'on' if v else 'off'}" for k, v in updates.items()]
    await log_action("chat", "Chat settings updated (" + ", ".join(parts) + ")", project_slug=slug, user=user["username"])
    return {"success": True, **updates}

# ============================================================
# SUPER ADMIN CLI
# ============================================================
# Closed whitelist of commands only. Every verb below wraps the SAME database
# operations already used by their equivalent dashboard endpoints — no raw
# Mongo queries, no code evaluation. Destructive verbs are two-phase: the
# first call (confirm=False) returns a preview only; the actual write only
# happens when the client resends the identical command with confirm=True.

_CLI_HELP_TEXT = [
    "Available commands:",
    "  help",
    "  user find <email|username>",
    "  user suspend <email|username>",
    "  user unsuspend <email|username>",
    "  player find <project_slug> <username|nickname|email|id>",
    "  player ban <project_slug> <username|nickname|email|id>",
    "  player unban <project_slug> <username|nickname|email|id>",
    "  player revoke <project_slug> <username|nickname|email|id>",
    "  loyalty show <email>",
    "  loyalty adjust <email> <+amount|-amount> [reason]",
    "  purchases show <email>",
    "",
    "Destructive commands ask for confirmation before applying any change.",
]

async def _cli_find_user_doc(query: str):
    q = query.strip()
    if not q:
        return None
    user = await db.users.find_one({"email": q.lower()})
    if user:
        return user
    user = await db.users.find_one({"username": {"$regex": f"^{re.escape(q)}$", "$options": "i"}})
    if user:
        return user
    try:
        return await db.users.find_one({"_id": ObjectId(q)})
    except Exception:
        return None

async def _cli_find_player_doc(project_slug: str, query: str):
    q = query.strip()
    if not q:
        return None
    nick = await db.play_nicknames.find_one(
        {"project_slug": project_slug, "nickname": {"$regex": f"^{re.escape(q)}$", "$options": "i"}}
    )
    if nick:
        user = await db.users.find_one({"_id": nick["user_id"]})
        if user:
            return user
    return await _cli_find_user_doc(q)

def _cli_user_summary(u) -> List[str]:
    return [
        f"id:        {str(u['_id'])}",
        f"username:  {u.get('username', '')}",
        f"email:     {u.get('email', '')}",
        f"role:      {u.get('role', 'user')}",
        f"suspended: {u.get('isSuspended', False)}",
        f"createdAt: {u['createdAt'].isoformat() if isinstance(u.get('createdAt'), datetime) else u.get('created_at', '')}",
        f"lastLogin: {u['lastLogin'].isoformat() if isinstance(u.get('lastLogin'), datetime) else 'never'}",
    ]

class _CliError(Exception):
    pass

async def _cli_dispatch(tokens: List[str], confirm: bool, admin: dict):
    """Returns (lines, needs_confirm). Raises _CliError with a user-facing message on bad input."""
    if not tokens:
        raise _CliError("Empty command. Type 'help' for the command list.")
    verb = tokens[0].lower()

    if verb == "help":
        return _CLI_HELP_TEXT, False

    if verb == "user" and len(tokens) >= 3:
        sub, query = tokens[1].lower(), tokens[2]
        target = await _cli_find_user_doc(query)
        if not target:
            raise _CliError(f"No user found matching '{query}'.")

        if sub == "find":
            return _cli_user_summary(target), False

        if sub in ("suspend", "unsuspend"):
            want_suspended = sub == "suspend"
            if target.get("role") == "super_admin":
                raise _CliError("Cannot suspend a super admin account.")
            if str(target["_id"]) == admin["id"]:
                raise _CliError("Cannot suspend your own account.")
            if not confirm:
                action = "Suspend" if want_suspended else "Reactivate"
                return [f"{action} account '{target.get('username')}' ({target.get('email')})?",
                        "Type 'y' to confirm, or anything else to cancel."], True
            await db.users.update_one({"_id": target["_id"]}, {"$set": {"isSuspended": want_suspended}})
            action = "suspended" if want_suspended else "reactivated"
            await log_action("user_action", f"[CLI] User '{target.get('username')}' {action}", user=admin["username"])
            return [f"OK — user '{target.get('username')}' {action}."], False

    if verb == "player" and len(tokens) >= 4:
        sub, project_slug, query = tokens[1].lower(), tokens[2], tokens[3]
        project = await db.projects.find_one({"slug": project_slug})
        if not project:
            raise _CliError(f"No project with slug '{project_slug}'.")
        target = await _cli_find_player_doc(project_slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{project_slug}'.")
        oid = target["_id"]

        if sub == "find":
            saves = await db.play_saves.find({"user_id": oid, "project_slug": project_slug}).to_list(None)
            ban = await db.play_bans.find_one({"user_id": oid, "project_slug": project_slug})
            nick = await db.play_nicknames.find_one({"user_id": oid, "project_slug": project_slug})
            lines = _cli_user_summary(target) + [
                f"nickname:  {nick['nickname'] if nick else '(none)'}",
                f"banned:    {ban is not None}",
                f"saves:     {', '.join(s['category'] for s in saves) if saves else '(none)'}",
            ]
            return lines, False

        if sub in ("ban", "unban"):
            want_banned = sub == "ban"
            if not confirm:
                action = "Ban" if want_banned else "Unban"
                return [f"{action} '{target.get('username')}' from project '{project_slug}'?",
                        "Type 'y' to confirm, or anything else to cancel."], True
            if want_banned:
                await db.play_bans.update_one(
                    {"user_id": oid, "project_slug": project_slug},
                    {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": admin["username"]}},
                    upsert=True,
                )
            else:
                await db.play_bans.delete_one({"user_id": oid, "project_slug": project_slug})
            action = "banned" if want_banned else "unbanned"
            await log_action("player", f"[CLI] Player '{target.get('username')}' {action}",
                              project_slug=project_slug, user=admin["username"])
            return [f"OK — player '{target.get('username')}' {action} from '{project_slug}'."], False

        if sub == "revoke":
            if not confirm:
                return [f"Revoke all sessions for '{target.get('username')}' in project '{project_slug}'?",
                        "Type 'y' to confirm, or anything else to cancel."], True
            await db.play_refresh_tokens.update_many({"user_id": oid}, {"$set": {"is_revoked": True}})
            await log_action("player", f"[CLI] Sessions revoked for player '{target.get('username')}'",
                              project_slug=project_slug, user=admin["username"])
            return [f"OK — all sessions revoked for '{target.get('username')}'."], False

    if verb == "loyalty" and len(tokens) >= 3:
        sub, email = tokens[1].lower(), tokens[2].lower().strip()
        target = await db.users.find_one({"email": email})
        if not target:
            raise _CliError(f"No user with email '{email}'.")
        points = await db.user_points.find_one({"email": email})
        total_cents = points.get("total_spent_cents", 0) if points else 0

        if sub == "show":
            return [
                f"email: {email}",
                f"tier:  {get_tier(total_cents)}",
                f"total: ${total_cents / 100:.2f}",
            ], False

        if sub == "adjust":
            if len(tokens) < 4:
                raise _CliError("Usage: loyalty adjust <email> <+amount|-amount> [reason]")
            try:
                adjust_dollars = float(tokens[3])
            except ValueError:
                raise _CliError(f"'{tokens[3]}' is not a valid amount.")
            if adjust_dollars == 0:
                raise _CliError("Adjustment cannot be zero.")
            reason = " ".join(tokens[4:])
            if not confirm:
                sign = "+" if adjust_dollars > 0 else ""
                return [f"Adjust loyalty for '{email}' by {sign}${adjust_dollars:.2f}"
                        + (f" (reason: {reason})" if reason else "") + "?",
                        "Type 'y' to confirm, or anything else to cancel."], True
            adjust_cents = round(adjust_dollars * 100)
            new_total = max(0, total_cents + adjust_cents)
            new_tier = get_tier(new_total)
            await db.user_points.update_one(
                {"email": email},
                {"$set": {"total_spent_cents": new_total, "tier": new_tier, "updated_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
            reason_str = f" (reason: {reason})" if reason else ""
            await log_action("user_action",
                f"[CLI] Admin '{admin['username']}' adjusted loyalty for '{target.get('username', email)}': "
                f"${adjust_dollars:+.2f}{reason_str} -> {new_total}cts ({new_tier})",
                user=admin["username"])
            await _create_notification(
                user_id=str(target["_id"]),
                message=f"{'🏆' if adjust_cents > 0 else '📉'} Your loyalty balance was adjusted by ${abs(adjust_dollars):.2f}. Current tier: {new_tier.capitalize()}.",
                notif_type="loyalty_adjustment",
            )
            return [f"OK — new total ${new_total / 100:.2f} ({new_tier})."], False

    if verb == "purchases" and len(tokens) >= 3 and tokens[1].lower() == "show":
        email = tokens[2].lower().strip()
        target = await db.users.find_one({"email": email})
        if not target:
            raise _CliError(f"No user with email '{email}'.")
        games = await db.game_purchases.find({"email": email}).sort("purchased_at", -1).to_list(200)
        lines = [f"Full-game purchases for {email}:"]
        if games:
            for g in games:
                lines.append(f"  - {g.get('game_name', g.get('game_slug'))}  ${g.get('amount_paid_cents', 0)/100:.2f}  {g.get('purchased_at', '')}")
        else:
            lines.append("  (none)")
        return lines, False

    raise _CliError(f"Unknown command '{' '.join(tokens)}'. Type 'help' for the command list.")

@api_router.post("/admin/cli/execute")
@limiter.limit("20/minute")
async def cli_execute(request: Request, body: CliExecuteRequest, admin=Depends(require_super_admin)):
    raw = body.command.strip()
    if not raw:
        raise HTTPException(400, "Empty command")
    if len(raw) > 500:
        raise HTTPException(400, "Command too long")
    try:
        tokens = shlex.split(raw)
    except ValueError:
        raise HTTPException(400, "Unmatched quotes in command")

    try:
        lines, needs_confirm = await _cli_dispatch(tokens, body.confirm, admin)
        await log_action("cli", f"[CLI] '{admin['username']}' ran: {raw}"
                          + (" (confirmed)" if body.confirm else ""), user=admin["username"])
        return {"output": lines, "needs_confirm": needs_confirm, "error": False}
    except _CliError as e:
        return {"output": [str(e)], "needs_confirm": False, "error": True}

# ============================================================
# CAREERS
# ============================================================

class CareerCreateRequest(BaseModel):
    title: str
    department: str
    contract_type: str
    location: str
    description: str
    requirements: List[str] = []
    tools: List[str] = []
    is_open: bool = True

class CareerUpdateRequest(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    contract_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    is_open: Optional[bool] = None

@api_router.get("/careers")
async def list_careers_public():
    """Public — returns only open positions."""
    docs = await db.careers.find({"is_open": True}).sort("created_at", -1).to_list(100)
    return {"careers": [{**{k: str(v) if k == "_id" else v for k, v in d.items()}} for d in docs]}

@api_router.get("/admin/careers")
async def list_careers_admin(user=Depends(require_any_of("manager_careers"))):
    """Admin — returns all positions (open and closed)."""
    docs = await db.careers.find().sort("created_at", -1).to_list(200)
    return {"careers": [{**{k: str(v) if k == "_id" else v for k, v in d.items()}} for d in docs]}

@api_router.post("/admin/careers")
async def create_career(body: CareerCreateRequest, user=Depends(require_any_of("manager_careers"))):
    now = datetime.now(timezone.utc)
    doc = {**body.dict(), "created_at": now, "updated_at": now, "author": user["username"]}
    result = await db.careers.insert_one(doc)
    await log_action("careers", f"Career '{body.title}' created", user=user["username"])
    return {"id": str(result.inserted_id)}

@api_router.put("/admin/careers/{career_id}")
async def update_career(career_id: str, body: CareerUpdateRequest, user=Depends(require_any_of("manager_careers"))):
    try:
        oid = ObjectId(career_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.careers.update_one({"_id": oid}, {"$set": update})
    return {"ok": True}

@api_router.delete("/admin/careers/{career_id}")
async def delete_career(career_id: str, user=Depends(require_any_of("manager_careers"))):
    try:
        oid = ObjectId(career_id)
    except Exception:
        raise HTTPException(400, "Invalid ID")
    await db.careers.delete_one({"_id": oid})
    return {"ok": True}

# All api_router routes (including Play) must be registered before include_router
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True, sparse=True)
        await db.projects.create_index("slug", unique=True)
        await db.items.create_index([("project_slug", 1), ("uid", 1)])
        await db.logs.create_index([("project_slug", 1), ("type", 1)])
        await db.logs.create_index("timestamp")
        # Sparse: legacy docs only have "variable_name", new docs only have "name" — sparse
        # keeps each shape's uniqueness constraint from colliding with the other on the
        # "missing field" (null) case. The old index is dropped/recreated as sparse since a
        # non-sparse unique index with the same key pattern already existed pre-migration.
        try:
            await db.variables.drop_index("project_slug_1_variable_name_1")
        except Exception:
            pass
        await db.variables.create_index([("project_slug", 1), ("variable_name", 1)], unique=True, sparse=True)
        await db.variables.create_index([("project_slug", 1), ("name", 1)], unique=True, sparse=True)
        await db.website_games.create_index("slug", unique=True)
        await db.blog_posts.create_index("slug", unique=True)
        await db.chat_messages.create_index([("project_slug", 1), ("timestamp", 1)])
        await db.website_shop_products.create_index([("game_slug", 1), ("active", 1)])
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
        await db.play_saves.create_index([("user_id", 1), ("project_slug", 1), ("category", 1)], unique=True)
        await db.play_refresh_tokens.create_index("jti", unique=True)
        await db.play_refresh_tokens.create_index([("user_id", 1), ("is_revoked", 1)])
        await db.careers.create_index("created_at")
        await db.careers.create_index("is_open")
        await db.play_nicknames.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.play_bans.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.play_first_seen.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.chat_messages.create_index([("project_slug", 1), ("channel", 1), ("guild_id", 1), ("timestamp", 1)])
        await db.guilds.create_index([("project_slug", 1), ("name", 1)])
        await db.guild_members.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.guild_members.create_index([("guild_id", 1)])
        await db.chat_bans.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        await db.chat_mutes.create_index([("user_id", 1), ("project_slug", 1)], unique=True)
        logger.info("Database indexes initialized")

        # Migration: merge the old per-game shop categories (now retired in favor of one
        # global category list) into website_shop_global_settings. Non-destructive — only
        # runs while the global list is still empty, and never touches/deletes the old
        # per-game website_shop_settings documents themselves.
        global_shop = await db.website_shop_global_settings.find_one({})
        if not global_shop or not global_shop.get("categories"):
            merged, seen_labels = [], set()
            async for doc in db.website_shop_settings.find({}):
                for cat in doc.get("categories", []):
                    label = (cat.get("label") or "").strip()
                    if label and label.lower() not in seen_labels:
                        seen_labels.add(label.lower())
                        merged.append(cat)
            if merged:
                await db.website_shop_global_settings.update_one({}, {"$set": {"categories": merged}}, upsert=True)
                logger.info(f"Shop categories migration: merged {len(merged)} categories from per-game settings")

        # Migration: backfill stable_id on files cloned before the stable-ID
        # system existed, so every version shares the original asset's ID.
        legacy = await db.game_files.find(
            {"cloned_from": {"$exists": True}, "stable_id": {"$exists": False}}
        ).to_list(2000)
        for f in legacy:
            root_id = f["cloned_from"]
            seen = set()
            while root_id not in seen:
                seen.add(root_id)
                try:
                    src = await db.game_files.find_one({"_id": ObjectId(root_id)})
                except Exception:
                    src = None
                if src and src.get("stable_id"):
                    root_id = src["stable_id"]
                    break
                if src and src.get("cloned_from"):
                    root_id = src["cloned_from"]
                else:
                    break
            await db.game_files.update_one({"_id": f["_id"]}, {"$set": {"stable_id": root_id}})
        if legacy:
            logger.info(f"Backfilled stable_id on {len(legacy)} cloned game files")
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
