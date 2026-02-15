"""
Base classes and interfaces for Vitesse agents.
All specialized agents (Ingestor, Mapper, Guardian) inherit from these.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List
from datetime import datetime
import uuid
import structlog

logger = structlog.get_logger(__name__)


class VitesseAgent(ABC):
    """
    Base class for all Vitesse agents.
    Provides common infrastructure: logging, state management, error handling.
    """

    def __init__(self, agent_id: Optional[str] = None, agent_type: str = "base"):
        self.agent_id = agent_id or str(uuid.uuid4())
        self.agent_type = agent_type
        self.created_at = datetime.utcnow()
        self.execution_count = 0
        self.last_execution = None
        self.error_count = 0
        self.state_history: List[Dict[str, Any]] = []

    async def execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Main execution method for the agent.
        Must be implemented by subclasses.
        """
        self.execution_count += 1
        self.last_execution = datetime.utcnow()

        try:
            logger.info(
                f"{self.agent_type} executing",
                agent_id=self.agent_id,
                execution_count=self.execution_count,
            )

            result = await self._execute(context, input_data, on_progress)

            # Store state history
            self.state_history.append(
                {
                    "timestamp": datetime.utcnow(),
                    "status": "success",
                    "execution_count": self.execution_count,
                    "result_keys": list(result.keys())
                    if isinstance(result, dict)
                    else None,
                }
            )

            return result

        except Exception as e:
            self.error_count += 1
            error_msg = str(e)

            logger.error(
                f"{self.agent_type} execution failed",
                agent_id=self.agent_id,
                error=error_msg,
                error_count=self.error_count,
            )

            self.state_history.append(
                {
                    "timestamp": datetime.utcnow(),
                    "status": "error",
                    "error": error_msg,
                    "execution_count": self.execution_count,
                }
            )

            raise

    @abstractmethod
    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Actual execution logic. To be implemented by subclasses.
        """
        pass

    def get_status(self) -> Dict[str, Any]:
        """Return agent status."""
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "created_at": self.created_at.isoformat(),
            "execution_count": self.execution_count,
            "last_execution": self.last_execution.isoformat()
            if self.last_execution
            else None,
            "error_count": self.error_count,
            "error_rate": self.error_count / self.execution_count
            if self.execution_count > 0
            else 0,
        }


class IngestorAgent(VitesseAgent):
    """
    Ingestor Agent: Discovers and parses API specifications.

    Responsibilities:
    - Fetch and parse API documentation (Swagger/OpenAPI)
    - Extract endpoints, authentication, parameters
    - Generate standardized API specification
    - Detect pagination, rate limits, auth patterns
    """

    def __init__(self, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id, agent_type="ingestor")

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Execute Ingestor: Parse API and return specification.

        Input:
            - api_url: URL to API documentation or Swagger spec
            - api_name: Human-readable API name
            - auth_details: Optional authentication information
        """
        raise NotImplementedError("Subclass must implement _execute")


class SemanticMapperAgent(VitesseAgent):
    """
    Semantic Mapper Agent: Maps data across API schemas.

    Responsibilities:
    - Analyze source and destination API schemas
    - Generate semantic mappings (source field \u2192 dest field)
    - Create transformation logic (date formats, type conversions, etc)
    - Handle complex nested object transformations
    - Generate pre/post sync hooks if needed
    """

    def __init__(self, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id, agent_type="mapper")

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Execute Mapper: Generate transformation logic.

        Input:
            - source_api_spec: APISpecification for source
            - dest_api_spec: APISpecification for destination
            - user_intent: Human description of what to sync
            - source_endpoint: Which source endpoint to use
            - dest_endpoint: Which dest endpoint to use
        """
        raise NotImplementedError("Subclass must implement _execute")


class GuardianAgent(VitesseAgent):
    """
    Guardian Agent: Tests, validates, and self-heals integrations.

    Responsibilities:
    - Generate synthetic test data
    - Execute shadow calls to both APIs
    - Calculate health scores
    - Detect API schema changes
    - Trigger re-mapping if errors occur
    - Generate comprehensive test reports
    """

    def __init__(self, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id, agent_type="guardian")

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Execute Guardian: Run tests and generate health score.

        Input:
            - integration_instance: Full IntegrationInstance object
            - test_count: Number of shadow calls to perform (default 100)
            - source_endpoint: Endpoint to test on source
            - dest_endpoint: Endpoint to test on destination
        """
        raise NotImplementedError("Subclass must implement _execute")


class DeployerAgent(VitesseAgent):
    """
    Deployer Agent: Manages deployment lifecycle.

    Responsibilities:
    - Containerize integration logic
    - Deploy to local VPS (Docker/Traefik)
    - Deploy to cloud (EKS/ECS)
    - Manage configuration and secrets
    - Handle scaling and updates
    """

    def __init__(self, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id, agent_type="deployer")

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Execute Deployer: Deploy integration.

        Input:
            - integration_instance: Full IntegrationInstance
            - deployment_config: DeploymentConfig with target
            - action: 'create', 'update', 'destroy'
        """
        raise NotImplementedError("Subclass must implement _execute")


class AgentContext:
    """
    Execution context shared across agents.
    Maintains shared state, LLM connections, and utilities.
    """

    def __init__(
        self,
        llm_provider: Optional[Any] = None,
        db_session: Optional[Any] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.llm_provider = llm_provider
        self.db_session = db_session
        self.config = config or {}
        self.shared_state: Dict[str, Any] = {}
        self.created_at = datetime.utcnow()

    def set_state(self, key: str, value: Any):
        """Set a shared state value."""
        self.shared_state[key] = value

    def get_state(self, key: str, default: Any = None) -> Any:
        """Get a shared state value."""
        return self.shared_state.get(key, default)

    def clear_state(self):
        """Clear all shared state."""
        self.shared_state.clear()
