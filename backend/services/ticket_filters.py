from sqlalchemy.orm import Session


def build_ticket_query(
    db: Session,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list, int]:
    """Stub — the tickets ticket implements the actual filtering and pagination."""
    raise NotImplementedError("tickets ticket implements build_ticket_query")
