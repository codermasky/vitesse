import asyncio
import structlog
from app.services.email_service import email_service

# from app.agents.definitions.email_agent import email_ingestion_agent
from app.core.config import settings
from app.services.settings_service import settings_service

logger = structlog.get_logger(__name__)


async def email_polling_loop():
    """Background loop to poll email."""
    logger.info("Email scheduler started.")

    while True:
        interval = 60  # Default interval
        try:
            config = settings_service.get_email_config()
            interval = config.get("EMAIL_POLL_INTERVAL", 60)

            if config.get("EMAIL_ENABLED"):
                logger.info("Checking for new emails...", interval=interval)
                email_service.record_heartbeat()
                emails = email_service.fetch_unread_emails()
                if emails:
                    logger.info(f"Picked up {len(emails)} new emails.")
                    for email in emails:
                        # Legacy email ingestion removed
                        logger.info(
                            "Email processing skipped - legacy agent removed",
                            subject=email.get("subject"),
                        )
                logger.info(f"Sleeping for {interval}s...")

        except Exception as e:
            logger.error("Error in email polling loop", error=str(e), traceback=True)

        await asyncio.sleep(interval)


def start_email_scheduler():
    """Start the email scheduler task."""
    asyncio.create_task(email_polling_loop())
