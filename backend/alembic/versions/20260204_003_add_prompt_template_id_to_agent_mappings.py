"""add_prompt_template_id_to_agent_mappings

Revision ID: 20260204_003
Revises: 20260204_002
Create Date: 2026-02-04 19:30:34.300235

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260204_003"
down_revision: Union[str, Sequence[str], None] = "20260204_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Consolidate prompt management systems.

    1. Add prompt_template_id column to agent_llm_mappings
    2. Migrate existing system_prompts to prompt_templates table
    3. Link agent_llm_mappings to new prompt_templates
    """
    import uuid
    from datetime import datetime

    # Step 1: Add prompt_template_id column (nullable for now)
    op.add_column(
        "agent_llm_mappings",
        sa.Column("prompt_template_id", sa.String(36), nullable=True),
    )

    # Step 2: Add foreign key constraint
    op.create_foreign_key(
        "fk_agent_llm_mappings_prompt_template",
        "agent_llm_mappings",
        "prompt_templates",
        ["prompt_template_id"],
        ["id"],
        ondelete="SET NULL",  # If prompt deleted, mapping remains but loses prompt reference
    )

    # Step 3: Migrate existing system_prompts to prompt_templates
    # Get connection for data migration
    conn = op.get_bind()

    # Fetch all agent mappings with system_prompts
    mappings = conn.execute(
        sa.text("""
        SELECT id, agent_id, system_prompt, refinement_prompt, role
        FROM agent_llm_mappings
        WHERE system_prompt IS NOT NULL AND system_prompt != ''
    """)
    ).fetchall()

    # Create prompt templates for each agent mapping
    for mapping in mappings:
        mapping_id, agent_id, system_prompt, refinement_prompt, role = mapping

        # Generate template name from agent_id
        template_name = f"{agent_id}_system_prompt"
        template_id = str(uuid.uuid4())

        # Create prompt template
        conn.execute(
            sa.text("""
            INSERT INTO prompt_templates (
                id, agent_id, template_name, template_type, content,
                version, is_active, description, created_by, updated_by,
                created_at, updated_at, usage_count, success_rate,
                avg_latency_ms, avg_cost_usd
            ) VALUES (
                :id, :agent_id, :template_name, :template_type, :content,
                :version, :is_active, :description, :created_by, :updated_by,
                :created_at, :updated_at, :usage_count, :success_rate,
                :avg_latency_ms, :avg_cost_usd
            )
        """),
            {
                "id": template_id,
                "agent_id": agent_id,
                "template_name": template_name,
                "template_type": "system",
                "content": system_prompt,
                "version": 1,
                "is_active": True,
                "description": f"Migrated from agent_llm_mappings for {agent_id}",
                "created_by": "migration",
                "updated_by": "migration",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "usage_count": 0,
                "success_rate": 0,
                "avg_latency_ms": 0,
                "avg_cost_usd": 0,
            },
        )

        # Link agent mapping to new prompt template
        conn.execute(
            sa.text("""
            UPDATE agent_llm_mappings
            SET prompt_template_id = :template_id
            WHERE id = :mapping_id
        """),
            {"template_id": template_id, "mapping_id": mapping_id},
        )

        print(f"Migrated prompt for agent '{agent_id}' to template '{template_id}'")

    # Step 4: Mark system_prompt and refinement_prompt as deprecated (keep for backward compat)
    # We don't drop these columns yet to allow gradual migration
    # They can be removed in a future migration after confirming all code uses prompt_templates

    print(f"Migration complete: Created {len(mappings)} prompt templates")


def downgrade() -> None:
    """
    Rollback prompt consolidation.

    1. Remove foreign key constraint
    2. Drop prompt_template_id column
    3. Note: Does NOT delete migrated prompt_templates (data preservation)
    """
    # Remove foreign key
    op.drop_constraint(
        "fk_agent_llm_mappings_prompt_template",
        "agent_llm_mappings",
        type_="foreignkey",
    )

    # Drop column
    op.drop_column("agent_llm_mappings", "prompt_template_id")

    print("Rollback complete: prompt_template_id removed from agent_llm_mappings")
    print(
        "Note: Migrated prompt_templates were NOT deleted (manual cleanup required if needed)"
    )
