"""add_vitesse_integrations

Revision ID: vitesse_001
Revises: 2740f47ba7ef
Create Date: 2026-02-12 19:25:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "vitesse_001"
down_revision: Union[str, Sequence[str], None] = "2740f47ba7ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add Vitesse integration tables."""

    # Create integrations table
    op.create_table(
        "integrations",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "status", sa.String(50), nullable=False, server_default="initializing"
        ),
        sa.Column("source_api_spec", sa.JSON(), nullable=False),
        sa.Column("dest_api_spec", sa.JSON(), nullable=False),
        sa.Column("mapping_logic", sa.JSON(), nullable=True),
        sa.Column("deployment_config", sa.JSON(), nullable=False),
        sa.Column("deployment_target", sa.String(50), nullable=False),
        sa.Column("container_id", sa.String(255), nullable=True),
        sa.Column("health_score", sa.JSON(), nullable=True),
        sa.Column("error_log", sa.Text(), nullable=True),
        sa.Column("last_health_check", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.Column("extra_metadata", sa.JSON(), server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_integrations_id", "id"),
        sa.Index("ix_integrations_name", "name"),
        sa.Index("ix_integrations_status", "status"),
        sa.Index("ix_integrations_created_by", "created_by"),
    )

    # Create transformations table
    op.create_table(
        "transformations",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("integration_id", sa.String(255), nullable=False),
        sa.Column("source_field", sa.String(255), nullable=False),
        sa.Column("dest_field", sa.String(255), nullable=False),
        sa.Column("transform_type", sa.String(50), server_default="direct"),
        sa.Column("transform_config", sa.JSON(), server_default="{}"),
        sa.Column("required", sa.Boolean(), server_default=sa.false()),
        sa.Column("default_value", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["integrations.id"], ondelete="CASCADE"
        ),
        sa.Index("ix_transformations_id", "id"),
        sa.Index("ix_transformations_integration_id", "integration_id"),
    )

    # Create test_results table
    op.create_table(
        "test_results",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("integration_id", sa.String(255), nullable=False),
        sa.Column("test_id", sa.String(255), nullable=False),
        sa.Column("endpoint", sa.String(255), nullable=False),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_time_ms", sa.Float(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("test_payload", sa.JSON(), nullable=True),
        sa.Column("test_response", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), index=True
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["integrations.id"], ondelete="CASCADE"
        ),
        sa.Index("ix_test_results_id", "id"),
        sa.Index("ix_test_results_integration_id", "integration_id"),
    )

    # Create integration_audit_logs table
    op.create_table(
        "integration_audit_logs",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("integration_id", sa.String(255), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("actor", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("details", sa.JSON(), server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), index=True
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["integrations.id"], ondelete="CASCADE"
        ),
        sa.Index("ix_integration_audit_logs_id", "id"),
        sa.Index("ix_integration_audit_logs_integration_id", "integration_id"),
    )

    # Create deployment_logs table
    op.create_table(
        "deployment_logs",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("integration_id", sa.String(255), nullable=False),
        sa.Column("deployment_target", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("container_id", sa.String(255), nullable=True),
        sa.Column("image_uri", sa.String(255), nullable=True),
        sa.Column("deployment_config", sa.JSON(), nullable=False),
        sa.Column("logs", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["integration_id"], ["integrations.id"], ondelete="CASCADE"
        ),
        sa.Index("ix_deployment_logs_id", "id"),
        sa.Index("ix_deployment_logs_integration_id", "integration_id"),
    )


def downgrade() -> None:
    """Downgrade schema - Remove Vitesse integration tables."""
    op.drop_table("deployment_logs")
    op.drop_table("integration_audit_logs")
    op.drop_table("test_results")
    op.drop_table("transformations")
    op.drop_table("integrations")
