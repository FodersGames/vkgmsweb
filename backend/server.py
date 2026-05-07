from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
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

# Version
VERSION = "1.1.0"

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_urlsafe(64))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Master Key for Super Admin
MASTER_KEY = os.environ.get('MASTER_KEY', '#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd')

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Create the main app
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== ALL PERMISSIONS ==============

ALL_PERMISSIONS = [
    # Projects
    "view_projects",
    "create_projects",
    "delete_projects",
    # Items
    "send_items",
    "delete_items",
    # Server
    "change_status",
    # Variables
    "view_variables",
    "create_variables",
    "edit_variables",
    "delete_variables",
    # Logs & Docs
    "view_logs",
    "view_api_docs",
    # Users
    "manage_users",
]

PERMISSION_LITERAL = Literal[
    "view_projects", "create_projects", "delete_projects",
    "send_items", "delete_items",
    "change_status",
    "view_variables", "create_variables", "edit_variables", "delete_variables",
    "view_logs", "view_api_docs",
    "manage_users"
]

# ============== MODELS ==============

class LoginRequest(BaseModel):
    key: str

class LoginResponse(BaseModel):
    token: str
    user: dict

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

# ============== HELPER FUNCTIONS ==============

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

def create_access_token(user_id: str, username: str, is_super_admin: bool, permissions: List[str]) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "is_super_admin": is_super_admin,
        "permissions": permissions,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    payload = verify_token(token)
    return payload

def require_permission(permission: str):
    async def check_permission(user: dict = Depends(get_current_user)) -> dict:
        if user["is_super_admin"]:
            return user
        if permission not in user["permissions"]:
            raise HTTPException(status_code=403, detail=f"Missing required permission: {permission}")
        return user
    return check_permission

async def get_project_or_404(project_slug: str):
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

async def log_action(log_type: str, message: str, project_slug: str = None, user: str = None,
                     uid: str = None, variable: str = None, amount: str = None):
    log_entry = {
        "type": log_type,
        "project_slug": project_slug,
        "user": user,
        "uid": uid,
        "variable": variable,
        "amount": amount,
        "timestamp": datetime.now(timezone.utc),
        "message": message
    }
    await db.logs.insert_one(log_entry)
    logger.info(f"[{log_type}] {message}")

# ============== AUTH ENDPOINTS ==============

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

    if key == MASTER_KEY:
        token = create_access_token(
            user_id="super_admin",
            username="Super Admin",
            is_super_admin=True,
            permissions=[]
        )
        await log_action("auth", "Super Admin logged in", user="Super Admin")
        return LoginResponse(
            token=token,
            user={
                "id": "super_admin",
                "username": "Super Admin",
                "is_super_admin": True,
                "permissions": ALL_PERMISSIONS
            }
        )

    users = await db.users.find().to_list(1000)
    for user in users:
        if verify_key(key, user["access_key_hash"]):
            token = create_access_token(
                user_id=str(user["_id"]),
                username=user["username"],
                is_super_admin=False,
                permissions=user["permissions"]
            )
            await log_action("auth", f"User '{user['username']}' logged in", user=user["username"])
            return LoginResponse(
                token=token,
                user={
                    "id": str(user["_id"]),
                    "username": user["username"],
                    "is_super_admin": False,
                    "permissions": user["permissions"]
                }
            )

    raise HTTPException(status_code=401, detail="Invalid access key")

@api_router.get("/auth/verify")
async def verify(user: dict = Depends(get_current_user)):
    return {"valid": True, "user": user}

# ============== PROJECT ENDPOINTS ==============

