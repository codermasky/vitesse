"""
Aether Workflows Module

Provides workflow utilities and patterns for building agentic workflows:
- Conditional routing helpers
- Human-in-the-loop patterns
- Multi-workflow management
- Status tracking integration
- Common workflow patterns
"""

import structlog
from typing import Any, Callable, Dict, List, Optional, Literal
from enum import Enum

logger = structlog.get_logger(__name__)


# ============================================================================
# CONDITIONAL ROUTING HELPERS
# ============================================================================


class RouterDecision(str, Enum):
    """Standard routing decisions."""

    CONTINUE = "continue"
    RETRY = "retry"
    REVIEW = "review"
    SKIP = "skip"
    FAIL = "fail"
    SUCCESS = "success"


def create_quality_gate_router(
    confidence_threshold: float = 0.9,
    check_flags: bool = True,
    review_node: str = "human_review",
    continue_node: str = "continue",
) -> Callable:
    """
    Create a router that checks quality gates before proceeding.

    Common use case: Route to human review if confidence is low or flags exist.

    Args:
        confidence_threshold: Minimum confidence score to auto-continue
        check_flags: Whether to check for review flags
        review_node: Node name for human review
        continue_node: Node name to continue workflow

    Returns:
        Router function compatible with LangGraph conditional edges

    Example:
        router = create_quality_gate_router(confidence_threshold=0.85)
        flux.add_conditional_edges("analyzer", router, {
            "human_review": "human_review_node",
            "continue": "next_step",
        })
    """

    def quality_gate_router(state: Dict[str, Any]) -> str:
        # Check confidence score
        confidence = state.get("confidence_score", 0.0)

        if confidence < confidence_threshold:
            logger.info(
                "quality_gate_routing_to_review",
                reason="low_confidence",
                confidence=confidence,
                threshold=confidence_threshold,
            )
            return review_node

        # Check for review flags
        if check_flags:
            flags = state.get("review_flags", [])
            if flags:
                logger.info(
                    "quality_gate_routing_to_review",
                    reason="review_flags",
                    flags=flags,
                )
                return review_node

        return continue_node

    return quality_gate_router


def create_retry_router(
    max_retries: int = 3,
    retry_node: str = "retry",
    success_node: str = "success",
    fail_node: str = "fail",
) -> Callable:
    """
    Create a router that handles retry logic.

    Args:
        max_retries: Maximum number of retries allowed
        retry_node: Node to retry on failure
        success_node: Node for successful completion
        fail_node: Node when max retries exceeded

    Returns:
        Router function

    Example:
        router = create_retry_router(max_retries=3)
        flux.add_conditional_edges("process", router, {
            "retry": "process",  # Loop back
            "success": "next_step",
            "fail": "error_handler",
        })
    """

    def retry_router(state: Dict[str, Any]) -> str:
        retry_count = state.get("retry_count", 0)
        success = state.get("success", False)

        if success:
            return success_node

        if retry_count >= max_retries:
            logger.warning(
                "retry_router_max_retries_exceeded",
                retry_count=retry_count,
                max_retries=max_retries,
            )
            return fail_node

        logger.info(
            "retry_router_retrying",
            retry_count=retry_count,
            max_retries=max_retries,
        )
        # Increment retry count in state
        state["retry_count"] = retry_count + 1
        return retry_node

    return retry_router


def create_validation_router(
    required_fields: List[str],
    valid_node: str = "continue",
    invalid_node: str = "fix_errors",
) -> Callable:
    """
    Create a router that validates required fields in state.

    Args:
        required_fields: List of field names that must be present
        valid_node: Node for valid state
        invalid_node: Node for invalid state

    Returns:
        Router function

    Example:
        router = create_validation_router(
            required_fields=["entity_name", "ein", "revenue"]
        )
        flux.add_conditional_edges("extract", router, {
            "continue": "analyze",
            "fix_errors": "manual_entry",
        })
    """

    def validation_router(state: Dict[str, Any]) -> str:
        missing_fields = [
            field
            for field in required_fields
            if field not in state or state[field] is None
        ]

        if missing_fields:
            logger.warning(
                "validation_router_missing_fields",
                missing_fields=missing_fields,
            )
            state["validation_errors"] = missing_fields
            return invalid_node

        return valid_node

    return validation_router


