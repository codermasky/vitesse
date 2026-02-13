"""
SQLAlchemy database models for Vitesse integrations.
Persists integration data, mapping logic, and deployment configurations.
"""

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Text,
    DateTime,
    JSON,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
import enum


class IntegrationStatusEnum(str, enum.Enum):
    """Integration lifecycle status."""

    INITIALIZING = "initializing"
    DISCOVERING = "discovering"
    MAPPING = "mapping"
    TESTING = "testing"
    DEPLOYING = "deploying"
    ACTIVE = "active"
    UPDATING = "updating"
    FAILED = "failed"
    PAUSED = "paused"


class DeploymentTargetEnum(str, enum.Enum):
    """Deployment target options."""

    LOCAL = "local"
    CLOUD_EKS = "eks"
    CLOUD_ECS = "ecs"


class Integration(Base):
    """ORM model for Integration instances."""

    __tablename__ = "integrations"

    id = Column(String(255), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    status = Column(
        SQLEnum(IntegrationStatusEnum),
        default=IntegrationStatusEnum.INITIALIZING,
        index=True,
    )

    # API Specifications (stored as JSON)
    source_api_spec = Column(JSON, nullable=False)
    dest_api_spec = Column(JSON, nullable=False)

    # Mapping Configuration
    mapping_logic = Column(JSON, nullable=True)

    # Deployment Configuration
    deployment_config = Column(JSON, nullable=False)
    deployment_target = Column(SQLEnum(DeploymentTargetEnum), nullable=False)
    container_id = Column(String(255), nullable=True)

    # Health & Monitoring
    health_score = Column(JSON, nullable=True)
    error_log = Column(Text, nullable=True)
    last_health_check = Column(DateTime, nullable=True)

    # Metadata
    created_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False
    )
    extra_metadata = Column(JSON, default={})

    # Relationships
    test_results = relationship(
        "TestResult", back_populates="integration", cascade="all, delete-orphan"
    )
    transformations = relationship(
        "Transformation", back_populates="integration", cascade="all, delete-orphan"
    )
    audit_logs = relationship(
        "IntegrationAuditLog",
        back_populates="integration",
        cascade="all, delete-orphan",
    )


class Transformation(Base):
    """ORM model for data transformation rules."""

    __tablename__ = "transformations"

    id = Column(String(255), primary_key=True, index=True)
    integration_id = Column(
        String(255), ForeignKey("integrations.id"), nullable=False, index=True
    )

    source_field = Column(String(255), nullable=False)
    dest_field = Column(String(255), nullable=False)
    transform_type = Column(String(50), default="direct")
    transform_config = Column(JSON, default={})

    required = Column(Boolean, default=False)
    default_value = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    integration = relationship("Integration", back_populates="transformations")


class TestResult(Base):
    """ORM model for test execution results."""

    __tablename__ = "test_results"

    id = Column(String(255), primary_key=True, index=True)
    integration_id = Column(
        String(255), ForeignKey("integrations.id"), nullable=False, index=True
    )

    test_id = Column(String(255), nullable=False)
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Float, nullable=False)
    success = Column(Boolean, nullable=False)
    error_message = Column(Text, nullable=True)

    test_payload = Column(JSON, nullable=True)
    test_response = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=func.now(), index=True)

    # Relationships
    integration = relationship("Integration", back_populates="test_results")


class IntegrationAuditLog(Base):
    """ORM model for audit logging."""

    __tablename__ = "integration_audit_logs"

    id = Column(String(255), primary_key=True, index=True)
    integration_id = Column(
        String(255), ForeignKey("integrations.id"), nullable=False, index=True
    )

    action = Column(
        String(50), nullable=False
    )  # created, updated, tested, deployed, etc
    actor = Column(String(255), nullable=False)  # user_id or system
    status = Column(String(50), nullable=False)  # success, failed, partial
    details = Column(JSON, default={})

    created_at = Column(DateTime, default=func.now(), index=True)

    # Relationships
    integration = relationship("Integration", back_populates="audit_logs")


class DeploymentLog(Base):
    """ORM model for deployment tracking."""

    __tablename__ = "deployment_logs"

    id = Column(String(255), primary_key=True, index=True)
    integration_id = Column(String(255), nullable=False, index=True)

    deployment_target = Column(SQLEnum(DeploymentTargetEnum), nullable=False)
    status = Column(String(50), nullable=False)  # pending, in_progress, success, failed
    container_id = Column(String(255), nullable=True)
    image_uri = Column(String(255), nullable=True)

    deployment_config = Column(JSON, nullable=False)
    logs = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "integration_id", "started_at", name="_integration_timestamp_uc"
        ),
    )
