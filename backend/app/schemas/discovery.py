"""
Discovery schemas for Vitesse AI.
Defines data structures for API discovery results.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class DiscoveryResult(BaseModel):
    """Represents a discovered API candidate."""

    api_name: str = Field(..., description="Name of the discovered API")
    description: str = Field(..., description="Brief description of the API")
    documentation_url: Optional[str] = Field(
        default=None, description="URL to API documentation or homepage"
    )
    spec_url: Optional[str] = Field(
        default=None, description="Direct URL to OpenAPI/Swagger spec if known"
    )
    base_url: Optional[str] = Field(
        default=None, description="Base URL for API calls if known"
    )
    confidence_score: float = Field(
        ..., ge=0, le=1, description="Confidence score (0-1) for this result"
    )
    source: str = Field(
        default="llm", description="Source of discovery (llm, directory, cache)"
    )
    tags: List[str] = Field(
        default_factory=list, description="Tags/categories for this API"
    )
    discovered_at: datetime = Field(default_factory=datetime.utcnow)


class DiscoveryRequest(BaseModel):
    """Request to discover APIs based on a query."""

    query: str = Field(..., description="Natural language query for API discovery")
    limit: int = Field(default=5, ge=1, le=20, description="Maximum results to return")
    include_unofficial: bool = Field(
        default=False, description="Include unofficial/third-party APIs"
    )


class DiscoveryResponse(BaseModel):
    """Response from API discovery."""

    status: str = Field(..., description="Status of discovery (success/failed)")
    query: str = Field(..., description="Original query")
    results: List[DiscoveryResult] = Field(
        default_factory=list, description="Discovered API candidates"
    )
    total_found: int = Field(..., description="Total number of results found")
    search_time_seconds: float = Field(..., description="Time taken for discovery")
