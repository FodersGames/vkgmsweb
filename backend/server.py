from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File
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

JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_urlsafe(64))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Initial setup key — only works ONCE to bootstrap the Super Admin
SETUP_KEY = os.environ.get('MASTER_KEY', '')

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

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

class GameUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    screenshots: Optional[List[str]] = None
    platforms: Optional[List[dict]] = None
    status: Optional[Literal["published", "draft", "coming_soon"]] = None
    featured: Optional[bool] = None

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

class RegisterRequest(BaseModel):
    email: str
    password: str
    firstName: str
    lastName: str
    username: str

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
    return bcrypt.hashpw(key.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

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
    if project.get("chat_api_key") != api_key:
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
    username = body.username.strip()
    firstName = body.firstName.strip()
    lastName = body.lastName.strip()
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if not re.match(r'^[a-zA-Z0-9_]{3,32}$', username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters (letters, numbers, underscores only)")
    if not (1 <= len(firstName) <= 50):
        raise HTTPException(status_code=400, detail="First name must be 1-50 characters")
    if not (1 <= len(lastName) <= 50):
        raise HTTPException(status_code=400, detail="Last name must be 1-50 characters")
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
async def change_password(body: ChangePasswordRequest, user=Depends(get_current_user)):
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
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"permissions": req.permissions}})
    await log_action("user_action", f"User '{target.get('username', user_id)}' permissions updated", user=admin["username"])
    return {"success": True, "id": user_id, "permissions": req.permissions}

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
           "created_at": datetime.now(timezone.utc), "created_by": user["username"],
           "updated_at": datetime.now(timezone.utc)}
    await db.website_games.insert_one(doc)
    await log_action("website", f"Game '{req.name}' created", user=user["username"])
    return {"success": True, "game": serialize_doc(doc)}

@api_router.get("/website/games")
async def list_games_admin(user=Depends(get_current_user)):
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
async def list_blog_admin(user=Depends(get_current_user)):
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
async def create_checkout_session(request: Request, game_slug: str, req: ShopCheckoutRequest):
    if not req.player_uid.strip():
        raise HTTPException(status_code=400, detail="Player UID required")
    try:
        oid = ObjectId(req.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.website_shop_products.find_one({"_id": oid, "game_slug": game_slug, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    origin = request.headers.get("origin") or ""
    if not origin:
        referer = request.headers.get("referer", "")
        if referer:
            parts = referer.split("/")
            if len(parts) >= 3:
                origin = "/".join(parts[:3])
    if not origin:
        origin = os.environ.get("FRONTEND_URL", "")
    images = [product["image_url"]] if (product.get("image_url") and product["image_url"].startswith("http")) else []

    def _create():
        return stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
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
        uid = meta.get("player_uid", "").strip()
        product_id = meta.get("product_id", "")
        game_slug = meta.get("game_slug", "")

        if uid and product_id and game_slug:
            try:
                product = await db.website_shop_products.find_one({"_id": ObjectId(product_id), "game_slug": game_slug})
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
                        f"Shop: {product['amount']}x {product['variable']} → {uid} (Stripe payment)",
                        project_slug=product["project_slug"], user="stripe_shop",
                        uid=uid, variable=product["variable"], amount=product["amount"])
                    logger.info(f"Shop delivery OK: {product['amount']}x {product['variable']} to {uid}")
            except Exception as e:
                logger.error(f"Shop webhook delivery error: {e}")

    return {"received": True}

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
async def get_notifications(page: int = 1, limit: int = 20, user=Depends(get_current_user)):
    user_oid = ObjectId(user["id"])
    skip = (page - 1) * limit
    total = await db.notifications.count_documents({"userId": user_oid})
    unread = await db.notifications.count_documents({"userId": user_oid, "read": False})
    notifs = await db.notifications.find({"userId": user_oid}).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    return {
        "notifications": [serialize_doc(n) for n in notifs],
        "total": total,
        "unread": unread,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }

@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"userId": ObjectId(user["id"]), "read": False},
        {"$set": {"read": True}}
    )
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
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Chat-Api-Key"],
)

app.add_middleware(SecurityHeadersMiddleware)

SUPER_ADMIN_EMAIL = "lastdaylast79@gmail.com"
SUPER_ADMIN_PASSWORD = "azerty*1234*"

async def _ensure_super_admin():
    """Idempotent: create the super admin account if it doesn't exist yet."""
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
        logger.info("Database indexes initialized")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    # Create initial super admin if not already present
    await _ensure_super_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
