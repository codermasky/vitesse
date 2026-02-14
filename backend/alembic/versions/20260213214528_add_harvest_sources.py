"""add_harvest_sources

Revision ID: b1603f34b09e
Revises: vitesse_001
Create Date: 2026-02-13 21:45:28.954830

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1603f34b09e"
down_revision: Union[str, Sequence[str], None] = "vitesse_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add harvest sources table."""
    op.create_table(
        "harvest_sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, default=True),
        sa.Column("priority", sa.Integer(), nullable=False, default=0),
        sa.Column("auth_type", sa.String(50), nullable=True),
        sa.Column("auth_config", sa.JSON(), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("last_harvested_at", sa.DateTime(), nullable=True),
        sa.Column("harvest_count", sa.Integer(), nullable=False, default=0),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_harvest_sources_id"), "harvest_sources", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_harvest_sources_name"), "harvest_sources", ["name"], unique=False
    )
    op.create_index(
        op.f("ix_harvest_sources_type"), "harvest_sources", ["type"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema - Remove harvest sources table."""
    op.drop_index(op.f("ix_harvest_sources_type"), table_name="harvest_sources")
    op.drop_index(op.f("ix_harvest_sources_name"), table_name="harvest_sources")
    op.drop_index(op.f("ix_harvest_sources_id"), table_name="harvest_sources")
    op.drop_table("harvest_sources")
