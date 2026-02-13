from typing import Any, Dict, Optional, Protocol, runtime_checkable


@runtime_checkable
class PersistenceProvider(Protocol):
    """Protocol for state persistence (Checkpoints) within the Aether platform."""

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve a stored state by key."""
        ...

    async def save(self, key: str, state: Any) -> None:
        """Save a state object by key."""
        ...

    async def delete(self, key: str) -> None:
        """Delete a stored state by key."""
        ...
