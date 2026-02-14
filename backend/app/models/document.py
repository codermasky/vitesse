"""Document model for knowledge base tracking."""

import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, relationship

from app.db.session import Base


class ExtractionStatus(str, enum.Enum):
    """Status of document extraction and vectorization."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Document(Base):
    """Document model for uploaded files with comprehensive metadata."""

    __tablename__ = "documents"

    # Core fields
    id: Mapped[str] = Column(String, primary_key=True, index=True)
    user_id: Mapped[int] = Column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = Column(String, nullable=False)
    type: Mapped[str] = Column(String, nullable=False)  # pdf, docx, etc.
    location: Mapped[str] = Column(String, nullable=False)  # file path or S3 key
    uploaded_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)
    size: Mapped[Optional[int]] = Column(Integer, nullable=True, default=0)

    # Enhanced metadata fields
    description: Mapped[Optional[str]] = Column(Text, nullable=True)
    tags: Mapped[Optional[dict]] = Column(
        JSON, nullable=True
    )  # List of tags stored as JSON
    author: Mapped[Optional[str]] = Column(String, nullable=True)
    version: Mapped[Optional[str]] = Column(String, nullable=True)
    language: Mapped[Optional[str]] = Column(String, nullable=True, default="en")
    category: Mapped[Optional[str]] = Column(String, nullable=True)
    doc_type: Mapped[Optional[str]] = Column(
        String, nullable=True, default="vault"
    )  # vault or archive
    access_level: Mapped[Optional[str]] = Column(
        String, nullable=True, default="private"
    )
    source: Mapped[Optional[str]] = Column(
        String, nullable=True, default="manual"
    )  # manual, email, sharepoint, etc.
    product_id: Mapped[Optional[str]] = Column(String, nullable=True)
    deployment_type: Mapped[Optional[str]] = Column(
        String, nullable=True
    )  # on-prem, cloud, both

    # Extraction flow tracking
    extraction_status: Mapped[str] = Column(
        SQLEnum(ExtractionStatus, native_enum=False),
        nullable=False,
        default=ExtractionStatus.PENDING.value,
    )
    extraction_started_at: Mapped[Optional[datetime]] = Column(DateTime, nullable=True)
    extraction_completed_at: Mapped[Optional[datetime]] = Column(
        DateTime, nullable=True
    )
    extraction_error: Mapped[Optional[str]] = Column(Text, nullable=True)

    # Indexing statistics
    chunk_count: Mapped[Optional[int]] = Column(Integer, nullable=True, default=0)
    text_length: Mapped[Optional[int]] = Column(Integer, nullable=True, default=0)
    embedding_model: Mapped[Optional[str]] = Column(String, nullable=True)

    # Custom extensible metadata
    custom_metadata: Mapped[Optional[dict]] = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User", backref="documents")
