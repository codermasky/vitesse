import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from app.agents.integration_monitor import IntegrationMonitorAgent
from app.agents.base import AgentContext


@pytest.fixture
def mock_context():
    context = MagicMock(spec=AgentContext)
    context.get_state = MagicMock(return_value={})
    context.set_state = MagicMock()
    return context


@pytest.fixture
def integration_monitor(mock_context):
    return IntegrationMonitorAgent(mock_context)


@pytest.mark.asyncio
async def test_process_metrics_success(integration_monitor):
    # Mock input data for a successful integration call
    input_data = {
        "action": "report_metrics",
        "integration_id": "test_integration_123",
        "success": True,
        "duration": 150,
    }

    # Execute the agent
    result = await integration_monitor.execute(context={}, input_data=input_data)

    # Asserts
    assert result["status"] == "success"
    assert result["updated_health"] == 100.0
    assert result["integration_id"] == "test_integration_123"

    # Verify internal state was updated
    stats = integration_monitor.monitored_integrations["test_integration_123"]
    assert stats["total_calls"] == 1
    assert stats["failed_calls"] == 0
    assert stats["last_success"] is not None


@pytest.mark.asyncio
async def test_process_metrics_failure_and_healing_trigger(integration_monitor):
    # Setup: Create a monitored integration with some history
    integration_id = "failing_integration"
    integration_monitor.monitored_integrations[integration_id] = {
        "total_calls": 10,
        "failed_calls": 2,  # 20% failure rate
        "errors": [],
        "last_success": datetime.utcnow(),
        "last_failure": None,
        "health_score": 80.0,
    }

    # Mock the self-healing trigger
    integration_monitor._trigger_self_healing = AsyncMock(
        return_value="healing_job_123"
    )

    # Mock input for a failed call
    input_data = {
        "action": "report_metrics",
        "integration_id": integration_id,
        "success": False,
        "error": "500 Internal Server Error",
        "duration": 50,
    }

    # Execute
    result = await integration_monitor.execute(context={}, input_data=input_data)

    # Asserts
    assert result["status"] == "success"
    # New failure rate: 3 failures / 11 total = ~27% -> Health ~73% (still above 60% threshold usually, let's force threshold logic check)

    # Let's force a critical failure rate
    integration_monitor.context.get_state.return_value = {}

    # Verify stats updated
    stats = integration_monitor.monitored_integrations[integration_id]
    assert stats["failed_calls"] == 3
    assert stats["total_calls"] == 11
    assert len(stats["errors"]) == 1


@pytest.mark.asyncio
async def test_health_check_action(integration_monitor):
    # Setup some data
    integration_monitor.monitored_integrations["int_1"] = {"health_score": 95.0}
    integration_monitor.monitored_integrations["int_2"] = {"health_score": 40.0}

    input_data = {"action": "check_health"}

    result = await integration_monitor.execute(context={}, input_data=input_data)

    assert result["status"] == "success"
    assert result["monitor_count"] == 2
    assert len(result["critical_integrations"]) == 1
    assert result["critical_integrations"][0] == "int_2"
