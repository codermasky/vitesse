"""
Aether Telemetry Module

Provides telemetry and profiling utilities:
- OpenTelemetry integration pattern
- Profiling decorators
- Performance measurement utilities
"""

import time
import functools
import structlog
from typing import Any, Callable, Optional
from contextlib import contextmanager

logger = structlog.get_logger(__name__)


# ============================================================================
# OPENTELEMETRY INTEGRATION PATTERN
# ============================================================================


def setup_opentelemetry(
    service_name: str,
    exporter_endpoint: Optional[str] = None,
    enable_auto_instrumentation: bool = True,
):
    """
    Setup OpenTelemetry for distributed tracing.

    This is a pattern/template - actual implementation depends on deployment.

    Args:
        service_name: Name of the service
        exporter_endpoint: OTLP exporter endpoint (e.g., Jaeger, Datadog)
        enable_auto_instrumentation: Auto-instrument FastAPI, httpx, etc.

    Example:
        # At application startup
        setup_opentelemetry(
            service_name="my-agentic-app",
            exporter_endpoint="http://jaeger:4318",
        )

    Note:
        Requires: pip install opentelemetry-api opentelemetry-sdk
                       opentelemetry-instrumentation-fastapi
    """
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.sdk.resources import Resource

        # Create resource
        resource = Resource(
            attributes={
                "service.name": service_name,
            }
        )

        # Setup tracer provider
        provider = TracerProvider(resource=resource)

        # Add exporter if endpoint provided
        if exporter_endpoint:
            exporter = OTLPSpanExporter(endpoint=exporter_endpoint)
            processor = BatchSpanProcessor(exporter)
            provider.add_span_processor(processor)

        # Set as global
        trace.set_tracer_provider(provider)

        # Auto-instrument
        if enable_auto_instrumentation:
            try:
                from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
                from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

                FastAPIInstrumentor.instrument()
                HTTPXClientInstrumentor.instrument()

                logger.info("opentelemetry_auto_instrumentation_enabled")
            except ImportError:
                logger.warning("opentelemetry_instrumentation_libraries_not_installed")

        logger.info(
            "opentelemetry_configured",
            service_name=service_name,
            exporter_endpoint=exporter_endpoint,
        )

    except ImportError:
        logger.warning(
            "opentelemetry_not_installed",
            message="Install with: pip install opentelemetry-api opentelemetry-sdk",
        )


@contextmanager
def trace_span(name: str, **attributes):
    """
    Create a tracing span.

    Args:
        name: Span name
        **attributes: Additional span attributes

    Example:
        with trace_span("agent_execution", agent_id="analyst"):
            result = await agent.execute(data)
    """
    try:
        from opentelemetry import trace

        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span(name) as span:
            for key, value in attributes.items():
                span.set_attribute(key, str(value))
            yield span

    except ImportError:
        # No-op if OpenTelemetry not installed
        yield None


# ============================================================================
# PROFILING UTILITIES
# ============================================================================


def profile_function(func: Callable = None, *, output_file: Optional[str] = None):
    """
    Decorator to profile a function using cProfile.

    Args:
        func: Function to profile
        output_file: Optional file to save profiling results

    Example:
        @profile_function
        def expensive_operation():
            # ... code ...

        # With output file
        @profile_function(output_file="profile.stats")
        def another_operation():
            # ... code ...
    """

    def decorator(f: Callable) -> Callable:
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            import cProfile
            import pstats
            from io import StringIO

            profiler = cProfile.Profile()
            profiler.enable()

            try:
                result = f(*args, **kwargs)
                return result
            finally:
                profiler.disable()

                # Print stats
                s = StringIO()
                ps = pstats.Stats(profiler, stream=s).sort_stats("cumulative")
                ps.print_stats(20)  # Top 20

                logger.info(
                    "function_profiling_complete",
                    function=f.__name__,
                    stats=s.getvalue()[:500],  # Truncate for logging
                )

                # Save to file if specified
                if output_file:
                    ps.dump_stats(output_file)
                    logger.info(f"profiling_saved_to_file", file=output_file)

        return wrapper

    if func is None:
        return decorator
    else:
        return decorator(func)


def profile_async_function(func: Callable = None, *, output_file: Optional[str] = None):
    """
    Decorator to profile an async function using cProfile.

    Args:
        func: Async function to profile
        output_file: Optional file to save profiling results

    Example:
        @profile_async_function
        async def expensive_async_operation():
            # ... code ...
    """

    def decorator(f: Callable) -> Callable:
        @functools.wraps(f)
        async def wrapper(*args, **kwargs):
            import cProfile
            import pstats
            from io import StringIO

            profiler = cProfile.Profile()
            profiler.enable()

            try:
                result = await f(*args, **kwargs)
                return result
            finally:
                profiler.disable()

                # Print stats
                s = StringIO()
                ps = pstats.Stats(profiler, stream=s).sort_stats("cumulative")
                ps.print_stats(20)

                logger.info(
                    "async_function_profiling_complete",
                    function=f.__name__,
                    stats=s.getvalue()[:500],
                )

                if output_file:
                    ps.dump_stats(output_file)

        return wrapper

    if func is None:
        return decorator
    else:
        return decorator(func)


# ============================================================================
# PERFORMANCE MEASUREMENT
# ============================================================================


@contextmanager
def measure_time(operation_name: str, log_result: bool = True):
    """
    Context manager to measure execution time.

    Args:
        operation_name: Name of the operation
        log_result: Whether to log the result

    Example:
        with measure_time("database_query"):
            result = await db.query(...)

    Returns:
        Context manager that yields the elapsed time
    """
    start = time.time()
    try:
        yield lambda: time.time() - start
    finally:
        duration = time.time() - start
        if log_result:
            logger.info(
                "operation_completed",
                operation=operation_name,
                duration_seconds=round(duration, 3),
            )


class PerformanceTracker:
    """
    Track performance metrics for operations.

    Example:
        tracker = PerformanceTracker()

        with tracker.track("agent_execution"):
            await agent.execute(data)

        stats = tracker.get_stats("agent_execution")
        print(f"Average: {stats['avg']}s")
    """

    def __init__(self):
        self._measurements: dict = {}

    @contextmanager
    def track(self, operation_name: str):
        """Track an operation."""
        start = time.time()
        try:
            yield
        finally:
            duration = time.time() - start

            if operation_name not in self._measurements:
                self._measurements[operation_name] = []

            self._measurements[operation_name].append(duration)

    def get_stats(self, operation_name: str) -> dict:
        """
        Get statistics for an operation.

        Returns:
            Dict with count, min, max, avg, total
        """
        measurements = self._measurements.get(operation_name, [])

        if not measurements:
            return {
                "count": 0,
                "min": 0,
                "max": 0,
                "avg": 0,
                "total": 0,
            }

        return {
            "count": len(measurements),
            "min": min(measurements),
            "max": max(measurements),
            "avg": sum(measurements) / len(measurements),
            "total": sum(measurements),
        }

    def get_all_stats(self) -> dict:
        """Get statistics for all tracked operations."""
        return {
            operation: self.get_stats(operation)
            for operation in self._measurements.keys()
        }

    def reset(self):
        """Reset all measurements."""
        self._measurements.clear()
