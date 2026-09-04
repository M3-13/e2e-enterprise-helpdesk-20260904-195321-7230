import os
from datetime import datetime, timedelta

os.environ["JWT_SECRET"] = "test-secret-key-with-at-least-32-bytes"

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401
from db import Base, get_db
from main import app
from models import AuditLog, Comment, Ticket, User

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base.metadata.create_all(bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

client = TestClient(app)

PRIORITY_DUE_DAYS = {"low": 7, "medium": 3, "high": 1, "critical": 0}


@pytest.fixture()
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    session = TestingSessionLocal()
    try:
        for table in (AuditLog, Comment, Ticket, User):
            session.query(table).delete()
        session.commit()
    finally:
        session.close()


def _token(user_id: int, role: str) -> str:
    return pyjwt.encode(
        {"sub": str(user_id), "role": role}, os.environ["JWT_SECRET"], algorithm="HS256"
    )


def _headers(user: User) -> dict:
    return {"Authorization": f"Bearer {_token(user.id, user.role)}"}


def _create_user(db, username: str, role: str = "requester") -> User:
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


def _create_ticket(db, requester: User, **kwargs) -> Ticket:
    payload = {
        "title": "Test ticket",
        "description": "A test ticket",
        "category": "hardware",
        "priority": "medium",
        "status": "open",
        "requester_id": requester.id,
    }
    payload.update(kwargs)
    ticket = Ticket(**payload)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def test_create_ticket_returns_201(db):
    requester = _create_user(db, "melder")
    response = client.post(
        "/api/tickets",
        json={
            "title": "Drucker kaputt",
            "description": "kein Toner",
            "category": "hardware",
            "priority": "high",
        },
        headers=_headers(requester),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Drucker kaputt"
    assert body["status"] == "open"
    assert body["requester_id"] == requester.id
    assert body["assignee_id"] is None


def test_create_ticket_due_date_follows_priority(db):
    requester = _create_user(db, "melder")

    for priority, days in PRIORITY_DUE_DAYS.items():
        response = client.post(
            "/api/tickets",
            json={
                "title": f"t {priority}",
                "description": "d",
                "category": "c",
                "priority": priority,
            },
            headers=_headers(requester),
        )
        assert response.status_code == 201
        created = datetime.fromisoformat(response.json()["created_at"])
        due = datetime.fromisoformat(response.json()["due_date"])
        assert abs((due - created - timedelta(days=days)).total_seconds()) < 5


def test_list_tickets_requires_auth():
    response = client.get("/api/tickets")
    assert response.status_code == 401


def test_list_tickets_filters_sorts_paginates(db):
    requester = _create_user(db, "melder")
    _create_ticket(db, requester, title="first", priority="low", status="open")
    _create_ticket(db, requester, title="second", priority="high", status="closed")
    _create_ticket(db, requester, title="third", priority="critical", status="open")

    by_status = client.get("/api/tickets", params={"status": "open"}, headers=_headers(requester))
    assert by_status.status_code == 200
    assert by_status.json()["total"] == 2

    by_priority = client.get(
        "/api/tickets", params={"priority": "critical"}, headers=_headers(requester)
    )
    assert by_priority.json()["total"] == 1

    by_search = client.get("/api/tickets", params={"search": "first"}, headers=_headers(requester))
    assert by_search.json()["total"] == 1

    by_sort = client.get("/api/tickets", params={"sort": "priority"}, headers=_headers(requester))
    priorities = [item["priority"] for item in by_sort.json()["items"]]
    assert priorities == ["critical", "high", "low"]

    paginated = client.get(
        "/api/tickets", params={"page": 2, "page_size": 1}, headers=_headers(requester)
    )
    assert paginated.status_code == 200
    assert paginated.json()["total"] == 3
    assert len(paginated.json()["items"]) == 1


def test_list_tickets_page_size_is_capped_at_100(db):
    requester = _create_user(db, "melder")
    for i in range(150):
        _create_ticket(db, requester, title=f"ticket {i}")

    response = client.get("/api/tickets", params={"page_size": 10000}, headers=_headers(requester))
    assert response.status_code == 200
    assert response.json()["total"] == 150
    assert len(response.json()["items"]) == 100


def test_requester_does_not_see_foreign_ticket(db):
    requester = _create_user(db, "melder")
    other = _create_user(db, "anderer")
    ticket = _create_ticket(db, other, title="fremd")

    response = client.get(f"/api/tickets/{ticket.id}", headers=_headers(requester))
    assert response.status_code == 404

    listed = client.get("/api/tickets", headers=_headers(requester))
    assert listed.json()["total"] == 0


def test_agent_can_edit_assign_close(db):
    agent = _create_user(db, "agent1", role="agent")
    requester = _create_user(db, "melder")
    ticket = _create_ticket(db, requester, title="orig")

    patch = client.patch(
        f"/api/tickets/{ticket.id}",
        json={"title": "new title", "priority": "high"},
        headers=_headers(agent),
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "new title"
    assert patch.json()["priority"] == "high"

    assign = client.post(
        f"/api/tickets/{ticket.id}/assign", json={"agent_id": agent.id}, headers=_headers(agent)
    )
    assert assign.status_code == 200
    assert assign.json()["assignee_id"] == agent.id

    close = client.post(f"/api/tickets/{ticket.id}/close", headers=_headers(agent))
    assert close.status_code == 200
    assert close.json()["status"] == "closed"


def test_requester_cannot_edit_assign_close(db):
    requester = _create_user(db, "melder")
    ticket = _create_ticket(db, requester)

    assert (
        client.patch(
            f"/api/tickets/{ticket.id}", json={"title": "x"}, headers=_headers(requester)
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/tickets/{ticket.id}/assign", json={"agent_id": None}, headers=_headers(requester)
        ).status_code
        == 403
    )
    assert (
        client.post(f"/api/tickets/{ticket.id}/close", headers=_headers(requester)).status_code
        == 403
    )


def test_audit_log_written_on_update(db):
    agent = _create_user(db, "agent1", role="agent")
    requester = _create_user(db, "melder")
    ticket = _create_ticket(db, requester, title="orig", priority="low")

    client.patch(f"/api/tickets/{ticket.id}", json={"title": "changed"}, headers=_headers(agent))

    detail = client.get(f"/api/tickets/{ticket.id}", headers=_headers(agent))
    assert detail.status_code == 200
    audit = detail.json()["audit_log"]
    fields = {entry["field"]: entry for entry in audit}
    assert fields["title"]["old_value"] == "orig"
    assert fields["title"]["new_value"] == "changed"


def test_assign_requires_an_agent(db):
    agent = _create_user(db, "agent1", role="agent")
    requester = _create_user(db, "melder")
    ticket = _create_ticket(db, requester)

    response = client.post(
        f"/api/tickets/{ticket.id}/assign", json={"agent_id": requester.id}, headers=_headers(agent)
    )
    assert response.status_code == 400


def test_detail_includes_comments_and_audit_log(db):
    agent = _create_user(db, "agent1", role="agent")
    requester = _create_user(db, "melder")
    ticket = _create_ticket(db, requester)

    client.patch(
        f"/api/tickets/{ticket.id}", json={"status": "in_progress"}, headers=_headers(agent)
    )

    detail = client.get(f"/api/tickets/{ticket.id}", headers=_headers(agent))
    assert detail.status_code == 200
    body = detail.json()
    assert "comments" in body
    assert "audit_log" in body
    assert any(
        e["field"] == "status" and e["new_value"] == "in_progress" for e in body["audit_log"]
    )
