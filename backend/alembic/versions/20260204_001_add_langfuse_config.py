"""Add langfuse_config table

Revision ID: 20260204_add_langfuse_config
Revises: 20260203_001
Create Date: 2026-02-04

This migration adds the langfuse_config table for storing LangFuse API configuration
in the database instead of environment variables.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260204_001"
down_revision = "20260203_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create langfuse_config table."""

    op.create_table(
        "langfuse_config",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("public_key", sa.String(255), nullable=False),
        sa.Column("secret_key", sa.String(255), nullable=False),
        sa.Column(
            "host",
            sa.String(500),
            nullable=False,
            server_default="http://localhost:3000",
        ),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for common queries
    op.create_index("ix_langfuse_config_enabled", "langfuse_config", ["enabled"])


def downgrade() -> None:
    """Drop langfuse_config table."""

    op.drop_index("ix_langfuse_config_enabled", table_name="langfuse_config")
    op.drop_table("langfuse_config")
