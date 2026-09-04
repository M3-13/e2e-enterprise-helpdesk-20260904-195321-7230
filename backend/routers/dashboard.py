from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models import User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="dashboard ticket implements metrics")
