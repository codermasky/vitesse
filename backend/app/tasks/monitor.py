import asyncio
import httpx
import json
import structlog
from typing import Dict, Any, Optional
from datetime import datetime

from sqlalchemy import select
from app.db.session import async_session_factory
from app.models.integration import Integration, IntegrationStatusEnum
from app.services.drift.detector import SchemaDriftDetector, SchemaDriftReport

logger = structlog.get_logger(__name__)


async def fetch_latest_spec(url: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the latest API specification from the source URL.
    Returns None if fetch fails or content is not valid JSON.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            if response.status_code == 200:
                try:
                    return response.json()
                except json.JSONDecodeError:
                    logger.warning("Fetched content is not valid JSON", url=url)
            else:
                logger.warning(
                    "Failed to fetch spec", url=url, status=response.status_code
                )
    except Exception as e:
        logger.error("Error fetching spec", url=url, error=str(e))
    return None


async def monitor_integrations_loop():
    """
    Background loop to monitor active integrations for schema drift.
    """
    logger.info("Schema Drift Monitor started.")

    while True:
        interval = 3600  # Default check every hour

        try:
            async with async_session_factory() as db:
                # Select active integrations
                stmt = select(Integration).where(
                    Integration.status == IntegrationStatusEnum.ACTIVE
                )
                result = await db.execute(stmt)
                integrations = result.scalars().all()

                logger.info("Running drift check", active_count=len(integrations))

                for integration in integrations:
                    # Skip if no source URL (shouldn't happen for active ones usually)
                    # We use source_api_spec's source_url or base_url
                    source_spec = integration.source_api_spec
                    if not source_spec or not isinstance(source_spec, dict):
                        continue

                    spec_url = source_spec.get("source_url") or source_spec.get(
                        "base_url"
                    )

                    if not spec_url:
                        continue

                    # Fetch latest
                    latest_spec = await fetch_latest_spec(spec_url)

                    if latest_spec:
                        # Detect Drift
                        detector = SchemaDriftDetector()
                        report = detector.detect_drift(source_spec, latest_spec)

                        if report.drift_type != "none":
                            logger.warning(
                                "Drift detected during monitoring",
                                integration_id=integration.id,
                                type=report.drift_type,
                                severity=report.severity,
                            )

                            # If breaking, trigger self-healing (or just log for now as per phase plan)
                            if report.drift_type == "breaking":
                                # Update integration status or trigger Guardian Agent
                                # For this phase, we'll adhere to the Guardian's responsibility
                                # We could invoke Guardian here, but to avoid circular deps/complexity
                                # we will just log the event.
                                # TODO: Integrate with unified Event Bus or Agent Orchestrator
                                pass

        except Exception as e:
            # Check if this is a missing table error
            if "does not exist" in str(e) or "UndefinedTable" in str(e):
                logger.warning("Database tables not yet initialized, skipping drift monitoring", error=str(e))
            else:
                logger.error("Error in drift monitor loop", error=str(e))

        await asyncio.sleep(interval)


def start_monitor_scheduler():
    """Start the drift monitor task."""
    asyncio.create_task(monitor_integrations_loop())
