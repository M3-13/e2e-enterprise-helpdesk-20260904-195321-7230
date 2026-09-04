from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from models import Ticket

PRIORITY_WEIGHT = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def build_ticket_query(
    db: Session,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 20,
    requester_id: int | None = None,
) -> tuple[list[Ticket], int]:
    """Filter, sort and paginate the ticket list.

    ``requester_id`` is an optional extra filter used to restrict the result
    set to a single requester's own tickets (requesters may only read their
    own tickets). Other callers simply omit it.
    """
    query = db.query(Ticket)

    if search:
        like = f"%{search}%"
        query = query.filter(or_(Ticket.title.ilike(like), Ticket.description.ilike(like)))

    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if assignee_id is not None:
        query = query.filter(Ticket.assignee_id == assignee_id)
    if requester_id is not None:
        query = query.filter(Ticket.requester_id == requester_id)

    total = query.count()

    if sort == "priority":
        order = case(PRIORITY_WEIGHT, value=Ticket.priority).desc()
    elif sort == "due_date":
        order = Ticket.due_date.asc()
    else:
        order = Ticket.created_at.desc()

    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    items = query.order_by(order).offset((page - 1) * page_size).limit(page_size).all()

    return items, total
