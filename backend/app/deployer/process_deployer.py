"""
Local Process Deployer: runs integrations as local Python subprocesses.
Replaces the complex Docker-based LocalDeployer.
"""

import os
import sys
import asyncio
import signal
import subprocess
import shutil
from typing import Dict, Any, Optional
from pathlib import Path
import structlog

from app.deployer.base import Deployer, DeploymentMode
from app.deployer.script_generator import ScriptGenerator

logger = structlog.get_logger(__name__)

# Directory where active integrations will live
INTEGRATIONS_DIR = Path("integrations_active")


class LocalProcessDeployer(Deployer):
    """
    Deploys integrations as standalone Python processes on the local machine.
    Manages process lifecycle, logging, and ports.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(DeploymentMode.LOCAL, config)
        self.base_dir = INTEGRATIONS_DIR
        self.base_dir.mkdir(exist_ok=True)
        self.python_executable = sys.executable  # Use current venv python

        # In-memory registry of running processes (for MVP)
        # In prod, this should be backed by a DB or PID files
        self._processes: Dict[str, subprocess.Popen] = {}
        self._ports: Dict[str, int] = {}
        self._next_port = 9000

    async def deploy(
        self, integration_id: str, container_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Deploy (generate and run) the integration script.
        """
        logger.info("Deploying integration process", integration_id=integration_id)

        try:
            # 1. Prepare Directory
            integ_dir = self.base_dir / integration_id
            integ_dir.mkdir(exist_ok=True)

            # 2. Extract Configuration
            # The 'container_config' passed from Orchestrator is a bit generic.
            # We assume it contains the necessary keys for script generation.
            # In a real refactor, we'd pass a typed object.

            env_vars = container_config.get("env", {})
            mapping_json = container_config.get("mapping_json", "{}")

            # 3. Generate Script
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

            script_path = integ_dir / "main.py"
            with open(script_path, "w") as f:
                f.write(script_content)

            # 4. Allocate Port
            port = self._get_next_port()
            self._ports[integration_id] = port

            # 5. Start Process
            log_file = open(integ_dir / "stdout.log", "w")
            err_file = open(integ_dir / "stderr.log", "w")

            env = os.environ.copy()
            env["PORT"] = str(port)

            process = subprocess.Popen(
                [self.python_executable, "main.py"],
                cwd=str(integ_dir),
                stdout=log_file,
                stderr=err_file,
                env=env,
                # start_new_session=True # Detach? For now keep attached to parent for cleanup
            )

            self._processes[integration_id] = process

            # Check if it crashes immediately
            await asyncio.sleep(2)
            if process.poll() is not None:
                raise RuntimeError(
                    f"Process crashed immediately. Check {integ_dir}/stderr.log"
                )

            return {
                "status": "success",
                "deployment_mode": "local_process",
                "container_id": str(process.pid),  # Using PID as container ID
                "service_url": f"http://localhost:{port}",
                "directory": str(integ_dir),
            }

        except Exception as e:
            logger.error("Local process deployment failed", error=str(e))
            return {"status": "failed", "error": str(e)}

    async def update(
        self, container_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Restart process with new config."""
        # For MVP: Stop and Redeploy
        # container_id is actually integration_id in this context??
        # Base class says destroy(container_id) but update usually implies integration context.
        # Let's assume integration_id is passed as container_id for mapping simplicity in this custom implementation

        # NOTE: This signature matches base.py which uses container_id
        # We need to find the integration_id associated with this PID or just assume we track by integration_id
        return {"status": "not_implemented_yet"}

    async def destroy(self, integration_id: str) -> Dict[str, Any]:
        """Stop process and cleanup."""
        if integration_id in self._processes:
            proc = self._processes[integration_id]
            logger.info(f"Stopping process {proc.pid}")
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

            del self._processes[integration_id]

            # Cleanup dir? optionally
            # shutil.rmtree(self.base_dir / integration_id)

            return {"status": "success"}
        return {"status": "not_found"}

    async def get_status(self, integration_id: str) -> Dict[str, Any]:
        """Check process status."""
        if integration_id in self._processes:
            proc = self._processes[integration_id]
            return_code = proc.poll()

            status = "running" if return_code is None else "stopped"

            return {
                "container_id": str(proc.pid),
                "status": status,
                "exit_code": return_code,
            }
        return {"status": "unknown"}

    async def get_logs(self, integration_id: str, lines: int = 100) -> str:
        """Read stdout/stderr logs."""
        log_path = self.base_dir / integration_id / "stderr.log"
        if log_path.exists():
            with open(log_path, "r") as f:
                return f.read()[-2000:]  # Last 2000 chars
        return "No logs found."

    def _get_next_port(self) -> int:
        """Simple auto-increment port allocator"""
        p = self._next_port
        self._next_port += 1
        return p
