"""Seed LangFuse configuration in the database."""

import structlog
from app.db.session import async_session_factory
from app.services.langfuse_config_service import LangFuseConfigService

logger = structlog.get_logger(__name__)


async def seed_langfuse_config():
    """Seed default LangFuse configuration if not already configured."""
    async with async_session_factory() as db:
        logger.info("Checking LangFuse configuration...")

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

        try:
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
            logger.error("Error creating default LangFuse configuration", error=str(e))
            raise
