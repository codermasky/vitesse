import asyncio
import argparse
import logging
import sys
from app.mcp.server import VitesseMCPServer

# Configure logging
# For MCP via stdio, we must ensure logs don't contaminate stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)

logger = logging.getLogger(__name__)


async def main():
    parser = argparse.ArgumentParser(description="Run Vitesse MCP Server")
    parser.add_argument(
        "--integration-id", required=True, help="ID of the integration to serve"
    )

    args = parser.parse_args()

    logger.info(f"Starting MCP Server for Integration ID: {args.integration_id}")

    try:
        server = VitesseMCPServer(integration_id=args.integration_id)
        await server.run_stdio()
    except Exception as e:
        logger.error(f"Server failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