@api_router.post("/projects")
async def create_project(req: CreateProjectRequest, current_user: dict = Depends(require_permission("create_projects"))):
    slug = slugify(req.name)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid project name")

    existing = await db.projects.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail="A project with this name already exists")

    project_doc = {
        "name": req.name,
        "slug": slug,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["username"]
    }
    await db.projects.insert_one(project_doc)

    await db.server_status.update_one(
        {"project_slug": slug},
        {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc), "updated_by": "system"}},
        upsert=True
    )

    await log_action("project", f"Project '{req.name}' created", project_slug=slug, user=current_user["username"])

    return {
        "success": True,
        "name": req.name,
        "slug": slug,
        "created_at": project_doc["created_at"].isoformat(),
        "created_by": current_user["username"]
    }

@api_router.get("/projects")
async def list_projects(current_user: dict = Depends(require_permission("view_projects"))):
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    for p in projects:
        if "created_at" in p and isinstance(p["created_at"], datetime):
            p["created_at"] = p["created_at"].isoformat()
    return {"projects": projects}

@api_router.delete("/projects/{project_slug}")
async def delete_project(project_slug: str, current_user: dict = Depends(require_permission("delete_projects"))):
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.projects.delete_one({"slug": project_slug})
    await db.items.delete_many({"project_slug": project_slug})
    await db.server_status.delete_many({"project_slug": project_slug})
    await db.variables.delete_many({"project_slug": project_slug})
    await db.logs.delete_many({"project_slug": project_slug})

    await log_action("project", f"Project '{project['name']}' deleted with all data", user=current_user["username"])

    return {"success": True, "message": f"Project '{project['name']}' and all its data deleted"}

# ============== USER MANAGEMENT ENDPOINTS ==============

