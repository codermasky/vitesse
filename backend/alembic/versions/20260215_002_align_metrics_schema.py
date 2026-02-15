"""align_metrics_schema

Revision ID: 20260215_002
Revises: 20260215_001
Create Date: 2026-02-15 09:50:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260215_002"
down_revision: Union[str, Sequence[str], None] = "20260215_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns
    op.add_column(
        "agent_metrics",
        sa.Column("tasks_completed_today", sa.Integer(), server_default="0"),
    )
    op.add_column(
        "agent_metrics",
        sa.Column("tasks_completed_week", sa.Integer(), server_default="0"),
    )
    op.add_column(
        "agent_metrics",
        sa.Column("average_task_duration", sa.Float(), server_default="0.0"),
    )
    op.add_column(
        "agent_metrics", sa.Column("success_rate", sa.Float(), server_default="0.0")
    )
    op.add_column(
        "agent_metrics",
        sa.Column("collaboration_score", sa.Float(), server_default="0.0"),
    )
    op.add_column(
        "agent_metrics",
        sa.Column("response_time_p95", sa.Float(), server_default="0.0"),
    )

    # Drop old columns that are no longer in the model (optional, but cleaner)
    op.drop_column("agent_metrics", "total_tasks")
    op.drop_column("agent_metrics", "successful_tasks")
    op.drop_column("agent_metrics", "failed_tasks")
    op.drop_column("agent_metrics", "average_execution_time")
    op.drop_column("agent_metrics", "total_execution_time")
    op.drop_column("agent_metrics", "last_error")
    op.drop_column("agent_metrics", "last_error_time")


def downgrade() -> None:
    # Revert changes
    op.add_column(
        "agent_metrics", sa.Column("total_tasks", sa.Integer(), server_default="0")
    )
    op.add_column(
        "agent_metrics", sa.Column("successful_tasks", sa.Integer(), server_default="0")
    )
    op.add_column(
        "agent_metrics", sa.Column("failed_tasks", sa.Integer(), server_default="0")
    )
    op.add_column(
        "agent_metrics",
        sa.Column("average_execution_time", sa.Float(), server_default="0.0"),
    )
    op.add_column(
        "agent_metrics",
        sa.Column("total_execution_time", sa.Float(), server_default="0.0"),
    )
    op.add_column("agent_metrics", sa.Column("last_error", sa.Text(), nullable=True))
    op.add_column(
        "agent_metrics",
        sa.Column("last_error_time", sa.DateTime(timezone=True), nullable=True),
    )

    op.drop_column("agent_metrics", "tasks_completed_today")
    op.drop_column("agent_metrics", "tasks_completed_week")
    op.drop_column("agent_metrics", "average_task_duration")
    op.drop_column("agent_metrics", "success_rate")
    op.drop_column("agent_metrics", "collaboration_score")
    op.drop_column("agent_metrics", "response_time_p95")
