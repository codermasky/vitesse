"""add_discovery_columns

Add source_discovery and dest_discovery columns to integrations table.
Also make source_api_spec and dest_api_spec nullable since they're populated after ingest.

Revision ID: 20260214_004
Revises: 20260214_003
Create Date: 2026-02-14 22:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260214_004"
down_revision = "20260214_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add discovery columns and make spec columns nullable."""

    # Add source_discovery column
    op.add_column(
        "integrations",
        sa.Column("source_discovery", sa.JSON(), nullable=True),
    )

    # Add dest_discovery column
    op.add_column(
        "integrations",
        sa.Column("dest_discovery", sa.JSON(), nullable=True),
    )

    # Make source_api_spec nullable (populated after ingest step)
    op.alter_column(
        "integrations",
        "source_api_spec",
        existing_type=sa.JSON(),
        nullable=True,
    )

    # Make dest_api_spec nullable (populated after ingest step)
    op.alter_column(
        "integrations",
        "dest_api_spec",
        existing_type=sa.JSON(),
        nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema - Remove discovery columns and revert spec columns to not nullable."""

    # Revert source_api_spec to not nullable
    op.alter_column(
        "integrations",
        "source_api_spec",
        existing_type=sa.JSON(),
        nullable=False,
    )

    # Revert dest_api_spec to not nullable
    op.alter_column(
        "integrations",
        "dest_api_spec",
        existing_type=sa.JSON(),
        nullable=False,
    )

    # Drop dest_discovery column
    op.drop_column("integrations", "dest_discovery")

    # Drop source_discovery column
    op.drop_column("integrations", "source_discovery")
