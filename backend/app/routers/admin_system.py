import os
import re
import time
import shlex
import secrets
import psutil
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from ..config import VERSION, SETUP_KEY, STRIPE_WEBHOOK_SECRET, _JWT_EPHEMERAL, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, ROOT_DIR
from ..database import db, client
from ..deps import require_permission, require_super_admin, hash_key, PSEUDO_REGEX
from ..utils import log_action, _create_notification
from ..loyalty import get_tier
from ..chat_common import get_banned_words, contains_banned_word
from ..rate_limit import limiter
from ..schemas import CliExecuteRequest

router = APIRouter()

@router.get("/admin/system/health")
async def get_system_health(user=Depends(require_permission("manage_website"))):
    stripe_key = os.environ.get('STRIPE_SECRET_KEY', '')
    return {
        "version": VERSION,
        "jwt_persistent": not _JWT_EPHEMERAL,
        "master_key_configured": bool(SETUP_KEY),
        "stripe_configured": bool(stripe_key),
        "stripe_mode": "live" if stripe_key.startswith("sk_live_") else ("test" if stripe_key.startswith("sk_test_") else None),
        "stripe_webhook_configured": bool(STRIPE_WEBHOOK_SECRET),
    }

# ── System stats ─────────────────────────────────────────────────────────────

@router.get("/admin/system/stats")
async def get_system_stats(user=Depends(require_permission("view_vps"))):
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_count   = psutil.cpu_count(logical=True)

    ram  = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    uptime_seconds = time.time() - psutil.boot_time()

    load_avg = None
    try:
        load_avg = list(psutil.getloadavg())
    except Exception:
        pass

    return {
        "cpu":    {"percent": cpu_percent, "count": cpu_count},
        "ram":    {"total": ram.total,  "used": ram.used,  "free": ram.available, "percent": ram.percent},
        "disk":   {"total": disk.total, "used": disk.used, "free": disk.free,     "percent": disk.percent},
        "uptime_seconds": uptime_seconds,
        "load_avg": load_avg,
    }

# ── Deep system health ───────────────────────────────────────────────────────
# Collections indexed at startup (backend/app/main.py) — used only to report a
# per-collection custom-index count, not to enforce/recreate anything here.
_INDEXED_COLLECTIONS = [
    "users", "projects", "items", "logs", "variables", "website_games",
    "blog_posts", "chat_messages", "website_shop_products", "missions",
    "notifications", "support_tickets", "game_purchases", "user_points",
    "website_shop_global_settings", "play_saves", "play_refresh_tokens",
    "careers", "play_nicknames", "play_bans", "play_first_seen", "guilds",
    "guild_members", "chat_bans", "chat_mutes", "cli_destructive_log",
    "cli_lockouts",
]

_DEPENDENCY_CATEGORIES = [
    ("Web framework", ("fastapi", "starlette", "uvicorn", "pydantic", "pydantic_core", "python-multipart", "h11", "anyio")),
    ("Database", ("motor", "pymongo", "dnspython")),
    ("Auth & security", ("bcrypt", "PyJWT", "python-jose")),
    ("Payments", ("stripe",)),
    ("Rate limiting", ("slowapi", "limits")),
    ("System", ("psutil",)),
]

def _categorize_requirements(lines):
    grouped = {label: [] for label, _ in _DEPENDENCY_CATEGORIES}
    grouped["Other"] = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        pkg_name = re.split(r"[=<>!~]", line, 1)[0].strip()
        for label, prefixes in _DEPENDENCY_CATEGORIES:
            if pkg_name.lower() in [p.lower() for p in prefixes]:
                grouped[label].append(line)
                break
        else:
            grouped["Other"].append(line)
    return {k: v for k, v in grouped.items() if v}

@router.get("/admin/system/health/detailed")
async def get_system_health_detailed(user=Depends(require_permission("view_vps"))):
    stripe_key = os.environ.get('STRIPE_SECRET_KEY', '')

    # Database — connectivity, size stats, replica-set status (best-effort).
    db_section = {"connected": False, "stats": None, "replica_set": "standalone"}
    try:
        await client.admin.command("ping")
        db_section["connected"] = True
    except Exception as e:
        db_section["error"] = str(e)
    try:
        stats = await db.command("dbStats")
        db_section["stats"] = {
            "collections": stats.get("collections"),
            "objects": stats.get("objects"),
            "data_size_bytes": stats.get("dataSize"),
            "storage_size_bytes": stats.get("storageSize"),
            "indexes": stats.get("indexes"),
            "index_size_bytes": stats.get("indexSize"),
        }
    except Exception as e:
        db_section["stats_error"] = str(e)
    try:
        await client.admin.command("replSetGetStatus")
        db_section["replica_set"] = "replica set"
    except Exception:
        pass  # standalone instances reject this command — expected, not an error

    # Configuration status — presence only, never values.
    cors_raw = os.environ.get("CORS_ORIGINS", "").strip()
    config_section = {
        "jwt_persistent": not _JWT_EPHEMERAL,
        "master_key_configured": bool(SETUP_KEY),
        "super_admin_bootstrap_configured": bool(SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD),
        "stripe_configured": bool(stripe_key),
        "stripe_mode": "live" if stripe_key.startswith("sk_live_") else ("test" if stripe_key.startswith("sk_test_") else None),
        "stripe_webhook_configured": bool(STRIPE_WEBHOOK_SECRET),
        "cors_origins_configured": len([o for o in cors_raw.split(",") if o.strip()]) if cors_raw else 0,
        "frontend_url_configured": bool(os.environ.get("FRONTEND_URL", "").strip()),
    }

    # Rate limiting — flag the in-memory backend as an explicit operational caveat.
    rate_limit_section = {
        "backend": "in-memory",
        "caveat": "Per-process — limits reset on restart and are not shared across multiple worker processes.",
    }

    # Storage — game file totals via the same $group/$sum aggregation shape already used in files.py.
    storage_section = {"uploads_dir": str(ROOT_DIR / "uploads")}
    try:
        agg = await db.game_files.aggregate([
            {"$group": {"_id": None, "count": {"$sum": 1}, "total_bytes": {"$sum": "$size_bytes"}}}
        ]).to_list(1)
        storage_section["game_files_count"] = agg[0]["count"] if agg else 0
        storage_section["game_files_total_bytes"] = agg[0]["total_bytes"] if agg else 0
    except Exception as e:
        storage_section["error"] = str(e)

    # Indexes — per-collection custom index count (excludes the default _id_ index).
    index_section = []
    for coll_name in _INDEXED_COLLECTIONS:
        try:
            info = await db[coll_name].index_information()
            custom_count = len([k for k in info.keys() if k != "_id_"])
            index_section.append({"collection": coll_name, "custom_indexes": custom_count, "ok": custom_count > 0})
        except Exception:
            index_section.append({"collection": coll_name, "custom_indexes": 0, "ok": False})

    # Dependencies — echo requirements.txt, grouped for readability.
    dependencies_section = {}
    try:
        req_path = ROOT_DIR / "requirements.txt"
        lines = req_path.read_text(encoding="utf-8").splitlines()
        dependencies_section = _categorize_requirements(lines)
    except Exception as e:
        dependencies_section = {"error": str(e)}

    # Resources — same payload as /admin/system/stats, folded in so Health is one-stop.
    cpu_percent = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    uptime_seconds = time.time() - psutil.boot_time()
    try:
        load_avg = list(psutil.getloadavg())
    except Exception:
        load_avg = None
    resources_section = {
        "cpu": {"percent": cpu_percent, "count": psutil.cpu_count(logical=True)},
        "ram": {"total": ram.total, "used": ram.used, "free": ram.available, "percent": ram.percent},
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free, "percent": disk.percent},
        "uptime_seconds": uptime_seconds,
        "load_avg": load_avg,
    }

    return {
        "version": VERSION,
        "database": db_section,
        "configuration": config_section,
        "rate_limiting": rate_limit_section,
        "storage": storage_section,
        "indexes": index_section,
        "dependencies": dependencies_section,
        "resources": resources_section,
    }

# ============================================================
# SUPER ADMIN CLI
# ============================================================
# Closed whitelist of commands only. Every verb below wraps the SAME database
# operations already used by their equivalent dashboard endpoints — no raw
# Mongo queries, no code evaluation. Destructive verbs are two-phase: the
# first call (confirm=False) returns a preview only; the actual write only
# happens when the client resends the identical command with confirm=True.

_CLI_HELP_TEXT = [
    "Available commands:",
    "",
    "  User accounts",
    "  help",
    "  user find <email|username>",
    "  user list [role]",
    "  user suspend <email|username>",
    "  user unsuspend <email|username>",
    "  user role <email|username> <user|admin>",
    "  user reset-password <email|username>",
    "  user delete <email|username>",
    "",
    "  Players",
    "  player find <project_slug> <username|nickname|email|id>",
    "  player ban <project_slug> <username|nickname|email|id>",
    "  player unban <project_slug> <username|nickname|email|id>",
    "  player revoke <project_slug> <username|nickname|email|id>",
    "  player mute <project_slug> <username|nickname|email|id> <minutes> [reason]",
    "  player wipe-saves <project_slug> <username|nickname|email|id>",
    "",
    "  Projects & missions",
    "  project status <project_slug> <open|closed|maintenance>",
    "  project stats <project_slug>",
    "  mission list <project_slug> [status]",
    "  mission cancel <project_slug> <mission_id>",
    "",
    "  Loyalty, shop & support",
    "  loyalty show <email>",
    "  loyalty adjust <email> <+amount|-amount> [reason]",
    "  purchases show <email>",
    "  coupon create <email> <discount_pct> [valid_days]",
    "  coupon revoke <code>",
    "  ticket show <ticket_number>",
    "  ticket close <ticket_number>",
    "",
    "  System",
    "  maintenance on|off",
    "  broadcast <message>",
    "  stats",
    "  history [n]",
    "  history all [n]",
    "",
    "",
    "  Catalogue (games / applications / software)",
    "  game list [type]",
    "  game show <slug>",
    "  game publish <slug>",
    "  game unpublish <slug>",
    "  game feature <slug>",
    "  game price <slug> <cents>",
    "  game delete <slug>",
    "",
    "  Shop",
    "  shop list [game_slug]",
    "  shop toggle <product_id>",
    "  shop badge <product_id> <badge>",
    "  coupon list [email]",
    "  coupon campaign create <name> <discount_pct> <bronze|silver|gold|diamond|all> [valid_days]",
    "  coupon campaign show <campaign_id>",
    "",
    "  Chat & moderation",
    "  chat ban <project_slug> <query> [reason]",
    "  chat unban <project_slug> <query>",
    "  chat unmute <project_slug> <query>",
    "  chat wordlist add|remove <word>",
    "  chat purge <project_slug> [n]",
    "  chat recent <project_slug> [n]",
    "",
    "  Guilds",
    "  guild list <project_slug>",
    "  guild show <guild_id>",
    "  guild disband <guild_id>",
    "  guild kick <guild_id> <query>",
    "",
    "  Blog & careers",
    "  blog list [published|draft]",
    "  blog publish <slug>",
    "  blog unpublish <slug>",
    "  blog delete <slug>",
    "  career list [open|closed]",
    "  career open <career_id>",
    "  career close <career_id>",
    "",
    "  Variables & items",
    "  var get <project_slug> <name>",
    "  var set <project_slug> <name> <value>",
    "  item list <project_slug>",
    "  item send <project_slug> <query> <item_name> <amount>",
    "",
    "  Project extras",
    "  project logs <project_slug> [n]",
    "  project files <project_slug>",
    "  project keys <project_slug>",
    "",
    "  Tickets, notifications, logs & settings",
    "  ticket list [status]",
    "  ticket reply <ticket_number> <message>",
    "  notify user <query> <message>",
    "  notify list <query>",
    "  logs recent [type] [n]",
    "  logs search <keyword>",
    "  settings show",
    "  settings set support_email <value>",
    "",
    "  Accounts & players extras",
    "  user set-pseudo <query> <new_pseudo>",
    "  user reset-cooldown <query> <firstname|pseudo>",
    "  player nickname <project_slug> <query>",
    "  player firstseen <project_slug> <query>",
    "",
    "Destructive commands ask for confirmation before applying any change.",
    "Repeated destructive actions in a short window auto-lock the CLI as an anomaly safeguard.",
]

