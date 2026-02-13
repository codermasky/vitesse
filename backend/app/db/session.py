from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.sql_database_uri.replace("postgresql://", "postgresql+asyncpg://"),
    echo=False,  # Set to True for SQL query logging in development
    future=True,
    connect_args={"ssl": False},  # Disable SSL for local development
)

# Create async session factory
async_session_factory = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
