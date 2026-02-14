"""
Schemas for Integration Builder API

Pydantic models for integration management, field mappings, and testing.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator


class FieldMapping(BaseModel):
    """Schema for field mapping configuration."""

    id: Optional[str] = Field(None, description="Unique mapping identifier")
    source_field: str = Field(..., description="Source API field name")
    target_field: str = Field(..., description="Target API field name")
    data_type: str = Field(..., description="Data type (string, number, boolean, object, array)")
    required: bool = Field(True, description="Whether this field is required")
    transformation: Optional[str] = Field(None, description="Transformation rule ID to apply")

    @validator("data_type")
    def validate_data_type(cls, v):
        valid_types = ["string", "number", "boolean", "object", "array"]
        if v not in valid_types:
            raise ValueError(f"data_type must be one of: {', '.join(valid_types)}")
        return v


class TransformationRule(BaseModel):
    """Schema for transformation rule configuration."""

    id: Optional[str] = Field(None, description="Unique rule identifier")
    name: str = Field(..., description="Rule name")
    description: str = Field(..., description="Rule description")
    rule_type: str = Field(..., description="Type of transformation (map, filter, aggregate, custom)")
    source_field: str = Field(..., description="Source field to transform")
    target_field: str = Field(..., description="Target field for transformed data")
    transformation_logic: Dict[str, Any] = Field(..., description="Transformation logic/configuration")
    enabled: bool = Field(True, description="Whether the rule is enabled")

    @validator("rule_type")
    def validate_rule_type(cls, v):
        valid_types = ["map", "filter", "aggregate", "custom"]
        if v not in valid_types:
            raise ValueError(f"rule_type must be one of: {', '.join(valid_types)}")
        return v


class IntegrationCreate(BaseModel):
    """Schema for creating a new integration."""

    name: str = Field(..., description="Integration name")
    description: str = Field(..., description="Integration description")
    source_api: str = Field(..., description="Source API name/endpoint")
    target_api: str = Field(..., description="Target API name/endpoint")


class IntegrationResponse(BaseModel):
    """Schema for integration response."""

    id: str = Field(..., description="Unique integration identifier")
    name: str = Field(..., description="Integration name")
    description: str = Field(..., description="Integration description")
    source_api: str = Field(..., description="Source API name/endpoint")
    target_api: str = Field(..., description="Target API name/endpoint")
    status: str = Field(..., description="Integration status (draft, testing, active, inactive)")
    field_mappings: List[FieldMapping] = Field(default_factory=list, description="Field mappings")
    transformation_rules: List[TransformationRule] = Field(default_factory=list, description="Transformation rules")
    last_sync: Optional[str] = Field(None, description="Last synchronization timestamp")
    success_rate: float = Field(0, ge=0, le=100, description="Success rate percentage")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True

    @validator("status")
    def validate_status(cls, v):
        valid_statuses = ["draft", "testing", "active", "inactive"]
        if v not in valid_statuses:
            raise ValueError(f"status must be one of: {', '.join(valid_statuses)}")
        return v


class IntegrationList(BaseModel):
    """Schema for paginated integration list."""

    items: List[IntegrationResponse] = Field(..., description="List of integrations")
    total: int = Field(..., ge=0, description="Total number of integrations")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, description="Number of items per page")
    pages: int = Field(..., ge=1, description="Total number of pages")


class TestResult(BaseModel):
    """Schema for integration test results."""

    integration_id: str = Field(..., description="Integration identifier")
    status: str = Field(..., description="Test status (running, completed, failed)")
    start_time: str = Field(..., description="Test start timestamp")
    end_time: Optional[str] = Field(None, description="Test end timestamp")
    success: Optional[bool] = Field(None, description="Whether the test succeeded")
    error_message: Optional[str] = Field(None, description="Error message if test failed")
    request_data: Dict[str, Any] = Field(..., description="Test input data")
    response_data: Optional[Dict[str, Any]] = Field(None, description="Test output data")
    execution_time: Optional[int] = Field(None, description="Execution time in milliseconds")

    @validator("status")
    def validate_status(cls, v):
        valid_statuses = ["running", "completed", "failed"]
        if v not in valid_statuses:
            raise ValueError(f"status must be one of: {', '.join(valid_statuses)}")
        return v


class IntegrationStats(BaseModel):
    """Schema for integration statistics."""

    total_integrations: int = Field(..., ge=0, description="Total number of integrations")
    active_integrations: int = Field(..., ge=0, description="Number of active integrations")
    draft_integrations: int = Field(..., ge=0, description="Number of draft integrations")
    testing_integrations: int = Field(..., ge=0, description="Number of integrations in testing")
    total_field_mappings: int = Field(..., ge=0, description="Total field mappings across all integrations")
    total_transformation_rules: int = Field(..., ge=0, description="Total transformation rules")
    average_success_rate: float = Field(..., ge=0, le=100, description="Average success rate percentage")
    total_api_calls_today: int = Field(..., ge=0, description="Total API calls today")
    failed_calls_today: int = Field(..., ge=0, description="Failed API calls today")
    most_used_source_api: str = Field(..., description="Most used source API")
    most_used_target_api: str = Field(..., description="Most used target API")