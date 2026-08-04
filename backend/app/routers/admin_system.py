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

from ..config import VERSION, SETUP_KEY, STRIPE_WEBHOOK_SECRET, _JWT_EPHEMERAL
from ..database import db
from ..deps import require_permission, require_super_admin, hash_key
from ..utils import log_action, _create_notification
from ..loyalty import get_tier
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
    "Destructive commands ask for confirmation before applying any change.",
    "Repeated destructive actions in a short window auto-lock the CLI as an anomaly safeguard.",
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

    raise _CliError(f"Unknown command '{' '.join(tokens)}'. Type 'help' for the command list.")

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