@api_router.post("/users", response_model=CreateUserResponse)
async def create_user(user_req: CreateUserRequest, current_user: dict = Depends(require_permission("manage_users"))):
    existing = await db.users.find_one({"username": user_req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    access_key = secrets.token_urlsafe(32)
    access_key_hash = hash_key(access_key)

    user_doc = {
        "username": user_req.username,
        "access_key_hash": access_key_hash,
        "permissions": user_req.permissions,
        "is_super_admin": False,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["username"]
    }

    await db.users.insert_one(user_doc)
    await log_action("user_action", f"User '{user_req.username}' created with {len(user_req.permissions)} permission(s)",
                     user=current_user["username"])

    return CreateUserResponse(username=user_req.username, access_key=access_key, permissions=user_req.permissions)

@api_router.get("/users")
async def list_users(current_user: dict = Depends(require_permission("manage_users"))):
    users = await db.users.find({}, {"_id": 0, "access_key_hash": 0}).to_list(1000)
    for u in users:
        if "created_at" in u and isinstance(u["created_at"], datetime):
            u["created_at"] = u["created_at"].isoformat()
    return {"users": users}

@api_router.delete("/users/{username}")
async def delete_user(username: str, current_user: dict = Depends(require_permission("manage_users"))):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.delete_one({"username": username})
    await log_action("user_action", f"User '{username}' deleted", user=current_user["username"])
    return {"success": True, "message": f"User '{username}' deleted successfully"}

@api_router.put("/users/{username}/permissions")
async def update_user_permissions(username: str, update_req: UpdateUserPermissionsRequest,
                                  current_user: dict = Depends(require_permission("manage_users"))):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.users.update_one({"username": username}, {"$set": {"permissions": update_req.permissions}})
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="No changes made")
    await log_action("user_action", f"User '{username}' permissions updated",
                     user=current_user["username"])
    return {"success": True, "username": username, "permissions": update_req.permissions}

# ============== PROJECT-SCOPED ITEMS ==============

@api_router.post("/projects/{project_slug}/items/send")
async def send_items(project_slug: str, item_req: SendItemRequest,
                     current_user: dict = Depends(require_permission("send_items"))):
    await get_project_or_404(project_slug)
    item_doc = {
        "project_slug": project_slug,
        "uid": item_req.uid,
        "variable": item_req.variable,
        "amount": item_req.amount,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["username"]
    }
    await db.items.insert_one(item_doc)
    await log_action("send", f"Sent {item_req.amount}x {item_req.variable} to {item_req.uid}",
                     project_slug=project_slug, user=current_user["username"],
                     uid=item_req.uid, variable=item_req.variable, amount=item_req.amount)
    return {"success": True, "message": f"Sent {item_req.amount}x {item_req.variable} to {item_req.uid}"}

@api_router.delete("/projects/{project_slug}/items/{uid}")
async def delete_items_for_uid(project_slug: str, uid: str,
                               current_user: dict = Depends(require_permission("delete_items"))):
    await get_project_or_404(project_slug)
    result = await db.items.delete_many({"project_slug": project_slug, "uid": uid})
    await log_action("delete", f"Deleted {result.deleted_count} item(s) for {uid}",
                     project_slug=project_slug, user=current_user["username"], uid=uid)
    return {"success": True, "deleted_count": result.deleted_count}

@api_router.get("/projects/{project_slug}/claimgift/{uid}")
@limiter.limit("30/minute")
async def claim_gift(request: Request, project_slug: str, uid: str):
    await get_project_or_404(project_slug)
    items = await db.items.find({"project_slug": project_slug, "uid": uid}).sort("created_at", 1).to_list(1000)

    if not items:
        return {"length": 0}

    response_items = []
    for item in items:
        response_items.append({"variable": item["variable"], "amount": item["amount"]})

    oldest_item = items[0]
    await db.items.delete_one({"_id": oldest_item["_id"]})
    await log_action("claim", f"User {uid} claimed 1 item: {oldest_item['variable']} x{oldest_item['amount']}",
                     project_slug=project_slug, uid=uid)

    result = {"length": len(response_items)}
    if len(response_items) > 0:
        result["variable"] = response_items[0]["variable"]
        result["amount"] = response_items[0]["amount"]
    if len(response_items) > 1:
        result["items"] = response_items[1:]

    return result

# ============== PROJECT-SCOPED SERVER STATUS ==============

@api_router.post("/projects/{project_slug}/status")
async def change_status(project_slug: str, status_req: ServerStatusRequest,
                        current_user: dict = Depends(require_permission("change_status"))):
    await get_project_or_404(project_slug)
    await db.server_status.update_one(
        {"project_slug": project_slug},
        {"$set": {"status": status_req.status, "updated_at": datetime.now(timezone.utc), "updated_by": current_user["username"]}},
        upsert=True
    )
    await log_action("status", f"Server status changed to '{status_req.status}'",
                     project_slug=project_slug, user=current_user["username"])
    return {"success": True, "status": status_req.status}

@api_router.get("/projects/{project_slug}/status", response_model=ServerStatusResponse)
async def get_status(project_slug: str):
    await get_project_or_404(project_slug)
    status_doc = await db.server_status.find_one({"project_slug": project_slug})
    if not status_doc:
        await db.server_status.update_one(
            {"project_slug": project_slug},
            {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc), "updated_by": "system"}},
            upsert=True
        )
        return ServerStatusResponse(status="open")
    return ServerStatusResponse(status=status_doc["status"])

# ============== PROJECT-SCOPED LOGS ==============

