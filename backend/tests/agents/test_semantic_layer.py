import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.semantic.layer import SemanticLayer
from app.schemas.integration import DataTransformation


@pytest.fixture
def mock_db_session():
    return AsyncMock()


@pytest.fixture
def semantic_layer(mock_db_session):
    with patch("app.services.semantic.layer.OpenAIEmbeddings") as mock_embeddings:
        layer = SemanticLayer(mock_db_session)
        layer.embeddings.aembed_query = AsyncMock(return_value=[0.1, 0.2, 0.3])
        return layer


@pytest.mark.asyncio
async def test_map_schema_flow(semantic_layer):
    # Mock schemas
    source_schema = {
        "properties": {
            "customer_name": {"type": "string", "description": "Full name"},
            "signup_date": {"type": "string", "format": "date"},
        }
    }
    dest_schema = {
        "properties": {
            "name": {"type": "string", "description": "User name"},
        }
    }

    # Mock LLM response via LLMProviderService
    mock_proposal = MagicMock()
    mock_proposal.source_field = "customer_name"
    mock_proposal.transform_type = "direct"
    mock_proposal.confidence = 90
    mock_proposal.reasoning = "Name match"

    with patch("app.services.semantic.layer.LLMProviderService") as mock_llm_service:
        mock_llm_service.create_llm = AsyncMock(return_value=MagicMock())
        mock_llm_service.invoke_structured_with_monitoring = AsyncMock(
            return_value=mock_proposal
        )

        # Mock vector search to return empty (start cold)
        semantic_layer.db.execute = AsyncMock(
            return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        )

        transformations = await semantic_layer.map_schema(
            source_schema, dest_schema, "Sync users"
        )

        assert len(transformations) == 1
        assert transformations[0].source_field == "customer_name"
        assert transformations[0].dest_field == "name"
        assert transformations[0].transform_type == "direct"

        # Verify LLM was called with correct context
        mock_llm_service.invoke_structured_with_monitoring.assert_called_once()
        call_kwargs = (
            mock_llm_service.invoke_structured_with_monitoring.call_args.kwargs
        )
        assert "customer_name" in call_kwargs["prompt"]
        assert "name" in call_kwargs["prompt"]


@pytest.mark.asyncio
async def test_low_confidence_fallback(semantic_layer):
    # Mock LLM response with low confidence
    mock_proposal = MagicMock()
    mock_proposal.confidence = 30  # Below 50 threshold

    with patch("app.services.semantic.layer.LLMProviderService") as mock_llm_service:
        mock_llm_service.create_llm = AsyncMock(return_value=MagicMock())
        mock_llm_service.invoke_structured_with_monitoring = AsyncMock(
            return_value=mock_proposal
        )

        # Mock vector search
        semantic_layer.db.execute = AsyncMock(
            return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        )

        # Use simple schemas
        source = {"properties": {"a": {"type": "string"}}}
        dest = {"properties": {"b": {"type": "string"}}}

        transformations = await semantic_layer.map_schema(source, dest, "intent")

        # Should return empty list because confidence was too low
        assert len(transformations) == 0
