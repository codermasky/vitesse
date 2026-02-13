import pytest
from app.services.drift.detector import SchemaDriftDetector
from app.agents.guardian import VitesseGuardian
from unittest.mock import MagicMock, AsyncMock


def test_drift_detection_breaking():
    detector = SchemaDriftDetector()

    old_spec = {"paths": {"/users": {"get": {}}}}

    # Removed endpoint
    new_spec = {"paths": {}}

    report = detector.detect_drift(old_spec, new_spec)
    assert report.drift_type == "breaking"
    assert report.severity == "critical"
    assert report.is_backward_compatible is False


def test_drift_detection_non_breaking():
    detector = SchemaDriftDetector()

    old_spec = {"paths": {"/users": {"get": {}}}}

    # Added endpoint
    new_spec = {"paths": {"/users": {"get": {}}, "/products": {"get": {}}}}

    report = detector.detect_drift(old_spec, new_spec)
    # DeepDiff might mark this as 'dictionary_item_added', which our detector defaults to non-breaking
    assert report.drift_type == "non-breaking"
    assert report.is_backward_compatible is True


@pytest.mark.asyncio
async def test_guardian_self_healing_trigger():
    # Mock context
    context = MagicMock()
    guardian = VitesseGuardian(context)

    # Mock input with drift
    input_data = {
        "integration_instance": {
            "id": "test-123",
            "source_api_spec": {"paths": {"/a": {}}},
            "dest_api_spec": {},
        },
        "source_endpoint": "/a",
        "dest_endpoint": "/b",
        "latest_source_spec": {"paths": {}},  # Empty paths = breaking drift
    }

    # Mock shadow calls to avoid HTTP requests
    guardian._run_shadow_calls = AsyncMock()
    guardian._generate_synthetic_data = AsyncMock(return_value=[{}])

    # Run execute
    result = await guardian._execute(context, input_data)

    # Check if drift info was added to input_data (healing trigger)
    assert input_data.get("drift_detected") is True
    assert "drift_report" in input_data
    assert input_data["drift_report"]["drift_type"] == "breaking"
