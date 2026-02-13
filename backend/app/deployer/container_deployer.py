"""
Local Container Deployer: runs integrations as local Docker containers.
Replaces the stub LocalDeployer with real Docker SDK implementation.
"""

import os
import sys
import asyncio
import json
import shutil
from typing import Dict, Any, Optional
from pathlib import Path
import structlog
import docker
from docker.errors import DockerException, APIError

from app.deployer.base import Deployer, DeploymentMode
from app.deployer.script_generator import ScriptGenerator
from app.deployer.templates import DockerfileGenerator

logger = structlog.get_logger(__name__)

# Directory where active integrations will live
INTEGRATIONS_DIR = Path("integrations_active")


class LocalContainerDeployer(Deployer):
    """
    Deploys integrations as Docker containers on the local machine.
    Manages container build, run, and lifecycle.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(DeploymentMode.LOCAL, config)
        self.base_dir = INTEGRATIONS_DIR
        self.base_dir.mkdir(exist_ok=True)

        try:
            self.client = docker.from_env()
            self.client.ping()
            logger.info("Docker client connected successfully")
        except DockerException as e:
            logger.error(f"Failed to connect to Docker: {e}")
            raise RuntimeError(
                "Docker is required for LocalContainerDeployer but is not available."
            )

    async def deploy(
        self, integration_id: str, container_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Deploy (build and run) the integration container.
        """
        logger.info("Deploying integration container", integration_id=integration_id)

        try:
            # 1. Prepare Directory
            integ_dir = self.base_dir / integration_id
            if integ_dir.exists():
                shutil.rmtree(integ_dir)
            integ_dir.mkdir(exist_ok=True)

            # 2. Extract Configuration
            env_vars = container_config.get("env", {})
            mapping_json = container_config.get("mapping_json", "{}")

            # 3. Generate Script (main.py)
            # We reuse the ScriptGenerator because it creates a perfect standalone script
            script_content = ScriptGenerator.generate_integration_script(
                integration_id=integration_id,
                source_api_name=container_config.get("source_api_name", "Source"),
                dest_api_name=container_config.get("dest_api_name", "Dest"),
                mapping_json=mapping_json,
                source_api_url=env_vars.get("SOURCE_API_URL", ""),
                dest_api_url=env_vars.get("DEST_API_URL", ""),
                source_auth_config={"type": "unknown"},  # Simplified for MVP
                dest_auth_config={"type": "unknown"},  # Simplified for MVP
                sync_interval=int(env_vars.get("SYNC_INTERVAL_SECONDS", 3600)),
            )

            with open(integ_dir / "main.py", "w") as f:
                f.write(script_content)

            # 4. Generate requirements.txt
            requirements = DockerfileGenerator.generate_requirements_txt()
            with open(integ_dir / "requirements.txt", "w") as f:
                f.write(requirements)

            # 5. Generate Dockerfile
            # We use a standard base image
            dockerfile = DockerfileGenerator.generate_base_dockerfile(
                integration_id=integration_id
            )
            with open(integ_dir / "Dockerfile", "w") as f:
                f.write(dockerfile)

            # 6. Build Image
            image_tag = f"vitesse-integration-{integration_id}:latest"
            logger.info(f"Building image {image_tag}")

            # Docker build logs are stream generator
            # We'll just build and wait
            image, build_logs = self.client.images.build(
                path=str(integ_dir), tag=image_tag, rm=True, quiet=False
            )
            logger.info("Image built successfully", image_id=image.id)

            # 7. Run Container
            container_name = f"vitesse-{integration_id}"

            # Stop existing if any
            try:
                existing = self.client.containers.get(container_name)
                existing.stop()
                existing.remove()
            except docker.errors.NotFound:
                pass

            # Random host port mapping
            container = self.client.containers.run(
                image_tag,
                name=container_name,
                detach=True,
                ports={"8000/tcp": None},  # Let Docker assign random port
                environment={"PORT": "8000"},
                restart_policy={"Name": "on-failure", "MaximumRetryCount": 3},
            )

            # Wait a moment for it to start
            container.reload()

            # Get assigned port
            ports = container.attrs["NetworkSettings"]["Ports"]
            host_port = ports["8000/tcp"][0]["HostPort"]

            service_url = f"http://localhost:{host_port}"
            logger.info(f"Container started at {service_url}")

            return {
                "status": "success",
                "deployment_mode": "local_container",
                "container_id": container.id,
                "service_url": service_url,
                "image_tag": image_tag,
            }

        except Exception as e:
            logger.error("Local container deployment failed", error=str(e))
            return {"status": "failed", "error": str(e)}

    async def update(
        self, container_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update container (Rebuild and Redeploy)."""
        # For MVP, update is just a redeploy
        return await self.deploy(
            container_id, updates
        )  # container_id here is treated as integration_id

    async def destroy(self, container_id: str) -> Dict[str, Any]:
        """Stop and remove container."""
        try:
            # container_id might be the actual Docker ID or the integration ID
            # Let's try to find by name first if it looks like an ID
            try:
                container = self.client.containers.get(container_id)
            except docker.errors.NotFound:
                # Try by name
                container_name = f"vitesse-{container_id}"
                container = self.client.containers.get(container_name)

            container.stop()
            container.remove()
            return {"status": "success"}
        except docker.errors.NotFound:
            return {"status": "not_found"}
        except Exception as e:
            logger.error(f"Failed to destroy container: {e}")
            return {"status": "error", "error": str(e)}

    async def get_status(self, container_id: str) -> Dict[str, Any]:
        """Get container status."""
        try:
            try:
                container = self.client.containers.get(container_id)
            except docker.errors.NotFound:
                container_name = f"vitesse-{container_id}"
                container = self.client.containers.get(container_name)

            return {
                "container_id": container.id,
                "status": container.status,
                "name": container.name,
                "image": container.image.tags[0] if container.image.tags else "unknown",
            }
        except docker.errors.NotFound:
            return {"status": "not_found"}

    async def get_logs(self, container_id: str, lines: int = 100) -> str:
        """Get container logs."""
        try:
            try:
                container = self.client.containers.get(container_id)
            except docker.errors.NotFound:
                container_name = f"vitesse-{container_id}"
                container = self.client.containers.get(container_name)

            return container.logs(tail=lines).decode("utf-8")
        except Exception as e:
            return f"Failed to get logs: {e}"
