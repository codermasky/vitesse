import enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserRole(str, enum.Enum):
    """User roles for RBAC."""

    ADMIN = "ADMIN"
    ANALYST = "ANALYST"
    REVIEWER = "REVIEWER"
    REQUESTOR = "REQUESTOR"


class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    role: UserRole = UserRole.REQUESTOR
    sso_provider: Optional[str] = None
    sso_id: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserCreateSSO(BaseModel):
    email: str
    full_name: Optional[str] = None
    sso_provider: str
    sso_id: str
    role: UserRole = UserRole.REQUESTOR


class UserUpdate(UserBase):
    password: Optional[str] = None


class UserUpdateMe(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None


class User(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
