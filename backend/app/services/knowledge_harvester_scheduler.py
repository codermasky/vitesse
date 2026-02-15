"""
Knowledge Harvester Scheduler Service

Manages continuous, background knowledge harvesting operations.
Periodically discovers and indexes new API specifications, standards, and patterns.
"""

import asyncio
import structlog
from typing import Optional
from datetime import datetime, timedelta
import uuid

from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext
from app.db.session import async_session_factory
from app.services.harvest_collaboration_integration import HarvestJobService

logger = structlog.get_logger(__name__)


class KnowledgeHarvesterScheduler:
    """
    Scheduler for autonomous knowledge harvesting.

    Runs periodically to:
    - Discover new APIs from documentation sites, GitHub, APIs.guru, etc.
    - Extract API specifications and field mappings
    - Update the knowledge base with harvested patterns
    - Track harvest job status and metrics
    """

    def __init__(self):
        self.harvester: Optional[KnowledgeHarvester] = None
        self.is_running = False

        # Harvest schedule (configurable)
        self.harvest_interval_hours = 24  # Run every 24 hours
        self.harvest_schedule = {
            "full": 24 * 7,  # Full harvest every week
            "incremental": 24,  # Incremental updates daily
            "patterns": 24 * 2,  # Pattern updates every 2 days
            "standards": 24 * 7,  # Regulatory standards weekly
        }

        # Track last harvest times
        self.last_harvest_times = {
            "full": None,
            "incremental": None,
            "patterns": None,
            "standards": None,
        }

    async def initialize(self):
        """Initialize the scheduler (called at startup)."""
        logger.info("Initializing Knowledge Harvester Scheduler")

        try:
            # Create harvester agent context
            context = AgentContext()

            # Initialize harvester
            self.harvester = KnowledgeHarvester(context)
            logger.info("KnowledgeHarvester initialized successfully")

        except Exception as e:
            logger.error("Failed to initialize KnowledgeHarvester", error=str(e))
            raise

    def start(self):
        """Start the scheduler background task."""
        if self.is_running:
            logger.warning("Knowledge Harvester Scheduler already running")
            return

        self.is_running = True
        asyncio.create_task(self._scheduler_loop())
        logger.info("Knowledge Harvester Scheduler started")

    async def _scheduler_loop(self):
        """Main scheduler loop that runs periodically."""
        logger.info("Starting Knowledge Harvester scheduler loop")

        while self.is_running:
            try:
                # Check if it's time to run harvest
                should_run, harvest_type = self._check_schedule()

                if should_run:
                    logger.info("Running scheduled harvest", harvest_type=harvest_type)
                    await self._execute_harvest(harvest_type)
                    self.last_harvest_times[harvest_type] = datetime.utcnow()

            except Exception as e:
                logger.error("Error in scheduler loop", error=str(e))

            # Sleep for 1 hour before checking again
            await asyncio.sleep(3600)

    def _check_schedule(self) -> tuple[bool, Optional[str]]:
        """
        Check if any harvest should run.

        Returns:
            Tuple of (should_run, harvest_type)
        """
        now = datetime.utcnow()

        # Check in priority order: full, standards, patterns, incremental
        check_order = ["full", "standards", "patterns", "incremental"]

        for harvest_type in check_order:
            last_run = self.last_harvest_times.get(harvest_type)
            interval_hours = self.harvest_schedule.get(harvest_type, 24)

            # If never run, run immediately
            if last_run is None:
                return True, harvest_type

            # Check if interval has passed
            time_since_last = now - last_run
            if time_since_last >= timedelta(hours=interval_hours):
                return True, harvest_type

        return False, None

    async def _execute_harvest(self, harvest_type: str) -> dict:
        """
        Execute a harvest job and track in database.

        Args:
            harvest_type: Type of harvest to execute (full, incremental, etc.)

        Returns:
            Harvest result dictionary
        """
        if not self.harvester:
            logger.error("Harvester not initialized")
            return {"status": "error", "error": "Harvester not initialized"}

        # Generate job ID
        job_id = f"harvest-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{str(uuid.uuid4())[:8]}"

        try:
            # Create job in database
            async with async_session_factory() as db:
                await HarvestJobService.create_harvest_job(db, job_id, harvest_type)
                await HarvestJobService.update_harvest_job_status(
                    db, job_id, "running", progress=0.0
                )

            logger.info(
                "Starting harvest job",
                job_id=job_id,
                harvest_type=harvest_type,
            )

            # Execute harvest
            result = await self.harvester.execute(
                context={},
                input_data={"harvest_type": harvest_type},
            )

            # Update job in database with results
            async with async_session_factory() as db:
                await HarvestJobService.update_harvest_job_status(
                    db,
                    job_id,
                    "completed",
                    progress=100.0,
                    processed_sources=result.get("total_harvested", 0),
                    successful_harvests=result.get("total_harvested", 0),
                    failed_harvests=0,
                    apis_harvested=result.get("total_harvested", 0),
                )

            logger.info(
                "Harvest job completed",
                job_id=job_id,
                harvest_type=harvest_type,
                total_harvested=result.get("total_harvested", 0),
                sources=result.get("sources_harvested", []),
            )

            return {
                "status": "success",
                "job_id": job_id,
                "harvest_type": harvest_type,
                "result": result,
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(
                "Harvest job failed",
                job_id=job_id,
                harvest_type=harvest_type,
                error=error_msg,
            )

            # Update job status to failed
            try:
                async with async_session_factory() as db:
                    await HarvestJobService.update_harvest_job_status(
                        db,
                        job_id,
                        "failed",
                        error_message=error_msg,
                    )
            except Exception as db_error:
                logger.error("Failed to update harvest job status", error=str(db_error))

            return {
                "status": "error",
                "job_id": job_id,
                "harvest_type": harvest_type,
                "error": error_msg,
            }

    async def trigger_manual_harvest(
        self,
        harvest_type: str = "incremental",
        source_ids: Optional[list] = None,
    ) -> dict:
        """
        Manually trigger a harvest job (called via API).

        Args:
            harvest_type: Type of harvest (full, incremental, financial, etc.)
            source_ids: Optional list of specific sources to harvest from

        Returns:
            Harvest job info
        """
        if not self.harvester:
            logger.error("Harvester not initialized")
            return {"status": "error", "error": "Harvester not initialized"}

        logger.info(
            "Manual harvest triggered",
            harvest_type=harvest_type,
            source_ids=source_ids,
        )

        # Execute in background without blocking
        asyncio.create_task(self._execute_harvest(harvest_type))

        return {
            "status": "queued",
            "harvest_type": harvest_type,
            "message": "Harvest job queued for execution",
        }

    def stop(self):
        """Stop the scheduler."""
        self.is_running = False
        logger.info("Knowledge Harvester Scheduler stopped")

    async def get_status(self) -> dict:
        """Get current scheduler status."""
        return {
            "is_running": self.is_running,
            "last_harvest_times": {
                k: v.isoformat() if v else None
                for k, v in self.last_harvest_times.items()
            },
            "harvest_schedule": self.harvest_schedule,
            "harvester_initialized": self.harvester is not None,
        }


# Global scheduler instance
knowledge_harvester_scheduler = KnowledgeHarvesterScheduler()


async def initialize_harvester_scheduler():
    """Initialize the scheduler during app startup."""
    try:
        await knowledge_harvester_scheduler.initialize()
        knowledge_harvester_scheduler.start()
    except Exception as e:
        logger.error("Failed to initialize harvester scheduler", error=str(e))
        # Don't fail startup if scheduler can't initialize
        raise


def start_harvester_scheduler():
    """Start the scheduler task (called from main.py lifespan)."""
    knowledge_harvester_scheduler.start()
