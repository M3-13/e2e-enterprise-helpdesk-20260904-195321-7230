from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from auth import get_current_user, require_role
from db import get_db
from models import AuditLog, Comment, Ticket, User
from schemas import AuditLogOut, CommentOut, TicketOut, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("", response_model=list[UserOut])
def list_users(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.query(User).order_by(User.id).all())


@router.post("", status_code=201, response_model=UserOut)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> User:
    existing = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.email))
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Benutzername oder E-Mail bereits vergeben")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=_pwd_context.hash(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user


@router.get("/me/export")
def export_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    tickets = (
        db.query(Ticket)
        .filter((Ticket.requester_id == current_user.id) | (Ticket.assignee_id == current_user.id))
        .order_by(Ticket.id.asc())
        .all()
    )
    comments = (
        db.query(Comment)
        .filter(Comment.author_id == current_user.id)
        .order_by(Comment.id.asc())
        .all()
    )
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.id.asc())
        .all()
    )
    return {
        "user": UserOut.model_validate(current_user).model_dump(mode="json"),
        "tickets": [TicketOut.model_validate(t).model_dump(mode="json") for t in tickets],
        "comments": [CommentOut.model_validate(c).model_dump(mode="json") for c in comments],
        "audit_log": [AuditLogOut.model_validate(a).model_dump(mode="json") for a in audit_logs],
    }


@router.delete("/me", status_code=204)
def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    user_id = current_user.id

    db.query(Ticket).filter(Ticket.assignee_id == user_id).update(
        {Ticket.assignee_id: None}, synchronize_session=False
    )

    requested_ticket_ids = [
        row[0] for row in db.query(Ticket.id).filter(Ticket.requester_id == user_id).all()
    ]
    if requested_ticket_ids:
        db.query(Comment).filter(Comment.ticket_id.in_(requested_ticket_ids)).delete(
            synchronize_session=False
        )
        db.query(AuditLog).filter(AuditLog.ticket_id.in_(requested_ticket_ids)).delete(
            synchronize_session=False
        )
        db.query(Ticket).filter(Ticket.requester_id == user_id).delete(synchronize_session=False)

    db.query(Comment).filter(Comment.author_id == user_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete(synchronize_session=False)

    user = db.get(User, user_id)
    if user is not None:
        db.delete(user)
    db.commit()


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    user.is_active = False
    db.commit()
