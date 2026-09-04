import os

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db import Base, get_db
from main import app
from models import User

TEST_SECRET = "test-users-secret-0123456789abcdefghijklmnopqrstuvwxyz"


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield testing_session
    finally:
        if previous_override is not None:
            app.dependency_overrides[get_db] = previous_override
        else:
            app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def client(db_session):
    previous = os.environ.get("JWT_SECRET")
    os.environ["JWT_SECRET"] = TEST_SECRET
    try:
        with TestClient(app) as c:
            yield c
    finally:
        if previous is None:
            os.environ.pop("JWT_SECRET", None)
        else:
            os.environ["JWT_SECRET"] = previous


def _create_user(
    session_factory, username: str, email: str, role: str, is_active: bool = True
) -> int:
    with session_factory() as db:
        user = User(
            username=username,
            email=email,
            password_hash="x",
            role=role,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id


def _auth_header(user_id: int) -> dict[str, str]:
    token = jwt.encode({"sub": str(user_id)}, TEST_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_id(db_session) -> int:
    return _create_user(db_session, "admin", "admin@example.com", "admin")


def test_list_users_as_admin(client, admin_id, db_session):
    _create_user(db_session, "alice", "alice@example.com", "requester")
    response = client.get("/api/users", headers=_auth_header(admin_id))
    assert response.status_code == 200
    usernames = {u["username"] for u in response.json()}
    assert {"admin", "alice"}.issubset(usernames)


def test_create_user_as_admin(client, admin_id, db_session):
    response = client.post(
        "/api/users",
        json={
            "username": "bob",
            "email": "bob@example.com",
            "password": "secret123",
            "role": "agent",
        },
        headers=_auth_header(admin_id),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "bob"
    assert body["role"] == "agent"
    assert body["is_active"] is True

    with db_session() as db:
        stored = db.query(User).filter(User.username == "bob").one()
        assert stored.password_hash != "secret123"
        assert stored.password_hash.startswith("$2")


def test_create_user_duplicate_returns_409(client, admin_id, db_session):
    _create_user(db_session, "bob", "bob@example.com", "requester")
    response = client.post(
        "/api/users",
        json={
            "username": "bob",
            "email": "other@example.com",
            "password": "secret123",
            "role": "requester",
        },
        headers=_auth_header(admin_id),
    )
    assert response.status_code == 409


def test_update_user_role_as_admin(client, admin_id, db_session):
    user_id = _create_user(db_session, "carol", "carol@example.com", "requester")
    response = client.patch(
        f"/api/users/{user_id}",
        json={"role": "agent"},
        headers=_auth_header(admin_id),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "agent"


def test_deactivate_user_sets_is_active_false(client, admin_id, db_session):
    user_id = _create_user(db_session, "dave", "dave@example.com", "agent")
    response = client.delete(f"/api/users/{user_id}", headers=_auth_header(admin_id))
    assert response.status_code == 204

    with db_session() as db:
        user = db.get(User, user_id)
        assert user is not None
        assert user.is_active is False


def test_non_admin_gets_403(client, db_session):
    requester_id = _create_user(db_session, "erin", "erin@example.com", "requester")
    response = client.get("/api/users", headers=_auth_header(requester_id))
    assert response.status_code == 403


def test_unauthenticated_gets_401(client):
    response = client.get("/api/users")
    assert response.status_code == 401


def test_delete_me_removes_user_from_db(client, db_session):
    user_id = _create_user(db_session, "frank", "frank@example.com", "requester")
    response = client.delete("/api/users/me", headers=_auth_header(user_id))
    assert response.status_code == 204

    with db_session() as db:
        assert db.get(User, user_id) is None
