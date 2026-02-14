"""
Shared State Management: "Whiteboard" / "Blackboard" Pattern

This module implements LangGraph's collaborative intelligence paradigm.
All agents read from and write to a shared state object that serves as
a central knowledge repository and coordination mechanism.

The Shared Whiteboard enables:
- Emergent Intelligence: Agents learn from previous agents' outputs
- Context Preservation: Full execution history for debugging/audit
- State Recovery: Checkpoint system for interrupted workflows
- Collaborative Decision-Making: Agents can reference and build upon each other's work
"""

from typing import Any, Dict, List, Optional, TypeVar
from datetime import datetime
from pydantic import BaseModel, Field
import structlog
import uuid
import json

logger = structlog.get_logger(__name__)

T = TypeVar("T")


class AgentContribution(BaseModel):
    """Record of what each agent added to the shared state."""

    agent_id: str
    agent_type: str
    timestamp: datetime
    input_keys: List[str] = []  # What keys agent read
    output_keys: List[str] = []  # What keys agent wrote
    data_added: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: float = 0.0
    status: str = "pending"  # pending, running, success, failed
    error: Optional[str] = None


class SharedWhiteboardState(BaseModel):
    """
    Collaborative Whiteboard - The Central State Object

    This is the "single source of truth" that all agents read from and write to.
    LangGraph manages merging of parallel updates.

    Structure:
    - workflow_metadata: Core workflow identification
    - shared_context: Cross-agent knowledge (APIs, schemas, mappings, etc.)
    - execution_history: Complete audit trail of agent contributions
    - integration_state: Current state of integration being built
    - knowledge_cache: Cache of harvested knowledge (schema patterns, common APIs, etc.)
    - user_preferences: User intent, constraints, requirements
    """

    # === Workflow Identity ===
    workflow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    orchestrator_id: Optional[str] = None

    # === Agent Contributions & Execution History ===
    agent_contributions: Dict[str, AgentContribution] = Field(default_factory=dict)
    execution_log: List[Dict[str, Any]] = Field(default_factory=list)

    # === Shared Knowledge Context (The "Whiteboard" Content) ===
    # What discovery found
    discovered_apis: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="APIs discovered during discovery phase"
    )

    # Source & destination API specs (from ingestor)
    source_api_spec: Optional[Dict[str, Any]] = None
    dest_api_spec: Optional[Dict[str, Any]] = None

    # Mapping logic (from mapper)
    mapping_logic: Optional[Dict[str, Any]] = None
    transformation_rules: Dict[str, Any] = Field(default_factory=dict)

    # Test results (from guardian)
    test_results: Optional[Dict[str, Any]] = None
    health_score: float = 0.0
    critical_issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

    # === Integration Being Built ===
    integration_id: Optional[str] = None
    integration_name: str = ""
    integration_status: str = (
        "initializing"  # initializing, ingesting, mapping, testing, deploying, deployed
    )
    deployment_config: Dict[str, Any] = Field(default_factory=dict)

    # === Knowledge Cache ===
    # Patterns learned from successful integrations
    learned_patterns: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=dict,
        description="Common field mappings, transformation types seen in similar integrations",
    )

    # Harvest knowledge (APIs, schemas, standards - from knowledge harvester)
    harvested_knowledge: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=dict,
        description="Harvested API specs, schemas, and domain knowledge",
    )

    # Domain-specific knowledge
    domain_knowledge: Dict[str, Any] = Field(
        default_factory=dict,
        description="Financial services standards, PSD2, FDX, etc.",
    )

    # === User Intent & Constraints ===
    user_intent: str = ""
    user_constraints: Dict[str, Any] = Field(default_factory=dict)
    user_preferences: Dict[str, Any] = Field(default_factory=dict)

    # === Metadata & Context ===
    metadata: Dict[str, Any] = Field(default_factory=dict)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    retry_count: int = 0
    max_retries: int = 3

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

    # =========== Methods for Agent Coordination ===========

    def record_agent_contribution(
        self,
        agent_id: str,
        agent_type: str,
        input_keys: List[str],
        output_data: Dict[str, Any],
        metadata: Dict[str, Any] = None,
        execution_time_ms: float = 0.0,
    ) -> None:
        """Record what an agent added to the whiteboard."""
        contribution = AgentContribution(
            agent_id=agent_id,
            agent_type=agent_type,
            timestamp=datetime.utcnow(),
            input_keys=input_keys,
            output_keys=list(output_data.keys()),
            data_added=output_data,
            metadata=metadata or {},
            execution_time_ms=execution_time_ms,
            status="success",
        )
        self.agent_contributions[f"{agent_type}_{agent_id}"] = contribution
        self.last_updated = datetime.utcnow()

        logger.info(
            "Agent contribution recorded",
            agent_type=agent_type,
            agent_id=agent_id,
            output_keys=list(output_data.keys()),
        )

    def get_agent_context(self, for_agent_type: str) -> Dict[str, Any]:
        """
        Get all relevant context from previous agents' work.
        This is what the next agent sees - the "whiteboard" from previous agents.
        """
        context = {
            "workflow_id": self.workflow_id,
            "previously_discovered_apis": self.discovered_apis,
            "source_api_spec": self.source_api_spec,
            "dest_api_spec": self.dest_api_spec,
            "mapping_logic": self.mapping_logic,
            "test_results": self.test_results,
            "health_score": self.health_score,
            "learned_patterns": self.learned_patterns,
            "harvested_knowledge": self.harvested_knowledge,
            "domain_knowledge": self.domain_knowledge,
            "user_intent": self.user_intent,
            "user_constraints": self.user_constraints,
            "previous_errors": self.errors,
            "retry_count": self.retry_count,
        }

        logger.info(
            "Agent context retrieved",
            for_agent_type=for_agent_type,
            context_keys=list(context.keys()),
        )

        return context

    def add_learned_pattern(
        self,
        pattern_type: str,
        pattern_data: Dict[str, Any],
    ) -> None:
        """Store a discovered pattern for future integrations."""
        if pattern_type not in self.learned_patterns:
            self.learned_patterns[pattern_type] = []
        self.learned_patterns[pattern_type].append(pattern_data)

    def add_error(
        self, error_msg: str, agent_type: str, context: Dict[str, Any] = None
    ) -> None:
        """Record an error for debugging and recovery."""
        self.errors.append(
            {
                "timestamp": datetime.utcnow().isoformat(),
                "agent_type": agent_type,
                "message": error_msg,
                "context": context or {},
            }
        )
        logger.error(
            "Error recorded in shared state",
            agent_type=agent_type,
            error_msg=error_msg,
        )

    def get_execution_summary(self) -> Dict[str, Any]:
        """Get high-level summary of workflow execution."""
        return {
            "workflow_id": self.workflow_id,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "integration_id": self.integration_id,
            "integration_status": self.integration_status,
            "health_score": self.health_score,
            "agent_contributions_count": len(self.agent_contributions),
            "agents_executed": list(self.agent_contributions.keys()),
            "error_count": len(self.errors),
            "retry_count": self.retry_count,
            "critical_issues": self.critical_issues,
        }

    def can_proceed_to_next_phase(self, min_health_score: float = 0.0) -> bool:
        """Determine if workflow can proceed based on current state."""
        if len(self.errors) > 0 and self.retry_count >= self.max_retries:
            return False
        if self.health_score < min_health_score:
            return False
        if len(self.critical_issues) > 0:
            return False
        return True


