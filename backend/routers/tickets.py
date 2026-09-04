from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, require_role
from db import get_db
from models import AuditLog, Ticket, User, utcnow
from schemas import (
    AuditLogOut,
    CommentOut,
    TicketAssign,
    TicketCreate,
    TicketOut,
    TicketUpdate,
)
from services.ticket_filters import build_ticket_query

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

PRIORITY_DUE_DAYS = {
    "low": 7,
    "medium": 3,
    "high": 1,
    "critical": 0,
}


def _due_date_for(priority: str) -> datetime:
    days = PRIORITY_DUE_DAYS.get(priority, 3)
    return utcnow() + timedelta(days=days)


def _audit(
    ticket: Ticket,
    user_id: int,
    field: str,
    old_value: object,
    new_value: object,
) -> AuditLog:
    return AuditLog(
        ticket_id=ticket.id,
        user_id=user_id,
        field=field,
        old_value=None if old_value is None else str(old_value),
        new_value=None if new_value is None else str(new_value),
    )


@router.post("", status_code=201, response_model=TicketOut)
def create_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        status="open",
        due_date=_due_date_for(payload.priority),
        requester_id=current_user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("")
def list_tickets(
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    requester_id = current_user.id if current_user.role == "requester" else None
    items, total = build_ticket_query(
        db,
        search=search,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        sort=sort,
        page=page,
        page_size=page_size,
        requester_id=requester_id,
    )
    return {
        "items": [TicketOut.model_validate(t) for t in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role == "requester" and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    base = TicketOut.model_validate(ticket).model_dump()
    base["comments"] = [CommentOut.model_validate(c) for c in ticket.comments]
    base["audit_log"] = [AuditLogOut.model_validate(a) for a in ticket.audit_logs]
    return base


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: User = Depends(require_role("agent", "admin")),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    data = payload.model_dump(exclude_unset=True)
    for field, new_value in data.items():
        if new_value is None:
            continue
        old_value = getattr(ticket, field)
        if new_value == old_value:
            continue
        setattr(ticket, field, new_value)
        db.add(_audit(ticket, current_user.id, field, old_value, new_value))

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/assign", response_model=TicketOut)
def assign_ticket(
    ticket_id: int,
    payload: TicketAssign,
    current_user: User = Depends(require_role("agent", "admin")),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    agent_id = payload.agent_id
    if agent_id is not None:
        agent = db.get(User, agent_id)
        if agent is None:
            raise HTTPException(status_code=404, detail="Assignee not found")
        if agent.role != "agent":
            raise HTTPException(status_code=400, detail="Assignee must be an agent")

    if ticket.assignee_id != agent_id:
        old_value = ticket.assignee_id
        ticket.assignee_id = agent_id
        db.add(_audit(ticket, current_user.id, "assignee_id", old_value, agent_id))

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/close", response_model=TicketOut)
def close_ticket(
    ticket_id: int,
    current_user: User = Depends(require_role("agent", "admin")),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status != "closed":
        old_value = ticket.status
        ticket.status = "closed"
        db.add(_audit(ticket, current_user.id, "status", old_value, "closed"))

    db.commit()
    db.refresh(ticket)
    return ticket
