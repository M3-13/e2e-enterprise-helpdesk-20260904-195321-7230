import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

import models  # noqa: F401  # register models on Base.metadata
from auth import get_current_user, require_role
from db import Base
from main import app
from models import User


def test_health_returns_200():
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_all_creates_tables():
    from sqlalchemy import create_engine, inspect

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    tables = set(inspect(engine).get_table_names())
    assert {"users", "tickets", "comments", "audit_logs"}.issubset(tables)


def test_get_current_user_raises_401_without_token():
    scope = {"type": "http", "method": "GET", "path": "/api/tickets", "headers": []}
    request = Request(scope)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request, db=None)
    assert exc_info.value.status_code == 401


def test_require_role_raises_403_for_wrong_role():
    dependency = require_role("admin")
    user = User(id=1, username="u", email="u@example.com", role="requester", is_active=True)
    with pytest.raises(HTTPException) as exc_info:
        dependency(current_user=user)
    assert exc_info.value.status_code == 403


def test_protected_route_rejects_unauthenticated():
    with TestClient(app) as client:
        response = client.get("/api/tickets")
    assert response.status_code == 401
