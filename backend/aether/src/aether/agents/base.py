import abc
import structlog
import time
from typing import Any, Callable, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel
from aether.protocols.intelligence import IntelligenceProvider

# Generic types for input and output schemas
InputSchema = TypeVar("InputSchema", bound=BaseModel)
OutputSchema = TypeVar("OutputSchema", bound=BaseModel)

logger = structlog.get_logger(__name__)


class BaseAgent(abc.ABC, Generic[InputSchema, OutputSchema]):
    """
    Abstract base class for all Aether Agents.
    Enforces structured inputs/outputs and provides a standard execution flow.

    New in v0.2.0:
    - Pre/post execution hooks for metrics, logging, notifications
    - Timing and performance tracking
    - Configurable hooks at instance or class level
    """

    def __init__(
        self,
        agent_id: str,
        intelligence: IntelligenceProvider,
        description: Optional[str] = None,
        pre_hooks: Optional[List[Callable]] = None,
        post_hooks: Optional[List[Callable]] = None,
    ):
        self.agent_id = agent_id
        self.intelligence = intelligence
        self.description = description or self.__class__.__doc__
        self.pre_hooks = pre_hooks or []
        self.post_hooks = post_hooks or []

    @abc.abstractmethod
    def get_input_schema(self) -> type[InputSchema]:
        """Return the Pydantic model for input validation."""
        ...

    @abc.abstractmethod
    def get_output_schema(self) -> type[OutputSchema]:
        """Return the Pydantic model for output validation."""
        ...

    @abc.abstractmethod
    async def run(self, input_data: InputSchema, **kwargs) -> OutputSchema:
        """Core execution logic for the agent."""
        ...

    async def execute(self, data: Dict[str, Any], **kwargs) -> OutputSchema:
        """
        Public execution method with validation, hooks, and telemetry.

        Execution flow:
        1. Validate input
        2. Execute pre-hooks (metrics, logging, notifications)
        3. Run agent logic
        4. Execute post-hooks (metrics, status updates)
        5. Validate output
        """
        # 1. Validate Input
        try:
            input_model = self.get_input_schema().model_validate(data)
        except Exception as e:
            logger.error(f"Agent {self.agent_id} input validation failed: {e}")
            raise ValueError(f"Invalid input for {self.agent_id}: {e}")

        # 2. Execute Pre-Hooks
        start_time = time.time()
        context = {
            "agent_id": self.agent_id,
            "input_data": data,
            "start_time": start_time,
            "config": kwargs.get("config", {}),
        }

        for hook in self.pre_hooks:
            try:
                await hook(context) if asyncio.iscoroutinefunction(hook) else hook(
                    context
                )
            except Exception as e:
                logger.warning(
                    f"Pre-hook failed for {self.agent_id}: {e}",
                    hook=hook.__name__,
                )

        # 3. Run Agent Logic
        logger.info(f"Agent {self.agent_id} starting execution...")
        success = True
        error = None
        result = None

        try:
            result = await self.run(input_model, **kwargs)
        except Exception as e:
            success = False
            error = e
            logger.error(f"Agent {self.agent_id} execution failed: {e}")
            raise
        finally:
            # 4. Execute Post-Hooks (even on failure)
            duration = time.time() - start_time
            context.update(
                {
                    "duration": duration,
                    "success": success,
                    "error": error,
                    "result": result,
                    "end_time": time.time(),
                }
            )

            for hook in self.post_hooks:
                try:
                    await hook(context) if asyncio.iscoroutinefunction(hook) else hook(
                        context
                    )
                except Exception as e:
                    logger.warning(
                        f"Post-hook failed for {self.agent_id}: {e}",
                        hook=hook.__name__,
                    )

        # 5. Validate Output
        return self.get_output_schema().model_validate(result)

    def add_pre_hook(self, hook: Callable):
        """Add a pre-execution hook."""
        self.pre_hooks.append(hook)
        return self

    def add_post_hook(self, hook: Callable):
        """Add a post-execution hook."""
        self.post_hooks.append(hook)
        return self

    def __repr__(self):
        return f"<AetherAgent id='{self.agent_id}' class='{self.__class__.__name__}'>"


# Import for asyncio check
import asyncio
