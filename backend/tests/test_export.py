import csv
import io

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401  # register models on Base.metadata
from db import Base, get_db
from main import app
from models import Ticket, User
from routers.export import CSV_HEADER, _sanitize_csv_cell
from services import ticket_filters


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return session


@pytest.fixture
def client(db_session, monkeypatch):
    def override_get_db():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-for-export-tests-1234567890")
    with TestClient(app) as c:
        yield c


def _make_user(db, username: str, role: str = "requester") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash="x",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_ticket(
    db,
    title: str,
    assignee_id: int | None,
    requester_id: int,
    status: str = "open",
    priority: str = "medium",
) -> Ticket:
    ticket = Ticket(
        title=title,
        description=f"description of {title}",
        category="general",
        priority=priority,
        status=status,
        assignee_id=assignee_id,
        requester_id=requester_id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def _token(user: User) -> str:
    secret = "test-secret-key-for-export-tests-1234567890"
    return jwt.encode({"sub": str(user.id), "role": user.role}, secret, algorithm="HS256")


def _auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user)}"}


def _parse_csv(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text)))


def test_export_returns_header_and_exactly_the_filtered_rows(client, db_session, monkeypatch):
    db = db_session()
    agent = _make_user(db, "agent1", role="agent")
    requester = _make_user(db, "requester1")
    open_ticket = _make_ticket(db, "open ticket", assignee_id=agent.id, requester_id=requester.id)
    _make_ticket(db, "other ticket", assignee_id=None, requester_id=requester.id)

    received: dict = {}

    def fake_build_ticket_query(session, **kwargs):
        received.update(kwargs)
        return [open_ticket], 1

    monkeypatch.setattr(ticket_filters, "build_ticket_query", fake_build_ticket_query)

    response = client.get("/api/tickets/export", headers=_auth_headers(requester))

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")

    rows = _parse_csv(response.text)
    assert rows[0] == CSV_HEADER
    assert len(rows) == 2

    data = rows[1]
    assert data[0] == str(open_ticket.id)
    assert data[1] == open_ticket.title
    assert data[2] == open_ticket.description
    assert data[3] == open_ticket.category
    assert data[4] == open_ticket.priority
    assert data[5] == open_ticket.status
    assert data[7] == agent.username
    assert data[8] == requester.username
    assert data[9] == open_ticket.created_at.isoformat()
    assert data[10] == open_ticket.updated_at.isoformat()


def test_export_forwards_filters_to_build_ticket_query(client, db_session, monkeypatch):
    db = db_session()
    requester = _make_user(db, "requester1")
    _make_ticket(db, "ticket", assignee_id=None, requester_id=requester.id)

    received: dict = {}

    def fake_build_ticket_query(session, **kwargs):
        received.update(kwargs)
        return [], 0

    monkeypatch.setattr(ticket_filters, "build_ticket_query", fake_build_ticket_query)

    response = client.get(
        "/api/tickets/export",
        headers=_auth_headers(requester),
        params={"search": "needle", "status": "open", "priority": "high", "assignee_id": 7},
    )

    assert response.status_code == 200
    assert received["search"] == "needle"
    assert received["status"] == "open"
    assert received["priority"] == "high"
    assert received["assignee_id"] == 7
    assert received["requester_id"] == requester.id


def test_export_filters_actual_db_rows(client, db_session):
    db = db_session()
    agent = _make_user(db, "agent1", role="agent")

    open_high = _make_ticket(db, "open high", agent.id, agent.id, status="open", priority="high")
    _make_ticket(db, "open low", agent.id, agent.id, status="open", priority="low")
    _make_ticket(db, "closed high", agent.id, agent.id, status="closed", priority="high")

    response = client.get(
        "/api/tickets/export",
        headers=_auth_headers(agent),
        params={"status": "open", "priority": "high"},
    )

    assert response.status_code == 200
    rows = _parse_csv(response.text)
    assert rows[0] == CSV_HEADER
    data_rows = rows[1:]
    assert [r[0] for r in data_rows] == [str(open_high.id)]


def test_requester_only_exports_own_tickets(client, db_session):
    db = db_session()
    agent = _make_user(db, "agent1", role="agent")
    requester = _make_user(db, "requester1")
    other = _make_user(db, "other")

    own_a = _make_ticket(db, "own a", agent.id, requester.id)
    own_b = _make_ticket(db, "own b", agent.id, requester.id)
    _make_ticket(db, "foreign", agent.id, other.id)

    response = client.get("/api/tickets/export", headers=_auth_headers(requester))

    assert response.status_code == 200
    rows = _parse_csv(response.text)
    assert rows[0] == CSV_HEADER
    data_rows = rows[1:]
    assert sorted(r[0] for r in data_rows) == sorted([str(own_a.id), str(own_b.id)])


def test_export_requires_authentication(client):
    response = client.get("/api/tickets/export")
    assert response.status_code == 401


def test_export_sanitizes_formula_injection(client, db_session):
    db = db_session()
    agent = _make_user(db, "agent1", role="agent")
    _make_ticket(db, "=1+1", assignee_id=None, requester_id=agent.id)

    response = client.get("/api/tickets/export", headers=_auth_headers(agent))

    assert response.status_code == 200
    rows = _parse_csv(response.text)
    assert rows[0] == CSV_HEADER
    data = rows[1]
    assert data[1] == "'=1+1"


def test_sanitize_csv_cell_prefixes_formula_triggers():
    assert _sanitize_csv_cell("=1+1") == "'=1+1"
    assert _sanitize_csv_cell("+cmd") == "'+cmd"
    assert _sanitize_csv_cell("-2+2") == "'-2+2"
    assert _sanitize_csv_cell("@SUM(A1)") == "'@SUM(A1)"
    assert _sanitize_csv_cell("normal title") == "normal title"
    assert _sanitize_csv_cell(None) == ""
