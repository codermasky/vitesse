"""Seed LangFuse configuration in the database."""

import structlog
from sqlalchemy import text
from app.db.session import async_session_factory
from app.services.langfuse_config_service import LangFuseConfigService

logger = structlog.get_logger(__name__)


async def seed_langfuse_config():
    """Seed default LangFuse configuration if not already configured."""
    async with async_session_factory() as db:
        logger.info("Checking LangFuse configuration...")

        try:
            # First check if the table exists
            table_check = await db.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'langfuse_config')"))
            table_exists = table_check.scalar()
            
            if not table_exists:
                logger.info("LangFuse config table does not exist, skipping seeding")
                return

            # Check if config already exists
            existing_config = await LangFuseConfigService.get_config(db)

            if existing_config:
                logger.info(
                    "LangFuse configuration already exists",
                    enabled=existing_config.enabled,
                )
                return

            # Create default enabled config
            # Users will provide API keys via API endpoint
            logger.info("Creating default LangFuse configuration (enabled)")

            config = await LangFuseConfigService.create_or_update_config(
                db=db,
                public_key="",  # User should provide via API
                secret_key="",  # User should provide via API
                host="http://localhost:3000",
                enabled=True,  # Enabled by default
                created_by="system",
            )
            logger.info(
                "Default LangFuse configuration created",
                config_id=config.id,
                enabled=config.enabled,
            )
        except Exception as e:
            logger.warning("Error during LangFuse config seeding, attempting rollback and retry", error=str(e))
            try:
                # Rollback the transaction to clear aborted state
                await db.rollback()
                logger.info("Database transaction rolled back, retrying...")

                # Retry the operation with a fresh session
                async with async_session_factory() as retry_db:
                    # Check table exists again
                    table_check = await retry_db.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'langfuse_config')"))
                    table_exists = table_check.scalar()
                    
                    if not table_exists:
                        logger.info("LangFuse config table does not exist on retry, skipping")
                        return

                    existing_config = await LangFuseConfigService.get_config(retry_db)
                    if existing_config:
                        logger.info("LangFuse configuration already exists on retry")
                        return

                    config = await LangFuseConfigService.create_or_update_config(
                        db=retry_db,
                        public_key="",
                        secret_key="",
                        host="http://localhost:3000",
                        enabled=True,
                        created_by="system",
                    )
                    await retry_db.commit()
                    logger.info("Default LangFuse configuration created on retry", config_id=config.id)

            except Exception as retry_e:
                logger.error("Failed to seed LangFuse config even after retry", error=str(retry_e))
                # Don't raise the exception - allow the app to start without LangFuse config
                logger.warning("Continuing without LangFuse configuration seeding")
