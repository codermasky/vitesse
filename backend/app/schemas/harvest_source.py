"""
Harvest Source Schemas

Pydantic models for harvest source API endpoints.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator


class HarvestSourceBase(BaseModel):
    """Base schema for harvest sources."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Display name for the harvest source",
    )
    type: str = Field(
        ...,
        description="Type of harvest source (api_directory, marketplace, github, documentation)",
    )
    url: str = Field(..., description="URL of the harvest source")
    description: Optional[str] = Field(
        None, description="Optional description of the source"
    )
    enabled: bool = Field(
        True, description="Whether this source is enabled for harvesting"
    )
    priority: int = Field(
        0, description="Priority order for harvesting (higher = first)"
    )
    auth_type: Optional[str] = Field(
        None, description="Authentication type (none, api_key, oauth2, basic)"
    )
    auth_config: Optional[Dict[str, Any]] = Field(
        None, description="Authentication configuration"
    )
    category: Optional[str] = Field(
        None, description="API category this source specializes in"
    )
    tags: Optional[List[str]] = Field(
        None, description="Tags for filtering and organization"
    )

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["api_directory", "marketplace", "github", "documentation"]
        if v not in allowed_types:
            raise ValueError(f"type must be one of: {allowed_types}")
        return v

    @validator("auth_type")
    def validate_auth_type(cls, v):
        if v is None:
            return v
        allowed_auth_types = ["none", "api_key", "oauth2", "basic"]
        if v not in allowed_auth_types:
            raise ValueError(f"auth_type must be one of: {allowed_auth_types}")
        return v


class HarvestSourceCreate(HarvestSourceBase):
    """Schema for creating a new harvest source."""

    pass


class HarvestSourceUpdate(BaseModel):
    """Schema for updating an existing harvest source."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    auth_type: Optional[str] = None
    auth_config: Optional[Dict[str, Any]] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

    @validator("type")
    def validate_type(cls, v):
        if v is None:
            return v
        allowed_types = ["api_directory", "marketplace", "github", "documentation"]
        if v not in allowed_types:
            raise ValueError(f"type must be one of: {allowed_types}")
        return v

    @validator("auth_type")
    def validate_auth_type(cls, v):
        if v is None:
            return v
        allowed_auth_types = ["none", "api_key", "oauth2", "basic"]
        if v not in allowed_auth_types:
            raise ValueError(f"auth_type must be one of: {allowed_auth_types}")
        return v


class HarvestSourceResponse(HarvestSourceBase):
    """Schema for harvest source API responses."""

    id: int
    last_harvested_at: Optional[datetime] = None
    harvest_count: int = 0
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HarvestSourceList(BaseModel):
    """Schema for paginated harvest source list."""

    items: List[HarvestSourceResponse]
    total: int
    page: int
    page_size: int
    pages: int


class HarvestTestResult(BaseModel):
    """Schema for harvest source test results."""

    success: bool
    message: str
    response_time_ms: Optional[float] = None
    status_code: Optional[int] = None
    error_details: Optional[str] = None
    apis_found: Optional[int] = None


class HarvestSourceStats(BaseModel):
    """Schema for harvest source statistics."""

    total_sources: int
    enabled_sources: int
    disabled_sources: int
    sources_by_type: Dict[str, int]
    sources_by_category: Dict[str, int]
    last_harvest_summary: Optional[Dict[str, Any]] = None
