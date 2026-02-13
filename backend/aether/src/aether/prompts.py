"""
Prompt Registry for Agentic Applications

Provides centralized prompt management:
- Version-controlled prompts
- Template-based prompts
- Prompt A/B testing support
- Metadata tracking
"""

import structlog
from typing import Any, Dict, Optional
from datetime import datetime

logger = structlog.get_logger(__name__)


class PromptTemplate:
    """
    Template for agent prompts with variable substitution.

    Example:
        template = PromptTemplate(
            name="financial_analysis",
            version="1.0",
            system="You are a financial analyst.",
            user="Analyze this data: {data}",
        )

        prompt = template.render(data="Revenue: $1M")
    """

    def __init__(
        self,
        name: str,
        version: str,
        system: str,
        user: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.name = name
        self.version = version
        self.system = system
        self.user = user
        self.metadata = metadata or {}
        self.created_at = datetime.utcnow().isoformat()

    def render(self, **variables) -> Dict[str, str]:
        """
        Render the prompt with variables.

        Args:
            **variables: Variables to substitute

        Returns:
            Dict with 'system' and 'user' prompts
        """
        return {
            "system": self.system.format(**variables),
            "user": self.user.format(**variables),
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "version": self.version,
            "system": self.system,
            "user": self.user,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }


class PromptRegistry:
    """
    Registry for managing agent prompts.

    Enables:
    - Version control for prompts
    - A/B testing different prompt versions
    - Centralized prompt management
    - Metadata tracking (performance, costs, etc.)

    Example:
        registry = PromptRegistry()

        # Register prompts
        registry.register(
            agent_id="analyst",
            task="analyze",
            template=PromptTemplate(
                name="analyst_v1",
                version="1.0",
                system="You are a financial analyst.",
                user="Analyze: {data}",
            ),
        )

        # Get and use prompt
        template = registry.get("analyst", "analyze")
        prompts = template.render(data="Revenue data")
    """

    def __init__(self):
        # Structure: {agent_id: {task: {version: PromptTemplate}}}
        self._prompts: Dict[str, Dict[str, Dict[str, PromptTemplate]]] = {}

        # Track active versions: {agent_id: {task: version}}
        self._active_versions: Dict[str, Dict[str, str]] = {}

    def register(
        self,
        agent_id: str,
        task: str,
        template: PromptTemplate,
        set_active: bool = True,
    ):
        """
        Register a prompt template.

        Args:
            agent_id: Agent identifier
            task: Task name (e.g., "analyze", "summarize")
            template: PromptTemplate instance
            set_active: Whether to set as active version
        """
        if agent_id not in self._prompts:
            self._prompts[agent_id] = {}

        if task not in self._prompts[agent_id]:
            self._prompts[agent_id][task] = {}

        self._prompts[agent_id][task][template.version] = template

        if set_active:
            if agent_id not in self._active_versions:
                self._active_versions[agent_id] = {}
            self._active_versions[agent_id][task] = template.version

        logger.info(
            "prompt_registered",
            agent_id=agent_id,
            task=task,
            version=template.version,
            active=set_active,
        )

    def get(
        self,
        agent_id: str,
        task: str,
        version: Optional[str] = None,
    ) -> Optional[PromptTemplate]:
        """
        Get a prompt template.

        Args:
            agent_id: Agent identifier
            task: Task name
            version: Optional specific version (uses active if not specified)

        Returns:
            PromptTemplate or None
        """
        if agent_id not in self._prompts:
            logger.warning(f"Agent {agent_id} not found in registry")
            return None

        if task not in self._prompts[agent_id]:
            logger.warning(f"Task {task} not found for agent {agent_id}")
            return None

        # Use specified version or active version
        if version is None:
            version = self._active_versions.get(agent_id, {}).get(task)

        if version is None:
            logger.warning(f"No active version for {agent_id}/{task}")
            return None

        return self._prompts[agent_id][task].get(version)

    def set_active_version(
        self,
        agent_id: str,
        task: str,
        version: str,
    ):
        """
        Set the active version for a task.

        Useful for A/B testing or rolling out new prompts.

        Args:
            agent_id: Agent identifier
            task: Task name
            version: Version to activate
        """
        if agent_id not in self._active_versions:
            self._active_versions[agent_id] = {}

        self._active_versions[agent_id][task] = version

        logger.info(
            "prompt_version_activated",
            agent_id=agent_id,
            task=task,
            version=version,
        )

    def list_prompts(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        List all registered prompts.

        Args:
            agent_id: Optional filter by agent

        Returns:
            Dict of prompts with metadata
        """
        if agent_id:
            if agent_id not in self._prompts:
                return {}

            return {
                agent_id: {
                    task: {
                        "versions": list(versions.keys()),
                        "active": self._active_versions.get(agent_id, {}).get(task),
                    }
                    for task, versions in self._prompts[agent_id].items()
                }
            }

        # All prompts
        return {
            aid: {
                task: {
                    "versions": list(versions.keys()),
                    "active": self._active_versions.get(aid, {}).get(task),
                }
                for task, versions in tasks.items()
            }
            for aid, tasks in self._prompts.items()
        }

    def get_metadata(
        self,
        agent_id: str,
        task: str,
        version: str,
    ) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific prompt version."""
        template = self.get(agent_id, task, version)
        if template:
            return template.metadata
        return None

    def update_metadata(
        self,
        agent_id: str,
        task: str,
        version: str,
        metadata: Dict[str, Any],
    ):
        """Update metadata for a prompt (e.g., performance metrics)."""
        template = self.get(agent_id, task, version)
        if template:
            template.metadata.update(metadata)
            logger.info(
                "prompt_metadata_updated",
                agent_id=agent_id,
                task=task,
                version=version,
            )


# Singleton registry
_default_prompt_registry = PromptRegistry()


def get_prompt_registry() -> PromptRegistry:
    """Get the default prompt registry."""
    return _default_prompt_registry
