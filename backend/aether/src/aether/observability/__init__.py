"""
Aether Observability Module

Provides observability capabilities for agentic applications:
- Prometheus metrics collection
- WebSocket-based live feed for agent updates
- Telemetry and performance tracking
- OpenTelemetry integration
- Profiling utilities
"""

from aether.observability.metrics import (
    # Agent metrics
    record_agent_execution,
    AGENT_EXECUTION_TIME,
    AGENT_EXECUTIONS_TOTAL,
    # Workflow metrics
    record_workflow_execution,
    WORKFLOW_EXECUTION_TIME,
    # LLM metrics
    record_llm_call,
    LLM_API_CALLS_TOTAL,
    LLM_TOKENS_USED,
    # Cache metrics
    record_cache_operation,
    CACHE_HITS,
    CACHE_MISSES,
    # Get metrics
    get_metrics,
)

from aether.observability.live_feed import (
    LiveFeedManager,
    get_live_feed_manager,
)

from aether.observability.telemetry import (
    setup_opentelemetry,
    trace_span,
    profile_function,
    profile_async_function,
    measure_time,
    PerformanceTracker,
)

__all__ = [
    # Functions
    "record_agent_execution",
    "record_workflow_execution",
    "record_llm_call",
    "record_cache_operation",
    "get_metrics",
    # Metrics
    "AGENT_EXECUTION_TIME",
    "AGENT_EXECUTIONS_TOTAL",
    "WORKFLOW_EXECUTION_TIME",
    "LLM_API_CALLS_TOTAL",
    "LLM_TOKENS_USED",
    "CACHE_HITS",
    "CACHE_MISSES",
    # Live Feed
    "LiveFeedManager",
    "get_live_feed_manager",
    # Telemetry
    "setup_opentelemetry",
    "trace_span",
    "profile_function",
    "profile_async_function",
    "measure_time",
    "PerformanceTracker",
]
