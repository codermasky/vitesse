import logging
import sys
from typing import Any, Dict

import structlog
from structlog.dev import ConsoleRenderer
from structlog.processors import JSONRenderer

from app.core.config import settings
from app.core.telemetry import get_trace_correlation_processor
from app.core.security import mask_pii_in_data


def pii_masking_processor(
    logger: Any, method_name: str, event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """Processor to mask PII in all log event fields."""
    return mask_pii_in_data(event_dict)


class EndpointFilter(logging.Filter):
    """Filter out noisy endpoints from access logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        return (
            record.getMessage().find("GET /api/v1/queue") == -1
            and record.getMessage().find("GET /health") == -1
        )


# Configure standard library logging
def setup_logging() -> None:
    """Configure structured logging for the application."""
    # Shared processors for all environments
    shared_processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.ExtraAdder(),
        # Add correlation ID if present in context var
        get_trace_correlation_processor(),
        # Mask PII
        pii_masking_processor,
    ]

    # Use JSON in prod, Console in dev
    if settings.ENVIRONMENT == "production":
        # Production: JSON output with timestamp
        processors = shared_processors + [
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development: pretty console output
        processors = shared_processors + [
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("anthropic").setLevel(logging.WARNING)

    # Filter out noisy access logs if using uvicorn
    logging.getLogger("uvicorn.access").addFilter(EndpointFilter())
