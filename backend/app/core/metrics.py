import structlog
from typing import Any, Dict, Optional

logger = structlog.get_logger(__name__)


def record_llm_call(
    model: str,
    duration: float,
    tokens_input: int = 0,
    tokens_output: int = 0,
    cost: float = 0.0,
    success: bool = True,
    provider: str = "unknown",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Record LLM call metrics for generic observability."""
    total_tokens = tokens_input + tokens_output
    logger.info(
        "LLM Call Recorded",
        model=model,
        provider=provider,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        total_tokens=total_tokens,
        duration=duration,
        cost=cost,
        success=success,
        **(metadata or {}),
    )


def record_workflow_execution(
    workflow_id: str,
    duration_ms: float,
    status: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Record workflow execution metrics."""
    logger.info(
        "Workflow Execution Recorded",
        workflow_id=workflow_id,
        duration=duration_ms,
        status=status,
        **(metadata or {}),
    )
