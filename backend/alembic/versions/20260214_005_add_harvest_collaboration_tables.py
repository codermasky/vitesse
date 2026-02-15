"""add_harvest_collaboration_tables

Revision ID: 952b76236bed
Revises: 20260214_004
Create Date: 2026-02-14 22:49:29.703583

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260214_005"
down_revision: Union[str, Sequence[str], None] = "20260214_004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add harvest collaboration and integration tables."""

    # Create harvest_jobs table
    op.create_table(
        "harvest_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("harvest_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("progress", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_sources", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "processed_sources", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "successful_harvests", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("failed_harvests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("apis_harvested", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("source_ids", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_harvest_jobs_id"), "harvest_jobs", ["id"], unique=False)
    op.create_index(
        op.f("ix_harvest_jobs_harvest_type"),
        "harvest_jobs",
        ["harvest_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_harvest_jobs_status"), "harvest_jobs", ["status"], unique=False
    )

    # Create harvest_job_test_results table
    op.create_table(
        "harvest_job_test_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("test_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("execution_time_ms", sa.Integer(), server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["job_id"], ["harvest_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_harvest_job_test_results_id"),
        "harvest_job_test_results",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_harvest_job_test_results_job_id"),
        "harvest_job_test_results",
        ["job_id"],
        unique=False,
    )

    # Create agent_activities table
    op.create_table(
        "agent_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("agent_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("current_task", sa.Text(), nullable=True),
        sa.Column(
            "last_activity", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("tasks_completed", sa.Integer(), server_default="0"),
        sa.Column("tasks_failed", sa.Integer(), server_default="0"),
        sa.Column("average_response_time", sa.Float(), server_default="0.0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_activities_id"), "agent_activities", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_activities_agent_id"),
        "agent_activities",
        ["agent_id"],
        unique=False,
    )

    # Create agent_communications table
    op.create_table(
        "agent_communications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("from_agent", sa.String(), nullable=False),
        sa.Column("to_agent", sa.String(), nullable=False),
        sa.Column("message_type", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(), server_default="normal"),
        sa.Column("status", sa.String(), server_default="delivered"),
        sa.Column(
            "extra_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_communications_id"), "agent_communications", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_communications_message_type"),
        "agent_communications",
        ["message_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_communications_status"),
        "agent_communications",
        ["status"],
        unique=False,
    )

    # Create agent_metrics table
    op.create_table(
        "agent_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("total_tasks", sa.Integer(), server_default="0"),
        sa.Column("successful_tasks", sa.Integer(), server_default="0"),
        sa.Column("failed_tasks", sa.Integer(), server_default="0"),
        sa.Column("average_execution_time", sa.Float(), server_default="0.0"),
        sa.Column("total_execution_time", sa.Float(), server_default="0.0"),
        sa.Column("error_rate", sa.Float(), server_default="0.0"),
        sa.Column("uptime_percentage", sa.Float(), server_default="100.0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_error_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cpu_usage_avg", sa.Float(), server_default="0.0"),
        sa.Column("memory_usage_avg", sa.Float(), server_default="0.0"),
        sa.Column("active_workflows", sa.Integer(), server_default="0"),
        sa.Column("pending_tasks", sa.Integer(), server_default="0"),
        sa.Column(
            "last_updated",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_metrics_id"), "agent_metrics", ["id"], unique=False)
    op.create_index(
        op.f("ix_agent_metrics_agent_id"), "agent_metrics", ["agent_id"], unique=True
    )

    # Create ui_builder_integrations table
    op.create_table(
        "ui_builder_integrations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_api", sa.String(), nullable=False),
        sa.Column("target_api", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("sync_frequency", sa.String(), nullable=True),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ui_builder_integrations_id"),
        "ui_builder_integrations",
        ["id"],
        unique=False,
    )

    # Create field_mappings table
    op.create_table(
        "field_mappings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("integration_id", sa.String(), nullable=False),
        sa.Column("source_field", sa.String(), nullable=False),
        sa.Column("target_field", sa.String(), nullable=False),
        sa.Column("data_type", sa.String(), server_default="string"),
        sa.Column("required", sa.Boolean(), server_default="true"),
        sa.Column("transformation_rule_id", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["ui_builder_integrations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_field_mappings_id"), "field_mappings", ["id"], unique=False
    )

    # Create transformation_rules table
    op.create_table(
        "transformation_rules",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("integration_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rule_type", sa.String(), nullable=False),
        sa.Column("source_field", sa.String(), nullable=False),
        sa.Column("target_field", sa.String(), nullable=False),
        sa.Column(
            "transformation_logic",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["ui_builder_integrations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_transformation_rules_id"), "transformation_rules", ["id"], unique=False
    )

    # Create integration_test_results table
    op.create_table(
        "integration_test_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("integration_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "start_time", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "request_data", postgresql.JSON(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "response_data", postgresql.JSON(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("execution_time", sa.Integer(), server_default="0"),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["ui_builder_integrations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_integration_test_results_id"),
        "integration_test_results",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema - Remove harvest collaboration and integration tables."""
    op.drop_index(
        op.f("ix_integration_test_results_id"), table_name="integration_test_results"
    )
    op.drop_table("integration_test_results")

    op.drop_index(op.f("ix_transformation_rules_id"), table_name="transformation_rules")
    op.drop_table("transformation_rules")

    op.drop_index(op.f("ix_field_mappings_id"), table_name="field_mappings")
    op.drop_table("field_mappings")

    op.drop_index(
        op.f("ix_ui_builder_integrations_id"), table_name="ui_builder_integrations"
    )
    op.drop_table("ui_builder_integrations")

    op.drop_index(op.f("ix_agent_metrics_agent_id"), table_name="agent_metrics")
    op.drop_index(op.f("ix_agent_metrics_id"), table_name="agent_metrics")
    op.drop_table("agent_metrics")

    op.drop_index(
        op.f("ix_agent_communications_status"), table_name="agent_communications"
    )
    op.drop_index(
        op.f("ix_agent_communications_message_type"), table_name="agent_communications"
    )
    op.drop_index(op.f("ix_agent_communications_id"), table_name="agent_communications")
    op.drop_table("agent_communications")

    op.drop_index(op.f("ix_agent_activities_agent_id"), table_name="agent_activities")
    op.drop_index(op.f("ix_agent_activities_id"), table_name="agent_activities")
    op.drop_table("agent_activities")

    op.drop_index(
        op.f("ix_harvest_job_test_results_job_id"),
        table_name="harvest_job_test_results",
    )
    op.drop_index(
        op.f("ix_harvest_job_test_results_id"), table_name="harvest_job_test_results"
    )
    op.drop_table("harvest_job_test_results")

    op.drop_index(op.f("ix_harvest_jobs_status"), table_name="harvest_jobs")
    op.drop_index(op.f("ix_harvest_jobs_harvest_type"), table_name="harvest_jobs")
    op.drop_index(op.f("ix_harvest_jobs_id"), table_name="harvest_jobs")
    op.drop_table("harvest_jobs")
