"""
Aether Testing Utilities

Provides testing helpers for agentic applications:
- Mock intelligence providers
- Test fixtures for agents and workflows
- Assertion helpers
- State builders
"""

import asyncio
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel
from aether.protocols.intelligence import IntelligenceProvider


# ============================================================================
# MOCK INTELLIGENCE PROVIDER
# ============================================================================


class MockIntelligenceProvider(IntelligenceProvider):
    """
    Mock intelligence provider for testing.

    Returns pre-configured responses instead of calling real LLMs.

    Example:
        # Setup mock responses
        mock = MockIntelligenceProvider()
        mock.add_response("What is 2+2?", "4")
        mock.add_structured_response(MySchema, MySchema(field="value"))

        # Use in tests
        agent = MyAgent("test", mock)
        result = await agent.execute({"input": "data"})
    """

    def __init__(self):
        self.responses: Dict[str, Any] = {}
        self.structured_responses: Dict[Type[BaseModel], BaseModel] = {}
        self.call_history: List[Dict[str, Any]] = []
        self.default_response = "Mock response"

    def add_response(self, prompt: str, response: str):
        """Add a canned response for a specific prompt."""
        self.responses[str(prompt)] = response

    def add_structured_response(self, schema: Type[BaseModel], response: BaseModel):
        """Add a canned structured response for a schema."""
        self.structured_responses[schema] = response

    def set_default_response(self, response: str):
        """Set default response when no match found."""
        self.default_response = response

    async def ainvoke(
        self, prompt: Any, config: Optional[Dict[str, Any]] = None, **kwargs
    ) -> Any:
        """Return canned response or default."""
        self.call_history.append(
            {
                "type": "ainvoke",
                "prompt": prompt,
                "config": config,
                "kwargs": kwargs,
            }
        )

        prompt_str = str(prompt)
        return self.responses.get(prompt_str, self.default_response)

    async def ainvoke_structured(
        self,
        prompt: Any,
        output_schema: Type[BaseModel],
        config: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> BaseModel:
        """Return canned structured response."""
        self.call_history.append(
            {
                "type": "ainvoke_structured",
                "prompt": prompt,
                "schema": output_schema.__name__,
                "config": config,
                "kwargs": kwargs,
            }
        )

        if output_schema in self.structured_responses:
            return self.structured_responses[output_schema]

        # Try to create empty instance
        try:
            return output_schema()
        except Exception:
            raise ValueError(
                f"No mock response configured for schema {output_schema.__name__}. "
                f"Use add_structured_response() to configure."
            )

    def get_call_history(self) -> List[Dict[str, Any]]:
        """Get history of all calls made to this provider."""
        return self.call_history.copy()

    def reset(self):
        """Reset all responses and history."""
        self.responses.clear()
        self.structured_responses.clear()
        self.call_history.clear()


# ============================================================================
# TEST FIXTURES
# ============================================================================


def create_test_state(**fields) -> Dict[str, Any]:
    """
    Create a test workflow state with sensible defaults.

    Args:
        **fields: State fields to set

    Returns:
        State dict with defaults

    Example:
        state = create_test_state(
            workflow_id="test_123",
            entity_name="Test Corp",
        )
    """
    defaults = {
        "workflow_id": "test_workflow",
        "retry_count": 0,
        "confidence_score": 1.0,
        "review_flags": [],
        "audit_trail": [],
    }
    defaults.update(fields)
    return defaults


async def run_agent_test(
    agent: Any,
    input_data: Dict[str, Any],
    expected_fields: Optional[List[str]] = None,
    assert_success: bool = True,
) -> Any:
    """
    Helper to run an agent and assert basic correctness.

    Args:
        agent: Agent instance to test
        input_data: Input data dict
        expected_fields: Fields that must be present in output
        assert_success: Whether to assert agent doesn't raise

    Returns:
        Agent output

    Example:
        result = await run_agent_test(
            agent=my_agent,
            input_data={"query": "test"},
            expected_fields=["answer", "confidence"],
        )
    """
    try:
        result = await agent.execute(input_data)

        # Check expected fields
        if expected_fields:
            result_dict = (
                result.model_dump() if hasattr(result, "model_dump") else result
            )
            for field in expected_fields:
                assert field in result_dict, f"Expected field '{field}' not in result"

        return result

    except Exception as e:
        if assert_success:
            raise AssertionError(f"Agent execution failed: {e}")
        raise


# ============================================================================
# ASSERTION HELPERS
# ============================================================================


def assert_state_has_fields(state: Dict[str, Any], fields: List[str]):
    """Assert that state contains all required fields."""
    missing = [f for f in fields if f not in state]
    assert not missing, f"State missing required fields: {missing}"


def assert_state_field_type(state: Dict[str, Any], field: str, expected_type: Type):
    """Assert that a state field has the expected type."""
    assert field in state, f"Field '{field}' not in state"
    value = state[field]
    assert isinstance(value, expected_type), (
        f"Field '{field}' has type {type(value).__name__}, "
        f"expected {expected_type.__name__}"
    )


def assert_confidence_above(state: Dict[str, Any], threshold: float = 0.8):
    """Assert that confidence score is above threshold."""
    confidence = state.get("confidence_score", 0.0)
    assert confidence >= threshold, (
        f"Confidence {confidence} below threshold {threshold}"
    )


def assert_no_errors(state: Dict[str, Any]):
    """Assert that state has no errors or review flags."""
    errors = state.get("errors", [])
    flags = state.get("review_flags", [])

    assert not errors, f"State has errors: {errors}"
    assert not flags, f"State has review flags: {flags}"


# ============================================================================
# WORKFLOW TESTING
# ============================================================================


async def run_workflow_test(
    workflow: Any,
    initial_state: Dict[str, Any],
    expected_final_state_fields: Optional[List[str]] = None,
    max_steps: int = 100,
) -> Dict[str, Any]:
    """
    Run a workflow and assert basic correctness.

    Args:
        workflow: Compiled workflow
        initial_state: Initial state dict
        expected_final_state_fields: Fields that must be in final state
        max_steps: Maximum steps before considering stuck

    Returns:
        Final state

    Example:
        final_state = await run_workflow_test(
            workflow=my_workflow,
            initial_state={"input": "data"},
            expected_final_state_fields=["output", "confidence"],
        )
    """
    config = {"configurable": {"thread_id": "test"}}

    # Run workflow
    result = await workflow.ainvoke(initial_state, config=config)

    # Check expected fields
    if expected_final_state_fields:
        assert_state_has_fields(result, expected_final_state_fields)

    return result


# ============================================================================
# PERFORMANCE TESTING
# ============================================================================


async def measure_agent_performance(
    agent: Any,
    input_data: Dict[str, Any],
    iterations: int = 10,
) -> Dict[str, Any]:
    """
    Measure agent performance over multiple runs.

    Args:
        agent: Agent to test
        input_data: Input data
        iterations: Number of iterations

    Returns:
        Performance stats (min, max, avg, median)

    Example:
        stats = await measure_agent_performance(
            agent=my_agent,
            input_data={"query": "test"},
            iterations=100,
        )
        print(f"Average: {stats['avg_duration']}s")
    """
    import time

    durations = []

    for i in range(iterations):
        start = time.time()
        try:
            await agent.execute(input_data)
            duration = time.time() - start
            durations.append(duration)
        except Exception as e:
            print(f"Iteration {i} failed: {e}")

    if not durations:
        return {"error": "All iterations failed"}

    durations.sort()

    return {
        "iterations": len(durations),
        "min_duration": min(durations),
        "max_duration": max(durations),
        "avg_duration": sum(durations) / len(durations),
        "median_duration": durations[len(durations) // 2],
        "p95_duration": durations[int(len(durations) * 0.95)],
        "p99_duration": durations[int(len(durations) * 0.99)],
    }
