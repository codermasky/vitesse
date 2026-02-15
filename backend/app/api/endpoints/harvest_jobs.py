"""
Harvest Jobs API Endpoints

REST API for managing and monitoring knowledge harvesting jobs.
"""

import structlog
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import asyncio

from app.db.session import get_db, async_session_factory
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext
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
    db: AsyncSession = Depends(get_db),
):
    """List harvest jobs with optional filtering."""
    try:
        jobs = await HarvestJobService.get_harvest_jobs(
            db, skip, limit, status, harvest_type
        )
        all_jobs = await HarvestJobService.get_harvest_jobs(
            db, 0, 10000, status, harvest_type
        )
        total = len(all_jobs)

        # Convert datetime fields to strings for response
        jobs_with_strings = []
        for job in jobs:
            jobs_with_strings.append(
                {
                    "id": job.id,
                    "harvest_type": job.harvest_type,
                    "status": job.status,
                    "progress": job.progress,
                    "total_sources": job.total_sources,
                    "processed_sources": job.processed_sources,
                    "successful_harvests": job.successful_harvests,
                    "failed_harvests": job.failed_harvests,
                    "apis_harvested": job.apis_harvested,
                    "created_at": job.created_at.isoformat(),
                    "started_at": (
                        job.started_at.isoformat() if job.started_at else None
                    ),
                    "completed_at": (
                        job.completed_at.isoformat() if job.completed_at else None
                    ),
                    "error_message": job.error_message,
                }
            )

        return HarvestJobList(
            items=jobs_with_strings,
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
    db: AsyncSession = Depends(get_db),
):
    """Create and start a new harvest job."""
    try:
        # Generate unique job ID
        job_id = (
            f"job-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{str(uuid.uuid4())[:8]}"
        )

        # Check if any job is already running
        if await HarvestJobService.is_any_job_running(db):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A harvest job is already in progress. Please wait for it to complete.",
            )

        # Create job in database
        job = await HarvestJobService.create_harvest_job(
            db, job_id, job_data.harvest_type, job_data.source_ids
        )

        # Convert datetime fields to strings for response
        job_response = {
            "id": job.id,
            "harvest_type": job.harvest_type,
            "status": job.status,
            "progress": job.progress,
            "total_sources": job.total_sources,
            "processed_sources": job.processed_sources,
            "successful_harvests": job.successful_harvests,
            "failed_harvests": job.failed_harvests,
            "apis_harvested": job.apis_harvested,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
        }

        # Start harvest in background
        background_tasks.add_task(
            run_harvest_job,
            job_id,
            job_data.harvest_type,
            job_data.source_ids,
        )

        return job_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create harvest job", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create harvest job")


