import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.queue_request import QueueRequest, QueueStatus

# from app.agents.orchestrator import agent_orchestrator
from app.services.queue_service import queue_service

logger = structlog.get_logger(__name__)


class RecoveryService:
    """Service to recover interrupted tasks on startup."""

    async def recover_interrupted_tasks(self):
        """Find in-progress tasks and resume them."""
        logger.info("Starting recovery of interrupted tasks")

        try:
            async with async_session_factory() as db:
                # Find tasks that are marked 'in_progress'
                stmt = select(QueueRequest).where(
                    QueueRequest.status == QueueStatus.IN_PROGRESS
                )
                result = await db.execute(stmt)
                interrupted_tasks = result.scalars().all()

                if not interrupted_tasks:
                    logger.info("No interrupted tasks found")
                    return

                logger.info(
                    f"Found {len(interrupted_tasks)} interrupted tasks to recover"
                )

                for task in interrupted_tasks:
                    try:
                        logger.info(
                            "Resuming interrupted task",
                            task_id=task.id,
                            deal_id=task.deal_id,
                            stage=task.progress_stage,
                        )

                        # Trigger the background processing task
                        # We import here to avoid circular dependencies
                        from app.api.endpoints.queue import process_queue_request_task

                        # Run it in an asyncio task so it doesn't block recovery of others
                        import asyncio

                        asyncio.create_task(process_queue_request_task(task.id))

                        logger.info("Task recovery triggered", task_id=task.id)

                    except Exception as e:
                        logger.error(
                            "Failed to trigger task recovery",
                            task_id=task.id,
                            error=str(e),
                        )
                        # Mark as failed so we don't loop forever
                        await queue_service.update(
                            db, db_obj=task, obj_in={"status": QueueStatus.FAILED}
                        )
                        await db.commit()
        except Exception as e:
            # Check if this is a missing table error
            if "does not exist" in str(e) or "UndefinedTable" in str(e):
                logger.warning(
                    "Database tables not yet initialized, skipping task recovery",
                    error=str(e),
                )
            else:
                logger.error("Error during task recovery", error=str(e))


recovery_service = RecoveryService()
