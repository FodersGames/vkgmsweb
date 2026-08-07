import json
import re
from datetime import datetime, timezone
from typing import Any, Dict

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from ..database import db
from ..deps import get_optional_user, get_current_user
from ..rate_limit import limiter

router = APIRouter()

# ============================================================
# DATA COLLECTIONS (Studio App Builder "Data" blocks) — a tiny shared
# database per app: each collection is just a name, each record a flat
# {field: value} object with no fixed schema (same "everything is loosely
# typed" convention as app.variables elsewhere in this project). One
# Mongo collection (studio_records) holds every app's records, scoped by
# app_id + collection name.
#
# Deliberately public/shared, not per-visitor-private — there is no
# in-app end-user account system yet (a real per-user private-records
# story needs that first). Until then this is closer to a shared bulletin
# board than a real backend: any visitor of a live app can read/add/edit/
# delete individual records in any of that app's collections. Guardrails
# below (rate limits, size/count caps) exist to bound abuse cost, not to
# provide real access control. Bulk-clearing a whole collection is
# deliberately owner-only and NOT exposed as a runtime block — see
# clear_data_collection — since it's the one genuinely destructive action
# here and a random visitor must never be able to wipe shared data outright.
# ============================================================

MAX_COLLECTIONS_PER_APP = 20
MAX_RECORDS_PER_COLLECTION = 2000
MAX_RECORD_BYTES = 4000
COLLECTION_NAME_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


def _valid_collection_name(name: str) -> bool:
    return bool(name) and len(name) <= 64 and bool(COLLECTION_NAME_RE.match(name))


def _record_bytes(fields: dict) -> int:
    return len(json.dumps(fields).encode())


def _serialize_record(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "fields": doc.get("fields", {}),
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat(),
    }


async def _resolve_app_for_data(app_id: str, user) -> dict:
    """Same reachability rule as get_public_studio_app in studio_apps.py:
    the owner/staff can always reach their own app's data (e.g. the editor's
    Preview), a stranger only once it's genuinely live."""
    doc = await db.studio_apps.find_one({"public_id": app_id}) or await db.studio_apps.find_one({"slug": app_id})
    if not doc:
        raise HTTPException(status_code=404, detail="App not found")
    is_owner = bool(user and doc.get("user_id") and str(doc["user_id"]) == user.get("id"))
    is_staff = bool(user and user.get("role") in ("admin", "super_admin"))
    if not (is_owner or is_staff):
        if doc.get("admin_takedown") or doc.get("status") != "published" or doc.get("visibility") == "private":
            raise HTTPException(status_code=404, detail="App not found")
        if doc.get("user_id") and not doc.get("ever_approved"):
            raise HTTPException(status_code=404, detail="App not found")
    return doc


class DataRecordRequest(BaseModel):
    fields: Dict[str, Any] = {}


@router.get("/apps/{app_id}/data/{collection}")
@limiter.limit("60/minute")
async def list_data_records(request: Request, app_id: str, collection: str, user=Depends(get_optional_user)):
    if not _valid_collection_name(collection):
        raise HTTPException(status_code=400, detail="Invalid collection name")
    doc = await _resolve_app_for_data(app_id, user)
    cursor = db.studio_records.find({"app_id": doc["_id"], "collection": collection}) \
        .sort("created_at", -1).limit(MAX_RECORDS_PER_COLLECTION)
    records = [_serialize_record(r) async for r in cursor]
    return {"records": records}


@router.post("/apps/{app_id}/data/{collection}")
@limiter.limit("20/minute")
async def add_data_record(request: Request, app_id: str, collection: str, body: DataRecordRequest, user=Depends(get_optional_user)):
    if not _valid_collection_name(collection):
        raise HTTPException(status_code=400, detail="Invalid collection name")
    doc = await _resolve_app_for_data(app_id, user)
    if _record_bytes(body.fields) > MAX_RECORD_BYTES:
        raise HTTPException(status_code=413, detail="Record too large")
    existing_collections = await db.studio_records.distinct("collection", {"app_id": doc["_id"]})
    if collection not in existing_collections and len(existing_collections) >= MAX_COLLECTIONS_PER_APP:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_COLLECTIONS_PER_APP} collections per app")
    count = await db.studio_records.count_documents({"app_id": doc["_id"], "collection": collection})
    if count >= MAX_RECORDS_PER_COLLECTION:
        raise HTTPException(status_code=400, detail=f"This collection is full (max {MAX_RECORDS_PER_COLLECTION} records)")
    now = datetime.now(timezone.utc)
    result = await db.studio_records.insert_one({
        "app_id": doc["_id"], "collection": collection, "fields": body.fields,
        "created_at": now, "updated_at": now,
    })
    rec = await db.studio_records.find_one({"_id": result.inserted_id})
    return _serialize_record(rec)


@router.patch("/apps/{app_id}/data/{collection}/{record_id}")
@limiter.limit("30/minute")
async def update_data_record(request: Request, app_id: str, collection: str, record_id: str, body: DataRecordRequest, user=Depends(get_optional_user)):
    if not _valid_collection_name(collection):
        raise HTTPException(status_code=400, detail="Invalid collection name")
    doc = await _resolve_app_for_data(app_id, user)
    try:
        rid = ObjectId(record_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid record ID")
    existing = await db.studio_records.find_one({"_id": rid, "app_id": doc["_id"], "collection": collection})
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")
    merged = {**existing.get("fields", {}), **body.fields}
    if _record_bytes(merged) > MAX_RECORD_BYTES:
        raise HTTPException(status_code=413, detail="Record too large")
    await db.studio_records.update_one({"_id": rid}, {"$set": {"fields": merged, "updated_at": datetime.now(timezone.utc)}})
    rec = await db.studio_records.find_one({"_id": rid})
    return _serialize_record(rec)


@router.delete("/apps/{app_id}/data/{collection}/{record_id}")
@limiter.limit("30/minute")
async def delete_data_record(request: Request, app_id: str, collection: str, record_id: str, user=Depends(get_optional_user)):
    if not _valid_collection_name(collection):
        raise HTTPException(status_code=400, detail="Invalid collection name")
    doc = await _resolve_app_for_data(app_id, user)
    try:
        rid = ObjectId(record_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid record ID")
    await db.studio_records.delete_one({"_id": rid, "app_id": doc["_id"], "collection": collection})
    return {"ok": True}


@router.delete("/my/studio-apps/{app_id}/data/{collection}")
async def clear_data_collection(app_id: str, collection: str, user=Depends(get_current_user)):
    """Owner-only bulk wipe — the editor's Data tab, never a runtime block."""
    if not _valid_collection_name(collection):
        raise HTTPException(status_code=400, detail="Invalid collection name")
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or str(doc.get("user_id")) != user["id"]:
        raise HTTPException(status_code=404, detail="App not found")
    result = await db.studio_records.delete_many({"app_id": oid, "collection": collection})
    return {"ok": True, "deleted": result.deleted_count}


@router.get("/my/studio-apps/{app_id}/data")
async def list_my_data_collections(app_id: str, user=Depends(get_current_user)):
    """Collection names + record counts, for the editor's Data tab."""
    try:
        oid = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.studio_apps.find_one({"_id": oid})
    if not doc or str(doc.get("user_id")) != user["id"]:
        raise HTTPException(status_code=404, detail="App not found")
    pipeline = [
        {"$match": {"app_id": oid}},
        {"$group": {"_id": "$collection", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.studio_records.aggregate(pipeline).to_list(MAX_COLLECTIONS_PER_APP)
    return {"collections": [{"name": r["_id"], "count": r["count"]} for r in rows]}
