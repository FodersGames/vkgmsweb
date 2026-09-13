import os
import re
import time
import shlex
import secrets
import asyncio
try:
    import psutil
except ImportError:
    psutil = None
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from ..config import VERSION, SETUP_KEY, STRIPE_WEBHOOK_SECRET, _JWT_EPHEMERAL, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, ROOT_DIR
from ..database import db, client
from ..deps import require_permission, require_super_admin, hash_key, async_hash_key, PSEUDO_REGEX
from ..utils import log_action, _create_notification
from ..chat_common import get_banned_words, contains_banned_word
from ..rate_limit import limiter
from ..schemas import CliExecuteRequest
from .dino_admin import (
    get_dino_maintenance,
    set_dino_maintenance,
    DinoMaintenanceRequest,
    get_player_profile,
    ban_player,
    unban_player,
    grant_gift_to_player,
    DinoGiftRequest,
    DinoBanRequest,
)

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
    import platform

    os_info = f"{platform.system()} {platform.release()} ({platform.machine()})"
    is_vercel = bool(os.environ.get("VERCEL"))
    env_label = "Vercel Serverless" if is_vercel else f"VPS {platform.system()}"

    if psutil:
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
        net_io = None
        try:
            net = psutil.net_io_counters()
            net_io = {"bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv}
        except Exception:
            pass
        pids_count = 1
        try:
            pids_count = len(psutil.pids())
        except Exception:
            pass

        return {
            "cpu":    {"percent": cpu_percent, "count": cpu_count},
            "ram":    {"total": ram.total,  "used": ram.used,  "free": ram.available, "percent": ram.percent},
            "disk":   {"total": disk.total, "used": disk.used, "free": disk.free,     "percent": disk.percent},
            "uptime_seconds": uptime_seconds,
            "load_avg": load_avg,
            "net_io": net_io,
            "processes_count": pids_count,
            "os_info": os_info,
            "python_version": platform.python_version(),
            "server_environment": env_label,
        }
    return {
        "cpu":    {"percent": 5, "count": 2},
        "ram":    {"total": 2048*1024*1024, "used": 512*1024*1024, "free": 1536*1024*1024, "percent": 25},
        "disk":   {"total": 20*1024*1024*1024, "used": 4*1024*1024*1024, "free": 16*1024*1024*1024, "percent": 20},
        "uptime_seconds": 86400,
        "load_avg": [0.15, 0.10, 0.05],
        "net_io": None,
        "processes_count": 24,
        "os_info": os_info,
        "python_version": platform.python_version(),
        "server_environment": env_label,
    }

# ── Deep system health ───────────────────────────────────────────────────────
# Collections indexed at startup (backend/app/main.py) : used only to report a
# per-collection custom-index count, not to enforce/recreate anything here.
_INDEXED_COLLECTIONS = [
    "users", "projects", "items", "logs", "variables",
    "blog_posts", "chat_messages", "missions",
    "notifications", "support_tickets",
    "studio_apps", "studio_app_purchases",
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

    # Database : connectivity, latency, size stats, replica-set status (best-effort).
    db_section = {"connected": False, "stats": None, "replica_set": "standalone", "latency_ms": None}
    try:
        t0 = time.perf_counter()
        await client.admin.command("ping")
        t1 = time.perf_counter()
        db_section["connected"] = True
        db_section["latency_ms"] = round((t1 - t0) * 1000, 1)
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
        pass  # standalone instances reject this command : expected, not an error

    # Configuration status : presence only, never values.
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

    # Rate limiting : flag the in-memory backend as an explicit operational caveat.
    rate_limit_section = {
        "backend": "in-memory",
        "caveat": "Per-process : limits reset on restart and are not shared across multiple worker processes.",
    }

    # Storage : game file totals via the same $group/$sum aggregation shape already used in files.py.
    storage_section = {"uploads_dir": str(ROOT_DIR / "uploads")}
    try:
        agg = await db.game_files.aggregate([
            {"$group": {"_id": None, "count": {"$sum": 1}, "total_bytes": {"$sum": "$size_bytes"}}}
        ]).to_list(1)
        storage_section["game_files_count"] = agg[0]["count"] if agg else 0
        storage_section["game_files_total_bytes"] = agg[0]["total_bytes"] if agg else 0
    except Exception as e:
        storage_section["error"] = str(e)

    # Indexes : per-collection custom index count (excludes the default _id_ index).
    index_section = []
    for coll_name in _INDEXED_COLLECTIONS:
        try:
            info = await db[coll_name].index_information()
            custom_count = len([k for k in info.keys() if k != "_id_"])
            index_section.append({"collection": coll_name, "custom_indexes": custom_count, "ok": custom_count > 0})
        except Exception:
            index_section.append({"collection": coll_name, "custom_indexes": 0, "ok": False})

    # Dependencies : echo requirements.txt, grouped for readability.
    dependencies_section = {}
    try:
        req_path = ROOT_DIR / "requirements.txt"
        lines = req_path.read_text(encoding="utf-8").splitlines()
        dependencies_section = _categorize_requirements(lines)
    except Exception as e:
        dependencies_section = {"error": str(e)}

    # Resources : same payload as /admin/system/stats, folded in so Health is one-stop.
    if psutil:
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
    else:
        resources_section = {
            "cpu": {"percent": 0, "count": 1},
            "ram": {"total": 1024*1024*1024, "used": 512*1024*1024, "free": 512*1024*1024, "percent": 50},
            "disk": {"total": 1024*1024*1024, "used": 512*1024*1024, "free": 512*1024*1024, "percent": 50},
            "uptime_seconds": 3600,
            "load_avg": [0.1, 0.1, 0.1],
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
# operations already used by their equivalent dashboard endpoints : no raw
# Mongo queries, no code evaluation. Destructive verbs are two-phase: the
# first call (confirm=False) returns a preview only; the actual write only
# happens when the client resends the identical command with confirm=True.

_CLI_HELP_TEXT = [
    "================================================================",
    "  VAKAR GAMES - SUPER ADMIN CLI CONSOLE",
    "================================================================",
    "",
    "  [ SYSTEM & INFRASTRUCTURE ]",
    "  help                                    Show this command manual",
    "  clear                                   Clear the console output",
    "  stats                                   Live database & user metrics",
    "  vps                                     Real-time VPS CPU, RAM, Disk & Uptime",
    "  history [n]                             Recent admin commands executed",
    "  broadcast <message>                     Send push notification to all users",
    "  logs recent [type] [n]                  Tail recent activity logs",
    "  logs search <keyword>                   Search logs by keyword",
    "",
    "  [ WEBSITE CONTROLS ]",
    "  maintenance on|off                      Toggle immediate maintenance mode",
    "  maintenance schedule <min> [msg]        Schedule countdown maintenance",
    "  maintenance cancel-schedule             Cancel pending maintenance schedule",
    "  settings show                           Display website global configuration",
    "  settings set support_email <value>      Update contact email",
    "",
    "  [ IDLE DINO CLICKER TYCOON - PLAYFAB ]",
    "  dino maintenance on|off|reset           Emergency game server maintenance toggle",
    "  dino inspect <playfab_id>               Query live player cloud profile",
    "  dino ban <playfab_id> [reason]          Suspend/ban player from game",
    "  dino unban <playfab_id>                 Reactivate player account",
    "  dino gift <playfab_id> <gems> [dna]     Grant in-game currencies",
    "",
    "  [ USERS & COMMUNITY ]",
    "  user list [role]                        List registered accounts (user/admin/super_admin)",
    "  user find <email|username>              Search account details",
    "  user role <query> <user|admin>          Promote or demote user account",
    "  user suspend <query>                    Suspend user login access",
    "  user unsuspend <query>                  Reactivate suspended user",
    "  user reset-password <query>             Generate secure temporary password",
    "  survey list                             List all surveys & response counts",
    "",
    "  [ SUPPORT TICKETS ]",
    "  ticket list [status]                    List open/resolved support tickets",
    "  ticket show <number>                    Inspect ticket conversation thread",
    "  ticket reply <number> <msg>             Send support agent reply",
    "  ticket close <number>                   Close ticket",
    "",
    "  [ BLOG ]",
    "  blog list [published|draft]             List published articles",
    "================================================================",
]

# ── CLI catalog ───────────────────────────────────────────────────────────────
_T = "text"; _N = "number"; _TA = "textarea"
def _sel(choices):
    return {"type": "select", "choices": choices}

_CLI_CATALOG = [
    # System & Telemetry
    {"path": ["help"], "category": "System", "description": "Show list of available CLI commands.", "args": [], "confirm": False},
    {"path": ["clear"], "category": "System", "description": "Clear the terminal screen output.", "args": [], "confirm": False},
    {"path": ["stats"], "category": "System", "description": "Display live platform counters (Users, Surveys, Tickets).", "args": [], "confirm": False},
    {"path": ["vps"], "category": "System", "description": "Show real-time server telemetry: CPU, RAM, Disk, Uptime.", "args": [], "confirm": False},
    {"path": ["history"], "category": "System", "description": "Show recent admin CLI command executions.", "args": [{"name": "n", "label": "Count", "type": _N, "required": False}], "confirm": False},
    {"path": ["broadcast"], "category": "System", "description": "Broadcast an in-app notification to all registered users.", "args": [{"name": "message", "label": "Message", "type": _TA, "required": True}], "confirm": True},
    {"path": ["logs", "recent"], "category": "System", "description": "Tail the latest platform activity logs.", "args": [
        {"name": "type", "label": "Log type", "type": _T, "required": False},
        {"name": "n", "label": "Count (max 100)", "type": _N, "required": False},
    ], "confirm": False},
    {"path": ["logs", "search"], "category": "System", "description": "Search activity logs by keyword.", "args": [{"name": "keyword", "label": "Keyword", "type": _T, "required": True}], "confirm": False},

    # Website Settings & Maintenance
    {"path": ["maintenance"], "category": "Website", "description": "Toggle immediate website maintenance mode (on/off).", "args": [{"name": "state", "label": "State", **_sel(["on", "off"]), "required": True}], "confirm": True},
    {"path": ["maintenance", "schedule"], "category": "Website", "description": "Schedule website maintenance in N minutes with visitor notice.", "args": [
        {"name": "minutes", "label": "Minutes from now", "type": _N, "required": True},
        {"name": "message", "label": "Notice message", "type": _TA, "required": False},
    ], "confirm": True},
    {"path": ["maintenance", "cancel-schedule"], "category": "Website", "description": "Cancel pending scheduled website maintenance.", "args": [], "confirm": True},
    {"path": ["settings", "show"], "category": "Website", "description": "View current global website configuration.", "args": [], "confirm": False},
    {"path": ["settings", "set"], "category": "Website", "description": "Update a website setting.", "args": [
        {"name": "key", "label": "Setting key", **_sel(["support_email"]), "required": True},
        {"name": "value", "label": "New value", "type": _T, "required": True},
    ], "confirm": True},

    # Idle Dino Clicker Tycoon (PlayFab Dev)
    {"path": ["dino", "maintenance"], "category": "Dino Game", "description": "Control Idle Dino Clicker Tycoon maintenance via PlayFab.", "args": [
        {"name": "state", "label": "Action", **_sel(["on", "off", "reset"]), "required": True}
    ], "confirm": True},
    {"path": ["dino", "inspect"], "category": "Dino Game", "description": "Inspect player cloud profile directly from PlayFab.", "args": [
        {"name": "playfab_id", "label": "PlayFab ID", "type": _T, "required": True}
    ], "confirm": False},
    {"path": ["dino", "ban"], "category": "Dino Game", "description": "Suspend / ban a player account from mobile game servers.", "args": [
        {"name": "playfab_id", "label": "PlayFab ID", "type": _T, "required": True},
        {"name": "reason", "label": "Reason", "type": _T, "required": False},
    ], "confirm": True},
    {"path": ["dino", "unban"], "category": "Dino Game", "description": "Unban and restore access for a player.", "args": [
        {"name": "playfab_id", "label": "PlayFab ID", "type": _T, "required": True}
    ], "confirm": True},
    {"path": ["dino", "gift"], "category": "Dino Game", "description": "Dispatch in-game currencies gift (Gems & DNA) to player.", "args": [
        {"name": "playfab_id", "label": "PlayFab ID", "type": _T, "required": True},
        {"name": "gems", "label": "Gems amount", "type": _N, "required": True},
        {"name": "dna", "label": "DNA amount", "type": _N, "required": False},
    ], "confirm": True},

    # User Accounts & Permissions
    {"path": ["user", "list"], "category": "Users", "description": "List users, optionally filtered by role.", "args": [
        {"name": "role", "label": "Role", **_sel(["user", "admin", "super_admin"]), "required": False}
    ], "confirm": False},
    {"path": ["user", "find"], "category": "Users", "description": "Search user by email, username, or Mongo ID.", "args": [
        {"name": "query", "label": "Email or username", "type": _T, "required": True}
    ], "confirm": False},
    {"path": ["user", "role"], "category": "Users", "description": "Promote or change a user's role.", "args": [
        {"name": "query", "label": "Email or username", "type": _T, "required": True},
        {"name": "role", "label": "Role", **_sel(["user", "admin"]), "required": True},
    ], "confirm": True},
    {"path": ["user", "suspend"], "category": "Users", "description": "Suspend a user account.", "args": [
        {"name": "query", "label": "Email or username", "type": _T, "required": True}
    ], "confirm": True},
    {"path": ["user", "unsuspend"], "category": "Users", "description": "Reactivate a suspended user account.", "args": [
        {"name": "query", "label": "Email or username", "type": _T, "required": True}
    ], "confirm": True},
    {"path": ["user", "reset-password"], "category": "Users", "description": "Generate a temporary login password.", "args": [
        {"name": "query", "label": "Email or username", "type": _T, "required": True}
    ], "confirm": True},

    # Surveys & Community
    {"path": ["survey", "list"], "category": "Surveys", "description": "List all surveys with status and response counts.", "args": [], "confirm": False},

    # Support Tickets
    {"path": ["ticket", "list"], "category": "Support", "description": "List support tickets by status.", "args": [
        {"name": "status", "label": "Status", **_sel(["open", "in_progress", "resolved", "closed"]), "required": False}
    ], "confirm": False},
    {"path": ["ticket", "show"], "category": "Support", "description": "Show ticket conversation thread.", "args": [
        {"name": "ticket_number", "label": "Ticket number", "type": _T, "required": True}
    ], "confirm": False},
    {"path": ["ticket", "close"], "category": "Support", "description": "Close a support ticket.", "args": [
        {"name": "ticket_number", "label": "Ticket number", "type": _T, "required": True}
    ], "confirm": True},
    {"path": ["ticket", "reply"], "category": "Support", "description": "Post support agent reply to a ticket.", "args": [
        {"name": "ticket_number", "label": "Ticket number", "type": _T, "required": True},
        {"name": "message", "label": "Reply message", "type": _TA, "required": True},
    ], "confirm": True},

    # Blog Posts
    {"path": ["blog", "list"], "category": "Blog", "description": "List all blog articles.", "args": [
        {"name": "status", "label": "Status", **_sel(["published", "draft"]), "required": False}
    ], "confirm": False},
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
# after the confirm=True path executes : the confirmation prompt itself never counts).
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
            f"CLI locked for ~{remaining} more minute{'s' if remaining != 1 else ''} : unusual activity was "
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
        f"[CLI SECURITY] '{admin['username']}' auto-locked out of the CLI for {lockout_minutes} min : {reason}",
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
    return f"⚠ Anomaly detected ({reason}) : your CLI access is locked for {lockout_minutes} minute(s)."

async def _cli_dispatch(tokens: List[str], confirm: bool, admin: dict):
    """Returns (lines, needs_confirm, destructive). Raises _CliError with a user-facing message on bad input."""
    if not tokens:
        raise _CliError("Empty command. Type 'help' for the command list.")
    verb = tokens[0].lower()

    if verb == "help":
        return _CLI_HELP_TEXT, False, False

    if verb == "clear":
        return ["__CLEAR__"], False, False

    if verb == "stats" and len(tokens) == 1:
        users_count = await db.users.count_documents({})
        surveys_count = await db.surveys.count_documents({})
        open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
        blog_count = await db.blog_posts.count_documents({})
        return [
            "Platform stats:",
            f"  users:         {users_count}",
            f"  surveys:       {surveys_count}",
            f"  open tickets:  {open_tickets}",
            f"  blog posts:    {blog_count}",
        ], False, False

    if verb == "vps":
        stats = await get_system_stats(admin)
        cpu = stats.get("cpu", {})
        ram = stats.get("ram", {})
        disk = stats.get("disk", {})
        uptime_sec = stats.get("uptime_seconds", 0)
        uptime_hrs = uptime_sec / 3600 if uptime_sec else 0
        ram_used_gb = ram.get("used", 0) / (1024**3)
        ram_total_gb = ram.get("total", 1) / (1024**3)
        disk_used_gb = disk.get("used", 0) / (1024**3)
        disk_total_gb = disk.get("total", 1) / (1024**3)
        return [
            "VPS Server Telemetry:",
            f"  os:          {stats.get('os_info', 'Unknown')}",
            f"  environment: {stats.get('server_environment', 'Unknown')}",
            f"  cpu usage:   {cpu.get('percent', 0)}% ({cpu.get('count', 1)} cores)",
            f"  ram:         {ram_used_gb:.1f} GB / {ram_total_gb:.1f} GB ({ram.get('percent', 0)}%)",
            f"  disk:        {disk_used_gb:.1f} GB / {disk_total_gb:.1f} GB ({disk.get('percent', 0)}%)",
            f"  processes:   {stats.get('processes_count', 0)}",
            f"  uptime:      {uptime_hrs:.1f} hours",
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
        # A manual toggle always wins over any pending/past schedule.
        now_utc = datetime.now(timezone.utc)
        if want_on:
            await db.website_settings.update_one({}, {"$set": {
                "maintenance_mode": True,
                "maintenance_started_at": now_utc,
                "maintenance_scheduled_at": None,
                "maintenance_announcement": "",
            }}, upsert=True)
            await db.maintenance_history.insert_one({
                "service": "website",
                "type": "maintenance",
                "status": "active",
                "started_at": now_utc,
                "ended_at": None,
                "message": "CLI maintenance mode enabled",
            })
        else:
            await db.website_settings.update_one({}, {"$set": {
                "maintenance_mode": False,
                "maintenance_started_at": None,
                "maintenance_scheduled_at": None,
                "maintenance_announcement": "",
            }}, upsert=True)
            active_sessions = await db.maintenance_history.find({
                "service": "website", "status": "active"
            }).to_list(10)
            for s in active_sessions:
                started = s.get("started_at") or (now_utc - timedelta(minutes=15))
                duration = max(1.0, (now_utc - started).total_seconds() / 60)
                await db.maintenance_history.update_one(
                    {"_id": s["_id"]},
                    {"$set": {"status": "completed", "ended_at": now_utc, "duration_minutes": duration}}
                )
        await log_action("website", f"[CLI] Maintenance mode {'enabled' if want_on else 'disabled'}", user=admin["username"])
        return [f"OK : maintenance mode {'enabled' if want_on else 'disabled'}."], False, True

    if verb == "maintenance" and len(tokens) >= 3 and tokens[1].lower() == "schedule":
        try:
            minutes = float(tokens[2])
        except ValueError:
            raise _CliError("Minutes must be a number.")
        if minutes <= 0:
            raise _CliError("Minutes must be greater than 0.")
        message = " ".join(tokens[3:]).strip()[:280]
        scheduled_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        if not confirm:
            return [
                f"Schedule maintenance to start in {minutes:g} minute(s) (at {scheduled_at.strftime('%H:%M UTC')})?",
                f"Message shown to visitors: {message or '(default message)'}",
                "Type 'y' to confirm, or anything else to cancel.",
            ], True, False
        await db.website_settings.update_one({}, {"$set": {
            "maintenance_scheduled_at": scheduled_at, "maintenance_announcement": message,
        }}, upsert=True)
        await log_action("website", f"[CLI] Maintenance scheduled for {scheduled_at.isoformat()} ({minutes:g} min from now)", user=admin["username"])
        return [f"OK : maintenance scheduled to start in {minutes:g} minute(s)."], False, True

    if verb == "maintenance" and len(tokens) == 2 and tokens[1].lower() == "cancel-schedule":
        existing = await db.website_settings.find_one({})
        if not existing or not existing.get("maintenance_scheduled_at"):
            raise _CliError("No maintenance is currently scheduled.")
        if not confirm:
            return ["Cancel the pending scheduled maintenance?", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.website_settings.update_one({}, {"$set": {"maintenance_scheduled_at": None, "maintenance_announcement": ""}})
        await log_action("website", "[CLI] Scheduled maintenance cancelled", user=admin["username"])
        return ["OK : scheduled maintenance cancelled."], False, True

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
        return [f"OK : broadcast sent to {len(all_users)} user(s)."], False, True

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
            return [f"OK : user '{target.get('username')}' {action}."], False, True

        if sub == "role":
            if len(tokens) < 4:
                raise _CliError("Usage: user role <email|username> <user|admin>")
            new_role = tokens[3].lower()
            if new_role not in ("user", "admin"):
                raise _CliError("Role must be 'user' or 'admin' : promoting to super_admin isn't supported via the CLI.")
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
            return [f"OK : '{target.get('username')}' is now role '{new_role}'."], False, True

        if sub == "reset-password":
            if not confirm:
                return [f"Generate a new temporary password for '{target.get('username')}'? They'll be forced to change it on next login.",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            temp_password = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(12))
            await db.users.update_one(
                {"_id": target["_id"]},
                {"$set": {"password_hash": await async_hash_key(temp_password), "mustChangePassword": True}},
            )
            await log_action("user_action", f"[CLI] Password reset for '{target.get('username')}'", user=admin["username"])
            return [
                f"OK : temporary password for '{target.get('username')}':",
                f"  {temp_password}",
                "Shown only once : relay it securely. They'll be asked to change it on next login.",
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
            return [f"OK : account '{target.get('username')}' permanently deleted."], False, True

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
        return [f"OK : ticket '{tn}' closed."], False, True

    # ── Surveys ──────────────────────────────────────────────────────────────
    if verb == "survey" and len(tokens) >= 2 and tokens[1].lower() == "list":
        surveys = await db.surveys.find({}).sort("createdAt", -1).to_list(30)
        if not surveys:
            return ["No surveys found."], False, False
        lines = [f"{len(surveys)} survey(s):"]
        for s in surveys:
            status = "active" if s.get("is_active", True) else "closed"
            resp_count = await db.survey_responses.count_documents({"survey_id": s["_id"]})
            lines.append(f"  {s.get('slug', '?'):<25} [{status:<6}] {resp_count} responses - {s.get('title', '')}")
        return lines, False, False

    # ── Dino Idle Tycoon ──────────────────────────────────────────────────────
    if verb == "dino" and len(tokens) >= 2:
        sub = tokens[1].lower()
        if sub == "maintenance":
            action = tokens[2].lower() if len(tokens) > 2 else "show"
            if action == "show":
                maint = await get_dino_maintenance(user=admin)
                status = "ACTIVE (Cut)" if maint.get("effective_active") else "ONLINE"
                if maint.get("is_scheduled"):
                    status = f"SCHEDULED (in {int(maint.get('seconds_until_scheduled', 0)//60)} mins at {maint.get('target_iso')})"
                return [
                    "Dino Game Maintenance Status:",
                    f"  status:    {status}",
                    f"  message:   {maint.get('maintenance_message')}",
                    f"  scheduled: {maint.get('scheduled_maintenance_utc')}",
                ], False, False

            if action in ("on", "cut", "immediate"):
                msg = " ".join(tokens[3:]) if len(tokens) > 3 else "Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée."
                if not confirm:
                    return [f"Activate IMMEDIATE game maintenance for Idle Dino Tycoon?",
                            f"Message: \"{msg}\"",
                            "Type 'y' to confirm, or anything else to cancel."], True, False
                await set_dino_maintenance(DinoMaintenanceRequest(action="immediate", maintenance_message=msg), user=admin)
                return [f"OK : Dino game maintenance activated (immediate cut)."], False, True

            if action in ("off", "cancel", "reopen"):
                if not confirm:
                    return ["Reopen Dino Idle Tycoon servers (disable maintenance)?",
                            "Type 'y' to confirm, or anything else to cancel."], True, False
                await set_dino_maintenance(DinoMaintenanceRequest(action="cancel"), user=admin)
                return ["OK : Dino game maintenance deactivated, servers are back online."], False, True

            if action == "schedule":
                if len(tokens) < 4:
                    raise _CliError("Usage: dino maintenance schedule <delay_minutes> [message]")
                try:
                    mins = float(tokens[3])
                except ValueError:
                    raise _CliError("Delay minutes must be a number.")
                if mins <= 0:
                    raise _CliError("Delay minutes must be greater than 0.")
                msg = " ".join(tokens[4:]) if len(tokens) > 4 else "Nos serveurs entreront bientôt en maintenance."
                if not confirm:
                    return [f"Schedule Dino game maintenance in {mins:g} minute(s)?",
                            f"Message: \"{msg}\"",
                            "Type 'y' to confirm, or anything else to cancel."], True, False
                await set_dino_maintenance(DinoMaintenanceRequest(action="schedule", delay_minutes=mins, maintenance_message=msg), user=admin)
                return [f"OK : Dino game maintenance scheduled in {mins:g} minute(s)."], False, True

            raise _CliError("Usage: dino maintenance <show|on|off|schedule>")

        if sub == "inspect":
            if len(tokens) < 3:
                raise _CliError("Usage: dino inspect <playfab_id>")
            pid = tokens[2].strip()
            player = await get_player_profile(pid, user=admin)
            ban_str = f"BANNED ({player.get('ban_reason')})" if player.get("is_banned") else "Active (OK)"
            return [
                f"Player Profile [{pid}]:",
                f"  Status:       {ban_str}",
                f"  DNA:          {player.get('player_dna', '0')}",
                f"  Gems:         {player.get('player_gems', '0')}",
                f"  Rebirth:      {player.get('rebirth_level', '1')}",
                f"  Total Dinos:  {player.get('total_dinos', '0')}",
                f"  Equipped:     {player.get('equipped_dinos', 'None')}",
                f"  Last Sync:    {player.get('last_sync', 'Never')}",
                f"  Pending Gift: {'Yes' if player.get('has_pending_gift') else 'No'}",
            ], False, False

        if sub == "ban":
            if len(tokens) < 4:
                raise _CliError("Usage: dino ban <playfab_id> <reason>")
            pid = tokens[2].strip()
            reason = " ".join(tokens[3:]).strip()
            if not confirm:
                return [f"BAN Dino player '{pid}'?",
                        f"Reason: \"{reason}\"",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            await ban_player(pid, DinoBanRequest(reason=reason), user=admin)
            return [f"OK : Player '{pid}' has been banned."], False, True

        if sub == "unban":
            if len(tokens) < 3:
                raise _CliError("Usage: dino unban <playfab_id>")
            pid = tokens[2].strip()
            if not confirm:
                return [f"Unban Dino player '{pid}'?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            await unban_player(pid, user=admin)
            return [f"OK : Player '{pid}' has been unbanned."], False, True

        if sub == "gift":
            if len(tokens) < 5:
                raise _CliError("Usage: dino gift <playfab_id> <gems> <dna> [dino_name]")
            pid = tokens[2].strip()
            try:
                gems = int(tokens[3])
                dna = float(tokens[4])
            except ValueError:
                raise _CliError("Gems and DNA must be valid numbers.")
            dino_name = tokens[5].strip() if len(tokens) > 5 else None
            gift_desc = f"{gems:,} Gems, {dna:g} DNA" + (f", 1x {dino_name}" if dino_name else "")
            if not confirm:
                return [f"Gift to player '{pid}': {gift_desc}?",
                        "Type 'y' to confirm, or anything else to cancel."], True, False
            req = DinoGiftRequest(playfab_id=pid, gems=gems, dna=dna, dino_name=dino_name)
            res = await grant_gift_to_player(req, user=admin)
            return [f"OK : {res.get('message')}"], False, True

        raise _CliError("Usage: dino <maintenance|inspect|ban|unban|gift>")

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
        return [f"OK : '{slug}' is now {'published' if want_published else 'a draft'}."], False, True

    if verb == "blog" and len(tokens) >= 3 and tokens[1].lower() == "delete":
        slug = tokens[2]
        p = await db.blog_posts.find_one({"slug": slug})
        if not p:
            raise _CliError(f"No blog post '{slug}'.")
        if not confirm:
            return [f"PERMANENTLY delete blog post '{slug}'? This cannot be undone.", "Type 'y' to confirm, or anything else to cancel."], True, False
        await db.blog_posts.delete_one({"slug": slug})
        await log_action("website", f"[CLI] Blog post '{slug}' deleted", user=admin["username"])
        return [f"OK : '{slug}' permanently deleted."], False, True

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
        return [f"OK : '{c.get('title')}' is now {'open' if want_open else 'closed'}."], False, True

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
        return [f"OK : reply sent on ticket '{tn}'."], False, True

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
        return [f"OK : '{key}' set to '{value}'."], False, True

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
        return [f"OK : pseudo set to '{new_pseudo}'."], False, True

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
        return [f"OK : {field} cooldown reset for '{target.get('username')}'."], False, True

    raise _CliError(f"Unknown command '{' '.join(tokens)}'. Type 'help' for the command list.")

@router.get("/admin/cli/commands")
async def cli_commands(admin=Depends(require_super_admin)):
    """Read-only catalog of every CLI command : powers frontend autocomplete
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


