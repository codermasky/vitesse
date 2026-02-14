"""add_documents_table

Revision ID: 20260214_002
Revises: 20260214_001
Create Date: 2026-02-14 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260214_002"
down_revision = "20260214_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add documents table."""
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.String(255), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "SUCCESS", "COMPLETED", "FAILED", name="extractionstatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=True),
        sa.Column("text_length", sa.Integer(), nullable=True),
        sa.Column("embedding_model", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.Column("vectorized_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)
    op.create_index(
        op.f("ix_documents_document_id"), "documents", ["document_id"], unique=True
    )
    op.create_index(
        op.f("ix_documents_user_id"), "documents", ["user_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema - Drop documents table."""
    op.drop_index(op.f("ix_documents_user_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_document_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_table("documents")
