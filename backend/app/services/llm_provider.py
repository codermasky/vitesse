from typing import Dict, Any, Optional, List
import structlog
from app.db.session import async_session_factory
from app.core.config import settings
from app.services.llm_config_service import llm_config_service
from app.services.llm_call_wrapper import LLMCallWrapper
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

logger = structlog.get_logger(__name__)


class LLMProviderService:
    @classmethod
    async def create_llm(
        cls, agent_id: str = None, provider_id: str = None, model_name: str = None
    ):
        """
        Create an LLM instance based on mapping or explicit config.
        Includes robust fallback to Ollama Remote if DB is unavailable.
        """
        try:
            async with async_session_factory() as db:
                # 1. Try to get from agent mapping if agent_id provided
                if agent_id and not provider_id:
                    logger.info(f"Creating LLM for agent: {agent_id}")
                    mapping_config = await llm_config_service.get_agent_config(
                        db, agent_id
                    )

                    if mapping_config:
                        logger.info(
                            f"Resolved config for agent: {agent_id}",
                            provider=mapping_config["provider_type"],
                            model=mapping_config["model"],
                        )
                        return cls._instantiate_llm(
                            mapping_config["provider_type"],
                            mapping_config["model"],
                            mapping_config["api_key"],
                            mapping_config["api_endpoint"],
                            mapping_config["parameters"],
                        )

                # 2. Fallback if no mapping or if explicit provider requested
                if not provider_id:
                    logger.warning(
                        f"No mapping found for agent '{agent_id}', falling back to Ollama Remote"
                    )
                    return cls._create_ollama_remote_instance(agent_id)

                logger.info(f"Creating LLM for explicit provider: {provider_id}")
                provider = await llm_config_service.get_provider(db, provider_id)
                if provider:
                    return cls._instantiate_llm(
                        provider.provider_type,
                        model_name or provider.default_model,
                        provider.api_key,
                        provider.api_endpoint,
                        provider.parameters,
                    )
        except Exception as e:
            logger.error(f"DB connection failed or error in LLM creation: {str(e)}")
            pass

        # 3. ROBUST FALLBACK (Ollama Remote)
        logger.info(f"Using verified remote fallback for agent: {agent_id}")
        return cls._create_ollama_remote_instance(agent_id)

    @classmethod
    async def get_agent_config(cls, agent_id: str) -> Dict[str, Any]:
        """Fetch resolved agent configuration including prompts."""
        try:
            async with async_session_factory() as db:
                config = await llm_config_service.get_agent_config(db, agent_id)
                if config:
                    return config
        except Exception as e:
            print(f"Failed to fetch agent config: {e}")

        # Fallback prompts if DB fails
        from app.agents.prompt_registry import DEFAULT_PROMPTS

        return DEFAULT_PROMPTS.get(agent_id, {})

    @staticmethod
    def _create_ollama_remote_instance(agent_id: str = None):
        """Helper to create the Ollama Remote instance with best model."""
        # Select best model based on agent_id intuition
        fallback_model = settings.DEFAULT_LLM_MODEL
        if agent_id == "Question Analysis Agent":
            # Using Ollama Remote - Question Analysis Agent mapped to 'us.deepseek.r1-v1:0' # DeepSeek for complex reasoning
            # Using Ollama Remote - Response Generation Agent mapped to 'bedrockpipeline.global.anthropic.claude-sonnet-4-20250514-v1:0'
            pass  # The actual model will be determined by the default or other logic if not explicitly set here.
        elif agent_id == "Question Extraction Agent":
            fallback_model = "amazon.nova-lite-v1:0"
        elif agent_id == "Devil's Advocate Agent":
            fallback_model = "anthropic.claude-3-sonnet-20240229-v1:0"

        return ChatOpenAI(
            api_key=settings.OLLAMA_REMOTE_API_KEY,
            base_url=settings.OLLAMA_REMOTE_API_BASE,
            model=fallback_model,
            temperature=0.7,
            max_retries=3,
            request_timeout=120,
        )

    @classmethod
    async def get_vision_model(cls):
        """Get a vision-capable model instance. Always use Ollama Remote."""
        # Use Ollama Remote (Claude 3.5 Sonnet via proxy) which supports vision
        return ChatOpenAI(
            api_key=settings.OLLAMA_REMOTE_API_KEY,
            base_url=settings.OLLAMA_REMOTE_API_BASE,
            model="vision",
            temperature=0.0,
            max_tokens=1000,
        )

    @staticmethod
    def _instantiate_llm(provider_type, model_name, api_key, api_endpoint, params):
        if "model" not in params:
            params["model"] = model_name

        # Clean up params to avoid kwargs conflicts
        clean_params = params.copy()
        if "api_key" in clean_params:
            del clean_params["api_key"]

        if provider_type == "openai":
            return ChatOpenAI(
                api_key=api_key or settings.OPENAI_API_KEY,
                base_url=api_endpoint,
                max_retries=3,
                request_timeout=120,
                **clean_params,
            )
        elif provider_type == "anthropic":
            if "api_key" in clean_params:
                del clean_params["api_key"]  # just in case
            return ChatAnthropic(
                api_key=api_key or settings.ANTHROPIC_API_KEY, **clean_params
            )
        elif provider_type == "bedrock":
            return ChatOpenAI(
                api_key=api_key or "not-required",
                base_url=api_endpoint,
                max_retries=3,
                request_timeout=120,
                **clean_params,
            )
        elif provider_type == "ollama":
            # Ollama usually uses the OpenAI compatible endpoint at /v1
            return ChatOpenAI(
                api_key=api_key or "ollama",
                base_url=api_endpoint or "http://localhost:11434/v1",
                max_retries=3,
                request_timeout=120,
                **clean_params,
            )
        elif provider_type == "azure":
            # Basic Azure OpenAI support via ChatOpenAI
            return ChatOpenAI(
                api_key=api_key,
                base_url=api_endpoint,
                max_retries=3,
                request_timeout=120,
                **params,
            )

        return LLMProviderService._create_ollama_remote_instance()

    @staticmethod
    async def invoke_with_monitoring(
        llm_instance: Any,
        prompt: str,
        agent_id: Optional[str] = None,
        operation_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Invoke LLM with full monitoring instrumentation (LangFuse + Prometheus).

        Usage:
            response = await LLMProviderService.invoke_with_monitoring(
                llm_instance=llm,
                prompt="Extract data...",
                agent_id="analyst",
                operation_name="extract_financials",
                metadata={"deal_id": "DEAL-123"}
            )
        """
        return await LLMCallWrapper.invoke_with_monitoring(
            llm_instance=llm_instance,
            prompt=prompt,
            agent_id=agent_id,
            operation_name=operation_name,
            metadata=metadata,
        )

    @staticmethod
    async def invoke_structured_with_monitoring(
        llm_instance: Any,
        prompt: str,
        schema: Any,
        agent_id: Optional[str] = None,
        operation_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        db: Optional[Any] = None,  # NEW: Database session for prompt lookup
    ) -> Any:
        """
        Invoke LLM with structured output parsing and monitoring.

        Usage:
            result = await LLMProviderService.invoke_structured_with_monitoring(
                llm_instance=llm,
                prompt="Extract covenants...",
                schema=CovenantExtraction,
                agent_id="covenant_compliance",
                operation_name="extract_covenants",
                metadata={"agreement_type": "credit"},
                db=db  # Optional: enables prompt template tracking
            )
        """
        return await LLMCallWrapper.invoke_structured_with_monitoring(
            llm_instance=llm_instance,
            prompt=prompt,
            schema=schema,
            agent_id=agent_id,
            operation_name=operation_name,
            metadata=metadata,
            db=db,  # Pass through database session
        )
