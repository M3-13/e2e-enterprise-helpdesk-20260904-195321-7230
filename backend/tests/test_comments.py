import os

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
from models import Ticket, User


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    saved = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        if saved is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = saved


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


def test_create_comment_returns_201(client, db_session):
    requester = _create_user(db_session, "melder")
    ticket = _create_ticket(db_session, requester)

    response = client.post(
        f"/api/tickets/{ticket.id}/comments",
        json={"body": "Ich habe das Problem"},
        headers=_headers(requester),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["ticket_id"] == ticket.id
    assert body["author_id"] == requester.id
    assert body["body"] == "Ich habe das Problem"
    assert body["id"] is not None
    assert body["created_at"] is not None


def test_list_comments_returns_history_with_author_and_timestamp(client, db_session):
    requester = _create_user(db_session, "melder")
    agent = _create_user(db_session, "agent1", role="agent")
    ticket = _create_ticket(db_session, requester)

    client.post(
        f"/api/tickets/{ticket.id}/comments", json={"body": "erster"}, headers=_headers(requester)
    )
    client.post(
        f"/api/tickets/{ticket.id}/comments", json={"body": "zweiter"}, headers=_headers(agent)
    )

    response = client.get(f"/api/tickets/{ticket.id}/comments", headers=_headers(requester))
    assert response.status_code == 200
    comments = response.json()
    assert len(comments) == 2
    assert comments[0]["body"] == "erster"
    assert comments[1]["body"] == "zweiter"
    assert comments[0]["author_id"] == requester.id
    assert comments[1]["author_id"] == agent.id
    assert all("created_at" in c for c in comments)


def test_requester_cannot_see_foreign_ticket_comments(client, db_session):
    requester = _create_user(db_session, "melder")
    other = _create_user(db_session, "anderer")
    ticket = _create_ticket(db_session, other)

    client.post(
        f"/api/tickets/{ticket.id}/comments", json={"body": "geheim"}, headers=_headers(other)
    )

    response = client.get(f"/api/tickets/{ticket.id}/comments", headers=_headers(requester))
    assert response.status_code == 404


def test_comments_require_auth(client, db_session):
    requester = _create_user(db_session, "melder")
    ticket = _create_ticket(db_session, requester)

    assert client.post(f"/api/tickets/{ticket.id}/comments", json={"body": "x"}).status_code == 401
    assert client.get(f"/api/tickets/{ticket.id}/comments").status_code == 401


def test_create_comment_requires_body(client, db_session):
    requester = _create_user(db_session, "melder")
    ticket = _create_ticket(db_session, requester)

    response = client.post(
        f"/api/tickets/{ticket.id}/comments", json={}, headers=_headers(requester)
    )
    assert response.status_code == 422


def test_comment_on_missing_ticket_returns_404(client, db_session):
    requester = _create_user(db_session, "melder")

    response = client.post(
        "/api/tickets/9999/comments", json={"body": "x"}, headers=_headers(requester)
    )
    assert response.status_code == 404
