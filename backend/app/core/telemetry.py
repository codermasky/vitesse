import structlog
from typing import Optional

import sentry_sdk
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from app.core.config import settings

logger = structlog.get_logger(__name__)


def init_telemetry(app: FastAPI) -> None:
    """Initialize OpenTelemetry and Sentry."""

    # 1. Initialize Sentry if DSN is provided
    if settings.SENTRY_DSN:
        try:
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                environment=settings.ENVIRONMENT,
                traces_sample_rate=1.0,
                profiles_sample_rate=1.0,
            )
            logger.info("Sentry initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Sentry: {e}")

    # 2. Initialize OpenTelemetry if enabled
    if settings.ENABLE_TELEMETRY:
        try:
            resource = Resource(attributes={SERVICE_NAME: "agentstack-backend"})

            provider = TracerProvider(resource=resource)

            # Use OTLP exporter if endpoint is available, otherwise console for dev
            if settings.OTLP_ENDPOINT and not settings.ENVIRONMENT == "development":
                processor = BatchSpanProcessor(
                    OTLPSpanExporter(endpoint=settings.OTLP_ENDPOINT)
                )
            else:
                processor = BatchSpanProcessor(ConsoleSpanExporter())

            provider.add_span_processor(processor)
            trace.set_tracer_provider(provider)

            # Instrument FastAPI
            FastAPIInstrumentor.instrument_app(app)

            # Instrument HTTPX for outbound LLM calls
            HTTPXClientInstrumentor().instrument()

            logger.info("OpenTelemetry initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize OpenTelemetry: {e}")


def get_tracer(name: str):
    """Utility to get a tracer instance."""
    return trace.get_tracer(name)


def trace_node(name: str):
    """Decorator to trace a LangGraph node."""

    def decorator(func):
        import functools

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            tracer = get_tracer("langgraph")
            with tracer.start_as_current_span(name) as span:
                # Try to extract queue_request_id from the state (args[1] is usually state)
                if len(args) > 1 and isinstance(args[1], dict):
                    q_id = args[1].get("queue_request_id")
                    if q_id:
                        span.set_attribute("queue_request_id", q_id)

                return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_trace_correlation_processor():
    """Structlog processor to add trace_id to logs."""

    def processor(logger, name, event_dict):
        span = trace.get_current_span()
        if span.get_span_context().is_valid:
            event_dict["trace_id"] = format(span.get_span_context().trace_id, "032x")
            event_dict["span_id"] = format(span.get_span_context().span_id, "16x")
        return event_dict

    return processor
