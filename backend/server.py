from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
import shutil
from pathlib import Path
from pydantic import BaseModel, Field
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

# Serve uploaded files
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== PERMISSIONS ==============
ALL_PERMISSIONS = [
    "view_projects", "create_projects", "delete_projects",
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
]

PERMISSION_LITERAL = Literal[
    "view_projects", "create_projects", "delete_projects",
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
]

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
    permissions: List[PERMISSION_LITERAL]

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
    permissions: List[PERMISSION_LITERAL]

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

def create_access_token(user_id, username, is_super_admin, permissions):
    payload = {"sub": user_id, "username": username, "is_super_admin": is_super_admin, "permissions": permissions,
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
    return verify_token(auth_header[7:])

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

@api_router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, login_req: LoginRequest):
    key = login_req.key

    # Check if Super Admin has been set up in DB
    super_admin_doc = await db.super_admin.find_one({"role": "super_admin"})

    if super_admin_doc:
        # Super Admin exists in DB — check against stored hash
        if verify_key(key, super_admin_doc["key_hash"]):
            token = create_access_token("super_admin", "Super Admin", True, [])
            await log_action("auth", "Super Admin logged in", user="Super Admin")
            return LoginResponse(token=token, user={"id": "super_admin", "username": "Super Admin", "is_super_admin": True, "permissions": ALL_PERMISSIONS})
    else:
        # No Super Admin yet — check if the key matches the initial setup key
        if key == SETUP_KEY:
            # First login! Generate a new secure key
            new_key = secrets.token_urlsafe(48)
            new_key_hash = hash_key(new_key)

            # Store the hashed key in DB
            await db.super_admin.insert_one({
                "role": "super_admin",
                "key_hash": new_key_hash,
                "created_at": datetime.now(timezone.utc)
            })

            token = create_access_token("super_admin", "Super Admin", True, [])
            await log_action("auth", "Super Admin first login — new secure key generated", user="Super Admin")
            logger.info("=== SUPER ADMIN SETUP COMPLETE — Initial key is now invalidated ===")

            return LoginResponse(
                token=token,
                user={"id": "super_admin", "username": "Super Admin", "is_super_admin": True, "permissions": ALL_PERMISSIONS},
                first_login=True,
                new_key=new_key
            )

    # Check user keys
    users = await db.users.find().to_list(1000)
    for u in users:
        if verify_key(key, u["access_key_hash"]):
            token = create_access_token(str(u["_id"]), u["username"], False, u["permissions"])
            await log_action("auth", f"User '{u['username']}' logged in", user=u["username"])
            return LoginResponse(token=token, user={"id": str(u["_id"]), "username": u["username"], "is_super_admin": False, "permissions": u["permissions"]})

    raise HTTPException(status_code=401, detail="Invalid access key")

@api_router.get("/auth/verify")
async def verify(user=Depends(get_current_user)):
    return {"valid": True, "user": user}

# ============== FILE UPLOAD ==============
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
        raise HTTPException(status_code=400, detail="Only image files allowed")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 5 MB.")
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)
    return {"url": f"/api/uploads/{filename}", "filename": filename}

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
async def list_projects(user=Depends(require_permission("view_projects"))):
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
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
@api_router.post("/users", response_model=CreateUserResponse)
async def create_user(req: CreateUserRequest, user=Depends(require_permission("manage_users"))):
    if await db.users.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="Username exists")
    key = secrets.token_urlsafe(32)
    doc = {"username": req.username, "access_key_hash": hash_key(key), "permissions": req.permissions, "is_super_admin": False,
           "created_at": datetime.now(timezone.utc), "created_by": user["username"]}
    await db.users.insert_one(doc)
    await log_action("user_action", f"User '{req.username}' created", user=user["username"])
    return CreateUserResponse(username=req.username, access_key=key, permissions=req.permissions)

@api_router.get("/users")
async def list_users(user=Depends(require_permission("manage_users"))):
    users = await db.users.find({}, {"_id": 0, "access_key_hash": 0}).to_list(1000)
    for u in users:
        if isinstance(u.get("created_at"), datetime):
            u["created_at"] = u["created_at"].isoformat()
    return {"users": users}

@api_router.delete("/users/{username}")
async def delete_user(username: str, user=Depends(require_permission("manage_users"))):
    if not await db.users.find_one({"username": username}):
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.delete_one({"username": username})
    await log_action("user_action", f"User '{username}' deleted", user=user["username"])
    return {"success": True, "message": f"User '{username}' deleted"}

@api_router.put("/users/{username}/permissions")
async def update_perms(username: str, req: UpdateUserPermissionsRequest, user=Depends(require_permission("manage_users"))):
    if not await db.users.find_one({"username": username}):
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"username": username}, {"$set": {"permissions": req.permissions}})
    await log_action("user_action", f"User '{username}' permissions updated", user=user["username"])
    return {"success": True, "username": username, "permissions": req.permissions}

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
                   uid: Optional[str] = None, limit: int = 100, user=Depends(require_permission("view_logs"))):
    await get_project_or_404(slug)
    q = {"project_slug": slug}
    if log_type: q["type"] = log_type
    if user_filter: q["user"] = user_filter
    if uid: q["uid"] = uid
    logs = await db.logs.find(q, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    for l in logs:
        if isinstance(l.get("timestamp"), datetime):
            l["timestamp"] = l["timestamp"].isoformat()
    return {"logs": logs, "count": len(logs)}

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
async def list_variables(slug: str, user=Depends(require_permission("view_variables"))):
    await get_project_or_404(slug)
    vs = await db.variables.find({"project_slug": slug}, {"_id": 0, "project_slug": 0}).to_list(1000)
    for v in vs:
        for k in ["created_at", "updated_at"]:
            if isinstance(v.get(k), datetime):
                v[k] = v[k].isoformat()
    return {"variables": vs}

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
    date_key = today_start.date().isoformat()  # e.g. "2025-06-21"

    seconds_left = int((tomorrow - now).total_seconds())

    # Pre-check: covers both old records (no date_key) and new ones
    if await db.website_shop_daily_claims.find_one({
        "game_slug": game_slug, "player_uid": player_uid,
        "claimed_at": {"$gte": today_start}
    }):
        raise HTTPException(status_code=409, detail=f"Already claimed today. Resets in {seconds_left} seconds.")

    # Atomic insert with unique index as race-condition guard
    try:
        await db.website_shop_daily_claims.insert_one({
            "game_slug": game_slug,
            "player_uid": player_uid,
            "date_key": date_key,
            "claimed_at": now,
        })
    except DuplicateKeyError:
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

# ============== SETUP ==============
app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("username", unique=True)
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
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
