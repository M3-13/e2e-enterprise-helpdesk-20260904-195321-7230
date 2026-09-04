from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models import User

router = APIRouter(prefix="/api/tickets", tags=["comments"])


@router.post("/{ticket_id}/comments", status_code=201)
def create_comment(ticket_id: int, current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="comments ticket implements create")


@router.get("/{ticket_id}/comments")
def list_comments(ticket_id: int, current_user: User = Depends(get_current_user)) -> None:
    raise HTTPException(status_code=501, detail="comments ticket implements list")
