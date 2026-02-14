"""purge business specifics

Revision ID: 20260207_purge_business_specifics
Revises: 20260204_003
Create Date: 2026-02-07 08:38:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260207_001"
down_revision = "20260204_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop business-specific tables."""
    # Drop in reverse order of dependencies
    op.drop_table("sources")
    op.drop_table("reviews")
    op.drop_table("findings")
    op.drop_table("line_items")
    op.drop_table("queue_requests")
    op.drop_table("documents")
    op.drop_index("ix_deals_id", table_name="deals")
    op.drop_table("deals")

    # Note: Enum types like 'extractionstatus' and 'queuestatus' might still exist in the DB,
    # but dropping the tables removes their usage.


def downgrade() -> None:
    """Downgrade is not supported for this purge."""
    pass
