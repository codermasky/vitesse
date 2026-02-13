import structlog
from typing import Optional
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from app.core.config import settings

logger = structlog.get_logger(__name__)

# Global instances
_pool: Optional[AsyncConnectionPool] = None
checkpointer: Optional[AsyncPostgresSaver] = None


async def init_checkpointer():
    """Initialize the PostgreSQL checkpointer."""
    global _pool, checkpointer

    if checkpointer is not None:
        return checkpointer

    # Use the synchronous URI for psycopg
    conn_str = settings.sql_database_uri
    logger.info(
        f"Initializing persistent checkpointer with connection to: {settings.POSTGRES_SERVER}"
    )

    try:
        # Create connection pool with autocommit enabled for migrations
        _pool = AsyncConnectionPool(
            conninfo=conn_str, max_size=20, open=False, kwargs={"autocommit": True}
        )
        await _pool.open()

        # Create checkpointer
        checkpointer = AsyncPostgresSaver(_pool)

        # Initialize tables
        await checkpointer.setup()

        logger.info("Persistent checkpointer initialized successfully")
        return checkpointer
    except Exception as e:
        logger.error(f"Failed to initialize persistent checkpointer: {e}")
        raise


async def get_checkpointer() -> Optional[AsyncPostgresSaver]:
    """Get the initialized checkpointer instance."""
    if checkpointer is None:
        return await init_checkpointer()
    return checkpointer


async def close_checkpointer():
    """Close the checkpointer connection pool."""
    global _pool, checkpointer
    if _pool:
        await _pool.close()
        _pool = None
    checkpointer = None
