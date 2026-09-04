import os

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db import get_db
from models import User

ALGORITHM = "HS256"


def _jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "")


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
    raise NotImplementedError("auth ticket implements hash_password")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    raise NotImplementedError("auth ticket implements verify_password")


def create_access_token(user_id: int, role: str) -> str:
    raise NotImplementedError("auth ticket implements create_access_token")
