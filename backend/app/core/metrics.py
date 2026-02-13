import structlog
from typing import Any, Dict, Optional

logger = structlog.get_logger(__name__)


def record_llm_call(
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    duration_ms: float,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Record LLM call metrics for generic observability."""
    logger.info(
        "LLM Call Recorded",
        model=model_name,
        tokens=total_tokens,
        duration=duration_ms,
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
