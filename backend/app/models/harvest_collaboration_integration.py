"""
Database models for harvest jobs, agent collaboration, and integrations.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Boolean,
    Float,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class HarvestJob(Base):
    """Database model for harvest jobs."""

    __tablename__ = "harvest_jobs"

    id = Column(String, primary_key=True, index=True)
    harvest_type = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="queued", index=True)
    progress = Column(Float, default=0.0)
    total_sources = Column(Integer, default=0)
    processed_sources = Column(Integer, default=0)
    successful_harvests = Column(Integer, default=0)
    failed_harvests = Column(Integer, default=0)
    apis_harvested = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    source_ids = Column(JSON, nullable=True)  # List of source IDs to harvest from

    # Relationships
    test_results = relationship(
        "HarvestJobTestResult", back_populates="job", cascade="all, delete-orphan"
    )


class HarvestJobTestResult(Base):
    """Database model for harvest job test results."""

    __tablename__ = "harvest_job_test_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(
        String, ForeignKey("harvest_jobs.id", ondelete="CASCADE"), nullable=False
    )
    test_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="completed")
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    result_data = Column(JSON, nullable=True)
    execution_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    job = relationship("HarvestJob", back_populates="test_results")


class AgentActivity(Base):
    """Database model for agent activity tracking."""

    __tablename__ = "agent_activities"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String, nullable=False, index=True)
    agent_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="idle", index=True)
    current_task = Column(String, nullable=True)
    last_activity = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    tasks_completed = Column(Integer, default=0)
    tasks_failed = Column(Integer, default=0)
    average_response_time = Column(Float, default=0.0)  # in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AgentCommunication(Base):
    """Database model for inter-agent communications."""

    __tablename__ = "agent_communications"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    from_agent = Column(String, nullable=False, index=True)
    to_agent = Column(String, nullable=False, index=True)
    message_type = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    priority = Column(String, default="normal")
    status = Column(String, default="delivered", index=True)
    extra_metadata = Column(JSON, nullable=True)


class AgentMetrics(Base):
    """Database model for detailed agent metrics."""

    __tablename__ = "agent_metrics"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String, nullable=False, unique=True, index=True)
    agent_name = Column(String, nullable=False)
    uptime_percentage = Column(Float, default=0.0)
    tasks_completed_today = Column(Integer, default=0)
    tasks_completed_week = Column(Integer, default=0)
    average_task_duration = Column(Float, default=0.0)
    success_rate = Column(Float, default=0.0)
    error_rate = Column(Float, default=0.0)
    collaboration_score = Column(Float, default=0.0)
    response_time_p95 = Column(Float, default=0.0)
    cpu_usage_avg = Column(Float, default=0.0)
    memory_usage_avg = Column(Float, default=0.0)
    active_workflows = Column(Integer, default=0)
    pending_tasks = Column(Integer, default=0)
    last_updated = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class IntegrationBuilder(Base):
    """Database model for UI builder integrations."""

    __tablename__ = "ui_builder_integrations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_api = Column(String, nullable=False)
    target_api = Column(String, nullable=False)
    status = Column(String, default="draft", index=True)
    last_sync = Column(DateTime(timezone=True), nullable=True)
    success_rate = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    field_mappings = relationship(
        "FieldMapping", back_populates="integration", cascade="all, delete-orphan"
    )
    transformation_rules = relationship(
        "TransformationRule", back_populates="integration", cascade="all, delete-orphan"
    )
    test_results = relationship(
        "IntegrationTestResult",
        back_populates="integration",
        cascade="all, delete-orphan",
    )


class FieldMapping(Base):
    """Database model for field mappings in integrations."""

    __tablename__ = "field_mappings"

    id = Column(String, primary_key=True, index=True)
    integration_id = Column(
        String, ForeignKey("ui_builder_integrations.id"), nullable=False, index=True
    )
    source_field = Column(String, nullable=False)
    target_field = Column(String, nullable=False)
    data_type = Column(String, default="string")
    required = Column(Boolean, default=True)
    transformation_rule_id = Column(
        String, ForeignKey("transformation_rules.id"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    integration = relationship("IntegrationBuilder", back_populates="field_mappings")
    transformation_rule = relationship(
        "TransformationRule", foreign_keys=[transformation_rule_id]
    )


class TransformationRule(Base):
    """Database model for transformation rules."""

    __tablename__ = "transformation_rules"

    id = Column(String, primary_key=True, index=True)
    integration_id = Column(
        String, ForeignKey("ui_builder_integrations.id"), nullable=False
    )
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(String, nullable=False)
    source_field = Column(String, nullable=False)
    target_field = Column(String, nullable=False)
    transformation_logic = Column(JSON, nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    integration = relationship(
        "IntegrationBuilder", back_populates="transformation_rules"
    )


class IntegrationTestResult(Base):
    """Database model for integration test results."""

    __tablename__ = "integration_test_results"

    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(
        String,
        ForeignKey("ui_builder_integrations.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(String, nullable=False, default="running", index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    success = Column(Boolean, nullable=True)
    error_message = Column(Text, nullable=True)
    request_data = Column(JSON, nullable=True)
    response_data = Column(JSON, nullable=True)
    execution_time = Column(Integer, default=0)  # in milliseconds

    # Relationships
    integration = relationship("IntegrationBuilder", back_populates="test_results")
