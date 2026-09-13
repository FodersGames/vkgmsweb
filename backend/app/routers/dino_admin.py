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

async def get_playfab_credentials():
    title_id = os.environ.get("PLAYFAB_TITLE_ID") or DEFAULT_TITLE_ID
    secret_key = os.environ.get("PLAYFAB_SECRET_KEY", "")

    if not secret_key:
        doc = await db.settings.find_one({"key": "playfab_secret_key"})
        if doc and doc.get("value"):
            secret_key = doc["value"]

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
        if res.get("errorDetails") and isinstance(res.get("errorDetails"), dict):
            details_parts = []
            for k, v in res.get("errorDetails").items():
                val_str = ", ".join(v) if isinstance(v, list) else str(v)
                details_parts.append(f"{k}: {val_str}")
            if details_parts:
                joined_details = "; ".join(details_parts)
                err_msg = f"{err_msg} ({joined_details})"
        raise HTTPException(status_code=res.get("code"), detail=f"PlayFab: {err_msg}")
    return res


async def update_playfab_user_data(
    playfab_id: str,
    data: Optional[Dict[str, str]],
    keys_to_remove: Optional[List[str]],
    secret_key: str,
    title_id: str,
    permission: str = "Public"
) -> None:
    """
    Safely updates PlayFab UserData respecting the hard limit of 10 keys per request.
    Splits requests into chunks of at most 10 items and eliminates key collisions.
    """
    clean_id = playfab_id.strip()
    data = dict(data) if data else {}
    keys_to_remove = list(keys_to_remove) if keys_to_remove else []

    # Filter out any keys that accidentally appear in both Data and KeysToRemove
    keys_to_remove = [k for k in keys_to_remove if k not in data]

    # Chunk keys_to_remove in batches of 10
    for i in range(0, len(keys_to_remove), 10):
        chunk = keys_to_remove[i:i + 10]
        if chunk:
            await call_playfab(
                "Server/UpdateUserData",
                {
                    "PlayFabId": clean_id,
                    "KeysToRemove": chunk,
                    "Permission": permission
                },
                secret_key,
                title_id
            )

    # Chunk data in batches of 10
    data_items = list(data.items())
    for i in range(0, len(data_items), 10):
        chunk_data = dict(data_items[i:i + 10])
        if chunk_data:
            await call_playfab(
                "Server/UpdateUserData",
                {
                    "PlayFabId": clean_id,
                    "Data": chunk_data,
                    "Permission": permission
                },
                secret_key,
                title_id
            )


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

class DinoRemoveItemRequest(BaseModel):
    category: str  # "dino", "inventory", "equipped"
    name: str      # name or ID
    quantity: Optional[int] = 1

class DinoUpdateProfileRequest(BaseModel):
    player_dna: Optional[str] = None
    player_gems: Optional[str] = None
    rebirth_level: Optional[str] = None
    equipped_dinos: Optional[str] = None
    owned_dinos: Optional[str] = None
    inventory_items: Optional[str] = None

class DinoMaintenanceRequest(BaseModel):
    action: Optional[str] = None  # "cancel", "immediate", "schedule"
    is_maintenance: Optional[bool] = None
    maintenance_message: Optional[str] = "Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée."
    scheduled_maintenance_utc: Optional[str] = "none"
    delay_minutes: Optional[float] = None

class DinoRawKeyUpdateRequest(BaseModel):
    key: str
    value: Optional[str] = None


def _parse_item_list(raw_str: str) -> List[Dict[str, Any]]:
    if not raw_str or raw_str.strip().lower() in ("none", "empty bag", "empty"):
        return []
    items = []
    parts = [p.strip() for p in raw_str.split(",") if p.strip()]
    for part in parts:
        if " x" in part:
            name, count_str = part.rsplit(" x", 1)
            try:
                count = max(1, int(count_str.strip()))
            except ValueError:
                count = 1
            items.append({"name": name.strip(), "count": count})
        else:
            items.append({"name": part.strip(), "count": 1})
    return items


