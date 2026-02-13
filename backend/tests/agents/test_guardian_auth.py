import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import httpx
from app.agents.guardian import VitesseGuardian


@pytest.fixture
def mock_context():
    return MagicMock()


@pytest.fixture
def guardian(mock_context):
    return VitesseGuardian(mock_context)


def test_get_auth_headers_api_key(guardian):
    spec = {
        "auth_type": "api_key",
        "auth_config": {"name": "X-Custom-Auth", "key": "secret123"},
    }
    headers = guardian._get_auth_headers(spec)
    assert headers == {"X-Custom-Auth": "secret123"}


def test_get_auth_headers_bearer(guardian):
    spec = {"auth_type": "bearer_token", "auth_config": {"token": "token123"}}
    headers = guardian._get_auth_headers(spec)
    assert headers == {"Authorization": "Bearer token123"}


def test_get_auth_headers_basic(guardian):
    spec = {
        "auth_type": "basic",
        "auth_config": {"username": "user", "password": "pass"},
    }
    headers = guardian._get_auth_headers(spec)
    # user:pass -> dXNlcjpwYXNz
    assert headers == {"Authorization": "Basic dXNlcjpwYXNz"}


@pytest.mark.asyncio
async def test_run_shadow_calls_injects_headers(guardian):
    # Mock data
    source_spec = {
        "auth_type": "api_key",
        "auth_config": {"key": "source_key"},
        "base_url": "http://src",
    }
    dest_spec = {
        "auth_type": "bearer_token",
        "auth_config": {"token": "dest_token"},
        "base_url": "http://dst",
    }
    test_data = [{"id": 1}]

    # Mock httpx client
    mock_response = httpx.Response(200, json={})

    with patch("httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        MockClient.return_value.__aenter__.return_value = mock_client_instance

        # Mock methods
        mock_client_instance.get.return_value = mock_response
        mock_client_instance.post.return_value = mock_response

        # Run
        await guardian._run_shadow_calls(
            "test_id", source_spec, dest_spec, "/src", "/dst", test_data
        )

        # Verify Headers in calls
        # Source Call (GET)
        mock_client_instance.get.assert_called()
        call_args = mock_client_instance.get.call_args
        assert call_args.kwargs["headers"]["X-API-Key"] == "source_key"

        # Dest Call (POST)
        mock_client_instance.post.assert_called()
        call_args_post = mock_client_instance.post.call_args
        assert call_args_post.kwargs["headers"]["Authorization"] == "Bearer dest_token"


@pytest.mark.asyncio
async def test_rate_limiting_delay(guardian):
    # Test that asyncio.sleep is called
    test_data = [{}, {}]  # 2 items trigger 1 sleep

    with (
        patch("httpx.AsyncClient") as MockClient,
        patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
    ):
        mock_client_instance = AsyncMock()
        MockClient.return_value.__aenter__.return_value = mock_client_instance
        mock_client_instance.get.return_value = httpx.Response(200)
        mock_client_instance.post.return_value = httpx.Response(200)

        await guardian._run_shadow_calls("id", {}, {}, "/s", "/d", test_data)

        # Should sleep once for the second item
        mock_sleep.assert_called_once()
