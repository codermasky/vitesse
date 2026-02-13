from typing import List, Optional, Dict, Any
from datetime import datetime
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, desc
from sqlalchemy.orm import selectinload

from app.models.llm_config import LLMProvider, AgentLLMMapping, AgentPromptHistory
from app.schemas.llm_config import (
    LLMProviderConfig,
    AgentModelMapping,
    LLMSettings,
    LLMConfigUpdate,
)
from app.agents.prompt_registry import DEFAULT_PROMPTS

logger = structlog.get_logger(__name__)


class LLMConfigService:
    def __init__(self):
        self._config_cache: Dict[str, dict] = {}

    async def initialize_agent_configs(self, db: AsyncSession):
        """Pre-warm the agent configuration cache during startup."""
        logger.info(f"Initializing {len(DEFAULT_PROMPTS)} agent configurations...")

        for agent_id in DEFAULT_PROMPTS.keys():
            try:
                config = await self.get_agent_config(db, agent_id)
                if config:
                    logger.info(
                        f"Preloaded agent: {agent_id}",
                        provider=config.get("provider_type"),
                        model=config.get("model"),
                        has_system_prompt=bool(config.get("system_prompt")),
                    )
                else:
                    logger.warning(
                        f"Could not preload configuration for agent: {agent_id}"
                    )
            except Exception as e:
                logger.error(f"Error preloading agent {agent_id}: {str(e)}")

        logger.info("Agent configuration pre-warming complete")

    async def get_all_settings(self, db: AsyncSession) -> LLMSettings:
        """Retrieve full LLM settings including providers and mappings."""
        # Fetch providers
        result_providers = await db.execute(select(LLMProvider))
        providers = result_providers.scalars().all()

        # Fetch mappings
        result_mappings = await db.execute(select(AgentLLMMapping))
        mappings = result_mappings.scalars().all()

        # Convert to Pydantic schemas
        provider_configs = [
            LLMProviderConfig(
                provider_id=p.provider_id,
                name=p.name,
                provider_type=p.provider_type,
                api_endpoint=p.api_endpoint,
                api_key=p.api_key,
                models=p.models,
                default_model=p.default_model,
                parameters=p.parameters,
            )
            for p in providers
        ]

        mapping_configs = []
        for m in mappings:
            system_prompt = m.system_prompt
            refinement_prompt = m.refinement_prompt

            # Apply fallback for UI visibility
            defaults = DEFAULT_PROMPTS.get(m.agent_id, {})
            if not system_prompt:
                system_prompt = defaults.get("system_prompt")
            if not refinement_prompt:
                refinement_prompt = defaults.get("refinement_prompt")

            mapping_configs.append(
                AgentModelMapping(
                    agent_id=m.agent_id,
                    provider_id=m.provider_id,
                    model_name=m.model_name,
                    parameters=m.parameters,
                    system_prompt=system_prompt,
                    refinement_prompt=refinement_prompt,
                    role=m.role,
                )
            )

        return LLMSettings(
            providers=provider_configs,
            mappings=mapping_configs,
            global_default_provider="openai-default",
            global_default_model="gpt-4-turbo-preview",
        )

    async def get_provider(
        self, db: AsyncSession, provider_id: str
    ) -> Optional[LLMProvider]:
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.provider_id == provider_id)
        )
        return result.scalars().first()

    async def upsert_provider(
        self, db: AsyncSession, config: LLMProviderConfig
    ) -> LLMProvider:
        """Create or update an LLM provider."""
        existing = await self.get_provider(db, config.provider_id)

        if existing:
            existing.name = config.name
            existing.provider_type = config.provider_type
            existing.api_endpoint = config.api_endpoint
            if config.api_key:
                existing.api_key = config.api_key
            existing.models = config.models
            existing.default_model = config.default_model
            existing.parameters = config.parameters
        else:
            new_provider = LLMProvider(
                provider_id=config.provider_id,
                name=config.name,
                provider_type=config.provider_type,
                api_endpoint=config.api_endpoint,
                api_key=config.api_key,
                models=config.models,
                default_model=config.default_model,
                parameters=config.parameters,
            )
            db.add(new_provider)
            existing = new_provider

        await db.commit()
        await db.refresh(existing)
        return existing

    async def update_provider_partial(
        self, db: AsyncSession, provider_id: str, update: LLMConfigUpdate
    ) -> Optional[LLMProvider]:
        provider = await self.get_provider(db, provider_id)
        if not provider:
            return None

        update_data = update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(provider, field, value)

        await db.commit()
        await db.refresh(provider)
        return provider

    async def delete_provider(self, db: AsyncSession, provider_id: str) -> bool:
        provider = await self.get_provider(db, provider_id)
        if not provider:
            return False

        # Explicitly delete associated mappings first to be safe
        await db.execute(
            delete(AgentLLMMapping).where(AgentLLMMapping.provider_id == provider_id)
        )

        await db.delete(provider)
        await db.commit()
        return True

    async def upsert_mapping(
        self, db: AsyncSession, mapping: AgentModelMapping
    ) -> AgentModelMapping:
        """Create or update an agent mapping with prompt versioning."""
        result = await db.execute(
            select(AgentLLMMapping).where(AgentLLMMapping.agent_id == mapping.agent_id)
        )
        existing = result.scalars().first()

        if existing:
            # Record history if prompts changed and existing mapping has content
            if (
                existing.system_prompt != mapping.system_prompt
                or existing.refinement_prompt != mapping.refinement_prompt
            ):
                await self._record_prompt_history(db, existing)

            existing.provider_id = mapping.provider_id
            existing.model_name = mapping.model_name
            existing.parameters = mapping.parameters or {}
            existing.system_prompt = mapping.system_prompt
            existing.refinement_prompt = mapping.refinement_prompt
            existing.role = mapping.role
        else:
            new_mapping = AgentLLMMapping(
                agent_id=mapping.agent_id,
                provider_id=mapping.provider_id,
                model_name=mapping.model_name,
                parameters=mapping.parameters or {},
                system_prompt=mapping.system_prompt,
                refinement_prompt=mapping.refinement_prompt,
                role=mapping.role,
            )
            db.add(new_mapping)
            existing = new_mapping

        await db.commit()
        await db.refresh(existing)

        # Invalidate cache
        if existing.agent_id in self._config_cache:
            del self._config_cache[existing.agent_id]
            logger.info(f"Invalidated cache for agent: {existing.agent_id}")

        # Return resolved mapping for UI with fallbacks
        system_prompt = existing.system_prompt
        refinement_prompt = existing.refinement_prompt
        defaults = DEFAULT_PROMPTS.get(existing.agent_id, {})

        if not system_prompt:
            system_prompt = defaults.get("system_prompt")
        if not refinement_prompt:
            refinement_prompt = defaults.get("refinement_prompt")

        return AgentModelMapping(
            agent_id=existing.agent_id,
            provider_id=existing.provider_id,
            model_name=existing.model_name,
            parameters=existing.parameters,
            system_prompt=system_prompt,
            refinement_prompt=refinement_prompt,
            role=existing.role,
        )

    async def _record_prompt_history(self, db: AsyncSession, mapping: AgentLLMMapping):
        """Internal helper to record prompt history before update."""
        if not mapping.system_prompt and not mapping.refinement_prompt:
            return

        # Get current max version
        result = await db.execute(
            select(AgentPromptHistory)
            .where(AgentPromptHistory.agent_id == mapping.agent_id)
            .order_by(desc(AgentPromptHistory.version))
            .limit(1)
        )
        last_version = result.scalars().first()
        new_version = (last_version.version + 1) if last_version else 1

        history = AgentPromptHistory(
            agent_id=mapping.agent_id,
            system_prompt=mapping.system_prompt,
            refinement_prompt=mapping.refinement_prompt,
            version=new_version,
            created_at=datetime.utcnow().isoformat(),
            comment=f"Auto-saved version {new_version}",
        )
        db.add(history)

    async def get_prompt_history(
        self, db: AsyncSession, agent_id: str
    ) -> List[AgentPromptHistory]:
        """Get historical versions of prompts for an agent."""
        result = await db.execute(
            select(AgentPromptHistory)
            .where(AgentPromptHistory.agent_id == agent_id)
            .order_by(desc(AgentPromptHistory.version))
        )
        return result.scalars().all()

    async def revert_prompt_version(
        self, db: AsyncSession, agent_id: str, history_id: int
    ) -> Optional[AgentModelMapping]:
        """Revert agent prompts to a specific historical version."""
        result = await db.execute(
            select(AgentPromptHistory).where(AgentPromptHistory.id == history_id)
        )
        history_entry = result.scalars().first()
        if not history_entry:
            return None

        result = await db.execute(
            select(AgentLLMMapping).where(AgentLLMMapping.agent_id == agent_id)
        )
        current_mapping = result.scalars().first()
        if not current_mapping:
            return None

        await self._record_prompt_history(db, current_mapping)

        reverted_mapping = AgentModelMapping(
            agent_id=agent_id,
            provider_id=current_mapping.provider_id,
            model_name=current_mapping.model_name,
            parameters=current_mapping.parameters,
            system_prompt=history_entry.system_prompt,
            refinement_prompt=history_entry.refinement_prompt,
            role=current_mapping.role,
        )

        return await self.upsert_mapping(db, reverted_mapping)

    async def delete_mapping(self, db: AsyncSession, agent_id: str) -> bool:
        """Delete an agent-to-model mapping."""
        result = await db.execute(
            select(AgentLLMMapping).where(AgentLLMMapping.agent_id == agent_id)
        )
        mapping = result.scalars().first()
        if not mapping:
            return False

        if agent_id in self._config_cache:
            del self._config_cache[agent_id]

        await db.delete(mapping)
        await db.commit()
        return True

    async def get_agent_config(self, db: AsyncSession, agent_id: str) -> Optional[dict]:
        """Get resolved configuration for a specific agent."""
        if agent_id in self._config_cache:
            return self._config_cache[agent_id]

        result = await db.execute(
            select(AgentLLMMapping).where(AgentLLMMapping.agent_id == agent_id)
        )
        mapping = result.scalars().first()

        provider = None
        model_name = None
        parameters = {}
        system_prompt = None
        refinement_prompt = None

        if mapping:
            provider = await self.get_provider(db, mapping.provider_id)
            model_name = mapping.model_name
            parameters = mapping.parameters
            system_prompt = mapping.system_prompt
            refinement_prompt = mapping.refinement_prompt

        # Apply fallback defaults from registry
        defaults = DEFAULT_PROMPTS.get(agent_id, {})
        if not system_prompt:
            system_prompt = defaults.get("system_prompt")
        if not refinement_prompt:
            refinement_prompt = defaults.get("refinement_prompt")

        if provider:
            api_endpoint = parameters.get("api_endpoint", provider.api_endpoint)
            api_key = parameters.get("api_key", provider.api_key)

            config = {
                "provider_type": provider.provider_type,
                "api_key": api_key,
                "api_endpoint": api_endpoint,
                "model": model_name,
                "parameters": {**provider.parameters, **parameters},
                "system_prompt": system_prompt,
                "refinement_prompt": refinement_prompt,
            }
            self._config_cache[agent_id] = config
            return config
        return None

    async def test_mapping(self, db: AsyncSession, agent_id: str) -> dict:
        """Test an agent mapping by performing a simple completion."""
        from app.services.llm_provider import LLMProviderService

        try:
            llm = await LLMProviderService.create_llm(agent_id=agent_id)
            if not llm:
                return {
                    "status": "error",
                    "message": f"No mapping or fallback found for agent: {agent_id}",
                }

            response = await llm.ainvoke("Say 'Success'")
            return {
                "status": "success",
                "message": f"Successfully tested agent '{agent_id}'",
                "response": response.content,
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}


llm_config_service = LLMConfigService()
