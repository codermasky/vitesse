"""
Harvest Jobs API Endpoints

REST API for managing and monitoring knowledge harvesting jobs.
"""

import structlog
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

from app.db.session import get_db
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.services.harvest_collaboration_integration import HarvestJobService
from app.schemas.harvest_job import (
    HarvestJobCreate,
    HarvestJobResponse,
    HarvestJobList,
    HarvestJobStats,
    HarvestJobStatus,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/harvest-jobs", tags=["harvest-jobs"])


@router.get("/", response_model=HarvestJobList)
async def list_harvest_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    harvest_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List harvest jobs with optional filtering."""
    try:
        jobs = HarvestJobService.get_harvest_jobs(db, skip, limit, status, harvest_type)
        total = len(HarvestJobService.get_harvest_jobs(db, 0, 10000, status, harvest_type))  # Get total count

        return HarvestJobList(
            items=jobs,
            total=total,
            page=(skip // limit) + 1,
            page_size=limit,
            pages=(total + limit - 1) // limit if limit > 0 else 1,
        )
    except Exception as e:
        logger.error("Failed to list harvest jobs", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve harvest jobs")


@router.post("/", response_model=HarvestJobResponse, status_code=201)
async def create_harvest_job(
    job_data: HarvestJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create and start a new harvest job."""
    try:
        # Generate unique job ID
        job_id = f"job-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{str(uuid.uuid4())[:8]}"

        # Create job in database
        job = HarvestJobService.create_harvest_job(
            db, job_id, job_data.harvest_type, job_data.source_ids
        )

        # Start harvest in background
        background_tasks.add_task(
            run_harvest_job,
            job_id,
            job_data.harvest_type,
            job_data.source_ids,
            db,
        )

        return job

    except Exception as e:
        logger.error("Failed to create harvest job", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create harvest job")


@router.get("/{job_id}", response_model=HarvestJobResponse)
async def get_harvest_job(job_id: str, db: Session = Depends(get_db)):
    """Get a specific harvest job by ID."""
    try:
        job = HarvestJobService.get_harvest_job_by_id(db, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Harvest job not found")

        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get harvest job", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve harvest job")


@router.get("/stats/overview", response_model=HarvestJobStats)
async def get_harvest_job_stats(db: Session = Depends(get_db)):
    """Get harvest job statistics."""
    try:
        stats = HarvestJobService.get_harvest_job_stats(db)
        return HarvestJobStats(**stats)
    except Exception as e:
        logger.error("Failed to get harvest job stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve harvest job statistics")


@router.post("/{job_id}/cancel")
async def cancel_harvest_job(job_id: str, db: Session = Depends(get_db)):
    """Cancel a running harvest job."""
    # Mock implementation - in real app, signal job cancellation
    return {"message": f"Harvest job {job_id} cancelled successfully"}


async def run_harvest_job(
    job_id: str,
    harvest_type: str,
    source_ids: Optional[List[int]] = None,
    db: Session = None,
):
    """Background task to run a harvest job."""
    try:
        logger.info("Starting harvest job", job_id=job_id, harvest_type=harvest_type, source_ids=source_ids)

        # Update job status to running
        if db:
            HarvestJobService.update_harvest_job_status(db, job_id, "running", 0.0)

        # Simulate harvest execution (replace with real harvester logic)
        import asyncio
        await asyncio.sleep(2)  # Simulate processing time

        # Update progress
        if db:
            HarvestJobService.update_harvest_job_status(db, job_id, "running", 50.0)

        await asyncio.sleep(2)  # More processing

        # Complete job
        if db:
            HarvestJobService.update_harvest_job_status(
                db, job_id, "completed", 100.0,
                processed_sources=15, successful_harvests=14, failed_harvests=1, apis_harvested=127
            )

        logger.info("Harvest job completed", job_id=job_id)

    except Exception as e:
        logger.error("Harvest job failed", job_id=job_id, error=str(e))
        if db:
            HarvestJobService.update_harvest_job_status(db, job_id, "failed", error_message=str(e))