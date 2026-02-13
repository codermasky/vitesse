"""LangFuse Configuration Model"""

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime
from app.db.session import Base


class LangFuseConfig(Base):
    """LangFuse monitoring configuration stored in database"""

    __tablename__ = "langfuse_config"

    id = Column(
        String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    public_key = Column(String(255), nullable=False)
    secret_key = Column(String(255), nullable=False)
    host = Column(String(500), nullable=False, default="http://localhost:3000")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<LangFuseConfig(id={self.id}, enabled={self.enabled})>"
