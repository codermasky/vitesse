"""fix_integration_enum_to_varchar

Convert integration status and deployment_target from PostgreSQL ENUM to VARCHAR
to match SQLAlchemy SQLEnum(..., native_enum=False) configuration.

Revision ID: 20260214_002
Revises: 20260214_001
Create Date: 2026-02-14 22:12:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260214_002"
down_revision = "20260214_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Convert ENUM columns to VARCHAR."""

    # 1. Drop the default constraint to allow type change
    op.execute("ALTER TABLE integrations ALTER COLUMN status DROP DEFAULT")

    # 2. Convert status column from enum to varchar
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status TYPE character varying(50) USING status::text"
    )

    # 3. Set default back
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status SET DEFAULT 'initializing'"
    )

    # 4. Drop the default constraint for deployment_target
    op.execute("ALTER TABLE integrations ALTER COLUMN deployment_target DROP DEFAULT")

    # 5. Convert deployment_target column from enum to varchar
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN deployment_target TYPE character varying(50) USING deployment_target::text"
    )

    # 6. Set default back if needed (check if it was set)
    # Based on model, no default for deployment_target

    # 7. Drop the PostgreSQL ENUM types
    op.execute("DROP TYPE IF EXISTS integrationstatusenum CASCADE")
    op.execute("DROP TYPE IF EXISTS deploymenttargetenum CASCADE")


def downgrade() -> None:
    """Downgrade schema - Restore ENUM types."""

    # Recreate the ENUM types
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

    integration_status_enum.create(op.get_bind(), checkfirst=True)
    deployment_target_enum.create(op.get_bind(), checkfirst=True)

    # Convert columns back to ENUM type
    op.execute("ALTER TABLE integrations ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status TYPE integrationstatusenum USING status::integrationstatusenum"
    )
    op.execute(
        "ALTER TABLE integrations ALTER COLUMN status SET DEFAULT 'initializing'::integrationstatusenum"
    )

    op.execute(
        "ALTER TABLE integrations ALTER COLUMN deployment_target TYPE deploymenttargetenum USING deployment_target::deploymenttargetenum"
    )
