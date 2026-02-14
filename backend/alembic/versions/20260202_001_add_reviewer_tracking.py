"""Add reviewer tracking to Review model

Revision ID: add_reviewer_tracking
Revises: 0d9bbd4e58cc
Create Date: 2026-02-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260202_001"
down_revision = "20260201_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add reviewer tracking and completion timestamp."""
    # Change reviewer_id from String to Integer with foreign key
    op.add_column('reviews', sa.Column('reviewer_id_new', sa.Integer(), nullable=True))
    
    # Add completed_at column
    op.add_column('reviews', sa.Column('completed_at', sa.DateTime(), nullable=True))
    
    # Copy existing data if any (set reviewer_id_new to NULL for existing rows)
    op.execute('UPDATE reviews SET reviewer_id_new = NULL')
    
    # Drop old reviewer_id column
    op.drop_column('reviews', 'reviewer_id')
    
    # Rename new column to reviewer_id
    op.alter_column('reviews', 'reviewer_id_new', new_column_name='reviewer_id')
    
    # Make reviewer_id nullable for now (can be made non-null after data migration)
    # Add foreign key constraint to users table
    op.create_foreign_key('fk_reviews_reviewer_id_users', 'reviews', 'users',
                          ['reviewer_id'], ['id'])
    
    # Update status enum to include 'completed'
    # Note: This is a simplified approach. Depending on your database, you may need
    # to handle enum updates differently
    op.execute(
        "UPDATE reviews SET status = 'completed' WHERE status IN ('approved', 'rejected') AND completed_at IS NOT NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove foreign key
    op.drop_constraint('fk_reviews_reviewer_id_users', 'reviews', type_='foreignkey')
    
    # Add back old reviewer_id column as String
    op.add_column('reviews', sa.Column('reviewer_id_old', sa.String(), nullable=False, server_default='unknown'))
    
    # Copy data back
    op.execute('UPDATE reviews SET reviewer_id_old = COALESCE(CAST(reviewer_id AS VARCHAR), \'unknown\')')
    
    # Drop new reviewer_id column
    op.drop_column('reviews', 'reviewer_id')
    
    # Rename old column back
    op.alter_column('reviews', 'reviewer_id_old', new_column_name='reviewer_id')
    
    # Drop completed_at column
    op.drop_column('reviews', 'completed_at')
