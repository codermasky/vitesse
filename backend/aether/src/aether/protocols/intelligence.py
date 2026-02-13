from typing import Any, Dict, List, Optional, Protocol, runtime_checkable
from pydantic import BaseModel


@runtime_checkable
class IntelligenceProvider(Protocol):
    """Protocol for LLM interactions within the Aether platform."""

    async def ainvoke(
        self, prompt: Any, config: Optional[Dict[str, Any]] = None, **kwargs
    ) -> Any:
        """Invoke the intelligence model asynchronously."""
        ...

    async def ainvoke_structured(
        self,
        prompt: Any,
        output_schema: type[BaseModel],
        config: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> BaseModel:
        """Invoke the intelligence model and return a structured Pydantic object."""
        ...


__all__ = ["IntelligenceProvider"]

