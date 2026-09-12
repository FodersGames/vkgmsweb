import os
import json
import asyncio
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..database import db
from ..deps import get_current_user, require_super_admin
from ..utils import log_action, serialize_doc

router = APIRouter()

DEFAULT_TITLE_ID = "1C8E49"

CATALOG_DINOS = [
    {"id": "Allosaurus", "name": "Allosaurus", "tier": "Carnivore", "icon": "/dino-assets/dinos/Allosaurus.png"},
    {"id": "Ankylosaurus", "name": "Ankylosaurus", "tier": "Herbivore", "icon": "/dino-assets/dinos/Ankylosaurus.png"},
    {"id": "Brachiosaurus", "name": "Brachiosaurus", "tier": "Giant", "icon": "/dino-assets/dinos/Brachiosaurus.png"},
    {"id": "Carnotaurus", "name": "Carnotaurus", "tier": "Carnivore", "icon": "/dino-assets/dinos/Carnotaurus.png"},
    {"id": "Ceratosaurus", "name": "Ceratosaurus", "tier": "Carnivore", "icon": "/dino-assets/dinos/Ceratosaurus.png"},
    {"id": "Compsognathus", "name": "Compsognathus", "tier": "Small", "icon": "/dino-assets/dinos/Compsognathus.png"},
    {"id": "Corythosaurus", "name": "Corythosaurus", "tier": "Herbivore", "icon": "/dino-assets/dinos/Corythosaurus.png"},
    {"id": "Dilophosaurus", "name": "Dilophosaurus", "tier": "Carnivore", "icon": "/dino-assets/dinos/Dilophosaurus.png"},
    {"id": "Diplodocus", "name": "Diplodocus", "tier": "Giant", "icon": "/dino-assets/dinos/Diplodocus.png"},
    {"id": "Gallimimus", "name": "Gallimimus", "tier": "Speed", "icon": "/dino-assets/dinos/Gallimimus.png"},
    {"id": "Iguallosaurus", "name": "Iguallosaurus", "tier": "Hybrid", "icon": "/dino-assets/dinos/Iguallosaurus.png"},
    {"id": "Iguanodon", "name": "Iguanodon", "tier": "Herbivore", "icon": "/dino-assets/dinos/Iguanodon.png"},
    {"id": "Megalodon", "name": "Megalodon", "tier": "Aquatic Predator", "icon": "/dino-assets/dinos/Megalodon.png"},
    {"id": "Oviraptor", "name": "Oviraptor", "tier": "Small", "icon": "/dino-assets/dinos/Oviraptor.png"},
    {"id": "Pachycephalosaurus", "name": "Pachycephalosaurus", "tier": "Herbivore", "icon": "/dino-assets/dinos/Pachycephalosaurus.png"},
    {"id": "Parasaurolophus", "name": "Parasaurolophus", "tier": "Herbivore", "icon": "/dino-assets/dinos/Parasaurolophus.png"},
    {"id": "Pteranodon", "name": "Pteranodon", "tier": "Flying", "icon": "/dino-assets/dinos/Pteranodon.png"},
    {"id": "Spinosaurus", "name": "Spinosaurus", "tier": "Apex Predator", "icon": "/dino-assets/dinos/Spinosaurus.png"},
    {"id": "Stegosaurus", "name": "Stegosaurus", "tier": "Herbivore", "icon": "/dino-assets/dinos/Stegosaurus.png"},
    {"id": "T-Rex", "name": "T-Rex", "tier": "Apex Predator", "icon": "/dino-assets/dinos/T-Rex.png"},
    {"id": "Tarascosaurus", "name": "Tarascosaurus", "tier": "Carnivore", "icon": "/dino-assets/dinos/Tarascosaurus.png"},
    {"id": "Telmatosaurus", "name": "Telmatosaurus", "tier": "Herbivore", "icon": "/dino-assets/dinos/Telmatosaurus.png"},
    {"id": "Triceratops", "name": "Triceratops", "tier": "Herbivore", "icon": "/dino-assets/dinos/Triceratops.png"},
    {"id": "Velociraptor", "name": "Velociraptor", "tier": "Pack Hunter", "icon": "/dino-assets/dinos/Velociraptor.png"},
]

