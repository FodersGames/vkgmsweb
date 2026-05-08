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
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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
SETUP_KEY = os.environ.get('MASTER_KEY', '#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd')

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

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
    status: Literal["published", "draft"] = "draft"
    featured: bool = False

class GameUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    screenshots: Optional[List[str]] = None
    platforms: Optional[List[dict]] = None
    status: Optional[Literal["published", "draft"]] = None
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
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/api/uploads/{filename}", "filename": filename}

# ============== PROJECTS ==============
@api_router.post("/projects")
async def create_project(req: CreateProjectRequest, user=Depends(require_permission("create_projects"))):
    slug = slugify(req.name)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid project name")
    if await db.projects.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Project already exists")
    doc = {"name": req.name, "slug": slug, "created_at": datetime.now(timezone.utc), "created_by": user["username"]}
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
    games = await db.website_games.find({"status": "published"}).sort("created_at", -1).to_list(1000)
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
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
