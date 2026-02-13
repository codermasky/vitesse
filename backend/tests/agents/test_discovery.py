"""
Unit tests for VitesseDiscoveryAgent functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.discovery import VitesseDiscoveryAgent
from app.schemas.discovery import DiscoveryResult


@pytest.fixture
def mock_context():
    return MagicMock()


@pytest.mark.asyncio
async def test_discovery_known_apis(mock_context):
    """Test that Discovery agent finds known APIs from catalog."""

    # Setup
    agent = VitesseDiscoveryAgent(context=mock_context, agent_id="discovery-test")

    # Execute - search for Shopify
    result = await agent._execute(
        context={}, input_data={"query": "shopify", "limit": 5}
    )

    # Verify
    assert result["status"] == "success"
    assert result["total_found"] > 0
    assert any("Shopify" in r["api_name"] for r in result["results"])

    # Check that catalog results have high confidence
    shopify_result = next(r for r in result["results"] if "Shopify" in r["api_name"])
    assert shopify_result["confidence_score"] >= 0.9
    assert shopify_result["source"] == "catalog"


@pytest.mark.asyncio
async def test_discovery_llm_fallback(mock_context):
    """Test that Discovery agent uses LLM when catalog doesn't have results."""

    # Setup
    agent = VitesseDiscoveryAgent(context=mock_context, agent_id="discovery-test")

    # Mock LLM service
    mock_llm_service = AsyncMock()
    mock_llm_instance = MagicMock()

    # Mock LLM response
    from pydantic import BaseModel
    from typing import List

    class MockLLMResponse(BaseModel):
        results: List[DiscoveryResult]

    mock_llm_response = MockLLMResponse(
        results=[
            DiscoveryResult(
                api_name="Custom Weather API",
                description="Weather data API",
                documentation_url="https://weather-api.example.com/docs",
                spec_url="https://weather-api.example.com/openapi.json",
                base_url="https://api.weather.example.com",
                confidence_score=0.85,
                source="llm",
                tags=["weather", "data"],
            )
        ]
    )

    with patch("app.agents.discovery.LLMProviderService") as mock_llm_svc:
        mock_llm_svc.create_llm.return_value = mock_llm_instance
        mock_llm_svc.invoke_structured_with_monitoring.return_value = mock_llm_response

        # Execute - search for something not in catalog
        result = await agent._execute(
            context={}, input_data={"query": "custom weather data", "limit": 5}
        )

        # Verify LLM was called
        mock_llm_svc.create_llm.assert_called_once()
        mock_llm_svc.invoke_structured_with_monitoring.assert_called_once()

        # Verify results
        assert result["status"] == "success"
        assert result["total_found"] > 0


@pytest.mark.asyncio
async def test_discovery_empty_query(mock_context):
    """Test that Discovery agent handles empty query gracefully."""

    # Setup
    agent = VitesseDiscoveryAgent(context=mock_context, agent_id="discovery-test")

    # Execute with empty query
    result = await agent._execute(context={}, input_data={"query": "", "limit": 5})

    # Verify error handling
    assert result["status"] == "failed"
    assert "error" in result