CATALOG_EGGS = [
    {"id": "T1-EGG", "name": "Egg Tier 1 (Common)", "tier": 1, "icon": "/dino-assets/eggs/T1-EGG.png"},
    {"id": "T2-EGG", "name": "Egg Tier 2 (Uncommon)", "tier": 2, "icon": "/dino-assets/eggs/T2-EGG.png"},
    {"id": "T3-EGG", "name": "Egg Tier 3 (Rare)", "tier": 3, "icon": "/dino-assets/eggs/T3-EGG.png"},
    {"id": "T4-EGG", "name": "Egg Tier 4 (Epic)", "tier": 4, "icon": "/dino-assets/eggs/T4-EGG.png"},
    {"id": "T5-EGG", "name": "Egg Tier 5 (Legendary)", "tier": 5, "icon": "/dino-assets/eggs/T5-EGG.png"},
    {"id": "T6-EGG", "name": "Egg Tier 6 (Mythic)", "tier": 6, "icon": "/dino-assets/eggs/T6-EGG.png"},
    {"id": "T7-EGG", "name": "Egg Tier 7 (Primordial)", "tier": 7, "icon": "/dino-assets/eggs/T7-EGG.png"},
]

CATALOG_CHESTS = [
    {"id": "ChestT1", "name": "Wooden Supply Chest (T1)", "icon": "/dino-assets/chests/ChestT1.png"},
    {"id": "ChestT2", "name": "Reinforced Dino Chest (T2)", "icon": "/dino-assets/chests/ChestT2.png"},
    {"id": "ChestT3", "name": "Mythic Dino Chest (T3)", "icon": "/dino-assets/chests/ChestT3.png"},
]

CATALOG_ITEMS = [
    {"id": "Item_AmberStone", "name": "Raw Amber Stone", "desc": "Prehistoric fossilized amber", "icon": "/dino-assets/items/Amber.png"},
    {"id": "Item_AmberVial", "name": "Purified Amber Vial", "desc": "Refined genetic catalyst", "icon": "/dino-assets/items/AmberVial.png"},
    {"id": "Item_BlueprintT1", "name": "Habitat Blueprint T1", "desc": "Enclosure upgrade schematic", "icon": "/dino-assets/items/PlanT1.png"},
    {"id": "Item_BlueprintT2", "name": "Habitat Blueprint T2", "desc": "Reinforced fencing blueprint", "icon": "/dino-assets/items/PlanT2.png"},
    {"id": "Item_BlueprintT3", "name": "Habitat Blueprint T3", "desc": "High-tech biome containment", "icon": "/dino-assets/items/PlanT3.png"},
    {"id": "Item_BlueprintLab", "name": "Genetic Lab Blueprint", "desc": "Facility expansion blueprint", "icon": "/dino-assets/items/Item_LabMicroscope.png"},
    {"id": "Item_SandCementBag", "name": "Reinforced Cement Bag", "desc": "Industrial building supply", "icon": "/dino-assets/items/Item_SandCementBag.png"},
    {"id": "Item_TitaniumIngot", "name": "Titanium Ingot", "desc": "Refined structural metal", "icon": "/dino-assets/items/Item_TitaniumIngot.png"},
    {"id": "Item_ReinforcedBone", "name": "Reinforced Bone", "desc": "Prehistoric bone frame", "icon": "/dino-assets/items/Item_ReinforcedBone.png"},
    {"id": "Item_MeteoriteShard", "name": "Meteorite Shard", "desc": "Cosmic mineral fragment", "icon": "/dino-assets/items/Item_MeteoriteShard.png"},
    {"id": "Item_VolcanicBasalt", "name": "Volcanic Basalt", "desc": "Hardened magma block", "icon": "/dino-assets/items/Item_VolcanicBasalt.png"},
]


DEFAULT_TITLE_ID = "1C8E49"
DEFAULT_SECRET_KEY = "SZKQXSKYW1H9Y3TQKT6DWJY5TRFF3NFAUXD1OX8SJYIF9XGFMA"

async def get_playfab_credentials():
    title_id = os.environ.get("PLAYFAB_TITLE_ID") or DEFAULT_TITLE_ID
    secret_key = os.environ.get("PLAYFAB_SECRET_KEY")

    if not secret_key:
        doc = await db.settings.find_one({"key": "playfab_secret_key"})
        if doc and doc.get("value"):
            secret_key = doc["value"]
        else:
            secret_key = DEFAULT_SECRET_KEY

    doc_tid = await db.settings.find_one({"key": "playfab_title_id"})
    if doc_tid and doc_tid.get("value"):
        title_id = doc_tid["value"]

    return title_id.strip(), (secret_key or "").strip()


