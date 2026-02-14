"""Add prompt_templates and prompt_template_history tables

Revision ID: 20260203_001
Revises: add_reviewer_tracking
Create Date: 2026-02-03

This migration adds support for database-backed prompt management with versioning
and A/B testing capabilities.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260203_001"
down_revision = "20260202_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create prompt_templates and prompt_template_history tables."""

    # Create prompt_templates table
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("agent_id", sa.String(100), nullable=False),
        sa.Column("template_name", sa.String(255), nullable=False),
        sa.Column("template_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("tags", postgresql.JSON, nullable=True),
        sa.Column("parameters", postgresql.JSON, nullable=True),
        sa.Column("usage_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("success_rate", sa.Integer, nullable=False, server_default="0"),
        sa.Column("avg_latency_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("avg_cost_usd", sa.Integer, nullable=False, server_default="0"),
        sa.Column("avg_output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "is_experimental", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("experiment_id", sa.String(100), nullable=True),
        sa.Column("control_version_id", sa.String(36), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "created_at_datetime",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("previous_version_id", sa.String(36), nullable=True),
        sa.Column("rollback_reason", sa.Text, nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for common queries
    op.create_index("ix_prompt_templates_agent_id", "prompt_templates", ["agent_id"])
    op.create_index(
        "ix_prompt_templates_template_name", "prompt_templates", ["template_name"]
    )
    op.create_index("ix_prompt_templates_is_active", "prompt_templates", ["is_active"])
    op.create_index(
        "ix_prompt_templates_agent_active",
        "prompt_templates",
        ["agent_id", "is_active"],
    )
    op.create_index(
        "ix_prompt_templates_experiment_id", "prompt_templates", ["experiment_id"]
    )

    # Create prompt_template_history table for audit trail
    op.create_table(
        "prompt_template_history",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("template_id", sa.String(36), nullable=False),
        sa.Column("agent_id", sa.String(100), nullable=False),
        sa.Column("old_content", sa.Text, nullable=True),
        sa.Column("new_content", sa.Text, nullable=False),
        sa.Column("change_type", sa.String(50), nullable=False),
        sa.Column("change_reason", sa.Text, nullable=True),
        sa.Column("changed_by", sa.String(100), nullable=True),
        sa.Column(
            "changed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["template_id"], ["prompt_templates.id"], ondelete="CASCADE"
        ),
    )

    # Create indexes for history queries
    op.create_index(
        "ix_prompt_template_history_template_id",
        "prompt_template_history",
        ["template_id"],
    )
    op.create_index(
        "ix_prompt_template_history_agent_id", "prompt_template_history", ["agent_id"]
    )
    op.create_index(
        "ix_prompt_template_history_change_type",
        "prompt_template_history",
        ["change_type"],
    )
    op.create_index(
        "ix_prompt_template_history_changed_at",
        "prompt_template_history",
        ["changed_at"],
    )


def downgrade() -> None:
    """Drop prompt_templates and prompt_template_history tables."""

    # Drop indexes
    op.drop_index(
        "ix_prompt_template_history_changed_at", table_name="prompt_template_history"
    )
    op.drop_index(
        "ix_prompt_template_history_change_type", table_name="prompt_template_history"
    )
    op.drop_index(
        "ix_prompt_template_history_agent_id", table_name="prompt_template_history"
    )
    op.drop_index(
        "ix_prompt_template_history_template_id", table_name="prompt_template_history"
    )
    op.drop_index("ix_prompt_templates_experiment_id", table_name="prompt_templates")
    op.drop_index("ix_prompt_templates_agent_active", table_name="prompt_templates")
    op.drop_index("ix_prompt_templates_is_active", table_name="prompt_templates")
    op.drop_index("ix_prompt_templates_template_name", table_name="prompt_templates")
    op.drop_index("ix_prompt_templates_agent_id", table_name="prompt_templates")

    # Drop tables
    op.drop_table("prompt_template_history")
    op.drop_table("prompt_templates")
