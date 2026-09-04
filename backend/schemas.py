from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["requester", "agent", "admin"]
Priority = Literal["low", "medium", "high", "critical"]
Status = Literal["open", "in_progress", "closed"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: Role
    is_active: bool


class UserCreate(BaseModel):
    username: str = Field(max_length=255)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8)
    role: Role = "requester"


class UserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


class RegisterRequest(BaseModel):
    username: str = Field(max_length=255)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TicketCreate(BaseModel):
    title: str = Field(max_length=255)
    description: str = Field(max_length=5000)
    category: str = Field(max_length=100)
    priority: Priority


class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, max_length=100)
    priority: Priority | None = None
    status: Status | None = None


class TicketAssign(BaseModel):
    agent_id: int | None = None


class CommentCreate(BaseModel):
    body: str = Field(max_length=5000)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    author_id: int
    body: str
    created_at: datetime


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    user_id: int
    field: str
    old_value: str | None = None
    new_value: str | None = None
    created_at: datetime


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: str
    priority: Priority
    status: Status
    due_date: datetime | None = None
    assignee_id: int | None = None
    requester_id: int
    created_at: datetime
    updated_at: datetime


class TicketDetail(TicketOut):
    comments: list[CommentOut] = []
    audit_log: list[AuditLogOut] = []
