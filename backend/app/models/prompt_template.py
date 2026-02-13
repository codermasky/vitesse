"""
Prompt Template Model for version-controlled prompts in database.

This enables:
- Prompt versioning and rollback
- A/B testing different prompts
- Tracking prompt performance over time
- UI-based prompt management without code changes
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean, JSON
from pydantic import BaseModel, Field

from app.db.session import Base

# ============================================================================
# SQLAlchemy Model
# ============================================================================


class PromptTemplate(Base):
    """Database model for versioned prompt templates."""

    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True, index=True)
    agent_id = Column(String(100), index=True, nullable=False)
    template_name = Column(String(255), nullable=False)  # e.g., "extract_covenants_v1"
    template_type = Column(String(50), nullable=False)  # "system" or "user"

    # Prompt content
    content = Column(Text, nullable=False)

    # Versioning
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(
        Boolean, default=False, nullable=False
    )  # Only one version active per agent/template_name

    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)  # ["financial", "extraction", "covenant"]
    parameters = Column(JSON, default=dict)  # {"temperature": 0.2, "max_tokens": 2000}

    # Performance tracking
    usage_count = Column(Integer, default=0)
    success_rate = Column(Integer, default=0)  # 0-100 percentage
    avg_latency_ms = Column(Integer, default=0)
    avg_cost_usd = Column(Integer, default=0)  # in cents
    avg_output_tokens = Column(Integer, default=0)

    # Testing & A/B
    is_experimental = Column(Boolean, default=False)
    experiment_id = Column(String(100), nullable=True, index=True)
    control_version_id = Column(String(36), nullable=True)  # For A/B testing

    # Audit trail
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at_datetime = Column(
        DateTime, default=datetime.utcnow
    )  # Redundant but sometimes needed

    # Optional rollback info
    previous_version_id = Column(String(36), nullable=True)
    rollback_reason = Column(Text, nullable=True)

    def __repr__(self):
        return f"<PromptTemplate {self.agent_id}:{self.template_name} v{self.version}>"


class PromptTemplateHistory(Base):
    """Track all changes to prompts for audit and rollback."""

    __tablename__ = "prompt_template_history"

    id = Column(String(36), primary_key=True, index=True)
    template_id = Column(String(36), nullable=False, index=True)
    agent_id = Column(String(100), index=True, nullable=False)

    # What changed
    old_content = Column(Text, nullable=True)
    new_content = Column(Text, nullable=False)
    change_type = Column(
        String(50), nullable=False
    )  # "created", "modified", "activated", "deactivated"

    # Why it changed
    change_reason = Column(Text, nullable=True)

    # Who changed it
    changed_by = Column(String(100), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ============================================================================
# Pydantic Schemas (for API)
# ============================================================================


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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PromptTemplateListResponse(BaseModel):
    """Schema for listing prompt templates."""

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
