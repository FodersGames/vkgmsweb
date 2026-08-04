import re
import math
import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from ..database import db
from ..deps import require_permission, get_current_user
from ..utils import serialize_doc, log_action, _create_notification
from ..rate_limit import limiter
from ..schemas import TicketCreateRequest, TicketReplyRequest, TicketStatusUpdateRequest

router = APIRouter()

# ============== SUPPORT TICKETS ==============

@router.post("/tickets")
@limiter.limit("5/hour")
async def create_ticket(request: Request, req: TicketCreateRequest, user=Depends(get_current_user)):
    subject = req.subject.strip()[:200]
    message = req.message.strip()[:2000]
    email = user["email"]
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required")
    ticket_number = "TKT-" + secrets.token_hex(3).upper()
    while await db.support_tickets.find_one({"ticket_number": ticket_number}):
        ticket_number = "TKT-" + secrets.token_hex(3).upper()
    user_id_oid = ObjectId(user["id"])
    username = user.get("username", user["email"])
    doc = {
        "ticket_number": ticket_number,
        "subject": subject,
        "category": req.category,
        "status": "open",
        "priority": "normal",
        "user_email": email,
        "user_id": user_id_oid,
        "username": username,
        "messages": [{
            "sender": "user",
            "author_name": username,
            "content": message,
            "timestamp": datetime.now(timezone.utc),
        }],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.support_tickets.insert_one(doc)
    await log_action("support", f"New ticket {ticket_number}: '{subject}' from {email}")
    return {"success": True, "ticket_number": ticket_number}

@router.get("/tickets/mine")
async def list_my_tickets(user=Depends(get_current_user)):
    email = user.get("email", "").lower()
    tickets = await db.support_tickets.find({"user_email": email}).sort("created_at", -1).to_list(50)
    return {"tickets": [serialize_doc(t) for t in tickets]}

@router.get("/tickets/{ticket_number}")
async def get_ticket(ticket_number: str, user=Depends(get_current_user)):
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    is_owner = t.get("user_email", "").lower() == user.get("email", "").lower()
    has_perm = user.get("is_super_admin") or "manage_tickets" in user.get("permissions", [])
    if not is_owner and not has_perm:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"ticket": serialize_doc(t)}

@router.post("/tickets/{ticket_number}/reply")
@limiter.limit("20/hour")
async def reply_to_ticket(request: Request, ticket_number: str, req: TicketReplyRequest, user=Depends(get_current_user)):
    content = req.content.strip()[:2000]
    if not content:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if t.get("user_email", "").lower() != user.get("email", "").lower():
        raise HTTPException(status_code=403, detail="Not your ticket")
    if t.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Ticket is closed")
    await db.support_tickets.update_one(
        {"ticket_number": ticket_number.upper()},
        {
            "$push": {"messages": {"sender": "user", "author_name": user.get("username", "User"), "content": content, "timestamp": datetime.now(timezone.utc)}},
            "$set": {"updated_at": datetime.now(timezone.utc), "status": "open"},
        }
    )
    return {"success": True}

@router.get("/admin/tickets")
async def list_all_tickets(status: Optional[str] = None, priority: Optional[str] = None,
                            search: Optional[str] = None,
                            page: int = 1, limit: int = 50,
                            user=Depends(require_permission("manage_tickets"))):
    q: dict = {}
    if status:
        q["status"] = status
    if priority:
        q["priority"] = priority
    if search:
        pattern = re.escape(search.strip())
        q["$or"] = [
            {"subject": {"$regex": pattern, "$options": "i"}},
            {"username": {"$regex": pattern, "$options": "i"}},
            {"user_email": {"$regex": pattern, "$options": "i"}},
            {"ticket_number": {"$regex": pattern, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    total = await db.support_tickets.count_documents(q)
    tickets = await db.support_tickets.find(q).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    return {
        "tickets": [serialize_doc(t) for t in tickets],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
    }

@router.patch("/admin/tickets/{ticket_number}")
async def update_ticket_status(ticket_number: str, req: TicketStatusUpdateRequest, user=Depends(require_permission("manage_tickets"))):
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if req.status is not None:
        updates["status"] = req.status
    if req.priority is not None:
        updates["priority"] = req.priority
    await db.support_tickets.update_one({"ticket_number": ticket_number.upper()}, {"$set": updates})
    return {"success": True}

@router.post("/admin/tickets/{ticket_number}/reply")
async def admin_reply_to_ticket(ticket_number: str, req: TicketReplyRequest, user=Depends(require_permission("manage_tickets"))):
    content = req.content.strip()[:2000]
    if not content:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")
    t = await db.support_tickets.find_one({"ticket_number": ticket_number.upper()})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.support_tickets.update_one(
        {"ticket_number": ticket_number.upper()},
        {
            "$push": {"messages": {"sender": "support", "author_name": user.get("username", "Support"), "content": content, "timestamp": datetime.now(timezone.utc)}},
            "$set": {"updated_at": datetime.now(timezone.utc), "status": "in_progress"},
        }
    )
    user_account = await db.users.find_one({"email": t.get("user_email", "")})
    if user_account:
        await _create_notification(
            user_id=str(user_account["_id"]),
            message=f"💬 Support replied to your ticket [{ticket_number.upper()}]: \"{content[:80]}{'...' if len(content) > 80 else ''}\"",
            notif_type="ticket_reply",
            link="/profile",
        )
    await log_action("support", f"Admin '{user['username']}' replied to ticket {ticket_number.upper()}")
    return {"success": True}
