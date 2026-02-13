import logging
from typing import List, Optional, Any, Dict
from mcp.server import Server
from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
import mcp.types as types

logger = logging.getLogger(__name__)


import asyncio
import logging
from typing import List, Optional, Any, Dict
from mcp.server.fastmcp import FastMCP
from app.mcp.wrapper import VitesseIntegrationWrapper

logger = logging.getLogger(__name__)


class VitesseMCPServer:
    """
    MCP Server implementation for Vitesse Integrations.
    """

    def __init__(self, integration_id: str):
        self.wrapper = VitesseIntegrationWrapper(integration_id)
        # Initialize FastMCP
        self.mcp = FastMCP(f"Vitesse Integration {integration_id}")

        # Register tools dynamically
        # Since FastMCP uses decorators, we might need a dynamic approach
        # or fall back to the lower-level Server class if FastMCP assumes static tools.
        # For this implementation, let's use the lower-level Server approach for dynamic tools.

    async def run_stdio(self):
        """Run the server using stdio transport."""
        from mcp.server import Server
        from mcp.server.stdio import stdio_server
        import mcp.types as types

        server = Server("vitesse-mcp")

        # Load integration data
        await self.wrapper.load()

        @server.list_tools()
        async def handle_list_tools() -> List[types.Tool]:
            return self.wrapper.list_tools()

        @server.call_tool()
        async def handle_call_tool(
            name: str, arguments: Any
        ) -> List[types.TextContent | types.ImageContent | types.EmbeddedResource]:
            return await self.wrapper.call_tool(name, arguments)

        # Run stdio loop
        async with stdio_server() as (read, write):
            await server.run(
                read_stream=read,
                write_stream=write,
                initialization_options=server.create_initialization_options(),
            )
