import pytest
from pydantic import ValidationError

from schemas import (
    CommentCreate,
    RegisterRequest,
    TicketCreate,
    TicketUpdate,
    UserCreate,
)


@pytest.mark.parametrize(
    "model,payload",
    [
        (
            TicketCreate,
            {"title": "x" * 256, "description": "d", "category": "c", "priority": "low"},
        ),
        (
            TicketCreate,
            {"title": "t", "description": "d" * 5001, "category": "c", "priority": "low"},
        ),
        (
            TicketCreate,
            {"title": "t", "description": "d", "category": "c" * 101, "priority": "low"},
        ),
        (CommentCreate, {"body": "b" * 5001}),
    ],
)
def test_too_long_freitext_rejected(model, payload):
    with pytest.raises(ValidationError):
        model(**payload)


@pytest.mark.parametrize(
    "model,payload",
    [
        (UserCreate, {"username": "u" * 256, "email": "a@b.co", "password": "secret123"}),
        (UserCreate, {"username": "u", "email": "a@b.co", "password": "short"}),
        (RegisterRequest, {"username": "u" * 256, "email": "a@b.co", "password": "secret123"}),
        (RegisterRequest, {"username": "u", "email": "a@b.co", "password": "short"}),
    ],
)
def test_too_long_username_or_short_password_rejected(model, payload):
    with pytest.raises(ValidationError):
        model(**payload)


@pytest.mark.parametrize(
    "model,payload",
    [
        (TicketCreate, {"title": "t", "description": "d", "category": "c", "priority": "low"}),
        (CommentCreate, {"body": "b"}),
        (UserCreate, {"username": "u", "email": "a@b.co", "password": "secret123"}),
        (RegisterRequest, {"username": "u", "email": "a@b.co", "password": "secret123"}),
    ],
)
def test_valid_payloads_are_accepted(model, payload):
    assert model(**payload)


def test_password_exactly_eight_chars_is_accepted():
    assert RegisterRequest(username="u", email="a@b.co", password="12345678")


def test_update_optional_fields_respect_limits():
    with pytest.raises(ValidationError):
        TicketUpdate(title="x" * 256)