class SharedStateLimiter:
    """
    Manages concurrent access to shared state.
    Prevents race conditions when multiple agents try to update state.
    """

    def __init__(self):
        self.state_snapshots: Dict[str, Dict[str, Any]] = {}
        self.locks: Dict[str, bool] = {}
        self.version_history: Dict[str, List[Dict[str, Any]]] = {}

    def create_checkpoint(self, workflow_id: str, state: SharedWhiteboardState) -> str:
        """Create a snapshot of state for recovery."""
        checkpoint_id = str(uuid.uuid4())
        self.state_snapshots[checkpoint_id] = state.model_dump()

        if workflow_id not in self.version_history:
            self.version_history[workflow_id] = []

        self.version_history[workflow_id].append(
            {
                "checkpoint_id": checkpoint_id,
                "timestamp": datetime.utcnow().isoformat(),
                "integration_status": state.integration_status,
                "health_score": state.health_score,
            }
        )

        logger.info(
            "State checkpoint created",
            checkpoint_id=checkpoint_id,
            workflow_id=workflow_id,
        )
        return checkpoint_id

    def restore_from_checkpoint(
        self, checkpoint_id: str
    ) -> Optional[SharedWhiteboardState]:
        """Restore state from a checkpoint."""
        if checkpoint_id in self.state_snapshots:
            state_dict = self.state_snapshots[checkpoint_id]
            return SharedWhiteboardState(**state_dict)
        return None

    def get_workflow_history(self, workflow_id: str) -> List[Dict[str, Any]]:
        """Get version history for a workflow."""
        return self.version_history.get(workflow_id, [])


# Global state limiter and default state
_state_limiter = SharedStateLimiter()


def get_state_limiter() -> SharedStateLimiter:
    """Get the global state limiter."""
    return _state_limiter


def create_shared_whiteboard() -> SharedWhiteboardState:
    """Create a new shared whiteboard state."""
    return SharedWhiteboardState()
