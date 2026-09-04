from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import Comment, Ticket, User
from schemas import CommentCreate, CommentOut

router = APIRouter(prefix="/api/tickets", tags=["comments"])


@router.post("/{ticket_id}/comments", status_code=201, response_model=CommentOut)
def create_comment(
    ticket_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Comment:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comment = Comment(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=payload.body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/{ticket_id}/comments", response_model=list[CommentOut])
def list_comments(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Comment]:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role == "requester" and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return db.query(Comment).filter(Comment.ticket_id == ticket_id).order_by(Comment.id.asc()).all()
