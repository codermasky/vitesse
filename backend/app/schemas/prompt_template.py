"""
Pydantic schemas for Prompt Template API.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class PromptTemplateCreate(BaseModel):
    """Schema for creating a new prompt template."""

    agent_id: str = Field(
        ..., description="Agent ID (e.g., 'analyst', 'covenant_compliance')"
    )
    template_name: str = Field(
        ..., description="Template name (e.g., 'extract_covenants')"
    )
    template_type: str = Field(..., description="'system' or 'user'")
    content: str = Field(..., description="Prompt content")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "agent_id": "covenant_compliance",
                "template_name": "extract_covenants",
                "template_type": "system",
                "content": "You are an expert Credit Officer...",
                "description": "Extract financial covenants from loan agreements",
                "tags": ["extraction", "covenant", "credit"],
                "parameters": {"temperature": 0.2},
                "created_by": "user@example.com",
            }
        }


class PromptTemplateUpdate(BaseModel):
    """Schema for updating a prompt template."""

    content: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    parameters: Optional[Dict[str, Any]] = None
    updated_by: Optional[str] = None
    change_reason: Optional[str] = None


class PromptTemplateResponse(BaseModel):
    """Schema for API responses."""

    id: str
    agent_id: str
    template_name: str
    template_type: str
    content: str
    version: int
    is_active: bool
    description: Optional[str]
    tags: List[str]
    parameters: Dict[str, Any]
    usage_count: int
    success_rate: int
    avg_latency_ms: int
    avg_cost_usd: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PromptTemplateSummary(BaseModel):
    """Schema for template summary in list responses."""

    id: str
    agent_id: str
    template_name: str
    template_type: str
    version: int
    is_active: bool
    description: Optional[str]
    tags: List[str]
    usage_count: int
    success_rate: int
    created_at: datetime

    class Config:
        from_attributes = True


class PromptTemplateListResponse(BaseModel):
    """Schema for listing prompt templates."""

    agent_id: str
    templates: List[PromptTemplateSummary]
    total_count: int


class PromptComparisonRequest(BaseModel):
    """Schema for A/B testing prompts."""

    agent_id: str
    template_name: str
    control_version: int
    test_version: int
    sample_inputs: List[Dict[str, Any]]
    success_metric: str = Field(
        default="quality_score",
        description="Metric to compare: 'quality_score', 'latency', 'cost', 'token_count'",
    )


class PromptEvaluationResult(BaseModel):
    """Schema for evaluation results."""

    template_id: str
    version: int
    evaluation_score: float
    metric: str
    test_cases_passed: int
    test_cases_total: int
    avg_latency_ms: float
    avg_cost_usd: float
    evaluated_at: datetime


class ABTestRequest(BaseModel):
    """Request to start A/B test."""

    agent_id: str
    template_name: str
    control_version: int
    test_version: int
    experiment_id: str = Field(..., description="Unique experiment identifier")
    duration_hours: int = Field(default=24, description="How long to run test")
    traffic_split: int = Field(
        default=50, description="Percentage of traffic to test version"
    )


class ABTestResult(BaseModel):
    """Results of A/B test."""

    experiment_id: str
    agent_id: str
    template_name: str
    control_version: int
    test_version: int

    # Metrics
    control_latency_ms: float
    test_latency_ms: float
    latency_improvement: float  # percentage

    control_cost_usd: float
    test_cost_usd: float
    cost_improvement: float  # percentage

    control_success_rate: float
    test_success_rate: float
    success_rate_improvement: float  # percentage

    statistical_significance: bool
    confidence_level: float  # 0-1
    recommendation: str  # "control", "test", or "inconclusive"
