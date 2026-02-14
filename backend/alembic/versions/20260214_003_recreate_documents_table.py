"""recreate_documents_table

Revision ID: 20260214_003
Revises: 20260214_002
Create Date: 2026-02-14 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260214_003"
down_revision = "20260214_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Recreate documents table with comprehensive metadata."""
    # Drop existing table if exists
    op.drop_table("documents", if_exists=True)

    # Create new comprehensive documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("location", sa.String(1000), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("size", sa.Integer(), nullable=True, default=0),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("version", sa.String(50), nullable=True),
        sa.Column("language", sa.String(10), nullable=True, default="en"),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("doc_type", sa.String(50), nullable=True, default="vault"),
        sa.Column("access_level", sa.String(50), nullable=True, default="private"),
        sa.Column("source", sa.String(50), nullable=True, default="manual"),
        sa.Column("product_id", sa.String(255), nullable=True),
        sa.Column("deployment_type", sa.String(100), nullable=True),
        sa.Column(
            "extraction_status",
            sa.Enum(
                "pending", "processing", "completed", "failed", name="extractionstatus"
            ),
            nullable=False,
            default="pending",
        ),
        sa.Column("extraction_started_at", sa.DateTime(), nullable=True),
        sa.Column("extraction_completed_at", sa.DateTime(), nullable=True),
        sa.Column("extraction_error", sa.Text(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=True, default=0),
        sa.Column("text_length", sa.Integer(), nullable=True, default=0),
        sa.Column("embedding_model", sa.String(255), nullable=True),
        sa.Column("custom_metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=True)
    op.create_index(
        op.f("ix_documents_user_id"), "documents", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_documents_extraction_status"),
        "documents",
        ["extraction_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_uploaded_at"), "documents", ["uploaded_at"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema - Drop documents table."""
    op.drop_index(op.f("ix_documents_uploaded_at"), table_name="documents")
    op.drop_index(op.f("ix_documents_extraction_status"), table_name="documents")
    op.drop_index(op.f("ix_documents_user_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_table("documents")
