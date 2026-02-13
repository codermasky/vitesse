from sqlalchemy import Column, Integer, String, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.db.session import Base


class QueueStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class QueueRequest(Base):
    __tablename__ = "queue_requests"

    id = Column(String, primary_key=True, index=True)
    workflow_id = Column(String, index=True)
    status = Column(Enum(QueueStatus), default=QueueStatus.PENDING)
    progress_stage = Column(String, nullable=True)
    progress_percentage = Column(Integer, default=0)
    active_node_id = Column(String, nullable=True)
    requestor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    requestor = relationship("User", backref="queue_requests")

    # Generic data container
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
