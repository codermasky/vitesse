"""
Prometheus metrics collection for Aether agentic platforms.

Provides pre-configured metrics for:
- Agent execution (duration, success rate, status)
- Workflow progress and execution time
- LLM provider calls (token usage, latency, cost)
- Cache performance (hit rate, evictions)
- WebSocket connections
- System health

Usage:
    from aether.observability.metrics import record_agent_execution, AGENT_EXECUTION_TIME

    # Record agent execution
    record_agent_execution("my_agent", duration=1.5, success=True)

    # Access metrics endpoint
    from aether.observability.metrics import get_metrics
    metrics_text = get_metrics()  # Prometheus text format
"""

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    CollectorRegistry,
    generate_latest,
)
from datetime import datetime
from typing import Optional, Dict, Any
import time
import structlog

logger = structlog.get_logger(__name__)

# Create metrics registry
METRICS_REGISTRY = CollectorRegistry()

# ============================================================================
# AGENT METRICS
# ============================================================================

AGENT_EXECUTION_TIME = Histogram(
    "aether_agent_execution_duration_seconds",
    "Agent execution time in seconds",
    labelnames=["agent_name", "status"],
    registry=METRICS_REGISTRY,
)

AGENT_EXECUTIONS_TOTAL = Counter(
    "aether_agent_executions_total",
    "Total agent executions",
    labelnames=["agent_name", "status"],
    registry=METRICS_REGISTRY,
)

AGENT_SUCCESS_RATE = Gauge(
    "aether_agent_success_rate",
    "Agent success rate (0-1)",
    labelnames=["agent_name"],
    registry=METRICS_REGISTRY,
)

# ============================================================================
# WORKFLOW METRICS
# ============================================================================

WORKFLOW_EXECUTION_TIME = Histogram(
    "aether_workflow_execution_duration_seconds",
    "Workflow execution time in seconds",
    labelnames=["workflow_type", "status"],
    registry=METRICS_REGISTRY,
)

WORKFLOW_PROGRESS = Gauge(
    "aether_workflow_progress_percentage",
    "Workflow progress percentage (0-100)",
    labelnames=["workflow_id"],
    registry=METRICS_REGISTRY,
)

WORKFLOW_ACTIVE_COUNT = Gauge(
    "aether_workflow_active_count",
    "Number of active workflows",
    registry=METRICS_REGISTRY,
)

# ============================================================================
# LLM PROVIDER METRICS
# ============================================================================

LLM_API_CALLS_TOTAL = Counter(
    "aether_llm_api_calls_total",
    "Total LLM API calls",
    labelnames=["provider", "model", "status"],
    registry=METRICS_REGISTRY,
)

LLM_API_LATENCY = Histogram(
    "aether_llm_api_latency_seconds",
    "LLM API latency in seconds",
    labelnames=["provider", "model"],
    registry=METRICS_REGISTRY,
)

LLM_TOKENS_USED = Counter(
    "aether_llm_tokens_used_total",
    "Total LLM tokens used",
    labelnames=["provider", "model", "token_type"],
    registry=METRICS_REGISTRY,
)

LLM_COST = Counter(
    "aether_llm_cost_usd_total",
    "Total LLM cost in USD",
    labelnames=["provider", "model"],
    registry=METRICS_REGISTRY,
)

# ============================================================================
# CACHE METRICS
# ============================================================================

CACHE_HITS = Counter(
    "aether_cache_hits_total",
    "Total cache hits",
    labelnames=["cache_name"],
    registry=METRICS_REGISTRY,
)

CACHE_MISSES = Counter(
    "aether_cache_misses_total",
    "Total cache misses",
    labelnames=["cache_name"],
    registry=METRICS_REGISTRY,
)

CACHE_HIT_RATE = Gauge(
    "aether_cache_hit_rate",
    "Cache hit rate (0-1)",
    labelnames=["cache_name"],
    registry=METRICS_REGISTRY,
)

CACHE_SIZE = Gauge(
    "aether_cache_size_bytes",
    "Cache size in bytes",
    labelnames=["cache_name"],
    registry=METRICS_REGISTRY,
)

# ============================================================================
# WEBSOCKET METRICS
# ============================================================================

WEBSOCKET_CONNECTIONS_ACTIVE = Gauge(
    "aether_websocket_connections_active",
    "Active WebSocket connections",
    labelnames=["endpoint"],
    registry=METRICS_REGISTRY,
)

WEBSOCKET_MESSAGES_SENT = Counter(
    "aether_websocket_messages_sent_total",
    "Total WebSocket messages sent",
    labelnames=["endpoint", "message_type"],
    registry=METRICS_REGISTRY,
)

