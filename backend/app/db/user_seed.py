import asyncio
import structlog
from sqlalchemy import select
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.services.user import user_service
from app.db.session import async_session_factory
from app.db.base import Base  # noqa


logger = structlog.get_logger(__name__)


async def seed_users():
    """Seed initial users if they don't exist."""
    async with async_session_factory() as db:
        logger.info("Checking for initial users to seed...")

        users_to_seed = [
            UserCreate(
                email="admin@vitesse.ai",
                password="vit123!",
                full_name="System Admin",
                is_superuser=True,
                role=UserRole.ADMIN,
            ),
            UserCreate(
                email="analyst@vitesse.ai",
                password="vit123!",
                full_name="Lead Analyst",
                is_superuser=False,
                role=UserRole.ANALYST,
            ),
            UserCreate(
                email="reviewer@vitesse.ai",
                password="vit123!",
                full_name="Quality Reviewer",
                is_superuser=False,
                role=UserRole.REVIEWER,
            ),
            UserCreate(
                email="requestor@vitesse.ai",
                password="vit123!",
                full_name="Business Requestor",
                is_superuser=False,
                role=UserRole.REQUESTOR,
            ),
        ]

        for user_in in users_to_seed:
            try:
                # Check if user already exists
                user = await user_service.get_by_email(db, email=user_in.email)
                if not user:
                    await user_service.create(db, obj_in=user_in)
                    logger.info(f"Created user: {user_in.email}")
                else:
                    logger.debug(f"User already exists: {user_in.email}")
            except Exception as e:
                logger.error(f"Error seeding user {user_in.email}: {e}")

        logger.info("Startup user seeding complete")


if __name__ == "__main__":
    asyncio.run(seed_users())
