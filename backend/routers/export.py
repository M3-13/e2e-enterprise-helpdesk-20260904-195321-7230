from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models import User

router = APIRouter(prefix="/api/tickets", tags=["export"])


@router.get("/export")
def export_tickets(current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="export ticket implements csv export")
