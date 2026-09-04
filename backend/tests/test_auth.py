import os

import pytest
from fastapi.testclient import TestClient

import routers.auth as auth_router
from auth import hash_password
from db import SessionLocal, create_all
from main import app
from models import User

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-auth-tests-0123456789")

_TEST_USERNAMES = ["alice", "bob", "carol", "dave", "erin", "frank"]


@pytest.fixture(autouse=True)
def _clean_state():
    auth_router._register_limiter.reset()
    auth_router._login_limiter.reset()
    create_all()
    with SessionLocal() as db:
        db.query(User).filter(User.username.in_(_TEST_USERNAMES)).delete(synchronize_session=False)
        db.commit()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_register_returns_201(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "secret123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "alice"
    assert body["email"] == "alice@example.com"
    assert body["role"] == "requester"
    assert body["is_active"] is True


def test_login_returns_token(client):
    client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@example.com", "password": "secret123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "bob", "password": "secret123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["username"] == "bob"


def test_login_wrong_password_returns_401(client):
    client.post(
        "/api/auth/register",
        json={"username": "carol", "email": "carol@example.com", "password": "secret123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "carol", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_duplicate_registration_returns_409(client):
    payload = {"username": "dave", "email": "dave@example.com", "password": "secret123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 409


def test_stored_password_has_bcrypt_prefix(client):
    client.post(
        "/api/auth/register",
        json={"username": "erin", "email": "erin@example.com", "password": "secret123"},
    )
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == "erin").first()
        assert user is not None
        assert user.password_hash.startswith("$2b$")


def test_disabled_user_returns_403(client):
    with SessionLocal() as db:
        user = User(
            username="frank",
            email="frank@example.com",
            password_hash=hash_password("secret123"),
            role="requester",
            is_active=False,
        )
        db.add(user)
        db.commit()

    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "frank", "password": "secret123"},
    )
    assert response.status_code == 403


def test_rate_limit_returns_429(client):
    for _ in range(5):
        response = client.post(
            "/api/auth/login",
            json={"username_or_email": "nobody", "password": "wrong"},
        )
        assert response.status_code == 401
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "nobody", "password": "wrong"},
    )
    assert response.status_code == 429


def test_logout_returns_204(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
