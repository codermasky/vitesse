"""
Prompt Template Service - Database-backed prompt management.

Provides:
- CRUD operations for prompt templates
- Versioning and rollback
- A/B testing support
- Performance tracking integration with LangFuse
"""

import uuid
from typing import List, Optional
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_

from app.models.prompt_template import PromptTemplate, PromptTemplateHistory
from app.schemas.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
)

logger = structlog.get_logger(__name__)


class PromptTemplateService:
    """Service for managing prompt templates."""

    @staticmethod
    async def create_template(
        db: AsyncSession, template: PromptTemplateCreate
    ) -> PromptTemplate:
        """Create a new prompt template."""
        template_id = str(uuid.uuid4())

        db_template = PromptTemplate(
            id=template_id,
            agent_id=template.agent_id,
            template_name=template.template_name,
            template_type=template.template_type,
            content=template.content,
            description=template.description,
            tags=template.tags,
            parameters=template.parameters,
            created_by=template.created_by,
            version=1,
            is_active=True,  # New templates are active by default
        )

        db.add(db_template)
        await db.flush()

        # Record in history
        history = PromptTemplateHistory(
            id=str(uuid.uuid4()),
            template_id=template_id,
            agent_id=template.agent_id,
            new_content=template.content,
            change_type="created",
            changed_by=template.created_by,
        )
        db.add(history)
        await db.commit()

        logger.info(
            "prompt_template_created",
            template_id=template_id,
            agent_id=template.agent_id,
            template_name=template.template_name,
        )

        return db_template

    @staticmethod
    async def get_template_by_agent(
        db: AsyncSession,
        agent_id: str,
        template_name: str,
        version: Optional[int] = None,
    ) -> Optional[PromptTemplate]:
        """Get a prompt template by agent and name (optionally specific version)."""
        query = select(PromptTemplate).where(
            and_(
                PromptTemplate.agent_id == agent_id,
                PromptTemplate.template_name == template_name,
            )
        )

        if version:
            query = query.where(PromptTemplate.version == version)
        else:
            # Get active version by default
            query = query.where(PromptTemplate.is_active.is_(True))

        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def list_templates_by_agent(
        db: AsyncSession, agent_id: str, active_only: bool = False
    ) -> List[PromptTemplate]:
        """List all prompt templates for an agent."""
        query = select(PromptTemplate).where(PromptTemplate.agent_id == agent_id)

        if active_only:
            query = query.where(PromptTemplate.is_active.is_(True))

        query = query.order_by(desc(PromptTemplate.created_at))
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_template(
        db: AsyncSession,
        template_id: str,
        update: PromptTemplateUpdate,
    ) -> Optional[PromptTemplate]:
        """Update a prompt template (creates new version)."""
        result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == template_id)
        )
        template = result.scalars().first()

        if not template:
            return None

        # Record old version
        old_content = template.content

        # Create new version
        new_version = PromptTemplate(
            id=str(uuid.uuid4()),
            agent_id=template.agent_id,
            template_name=template.template_name,
            template_type=template.template_type,
            content=update.content or template.content,
            description=update.description or template.description,
            tags=update.tags or template.tags,
            parameters=update.parameters or template.parameters,
            version=template.version + 1,
            is_active=True,
            previous_version_id=template_id,
            updated_by=update.updated_by,
        )

        # Deactivate old version
        template.is_active = False

        db.add(new_version)

        # Record in history
        history = PromptTemplateHistory(
            id=str(uuid.uuid4()),
            template_id=new_version.id,
            agent_id=template.agent_id,
            old_content=old_content,
            new_content=new_version.content,
            change_type="modified",
            change_reason=update.change_reason,
            changed_by=update.updated_by,
        )
        db.add(history)

        await db.commit()

        logger.info(
            "prompt_template_updated",
            agent_id=template.agent_id,
            template_name=template.template_name,
            old_version=template.version,
            new_version=new_version.version,
        )

        return new_version

    @staticmethod
    async def rollback_template(
        db: AsyncSession, template_id: str, reason: str, rollback_by: str
    ) -> Optional[PromptTemplate]:
        """Rollback to previous version."""
        result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == template_id)
        )
        current = result.scalars().first()

        if not current or not current.previous_version_id:
            logger.warning(
                "Cannot rollback: no previous version", template_id=template_id
            )
            return None

        # Get previous version
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.id == current.previous_version_id
            )
        )
        previous = result.scalars().first()

        if not previous:
            return None

        # Restore previous version
        previous.is_active = True
        current.is_active = False

        # Create new version record
        history = PromptTemplateHistory(
            id=str(uuid.uuid4()),
            template_id=current.id,
            agent_id=current.agent_id,
            old_content=current.content,
            new_content=previous.content,
            change_type="rollback",
            change_reason=reason,
            changed_by=rollback_by,
        )
        db.add(history)

        await db.commit()

        logger.info(
            "prompt_template_rolled_back",
            agent_id=current.agent_id,
            from_version=current.version,
            to_version=previous.version,
            reason=reason,
        )

        return previous

    @staticmethod
    async def start_ab_test(
        db: AsyncSession,
        agent_id: str,
        template_name: str,
        control_version: int,
        test_version: int,
        experiment_id: str,
    ) -> bool:
        """Mark versions as participating in A/B test."""
        # Get control version
        result = await db.execute(
            select(PromptTemplate).where(
                and_(
                    PromptTemplate.agent_id == agent_id,
                    PromptTemplate.template_name == template_name,
                    PromptTemplate.version == control_version,
                )
            )
        )
        control = result.scalars().first()

        # Get test version
        result = await db.execute(
            select(PromptTemplate).where(
                and_(
                    PromptTemplate.agent_id == agent_id,
                    PromptTemplate.template_name == template_name,
                    PromptTemplate.version == test_version,
                )
            )
        )
        test = result.scalars().first()

        if not control or not test:
            return False

        test.is_experimental = True
        test.experiment_id = experiment_id
        test.control_version_id = control.id

        await db.commit()

        logger.info(
            "ab_test_started",
            agent_id=agent_id,
            experiment_id=experiment_id,
            control_version=control_version,
            test_version=test_version,
        )

        return True

    @staticmethod
    async def record_usage(
        db: AsyncSession,
        template_id: str,
        success: bool,
        latency_ms: float,
        cost_usd: float,
        output_tokens: int,
    ) -> None:
        """Record template usage metrics (called from LangFuse integration)."""
        result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == template_id)
        )
        template = result.scalars().first()

        if not template:
            return

        # Update cumulative metrics
        template.usage_count += 1
        template.avg_latency_ms = int(
            (template.avg_latency_ms * (template.usage_count - 1) + latency_ms)
            / template.usage_count
        )
        template.avg_cost_usd = int(
            (template.avg_cost_usd * (template.usage_count - 1) + cost_usd * 100)
            / template.usage_count
        )
        template.avg_output_tokens = int(
            (template.avg_output_tokens * (template.usage_count - 1) + output_tokens)
            / template.usage_count
        )

        # Update success rate
        if success:
            current_pass_count = int(template.success_rate * template.usage_count / 100)
            template.success_rate = int(
                (current_pass_count + 1) / template.usage_count * 100
            )

        await db.commit()

    @staticmethod
    async def get_template_history(
        db: AsyncSession, template_id: str
    ) -> List[PromptTemplateHistory]:
        """Get full change history for a template."""
        result = await db.execute(
            select(PromptTemplateHistory)
            .where(PromptTemplateHistory.template_id == template_id)
            .order_by(PromptTemplateHistory.changed_at)
        )
        return result.scalars().all()

    @staticmethod
    async def get_prompt_metadata_for_agent(
        db: AsyncSession, agent_id: str
    ) -> Optional[dict]:
        """
        Fetch prompt template metadata for an agent (for Langfuse tracing).

        Args:
            db: Database session
            agent_id: ID of the agent

        Returns:
            Dict with prompt metadata or None if not found:
            {
                "template_id": str,
                "template_name": str,
                "version": int,
                "content": str
            }
        """
        from app.models.llm_config import AgentLLMMapping

        try:
            # Get agent mapping
            mapping_result = await db.execute(
                select(AgentLLMMapping).where(AgentLLMMapping.agent_id == agent_id)
            )
            mapping = mapping_result.scalar_one_or_none()

            if not mapping:
                logger.debug(f"No LLM mapping found for agent: {agent_id}")
                return None

            # Check if agent has a prompt template linked
            if not mapping.prompt_template_id:
                logger.debug(
                    f"Agent {agent_id} has no prompt_template_id, using legacy system_prompt"
                )
                # Return legacy prompt if available
                if mapping.system_prompt:
                    return {
                        "template_id": None,
                        "template_name": f"{agent_id}_legacy",
                        "version": 1,
                        "content": mapping.system_prompt,
                    }
                return None

            # Fetch prompt template
            template_result = await db.execute(
                select(PromptTemplate).where(
                    PromptTemplate.id == mapping.prompt_template_id
                )
            )
            template = template_result.scalar_one_or_none()

            if not template:
                logger.warning(
                    f"Prompt template {mapping.prompt_template_id} not found for agent {agent_id}"
                )
                return None

            return {
                "template_id": template.id,
                "template_name": template.template_name,
                "version": template.version,
                "content": template.content,
            }

        except Exception as e:
            logger.error(f"Error fetching prompt metadata for agent {agent_id}: {e}")
            return None


# Global service instance
prompt_template_service = PromptTemplateService()
