from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
MASTER_KEY = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

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

# ============== MODELS ==============

class LoginRequest(BaseModel):
    key: str

class LoginResponse(BaseModel):
    token: str
    user: dict

class CreateUserRequest(BaseModel):
    username: str
    permissions: List[Literal["send_items", "change_status", "view_logs", "manage_users"]]

class CreateUserResponse(BaseModel):
    username: str
    access_key: str
    permissions: List[str]

class SendItemRequest(BaseModel):
    uid: str
    variable: str
    amount: int

class ClaimItemsResponse(BaseModel):
    items: List[dict]

class ServerStatusRequest(BaseModel):
    status: Literal["open", "maintenance", "closed"]

class ServerStatusResponse(BaseModel):
    status: str

class LogEntry(BaseModel):
    type: str
    user: Optional[str] = None
    uid: Optional[str] = None
    variable: Optional[str] = None
    amount: Optional[int] = None
    timestamp: datetime
    message: str

# ============== HELPER FUNCTIONS ==============

def hash_key(key: str) -> str:
    """Hash an access key using bcrypt"""
    return bcrypt.hashpw(key.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_key(key: str, hashed: str) -> bool:
    """Verify an access key against its hash"""
    return bcrypt.checkpw(key.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, username: str, is_super_admin: bool, permissions: List[str]) -> str:
    """Create JWT access token"""
    payload = {
        "sub": user_id,
        "username": username,
        "is_super_admin": is_super_admin,
        "permissions": permissions,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    """Get current authenticated user from token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    payload = verify_token(token)
    return payload

def require_permission(permission: str):
    """Dependency to check if user has specific permission"""
    async def check_permission(user: dict = Depends(get_current_user)) -> dict:
        if user["is_super_admin"]:
            return user
        if permission not in user["permissions"]:
            raise HTTPException(status_code=403, detail=f"Missing required permission: {permission}")
        return user
    return check_permission

async def log_action(log_type: str, message: str, user: Optional[str] = None, uid: Optional[str] = None, 
                    variable: Optional[str] = None, amount: Optional[int] = None):
    """Log an action to the database"""
    log_entry = {
        "type": log_type,
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

@api_router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, login_req: LoginRequest):
    """Login with master key or access key"""
    key = login_req.key
    
    # Check if it's the master key
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
                "permissions": ["send_items", "change_status", "view_logs", "manage_users"]
            }
        )
    
    # Check against user access keys
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
    """Verify current token and return user info"""
    return {"valid": True, "user": user}

# ============== USER MANAGEMENT ENDPOINTS ==============

@api_router.post("/users", response_model=CreateUserResponse)
async def create_user(user_req: CreateUserRequest, current_user: dict = Depends(get_current_user)):
    """Create a new user (Super Admin only)"""
    if not current_user["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Only Super Admin can create users")
    
    # Check if username already exists
    existing = await db.users.find_one({"username": user_req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Generate access key
    access_key = secrets.token_urlsafe(32)
    access_key_hash = hash_key(access_key)
    
    # Create user
    user_doc = {
        "username": user_req.username,
        "access_key_hash": access_key_hash,
        "permissions": user_req.permissions,
        "is_super_admin": False,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["username"]
    }
    
    result = await db.users.insert_one(user_doc)
    await log_action("user_action", f"User '{user_req.username}' created with permissions: {', '.join(user_req.permissions)}", 
                    user=current_user["username"])
    
    return CreateUserResponse(
        username=user_req.username,
        access_key=access_key,
        permissions=user_req.permissions
    )

@api_router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """List all users (Super Admin only)"""
    if not current_user["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Only Super Admin can list users")
    
    users = await db.users.find({}, {"_id": 0, "access_key_hash": 0}).to_list(1000)
    return {"users": users}

# ============== ITEMS ENDPOINTS ==============

@api_router.post("/items/send")
async def send_items(item_req: SendItemRequest, current_user: dict = Depends(require_permission("send_items"))):
    """Send items to a player (dashboard only, requires send_items permission)"""
    item_doc = {
        "uid": item_req.uid,
        "variable": item_req.variable,
        "amount": item_req.amount,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["username"]
    }
    
    await db.items.insert_one(item_doc)
    await log_action("send", f"Sent {item_req.amount}x {item_req.variable} to {item_req.uid}",
                    user=current_user["username"], uid=item_req.uid, 
                    variable=item_req.variable, amount=item_req.amount)
    
    return {"success": True, "message": f"Sent {item_req.amount}x {item_req.variable} to {item_req.uid}"}

@api_router.get("/claimgift/{uid}", response_model=ClaimItemsResponse)
@limiter.limit("30/minute")
async def claim_gift(request: Request, uid: str):
    """PUBLIC endpoint - Claim all pending items for a UID"""
    items = await db.items.find({"uid": uid}, {"_id": 0, "uid": 0, "created_at": 0, "created_by": 0}).to_list(1000)
    
    if items:
        # Delete claimed items
        await db.items.delete_many({"uid": uid})
        await log_action("claim", f"User {uid} claimed {len(items)} item(s)", uid=uid)
    
    return ClaimItemsResponse(items=items)

# ============== SERVER STATUS ENDPOINTS ==============

@api_router.post("/status")
async def change_status(status_req: ServerStatusRequest, current_user: dict = Depends(require_permission("change_status"))):
    """Change server status (dashboard only, requires change_status permission)"""
    await db.server_status.update_one(
        {},
        {"$set": {
            "status": status_req.status,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["username"]
        }},
        upsert=True
    )
    
    await log_action("status", f"Server status changed to '{status_req.status}'", user=current_user["username"])
    
    return {"success": True, "status": status_req.status}

@api_router.get("/status", response_model=ServerStatusResponse)
async def get_status():
    """PUBLIC endpoint - Get current server status"""
    status_doc = await db.server_status.find_one({})
    if not status_doc:
        # Initialize with default status
        await db.server_status.insert_one({
            "status": "open",
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        })
        return ServerStatusResponse(status="open")
    
    return ServerStatusResponse(status=status_doc["status"])

# ============== LOGS ENDPOINTS ==============

@api_router.get("/logs")
async def get_logs(
    log_type: Optional[str] = None,
    user: Optional[str] = None,
    uid: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_permission("view_logs"))
):
    """Get logs with optional filters (requires view_logs permission)"""
    query = {}
    if log_type:
        query["type"] = log_type
    if user:
        query["user"] = user
    if uid:
        query["uid"] = uid
    
    logs = await db.logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Convert datetime to ISO string
    for log in logs:
        if "timestamp" in log and isinstance(log["timestamp"], datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {"logs": logs, "count": len(logs)}

# Include the router in the main app
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
    """Initialize database and create indexes"""
    try:
        # Create indexes
        await db.users.create_index("username", unique=True)
        await db.items.create_index("uid")
        await db.logs.create_index("type")
        await db.logs.create_index("timestamp")
        
        # Initialize server status if not exists
        status_doc = await db.server_status.find_one({})
        if not status_doc:
            await db.server_status.insert_one({
                "status": "open",
                "updated_at": datetime.now(timezone.utc),
                "updated_by": "system"
            })
        
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()