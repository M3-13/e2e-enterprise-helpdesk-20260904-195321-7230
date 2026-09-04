import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import Ticket, User
from services import ticket_filters

router = APIRouter(prefix="/api/tickets", tags=["export"])

CSV_HEADER = [
    "id",
    "title",
    "description",
    "category",
    "priority",
    "status",
    "due_date",
    "assignee",
    "requester",
    "created_at",
    "updated_at",
]

# "ohne Pagination": the export must contain every matching ticket, not a
# single page. build_ticket_query paginates by default, so ask for the whole
# result set in one page.
_EXPORT_ALL_PAGE_SIZE = 1_000_000_000


def _iso(value: datetime | None) -> str:
    return "" if value is None else value.isoformat()


def _ticket_row(ticket: Ticket, usernames: dict[int, str]) -> list[str]:
    assignee = usernames.get(ticket.assignee_id, "") if ticket.assignee_id is not None else ""
    requester = usernames.get(ticket.requester_id, "")
    return [
        str(ticket.id),
        ticket.title,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        _iso(ticket.due_date),
        assignee,
        requester,
        _iso(ticket.created_at),
        _iso(ticket.updated_at),
    ]


def _usernames(db: Session, items: list[Ticket]) -> dict[int, str]:
    user_ids = {ticket.requester_id for ticket in items}
    user_ids.update(ticket.assignee_id for ticket in items if ticket.assignee_id is not None)
    if not user_ids:
        return {}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {user.id: user.username for user in users}


@router.get("/export")
def export_tickets(
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    requester_id = current_user.id if current_user.role == "requester" else None
    items, _ = ticket_filters.build_ticket_query(
        db,
        search=search,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        sort=None,
        page=1,
        page_size=_EXPORT_ALL_PAGE_SIZE,
        requester_id=requester_id,
    )

    usernames = _usernames(db, items)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADER)
    for ticket in items:
        writer.writerow(_ticket_row(ticket, usernames))

    return Response(content=output.getvalue(), media_type="text/csv")