def _serialize_item_list(items: List[Dict[str, Any]], empty_val: str = "") -> str:
    if not items:
        return empty_val
    parts = []
    for it in items:
        name = it.get("name", "").strip()
        count = it.get("count", 1)
        if count > 1:
            parts.append(f"{name} x{count}")
        elif count == 1:
            parts.append(name)
    return ", ".join(parts) if parts else empty_val


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

    # 1. Fetch UserData from Server API
    res = await call_playfab(
        "Server/GetUserData",
        {"PlayFabId": clean_id},
        secret_key,
        title_id
    )

    data_block = res.get("data", {}).get("Data", {})
    parsed_data = {k: v.get("Value", "") for k, v in data_block.items()}

    # 2. Also fetch UserReadOnlyData (some Roblox games save in ReadOnlyData)
    readonly_data = {}
    try:
        res_ro = await call_playfab(
            "Server/GetUserReadOnlyData",
            {"PlayFabId": clean_id},
            secret_key,
            title_id
        )
        ro_block = res_ro.get("data", {}).get("Data", {})
        readonly_data = {k: v.get("Value", "") for k, v in ro_block.items()}
    except Exception:
        pass

    # 3. Merge all keys found for full inspection
    all_keys = {**parsed_data, **readonly_data}

    # If game saves in a JSON blob key like SaveData, PlayerData, Data, Slot1, Stats
    blob_save = None
    for candidate_key in ["SaveData", "PlayerData", "Data", "GameData", "Stats", "Save", "Slot1"]:
        val = all_keys.get(candidate_key)
        if val and (val.startswith("{") or val.startswith("[")):
            try:
                blob_save = json.loads(val)
                break
            except Exception:
                pass

    # If standard individual keys aren't found directly, extract from blob if available
    player_dna = parsed_data.get("player_dna") or (blob_save.get("dna") if isinstance(blob_save, dict) else None) or "0"
    player_gems = parsed_data.get("player_gems") or (blob_save.get("gems") if isinstance(blob_save, dict) else None) or "0"
    rebirth_level = parsed_data.get("rebirth_level") or (blob_save.get("rebirth") if isinstance(blob_save, dict) else None) or "1"
    total_dinos = parsed_data.get("total_dinos") or (blob_save.get("total_dinos") if isinstance(blob_save, dict) else None) or "0"
    equipped_dinos = parsed_data.get("equipped_dinos") or "None"
    owned_dinos = parsed_data.get("owned_dinos") or ""
    inventory_items = parsed_data.get("inventory_items") or ""

    # Parse player state
    is_banned = parsed_data.get("is_banned", "").lower() in ("true", "1") or readonly_data.get("is_banned", "").lower() in ("true", "1")
    ban_reason = parsed_data.get("ban_reason", "") or readonly_data.get("ban_reason", "")

    # Also check native PlayFab bans if available
    try:
        bans_res = await call_playfab(
            "Server/GetUserBans",
            {"PlayFabId": clean_id},
            secret_key,
            title_id
        )
        ban_data = bans_res.get("data", {}).get("BanData", [])
        active_bans = [b for b in ban_data if b.get("Active")]
        if active_bans:
            is_banned = True
            if not ban_reason:
                ban_reason = active_bans[0].get("Reason") or "PlayFab account suspension"
    except Exception:
        pass

    # Pending gift flags
    has_pending_gift = any([
        all_keys.get("gift_dino"),
        all_keys.get("gift_dinos"),
        all_keys.get("gift_gems"),
        all_keys.get("gift_dna"),
        all_keys.get("gift_items"),
        all_keys.get("gift_eggs"),
        all_keys.get("gift_chests"),
    ])

    return {
        "playfab_id": clean_id,
        "is_banned": is_banned,
        "ban_reason": ban_reason,
        "player_dna": str(player_dna),
        "player_gems": str(player_gems),
        "rebirth_level": str(rebirth_level),
        "total_dinos": str(total_dinos),
        "equipped_dinos": equipped_dinos,
        "owned_dinos": owned_dinos,
        "inventory_items": inventory_items,
        "last_sync": parsed_data.get("last_sync", "Never"),
        "has_pending_gift": has_pending_gift,
        "raw_data": parsed_data,
        "readonly_data": readonly_data,
        "all_keys": all_keys,
    }