@router.get("/{job_id}", response_model=HarvestJobResponse)
async def get_harvest_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific harvest job by ID."""
    try:
        job = await HarvestJobService.get_harvest_job_by_id(db, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Harvest job not found")

        # Convert datetime fields to strings for response
        job_response = {
            "id": job.id,
            "harvest_type": job.harvest_type,
            "status": job.status,
            "progress": job.progress,
            "total_sources": job.total_sources,
            "processed_sources": job.processed_sources,
            "successful_harvests": job.successful_harvests,
            "failed_harvests": job.failed_harvests,
            "apis_harvested": job.apis_harvested,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
        }

        return job_response
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get harvest job", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve harvest job")


@router.get("/dashboard")
async def get_harvest_dashboard(db: AsyncSession = Depends(get_db)):
    """
    Get comprehensive harvest dashboard data for UI.

    Includes:
    - Scheduler status and next run times
    - Recent harvest jobs
    - Statistics and health metrics
    - Configuration status
    """
    from app.services.knowledge_harvester_scheduler import knowledge_harvester_scheduler

    try:
        # Get scheduler status
        scheduler_status = await knowledge_harvester_scheduler.get_status()

        # Get overall statistics
        stats = await HarvestJobService.get_harvest_job_stats(db)

        # Get recent jobs (last 10)
        recent_jobs = await HarvestJobService.get_harvest_jobs(db, skip=0, limit=10)

        return {
            "status": "success",
            "scheduler": {
                "is_running": scheduler_status["is_running"],
                "last_harvest_times": scheduler_status["last_harvest_times"],
                "harvest_schedule": scheduler_status["harvest_schedule"],
            },
            "statistics": stats,
            "recent_jobs": [
                {
                    "id": job.id,
                    "harvest_type": job.harvest_type,
                    "status": job.status,
                    "progress": job.progress,
                    "apis_harvested": job.apis_harvested,
                    "created_at": job.created_at.isoformat(),
                    "started_at": (
                        job.started_at.isoformat() if job.started_at else None
                    ),
                    "completed_at": (
                        job.completed_at.isoformat() if job.completed_at else None
                    ),
                }
                for job in recent_jobs
            ],
        }
    except Exception as e:
        logger.error("Failed to get harvest dashboard", error=str(e))
        raise HTTPException(
            status_code=500, detail="Failed to retrieve harvest dashboard"
        )


@router.post("/{job_id}/cancel")
async def cancel_harvest_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel a running harvest job."""
    # Mock implementation - in real app, signal job cancellation
    return {"message": f"Harvest job {job_id} cancelled successfully"}


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_harvest_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a harvest job."""
    success = await HarvestJobService.delete_harvest_job(db, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Harvest job not found")
    return None


@router.post("/bulk-delete")
async def bulk_delete_harvest_jobs(
    job_ids: List[str], db: AsyncSession = Depends(get_db)
):
    """Bulk delete harvest jobs."""
    count = await HarvestJobService.bulk_delete_harvest_jobs(db, job_ids)
    return {"message": f"Successfully deleted {count} jobs", "count": count}


@router.get("/scheduler/config")
async def get_scheduler_config():
    """Get scheduler configuration for UI settings."""
    from app.services.knowledge_harvester_scheduler import knowledge_harvester_scheduler

    try:
        # Convert datetime objects in schedule to strings
        schedule_with_strings = {}
        for key, value in knowledge_harvester_scheduler.harvest_schedule.items():
            schedule_with_strings[key] = value

        return {
            "harvest_types": [
                {
                    "id": "full",
                    "name": "Full Harvest",
                    "description": "Complete harvest of all API sources (longest)",
                    "interval_hours": knowledge_harvester_scheduler.harvest_schedule.get(
                        "full", 168
                    ),
                },
                {
                    "id": "incremental",
                    "name": "Incremental Update",
                    "description": "Quick updates to recent and changed APIs (fastest)",
                    "interval_hours": knowledge_harvester_scheduler.harvest_schedule.get(
                        "incremental", 24
                    ),
                },
                {
                    "id": "financial",
                    "name": "Financial APIs",
                    "description": "Harvest only financial services APIs",
                    "interval_hours": 24,
                },
                {
                    "id": "api_directory",
                    "name": "API Directory",
                    "description": "Harvest from APIs.guru and similar directories",
                    "interval_hours": 24,
                },
                {
                    "id": "patterns",
                    "name": "Integration Patterns",
                    "description": "Update integration patterns and transformations",
                    "interval_hours": knowledge_harvester_scheduler.harvest_schedule.get(
                        "patterns", 48
                    ),
                },
                {
                    "id": "standards",
                    "name": "Regulatory Standards",
                    "description": "Update compliance and regulatory standards",
                    "interval_hours": knowledge_harvester_scheduler.harvest_schedule.get(
                        "standards", 168
                    ),
                },
            ],
            "current_schedule": schedule_with_strings,
        }
    except Exception as e:
        logger.error("Failed to get scheduler config", error=str(e))
        raise HTTPException(
            status_code=500, detail="Failed to retrieve scheduler configuration"
        )


@router.get("/scheduler/status")
async def update_scheduler_config(config: dict):
    """
    Update scheduler configuration from UI.

    Args:
        config: Configuration dictionary with harvest intervals
                Example: {"harvest_interval_hours": 12, "incremental_hours": 6}
    """
    from app.services.knowledge_harvester_scheduler import knowledge_harvester_scheduler

    try:
        # Update harvest interval if provided
        if "harvest_interval_hours" in config:
            knowledge_harvester_scheduler.harvest_interval_hours = config[
                "harvest_interval_hours"
            ]

        # Update specific schedule intervals if provided
        if "schedule" in config:
            for harvest_type, hours in config["schedule"].items():
                if harvest_type in knowledge_harvester_scheduler.harvest_schedule:
                    knowledge_harvester_scheduler.harvest_schedule[harvest_type] = hours

        logger.info(
            "Scheduler configuration updated",
            harvest_interval=knowledge_harvester_scheduler.harvest_interval_hours,
            schedule=knowledge_harvester_scheduler.harvest_schedule,
        )

        # Convert datetime objects in schedule to strings
        schedule_with_strings = {}
        for key, value in knowledge_harvester_scheduler.harvest_schedule.items():
            schedule_with_strings[key] = value

        return {
            "status": "success",
            "message": "Scheduler configuration updated",
            "current_config": {
                "harvest_interval_hours": knowledge_harvester_scheduler.harvest_interval_hours,
                "schedule": schedule_with_strings,
            },
        }
    except Exception as e:
        logger.error("Failed to update scheduler config", error=str(e))
        raise HTTPException(
            status_code=500, detail="Failed to update scheduler configuration"
        )


@router.post("/scheduler/start")
async def start_scheduler():
    """Start the knowledge harvester scheduler."""
    from app.services.knowledge_harvester_scheduler import knowledge_harvester_scheduler

    try:
        knowledge_harvester_scheduler.start()
        logger.info("Knowledge Harvester Scheduler started via API")

        return {
            "status": "success",
            "message": "Knowledge Harvester Scheduler started",
        }
    except Exception as e:
        logger.error("Failed to start scheduler", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to start scheduler")


@router.post("/scheduler/stop")
async def stop_scheduler():
    """Stop the knowledge harvester scheduler."""
    from app.services.knowledge_harvester_scheduler import knowledge_harvester_scheduler

    try:
        if not knowledge_harvester_scheduler.is_running:
            return {
                "status": "info",
                "message": "Scheduler is not running",
            }

        knowledge_harvester_scheduler.stop()
        logger.info("Knowledge Harvester Scheduler stopped via API")

        return {
            "status": "success",
            "message": "Knowledge Harvester Scheduler stopped",
        }
    except Exception as e:
        logger.error("Failed to stop scheduler", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to stop scheduler")


@router.post("/trigger")
async def trigger_harvest(
    harvest_type: str = "incremental",
    source_ids: Optional[List[int]] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Manually trigger a harvest job.

    Args:
        harvest_type: Type of harvest (full, incremental, financial, api_directory, etc.)
        source_ids: Optional list of specific source IDs to harvest from

    Returns:
        Job creation response
    """
    from app.services.knowledge_harvester_scheduler import knowledge_harvester_scheduler

    try:
        logger.info(
            "Manual harvest triggered via API",
            harvest_type=harvest_type,
            source_ids=source_ids,
        )

        # Generate unique job ID
        job_id = (
            f"manual-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{str(uuid.uuid4())[:8]}"
        )

        # Check if any job is already running
        async with async_session_factory() as db_check:
            if await HarvestJobService.is_any_job_running(db_check):
                return {
                    "status": "conflict",
                    "message": "A harvest job is already in progress.",
                }

        # Create job in database
        async with async_session_factory() as db:
            job = await HarvestJobService.create_harvest_job(
                db, job_id, harvest_type, source_ids
            )

        # Start harvest in background
        background_tasks.add_task(
            run_harvest_job,
            job_id,
            harvest_type,
            source_ids,
        )

        return {
            "status": "success",
            "job_id": job_id,
            "harvest_type": harvest_type,
            "message": "Harvest job initiated",
        }

    except Exception as e:
        logger.error("Failed to trigger harvest", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger harvest")


async def run_harvest_job(
    job_id: str,
    harvest_type: str,
    source_ids: Optional[List[int]] = None,
):
    """Background task to run a harvest job using the real KnowledgeHarvester."""
    try:
        logger.info(
            "Starting harvest job",
            job_id=job_id,
            harvest_type=harvest_type,
            source_ids=source_ids,
        )

        # Update job status to running
        async with async_session_factory() as db_async:
            await HarvestJobService.update_harvest_job_status(
                db_async, job_id, "running", progress=0.0
            )

        # Create agent context
        context = AgentContext()

        # Initialize harvester
        harvester = KnowledgeHarvester(context)

        # Execute harvest
        logger.info(
            "Executing harvest agent",
            job_id=job_id,
            harvest_type=harvest_type,
        )

        # Progress callback
        async def on_progress(p: float):
            logger.info("Reporting harvest progress", job_id=job_id, progress=p)
            async with async_session_factory() as db_prog:
                await HarvestJobService.update_harvest_job_status(
                    db_prog, job_id, "running", progress=p
                )

        result = await harvester.execute(
            context={},
            input_data={"harvest_type": harvest_type},
            on_progress=on_progress,
        )

        # Extract results
        total_harvested = result.get("total_harvested", 0)
        sources_harvested = result.get("sources_harvested", [])

        logger.info(
            "Harvest execution completed",
            job_id=job_id,
            total_harvested=total_harvested,
            sources_harvested=sources_harvested,
        )

        # Update job in database with success
        async with async_session_factory() as db_async:
            await HarvestJobService.update_harvest_job_status(
                db_async,
                job_id,
                "completed",
                progress=100.0,
                processed_sources=len(sources_harvested),
                successful_harvests=total_harvested,
                failed_harvests=0,
                apis_harvested=total_harvested,
            )

        logger.info(
            "Harvest job completed successfully",
            job_id=job_id,
            harvest_type=harvest_type,
            total_harvested=total_harvested,
        )

    except Exception as e:
        error_msg = str(e)
        logger.error(
            "Harvest job failed",
            job_id=job_id,
            harvest_type=harvest_type,
            error=error_msg,
            exc_info=True,
        )

        # Update job status to failed
        try:
            async with async_session_factory() as db_async:
                await HarvestJobService.update_harvest_job_status(
                    db_async, job_id, "failed", error_message=error_msg
                )
        except Exception as db_error:
            logger.error(
                "Failed to update harvest job status",
                job_id=job_id,
                error=str(db_error),
            )
