"""
Integration tests for LocalContainerDeployer.
Mocks Docker SDK to verify logic without running actual containers.
"""

import pytest
from unittest.mock import MagicMock, patch, mock_open
from app.deployer.container_deployer import LocalContainerDeployer


@pytest.fixture
def mock_docker_client():
    with patch("app.deployer.container_deployer.docker.from_env") as mock_env:
        client = MagicMock()
        mock_env.return_value = client
        yield client


@pytest.mark.asyncio
async def test_deploy_success(mock_docker_client):
    """Test successful deployment flow."""
    # Setup mocks
    mock_container = MagicMock()
    mock_container.id = "test-container-id"
    mock_container.attrs = {
        "NetworkSettings": {"Ports": {"8000/tcp": [{"HostPort": "12345"}]}}
    }

    # Mock image build
    mock_image = MagicMock()
    mock_image.id = "sha256:testimage"
    mock_docker_client.images.build.return_value = (mock_image, [])

    # Mock container run
    mock_docker_client.containers.run.return_value = mock_container

    # Mock existing container check (not found)
    mock_docker_client.containers.get.side_effect = Exception("Not Found")

    # Initialize Deployer
    config = {}
    deployer = LocalContainerDeployer(config)

    # Input
    integration_id = "test-integ"
    container_config = {
        "source_api_name": "Source",
        "dest_api_name": "Dest",
        "env": {"SYNC_INTERVAL_SECONDS": "60"},
    }

    # Execute
    # Mock file writing to avoid actual disk I/O in test
    with (
        patch("builtins.open", mock_open()),
        patch("app.deployer.container_deployer.shutil.rmtree"),
        patch("app.deployer.container_deployer.Path.mkdir"),
    ):
        result = await deployer.deploy(integration_id, container_config)

    # Verify
    assert result["status"] == "success"
    assert result["container_id"] == "test-container-id"
    assert result["service_url"] == "http://localhost:12345"

    # Verify Docker calls
    mock_docker_client.images.build.assert_called_once()
    mock_docker_client.containers.run.assert_called_once()
    assert (
        mock_docker_client.containers.run.call_args[1]["environment"]["PORT"] == "8000"
    )


@pytest.mark.asyncio
async def test_get_status_running(mock_docker_client):
    """Test get_status for running container."""
    # Setup
    mock_container = MagicMock()
    mock_container.id = "test-id"
    mock_container.status = "running"
    mock_container.name = "vitesse-test-integ"
    mock_container.image.tags = ["vitesse:latest"]

    mock_docker_client.containers.get.return_value = mock_container

    deployer = LocalContainerDeployer({})

    # Execute
    status = await deployer.get_status("test-integ")

    # Verify
    assert status["status"] == "running"
    assert status["container_id"] == "test-id"


@pytest.mark.asyncio
async def test_destroy_container(mock_docker_client):
    """Test destroying a container."""
    # Setup
    mock_container = MagicMock()
    mock_docker_client.containers.get.return_value = mock_container

    deployer = LocalContainerDeployer({})

    # Execute
    result = await deployer.destroy("test-integ")

    # Verify
    assert result["status"] == "success"
    mock_container.stop.assert_called_once()
    mock_container.remove.assert_called_once()
