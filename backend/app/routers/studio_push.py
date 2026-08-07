import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from ..config import VAPID_PRIVATE_KEY_B64, VAPID_PUBLIC_KEY_B64, VAPID_CONTACT_EMAIL
from ..database import db
from ..rate_limit import limiter

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================
# PUSH NOTIFICATIONS (Studio App Builder) — standard Web Push (VAPID), not
# Firebase/APNs. Works in real browsers and the public app-play page; in an
# exported/APK app it depends on the device's WebView actually supporting
# the Push API, which isn't universal on Android and doesn't exist at all
# in an iOS WKWebView — this is a real platform limitation, not a bug here.
#
# One VAPID identity for the whole backend (config.VAPID_PRIVATE_KEY_B64),
# not per app — that's the correct scope for VAPID (it identifies the
# sending SERVER to the browser's push service, not any individual app).
#
# "Send" is targeted, not broadcast: a block can only notify one specific
# in-app account (studio_accounts.py) by username, never "everyone
# subscribed" — closes the obvious spam vector where any visitor's blocks
# could otherwise blast every subscriber of a popular app.
# ============================================================

MAX_TITLE_LEN = 100
MAX_BODY_LEN = 300


async def _resolve_reachable_app(app_id: str) -> dict:
    doc = await db.studio_apps.find_one({"public_id": app_id}) or await db.studio_apps.find_one({"slug": app_id})
    if not doc or doc.get("admin_takedown"):
        raise HTTPException(status_code=404, detail="App not found")
    return doc


def _bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    return parts[1].strip() if len(parts) == 2 and parts[0].lower() == "bearer" else ""


@router.get("/apps/{app_id}/push/vapid-public-key")
async def get_vapid_public_key(app_id: str):
    await _resolve_reachable_app(app_id)
    return {"key": VAPID_PUBLIC_KEY_B64}


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: dict


@router.post("/apps/{app_id}/push/subscribe")
@limiter.limit("30/minute")
async def subscribe_push(request: Request, app_id: str, body: SubscribeRequest, authorization: str = Header(None)):
    doc = await _resolve_reachable_app(app_id)
    if not body.endpoint or "p256dh" not in body.keys or "auth" not in body.keys:
        raise HTTPException(status_code=400, detail="Invalid subscription")
    app_user_id = None
    token = _bearer_token(authorization)
    if token:
        session = await db.studio_app_sessions.find_one({"token": token, "app_id": doc["_id"]})
        if session:
            app_user_id = session["app_user_id"]
    await db.studio_push_subscriptions.update_one(
        {"app_id": doc["_id"], "endpoint": body.endpoint},
        {"$set": {
            "app_id": doc["_id"], "endpoint": body.endpoint, "keys": body.keys,
            "app_user_id": app_user_id, "updated_at": datetime.now(timezone.utc),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/apps/{app_id}/push/unsubscribe")
async def unsubscribe_push(app_id: str, body: UnsubscribeRequest):
    doc = await _resolve_reachable_app(app_id)
    await db.studio_push_subscriptions.delete_one({"app_id": doc["_id"], "endpoint": body.endpoint})
    return {"ok": True}


class SendPushRequest(BaseModel):
    username: str
    title: str
    body: str


@router.post("/apps/{app_id}/push/send")
@limiter.limit("20/minute")
async def send_push(request: Request, app_id: str, body: SendPushRequest):
    doc = await _resolve_reachable_app(app_id)
    username = body.username.strip().lower()
    target_user = await db.studio_app_users.find_one({"app_id": doc["_id"], "username": username})
    if not target_user:
        return {"ok": True, "sent": 0}  # silently no-op, same fail-quiet convention as the blocks calling this

    title = (body.title or "").strip()[:MAX_TITLE_LEN] or (doc.get("app_display_name") or doc.get("name") or "Notification")
    message = (body.body or "").strip()[:MAX_BODY_LEN]

    subs = await db.studio_push_subscriptions.find({"app_id": doc["_id"], "app_user_id": target_user["_id"]}).to_list(50)
    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=json.dumps({"title": title, "body": message}),
                vapid_private_key=VAPID_PRIVATE_KEY_B64,
                vapid_claims={"sub": f"mailto:{VAPID_CONTACT_EMAIL}"},
            )
            sent += 1
        except WebPushException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):
                await db.studio_push_subscriptions.delete_one({"_id": sub["_id"]})
            else:
                logger.warning("Web push failed (app=%s user=%s): %s", app_id, username, e)
    return {"ok": True, "sent": sent}
