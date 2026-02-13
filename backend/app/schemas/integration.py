"""
Base models for Vitesse integration lifecycle.
Defines the core data structures for integrations, connectors, and transformation logic.
"""

from typing import Any, Dict, List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class APIAuthType(str, Enum):
    """Supported API authentication types."""

    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    BEARER_TOKEN = "bearer_token"
    BASIC = "basic"
    CUSTOM = "custom"
    NONE = "none"


class APIEndpoint(BaseModel):
    """Represents a discovered API endpoint."""

    path: str = Field(..., description="Endpoint path (e.g., /users, /products)")
    method: str = Field(..., description="HTTP method (GET, POST, PUT, DELETE)")
    description: str = Field(default="", description="Endpoint description from docs")
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Query/path parameters"
    )
    request_schema: Optional[Dict[str, Any]] = Field(
        default=None, description="Request body schema"
    )
    response_schema: Optional[Dict[str, Any]] = Field(
        default=None, description="Response schema"
    )
    auth_required: bool = Field(default=True, description="Whether auth is required")
    rate_limit: Optional[str] = Field(
        default=None, description="Rate limit info if available"
    )


class APISpecification(BaseModel):
    """API specification discovered by Ingestor."""

    source_url: str = Field(
        ..., description="Original API documentation URL or Swagger spec URL"
    )
    api_name: str = Field(..., description="Name of the API")
    api_version: str = Field(default="1.0.0", description="API version")
    base_url: str = Field(..., description="Base URL for API calls")
    auth_type: APIAuthType = Field(..., description="Authentication type")
    auth_config: Dict[str, Any] = Field(
        default_factory=dict, description="Auth configuration details"
    )
    endpoints: List[APIEndpoint] = Field(
        default_factory=list, description="Discovered endpoints"
    )
    headers: Dict[str, str] = Field(
        default_factory=dict, description="Required headers"
    )
    rate_limits: Optional[Dict[str, Any]] = Field(
        default=None, description="Rate limit information"
    )
    pagination_style: Optional[str] = Field(
        default=None, description="Pagination style (offset, cursor, etc)"
    )
    discovered_at: datetime = Field(default_factory=datetime.utcnow)


class DataTransformation(BaseModel):
    """Represents a single data transformation rule."""

    source_field: str = Field(..., description="Source field path (dot notation)")
    dest_field: str = Field(..., description="Destination field path (dot notation)")
    transform_type: str = Field(
        default="direct", description="Transform type (direct, mapping, function, etc)"
    )
    transform_config: Dict[str, Any] = Field(
        default_factory=dict, description="Transform-specific config"
    )
    required: bool = Field(default=False, description="Is this field required")
    default_value: Optional[Any] = Field(
        default=None, description="Default value if source is empty"
    )


class MappingLogic(BaseModel):
    """Complete mapping logic from source to destination."""

    source_api: str = Field(..., description="Source API name")
    dest_api: str = Field(..., description="Destination API name")
    source_endpoint: str = Field(..., description="Source endpoint path")
    dest_endpoint: str = Field(..., description="Destination endpoint path")
    transformations: List[DataTransformation] = Field(
        default_factory=list, description="Transformation rules"
    )
    pre_sync_hook: Optional[str] = Field(
        default=None, description="Pre-sync custom logic"
    )
    post_sync_hook: Optional[str] = Field(
        default=None, description="Post-sync custom logic"
    )
    error_handling: Dict[str, Any] = Field(
        default_factory=dict, description="Error handling strategy"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TestResult(BaseModel):
    """Result of a single test execution."""

    test_id: str = Field(..., description="Unique test ID")
    endpoint: str = Field(..., description="Endpoint tested")
    method: str = Field(..., description="HTTP method")
    status_code: int = Field(..., description="Response status code")
    response_time_ms: float = Field(..., description="Response time in milliseconds")
    success: bool = Field(..., description="Whether test passed")
    error_message: Optional[str] = Field(
        default=None, description="Error message if failed"
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthScore(BaseModel):
    """Integration health assessment from Guardian."""

    integration_id: str = Field(..., description="Integration ID")
    overall_score: float = Field(
        ..., ge=0, le=100, description="Overall health score 0-100"
    )
    endpoint_coverage: float = Field(
        ..., ge=0, le=100, description="% of endpoints tested"
    )
    success_rate: float = Field(..., ge=0, le=100, description="% of tests passed")
    response_time_p95: float = Field(..., description="95th percentile response time")
    critical_issues: List[str] = Field(
        default_factory=list, description="Critical issues found"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Non-critical warnings"
    )
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    test_results: List[TestResult] = Field(
        default_factory=list, description="Detailed test results"
    )


class IntegrationStatus(str, Enum):
    """Integration lifecycle status."""

    INITIALIZING = "initializing"
    DISCOVERING = "discovering"
    MAPPING = "mapping"
    TESTING = "testing"
    DEPLOYING = "deploying"
    ACTIVE = "active"
    UPDATING = "updating"
    FAILED = "failed"
    PAUSED = "paused"


class DeploymentTarget(str, Enum):
    """Deployment target options."""

    LOCAL = "local"  # Docker on VPS
    CLOUD_EKS = "eks"  # AWS EKS
    CLOUD_ECS = "ecs"  # AWS ECS


class DeploymentConfig(BaseModel):
    """Deployment configuration for an integration."""

    target: DeploymentTarget = Field(..., description="Deployment target")
    region: Optional[str] = Field(
        default="us-east-1", description="AWS region if cloud"
    )
    instance_type: Optional[str] = Field(
        default="t3.small", description="Instance type"
    )
    replicas: int = Field(default=1, ge=1, description="Number of replicas")
    memory_mb: int = Field(default=512, description="Memory in MB")
    cpu_cores: float = Field(default=0.5, description="CPU cores")
    env_vars: Dict[str, str] = Field(
        default_factory=dict, description="Environment variables"
    )
    secrets: Dict[str, str] = Field(
        default_factory=dict, description="Secrets (stored separately)"
    )
    auto_scale: bool = Field(default=False, description="Enable autoscaling")
    min_replicas: int = Field(default=1, description="Minimum replicas for autoscaling")
    max_replicas: int = Field(
        default=10, description="Maximum replicas for autoscaling"
    )


class IntegrationInstance(BaseModel):
    """Represents a single integration instance."""

    id: str = Field(..., description="Unique integration ID")
    name: str = Field(..., description="Human-readable integration name")
    status: IntegrationStatus = Field(default=IntegrationStatus.INITIALIZING)
    source_api_spec: APISpecification = Field(
        ..., description="Source API specification"
    )
    dest_api_spec: APISpecification = Field(
        ..., description="Destination API specification"
    )
    mapping_logic: Optional[MappingLogic] = Field(
        default=None, description="Applied mapping logic"
    )
    health_score: Optional[HealthScore] = Field(
        default=None, description="Latest health assessment"
    )
    deployment_config: DeploymentConfig = Field(
        ..., description="Deployment configuration"
    )
    container_id: Optional[str] = Field(
        default=None, description="Container/Pod ID if deployed"
    )
    service_url: Optional[str] = Field(
        default=None, description="Public URL of the deployed integration"
    )
    error_log: Optional[str] = Field(
        default=None, description="Error details if failed"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = Field(..., description="User ID who created this")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
