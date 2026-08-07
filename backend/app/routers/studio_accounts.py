import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel

from ..database import db
from ..deps import hash_key, verify_key, validate_password_strength
from ..rate_limit import limiter

router = APIRouter()

# ============================================================
# IN-APP ACCOUNTS — a Studio App's own end-user login/signup, completely
# separate from Vakar Games accounts (a visitor playing someone's app has
# no reason to have — or want — a Vakar Games account at all). Scoped per
# app (studio_app_users/studio_app_sessions): usernames only need to be
# unique WITHIN one app, not globally, so "alice" can sign up on two
# different apps independently.
#
# Session tokens are opaque random strings looked up directly in Mongo
# (same pattern as apk_builds.py's callback_token) rather than JWTs — no
# signing-key/expiry machinery needed for what's meant to be a lightweight
# per-app account system, not a full identity provider. Sessions expire via
# a Mongo TTL index (see main.py) rather than manual checks here.
# ============================================================

USERNAME_RE = re.compile(r'^[A-Za-z0-9_]{3,32}$')


def _bearer_token(authorization: str) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    return parts[1].strip() if len(parts) == 2 and parts[0].lower() == "bearer" else ""


async def _resolve_reachable_app(app_id: str) -> dict:
    doc = await db.studio_apps.find_one({"public_id": app_id}) or await db.studio_apps.find_one({"slug": app_id})
    if not doc or doc.get("admin_takedown"):
        raise HTTPException(status_code=404, detail="App not found")
    return doc


class SignupRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


async def _create_session(app_doc, app_user_id) -> str:
    token = secrets.token_urlsafe(32)
    await db.studio_app_sessions.insert_one({
        "token": token, "app_id": app_doc["_id"], "app_user_id": app_user_id,
        "created_at": datetime.now(timezone.utc),
    })
    return token


@router.post("/apps/{app_id}/accounts/signup")
@limiter.limit("10/hour")
async def signup_app_account(request: Request, app_id: str, body: SignupRequest):
    doc = await _resolve_reachable_app(app_id)
    username = body.username.strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 letters, numbers or underscores.")
    validate_password_strength(body.password)
    if await db.studio_app_users.find_one({"app_id": doc["_id"], "username": username}):
        raise HTTPException(status_code=409, detail="That username is already taken.")
    result = await db.studio_app_users.insert_one({
        "app_id": doc["_id"], "username": username, "password_hash": hash_key(body.password),
        "created_at": datetime.now(timezone.utc),
    })
    token = await _create_session(doc, result.inserted_id)
    return {"token": token, "username": username}


@router.post("/apps/{app_id}/accounts/login")
@limiter.limit("20/hour")
async def login_app_account(request: Request, app_id: str, body: LoginRequest):
    doc = await _resolve_reachable_app(app_id)
    username = body.username.strip().lower()
    user = await db.studio_app_users.find_one({"app_id": doc["_id"], "username": username})
    if not user or not verify_key(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    token = await _create_session(doc, user["_id"])
    return {"token": token, "username": username}


@router.post("/apps/{app_id}/accounts/logout")
async def logout_app_account(app_id: str, authorization: str = Header(None)):
    doc = await _resolve_reachable_app(app_id)
    token = _bearer_token(authorization)
    if token:
        await db.studio_app_sessions.delete_one({"token": token, "app_id": doc["_id"]})
    return {"ok": True}
