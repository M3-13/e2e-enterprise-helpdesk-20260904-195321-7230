from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models import User

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("")
def list_tickets(current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="tickets ticket implements list")


@router.post("", status_code=201)
def create_ticket(current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="tickets ticket implements create")


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="tickets ticket implements detail")


@router.patch("/{ticket_id}")
def update_ticket(ticket_id: int, current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="tickets ticket implements update")


@router.post("/{ticket_id}/assign")
def assign_ticket(ticket_id: int, current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="tickets ticket implements assign")


@router.post("/{ticket_id}/close")
def close_ticket(ticket_id: int, current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="tickets ticket implements close")
