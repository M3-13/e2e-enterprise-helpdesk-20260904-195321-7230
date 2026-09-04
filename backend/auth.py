import os
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from db import get_db
from models import User

ALGORITHM = "HS256"

_pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__ident="2b", deprecated="auto")


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or len(secret) < 32:
        raise RuntimeError("JWT_SECRET is required and must be at least 32 characters")
    return secret


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header[len("Bearer ") :].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token") from None

    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token") from None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user


def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str) -> str:
    expire_minutes = int(os.environ.get("TOKEN_EXPIRE_MINUTES", "30"))
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": now + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)