WEBSOCKET_MESSAGES_RECEIVED = Counter(
    "aether_websocket_messages_received_total",
    "Total WebSocket messages received",
    labelnames=["endpoint", "message_type"],
    registry=METRICS_REGISTRY,
)

# ============================================================================
# SYSTEM METRICS
# ============================================================================

SYSTEM_ERRORS_TOTAL = Counter(
    "aether_system_errors_total",
    "Total system errors",
    labelnames=["error_type", "module"],
    registry=METRICS_REGISTRY,
)

SYSTEM_WARNINGS_TOTAL = Counter(
    "aether_system_warnings_total",
    "Total system warnings",
    labelnames=["warning_type", "module"],
    registry=METRICS_REGISTRY,
)

UPTIME_SECONDS = Gauge(
    "aether_uptime_seconds",
    "Application uptime in seconds",
    registry=METRICS_REGISTRY,
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def get_metrics() -> str:
    """Get all metrics in Prometheus text format."""
    return generate_latest(METRICS_REGISTRY).decode("utf-8")


def record_agent_execution(agent_name: str, duration: float, success: bool):
    """
    Record agent execution metrics.

    Args:
        agent_name: Name of the agent
        duration: Execution duration in seconds
        success: Whether execution succeeded
    """
    status = "success" if success else "failure"
    AGENT_EXECUTION_TIME.labels(agent_name=agent_name, status=status).observe(duration)
    AGENT_EXECUTIONS_TOTAL.labels(agent_name=agent_name, status=status).inc()
    logger.debug(
        "agent_execution_recorded",
        agent_name=agent_name,
        duration=duration,
        status=status,
    )


def record_workflow_execution(workflow_type: str, duration: float, success: bool):
    """
    Record workflow execution metrics.

    Args:
        workflow_type: Type/name of the workflow
        duration: Execution duration in seconds
        success: Whether execution succeeded
    """
    status = "success" if success else "failure"
    WORKFLOW_EXECUTION_TIME.labels(workflow_type=workflow_type, status=status).observe(
        duration
    )
    logger.debug(
        "workflow_execution_recorded",
        workflow_type=workflow_type,
        duration=duration,
        status=status,
    )


def record_llm_call(
    provider: str,
    model: str,
    duration: float,
    tokens_input: int,
    tokens_output: int,
    cost: float,
    success: bool = True,
):
    """
    Record LLM API call metrics.

    Args:
        provider: LLM provider (e.g., "openai", "anthropic")
        model: Model name (e.g., "gpt-4", "claude-3")
        duration: API call duration in seconds
        tokens_input: Number of input tokens
        tokens_output: Number of output tokens
        cost: Cost in USD
        success: Whether call succeeded
    """
    status = "success" if success else "failure"
    LLM_API_CALLS_TOTAL.labels(provider=provider, model=model, status=status).inc()
    LLM_API_LATENCY.labels(provider=provider, model=model).observe(duration)
    LLM_TOKENS_USED.labels(provider=provider, model=model, token_type="input").inc(
        tokens_input
    )
    LLM_TOKENS_USED.labels(provider=provider, model=model, token_type="output").inc(
        tokens_output
    )
    LLM_COST.labels(provider=provider, model=model).inc(cost)
    logger.debug(
        "llm_call_recorded",
        provider=provider,
        model=model,
        duration=duration,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        cost=cost,
    )


def record_cache_operation(
    cache_name: str, hit: bool, size_bytes: Optional[int] = None
):
    """
    Record cache operation metrics.

    Args:
        cache_name: Name of the cache
        hit: Whether it was a cache hit
        size_bytes: Optional cache size in bytes
    """
    if hit:
        CACHE_HITS.labels(cache_name=cache_name).inc()
    else:
        CACHE_MISSES.labels(cache_name=cache_name).inc()

    if size_bytes is not None:
        CACHE_SIZE.labels(cache_name=cache_name).set(size_bytes)

    logger.debug(
        "cache_operation_recorded",
        cache_name=cache_name,
        hit=hit,
        size_bytes=size_bytes,
    )


def record_error(error_type: str, module: str):
    """
    Record system error metrics.

    Args:
        error_type: Type of error
        module: Module where error occurred
    """
    SYSTEM_ERRORS_TOTAL.labels(error_type=error_type, module=module).inc()
    logger.error("error_recorded", error_type=error_type, module=module)


def setup_uptime_tracking():
    """
    Setup uptime tracking.

    Returns:
        Callable to update uptime metric
    """
    start_time = datetime.utcnow()

    def update_uptime():
        uptime = (datetime.utcnow() - start_time).total_seconds()
        UPTIME_SECONDS.set(uptime)

    return update_uptime
