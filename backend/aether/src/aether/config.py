"""
Aether Configuration Module

Provides configuration management patterns for agentic applications:
- Pydantic-based settings with environment variable support
- Feature flags for runtime control
- Agent-to-LLM model mapping
- Dynamic configuration updates
"""

import os
from typing import Any, Dict, Optional
from pydantic import BaseModel
from pydantic_settings import BaseSettings
import structlog

logger = structlog.get_logger(__name__)


# ============================================================================
# AGENT-TO-LLM MAPPING
# ============================================================================


class AgentLLMConfig(BaseModel):
    """Configuration for an agent's LLM."""

    provider: str = "openai"  # openai, anthropic, azure, etc.
    model: str = "gpt-4"
    temperature: float = 0.0
    max_tokens: Optional[int] = None
    timeout: int = 60
    max_retries: int = 3


class AgentLLMRegistry:
    """
    Registry for mapping agents to specific LLM configurations.

    Enables per-agent model selection for cost optimization and performance.

    Example:
        registry = AgentLLMRegistry()

        # Configure specific agents
        registry.register("analyst", AgentLLMConfig(
            provider="openai",
            model="gpt-4",
            temperature=0.0,
        ))

        registry.register("summarizer", AgentLLMConfig(
            provider="openai",
            model="gpt-3.5-turbo",  # Cheaper for simple tasks
            temperature=0.3,
        ))

        # Get configuration
        config = registry.get_config("analyst")
        llm = create_llm_from_config(config)
    """

    def __init__(self, default_config: Optional[AgentLLMConfig] = None):
        """
        Initialize registry.

        Args:
            default_config: Default configuration for unmapped agents
        """
        self._configs: Dict[str, AgentLLMConfig] = {}
        self._default = default_config or AgentLLMConfig()

    def register(self, agent_id: str, config: AgentLLMConfig):
        """Register LLM configuration for an agent."""
        self._configs[agent_id] = config
        logger.info(
            "agent_llm_config_registered",
            agent_id=agent_id,
            model=config.model,
            provider=config.provider,
        )

    def get_config(self, agent_id: str) -> AgentLLMConfig:
        """
        Get LLM configuration for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Agent's LLM configuration or default
        """
        return self._configs.get(agent_id, self._default)

    def set_default(self, config: AgentLLMConfig):
        """Set default configuration."""
        self._default = config

    def list_configs(self) -> Dict[str, AgentLLMConfig]:
        """Get all registered configurations."""
        return self._configs.copy()


# Singleton registry
_default_llm_registry = AgentLLMRegistry()


def get_agent_llm_registry() -> AgentLLMRegistry:
    """Get the default agent-LLM registry."""
    return _default_llm_registry


# ============================================================================
# FEATURE FLAGS
# ============================================================================


class FeatureFlags:
    """
    Feature flag system for runtime control of features.

    Enables gradual rollouts, A/B testing, and safe deployments.

    Example:
        flags = FeatureFlags()
        flags.set("new_agent_workflow", True)

        if flags.is_enabled("new_agent_workflow"):
            # Use new workflow
        else:
            # Use old workflow
    """

    def __init__(self):
        self._flags: Dict[str, bool] = {}
        self._load_from_env()

    def _load_from_env(self):
        """Load feature flags from environment variables."""
        # Look for FEATURE_FLAG_* env vars
        for key, value in os.environ.items():
            if key.startswith("FEATURE_FLAG_"):
                flag_name = key.replace("FEATURE_FLAG_", "").lower()
                self._flags[flag_name] = value.lower() in ("true", "1", "yes")

    def set(self, flag_name: str, enabled: bool):
        """Set a feature flag."""
        self._flags[flag_name] = enabled
        logger.info(
            "feature_flag_updated",
            flag_name=flag_name,
            enabled=enabled,
        )

    def is_enabled(self, flag_name: str, default: bool = False) -> bool:
        """
        Check if a feature flag is enabled.

        Args:
            flag_name: Name of the feature
            default: Default value if flag not set

        Returns:
            True if enabled, False otherwise
        """
        return self._flags.get(flag_name, default)

    def list_flags(self) -> Dict[str, bool]:
        """Get all feature flags."""
        return self._flags.copy()


# Singleton feature flags
_default_feature_flags = FeatureFlags()


def get_feature_flags() -> FeatureFlags:
    """Get the default feature flags instance."""
    return _default_feature_flags


# ============================================================================
# AETHER SETTINGS
# ============================================================================


class AetherSettings(BaseSettings):
    """
    Aether platform settings with environment variable support.

    Settings are loaded from:
    1. Environment variables (prefixed with AETHER_)
    2. .env file
    3. Default values

    Example:
        # In .env file:
        # AETHER_ENABLE_METRICS=true
        # AETHER_CACHE_TTL=7200

        settings = AetherSettings()
        if settings.enable_metrics:
            # Setup metrics
    """

    # Observability
    enable_metrics: bool = True
    enable_live_feed: bool = True
    metrics_port: int = 9090

    # Caching
    enable_caching: bool = True
    cache_ttl_seconds: int = 3600
    cache_max_size: int = 1000

    # Security
    mask_pii: bool = True

    # LLM Defaults
    llm_provider: str = "openai"
    llm_model: str = "gpt-4"
    llm_temperature: float = 0.0
    llm_timeout: int = 60

    # Error Handling
    enable_error_recovery: bool = True
    max_retries: int = 3

    # Development
    debug_mode: bool = False
    log_level: str = "INFO"

    class Config:
        env_prefix = "AETHER_"
        env_file = ".env"
        case_sensitive = False


# Singleton settings
_settings: Optional[AetherSettings] = None


def get_settings() -> AetherSettings:
    """Get the global Aether settings."""
    global _settings
    if _settings is None:
        _settings = AetherSettings()
    return _settings


# ============================================================================
# AGENT NAME MAPPING (P2-1)
# ============================================================================


AGENT_DISPLAY_NAMES = {
    # Default agent names
    "analyst": "Financial Analyst",
    "reviewer": "Review Agent",
    "writer": "Content Writer",
    "summarizer": "Summarization Agent",
    "extractor": "Data Extractor",
}


def get_agent_display_name(agent_id: str) -> str:
    """
    Get display name for an agent.

    Args:
        agent_id: Agent identifier (node name)

    Returns:
        Human-readable display name

    Example:
        name = get_agent_display_name("analyst")
        # Returns: "Financial Analyst"
    """
    return AGENT_DISPLAY_NAMES.get(agent_id, agent_id.replace("_", " ").title())


def register_agent_name(agent_id: str, display_name: str):
    """Register a custom display name for an agent."""
    AGENT_DISPLAY_NAMES[agent_id] = display_name
    logger.info(
        "agent_display_name_registered",
        agent_id=agent_id,
        display_name=display_name,
    )
