"""fix_integration_enum

Revision ID: fix_integration_enum
Revises: b1603f34b09e
Create Date: 2026-02-14 07:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260214_001"
down_revision = "20260213_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create enum types and update columns."""

    # Define enums
    integration_status_enum = postgresql.ENUM(
        "initializing",
        "discovering",
        "mapping",
        "testing",
        "deploying",
        "active",
        "updating",
        "failed",
        "paused",
        name="integrationstatusenum",
    )

    deployment_target_enum = postgresql.ENUM(
        "local", "eks", "ecs", name="deploymenttargetenum"
    )

    # Create types
    integration_status_enum.create(op.get_bind(), checkfirst=True)
    deployment_target_enum.create(op.get_bind(), checkfirst=True)

    # Update columns
    # We need to drop default first, change type, then set default again

    # 1. Drop default for status
    op.execute("ALTER TABLE integrations ALTER COLUMN status DROP DEFAULT")

    # 2. Change types using explicit cast
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status TYPE integrationstatusenum USING status::integrationstatusenum"
    )
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN deployment_target TYPE deploymenttargetenum USING deployment_target::deploymenttargetenum"
    )
    op.execute(
        "ALTER TABLE deployment_logs ALTER COLUMN deployment_target TYPE deploymenttargetenum USING deployment_target::deploymenttargetenum"
    )

    # 3. Set default for status back to 'initializing' (as enum)
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status SET DEFAULT 'initializing'::integrationstatusenum"
    )


def downgrade() -> None:
    """Downgrade schema - Revert to strings and drop enums."""

    # Drop default first
    op.execute("ALTER TABLE integrations ALTER COLUMN status DROP DEFAULT")

    # Revert columns to String
    op.alter_column(
        "deployment_logs",
        "deployment_target",
        type_=sa.String(50),
        existing_type=postgresql.ENUM(name="deploymenttargetenum"),
        postgresql_using="deployment_target::varchar",
    )
    op.alter_column(
        "integrations",
        "deployment_target",
        type_=sa.String(50),
        existing_type=postgresql.ENUM(name="deploymenttargetenum"),
        postgresql_using="deployment_target::varchar",
    )
    op.alter_column(
        "integrations",
        "status",
        type_=sa.String(50),
        existing_type=postgresql.ENUM(name="integrationstatusenum"),
        postgresql_using="status::varchar",
    )

    # Create default using string
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status SET DEFAULT 'initializing'"
    )

    # Drop types
    postgresql.ENUM(name="deploymenttargetenum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="integrationstatusenum").drop(op.get_bind(), checkfirst=True)