def _sync_http_post(url: str, payload: dict, secret_key: str):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if secret_key:
        req.add_header("X-SecretKey", secret_key)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {"code": e.code, "status": "Error", "errorMessage": raw}
    except Exception as e:
        return {"code": 500, "status": "Error", "errorMessage": str(e)}


async def call_playfab(endpoint_path: str, payload: dict, secret_key: str, title_id: str):
    if not secret_key:
        raise HTTPException(
            status_code=400,
            detail="PlayFab Developer Secret Key is not configured. Please enter your secret key in Settings."
        )
    url = f"https://{title_id.lower()}.playfabapi.com/{endpoint_path}"
    res = await asyncio.to_thread(_sync_http_post, url, payload, secret_key)
    
    if res.get("code") and res.get("code") >= 400:
        err_msg = res.get("errorMessage") or res.get("status") or "PlayFab API Error"
        raise HTTPException(status_code=res.get("code"), detail=f"PlayFab: {err_msg}")
    return res


# ====================================================================
# SCHEMAS
# ====================================================================

class DinoConfigUpdateRequest(BaseModel):
    title_id: Optional[str] = None
    secret_key: Optional[str] = None

class DinoGiftRequest(BaseModel):
    playfab_id: str
    dino_name: Optional[str] = None
    dinos: Optional[List[Dict[str, Any]]] = None
    gems: Optional[int] = 0
    dna: Optional[float] = 0.0
    message: Optional[str] = ""
    items: Optional[List[Dict[str, Any]]] = None
    eggs: Optional[List[Dict[str, Any]]] = None
    chests: Optional[List[Dict[str, Any]]] = None

class DinoBanRequest(BaseModel):
    reason: str

class DinoMaintenanceRequest(BaseModel):
    action: Optional[str] = None  # "cancel", "immediate", "schedule"
    is_maintenance: Optional[bool] = None
    maintenance_message: Optional[str] = "Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée."
    scheduled_maintenance_utc: Optional[str] = "none"
    delay_minutes: Optional[float] = None


# ====================================================================
# ENDPOINTS (Super Admin only)
# ====================================================================

@router.get("/admin/dino/catalog")
async def get_dino_catalog(user=Depends(require_super_admin)):
    return {
        "title_id": DEFAULT_TITLE_ID,
        "dinos": CATALOG_DINOS,
        "eggs": CATALOG_EGGS,
        "chests": CATALOG_CHESTS,
        "items": CATALOG_ITEMS,
    }


