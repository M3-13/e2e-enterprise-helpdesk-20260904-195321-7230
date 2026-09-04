import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import create_access_token, hash_password, verify_password
from db import get_db
from models import User
from schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LENGTH = 8
_RATE_LIMIT = 5
_RATE_WINDOW_SECONDS = 60.0


class _RateLimiter:
    def __init__(self, limit: int, window: float) -> None:
        self._limit = limit
        self._window = window
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.monotonic()
        cutoff = now - self._window
        self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]
        if len(self._attempts[key]) >= self._limit:
            raise HTTPException(status_code=429, detail="Too many attempts, try again later")
        self._attempts[key].append(now)

    def reset(self) -> None:
        self._attempts.clear()


_register_limiter = _RateLimiter(_RATE_LIMIT, _RATE_WINDOW_SECONDS)
_login_limiter = _RateLimiter(_RATE_LIMIT, _RATE_WINDOW_SECONDS)


def _client_ip(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host


@router.post("/register", status_code=201, response_model=UserOut)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> User:
    _register_limiter.check(_client_ip(request))

    if len(payload.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters long")

    existing = (
        db.query(User)
        .filter(or_(User.username == payload.username, User.email == payload.email))
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username or email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="requester",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    _login_limiter.check(_client_ip(request))

    user = (
        db.query(User)
        .filter(
            or_(
                User.username == payload.username_or_email,
                User.email == payload.username_or_email,
            )
        )
        .first()
    )

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_access_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout() -> None:
    return None
