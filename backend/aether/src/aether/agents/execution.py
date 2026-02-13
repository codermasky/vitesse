"""
Agent Execution Utilities for Aether

Provides helper functions and decorators for agent execution:
- Standard execution hooks for metrics, logging, notifications
- Agent wrapper functions for workflow integration
- Safe execution patterns
"""

import time
import asyncio
import structlog
from typing import Any, Callable, Dict, Optional

from aether.observability.metrics import record_agent_execution
from aether.resilience import safe_agent_execution

logger = structlog.get_logger(__name__)


# ============================================================================
# PRE-DEFINED HOOKS
# ============================================================================


def create_metrics_hook(record_metrics: bool = True):
    """
    Create a post-hook that records agent execution metrics.

    Args:
        record_metrics: Whether to record to Prometheus

    Returns:
        Post-hook function
    """

    async def metrics_hook(context: Dict[str, Any]):
        if record_metrics:
            record_agent_execution(
                agent_name=context["agent_id"],
                duration=context["duration"],
                success=context["success"],
            )
            logger.info(
                "agent_execution_completed",
                agent_id=context["agent_id"],
                duration=context["duration"],
                success=context["success"],
            )

    return metrics_hook


def create_logging_hook(log_level: str = "info"):
    """
    Create a pre-hook that logs agent start.

    Args:
        log_level: Logging level (info, debug, etc.)

    Returns:
        Pre-hook function
    """

    def logging_hook(context: Dict[str, Any]):
        log_func = getattr(logger, log_level, logger.info)
        log_func(
            "agent_execution_started",
            agent_id=context["agent_id"],
            config=context.get("config", {}),
        )

    return logging_hook


def create_status_update_hook(status_callback: Optional[Callable] = None):
    """
    Create a hook that updates workflow status.

    Args:
        status_callback: Async function to call with status updates

    Returns:
        Pre-hook function
    """

    async def status_hook(context: Dict[str, Any]):
        if status_callback:
            await status_callback(
                agent_id=context["agent_id"],
                status="running" if "duration" not in context else "completed",
                config=context.get("config", {}),
            )

    return status_hook


# ============================================================================
# AGENT WRAPPER PATTERN
# ============================================================================


def with_hooks(
    agent: Any,
    pre_hooks: list = None,
    post_hooks: list = None,
):
    """
    Wrap an agent with execution hooks.

    Usage:
        agent = MyAgent("test", intelligence)
        wrapped = with_hooks(
            agent,
            pre_hooks=[create_logging_hook()],
            post_hooks=[create_metrics_hook()],
        )

    Args:
        agent: BaseAgent instance
        pre_hooks: List of pre-execution hooks
        post_hooks: List of post-execution hooks

    Returns:
        Agent with hooks added
    """
    if pre_hooks:
        for hook in pre_hooks:
            agent.add_pre_hook(hook)

    if post_hooks:
        for hook in post_hooks:
            agent.add_post_hook(hook)

    return agent


async def run_agent_with_hooks(
    agent: Any,
    state: Dict[str, Any],
    config: Dict[str, Any] = None,
    pre_hook: Optional[Callable] = None,
    post_hook: Optional[Callable] = None,
) -> Any:
    """
    Run an agent with optional pre/post hooks.

    This is a convenience function for one-off hook execution.
    For persistent hooks, use with_hooks() or agent.add_*_hook().

    Args:
        agent: BaseAgent instance
        state: Input state dict
        config: Optional config dict
        pre_hook: Optional pre-execution hook
        post_hook: Optional post-execution hook

    Returns:
        Agent output
    """
    context = {
        "agent_id": agent.agent_id,
        "input_data": state,
        "config": config or {},
        "start_time": time.time(),
    }

    # Pre-hook
    if pre_hook:
        if asyncio.iscoroutinefunction(pre_hook):
            await pre_hook(context)
        else:
            pre_hook(context)

    # Execute
    start = time.time()
    success = True
    error = None
    result = None

    try:
        result = await agent.execute(state, config=config)
    except Exception as e:
        success = False
        error = e
        raise
    finally:
        duration = time.time() - start
        context.update(
            {
                "duration": duration,
                "success": success,
                "error": error,
                "result": result,
                "end_time": time.time(),
            }
        )

        # Post-hook
        if post_hook:
            try:
                if asyncio.iscoroutinefunction(post_hook):
                    await post_hook(context)
                else:
                    post_hook(context)
            except Exception as hook_error:
                logger.warning(
                    f"Post-hook failed: {hook_error}",
                    agent_id=agent.agent_id,
                )

    return result


# ============================================================================
# DEFAULT HOOKS FOR WORKFLOWS
# ============================================================================


def get_default_workflow_hooks():
    """
    Get recommended hooks for workflow-integrated agents.

    Returns:
        (pre_hooks, post_hooks) tuple
    """
    pre_hooks = [
        create_logging_hook(log_level="info"),
    ]

    post_hooks = [
        create_metrics_hook(record_metrics=True),
    ]

    return pre_hooks, post_hooks