@router.get("/admin/dino/config")
async def get_dino_config(user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    has_key = bool(secret_key)
    return {
        "title_id": title_id,
        "has_secret_key": has_key,
        "masked_key": (secret_key[:4] + "••••••••" + secret_key[-4:]) if len(secret_key) > 8 else ("••••" if has_key else ""),
        "status": "ready" if has_key else "key_required",
    }


@router.post("/admin/dino/config")
async def save_dino_config(req: DinoConfigUpdateRequest, user=Depends(require_super_admin)):
    if req.title_id:
        await db.settings.update_one(
            {"key": "playfab_title_id"},
            {"$set": {"key": "playfab_title_id", "value": req.title_id.strip()}},
            upsert=True
        )
    if req.secret_key is not None:
        await db.settings.update_one(
            {"key": "playfab_secret_key"},
            {"$set": {"key": "playfab_secret_key", "value": req.secret_key.strip()}},
            upsert=True
        )
        await log_action("dino_dev", "PlayFab Secret Key updated", user=user["username"])

    return {"success": True, "message": "PlayFab credentials updated successfully"}


@router.get("/admin/dino/player/{playfab_id}")
async def get_player_profile(playfab_id: str, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="PlayFab ID is required")

    # Fetch UserData from Server API
    res = await call_playfab(
        "Server/GetUserData",
        {"PlayFabId": clean_id},
        secret_key,
        title_id
    )

    data_block = res.get("data", {}).get("Data", {})
    parsed_data = {}
    for k, v in data_block.items():
        parsed_data[k] = v.get("Value", "")

    # Parse player state
    is_banned = parsed_data.get("is_banned", "").lower() in ("true", "1")
    ban_reason = parsed_data.get("ban_reason", "")

    # Pending gift flags
    has_pending_gift = any([
        parsed_data.get("gift_dino"),
        parsed_data.get("gift_dinos"),
        parsed_data.get("gift_gems"),
        parsed_data.get("gift_dna"),
        parsed_data.get("gift_items"),
        parsed_data.get("gift_eggs"),
        parsed_data.get("gift_chests"),
    ])

    return {
        "playfab_id": clean_id,
        "is_banned": is_banned,
        "ban_reason": ban_reason,
        "player_dna": parsed_data.get("player_dna", "0"),
        "player_gems": parsed_data.get("player_gems", "0"),
        "rebirth_level": parsed_data.get("rebirth_level", "1"),
        "total_dinos": parsed_data.get("total_dinos", "0"),
        "equipped_dinos": parsed_data.get("equipped_dinos", "None"),
        "owned_dinos": parsed_data.get("owned_dinos", ""),
        "inventory_items": parsed_data.get("inventory_items", ""),
        "last_sync": parsed_data.get("last_sync", "Never"),
        "has_pending_gift": has_pending_gift,
        "raw_data": parsed_data,
    }


@router.post("/admin/dino/gift")
async def grant_gift_to_player(req: DinoGiftRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = req.playfab_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="PlayFab ID is required")

    data_payload: Dict[str, str] = {}
    summary_items = []

    if req.dino_name:
        data_payload["gift_dino"] = req.dino_name.strip()
        summary_items.append(f"Dino: {req.dino_name}")

    if req.dinos and len(req.dinos) > 0:
        data_payload["gift_dinos"] = json.dumps(req.dinos)
        summary_items.append(f"{len(req.dinos)} Dinos")

    if req.gems and req.gems > 0:
        data_payload["gift_gems"] = str(req.gems)
        summary_items.append(f"{req.gems} Gems")

    if req.dna and req.dna > 0:
        data_payload["gift_dna"] = str(req.dna)
        summary_items.append(f"{req.dna} DNA")

    if req.items and len(req.items) > 0:
        data_payload["gift_items"] = json.dumps(req.items)
        summary_items.append(f"{len(req.items)} Items")

    if req.eggs and len(req.eggs) > 0:
        data_payload["gift_eggs"] = json.dumps(req.eggs)
        summary_items.append(f"{len(req.eggs)} Eggs")

    if req.chests and len(req.chests) > 0:
        data_payload["gift_chests"] = json.dumps(req.chests)
        summary_items.append(f"{len(req.chests)} Chests")

    if req.message and req.message.strip():
        data_payload["gift_message"] = req.message.strip()

    if not data_payload:
        raise HTTPException(status_code=400, detail="Please select at least one gift reward to send.")

    # Call PlayFab Server/UpdateUserData
    await call_playfab(
        "Server/UpdateUserData",
        {
            "PlayFabId": clean_id,
            "Data": data_payload,
            "Permission": "Public"
        },
        secret_key,
        title_id
    )

    summary_str = ", ".join(summary_items)
    await log_action("dino_dev", f"Gift sent to {clean_id} ({summary_str})", user=user["username"])

    return {
        "success": True,
        "message": f"Gift successfully granted to {clean_id} ({summary_str})",
        "granted_data": data_payload,
    }


@router.post("/admin/dino/player/{playfab_id}/ban")
async def ban_player(playfab_id: str, req: DinoBanRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()
    reason = req.reason.strip() if req.reason else "Violation of studio terms of service"

    await call_playfab(
        "Server/UpdateUserData",
        {
            "PlayFabId": clean_id,
            "Data": {
                "is_banned": "true",
                "ban_reason": reason,
            },
            "Permission": "Public"
        },
        secret_key,
        title_id
    )

    await log_action("dino_dev", f"Player {clean_id} BANNED (Reason: {reason})", user=user["username"])
    return {"success": True, "message": f"Player {clean_id} has been suspended/banned."}


@router.post("/admin/dino/player/{playfab_id}/unban")
async def unban_player(playfab_id: str, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()

    await call_playfab(
        "Server/UpdateUserData",
        {
            "PlayFabId": clean_id,
            "KeysToRemove": ["is_banned", "ban_reason"],
        },
        secret_key,
        title_id
    )

    await log_action("dino_dev", f"Player {clean_id} UNBANNED", user=user["username"])
    return {"success": True, "message": f"Player {clean_id} has been unbanned successfully."}


@router.get("/admin/dino/maintenance")
async def get_dino_maintenance(user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    res = await call_playfab(
        "Server/GetTitleData",
        {"Keys": ["is_maintenance", "maintenance_message", "scheduled_maintenance_utc"]},
        secret_key,
        title_id
    )

    data = res.get("data", {}).get("Data", {})
    raw_maint_str = data.get("is_maintenance", "false")
    raw_maint = raw_maint_str.lower() in ("true", "1")
    message = data.get("maintenance_message") or ""
    sched_raw = (data.get("scheduled_maintenance_utc") or "").strip()

    now_utc = datetime.now(timezone.utc)
    is_scheduled = False
    effective_active = raw_maint
    seconds_until_scheduled = None
    sched_dt = None

    if sched_raw and sched_raw.lower() not in ("none", "null", ""):
        try:
            parsed = datetime.fromisoformat(sched_raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            sched_dt = parsed

            if now_utc >= sched_dt:
                effective_active = True
                is_scheduled = False
                seconds_until_scheduled = 0
            else:
                is_scheduled = True
                seconds_until_scheduled = max(0.0, (sched_dt - now_utc).total_seconds())
        except Exception:
            sched_raw = "none"
    else:
        sched_raw = "none"

    if raw_maint:
        effective_active = True

    return {
        "is_maintenance": effective_active,
        "effective_active": effective_active,
        "raw_is_maintenance": raw_maint,
        "is_scheduled": is_scheduled,
        "scheduled_maintenance_utc": sched_raw,
        "maintenance_message": message or "Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée.",
        "seconds_until_scheduled": seconds_until_scheduled,
        "target_iso": sched_dt.strftime("%Y-%m-%dT%H:%M:%SZ") if sched_dt else None,
    }


@router.post("/admin/dino/maintenance")
async def set_dino_maintenance(req: DinoMaintenanceRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    now_utc = datetime.now(timezone.utc)

    msg = (req.maintenance_message or "").strip()
    if not msg:
        msg = "Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée."

    # Determine intent: cancel/reopen, immediate, or schedule
    is_cancel = False
    is_immediate = False
    is_schedule = False

    act = (req.action or "").lower().strip()
    if act in ("cancel", "reopen", "disable", "off", "reset", "clear") or (req.is_maintenance is False and not req.scheduled_maintenance_utc and not req.delay_minutes):
        is_cancel = True
    elif act in ("immediate", "enable", "on", "active", "cut") or (req.is_maintenance is True and not req.scheduled_maintenance_utc and not req.delay_minutes):
        is_immediate = True
    elif act in ("schedule", "scheduled") or (req.delay_minutes and req.delay_minutes > 0) or (req.scheduled_maintenance_utc and req.scheduled_maintenance_utc not in ("none", "")):
        is_schedule = True

    if is_cancel:
        payload_keys = {
            "is_maintenance": "false",
            "scheduled_maintenance_utc": "none",
            "maintenance_message": "",
        }
        status_str = "REOPENED / ONLINE"
    elif is_immediate:
        payload_keys = {
            "is_maintenance": "true",
            "scheduled_maintenance_utc": "none",
            "maintenance_message": msg,
        }
        status_str = "IMMEDIATE CUT (ACTIVE)"
    elif is_schedule:
        target_iso = "none"
        if req.delay_minutes and req.delay_minutes > 0:
            target_dt = now_utc + timedelta(minutes=req.delay_minutes)
            target_iso = target_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        elif req.scheduled_maintenance_utc and req.scheduled_maintenance_utc not in ("none", ""):
            try:
                clean_str = req.scheduled_maintenance_utc.replace("Z", "+00:00")
                parsed_dt = datetime.fromisoformat(clean_str)
                if parsed_dt.tzinfo is None:
                    parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)
                target_iso = parsed_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid scheduled date format. Use ISO 8601 format.")

        payload_keys = {
            "is_maintenance": "false",
            "scheduled_maintenance_utc": target_iso,
            "maintenance_message": msg,
        }
        status_str = f"SCHEDULED for {target_iso}"
    else:
        payload_keys = {
            "is_maintenance": "false",
            "scheduled_maintenance_utc": "none",
            "maintenance_message": "",
        }
        status_str = "REOPENED / ONLINE"

    # Set each key in PlayFab TitleData using Server/SetTitleData (with Admin fallback)
    for k, v in payload_keys.items():
        try:
            await call_playfab(
                "Server/SetTitleData",
                {"Key": k, "Value": v},
                secret_key,
                title_id
            )
        except Exception:
            await call_playfab(
                "Admin/SetTitleData",
                {"Key": k, "Value": v},
                secret_key,
                title_id
            )

    await log_action("dino_dev", f"Game Maintenance: {status_str}", user=user["username"])
    return await get_dino_maintenance(user=user)


@router.get("/admin/dino/history")
async def get_dino_history(user=Depends(require_super_admin)):
    logs = await db.logs.find({"type": "dino_dev"}).sort("timestamp", -1).limit(60).to_list(60)
    return {"logs": [serialize_doc(l) for l in logs]}

