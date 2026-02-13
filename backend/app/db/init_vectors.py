import asyncio
import logging
from sqlalchemy import text
from app.db.session import engine
from app.db.base import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def init_vectors():
    async with engine.begin() as conn:
        logger.info("Enabling vector extension...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

        logger.info("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Vector DB initialization complete.")


if __name__ == "__main__":
    asyncio.run(init_vectors())
