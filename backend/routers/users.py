from fastapi import APIRouter, Depends, HTTPException

from auth import require_role
from models import User

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(current_user: User = Depends(require_role("admin"))) -> None:
    raise HTTPException(status_code=501, detail="users ticket implements list")


@router.post("", status_code=201)
def create_user(current_user: User = Depends(require_role("admin"))) -> None:
    raise HTTPException(status_code=501, detail="users ticket implements create")


@router.delete("/me", status_code=204)
def delete_me(current_user: User = Depends(require_role("admin"))) -> None:
    raise HTTPException(status_code=501, detail="users ticket implements delete self")


@router.patch("/{user_id}")
def update_user(user_id: int, current_user: User = Depends(require_role("admin"))) -> None:
    raise HTTPException(status_code=501, detail="users ticket implements update")


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, current_user: User = Depends(require_role("admin"))) -> None:
    raise HTTPException(status_code=501, detail="users ticket implements delete")
