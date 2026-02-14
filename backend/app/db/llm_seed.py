import asyncio
import structlog
import os
import sys

# Add app to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import async_session_factory
from app.services.llm_config_service import llm_config_service
from app.schemas.llm_config import LLMProviderConfig, AgentModelMapping
from app.models.queue_request import QueueRequest  # Fix common SQLAlchemy mapper issues

logger = structlog.get_logger(__name__)


async def seed_llm_configs():
    """Seed initial LLM providers and agent mappings migrated from Credo."""
    async with async_session_factory() as db:
        logger.info("Seeding LLM Providers...")

        providers = [
            LLMProviderConfig(
                provider_id="openai-gpt-4o",
                name="OpenAI GPT-4o",
                provider_type="openai",
                api_endpoint="https://api.openai.com/v1",
                api_key="",
                models=["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
                default_model="gpt-4o",
                parameters={"temperature": 0.7},
            ),
            LLMProviderConfig(
                provider_id="anthropic-claude-3-5",
                name="Anthropic Claude 3.5",
                provider_type="anthropic",
                api_endpoint="https://api.anthropic.com/v1",
                api_key="",
                models=["claude-3-5-sonnet-20240620", "claude-3-opus-20240229"],
                default_model="claude-3-5-sonnet-20240620",
                parameters={"temperature": 0.7},
            ),
            LLMProviderConfig(
                provider_id="aws-bedrock",
                name="AWS Bedrock",
                provider_type="bedrock",
                api_endpoint="",
                api_key="",
                models=[
                    "anthropic.claude-3-5-sonnet-20240620-v1:0",
                    "meta.llama3-70b-instruct-v1:0",
                ],
                default_model="anthropic.claude-3-5-sonnet-20240620-v1:0",
                parameters={"temperature": 0.7},
            ),
            LLMProviderConfig(
                provider_id="ollama-local",
                name="Ollama (Local)",
                provider_type="ollama",
                api_endpoint="http://localhost:11434/v1",
                api_key="",
                models=["llama3", "mistral", "phi3"],
                default_model="llama3",
                parameters={"temperature": 0.7},
            ),
            LLMProviderConfig(
                provider_id="ollama-remote",
                name="Ollama (Remote)",
                provider_type="ollama",
                api_endpoint="https://aitools-internal.linedata.com/api/v1",
                api_key="sk-c364bc614cd44e7c8c73726c3ce6f539",
                models=[
                    "multi-agent:latest",
                    "us.deepseek.r1-v1:0",
                    "amazon.nova-micro-v1:0",
                    "amazon.nova-lite-v1:0",
                    "openai.gpt-oss-120b-1:0",
                    "azure.o1-mini.pipe",
                    "azure_openai",
                    "anthropic.claude-3-sonnet-20240229-v1:0",
                    "bedrockpipeline.global.anthropic.claude-sonnet-4-20250514-v1:0",
                ],
                default_model="multi-agent:latest",
                parameters={"temperature": 0.7},
            ),
        ]

        for provider_in in providers:
            try:
                await llm_config_service.upsert_provider(db, provider_in)
                logger.info(f"Seeded provider: {provider_in.name}")
            except Exception as e:
                logger.error(f"Error seeding provider {provider_in.name}: {e}")

        logger.info("Seeding Agent Mappings...")

        mappings = [
            AgentModelMapping(
                agent_id="vitesse_orchestrator",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="Orchestrator",
            ),
            AgentModelMapping(
                agent_id="analyst",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="API Schema Analysis",
            ),
            AgentModelMapping(
                agent_id="reviewer",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="Validation",
            ),
            AgentModelMapping(
                agent_id="writer",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="Documentation",
            ),
            AgentModelMapping(
                agent_id="sentinel",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="Security & Compliance",
            ),
            AgentModelMapping(
                agent_id="ingestor",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="API Discovery",
            ),
            AgentModelMapping(
                agent_id="deployer",
                provider_id="ollama-remote",
                model_name="anthropic.claude-3-sonnet-20240229-v1:0",
                parameters={"temperature": 0.1},
                role="Deployment",
            ),
        ]

        for mapping_in in mappings:
            try:
                await llm_config_service.upsert_mapping(db, mapping_in)
                logger.info(f"Seeded mapping for agent: {mapping_in.agent_id}")
            except Exception as e:
                logger.error(f"Error seeding mapping for {mapping_in.agent_id}: {e}")

        logger.info("LLM configuration seeding complete")


if __name__ == "__main__":
    asyncio.run(seed_llm_configs())