def create_branching_router(
    field: str,
    branches: Dict[Any, str],
    default: str = "default",
) -> Callable:
    """
    Create a router that branches based on a field value.

    Args:
        field: State field to check
        branches: Mapping of field values to node names
        default: Default node if value not in branches

    Returns:
        Router function

    Example:
        router = create_branching_router(
            field="entity_type",
            branches={
                "corporation": "corporate_workflow",
                "llc": "llc_workflow",
                "partnership": "partnership_workflow",
            },
            default="generic_workflow",
        )
    """

    def branching_router(state: Dict[str, Any]) -> str:
        value = state.get(field)
        node = branches.get(value, default)

        logger.info(
            "branching_router_decision",
            field=field,
            value=value,
            node=node,
        )

        return node

    return branching_router


# ============================================================================
# HUMAN-IN-THE-LOOP PATTERNS
# ============================================================================


async def create_human_review_node(
    notification_callback: Optional[Callable] = None,
    message: str = "Human review required",
) -> Callable:
    """
    Create a pass-through node that triggers human review.

    This node is used with LangGraph's interrupt_before to pause the workflow.

    Args:
        notification_callback: Optional async function to notify about review
        message: Message to include in notification

    Returns:
        Async node function

    Example:
        review_node = await create_human_review_node(
            notification_callback=send_email_notification,
            message="Credit analysis requires review",
        )
        flux.add_node("human_review", review_node)
        workflow = flux.compile(interrupt_before=["human_review"])
    """

    async def human_review_node(
        state: Dict[str, Any], config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        logger.info(
            "human_review_triggered",
            workflow_id=state.get("workflow_id"),
            message=message,
        )

        # Add review metadata to state
        state["review_requested"] = True
        state["review_message"] = message

        # Notify if callback provided
        if notification_callback:
            try:
                await notification_callback(state, message)
            except Exception as e:
                logger.error(f"Notification callback failed: {e}")

        return state

    return human_review_node


def should_review(state: Dict[str, Any]) -> Literal["human_review", "continue"]:
    """
    Standard review decision function.

    Routes to human review if:
    - review_flags exist
    - confidence_score is low (< 0.8)
    - explicit review_required flag is set

    Args:
        state: Workflow state

    Returns:
        "human_review" or "continue"
    """
    # Check explicit review flag
    if state.get("review_required", False):
        return "human_review"

    # Check confidence
    confidence = state.get("confidence_score", 1.0)
    if confidence < 0.8:
        return "human_review"

    # Check for review flags
    flags = state.get("review_flags", [])
    if flags:
        return "human_review"

    return "continue"


# ============================================================================
# WORKFLOW REGISTRY
# ============================================================================


class WorkflowRegistry:
    """
    Registry for managing multiple workflow types.

    Enables plugin-style workflow extensions and dynamic routing.

    Example:
        registry = WorkflowRegistry()

        @registry.register("credit_analysis")
        async def create_credit_workflow(intelligence):
            flux = Flux(MyState)
            # ... build workflow ...
            return flux.compile()

        # Later, retrieve and execute
        workflow = await registry.create("credit_analysis", intelligence=intel)
    """

    def __init__(self):
        self._factories: Dict[str, Callable] = {}
        self._metadata: Dict[str, Dict[str, Any]] = {}

    def register(
        self,
        workflow_type: str,
        description: str = "",
        **metadata,
    ):
        """
        Decorator to register a workflow factory.

        Args:
            workflow_type: Unique identifier for this workflow
            description: Human-readable description
            **metadata: Additional metadata
        """

        def decorator(factory: Callable):
            self._factories[workflow_type] = factory
            self._metadata[workflow_type] = {
                "description": description,
                "factory": factory.__name__,
                **metadata,
            }
            logger.info(
                "workflow_registered",
                workflow_type=workflow_type,
                description=description,
            )
            return factory

        return decorator

    async def create(self, workflow_type: str, **kwargs) -> Any:
        """
        Create a workflow instance.

        Args:
            workflow_type: Type of workflow to create
            **kwargs: Arguments to pass to factory

        Returns:
            Compiled workflow
        """
        if workflow_type not in self._factories:
            available = list(self._factories.keys())
            raise ValueError(
                f"Unknown workflow type: {workflow_type}. Available: {available}"
            )

        factory = self._factories[workflow_type]
        logger.info(
            "workflow_creating",
            workflow_type=workflow_type,
            factory=factory.__name__,
        )

        return await factory(**kwargs)

    def list_workflows(self) -> Dict[str, Dict[str, Any]]:
        """Get all registered workflows with metadata."""
        return self._metadata.copy()

    def get_metadata(self, workflow_type: str) -> Dict[str, Any]:
        """Get metadata for a specific workflow type."""
        return self._metadata.get(workflow_type, {})


# Singleton registry for convenience
_default_registry = WorkflowRegistry()


def get_workflow_registry() -> WorkflowRegistry:
    """Get the default workflow registry."""
    return _default_registry
