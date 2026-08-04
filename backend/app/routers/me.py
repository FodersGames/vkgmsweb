from bson import ObjectId
from fastapi import APIRouter, Depends

from ..database import db
from ..deps import get_current_user
from ..loyalty import get_tier, TIER_THRESHOLDS, TIER_DISCOUNTS
from ..guild_common import _serialize_guild

router = APIRouter()

# ── User loyalty ──────────────────────────────────────────────────────────────
@router.get("/user/loyalty")
async def get_user_loyalty(user=Depends(get_current_user)):
    doc = await db.user_points.find_one({"email": user["email"]})
    total = doc.get("total_spent_cents", 0) if doc else 0
    tier = get_tier(total)
    discount = TIER_DISCOUNTS.get(tier, 0)
    # next tier threshold
    next_tier = None
    next_threshold = None
    for t_name, t_thresh in TIER_THRESHOLDS:
        if total < t_thresh:
            next_tier = t_name
            next_threshold = t_thresh
    return {
        "total_spent_cents": total,
        "tier": tier,
        "discount_pct": discount,
        "next_tier": next_tier,
        "next_threshold_cents": next_threshold,
    }

# ── Player game stats ─────────────────────────────────────────────────────────
@router.get("/user/play-stats")
async def get_play_stats(user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    saves = await db.play_saves.find({"user_id": uid}).to_list(None)
    by_game: dict = {}
    for s in saves:
        slug = s["project_slug"]
        if slug not in by_game:
            by_game[slug] = {"slug": slug, "categories": [], "last_updated": None, "saves_count": 0}
        by_game[slug]["categories"].append(s["category"])
        by_game[slug]["saves_count"] += 1
        upd = s.get("updated_at")
        if upd and (by_game[slug]["last_updated"] is None or upd > by_game[slug]["last_updated"]):
            by_game[slug]["last_updated"] = upd
    slugs = list(by_game.keys())
    games = await db.website_games.find({"slug": {"$in": slugs}}).to_list(None) if slugs else []
    projects = await db.projects.find({"slug": {"$in": slugs}}).to_list(None) if slugs else []
    game_map = {g["slug"]: g for g in games}
    project_map = {p["slug"]: p for p in projects}
    result = []
    for slug, data in by_game.items():
        wg = game_map.get(slug, {})
        pr = project_map.get(slug, {})
        result.append({
            "slug": slug,
            "name": wg.get("name") or pr.get("name") or slug,
            "cover_image": wg.get("logo_url"),
            "platform_links": wg.get("platforms") or [],
            "categories": list(set(data["categories"])),
            "saves_count": data["saves_count"],
            "last_updated": data["last_updated"].isoformat() if data["last_updated"] else None,
        })
    result.sort(key=lambda x: x["last_updated"] or "", reverse=True)
    return {"games": result, "total_games": len(result)}

# ── Player guilds — read-only aggregate across every game, gated by the
# website JWT (same db.users identity as the play-token guild routes) rather
# than requiring a separate play-token exchange just to list membership. ────
@router.get("/user/guilds")
async def get_my_guilds(user=Depends(get_current_user)):
    uid = ObjectId(user["id"])
    memberships = await db.guild_members.find({"user_id": uid}).to_list(None)
    if not memberships:
        return {"guilds": []}
    guild_ids = [m["guild_id"] for m in memberships]
    guilds = await db.guilds.find({"_id": {"$in": guild_ids}}).to_list(None)
    guild_map = {g["_id"]: g for g in guilds}
    slugs = list({m["project_slug"] for m in memberships})
    games = await db.website_games.find({"slug": {"$in": slugs}}).to_list(None) if slugs else []
    game_map = {g["slug"]: g for g in games}
    result = []
    for m in memberships:
        g = guild_map.get(m["guild_id"])
        if not g:
            continue
        wg = game_map.get(m["project_slug"], {})
        result.append({
            "project_slug": m["project_slug"],
            "game_name": wg.get("name") or m["project_slug"],
            "guild": _serialize_guild(g, my_role=m["role"]),
        })
    result.sort(key=lambda x: x["game_name"])
    return {"guilds": result}
