from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import Ticket, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

PRIORITIES = ("low", "medium", "high", "critical")


def _today_start() -> datetime:
    now = datetime.now(UTC).replace(tzinfo=None)
    return datetime(now.year, now.month, now.day)


@router.get("")
def dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    today_start = _today_start()

    base_filters = []
    if current_user.role == "requester":
        base_filters.append(Ticket.requester_id == current_user.id)

    open_count = (
        db.query(func.count(Ticket.id)).filter(Ticket.status != "closed", *base_filters).scalar()
        or 0
    )

    overdue_count = (
        db.query(func.count(Ticket.id))
        .filter(
            Ticket.status != "closed",
            Ticket.due_date.isnot(None),
            Ticket.due_date < today_start,
            *base_filters,
        )
        .scalar()
        or 0
    )

    closed_today = (
        db.query(func.count(Ticket.id))
        .filter(Ticket.status == "closed", Ticket.updated_at >= today_start, *base_filters)
        .scalar()
        or 0
    )

    by_priority = {
        priority: (
            db.query(func.count(Ticket.id))
            .filter(Ticket.status != "closed", Ticket.priority == priority, *base_filters)
            .scalar()
            or 0
        )
        for priority in PRIORITIES
    }

    return {
        "open": open_count,
        "overdue": overdue_count,
        "closed_today": closed_today,
        "by_priority": by_priority,
    }
