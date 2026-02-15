"""add_agent_name_to_metrics

Revision ID: 20260215_001
Revises: 20260214_005
Create Date: 2026-02-15 09:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260215_001"
down_revision: Union[str, Sequence[str], None] = "20260214_005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agent_metrics", sa.Column("agent_name", sa.String(), nullable=True))
    # Update existing records to have a default value if needed, then alter to nullable=False
    op.execute(
        "UPDATE agent_metrics SET agent_name = 'Unknown Agent' WHERE agent_name IS NULL"
    )
    op.alter_column("agent_metrics", "agent_name", nullable=False)


def downgrade() -> None:
    op.drop_column("agent_metrics", "agent_name")
