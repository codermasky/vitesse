import uuid
from datetime import datetime
from typing import List, Optional, Any, Dict
from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Integer,
    Boolean,
)
from sqlalchemy.orm import Mapped, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class ChatSession(Base):
    """Model for a chat session."""

    __tablename__ = "chat_sessions"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[int] = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )  # nullable for anonymous/demo
    title: Mapped[str] = Column(String, default="New Chat")
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    is_saved: Mapped[bool] = Column(Boolean, default=False)

    # Relationships
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    """Model for a chat message."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = Column(
        String, ForeignKey("chat_sessions.id"), nullable=False
    )
    role: Mapped[str] = Column(String, nullable=False)  # user, assistant, system
    content: Mapped[str] = Column(Text, nullable=False)
    metadata_: Mapped[Dict[str, Any]] = Column("metadata", JSON, default={})
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session: Mapped["ChatSession"] = relationship(
        "ChatSession", back_populates="messages"
    )
