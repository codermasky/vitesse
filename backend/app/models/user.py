import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, relationship

from app.db.session import Base


class UserRole(str, enum.Enum):
    """User roles for RBAC."""

    ADMIN = "ADMIN"
    ANALYST = "ANALYST"
    REVIEWER = "REVIEWER"
    REQUESTOR = "REQUESTOR"


class User(Base):
    """User model for authentication and authorization."""

    __tablename__ = "users"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    email: Mapped[str] = Column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = Column(String)
    full_name: Mapped[Optional[str]] = Column(String)
    is_active: Mapped[bool] = Column(Boolean, default=True)
    is_superuser: Mapped[bool] = Column(Boolean, default=False)
    role: Mapped[UserRole] = Column(
        Enum(UserRole), default=UserRole.REQUESTOR, nullable=False
    )
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    sso_provider: Mapped[Optional[str]] = Column(String)
    sso_id: Mapped[Optional[str]] = Column(String, unique=True, index=True)

    # queue_requests = relationship("QueueRequest", back_populates="requestor")