# ── CLI catalog ───────────────────────────────────────────────────────────────
# Read-only metadata describing every command above — powers GET /admin/cli/commands,
# used by the frontend for autocomplete and for generating the "$command" popup
# form. It does NOT execute anything; it's purely descriptive data that mirrors
# _cli_dispatch's branches. type is one of: text | number | select | textarea.
_T = "text"; _N = "number"; _TA = "textarea"
def _sel(choices):
    return {"type": "select", "choices": choices}

_CLI_CATALOG = [
    # User accounts
    {"path": ["help"], "category": "System", "description": "Show the command list.", "args": [], "confirm": False},
    {"path": ["stats"], "category": "System", "description": "Platform-wide counters.", "args": [], "confirm": False},
    {"path": ["history"], "category": "System", "description": "Your own recent CLI commands.", "args": [{"name": "n", "label": "Count", "type": _N, "required": False}], "confirm": False},
    {"path": ["user", "find"], "category": "Users", "description": "Look up a user account.", "args": [{"name": "query", "label": "Email or pseudo", "type": _T, "required": True}], "confirm": False},
    {"path": ["user", "list"], "category": "Users", "description": "List users, optionally by role.", "args": [{"name": "role", "label": "Role", **_sel(["user", "admin", "super_admin"]), "required": False}], "confirm": False},
    {"path": ["user", "suspend"], "category": "Users", "description": "Suspend a user account.", "args": [{"name": "query", "label": "Email or pseudo", "type": _T, "required": True}], "confirm": True},
    {"path": ["user", "unsuspend"], "category": "Users", "description": "Reactivate a suspended account.", "args": [{"name": "query", "label": "Email or pseudo", "type": _T, "required": True}], "confirm": True},
    {"path": ["user", "role"], "category": "Users", "description": "Change a user's role.", "args": [
        {"name": "query", "label": "Email or pseudo", "type": _T, "required": True},
        {"name": "role", "label": "New role", **_sel(["user", "admin"]), "required": True},
    ], "confirm": True},
    {"path": ["user", "reset-password"], "category": "Users", "description": "Generate a temporary password.", "args": [{"name": "query", "label": "Email or pseudo", "type": _T, "required": True}], "confirm": True},
    {"path": ["user", "delete"], "category": "Users", "description": "Permanently delete a user account.", "args": [{"name": "query", "label": "Email or pseudo", "type": _T, "required": True}], "confirm": True},
    {"path": ["user", "set-pseudo"], "category": "Users", "description": "Admin-set a user's pseudo directly.", "args": [
        {"name": "query", "label": "Email or pseudo", "type": _T, "required": True},
        {"name": "new_pseudo", "label": "New pseudo", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["user", "reset-cooldown"], "category": "Users", "description": "Reset a user's own change cooldown.", "args": [
        {"name": "query", "label": "Email or pseudo", "type": _T, "required": True},
        {"name": "field", "label": "Field", **_sel(["firstname", "pseudo"]), "required": True},
    ], "confirm": True},

    # Players
    {"path": ["player", "find"], "category": "Players", "description": "Look up a player in a project.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": False},
    {"path": ["player", "ban"], "category": "Players", "description": "Ban a player from a project.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["player", "unban"], "category": "Players", "description": "Unban a player from a project.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["player", "revoke"], "category": "Players", "description": "Revoke all sessions for a player.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["player", "mute"], "category": "Players", "description": "Mute a player in project chat.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
        {"name": "minutes", "label": "Duration (minutes)", "type": _N, "required": True},
        {"name": "reason", "label": "Reason", "type": _TA, "required": False},
    ], "confirm": True},
    {"path": ["player", "wipe-saves"], "category": "Players", "description": "Permanently wipe a player's save data.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["player", "nickname"], "category": "Players", "description": "Show a player's in-game nickname.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": False},
    {"path": ["player", "firstseen"], "category": "Players", "description": "Show when a player was first seen.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": False},

    # Projects & missions
    {"path": ["project", "status"], "category": "Projects", "description": "Set a project's server status.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "status", "label": "Status", **_sel(["open", "closed", "maintenance"]), "required": True},
    ], "confirm": True},
    {"path": ["project", "stats"], "category": "Projects", "description": "Quick stats for a project.", "args": [{"name": "slug", "label": "Project", "type": _T, "required": True}], "confirm": False},
    {"path": ["project", "logs"], "category": "Projects", "description": "Recent logs for a project.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "n", "label": "Count", "type": _N, "required": False},
    ], "confirm": False},
    {"path": ["project", "files"], "category": "Projects", "description": "Latest uploaded build files.", "args": [{"name": "slug", "label": "Project", "type": _T, "required": True}], "confirm": False},
    {"path": ["project", "keys"], "category": "Projects", "description": "Show a project's chat/files API keys.", "args": [{"name": "slug", "label": "Project", "type": _T, "required": True}], "confirm": False},
    {"path": ["mission", "list"], "category": "Projects", "description": "List missions for a project.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "status", "label": "Status", **_sel(["open", "in_progress", "completed", "cancelled"]), "required": False},
    ], "confirm": False},
    {"path": ["mission", "cancel"], "category": "Projects", "description": "Cancel a mission.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "mission_id", "label": "Mission ID", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["var", "get"], "category": "Projects", "description": "Read a project variable.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "name", "label": "Variable name", "type": _T, "required": True},
    ], "confirm": False},
    {"path": ["var", "set"], "category": "Projects", "description": "Set a project variable.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "name", "label": "Variable name", "type": _T, "required": True},
        {"name": "value", "label": "New value", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["item", "list"], "category": "Projects", "description": "Recent item sends for a project.", "args": [{"name": "slug", "label": "Project", "type": _T, "required": True}], "confirm": False},
    {"path": ["item", "send"], "category": "Projects", "description": "Send an in-game item to a player.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Player UID", "type": _T, "required": True},
        {"name": "item_name", "label": "Item / variable name", "type": _T, "required": True},
        {"name": "amount", "label": "Amount", "type": _N, "required": True},
    ], "confirm": True},

    # Chat & guilds
    {"path": ["chat", "ban"], "category": "Chat", "description": "Ban a player from project chat.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
        {"name": "reason", "label": "Reason", "type": _TA, "required": False},
    ], "confirm": True},
    {"path": ["chat", "unban"], "category": "Chat", "description": "Remove a chat ban.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["chat", "unmute"], "category": "Chat", "description": "Unmute a player.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "query", "label": "Nickname, pseudo or email", "type": _T, "required": True},
    ], "confirm": True},
    {"path": ["chat", "wordlist", "add"], "category": "Chat", "description": "Add a word to the banned-words list.", "args": [{"name": "word", "label": "Word", "type": _T, "required": True}], "confirm": True},
    {"path": ["chat", "wordlist", "remove"], "category": "Chat", "description": "Remove a word from the banned-words list.", "args": [{"name": "word", "label": "Word", "type": _T, "required": True}], "confirm": True},
    {"path": ["chat", "purge"], "category": "Chat", "description": "Delete recent chat messages.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "n", "label": "Count", "type": _N, "required": False},
    ], "confirm": True},
    {"path": ["chat", "recent"], "category": "Chat", "description": "View recent chat messages.", "args": [
        {"name": "slug", "label": "Project", "type": _T, "required": True},
        {"name": "n", "label": "Count", "type": _N, "required": False},
    ], "confirm": False},
    {"path": ["guild", "list"], "category": "Chat", "description": "List guilds in a project.", "args": [{"name": "slug", "label": "Project", "type": _T, "required": True}], "confirm": False},
    {"path": ["guild", "show"], "category": "Chat", "description": "Guild detail and member list.", "args": [{"name": "guild_id", "label": "Guild ID", "type": _T, "required": True}], "confirm": False},
    {"path": ["guild", "disband"], "category": "Chat", "description": "Permanently disband a guild.", "args": [{"name": "guild_id", "label": "Guild ID", "type": _T, "required": True}], "confirm": True},
    {"path": ["guild", "kick"], "category": "Chat", "description": "Remove a member from a guild.", "args": [
        {"name": "guild_id", "label": "Guild ID", "type": _T, "required": True},
        {"name": "query", "label": "Email or pseudo", "type": _T, "required": True},
    ], "confirm": True},

    # Loyalty, shop & catalogue
    {"path": ["loyalty", "show"], "category": "Shop & loyalty", "description": "Show a user's loyalty tier.", "args": [{"name": "email", "label": "Email", "type": _T, "required": True}], "confirm": False},
    {"path": ["loyalty", "adjust"], "category": "Shop & loyalty", "description": "Adjust a user's loyalty balance.", "args": [
        {"name": "email", "label": "Email", "type": _T, "required": True},
        {"name": "amount", "label": "Amount ($, +/-)", "type": _T, "required": True},
        {"name": "reason", "label": "Reason", "type": _TA, "required": False},
    ], "confirm": True},
    {"path": ["purchases", "show"], "category": "Shop & loyalty", "description": "List a user's game purchases.", "args": [{"name": "email", "label": "Email", "type": _T, "required": True}], "confirm": False},
    {"path": ["coupon", "create"], "category": "Shop & loyalty", "description": "Create a single-use coupon for one user.", "args": [
        {"name": "email", "label": "Email", "type": _T, "required": True},
        {"name": "discount_pct", "label": "Discount %", "type": _N, "required": True},
        {"name": "valid_days", "label": "Valid days", "type": _N, "required": False},
    ], "confirm": True},
    {"path": ["coupon", "revoke"], "category": "Shop & loyalty", "description": "Revoke an unused coupon.", "args": [{"name": "code", "label": "Coupon code", "type": _T, "required": True}], "confirm": True},
    {"path": ["coupon", "list"], "category": "Shop & loyalty", "description": "List coupons, optionally by user.", "args": [{"name": "email", "label": "Email", "type": _T, "required": False}], "confirm": False},
    {"path": ["coupon", "campaign", "create"], "category": "Shop & loyalty", "description": "Send coupons to a whole loyalty tier.", "args": [
        {"name": "name", "label": "Campaign name", "type": _T, "required": True},
        {"name": "discount_pct", "label": "Discount %", "type": _N, "required": True},
        {"name": "tier", "label": "Target tier", **_sel(["bronze", "silver", "gold", "diamond", "all"]), "required": True},
        {"name": "valid_days", "label": "Valid days", "type": _N, "required": False},
    ], "confirm": True},
    {"path": ["coupon", "campaign", "show"], "category": "Shop & loyalty", "description": "Campaign detail.", "args": [{"name": "campaign_id", "label": "Campaign ID", "type": _T, "required": True}], "confirm": False},
    {"path": ["shop", "list"], "category": "Shop & loyalty", "description": "List shop products.", "args": [{"name": "game_slug", "label": "Game (optional)", "type": _T, "required": False}], "confirm": False},
    {"path": ["shop", "toggle"], "category": "Shop & loyalty", "description": "Activate/deactivate a shop product.", "args": [{"name": "product_id", "label": "Product ID", "type": _T, "required": True}], "confirm": True},
    {"path": ["shop", "badge"], "category": "Shop & loyalty", "description": "Set a shop product's badge.", "args": [
        {"name": "product_id", "label": "Product ID", "type": _T, "required": True},
        {"name": "badge", "label": "Badge", **_sel(["NEW", "SALE", "LIMITED", "HOT", "POPULAR", "BEST", "BUNDLE", "EXCLUSIVE"]), "required": True},
    ], "confirm": True},
    {"path": ["game", "list"], "category": "Catalogue", "description": "List catalogue entries.", "args": [{"name": "type", "label": "Type", **_sel(["game", "application", "software"]), "required": False}], "confirm": False},
    {"path": ["game", "show"], "category": "Catalogue", "description": "Catalogue entry detail.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": False},
    {"path": ["game", "publish"], "category": "Catalogue", "description": "Publish a catalogue entry.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},
    {"path": ["game", "unpublish"], "category": "Catalogue", "description": "Move a catalogue entry to coming soon.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},
    {"path": ["game", "feature"], "category": "Catalogue", "description": "Feature a catalogue entry on the homepage.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},
    {"path": ["game", "price"], "category": "Catalogue", "description": "Change a catalogue entry's price.", "args": [
        {"name": "slug", "label": "Slug", "type": _T, "required": True},
        {"name": "cents", "label": "Price (cents)", "type": _N, "required": True},
    ], "confirm": True},
    {"path": ["game", "delete"], "category": "Catalogue", "description": "Permanently remove a catalogue entry.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},

    # Blog & careers
    {"path": ["blog", "list"], "category": "Blog & careers", "description": "List blog posts.", "args": [{"name": "status", "label": "Status", **_sel(["published", "draft"]), "required": False}], "confirm": False},
    {"path": ["blog", "publish"], "category": "Blog & careers", "description": "Publish a blog post.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},
    {"path": ["blog", "unpublish"], "category": "Blog & careers", "description": "Unpublish a blog post.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},
    {"path": ["blog", "delete"], "category": "Blog & careers", "description": "Permanently delete a blog post.", "args": [{"name": "slug", "label": "Slug", "type": _T, "required": True}], "confirm": True},
    {"path": ["career", "list"], "category": "Blog & careers", "description": "List career postings.", "args": [{"name": "state", "label": "State", **_sel(["open", "closed"]), "required": False}], "confirm": False},
    {"path": ["career", "open"], "category": "Blog & careers", "description": "Reopen a career posting.", "args": [{"name": "career_id", "label": "Posting ID", "type": _T, "required": True}], "confirm": True},
    {"path": ["career", "close"], "category": "Blog & careers", "description": "Close a career posting.", "args": [{"name": "career_id", "label": "Posting ID", "type": _T, "required": True}], "confirm": True},

    # Support
    {"path": ["ticket", "show"], "category": "Support", "description": "Ticket detail.", "args": [{"name": "ticket_number", "label": "Ticket number", "type": _T, "required": True}], "confirm": False},
    {"path": ["ticket", "close"], "category": "Support", "description": "Close a ticket.", "args": [{"name": "ticket_number", "label": "Ticket number", "type": _T, "required": True}], "confirm": True},
    {"path": ["ticket", "list"], "category": "Support", "description": "List tickets, optionally by status.", "args": [{"name": "status", "label": "Status", **_sel(["open", "in_progress", "resolved", "closed"]), "required": False}], "confirm": False},
    {"path": ["ticket", "reply"], "category": "Support", "description": "Reply to a ticket as support.", "args": [
        {"name": "ticket_number", "label": "Ticket number", "type": _T, "required": True},
        {"name": "message", "label": "Message", "type": _TA, "required": True},
    ], "confirm": True},
    {"path": ["notify", "user"], "category": "Support", "description": "Send a notification to one user.", "args": [
        {"name": "query", "label": "Email or pseudo", "type": _T, "required": True},
        {"name": "message", "label": "Message", "type": _TA, "required": True},
    ], "confirm": True},
    {"path": ["notify", "list"], "category": "Support", "description": "Recent notifications for a user.", "args": [{"name": "query", "label": "Email or pseudo", "type": _T, "required": True}], "confirm": False},

    # System
    {"path": ["maintenance"], "category": "System", "description": "Toggle site-wide maintenance mode.", "args": [{"name": "state", "label": "State", **_sel(["on", "off"]), "required": True}], "confirm": True},
    {"path": ["broadcast"], "category": "System", "description": "Notify every user.", "args": [{"name": "message", "label": "Message", "type": _TA, "required": True}], "confirm": True},
    {"path": ["logs", "recent"], "category": "System", "description": "Tail the general activity log.", "args": [
        {"name": "type", "label": "Type filter", "type": _T, "required": False},
        {"name": "n", "label": "Count", "type": _N, "required": False},
    ], "confirm": False},
    {"path": ["logs", "search"], "category": "System", "description": "Search the activity log by keyword.", "args": [{"name": "keyword", "label": "Keyword", "type": _T, "required": True}], "confirm": False},
    {"path": ["settings", "show"], "category": "System", "description": "Show website settings.", "args": [], "confirm": False},
    {"path": ["settings", "set"], "category": "System", "description": "Set a website setting.", "args": [
        {"name": "key", "label": "Key", **_sel(["support_email"]), "required": True},
        {"name": "value", "label": "Value", "type": _T, "required": True},
    ], "confirm": True},
]

async def _cli_find_user_doc(query: str):
    q = query.strip()
    if not q:
        return None
    user = await db.users.find_one({"email": q.lower()})
    if user:
        return user
    user = await db.users.find_one({"username": {"$regex": f"^{re.escape(q)}$", "$options": "i"}})
    if user:
        return user
    try:
        return await db.users.find_one({"_id": ObjectId(q)})
    except Exception:
        return None

async def _cli_find_player_doc(project_slug: str, query: str):
    q = query.strip()
    if not q:
        return None
    nick = await db.play_nicknames.find_one(
        {"project_slug": project_slug, "nickname": {"$regex": f"^{re.escape(q)}$", "$options": "i"}}
    )
    if nick:
        user = await db.users.find_one({"_id": nick["user_id"]})
        if user:
            return user
    return await _cli_find_user_doc(q)

def _cli_user_summary(u) -> List[str]:
    return [
        f"id:        {str(u['_id'])}",
        f"username:  {u.get('username', '')}",
        f"email:     {u.get('email', '')}",
        f"role:      {u.get('role', 'user')}",
        f"suspended: {u.get('isSuspended', False)}",
        f"createdAt: {u['createdAt'].isoformat() if isinstance(u.get('createdAt'), datetime) else u.get('created_at', '')}",
        f"lastLogin: {u['lastLogin'].isoformat() if isinstance(u.get('lastLogin'), datetime) else 'never'}",
    ]

class _CliError(Exception):
    pass

# ── CLI anomaly detection / lockout ──────────────────────────────────────────
# A destructive action is any command that actually mutated data (recorded only
# after the confirm=True path executes — the confirmation prompt itself never counts).
# Too many in a short window looks like a compromised session or a fat-fingered
# loop, so the CLI locks itself for that admin rather than logging quietly.
_CLI_ANOMALY_WINDOW_MIN = 2
_CLI_ANOMALY_THRESHOLD = 5
_CLI_LOCKOUT_ESCALATION_MIN = [15, 60, 24 * 60]  # 1st, 2nd, 3rd+ lockout within a rolling 24h window

async def _cli_check_lockout(username: str):
    lock = await db.cli_lockouts.find_one({"username": username}, sort=[("locked_at", -1)])
    if lock and lock.get("locked_until") and lock["locked_until"] > datetime.now(timezone.utc):
        remaining = int((lock["locked_until"] - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        raise _CliError(
            f"CLI locked for ~{remaining} more minute{'s' if remaining != 1 else ''} — unusual activity was "
            f"detected ({lock.get('reason', 'anomaly')}). Ask another super admin to check the logs if this wasn't you."
        )

async def _cli_record_destructive(admin: dict, command: str) -> Optional[str]:
    """Logs a completed destructive CLI action and checks for an anomalous burst.
    Returns a warning line to append to the command's output if a lockout was just triggered."""
    now = datetime.now(timezone.utc)
    await db.cli_destructive_log.insert_one({"username": admin["username"], "command": command, "timestamp": now})

    window_start = now - timedelta(minutes=_CLI_ANOMALY_WINDOW_MIN)
    recent_count = await db.cli_destructive_log.count_documents(
        {"username": admin["username"], "timestamp": {"$gte": window_start}}
    )
    if recent_count < _CLI_ANOMALY_THRESHOLD:
        return None

    day_start = now - timedelta(hours=24)
    prior_triggers = await db.cli_lockouts.count_documents({"username": admin["username"], "locked_at": {"$gte": day_start}})
    lockout_minutes = _CLI_LOCKOUT_ESCALATION_MIN[min(prior_triggers, len(_CLI_LOCKOUT_ESCALATION_MIN) - 1)]
    locked_until = now + timedelta(minutes=lockout_minutes)
    reason = f"{recent_count} destructive actions within {_CLI_ANOMALY_WINDOW_MIN} min"

    await db.cli_lockouts.insert_one({
        "username": admin["username"], "locked_at": now, "locked_until": locked_until,
        "reason": reason, "lockout_minutes": lockout_minutes,
    })
    await log_action(
        "cli_security",
        f"[CLI SECURITY] '{admin['username']}' auto-locked out of the CLI for {lockout_minutes} min — {reason}",
        user=admin["username"],
    )

    others = await db.users.find({"role": "super_admin", "username": {"$ne": admin["username"]}}).to_list(50)
    for o in others:
        await _create_notification(
            user_id=str(o["_id"]),
            message=f"⚠️ CLI security lock: '{admin['username']}' was auto-locked out for {lockout_minutes} min "
                    f"after {reason}. Review the logs if this wasn't expected.",
            notif_type="cli_security",
        )
    return f"⚠ Anomaly detected ({reason}) — your CLI access is locked for {lockout_minutes} minute(s)."

async def _cli_dispatch(tokens: List[str], confirm: bool, admin: dict):
    """Returns (lines, needs_confirm, destructive). Raises _CliError with a user-facing message on bad input."""
    if not tokens:
        raise _CliError("Empty command. Type 'help' for the command list.")
    verb = tokens[0].lower()

    if verb == "help":
        return _CLI_HELP_TEXT, False, False

    if verb == "stats" and len(tokens) == 1:
        users_count = await db.users.count_documents({})
        projects_count = await db.projects.count_documents({})
        open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
        open_missions = await db.missions.count_documents({"status": "open"})
        return [
            "Platform stats:",
            f"  users:         {users_count}",
            f"  projects:      {projects_count}",
            f"  open tickets:  {open_tickets}",
            f"  open missions: {open_missions}",
        ], False, False

    if verb == "history":
        show_all = len(tokens) >= 2 and tokens[1].lower() == "all"
        n_idx = 2 if show_all else 1
        n = 20
        if len(tokens) > n_idx:
            try: n = max(1, min(100, int(tokens[n_idx])))
            except ValueError: pass
        q = {"type": "cli"} if show_all else {"type": "cli", "user": admin["username"]}
        docs = await db.logs.find(q).sort("timestamp", -1).to_list(n)
        if not docs:
            return ["No CLI history found."], False, False
        lines = [f"Last {len(docs)} CLI command(s)" + (" (all admins)" if show_all else "") + ":"]
        for d in reversed(docs):
            ts = d["timestamp"].strftime("%Y-%m-%d %H:%M") if isinstance(d.get("timestamp"), datetime) else ""
            lines.append(f"  [{ts}] {d.get('user','?')}: {d.get('message','')}")
        return lines, False, False

    if verb == "maintenance" and len(tokens) == 2 and tokens[1].lower() in ("on", "off"):
        want_on = tokens[1].lower() == "on"
        if not confirm:
            return [f"{'Enable' if want_on else 'Disable'} site-wide maintenance mode?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_settings.update_one({}, {"$set": {"maintenance_mode": want_on}}, upsert=True)
        await log_action("website", f"[CLI] Maintenance mode {'enabled' if want_on else 'disabled'}", user=admin["username"])
        return [f"OK — maintenance mode {'enabled' if want_on else 'disabled'}."], False, True

    if verb == "broadcast" and len(tokens) >= 2:
        message = " ".join(tokens[1:])
        if not confirm:
            return [f"Send this notification to ALL users: \"{message}\"?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False
        all_users = await db.users.find({}, {"_id": 1}).to_list(100000)
        if all_users:
            now = datetime.now(timezone.utc)
            await db.notifications.insert_many([
                {"userId": u["_id"], "message": message, "type": "broadcast", "link": "", "read": False, "createdAt": now}
                for u in all_users
            ])
        await log_action("cli_security", f"[CLI] Broadcast sent to {len(all_users)} users: {message}", user=admin["username"])
        return [f"OK — broadcast sent to {len(all_users)} user(s)."], False, True

    if verb == "user" and len(tokens) >= 2 and tokens[1].lower() == "list":
        role_filter = tokens[2].lower() if len(tokens) > 2 else None
        if role_filter and role_filter not in ("user", "admin", "super_admin"):
            raise _CliError("Role must be one of: user, admin, super_admin")
        q = {"role": role_filter} if role_filter else {}
        docs = await db.users.find(q).sort("createdAt", -1).to_list(30)
        if not docs:
            return ["No users found."], False, False
        lines = [f"{len(docs)} user(s)" + (f" with role '{role_filter}'" if role_filter else "") + " (most recent 30):"]
        for u in docs:
            flag = "  SUSPENDED" if u.get("isSuspended") else ""
            lines.append(f"  {u.get('username','?'):<20} {u.get('email',''):<30} [{u.get('role','user')}]{flag}")
        return lines, False, False

    if verb == "user" and len(tokens) >= 3:
        sub, query = tokens[1].lower(), tokens[2]
        target = await _cli_find_user_doc(query)
        if not target:
            raise _CliError(f"No user found matching '{query}'.")

        if sub == "find":
            return _cli_user_summary(target), False, False

        if sub in ("suspend", "unsuspend"):
            want_suspended = sub == "suspend"
            if target.get("role") == "super_admin":
                raise _CliError("Cannot suspend a super admin account.")
            if str(target["_id"]) == admin["id"]:
                raise _CliError("Cannot suspend your own account.")
            if not confirm:
                action = "Suspend" if want_suspended else "Reactivate"
                return [f"{action} account '{target.get('username')}' ({target.get('email')})?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            await db.users.update_one({"_id": target["_id"]}, {"$set": {"isSuspended": want_suspended}})
            action = "suspended" if want_suspended else "reactivated"
            await log_action("user_action", f"[CLI] User '{target.get('username')}' {action}", user=admin["username"])
            return [f"OK — user '{target.get('username')}' {action}."], False, True

        if sub == "role":
            if len(tokens) < 4:
                raise _CliError("Usage: user role <email|username> <user|admin>")
            new_role = tokens[3].lower()
            if new_role not in ("user", "admin"):
                raise _CliError("Role must be 'user' or 'admin' — promoting to super_admin isn't supported via the CLI.")
            if target.get("role") == "super_admin":
                raise _CliError("Cannot change the role of a super admin account.")
            if str(target["_id"]) == admin["id"]:
                raise _CliError("Cannot change your own role.")
            if not confirm:
                return [f"Change role of '{target.get('username')}' to '{new_role}'?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            update = {"role": new_role}
            if new_role == "user":
                update["permissions"] = []
            await db.users.update_one({"_id": target["_id"]}, {"$set": update})
            await log_action("user_action", f"[CLI] User '{target.get('username')}' role changed to '{new_role}'", user=admin["username"])
            return [f"OK — '{target.get('username')}' is now role '{new_role}'."], False, True

        if sub == "reset-password":
            if not confirm:
                return [f"Generate a new temporary password for '{target.get('username')}'? They'll be forced to change it on next login.",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            temp_password = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(12))
            await db.users.update_one(
                {"_id": target["_id"]},
                {"$set": {"password_hash": hash_key(temp_password), "mustChangePassword": True}},
            )
            await log_action("user_action", f"[CLI] Password reset for '{target.get('username')}'", user=admin["username"])
            return [
                f"OK — temporary password for '{target.get('username')}':",
                f"  {temp_password}",
                "Shown only once — relay it securely. They'll be asked to change it on next login.",
            ], False, True

        if sub == "delete":
            if target.get("role") == "super_admin":
                raise _CliError("Cannot delete a super admin account.")
            if str(target["_id"]) == admin["id"]:
                raise _CliError("Cannot delete your own account.")
            if not confirm:
                return [f"PERMANENTLY delete account '{target.get('username')}' ({target.get('email')})? This cannot be undone.",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            await db.users.delete_one({"_id": target["_id"]})
            await log_action("user_action", f"[CLI] User '{target.get('username')}' ({target.get('email')}) permanently deleted", user=admin["username"])
            return [f"OK — account '{target.get('username')}' permanently deleted."], False, True

    if verb == "player" and len(tokens) >= 4:
        sub, project_slug, query = tokens[1].lower(), tokens[2], tokens[3]
        project = await db.projects.find_one({"slug": project_slug})
        if not project:
            raise _CliError(f"No project with slug '{project_slug}'.")
        target = await _cli_find_player_doc(project_slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{project_slug}'.")
        oid = target["_id"]

        if sub == "find":
            saves = await db.play_saves.find({"user_id": oid, "project_slug": project_slug}).to_list(None)
            ban = await db.play_bans.find_one({"user_id": oid, "project_slug": project_slug})
            nick = await db.play_nicknames.find_one({"user_id": oid, "project_slug": project_slug})
            lines = _cli_user_summary(target) + [
                f"nickname:  {nick['nickname'] if nick else '(none)'}",
                f"banned:    {ban is not None}",
                f"saves:     {', '.join(s['category'] for s in saves) if saves else '(none)'}",
            ]
            return lines, False, False

        if sub in ("ban", "unban"):
            want_banned = sub == "ban"
            if not confirm:
                action = "Ban" if want_banned else "Unban"
                return [f"{action} '{target.get('username')}' from project '{project_slug}'?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            if want_banned:
                await db.play_bans.update_one(
                    {"user_id": oid, "project_slug": project_slug},
                    {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": admin["username"]}},
                    upsert=True,
                )
            else:
                await db.play_bans.delete_one({"user_id": oid, "project_slug": project_slug})
            action = "banned" if want_banned else "unbanned"
            await log_action("player", f"[CLI] Player '{target.get('username')}' {action}",
                              project_slug=project_slug, user=admin["username"])
            return [f"OK — player '{target.get('username')}' {action} from '{project_slug}'."], False, True

        if sub == "revoke":
            if not confirm:
                return [f"Revoke all sessions for '{target.get('username')}' in project '{project_slug}'?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            await db.play_refresh_tokens.update_many({"user_id": oid}, {"$set": {"is_revoked": True}})
            await log_action("player", f"[CLI] Sessions revoked for player '{target.get('username')}'",
                              project_slug=project_slug, user=admin["username"])
            return [f"OK — all sessions revoked for '{target.get('username')}'."], False, True

        if sub == "mute":
            if len(tokens) < 5:
                raise _CliError("Usage: player mute <project_slug> <query> <minutes> [reason]")
            try:
                minutes = int(tokens[4])
            except ValueError:
                raise _CliError(f"'{tokens[4]}' is not a valid number of minutes.")
            if minutes <= 0:
                raise _CliError("Duration must be positive.")
            reason = " ".join(tokens[5:])
            if not confirm:
                return [f"Mute '{target.get('username')}' in '{project_slug}' for {minutes} minute(s)?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            muted_until = datetime.now(timezone.utc) + timedelta(minutes=minutes)
            await db.chat_mutes.update_one(
                {"user_id": oid, "project_slug": project_slug},
                {"$set": {"muted_until": muted_until, "muted_by": admin["username"], "reason": reason}},
                upsert=True,
            )
            await log_action("chat", f"[CLI] Player '{target.get('username')}' muted for {minutes} minutes",
                              project_slug=project_slug, user=admin["username"])
            return [f"OK — '{target.get('username')}' muted in '{project_slug}' until {muted_until.isoformat()}."], False, True

        if sub == "wipe-saves":
            if not confirm:
                return [f"PERMANENTLY wipe all save data for '{target.get('username')}' in '{project_slug}'? This cannot be undone.",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            result = await db.play_saves.delete_many({"user_id": oid, "project_slug": project_slug})
            await log_action("player", f"[CLI] Save data wiped for '{target.get('username')}' ({result.deleted_count} record(s))",
                              project_slug=project_slug, user=admin["username"])
            return [f"OK — {result.deleted_count} save record(s) wiped for '{target.get('username')}' in '{project_slug}'."], False, True

    if verb == "project" and len(tokens) >= 3 and tokens[1].lower() == "status":
        if len(tokens) < 4:
            raise _CliError("Usage: project status <project_slug> <open|closed|maintenance>")
        slug, new_status = tokens[2], tokens[3].lower()
        if new_status not in ("open", "closed", "maintenance"):
            raise _CliError("Status must be one of: open, closed, maintenance")
        project = await db.projects.find_one({"slug": slug})
        if not project:
            raise _CliError(f"No project with slug '{slug}'.")
        if not confirm:
            return [f"Set status of project '{slug}' to '{new_status}'?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.server_status.update_one(
            {"project_slug": slug},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc), "updated_by": admin["username"]}},
            upsert=True,
        )
        await log_action("status", f"[CLI] Project '{slug}' status set to '{new_status}'", project_slug=slug, user=admin["username"])
        return [f"OK — project '{slug}' status set to '{new_status}'."], False, True

    if verb == "project" and len(tokens) >= 3 and tokens[1].lower() == "stats":
        slug = tokens[2]
        project = await db.projects.find_one({"slug": slug})
        if not project:
            raise _CliError(f"No project with slug '{slug}'.")
        status_doc = await db.server_status.find_one({"project_slug": slug})
        open_missions = await db.missions.count_documents({"project_slug": slug, "status": "open"})
        in_progress = await db.missions.count_documents({"project_slug": slug, "status": "in_progress"})
        bans = await db.chat_bans.count_documents({"project_slug": slug})
        mutes = await db.chat_mutes.count_documents({"project_slug": slug})
        return [
            f"Project '{slug}':",
            f"  status:        {status_doc.get('status', 'open') if status_doc else 'open'}",
            f"  open missions: {open_missions}",
            f"  in progress:   {in_progress}",
            f"  chat bans:     {bans}",
            f"  chat mutes:    {mutes}",
        ], False, False

    if verb == "mission" and len(tokens) >= 3 and tokens[1].lower() == "list":
        slug = tokens[2]
        status_filter = tokens[3].lower() if len(tokens) > 3 else None
        if status_filter and status_filter not in ("open", "in_progress", "completed", "cancelled"):
            raise _CliError("Status must be one of: open, in_progress, completed, cancelled")
        q = {"project_slug": slug}
        if status_filter: q["status"] = status_filter
        docs = await db.missions.find(q).sort("created_at", -1).to_list(30)
        if not docs:
            return [f"No missions found for '{slug}'" + (f" with status '{status_filter}'" if status_filter else "") + "."], False, False
        lines = [f"Missions for '{slug}'" + (f" ({status_filter})" if status_filter else "") + f" — {len(docs)} shown:"]
        for m in docs:
            lines.append(f"  [{str(m['_id'])}] {m.get('title','')} — {m.get('status','open')} ({m.get('priority','medium')})")
        return lines, False, False

    if verb == "mission" and len(tokens) >= 4 and tokens[1].lower() == "cancel":
        slug, mission_id = tokens[2], tokens[3]
        try:
            oid = ObjectId(mission_id)
        except Exception:
            raise _CliError(f"'{mission_id}' is not a valid mission ID.")
        mission = await db.missions.find_one({"_id": oid, "project_slug": slug})
        if not mission:
            raise _CliError(f"No mission '{mission_id}' found in project '{slug}'.")
        if mission.get("status") == "cancelled":
            raise _CliError("This mission is already cancelled.")
        if not confirm:
            return [f"Cancel mission '{mission.get('title')}' in '{slug}'?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.missions.update_one({"_id": oid}, {"$set": {"status": "cancelled"}})
        await log_action("missions", f"[CLI] Mission '{mission.get('title')}' cancelled", project_slug=slug, user=admin["username"])
        return [f"OK — mission '{mission.get('title')}' cancelled."], False, True

    if verb == "loyalty" and len(tokens) >= 3:
        sub, email = tokens[1].lower(), tokens[2].lower().strip()
        target = await db.users.find_one({"email": email})
        if not target:
            raise _CliError(f"No user with email '{email}'.")
        points = await db.user_points.find_one({"email": email})
        total_cents = points.get("total_spent_cents", 0) if points else 0

        if sub == "show":
            return [
                f"email: {email}",
                f"tier:  {get_tier(total_cents)}",
                f"total: ${total_cents / 100:.2f}",
            ], False, False

        if sub == "adjust":
            if len(tokens) < 4:
                raise _CliError("Usage: loyalty adjust <email> <+amount|-amount> [reason]")
            try:
                adjust_dollars = float(tokens[3])
            except ValueError:
                raise _CliError(f"'{tokens[3]}' is not a valid amount.")
            if adjust_dollars == 0:
                raise _CliError("Adjustment cannot be zero.")
            reason = " ".join(tokens[4:])
            if not confirm:
                sign = "+" if adjust_dollars > 0 else ""
                return [f"Adjust loyalty for '{email}' by {sign}${adjust_dollars:.2f}"
                        + (f" (reason: {reason})" if reason else "") + "?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            adjust_cents = round(adjust_dollars * 100)
            new_total = max(0, total_cents + adjust_cents)
            new_tier = get_tier(new_total)
            await db.user_points.update_one(
                {"email": email},
                {"$set": {"total_spent_cents": new_total, "tier": new_tier, "updated_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
            reason_str = f" (reason: {reason})" if reason else ""
            await log_action("user_action",
                f"[CLI] Admin '{admin['username']}' adjusted loyalty for '{target.get('username', email)}': "
                f"${adjust_dollars:+.2f}{reason_str} -> {new_total}cts ({new_tier})",
                user=admin["username"])
            await _create_notification(
                user_id=str(target["_id"]),
                message=f"{'🏆' if adjust_cents > 0 else '📉'} Your loyalty balance was adjusted by ${abs(adjust_dollars):.2f}. Current tier: {new_tier.capitalize()}.",
                notif_type="loyalty_adjustment",
            )
            return [f"OK — new total ${new_total / 100:.2f} ({new_tier})."], False, True

    if verb == "purchases" and len(tokens) >= 3 and tokens[1].lower() == "show":
        email = tokens[2].lower().strip()
        target = await db.users.find_one({"email": email})
        if not target:
            raise _CliError(f"No user with email '{email}'.")
        games = await db.game_purchases.find({"email": email}).sort("purchased_at", -1).to_list(200)
        lines = [f"Full-game purchases for {email}:"]
        if games:
            for g in games:
                lines.append(f"  - {g.get('game_name', g.get('game_slug'))}  ${g.get('amount_paid_cents', 0)/100:.2f}  {g.get('purchased_at', '')}")
        else:
            lines.append("  (none)")
        return lines, False, False

    if verb == "coupon" and len(tokens) >= 4 and tokens[1].lower() == "create":
        email = tokens[2].lower().strip()
        try:
            discount_pct = int(tokens[3])
        except ValueError:
            raise _CliError(f"'{tokens[3]}' is not a valid integer discount percentage.")
        if not (1 <= discount_pct <= 100):
            raise _CliError("Discount percent must be between 1 and 100.")
        valid_days = 30
        if len(tokens) > 4:
            try: valid_days = max(1, int(tokens[4]))
            except ValueError: raise _CliError(f"'{tokens[4]}' is not a valid number of days.")
        target = await db.users.find_one({"email": email})
        if not target:
            raise _CliError(f"No user with email '{email}'.")
        if not confirm:
            return [f"Create a {discount_pct}% site-wide coupon for '{email}', valid {valid_days} days?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False
        code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        while await db.coupons.find_one({"code": code}):
            code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        now = datetime.now(timezone.utc)
        await db.coupons.insert_one({
            "code": code, "campaign_id": ObjectId(), "discount_pct": discount_pct,
            "valid_until": now + timedelta(days=valid_days), "scope": "all", "scope_id": None, "scope_name": None,
            "assigned_to_user_id": target["_id"], "assigned_to_email": email,
            "used": False, "used_at": None, "created_at": now, "created_by": admin["username"],
        })
        await log_action("shop", f"[CLI] Coupon '{code}' ({discount_pct}%) created for '{email}'", user=admin["username"])
        return [f"OK — coupon '{code}' created for '{email}' ({discount_pct}%, valid {valid_days} days)."], False, True

    if verb == "coupon" and len(tokens) >= 3 and tokens[1].lower() == "revoke":
        code = tokens[2].upper().strip()
        coupon = await db.coupons.find_one({"code": code})
        if not coupon:
            raise _CliError(f"No coupon with code '{code}'.")
        if coupon.get("used"):
            raise _CliError(f"Coupon '{code}' has already been used.")
        if not confirm:
            return [f"Revoke coupon '{code}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.coupons.update_one(
            {"code": code},
            {"$set": {"used": True, "used_at": datetime.now(timezone.utc), "revoked_by": admin["username"]}},
        )
        await log_action("shop", f"[CLI] Coupon '{code}' revoked", user=admin["username"])
        return [f"OK — coupon '{code}' revoked."], False, True

    if verb == "ticket" and len(tokens) >= 3 and tokens[1].lower() == "show":
        tn = tokens[2].upper()
        t = await db.support_tickets.find_one({"ticket_number": tn})
        if not t:
            raise _CliError(f"No ticket '{tn}'.")
        return [
            f"ticket:   {t['ticket_number']}",
            f"subject:  {t.get('subject','')}",
            f"status:   {t.get('status','open')}",
            f"priority: {t.get('priority','normal')}",
            f"from:     {t.get('user_email','')}",
            f"messages: {len(t.get('messages', []))}",
        ], False, False

    if verb == "ticket" and len(tokens) >= 3 and tokens[1].lower() == "close":
        tn = tokens[2].upper()
        t = await db.support_tickets.find_one({"ticket_number": tn})
        if not t:
            raise _CliError(f"No ticket '{tn}'.")
        if t.get("status") == "closed":
            raise _CliError(f"Ticket '{tn}' is already closed.")
        if not confirm:
            return [f"Close ticket '{tn}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.support_tickets.update_one(
            {"ticket_number": tn},
            {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc)}},
        )
        await log_action("support", f"[CLI] Ticket '{tn}' closed", user=admin["username"])
        return [f"OK — ticket '{tn}' closed."], False, True

    # ── Catalogue (games / applications / software) ─────────────────────────
    if verb == "game" and len(tokens) >= 2 and tokens[1].lower() == "list":
        type_filter = tokens[2].lower() if len(tokens) > 2 else None
        if type_filter and type_filter not in ("game", "application", "software"):
            raise _CliError("Type must be one of: game, application, software")
        q = {"product_type": type_filter} if type_filter else {}
        docs = await db.website_games.find(q).sort("created_at", -1).to_list(50)
        if not docs:
            return ["No catalogue entries found."], False, False
        lines = [f"{len(docs)} catalogue entr{'y' if len(docs) == 1 else 'ies'}" + (f" (type: {type_filter})" if type_filter else "") + ":"]
        for g in docs:
            price = f"${g.get('price_cents', 0)/100:.2f}" if g.get("price_cents") else "free"
            feat = "  FEATURED" if g.get("featured") else ""
            lines.append(f"  {g.get('slug','?'):<24} [{g.get('product_type','game')}] {g.get('status','published'):<12} {price}{feat}")
        return lines, False, False

    if verb == "game" and len(tokens) >= 3 and tokens[1].lower() == "show":
        slug = tokens[2]
        g = await db.website_games.find_one({"slug": slug})
        if not g:
            raise _CliError(f"No catalogue entry with slug '{slug}'.")
        return [
            f"name:     {g.get('name','')}",
            f"slug:     {g.get('slug','')}",
            f"type:     {g.get('product_type','game')}",
            f"status:   {g.get('status','published')}",
            f"price:    ${g.get('price_cents', 0)/100:.2f}",
            f"featured: {g.get('featured', False)}",
        ], False, False

    if verb == "game" and len(tokens) >= 3 and tokens[1].lower() in ("publish", "unpublish"):
        slug = tokens[2]
        g = await db.website_games.find_one({"slug": slug})
        if not g:
            raise _CliError(f"No catalogue entry with slug '{slug}'.")
        new_status = "published" if tokens[1].lower() == "publish" else "coming_soon"
        if not confirm:
            return [f"Set '{slug}' status to '{new_status}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_games.update_one({"slug": slug}, {"$set": {"status": new_status}})
        await log_action("website", f"[CLI] '{slug}' set to '{new_status}'", user=admin["username"])
        return [f"OK — '{slug}' is now '{new_status}'."], False, True

    if verb == "game" and len(tokens) >= 3 and tokens[1].lower() == "feature":
        slug = tokens[2]
        g = await db.website_games.find_one({"slug": slug})
        if not g:
            raise _CliError(f"No catalogue entry with slug '{slug}'.")
        if not confirm:
            return [f"Feature '{slug}' (unfeatures any other featured entry)?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_games.update_many({}, {"$set": {"featured": False}})
        await db.website_games.update_one({"slug": slug}, {"$set": {"featured": True}})
        await log_action("website", f"[CLI] '{slug}' set as featured", user=admin["username"])
        return [f"OK — '{slug}' is now featured."], False, True

    if verb == "game" and len(tokens) >= 4 and tokens[1].lower() == "price":
        slug = tokens[2]
        try:
            cents = int(tokens[3])
        except ValueError:
            raise _CliError(f"'{tokens[3]}' is not a valid integer price in cents.")
        if cents < 0:
            raise _CliError("Price cannot be negative.")
        g = await db.website_games.find_one({"slug": slug})
        if not g:
            raise _CliError(f"No catalogue entry with slug '{slug}'.")
        if not confirm:
            return [f"Set price of '{slug}' to ${cents/100:.2f}?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_games.update_one({"slug": slug}, {"$set": {"price_cents": cents}})
        await log_action("website", f"[CLI] '{slug}' price set to {cents}c", user=admin["username"])
        return [f"OK — '{slug}' price set to ${cents/100:.2f}."], False, True

    if verb == "game" and len(tokens) >= 3 and tokens[1].lower() == "delete":
        slug = tokens[2]
        g = await db.website_games.find_one({"slug": slug})
        if not g:
            raise _CliError(f"No catalogue entry with slug '{slug}'.")
        if not confirm:
            return [f"PERMANENTLY delete catalogue entry '{slug}'? This cannot be undone.", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_games.delete_one({"slug": slug})
        await log_action("website", f"[CLI] catalogue entry '{slug}' deleted", user=admin["username"])
        return [f"OK — '{slug}' permanently deleted."], False, True

    # ── Shop ─────────────────────────────────────────────────────────────────
    if verb == "shop" and len(tokens) >= 2 and tokens[1].lower() == "list":
        game_slug = tokens[2] if len(tokens) > 2 else None
        q = {"game_slug": game_slug} if game_slug else {}
        docs = await db.website_shop_products.find(q).sort("created_at", -1).to_list(50)
        if not docs:
            return ["No shop products found."], False, False
        lines = [f"{len(docs)} product(s)" + (f" for '{game_slug}'" if game_slug else "") + ":"]
        for p in docs:
            state = "active" if p.get("active") else "inactive"
            lines.append(f"  [{str(p['_id'])}] {p.get('name','?'):<24} ${p.get('price',0)/100:.2f}  {state}  ({p.get('game_slug','')})")
        return lines, False, False

    if verb == "shop" and len(tokens) >= 3 and tokens[1].lower() == "toggle":
        pid = tokens[2]
        try:
            oid = ObjectId(pid)
        except Exception:
            raise _CliError(f"'{pid}' is not a valid product ID.")
        p = await db.website_shop_products.find_one({"_id": oid})
        if not p:
            raise _CliError(f"No shop product '{pid}'.")
        new_active = not p.get("active", True)
        if not confirm:
            return [f"Set '{p.get('name')}' to {'active' if new_active else 'inactive'}?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_shop_products.update_one({"_id": oid}, {"$set": {"active": new_active}})
        await log_action("shop", f"[CLI] Product '{p.get('name')}' set {'active' if new_active else 'inactive'}", user=admin["username"])
        return [f"OK — '{p.get('name')}' is now {'active' if new_active else 'inactive'}."], False, True

    if verb == "shop" and len(tokens) >= 4 and tokens[1].lower() == "badge":
        pid, badge = tokens[2], tokens[3].upper()
        try:
            oid = ObjectId(pid)
        except Exception:
            raise _CliError(f"'{pid}' is not a valid product ID.")
        p = await db.website_shop_products.find_one({"_id": oid})
        if not p:
            raise _CliError(f"No shop product '{pid}'.")
        if not confirm:
            return [f"Set badge of '{p.get('name')}' to '{badge}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_shop_products.update_one({"_id": oid}, {"$set": {"badge": badge}})
        await log_action("shop", f"[CLI] Badge of '{p.get('name')}' set to '{badge}'", user=admin["username"])
        return [f"OK — badge of '{p.get('name')}' set to '{badge}'."], False, True

    # ── Coupons: list + campaigns (create/create existing single-coupon flow already above) ──
    if verb == "coupon" and len(tokens) >= 2 and tokens[1].lower() == "list":
        email = tokens[2].lower().strip() if len(tokens) > 2 else None
        q = {"assigned_to_email": email} if email else {}
        docs = await db.coupons.find(q).sort("created_at", -1).to_list(50)
        if not docs:
            return ["No coupons found."], False, False
        lines = [f"{len(docs)} coupon(s)" + (f" for '{email}'" if email else "") + ":"]
        for c in docs:
            state = "used" if c.get("used") else "active"
            lines.append(f"  {c.get('code','?'):<14} {c.get('discount_pct',0)}%  {state}  {c.get('assigned_to_email','')}")
        return lines, False, False

    if verb == "coupon" and len(tokens) >= 3 and tokens[1].lower() == "campaign" and tokens[2].lower() == "create":
        if len(tokens) < 6:
            raise _CliError("Usage: coupon campaign create <name> <discount_pct> <bronze|silver|gold|diamond|all> [valid_days=30]")
        name = tokens[3]
        try:
            discount_pct = int(tokens[4])
        except ValueError:
            raise _CliError(f"'{tokens[4]}' is not a valid integer discount percentage.")
        if not (1 <= discount_pct <= 99):
            raise _CliError("Discount percent must be between 1 and 99.")
        tier_arg = tokens[5].lower()
        valid_tiers = ("bronze", "silver", "gold", "diamond")
        if tier_arg not in valid_tiers and tier_arg != "all":
            raise _CliError("Target must be one of: bronze, silver, gold, diamond, all")
        target_tiers = list(valid_tiers) if tier_arg == "all" else [tier_arg]
        valid_days = 30
        if len(tokens) > 6:
            try: valid_days = max(1, int(tokens[6]))
            except ValueError: raise _CliError(f"'{tokens[6]}' is not a valid number of days.")

        all_points = await db.user_points.find({}).to_list(10000)
        target_emails = [p["email"] for p in all_points if get_tier(p.get("total_spent_cents", 0)) in target_tiers]
        target_users = await db.users.find({"email": {"$in": target_emails}}).to_list(10000)
        if not target_users:
            raise _CliError(f"No users found in tier(s): {', '.join(target_tiers)}.")
        if not confirm:
            return [f"Create a {discount_pct}% campaign '{name}' for {len(target_users)} user(s) in tier(s) {', '.join(target_tiers)}, valid {valid_days} days?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False

        valid_until = datetime.now(timezone.utc) + timedelta(days=valid_days)
        campaign_id = ObjectId()
        now = datetime.now(timezone.utc)
        codes_sent = 0
        for u in target_users:
            code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
            while await db.coupons.find_one({"code": code}):
                code = "VG-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
            await db.coupons.insert_one({
                "code": code, "campaign_id": campaign_id, "discount_pct": discount_pct,
                "valid_until": valid_until, "scope": "all", "scope_id": None, "scope_name": None,
                "assigned_to_user_id": u["_id"], "assigned_to_email": u["email"],
                "used": False, "used_at": None, "created_at": now, "created_by": admin["username"],
            })
            await _create_notification(
                user_id=str(u["_id"]),
                message=f"🎁 You received a promo code: {code} — {discount_pct}% off. Valid until {valid_until.strftime('%Y-%m-%d')}.",
                notif_type="coupon", link="/shop",
            )
            codes_sent += 1
        await db.coupon_campaigns.insert_one({
            "_id": campaign_id, "name": name, "target_type": "tier", "target_tiers": target_tiers,
            "discount_pct": discount_pct, "valid_days": valid_days, "valid_until": valid_until,
            "scope": "all", "scope_id": None, "scope_name": None,
            "codes_count": codes_sent, "created_by": admin["username"], "created_at": now,
        })
        await log_action("website", f"[CLI] Coupon campaign '{name}' created: {codes_sent} codes sent", user=admin["username"])
        return [f"OK — campaign '{name}' created, {codes_sent} code(s) sent."], False, True

    if verb == "coupon" and len(tokens) >= 4 and tokens[1].lower() == "campaign" and tokens[2].lower() == "show":
        try:
            oid = ObjectId(tokens[3])
        except Exception:
            raise _CliError(f"'{tokens[3]}' is not a valid campaign ID.")
        c = await db.coupon_campaigns.find_one({"_id": oid})
        if not c:
            raise _CliError(f"No campaign '{tokens[3]}'.")
        used = await db.coupons.count_documents({"campaign_id": oid, "used": True})
        return [
            f"name:        {c.get('name','')}",
            f"discount:    {c.get('discount_pct',0)}%",
            f"target:      {c.get('target_type','')} {c.get('target_tiers', [])}",
            f"codes sent:  {c.get('codes_count',0)}",
            f"codes used:  {used}",
            f"valid until: {c.get('valid_until','')}",
        ], False, False

    # ── Chat & moderation ────────────────────────────────────────────────────
    if verb == "chat" and len(tokens) >= 4 and tokens[1].lower() == "ban":
        slug, query = tokens[2], tokens[3]
        project = await db.projects.find_one({"slug": slug})
        if not project:
            raise _CliError(f"No project with slug '{slug}'.")
        target = await _cli_find_player_doc(slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{slug}'.")
        reason = " ".join(tokens[4:])
        if not confirm:
            return [f"Chat-ban '{target.get('username')}' in '{slug}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.chat_bans.update_one(
            {"user_id": target["_id"], "project_slug": slug},
            {"$set": {"banned_at": datetime.now(timezone.utc), "banned_by": admin["username"], "reason": reason}},
            upsert=True,
        )
        await log_action("chat", f"[CLI] Player '{target.get('username')}' chat-banned", project_slug=slug, user=admin["username"])
        return [f"OK — '{target.get('username')}' chat-banned in '{slug}'."], False, True

    if verb == "chat" and len(tokens) >= 4 and tokens[1].lower() == "unban":
        slug, query = tokens[2], tokens[3]
        target = await _cli_find_player_doc(slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{slug}'.")
        if not confirm:
            return [f"Remove chat ban for '{target.get('username')}' in '{slug}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.chat_bans.delete_one({"user_id": target["_id"], "project_slug": slug})
        await log_action("chat", f"[CLI] Chat ban removed for '{target.get('username')}'", project_slug=slug, user=admin["username"])
        return [f"OK — chat ban removed for '{target.get('username')}' in '{slug}'."], False, True

    if verb == "chat" and len(tokens) >= 4 and tokens[1].lower() == "unmute":
        slug, query = tokens[2], tokens[3]
        target = await _cli_find_player_doc(slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{slug}'.")
        if not confirm:
            return [f"Unmute '{target.get('username')}' in '{slug}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.chat_mutes.delete_one({"user_id": target["_id"], "project_slug": slug})
        await log_action("chat", f"[CLI] Player '{target.get('username')}' unmuted", project_slug=slug, user=admin["username"])
        return [f"OK — '{target.get('username')}' unmuted in '{slug}'."], False, True

    if verb == "chat" and len(tokens) >= 3 and tokens[1].lower() == "wordlist" and tokens[2].lower() in ("add", "remove"):
        if len(tokens) < 4:
            raise _CliError("Usage: chat wordlist add|remove <word>")
        action = tokens[2].lower()
        word = tokens[3].strip().lower()
        doc = await db.chat_settings.find_one({"key": "banned_words"})
        words = doc.get("words", []) if doc else []
        lowered = [w.lower() for w in words]
        if action == "add" and word in lowered:
            raise _CliError(f"'{word}' is already in the banned-words list.")
        if action == "remove" and word not in lowered:
            raise _CliError(f"'{word}' is not in the banned-words list.")
        if not confirm:
            return [f"{'Add' if action == 'add' else 'Remove'} '{word}' {'to' if action == 'add' else 'from'} the banned-words list?",
                    "Type 'y' to confirm, or anything else to cancel."], True, False
        if action == "add":
            words.append(word)
        else:
            words = [w for w in words if w.lower() != word]
        await db.chat_settings.update_one({"key": "banned_words"}, {"$set": {"words": words}}, upsert=True)
        await log_action("chat", f"[CLI] Banned word '{word}' {'added' if action == 'add' else 'removed'}", user=admin["username"])
        return [f"OK — '{word}' {'added to' if action == 'add' else 'removed from'} the banned-words list."], False, True

    if verb == "chat" and len(tokens) >= 3 and tokens[1].lower() == "purge":
        slug = tokens[2]
        n = 50
        if len(tokens) > 3:
            try: n = max(1, min(500, int(tokens[3])))
            except ValueError: raise _CliError(f"'{tokens[3]}' is not a valid number.")
        if not confirm:
            return [f"Delete the last {n} chat message(s) in '{slug}'? This cannot be undone.", "Type 'y' to confirm, or anything else to cancel."], True, False
        recent = await db.chat_messages.find({"project_slug": slug}).sort("timestamp", -1).limit(n).to_list(n)
        if recent:
            await db.chat_messages.delete_many({"_id": {"$in": [m["_id"] for m in recent]}})
        await log_action("chat", f"[CLI] Purged {len(recent)} chat message(s)", project_slug=slug, user=admin["username"])
        return [f"OK — {len(recent)} message(s) purged from '{slug}'."], False, True

    if verb == "chat" and len(tokens) >= 3 and tokens[1].lower() == "recent":
        slug = tokens[2]
        n = 20
        if len(tokens) > 3:
            try: n = max(1, min(100, int(tokens[3])))
            except ValueError: raise _CliError(f"'{tokens[3]}' is not a valid number.")
        docs = await db.chat_messages.find({"project_slug": slug}).sort("timestamp", -1).to_list(n)
        if not docs:
            return [f"No chat messages found for '{slug}'."], False, False
        lines = [f"Last {len(docs)} message(s) in '{slug}':"]
        for m in reversed(docs):
            ts = m["timestamp"].strftime("%H:%M:%S") if isinstance(m.get("timestamp"), datetime) else ""
            lines.append(f"  [{ts}] {m.get('username','?')}: {m.get('message', m.get('content',''))}")
        return lines, False, False

    # ── Guilds ───────────────────────────────────────────────────────────────
    if verb == "guild" and len(tokens) >= 3 and tokens[1].lower() == "list":
        slug = tokens[2]
        docs = await db.guilds.find({"project_slug": slug}).sort("name", 1).to_list(50)
        if not docs:
            return [f"No guilds found for '{slug}'."], False, False
        lines = [f"{len(docs)} guild(s) in '{slug}':"]
        for g in docs:
            count = await db.guild_members.count_documents({"guild_id": g["_id"]})
            lines.append(f"  [{str(g['_id'])}] {g.get('name','?')} — {count} member(s)")
        return lines, False, False

    if verb == "guild" and len(tokens) >= 3 and tokens[1].lower() == "show":
        try:
            oid = ObjectId(tokens[2])
        except Exception:
            raise _CliError(f"'{tokens[2]}' is not a valid guild ID.")
        g = await db.guilds.find_one({"_id": oid})
        if not g:
            raise _CliError(f"No guild '{tokens[2]}'.")
        members = await db.guild_members.find({"guild_id": oid}).to_list(200)
        lines = [f"name:    {g.get('name','')}", f"project: {g.get('project_slug','')}", f"members: {len(members)}"]
        for m in members:
            u = await db.users.find_one({"_id": m["user_id"]})
            lines.append(f"  - {u.get('username','?') if u else '?'} ({m.get('role','member')})")
        return lines, False, False

    if verb == "guild" and len(tokens) >= 3 and tokens[1].lower() == "disband":
        try:
            oid = ObjectId(tokens[2])
        except Exception:
            raise _CliError(f"'{tokens[2]}' is not a valid guild ID.")
        g = await db.guilds.find_one({"_id": oid})
        if not g:
            raise _CliError(f"No guild '{tokens[2]}'.")
        if not confirm:
            return [f"PERMANENTLY disband guild '{g.get('name')}'? This cannot be undone.", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.guild_members.delete_many({"guild_id": oid})
        await db.guilds.delete_one({"_id": oid})
        await log_action("chat", f"[CLI] Guild '{g.get('name')}' disbanded", project_slug=g.get("project_slug"), user=admin["username"])
        return [f"OK — guild '{g.get('name')}' disbanded."], False, True

    if verb == "guild" and len(tokens) >= 4 and tokens[1].lower() == "kick":
        try:
            oid = ObjectId(tokens[2])
        except Exception:
            raise _CliError(f"'{tokens[2]}' is not a valid guild ID.")
        g = await db.guilds.find_one({"_id": oid})
        if not g:
            raise _CliError(f"No guild '{tokens[2]}'.")
        target = await _cli_find_user_doc(tokens[3])
        if not target:
            raise _CliError(f"No user found matching '{tokens[3]}'.")
        member = await db.guild_members.find_one({"guild_id": oid, "user_id": target["_id"]})
        if not member:
            raise _CliError(f"'{target.get('username')}' is not a member of '{g.get('name')}'.")
        if not confirm:
            return [f"Kick '{target.get('username')}' from '{g.get('name')}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.guild_members.delete_one({"_id": member["_id"]})
        await log_action("chat", f"[CLI] '{target.get('username')}' kicked from guild '{g.get('name')}'", project_slug=g.get("project_slug"), user=admin["username"])
        return [f"OK — '{target.get('username')}' kicked from '{g.get('name')}'."], False, True

    # ── Blog ─────────────────────────────────────────────────────────────────
    if verb == "blog" and len(tokens) >= 2 and tokens[1].lower() == "list":
        status_filter = tokens[2].lower() if len(tokens) > 2 else None
        q = {}
        if status_filter == "published": q["published"] = True
        elif status_filter == "draft": q["published"] = False
        docs = await db.blog_posts.find(q).sort("created_at", -1).to_list(50)
        if not docs:
            return ["No blog posts found."], False, False
        lines = [f"{len(docs)} post(s):"]
        for p in docs:
            lines.append(f"  {p.get('slug','?'):<30} {'published' if p.get('published') else 'draft':<10} {p.get('title','')}")
        return lines, False, False

    if verb == "blog" and len(tokens) >= 3 and tokens[1].lower() in ("publish", "unpublish"):
        slug = tokens[2]
        p = await db.blog_posts.find_one({"slug": slug})
        if not p:
            raise _CliError(f"No blog post '{slug}'.")
        want_published = tokens[1].lower() == "publish"
        if not confirm:
            return [f"{'Publish' if want_published else 'Unpublish'} '{slug}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.blog_posts.update_one({"slug": slug}, {"$set": {"published": want_published}})
        await log_action("website", f"[CLI] Blog post '{slug}' {'published' if want_published else 'unpublished'}", user=admin["username"])
        return [f"OK — '{slug}' is now {'published' if want_published else 'a draft'}."], False, True

    if verb == "blog" and len(tokens) >= 3 and tokens[1].lower() == "delete":
        slug = tokens[2]
        p = await db.blog_posts.find_one({"slug": slug})
        if not p:
            raise _CliError(f"No blog post '{slug}'.")
        if not confirm:
            return [f"PERMANENTLY delete blog post '{slug}'? This cannot be undone.", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.blog_posts.delete_one({"slug": slug})
        await log_action("website", f"[CLI] Blog post '{slug}' deleted", user=admin["username"])
        return [f"OK — '{slug}' permanently deleted."], False, True

    # ── Careers ──────────────────────────────────────────────────────────────
    if verb == "career" and len(tokens) >= 2 and tokens[1].lower() == "list":
        state_filter = tokens[2].lower() if len(tokens) > 2 else None
        q = {}
        if state_filter == "open": q["is_open"] = True
        elif state_filter == "closed": q["is_open"] = False
        docs = await db.careers.find(q).sort("created_at", -1).to_list(50)
        if not docs:
            return ["No career postings found."], False, False
        lines = [f"{len(docs)} posting(s):"]
        for c in docs:
            lines.append(f"  [{str(c['_id'])}] {c.get('title','?'):<30} {'open' if c.get('is_open') else 'closed'}")
        return lines, False, False

    if verb == "career" and len(tokens) >= 3 and tokens[1].lower() in ("open", "close"):
        try:
            oid = ObjectId(tokens[2])
        except Exception:
            raise _CliError(f"'{tokens[2]}' is not a valid career ID.")
        c = await db.careers.find_one({"_id": oid})
        if not c:
            raise _CliError(f"No career posting '{tokens[2]}'.")
        want_open = tokens[1].lower() == "open"
        if not confirm:
            return [f"{'Open' if want_open else 'Close'} posting '{c.get('title')}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.careers.update_one({"_id": oid}, {"$set": {"is_open": want_open, "updated_at": datetime.now(timezone.utc)}})
        await log_action("careers", f"[CLI] Posting '{c.get('title')}' {'opened' if want_open else 'closed'}", user=admin["username"])
        return [f"OK — '{c.get('title')}' is now {'open' if want_open else 'closed'}."], False, True

    # ── Variables & items ────────────────────────────────────────────────────
    if verb == "var" and len(tokens) >= 4 and tokens[1].lower() == "get":
        slug, name = tokens[2], tokens[3]
        v = await db.variables.find_one({"project_slug": slug, "$or": [{"name": name}, {"variable_name": name}]})
        if not v:
            raise _CliError(f"No variable '{name}' found in project '{slug}'.")
        return [f"{name} = {v.get('value', '')}"], False, False

    if verb == "var" and len(tokens) >= 5 and tokens[1].lower() == "set":
        slug, name, value = tokens[2], tokens[3], " ".join(tokens[4:])
        v = await db.variables.find_one({"project_slug": slug, "$or": [{"name": name}, {"variable_name": name}]})
        if not v:
            raise _CliError(f"No variable '{name}' found in project '{slug}'.")
        if not confirm:
            return [f"Set variable '{name}' in '{slug}' to '{value}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.variables.update_one({"_id": v["_id"]}, {"$set": {"value": value}})
        await log_action("variable_action", f"[CLI] Variable '{name}' set to '{value}'", project_slug=slug, user=admin["username"], variable=name)
        return [f"OK — '{name}' set to '{value}' in '{slug}'."], False, True

    if verb == "item" and len(tokens) >= 3 and tokens[1].lower() == "list":
        slug = tokens[2]
        docs = await db.items.find({"project_slug": slug}).sort("_id", -1).to_list(50)
        if not docs:
            return [f"No item log entries found for '{slug}'."], False, False
        lines = [f"Last {len(docs)} item send(s) in '{slug}':"]
        for i in docs:
            lines.append(f"  {i.get('uid','?')}: {i.get('variable','?')} +{i.get('amount','')}")
        return lines, False, False

    if verb == "item" and len(tokens) >= 6 and tokens[1].lower() == "send":
        slug, query, item_name = tokens[2], tokens[3], tokens[4]
        try:
            amount = int(tokens[5])
        except ValueError:
            raise _CliError(f"'{tokens[5]}' is not a valid integer amount.")
        project = await db.projects.find_one({"slug": slug})
        if not project:
            raise _CliError(f"No project with slug '{slug}'.")
        if not confirm:
            return [f"Send {amount}x '{item_name}' to '{query}' in '{slug}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.items.insert_one({
            "project_slug": slug, "uid": query, "variable": item_name, "amount": amount,
            "created_at": datetime.now(timezone.utc), "created_by": admin["username"],
        })
        await log_action("send", f"[CLI] Sent {amount}x {item_name} to {query}", project_slug=slug, user=admin["username"],
                          uid=query, variable=item_name, amount=amount)
        return [f"OK — {amount}x '{item_name}' sent to '{query}' in '{slug}'."], False, True

    # ── Project ops (logs / files / keys) ───────────────────────────────────
    if verb == "project" and len(tokens) >= 3 and tokens[1].lower() == "logs":
        slug = tokens[2]
        n = 20
        if len(tokens) > 3:
            try: n = max(1, min(100, int(tokens[3])))
            except ValueError: pass
        docs = await db.logs.find({"project_slug": slug}).sort("timestamp", -1).to_list(n)
        if not docs:
            return [f"No logs found for '{slug}'."], False, False
        lines = [f"Last {len(docs)} log entr{'y' if len(docs) == 1 else 'ies'} for '{slug}':"]
        for d in reversed(docs):
            ts = d["timestamp"].strftime("%Y-%m-%d %H:%M") if isinstance(d.get("timestamp"), datetime) else ""
            lines.append(f"  [{ts}] [{d.get('type','?')}] {d.get('message','')}")
        return lines, False, False

    if verb == "project" and len(tokens) >= 3 and tokens[1].lower() == "files":
        slug = tokens[2]
        docs = await db.game_files.find({"project_slug": slug, "is_latest": True}).sort("uploaded_at", -1).to_list(50)
        if not docs:
            return [f"No files found for '{slug}'."], False, False
        lines = [f"{len(docs)} latest file(s) for '{slug}':"]
        for f in docs:
            size_mb = f.get("size_bytes", 0) / (1024 * 1024)
            lines.append(f"  {f.get('name','?'):<30} v{f.get('version_tag','')}  {size_mb:.1f} MB  {f.get('download_count',0)} downloads")
        return lines, False, False

    if verb == "project" and len(tokens) >= 3 and tokens[1].lower() == "keys":
        slug = tokens[2]
        project = await db.projects.find_one({"slug": slug})
        if not project:
            raise _CliError(f"No project with slug '{slug}'.")
        return [
            f"chat_api_key:  {project.get('chat_api_key') or '(not set)'}",
            f"files_api_key: {project.get('files_api_key') or '(not set)'}",
        ], False, False

    # ── Tickets: list / reply (show / close already above) ─────────────────
    if verb == "ticket" and len(tokens) >= 2 and tokens[1].lower() == "list":
        status_filter = tokens[2].lower() if len(tokens) > 2 else None
        if status_filter and status_filter not in ("open", "in_progress", "resolved", "closed"):
            raise _CliError("Status must be one of: open, in_progress, resolved, closed")
        q = {"status": status_filter} if status_filter else {}
        docs = await db.support_tickets.find(q).sort("created_at", -1).to_list(30)
        if not docs:
            return ["No tickets found."], False, False
        lines = [f"{len(docs)} ticket(s)" + (f" ({status_filter})" if status_filter else "") + ":"]
        for t in docs:
            lines.append(f"  {t.get('ticket_number','?'):<12} {t.get('status','open'):<12} {t.get('subject','')}")
        return lines, False, False

    if verb == "ticket" and len(tokens) >= 4 and tokens[1].lower() == "reply":
        tn = tokens[2].upper()
        message = " ".join(tokens[3:])
        t = await db.support_tickets.find_one({"ticket_number": tn})
        if not t:
            raise _CliError(f"No ticket '{tn}'.")
        if t.get("status") == "closed":
            raise _CliError(f"Ticket '{tn}' is closed.")
        if not confirm:
            return [f"Reply to ticket '{tn}' as support: \"{message}\"?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.support_tickets.update_one(
            {"ticket_number": tn},
            {"$push": {"messages": {"sender": "support", "author_name": admin["username"], "content": message, "timestamp": datetime.now(timezone.utc)}},
             "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        await log_action("support", f"[CLI] Replied to ticket '{tn}'", user=admin["username"])
        return [f"OK — reply sent on ticket '{tn}'."], False, True

    # ── Notifications ────────────────────────────────────────────────────────
    if verb == "notify" and len(tokens) >= 4 and tokens[1].lower() == "user":
        query = tokens[2]
        message = " ".join(tokens[3:])
        target = await _cli_find_user_doc(query)
        if not target:
            raise _CliError(f"No user found matching '{query}'.")
        if not confirm:
            return [f"Send notification to '{target.get('username')}': \"{message}\"?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await _create_notification(user_id=str(target["_id"]), message=message, notif_type="cli_message")
        await log_action("user_action", f"[CLI] Notification sent to '{target.get('username')}'", user=admin["username"])
        return [f"OK — notification sent to '{target.get('username')}'."], False, True

    if verb == "notify" and len(tokens) >= 3 and tokens[1].lower() == "list":
        query = tokens[2]
        target = await _cli_find_user_doc(query)
        if not target:
            raise _CliError(f"No user found matching '{query}'.")
        docs = await db.notifications.find({"userId": target["_id"]}).sort("createdAt", -1).to_list(15)
        if not docs:
            return [f"No notifications found for '{target.get('username')}'."], False, False
        lines = [f"Last {len(docs)} notification(s) for '{target.get('username')}':"]
        for n in docs:
            read = "read" if n.get("read") else "unread"
            lines.append(f"  [{read}] {n.get('message','')}")
        return lines, False, False

    # ── Logs & audit (beyond CLI's own history) ─────────────────────────────
    if verb == "logs" and len(tokens) >= 2 and tokens[1].lower() == "recent":
        type_filter = tokens[2] if len(tokens) > 2 else None
        n = 20
        if len(tokens) > 3:
            try: n = max(1, min(100, int(tokens[3])))
            except ValueError: pass
        q = {"type": type_filter} if type_filter else {}
        docs = await db.logs.find(q).sort("timestamp", -1).to_list(n)
        if not docs:
            return ["No log entries found."], False, False
        lines = [f"Last {len(docs)} log entr{'y' if len(docs) == 1 else 'ies'}" + (f" (type: {type_filter})" if type_filter else "") + ":"]
        for d in reversed(docs):
            ts = d["timestamp"].strftime("%Y-%m-%d %H:%M") if isinstance(d.get("timestamp"), datetime) else ""
            lines.append(f"  [{ts}] [{d.get('type','?')}] {d.get('message','')}")
        return lines, False, False

    if verb == "logs" and len(tokens) >= 3 and tokens[1].lower() == "search":
        keyword = " ".join(tokens[2:])
        docs = await db.logs.find({"message": {"$regex": re.escape(keyword), "$options": "i"}}).sort("timestamp", -1).to_list(30)
        if not docs:
            return [f"No log entries matching '{keyword}'."], False, False
        lines = [f"{len(docs)} log entr{'y' if len(docs) == 1 else 'ies'} matching '{keyword}':"]
        for d in reversed(docs):
            ts = d["timestamp"].strftime("%Y-%m-%d %H:%M") if isinstance(d.get("timestamp"), datetime) else ""
            lines.append(f"  [{ts}] [{d.get('type','?')}] {d.get('message','')}")
        return lines, False, False

    # ── Settings ─────────────────────────────────────────────────────────────
    if verb == "settings" and (len(tokens) == 1 or (len(tokens) >= 2 and tokens[1].lower() == "show")):
        doc = await db.website_settings.find_one({}, {"_id": 0})
        if not doc:
            return ["No website settings configured yet."], False, False
        return ["Website settings:"] + [f"  {k}: {v}" for k, v in doc.items()], False, False

    if verb == "settings" and len(tokens) >= 4 and tokens[1].lower() == "set":
        key = tokens[2]
        value = " ".join(tokens[3:])
        if key != "support_email":
            raise _CliError("Settable keys via CLI: support_email. Use 'maintenance on|off' for maintenance_mode.")
        if not confirm:
            return [f"Set website setting '{key}' to '{value}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_settings.update_one({}, {"$set": {key: value}}, upsert=True)
        await log_action("website", f"[CLI] Setting '{key}' set to '{value}'", user=admin["username"])
        return [f"OK — '{key}' set to '{value}'."], False, True

    # ── Accounts: pseudo / cooldown (mirrors auth.py & users.py admin logic) ──
    if verb == "user" and len(tokens) >= 4 and tokens[1].lower() == "set-pseudo":
        query, new_pseudo = tokens[2], tokens[3]
        target = await _cli_find_user_doc(query)
        if not target:
            raise _CliError(f"No user found matching '{query}'.")
        if not re.match(PSEUDO_REGEX, new_pseudo):
            raise _CliError("Pseudo must be 5-14 characters (letters, numbers, underscores only).")
        if await db.users.find_one({"username": new_pseudo, "_id": {"$ne": target["_id"]}}):
            raise _CliError(f"Pseudo '{new_pseudo}' is already taken.")
        if contains_banned_word(new_pseudo, await get_banned_words()):
            raise _CliError(f"Pseudo '{new_pseudo}' isn't allowed.")
        if not confirm:
            return [f"Set pseudo of '{target.get('username')}' to '{new_pseudo}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.users.update_one(
            {"_id": target["_id"]},
            {"$set": {"username": new_pseudo, "usernameChangedAt": datetime.now(timezone.utc), "pseudo_set": True}},
        )
        await log_action("user_action", f"[CLI] Pseudo of '{target.get('username')}' set to '{new_pseudo}'", user=admin["username"])
        return [f"OK — pseudo set to '{new_pseudo}'."], False, True

    if verb == "user" and len(tokens) >= 4 and tokens[1].lower() == "reset-cooldown":
        query, field = tokens[2], tokens[3].lower()
        if field not in ("firstname", "pseudo"):
            raise _CliError("Usage: user reset-cooldown <query> <firstname|pseudo>")
        target = await _cli_find_user_doc(query)
        if not target:
            raise _CliError(f"No user found matching '{query}'.")
        field_key = "firstNameChangedAt" if field == "firstname" else "usernameChangedAt"
        if not confirm:
            return [f"Reset {field} cooldown for '{target.get('username')}'?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.users.update_one({"_id": target["_id"]}, {"$set": {field_key: None}})
        await log_action("user_action", f"[CLI] {field} cooldown reset for '{target.get('username')}'", user=admin["username"])
        return [f"OK — {field} cooldown reset for '{target.get('username')}'."], False, True

    # ── Players: extra lookups ───────────────────────────────────────────────
    if verb == "player" and len(tokens) >= 4 and tokens[1].lower() == "nickname":
        slug, query = tokens[2], tokens[3]
        target = await _cli_find_player_doc(slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{slug}'.")
        nick = await db.play_nicknames.find_one({"user_id": target["_id"], "project_slug": slug})
        return [f"nickname: {nick['nickname'] if nick else '(none set)'}"], False, False

    if verb == "player" and len(tokens) >= 4 and tokens[1].lower() == "firstseen":
        slug, query = tokens[2], tokens[3]
        target = await _cli_find_player_doc(slug, query)
        if not target:
            raise _CliError(f"No player found matching '{query}' in project '{slug}'.")
        doc = await db.play_first_seen.find_one({"user_id": target["_id"], "project_slug": slug})
        if not doc:
            return ["No first-seen record found."], False, False
        ts = doc.get("first_seen_at") or doc.get("created_at")
        return [f"first seen: {ts.isoformat() if isinstance(ts, datetime) else ts}"], False, False

    raise _CliError(f"Unknown command '{' '.join(tokens)}'. Type 'help' for the command list.")

@router.get("/admin/cli/commands")
async def cli_commands(admin=Depends(require_super_admin)):
    """Read-only catalog of every CLI command — powers frontend autocomplete
    and the '$command' popup form generator. Never executes anything."""
    return {"commands": _CLI_CATALOG}

@router.post("/admin/cli/execute")
@limiter.limit("20/minute")
async def cli_execute(request: Request, body: CliExecuteRequest, admin=Depends(require_super_admin)):
    raw = body.command.strip()
    if not raw:
        raise HTTPException(400, "Empty command")
    if len(raw) > 500:
        raise HTTPException(400, "Command too long")
    try:
        tokens = shlex.split(raw)
    except ValueError:
        raise HTTPException(400, "Unmatched quotes in command")

    try:
        await _cli_check_lockout(admin["username"])
        lines, needs_confirm, destructive = await _cli_dispatch(tokens, body.confirm, admin)
        if destructive:
            warning = await _cli_record_destructive(admin, raw)
            if warning:
                lines = [*lines, "", warning]
        await log_action("cli", f"[CLI] '{admin['username']}' ran: {raw}"
                          + (" (confirmed)" if body.confirm else ""), user=admin["username"])
        return {"output": lines, "needs_confirm": needs_confirm, "error": False}
    except _CliError as e:
        return {"output": [str(e)], "needs_confirm": False, "error": True}
