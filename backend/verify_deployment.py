"""
Verification Script for Vitesse Deployment
Run this script to test the LocalContainerDeployer with a dummy integration.

Usage:
    python verify_deployment.py
"""

import asyncio
import structlog
import logging
from app.deployer.container_deployer import LocalContainerDeployer

# Configure structlog for console output
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()


async def verify():
    logger.info("Starting Deployment Verification")

    # 1. Initialize Deployer
    config = {}
    try:
        deployer = LocalContainerDeployer(config)
    except Exception as e:
        logger.error(f"Failed to initialize deployer: {e}")
        return

    # 2. Define Dummy Integration
    integration_id = "test-verification-01"
    container_config = {
        "source_api_name": "JSONPlaceholder",
        "dest_api_name": "EchoAPI",
        "mapping_json": '{"transformations": [{"source_field": "title", "dest_field": "name", "transform_type": "direct"}]}',
        "env": {
            "SOURCE_API_URL": "https://jsonplaceholder.typicode.com/posts",
            "DEST_API_URL": "https://postman-echo.com/post",
            "SYNC_INTERVAL_SECONDS": "30",
        },
    }

    # 3. Deploy
    logger.info("Deploying test integration...", integration_id=integration_id)
    try:
        result = await deployer.deploy(integration_id, container_config)
        logger.info("Deployment Result", result=result)

        container_id = result.get("container_id")
        if not container_id:
            logger.error("No container ID returned!")
            return

        # 4. Check Status
        await asyncio.sleep(2)  # Wait for container warmup
        status = await deployer.get_status(container_id)
        logger.info("Container Status", status=status)

        # 5. Check Logs
        logs = await deployer.get_logs(container_id, lines=20)
        logger.info("Container Logs (Tail)", logs=logs)

        # 6. Cleanup (Optional - prompt user?)
        # For verification script, we might want to leave it running to check manually
        # But let's clean up to be nice
        logger.info("Cleaning up...")
        await deployer.destroy(container_id)
        logger.info("Cleanup complete")

    except Exception as e:
        logger.error("Verification Failed", error=str(e))


if __name__ == "__main__":
    asyncio.run(verify())
