"""
Schemas for Harvest Job API

Pydantic models for harvest job management and monitoring.
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, validator


class HarvestJobCreate(BaseModel):
    """Schema for creating a new harvest job."""

    harvest_type: str = Field(
        ...,
        description="Type of harvest to perform (full, financial, api_directory, etc.)",
    )
    source_ids: Optional[List[int]] = Field(
        None, description="Specific source IDs to harvest from (optional)"
    )

    @validator("harvest_type")
    def validate_harvest_type(cls, v):
        valid_types = [
            "full",
            "financial",
            "api_directory",
            "documentation",
            "code_repositories",
        ]
        if v not in valid_types:
            raise ValueError(f"harvest_type must be one of: {', '.join(valid_types)}")
        return v


class HarvestJobResponse(BaseModel):
    """Schema for harvest job response."""

    id: str = Field(..., description="Unique job identifier")
    harvest_type: str = Field(..., description="Type of harvest performed")
    status: str = Field(..., description="Current job status")
    progress: int = Field(..., ge=0, le=100, description="Job progress percentage")
    total_sources: int = Field(
        ..., ge=0, description="Total number of sources to process"
    )
    processed_sources: int = Field(..., ge=0, description="Number of sources processed")
    successful_harvests: int = Field(
        ..., ge=0, description="Number of successful harvests"
    )
    failed_harvests: int = Field(..., ge=0, description="Number of failed harvests")
    apis_harvested: int = Field(..., ge=0, description="Total APIs harvested")
    created_at: str = Field(..., description="Job creation timestamp")
    started_at: Optional[str] = Field(None, description="Job start timestamp")
    completed_at: Optional[str] = Field(None, description="Job completion timestamp")
    error_message: Optional[str] = Field(
        None, description="Error message if job failed"
    )

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class HarvestJobList(BaseModel):
    """Schema for paginated harvest job list."""

    items: List[HarvestJobResponse] = Field(..., description="List of harvest jobs")
    total: int = Field(..., ge=0, description="Total number of jobs")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, description="Number of items per page")
    pages: int = Field(..., ge=1, description="Total number of pages")


class HarvestJobStats(BaseModel):
    """Schema for harvest job statistics."""

    total_jobs: int = Field(..., ge=0, description="Total number of harvest jobs")
    running_jobs: int = Field(..., ge=0, description="Number of currently running jobs")
    completed_jobs: int = Field(..., ge=0, description="Number of completed jobs")
    failed_jobs: int = Field(..., ge=0, description="Number of failed jobs")
    success_rate: float = Field(
        ..., ge=0, le=100, description="Success rate percentage"
    )
    average_job_duration: int = Field(
        ..., ge=0, description="Average job duration in seconds"
    )
    total_apis_harvested: int = Field(
        ..., ge=0, description="Total APIs harvested across all jobs"
    )
    jobs_last_24h: int = Field(..., ge=0, description="Jobs in last 24 hours")
    jobs_last_7d: int = Field(..., ge=0, description="Jobs in last 7 days")
    jobs_last_30d: int = Field(..., ge=0, description="Jobs in last 30 days")
    most_common_harvest_type: str = Field(..., description="Most common harvest type")
    peak_harvest_time: str = Field(..., description="Peak harvest time (HH:MM)")


class HarvestJobStatus(BaseModel):
    """Schema for job status updates."""

    status: str = Field(..., description="New job status")
    progress: Optional[int] = Field(
        None, ge=0, le=100, description="Updated progress percentage"
    )
    message: Optional[str] = Field(None, description="Status message")

    @validator("status")
    def validate_status(cls, v):
        valid_statuses = ["queued", "running", "completed", "failed", "cancelled"]
        if v not in valid_statuses:
            raise ValueError(f"status must be one of: {', '.join(valid_statuses)}")
        return v
