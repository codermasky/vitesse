"""
Unit tests for VitesseIngestor functionality, specifically LLM synthesis.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.ingestor import VitesseIngestor
from app.schemas.integration import APISpecification, APIAuthType


@pytest.fixture
def mock_context():
    return MagicMock()


@pytest.mark.asyncio
async def test_ingestor_html_synthesis_fallback(mock_context):
    """Test that Ingestor falls back to LLM synthesis when JSON parsing encounters HTML."""

    # Setup
    ingestor = VitesseIngestor(context=mock_context, agent_id="ingestor-test")

    # Mock dependencies
    mock_llm_service = AsyncMock()
    mock_llm_instance = MagicMock()

    # Mock structured output
    expected_spec = APISpecification(
        source_url="http://api.example.com",
        api_name="Example API",
        base_url="http://api.example.com/v1",
        auth_type=APIAuthType.API_KEY,
        endpoints=[],
    )

    with (
        patch("app.agents.ingestor.LLMProviderService", new=mock_llm_service),
        patch("app.agents.ingestor.httpx.AsyncClient") as mock_client_cls,
    ):
        # Mock HTTP response to be HTML (invalid JSON)
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body><h1>API Docs</h1></body></html>"
        mock_response.headers = {"content-type": "text/html"}
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client_cls.return_value = mock_client

        # Mock LLM Service
        mock_llm_service.create_llm.return_value = mock_llm_instance
        mock_llm_service.invoke_structured_with_monitoring.return_value = expected_spec

        # Execute
        input_data = {"api_url": "http://api.example.com", "api_name": "Example API"}
        result = await ingestor._execute(context={}, input_data=input_data)

        # Verify
        assert result["status"] == "success"
        assert result["auth_type"] == "api_key"

        # Verify LLM was called
        mock_llm_service.create_llm.assert_called_once()
        mock_llm_service.invoke_structured_with_monitoring.assert_called_once()

        # Verify prompt contained HTML
        call_kwargs = (
            mock_llm_service.invoke_structured_with_monitoring.call_args.kwargs
        )
        assert "<html>" in call_kwargs["prompt"]
        assert "synthesize_spec" in call_kwargs["operation_name"]


@pytest.mark.asyncio
async def test_ingestor_json_success(mock_context):
    """Test standard JSON parsing path works without LLM."""

    ingestor = VitesseIngestor(context=mock_context, agent_id="ingestor-test")

    with (
        patch("app.agents.ingestor.LLMProviderService") as mock_llm_service,
        patch("app.agents.ingestor.httpx.AsyncClient") as mock_client_cls,
    ):
        # Mock HTTP response as valid Swagger JSON
        mock_client = AsyncMock()
        mock_json_response = MagicMock()
        mock_json_response.status_code = 200
        mock_json_response.text = (
            '{"swagger": "2.0", "info": {"title": "Test API"}, "paths": {}}'
        )
        mock_client.get.return_value = mock_json_response
        mock_client.__aenter__.return_value = mock_client
        mock_client_cls.return_value = mock_client

        # Execute
        input_data = {
            "api_url": "http://api.test.com/swagger.json",
            "api_name": "Test API",
        }
        result = await ingestor._execute(context={}, input_data=input_data)

        # Verify
        assert result["status"] == "success"

        # Verify LLM was NOT called
        mock_llm_service.create_llm.assert_not_called()
