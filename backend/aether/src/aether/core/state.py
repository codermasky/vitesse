from typing import Any, Dict, List, Optional, TypedDict


class BaseWorkflowState(TypedDict, total=False):
    """
    Standard state container for Aether 'Flux' workflows.
    Business-specific states should inherit from this.
    """

    # Unique identifiers
    workflow_id: str
    run_id: str

    # Workflow control
    current_node: str
    stage: str
    status: str

    # Core Data
    context: List[Any]
    messages: List[Dict[str, Any]]

    # Performance & Metrics
    metrics: Dict[str, Any]
    telemetry: List[Dict[str, Any]]

    # Human-in-the-loop
    interrupt_signal: Optional[str]
    human_feedback: Optional[Dict[str, Any]]