@api_router.get("/projects/{project_slug}/logs")
async def get_logs(project_slug: str, log_type: Optional[str] = None, user: Optional[str] = None,
                   uid: Optional[str] = None, limit: int = 100,
                   current_user: dict = Depends(require_permission("view_logs"))):
    await get_project_or_404(project_slug)
    query = {"project_slug": project_slug}
    if log_type:
        query["type"] = log_type
    if user:
        query["user"] = user
    if uid:
        query["uid"] = uid

    logs = await db.logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    for log in logs:
        if "timestamp" in log and isinstance(log["timestamp"], datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    return {"logs": logs, "count": len(logs)}

# ============== PROJECT-SCOPED VARIABLES ==============

@api_router.post("/projects/{project_slug}/variables")
async def create_variable(project_slug: str, var_req: VariableCreateRequest,
                          current_user: dict = Depends(require_permission("create_variables"))):
    await get_project_or_404(project_slug)
    existing = await db.variables.find_one({"project_slug": project_slug, "variable_name": var_req.variable_name})
    if existing:
        raise HTTPException(status_code=400, detail="Variable already exists in this project")

    variable_doc = {
        "project_slug": project_slug,
        "variable_name": var_req.variable_name,
        "values": var_req.values,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["username"],
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user["username"]
    }
    await db.variables.insert_one(variable_doc)
    await log_action("variable_action", f"Variable '{var_req.variable_name}' created with {len(var_req.values)} value(s)",
                     project_slug=project_slug, user=current_user["username"])
    return {"success": True, "variable_name": var_req.variable_name, "values": var_req.values}

@api_router.get("/projects/{project_slug}/variables")
async def list_variables(project_slug: str, current_user: dict = Depends(require_permission("view_variables"))):
    await get_project_or_404(project_slug)
    variables = await db.variables.find({"project_slug": project_slug}, {"_id": 0, "project_slug": 0}).to_list(1000)
    for v in variables:
        if "created_at" in v and isinstance(v["created_at"], datetime):
            v["created_at"] = v["created_at"].isoformat()
        if "updated_at" in v and isinstance(v["updated_at"], datetime):
            v["updated_at"] = v["updated_at"].isoformat()
    return {"variables": variables}

@api_router.get("/projects/{project_slug}/variable/{variable_name}")
async def get_variable(project_slug: str, variable_name: str):
    await get_project_or_404(project_slug)
    variable = await db.variables.find_one({"project_slug": project_slug, "variable_name": variable_name}, {"_id": 0})
    if not variable:
        raise HTTPException(status_code=404, detail="Variable not found")

    await log_action("variable_access", f"Variable '{variable_name}' accessed",
                     project_slug=project_slug, variable=variable_name)

    result = {"variable_name": variable_name}
    values = variable.get("values", [])
    for index, value in enumerate(values):
        result[f"value_{index}"] = value
    result["count"] = len(values)
    return result

@api_router.put("/projects/{project_slug}/variables/{variable_name}")
async def update_variable(project_slug: str, variable_name: str, update_req: VariableUpdateRequest,
                          current_user: dict = Depends(require_permission("edit_variables"))):
    await get_project_or_404(project_slug)
    variable = await db.variables.find_one({"project_slug": project_slug, "variable_name": variable_name})
    if not variable:
        raise HTTPException(status_code=404, detail="Variable not found")

    result = await db.variables.update_one(
        {"project_slug": project_slug, "variable_name": variable_name},
        {"$set": {"values": update_req.values, "updated_at": datetime.now(timezone.utc), "updated_by": current_user["username"]}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="No changes made")

    await log_action("variable_action", f"Variable '{variable_name}' updated to {len(update_req.values)} value(s)",
                     project_slug=project_slug, user=current_user["username"], variable=variable_name)
    return {"success": True, "variable_name": variable_name, "values": update_req.values}

@api_router.delete("/projects/{project_slug}/variables/{variable_name}")
async def delete_variable(project_slug: str, variable_name: str,
                          current_user: dict = Depends(require_permission("delete_variables"))):
    await get_project_or_404(project_slug)
    result = await db.variables.delete_one({"project_slug": project_slug, "variable_name": variable_name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Variable not found")

    await log_action("variable_action", f"Variable '{variable_name}' deleted",
                     project_slug=project_slug, user=current_user["username"], variable=variable_name)
    return {"success": True, "message": f"Variable '{variable_name}' deleted successfully"}

# ============== INCLUDE ROUTER ==============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    try:
        await db.users.create_index("username", unique=True)
        await db.projects.create_index("slug", unique=True)
        await db.items.create_index([("project_slug", 1), ("uid", 1)])
        await db.logs.create_index([("project_slug", 1), ("type", 1)])
        await db.logs.create_index("timestamp")
        await db.variables.create_index([("project_slug", 1), ("variable_name", 1)], unique=True)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