@router.post("/admin/dino/gift")
async def grant_gift_to_player(req: DinoGiftRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = req.playfab_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="PlayFab ID is required")

    data_payload: Dict[str, str] = {}
    summary_items = []
    keys_to_remove = []

    # 1. Dinosaurs: if multi-dinos provided, never set legacy gift_dino to avoid double-granting
    if req.dinos and len(req.dinos) > 0:
        data_payload["gift_dinos"] = json.dumps(req.dinos)
        keys_to_remove.append("gift_dino")
        dino_parts = [f"{d.get('count', 1)}x {d.get('name', 'Dino')}" for d in req.dinos if isinstance(d, dict)]
        summary_items.append(f"Dinos: {', '.join(dino_parts)}")
    elif req.dino_name and req.dino_name.strip():
        data_payload["gift_dino"] = req.dino_name.strip()
        summary_items.append(f"Dino: 1x {req.dino_name.strip()}")

    # 2. Currencies
    if req.gems and req.gems > 0:
        data_payload["gift_gems"] = str(req.gems)
        summary_items.append(f"{req.gems:,} Gems")

    if req.dna and req.dna > 0:
        dna_val = int(req.dna) if req.dna == int(req.dna) else req.dna
        data_payload["gift_dna"] = str(dna_val)
        summary_items.append(f"{dna_val:,} DNA")

    # 3. Items, Eggs, Chests with exact counts in logs
    if req.items and len(req.items) > 0:
        data_payload["gift_items"] = json.dumps(req.items)
        item_parts = [f"{i.get('count', 1)}x {i.get('id', 'Item')}" for i in req.items if isinstance(i, dict)]
        summary_items.append(f"Items: {', '.join(item_parts)}")

    if req.eggs and len(req.eggs) > 0:
        data_payload["gift_eggs"] = json.dumps(req.eggs)
        egg_parts = [f"{e.get('count', 1)}x {e.get('eggName', 'Egg')}" for e in req.eggs if isinstance(e, dict)]
        summary_items.append(f"Eggs: {', '.join(egg_parts)}")

    if req.chests and len(req.chests) > 0:
        data_payload["gift_chests"] = json.dumps(req.chests)
        chest_parts = [f"{c.get('count', 1)}x {c.get('chestName', 'Chest')}" for c in req.chests if isinstance(c, dict)]
        summary_items.append(f"Chests: {', '.join(chest_parts)}")

    if req.message and req.message.strip():
        data_payload["gift_message"] = req.message.strip()

    if not data_payload:
        raise HTTPException(status_code=400, detail="Please select at least one gift reward to send.")

    # Call PlayFab Server/UpdateUserData safely
    await update_playfab_user_data(
        clean_id,
        data_payload,
        keys_to_remove,
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

    await update_playfab_user_data(
        clean_id,
        {
            "is_banned": "true",
            "ban_reason": reason,
        },
        None,
        secret_key,
        title_id
    )

    await log_action("dino_dev", f"Player {clean_id} BANNED (Reason: {reason})", user=user["username"])
    return {"success": True, "message": f"Player {clean_id} has been suspended/banned."}


@router.post("/admin/dino/player/{playfab_id}/unban")
async def unban_player(playfab_id: str, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()

    # 1. Update UserData: set is_banned to "false" and clear ban_reason safely
    await update_playfab_user_data(
        clean_id,
        {
            "is_banned": "false",
            "ban_reason": "",
        },
        None,
        secret_key,
        title_id
    )

    # 2. Also revoke native PlayFab bans if any exist
    try:
        await call_playfab(
            "Admin/RevokeAllBansForUser",
            {"PlayFabId": clean_id},
            secret_key,
            title_id
        )
    except Exception:
        pass

    await log_action("dino_dev", f"Player {clean_id} UNBANNED", user=user["username"])
    return {"success": True, "message": f"Player {clean_id} has been unbanned successfully."}


@router.post("/admin/dino/player/{playfab_id}/reset")
async def reset_player_account(playfab_id: str, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="PlayFab ID is required")

    # 1. Inspect existing keys on this player
    res = await call_playfab(
        "Server/GetUserData",
        {"PlayFabId": clean_id},
        secret_key,
        title_id
    )
    current_data = res.get("data", {}).get("Data", {})
    existing_keys = set(current_data.keys())

    # 2. Prepare base reset data
    now_ts = str(int(datetime.now(timezone.utc).timestamp()))
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    reset_data: Dict[str, str] = {
        "player_dna": "0",
        "player_gems": "0",
        "rebirth_level": "1",
        "total_dinos": "0",
        "equipped_dinos": "None",
        "owned_dinos": "None",
        "inventory_items": "Empty bag",
        "last_sync": f"Account reset by admin on {now_str}",
        # Universal reset flags for Roblox scripts:
        "force_account_reset": "true",
        "reset_account": "true",
        "account_reset": "true",
        "account_reset_timestamp": now_ts,
    }

    # 3. Known blob or custom save keys to wipe if present
    blob_keys = [
        "SaveData", "PlayerData", "Data", "GameData", "Stats", "Save", "Slot1",
        "InventoryData", "Profile", "Currency", "Currencies", "Dinos", "Eggs", "Chests"
    ]
    for bk in blob_keys:
        if bk in existing_keys:
            reset_data[bk] = "{}"

    # 4. Remove all pending gifts
    gift_keys = [
        "gift_dino", "gift_dinos", "gift_gems", "gift_dna",
        "gift_items", "gift_eggs", "gift_chests", "gift_message"
    ]
    keys_to_remove = [k for k in gift_keys if k in existing_keys]

    await update_playfab_user_data(
        clean_id,
        reset_data,
        keys_to_remove,
        secret_key,
        title_id
    )

    # 5. Also wipe any matching keys in UserReadOnlyData if present
    try:
        res_ro = await call_playfab(
            "Server/GetUserReadOnlyData",
            {"PlayFabId": clean_id},
            secret_key,
            title_id
        )
        ro_keys = set(res_ro.get("data", {}).get("Data", {}).keys())
        if ro_keys:
            ro_updates = {}
            for k in ["player_dna", "player_gems", "rebirth_level", "total_dinos"]:
                if k in ro_keys:
                    ro_updates[k] = "0" if k != "rebirth_level" else "1"
            for bk in blob_keys:
                if bk in ro_keys:
                    ro_updates[bk] = "{}"
            if ro_updates:
                for i in range(0, len(ro_updates), 10):
                    chunk = dict(list(ro_updates.items())[i:i + 10])
                    await call_playfab(
                        "Server/UpdateUserReadOnlyData",
                        {"PlayFabId": clean_id, "Data": chunk, "Permission": "Public"},
                        secret_key,
                        title_id
                    )
    except Exception:
        pass

    await log_action("dino_dev", f"Player {clean_id} ACCOUNT RESET (Comprehensive)", user=user["username"])
    return {
        "success": True,
        "message": f"Player {clean_id} account has been completely reset to zero.",
        "reset_data": reset_data,
        "cleared_keys": list(existing_keys),
    }


@router.post("/admin/dino/player/{playfab_id}/raw-key")
async def update_player_raw_key(playfab_id: str, req: DinoRawKeyUpdateRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()
    key = req.key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Key name is required")

    if req.value is None or req.value == "":
        await update_playfab_user_data(
            clean_id,
            None,
            [key],
            secret_key,
            title_id
        )
        msg = f"Key '{key}' deleted from player {clean_id}"
    else:
        await update_playfab_user_data(
            clean_id,
            {key: req.value},
            None,
            secret_key,
            title_id
        )
        msg = f"Key '{key}' updated for player {clean_id}"

    await log_action("dino_dev", msg, user=user["username"])
    return {"success": True, "message": msg}


@router.post("/admin/dino/player/{playfab_id}/remove-item")
async def remove_player_item(playfab_id: str, req: DinoRemoveItemRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="PlayFab ID is required")

    cat = req.category.lower().strip()
    target_name = req.name.strip()
    qty_to_remove = req.quantity if req.quantity is not None else 1

    # Fetch current UserData
    res = await call_playfab(
        "Server/GetUserData",
        {"PlayFabId": clean_id},
        secret_key,
        title_id
    )
    data_block = res.get("data", {}).get("Data", {})
    raw_data = {k: v.get("Value", "") for k, v in data_block.items()}

    updates: Dict[str, str] = {}

    if cat == "dino":
        owned_dinos_str = raw_data.get("owned_dinos", "")
        parsed = _parse_item_list(owned_dinos_str)
        found = False
        remaining_count = 0
        new_list = []
        for it in parsed:
            if it["name"].lower() == target_name.lower():
                found = True
                if qty_to_remove == -1 or it["count"] <= qty_to_remove:
                    remaining_count = 0
                else:
                    it["count"] -= qty_to_remove
                    remaining_count = it["count"]
                    new_list.append(it)
            else:
                new_list.append(it)

        if not found:
            raise HTTPException(status_code=404, detail=f"Dino '{target_name}' not found in player's collection")

        new_owned_str = _serialize_item_list(new_list, empty_val="None")
        updates["owned_dinos"] = new_owned_str
        total_dinos = sum(it["count"] for it in new_list)
        updates["total_dinos"] = str(total_dinos)

        # If dino removed completely, unequip if equipped
        if remaining_count == 0:
            equipped_str = raw_data.get("equipped_dinos", "")
            eq_parts = [p.strip() for p in equipped_str.split(",") if p.strip() and p.strip().lower() != "none"]
            new_eq = [p for p in eq_parts if p.lower() != target_name.lower()]
            updates["equipped_dinos"] = ", ".join(new_eq) if new_eq else "None"

    elif cat == "inventory":
        inv_str = raw_data.get("inventory_items", "")
        parsed = _parse_item_list(inv_str)
        found = False
        new_list = []
        for it in parsed:
            if it["name"].lower() == target_name.lower():
                found = True
                if qty_to_remove == -1 or it["count"] <= qty_to_remove:
                    pass  # removed completely
                else:
                    it["count"] -= qty_to_remove
                    new_list.append(it)
            else:
                new_list.append(it)

        if not found:
            raise HTTPException(status_code=404, detail=f"Item '{target_name}' not found in player's inventory")

        new_inv_str = _serialize_item_list(new_list, empty_val="Empty bag")
        updates["inventory_items"] = new_inv_str

    elif cat == "equipped":
        equipped_str = raw_data.get("equipped_dinos", "")
        eq_parts = [p.strip() for p in equipped_str.split(",") if p.strip() and p.strip().lower() != "none"]
        new_eq = [p for p in eq_parts if p.lower() != target_name.lower()]
        updates["equipped_dinos"] = ", ".join(new_eq) if new_eq else "None"

    else:
        raise HTTPException(status_code=400, detail=f"Invalid category '{cat}'. Must be 'dino', 'inventory', or 'equipped'.")

    # Update in PlayFab safely
    await update_playfab_user_data(
        clean_id,
        updates,
        None,
        secret_key,
        title_id
    )

    log_desc = f"Removed {qty_to_remove}x {target_name} ({cat}) from player {clean_id}"
    await log_action("dino_dev", log_desc, user=user["username"])

    return {
        "success": True,
        "message": f"Successfully removed {target_name} from player.",
        "updates": updates
    }


@router.post("/admin/dino/player/{playfab_id}/update-profile")
async def update_player_profile(playfab_id: str, req: DinoUpdateProfileRequest, user=Depends(require_super_admin)):
    title_id, secret_key = await get_playfab_credentials()
    clean_id = playfab_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="PlayFab ID is required")

    updates = {}
    if req.player_dna is not None:
        updates["player_dna"] = str(req.player_dna).strip()
    if req.player_gems is not None:
        updates["player_gems"] = str(req.player_gems).strip()
    if req.rebirth_level is not None:
        updates["rebirth_level"] = str(req.rebirth_level).strip()
    if req.equipped_dinos is not None:
        updates["equipped_dinos"] = str(req.equipped_dinos).strip()
    if req.owned_dinos is not None:
        updates["owned_dinos"] = str(req.owned_dinos).strip()
    if req.inventory_items is not None:
        updates["inventory_items"] = str(req.inventory_items).strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    await update_playfab_user_data(
        clean_id,
        updates,
        None,
        secret_key,
        title_id
    )

    await log_action("dino_dev", f"Updated profile stats for player {clean_id} ({list(updates.keys())})", user=user["username"])
    return {
        "success": True,
        "message": f"Player {clean_id} profile updated successfully.",
        "updates": updates
    }


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

    if is_immediate:
        await db.website_settings.update_one({}, {"$set": {
            "dino_maintenance_mode": True,
            "dino_maintenance_started_at": now_utc,
        }}, upsert=True)
        await db.maintenance_history.insert_one({
            "service": "dino",
            "type": "maintenance",
            "status": "active",
            "started_at": now_utc,
            "ended_at": None,
            "message": msg or "Idle Dino Clicker Tycoon maintenance",
        })
    elif is_cancel:
        await db.website_settings.update_one({}, {"$set": {
            "dino_maintenance_mode": False,
            "dino_maintenance_started_at": None,
        }}, upsert=True)
        active_dino = await db.maintenance_history.find({"service": "dino", "status": "active"}).to_list(10)
        for s in active_dino:
            raw_started = s.get("started_at")
            if isinstance(raw_started, str):
                try:
                    raw_started = datetime.fromisoformat(raw_started.replace("Z", "+00:00"))
                except Exception:
                    raw_started = now_utc
            if raw_started and getattr(raw_started, "tzinfo", None) is None:
                raw_started = raw_started.replace(tzinfo=timezone.utc)
            started = raw_started or now_utc
            duration = max(0.1, (now_utc - started).total_seconds() / 60)
            await db.maintenance_history.update_one(
                {"_id": s["_id"]},
                {"$set": {"status": "completed", "ended_at": now_utc, "duration_minutes": round(duration, 1)}}
            )

    await log_action("dino_dev", f"Game Maintenance: {status_str}", user=user["username"])
    return await get_dino_maintenance(user=user)


@router.get("/admin/dino/history")
async def get_dino_history(user=Depends(require_super_admin)):
    logs = await db.logs.find({"type": "dino_dev"}).sort("timestamp", -1).limit(60).to_list(60)
    return {"logs": [serialize_doc(l) for l in logs]}

