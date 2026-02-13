"""LangFuse Configuration Service"""

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.langfuse_config import LangFuseConfig
from app.schemas.langfuse_config import LangFuseConfigUpdate

logger = structlog.get_logger(__name__)


class LangFuseConfigService:
    """Service for managing LangFuse configuration"""

    @staticmethod
    async def get_config(db: AsyncSession) -> LangFuseConfig | None:
        """Get the current LangFuse configuration"""
        try:
            result = await db.execute(select(LangFuseConfig).limit(1))
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error("Error fetching LangFuse config", error=str(e))
            return None

    @staticmethod
    async def create_or_update_config(
        db: AsyncSession,
        public_key: str,
        secret_key: str,
        host: str,
        enabled: bool = True,
        created_by: str = "system",
    ) -> LangFuseConfig:
        """Create or update LangFuse configuration"""
        try:
            # Get existing config
            result = await db.execute(select(LangFuseConfig).limit(1))
            config = result.scalar_one_or_none()

            if config:
                # Update existing
                config.public_key = public_key
                config.secret_key = secret_key
                config.host = host
                config.enabled = enabled
                config.updated_by = created_by
                logger.info("Updated LangFuse configuration")
            else:
                # Create new
                config = LangFuseConfig(
                    public_key=public_key,
                    secret_key=secret_key,
                    host=host,
                    enabled=enabled,
                    created_by=created_by,
                    updated_by=created_by,
                )
                db.add(config)
                logger.info("Created new LangFuse configuration")

            await db.commit()
            await db.refresh(config)
            return config

        except Exception as e:
            await db.rollback()
            logger.error("Error updating LangFuse config", error=str(e))
            raise

    @staticmethod
    async def enable_langfuse(
        db: AsyncSession, updated_by: str = "system"
    ) -> LangFuseConfig:
        """Enable LangFuse"""
        config = await LangFuseConfigService.get_config(db)
        if config:
            config.enabled = True
            config.updated_by = updated_by
            await db.commit()
            logger.info("Enabled LangFuse")
        return config

    @staticmethod
    async def disable_langfuse(
        db: AsyncSession, updated_by: str = "system"
    ) -> LangFuseConfig:
        """Disable LangFuse"""
        config = await LangFuseConfigService.get_config(db)
        if config:
            config.enabled = False
            config.updated_by = updated_by
            await db.commit()
            logger.info("Disabled LangFuse")
        return config
