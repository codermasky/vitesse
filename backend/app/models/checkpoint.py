from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Column, String, DateTime, LargeBinary, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Checkpoint(Base):
    """
    Model for storing LangGraph checkpoints for fault tolerance.
    """

    __tablename__ = "checkpoints"

    # Composite primary key logic is handled by LangGraph, but for SQL we need a structure.
    # LangGraph checkpoints usually have thread_id and checkpoint_id.

    thread_id: Mapped[str] = mapped_column(String, primary_key=True)
    checkpoint_id: Mapped[str] = mapped_column(String, primary_key=True)

    parent_checkpoint_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # We store the serialized checkpoint as binary
    checkpoint: Mapped[bytes] = mapped_column(LargeBinary)

    # Metadata for the checkpoint
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata", JSONB, default={})

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    def __repr__(self):
        return f"<Checkpoint thread_id={self.thread_id} checkpoint_id={self.checkpoint_id}>"
