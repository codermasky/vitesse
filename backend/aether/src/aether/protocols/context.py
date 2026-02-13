from typing import Any, Dict, List, Optional, Protocol, runtime_checkable


@runtime_checkable
class ContextRetriever(Protocol):
    """Protocol for data retrieval (RAG/SQL/API) within the Aether platform."""

    async def retrieve(
        self,
        query: str,
        limit: int = 5,
        metadata_filter: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant context strings/objects based on a query."""
        ...
