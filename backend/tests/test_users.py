import os
import tempfile

import jwt
import pytest
from fastapi.testclient import TestClient

_tmp_db = os.path.join(tempfile.gettempdir(), "test_users.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db}"
os.environ["JWT_SECRET"] = "test-users-secret-0123456789-abcdefghijklmnopqrstuvwxyz"

from db import SessionLocal, create_all  # noqa: E402
from main import app  # noqa: E402
from models import User  # noqa: E402


def _create_user(username: str, email: str, role: str, is_active: bool = True) -> int:
    with SessionLocal() as db:
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
    token = jwt.encode(
        {"sub": str(user_id), "role": "admin"},
        "test-users-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _clean_users():
    create_all()
    with SessionLocal() as db:
        db.query(User).delete()
        db.commit()
    yield


@pytest.fixture()
def admin_id() -> int:
    return _create_user("admin", "admin@example.com", "admin")


def test_list_users_as_admin(client, admin_id):
    _create_user("alice", "alice@example.com", "requester")
    response = client.get("/api/users", headers=_auth_header(admin_id))
    assert response.status_code == 200
    usernames = {u["username"] for u in response.json()}
    assert {"admin", "alice"}.issubset(usernames)


def test_create_user_as_admin(client, admin_id):
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

    with SessionLocal() as db:
        stored = db.query(User).filter(User.username == "bob").one()
        assert stored.password_hash != "secret123"
        assert stored.password_hash.startswith("$2")


def test_create_user_duplicate_returns_409(client, admin_id):
    _create_user("bob", "bob@example.com", "requester")
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


def test_update_user_role_as_admin(client, admin_id):
    user_id = _create_user("carol", "carol@example.com", "requester")
    response = client.patch(
        f"/api/users/{user_id}",
        json={"role": "agent"},
        headers=_auth_header(admin_id),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "agent"


def test_deactivate_user_sets_is_active_false(client, admin_id):
    user_id = _create_user("dave", "dave@example.com", "agent")
    response = client.delete(f"/api/users/{user_id}", headers=_auth_header(admin_id))
    assert response.status_code == 204

    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        assert user.is_active is False


def test_non_admin_gets_403(client, admin_id):
    requester_id = _create_user("erin", "erin@example.com", "requester")
    response = client.get("/api/users", headers=_auth_header(requester_id))
    assert response.status_code == 403


def test_unauthenticated_gets_401(client):
    response = client.get("/api/users")
    assert response.status_code == 401


def test_delete_me_removes_user_from_db(client):
    user_id = _create_user("frank", "frank@example.com", "requester")
    response = client.delete("/api/users/me", headers=_auth_header(user_id))
    assert response.status_code == 204

    with SessionLocal() as db:
        assert db.get(User, user_id) is None


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
