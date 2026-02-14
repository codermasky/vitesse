import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.agents.self_healing import SelfHealingAgent
from app.agents.base import AgentContext


@pytest.fixture
def mock_context():
    context = MagicMock(spec=AgentContext)
    # Mocking shared state/context methods
    context.get_state.return_value = None
    return context


@pytest.fixture
def self_healing_agent(mock_context):
    return SelfHealingAgent(mock_context)


@pytest.mark.asyncio
async def test_diagnosis_auth_failure(self_healing_agent):
    # Mock error analysis
    # We will bypass the strict LLM call for unit testing by mocking _diagnose_issue if possible,
    # but since it's an internal method, we might want to test execute flow with mocked response.

    # Let's mock the internal methods to test the flow logic
    self_healing_agent._diagnose_issue = AsyncMock(
        return_value={
            "type": "authentication",
            "confidence": 0.95,
            "details": "401 Unauthorized",
        }
    )

    self_healing_agent._execute_strategy = AsyncMock(
        return_value={"success": False, "message": "Admin notified"}
    )

    input_data = {
        "integration_id": "auth_failed_int",
        "failure_reason": "401 Unauthorized",
    }

    result = await self_healing_agent.execute(context={}, input_data=input_data)

    assert result["status"] == "success"
    assert result["strategy_applied"] == "notify_admin_auth"
    assert result["outcome"]["success"] is False


@pytest.mark.asyncio
async def test_diagnosis_schema_drift(self_healing_agent):
    # Mock diagnosis for schema drift
    self_healing_agent._diagnose_issue = AsyncMock(
        return_value={
            "type": "schema_drift",
            "confidence": 0.90,
            "details": "Field 'user_id' missing",
        }
    )

    self_healing_agent._execute_strategy = AsyncMock(
        return_value={"success": True, "message": "Schema refreshed and re-mapped"}
    )

    input_data = {
        "integration_id": "schema_drift_int",
        "failure_reason": "KeyError: user_id",
    }

    result = await self_healing_agent.execute(context={}, input_data=input_data)

    assert result["status"] == "success"
    assert result["strategy_applied"] == "remap_fields"
    assert result["outcome"]["success"] is True


@pytest.mark.asyncio
async def test_diagnosis_endpoint_drift(self_healing_agent):
    # Mock diagnosis for endpoint drift
    self_healing_agent._diagnose_issue = AsyncMock(
        return_value={
            "type": "endpoint_drift",
            "confidence": 0.85,
            "details": "404 Not Found",
        }
    )

    self_healing_agent._execute_strategy = AsyncMock(
        return_value={"success": True, "message": "Endpoint updated"}
    )

    input_data = {
        "integration_id": "endpoint_drift_int",
        "failure_reason": "404 Not Found",
    }

    result = await self_healing_agent.execute(context={}, input_data=input_data)

    assert result["status"] == "success"
    assert (
        result["strategy_applied"] == "refresh_schema_and_remap"
    )  # or specific cleanup
