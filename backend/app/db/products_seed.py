"""
Seed Products Configuration

Initializes the system with actual products from the database or defaults.
This enables the system to know which products are available for integrations.
"""

import asyncio
import structlog
from sqlalchemy import select
from app.models.setting import SystemSetting
from app.db.session import async_session_factory

logger = structlog.get_logger(__name__)


# Default products if none are configured
DEFAULT_PRODUCTS = [
    "CapitalStream",
    "Longview",
    "Ekip",
    "MFEX",
    "Globalhedge",
]


async def seed_products():
    """
    Seed or update products configuration.

    Checks if products are already configured in the database.
    If not, initializes with DEFAULT_PRODUCTS.
    If products exist, logs them for reference.
    """
    async with async_session_factory() as db:
        logger.info("Checking for configured products...")

        try:
            # Check if products setting exists
            stmt = select(SystemSetting).where(SystemSetting.key == "products")
            existing = await db.scalar(stmt)

            if existing:
                logger.info(
                    f"Products already configured: {existing.value}",
                    product_count=len(existing.value) if existing.value else 0,
                )
            else:
                # Create new products setting with defaults
                products_setting = SystemSetting(
                    key="products",
                    value=DEFAULT_PRODUCTS,
                    description="Product list for integration destinations",
                )
                db.add(products_setting)
                await db.commit()
                logger.info(
                    f"Initialized products with defaults",
                    products=DEFAULT_PRODUCTS,
                    product_count=len(DEFAULT_PRODUCTS),
                )

        except Exception as e:
            logger.error(f"Error seeding products: {e}")
            raise

        logger.info("Products seeding complete")


async def get_current_products():
    """
    Retrieve current products from the database.

    Returns the configured products or defaults if none are set.
    """
    async with async_session_factory() as db:
        stmt = select(SystemSetting).where(SystemSetting.key == "products")
        setting = await db.scalar(stmt)

        if setting and setting.value:
            return setting.value
        return DEFAULT_PRODUCTS


if __name__ == "__main__":
    asyncio.run(seed_products())
