import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import JSON, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.db.session import Base


class MappingFeedback(Base):
    """
    Stores successful field mappings and user corrections to improve
    semantic mapping recommendations over time.
    """

    __tablename__ = "mapping_feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Context
    source_field_name: Mapped[str] = mapped_column(String, nullable=False)
    source_field_type: Mapped[str] = mapped_column(String, nullable=False)
    source_field_description: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )

    dest_field_name: Mapped[str] = mapped_column(String, nullable=False)
    dest_field_type: Mapped[str] = mapped_column(String, nullable=False)
    dest_field_description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Transformation logic
    transformation_logic: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Learning signals
    user_corrected: Mapped[bool] = mapped_column(default=False)
    verification_success: Mapped[bool] = mapped_column(default=False)

    # Vector embeddings for semantic search (Dimension 1536 for OpenAI embeddings)
    # We embed 'name: description' for both source and dest
    source_embedding: Mapped[Optional[Any]] = mapped_column(Vector(1536))
    dest_embedding: Mapped[Optional[Any]] = mapped_column(Vector(1536))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index(
            "ix_mapping_feedback_source_embedding",
            source_embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"source_embedding": "vector_cosine_ops"},
        ),
        Index(
            "ix_mapping_feedback_dest_embedding",
            dest_embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"dest_embedding": "vector_cosine_ops"},
        ),
    )
