from sqlalchemy import Column, String, Boolean, JSON, Integer
from sqlalchemy.orm import Mapped

from app.db.session import Base


class SystemSetting(Base):
    """Database model for System Settings."""

    __tablename__ = "system_settings"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    key: Mapped[str] = Column(String, unique=True, index=True, nullable=False)
    value: Mapped[str] = Column(JSON, nullable=False)  # Store as JSON for flexibility
    description: Mapped[str] = Column(String, nullable=True)
    is_encrypted: Mapped[bool] = Column(Boolean, default=False)
