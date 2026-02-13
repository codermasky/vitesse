from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime


class BaseState(BaseModel):
    """Generic base state for agentic workflows."""

    workflow_id: str = Field(
        ..., description="Unique identifier for the workflow execution"
    )
    source_file_path: Optional[str] = None
    source_file_paths: List[str] = Field(default_factory=list)

    # Generic data container
    data: Dict[str, Any] = Field(default_factory=dict)

    # Execution metadata
    flags: List[str] = Field(default_factory=list)
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)
