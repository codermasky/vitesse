import asyncio
import logging
import sys
from sqlalchemy import text

# Add the parent directory to sys.path
import os

sys.path.append(os.getcwd())

from app.db.session import async_session_factory
from app.models.integration import Integration

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def cleanup_integrations():
    logger.info("Starting database cleanup...")
    async with async_session_factory() as db:
        try:
            # Delete all integrations
            # We use text() for a raw delete or just standard ORM delete
            # Let's use raw SQL for speed and simplicity in a script

            logger.info("Deleting all records from 'integrations' table...")
            await db.execute(text("DELETE FROM integrations"))
            await db.commit()

            logger.info("Successfully deleted all integration records.")

        except Exception as e:
            logger.error(f"Error cleaning up database: {e}")
            await db.rollback()
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(cleanup_integrations())
