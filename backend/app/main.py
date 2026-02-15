import sys
import os
from pathlib import Path

# Add Aether platform to path
# Inside Docker, we mount it to /aether_src. On host, we use the absolute path.
AETHER_PATH_DOCKER = Path("/aether_src")
AETHER_PATH_HOST = Path("/Users/sujitm/Sandbox/Aether/src")

if AETHER_PATH_DOCKER.exists():
    sys.path.append(str(AETHER_PATH_DOCKER))
elif AETHER_PATH_HOST.exists():
    sys.path.append(str(AETHER_PATH_HOST))
else:
    print("WARNING: Aether platform source not found. Agentic features may fail.")


from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import structlog

from app.api.api import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.telemetry import init_telemetry
from app.core.langfuse_client import init_langfuse
from app.db.session import engine
from app.db.base import Base
from app.db.user_seed import seed_users
from app.db.llm_seed import seed_llm_configs
from app.db.langfuse_seed import seed_langfuse_config
from app.db.products_seed import seed_products
from app.db.langfuse_seed import seed_langfuse_config
from app.core.checkpoint import init_checkpointer, close_checkpointer
from app.core.ratelimit import limiter
from app.core.knowledge_db import initialize_knowledge_db
from app.core.seed_data import seed_all, check_seed_status

# Setup logging
setup_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    logger.info("Starting Vitesse AI backend application")

    # Ensure upload directory exists
    import os

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Initialize persistent LangGraph checkpointer
    await init_checkpointer()

    # Database tables are managed by Alembic migrations
    logger.info("Database schema is managed by Alembic migrations")

    # Initialize Knowledge Database and seed financial services data
    logger.info("Initializing Knowledge Database (Qdrant)...")
    try:
        await initialize_knowledge_db(
            backend="qdrant",
            url=os.getenv("QDRANT_URL", "http://localhost:6333"),
            api_key=os.getenv("QDRANT_API_KEY"),
            prefer_grpc=False,  # Use HTTP to avoid gRPC serialization issues
        )

        # Check and seed knowledge bases
        seed_status = await check_seed_status()
        logger.info("Seed data status", status=seed_status)

        if seed_status.get("status") in ["partial", "error"]:
            logger.info(
                "Initializing seed data for financial services knowledge base..."
            )
            seed_result = await seed_all()
            logger.info("Seed data initialization complete", result=seed_result)
    except Exception as e:
        logger.warning(
            "Knowledge Database initialization failed, continuing without Qdrant",
            error=str(e),
        )
        logger.info("UI features will work without vector database functionality")

    # Seed initial data
    await seed_users()
    await seed_llm_configs()
    await seed_products()

    # Seed LangFuse config (non-critical for startup)
    try:
        await seed_langfuse_config()
    except Exception as e:
        logger.warning(
            "LangFuse configuration seeding failed, continuing without it", error=str(e)
        )

    # Initialize LangFuse (Auto-provision or load from DB)
    try:
        from app.db.session import async_session_factory
        from app.services.langfuse_setup_service import langfuse_setup_service

        await langfuse_setup_service.ensure_configured()
    except Exception as e:
        logger.warning(
            "LangFuse setup failed, continuing without LangFuse integration",
            error=str(e),
        )
    # Start recovery of interrupted tasks
    from app.services.recovery import recovery_service
    import asyncio

    asyncio.create_task(recovery_service.recover_interrupted_tasks())

    # Start email scheduler
    from app.services.email_scheduler import start_email_scheduler
    from app.services.llm_config_service import llm_config_service

    start_email_scheduler()

    # Start drift monitor
    from app.tasks.monitor import start_monitor_scheduler

    start_monitor_scheduler()

    # Initialize and start knowledge harvester scheduler
    from app.services.knowledge_harvester_scheduler import (
        initialize_harvester_scheduler,
    )

    try:
        await initialize_harvester_scheduler()
        logger.info("Knowledge Harvester Scheduler initialized and started")
    except Exception as e:
        logger.warning(
            "Failed to initialize Knowledge Harvester Scheduler, continuing without it",
            error=str(e),
        )
        # Don't fail startup if scheduler can't initialize - the API can still be used manually

    # Pre-warm prompt cache
    async with async_session_factory() as db:
        await llm_config_service.initialize_agent_configs(db)

    yield

    logger.info("Shutting down Vitesse AI backend application")
    await close_checkpointer()


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="Agentic Digital Credit Analyst Module",
        version="0.1.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Initialize Rate Limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # Add Error Handling Middleware
    from app.middleware.error_handler import ErrorHandlingMiddleware

    app.add_middleware(ErrorHandlingMiddleware)

    # Initialize Telemetry (OpenTelemetry & Sentry)
    init_telemetry(app)

    # Set up CORS
    origins = [str(orig).rstrip("/") for orig in settings.BACKEND_CORS_ORIGINS]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "service": "vitesse-backend"}

    @app.get("/api/v1/system/langfuse-status")
    async def get_langfuse_status():
        from app.core.langfuse_client import get_langfuse_client, is_langfuse_enabled

        client = get_langfuse_client()
        return {
            "enabled": is_langfuse_enabled(),
            "client_initialized": client is not None,
            "client_address": id(client) if client else None,
            "client_host": (
                client.host if client and hasattr(client, "host") else "unknown"
            ),
            "client_public_key": (
                client.public_key[:5] + "..."
                if client and hasattr(client, "public_key") and client.public_key
                else None
            ),
        }

    return app


app = create_application()
