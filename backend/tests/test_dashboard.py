from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401  # register models on Base.metadata
from auth import get_current_user
from db import Base, get_db
from main import app
from models import Ticket, User


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    def override_get_current_user():
        return db_session.get(User, 1)

    saved = {
        get_db: app.dependency_overrides.get(get_db),
        get_current_user: app.dependency_overrides.get(get_current_user),
    }
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        with TestClient(app) as c:
            yield c
    finally:
        for dep, original in saved.items():
            if original is None:
                app.dependency_overrides.pop(dep, None)
            else:
                app.dependency_overrides[dep] = original


def make_ticket(
    session,
    *,
    status: str = "open",
    priority: str = "medium",
    due_date=None,
    updated_at=None,
    requester_id: int = 1,
) -> Ticket:
    ticket = Ticket(
        title="t",
        description="",
        category="",
        priority=priority,
        status=status,
        due_date=due_date,
        requester_id=requester_id,
    )
    if updated_at is not None:
        ticket.updated_at = updated_at
    session.add(ticket)
    session.commit()
    return ticket


def today() -> datetime:
    now = datetime.now(UTC).replace(tzinfo=None)
    return datetime(now.year, now.month, now.day)


def test_dashboard_requires_auth():
    with TestClient(app) as c:
        response = c.get("/api/dashboard")
    assert response.status_code == 401


def test_dashboard_empty_state(client, db_session):
    user = User(username="u", email="u@example.com", password_hash="x", role="requester")
    db_session.add(user)
    db_session.commit()

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json() == {
        "open": 0,
        "overdue": 0,
        "closed_today": 0,
        "by_priority": {"low": 0, "medium": 0, "high": 0, "critical": 0},
    }


def test_dashboard_counts_open_tickets(client, db_session):
    user = User(username="u", email="u@example.com", password_hash="x", role="requester")
    db_session.add(user)
    db_session.commit()

    make_ticket(db_session, status="open")
    make_ticket(db_session, status="in_progress")
    make_ticket(db_session, status="closed")

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json()["open"] == 2


def test_dashboard_counts_overdue(client, db_session):
    user = User(username="u", email="u@example.com", password_hash="x", role="requester")
    db_session.add(user)
    db_session.commit()

    make_ticket(db_session, status="open", due_date=today() - timedelta(days=1))
    make_ticket(db_session, status="open", due_date=today() + timedelta(days=1))
    make_ticket(db_session, status="closed", due_date=today() - timedelta(days=5))

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json()["overdue"] == 1


def test_dashboard_counts_closed_today(client, db_session):
    user = User(username="u", email="u@example.com", password_hash="x", role="requester")
    db_session.add(user)
    db_session.commit()

    make_ticket(db_session, status="closed", updated_at=today())
    make_ticket(db_session, status="closed", updated_at=today() - timedelta(days=1))
    make_ticket(db_session, status="open")

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json()["closed_today"] == 1


def test_dashboard_by_priority_counts_only_open(client, db_session):
    user = User(username="u", email="u@example.com", password_hash="x", role="requester")
    db_session.add(user)
    db_session.commit()

    make_ticket(db_session, status="open", priority="low")
    make_ticket(db_session, status="open", priority="high")
    make_ticket(db_session, status="open", priority="high")
    make_ticket(db_session, status="closed", priority="critical")

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json()["by_priority"] == {
        "low": 1,
        "medium": 0,
        "high": 2,
        "critical": 0,
    }


def test_dashboard_requester_sees_only_own_tickets(client, db_session):
    user = User(username="u", email="u@example.com", password_hash="x", role="requester")
    other = User(username="o", email="o@example.com", password_hash="x", role="requester")
    db_session.add_all([user, other])
    db_session.commit()

    make_ticket(db_session, status="open", requester_id=user.id)
    make_ticket(db_session, status="open", requester_id=other.id)
    make_ticket(db_session, status="in_progress", requester_id=user.id)
    make_ticket(db_session, status="closed", updated_at=today(), requester_id=user.id)
    make_ticket(db_session, status="closed", updated_at=today(), requester_id=other.id)
    make_ticket(db_session, status="open", priority="high", requester_id=user.id)
    make_ticket(db_session, status="open", priority="high", requester_id=other.id)

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["open"] == 3
    assert body["closed_today"] == 1
    assert body["by_priority"]["high"] == 1


def test_dashboard_agent_sees_global_totals(client, db_session):
    agent = User(username="a", email="a@example.com", password_hash="x", role="agent")
    other = User(username="o", email="o@example.com", password_hash="x", role="requester")
    db_session.add_all([agent, other])
    db_session.commit()

    make_ticket(db_session, status="open", requester_id=agent.id)
    make_ticket(db_session, status="open", requester_id=other.id)

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    assert response.json()["open"] == 2
