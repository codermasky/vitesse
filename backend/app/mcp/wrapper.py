import logging
from typing import List, Dict, Any, Optional
from app.db.session import async_session_factory
from app.models.integration import Integration
from app.schemas.integration import APISpecification, IntegrationStatus
from sqlalchemy import select
from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
import httpx

logger = logging.getLogger(__name__)


class VitesseIntegrationWrapper:
    """
    Wraps a Vitesse Integration to expose it as a set of MCP Tools.
    """

    def __init__(self, integration_id: str):
        self.integration_id = integration_id
        self.integration: Optional[Integration] = None

    async def load(self):
        """Load integration details from database."""
        async with async_session_factory() as db:
            result = await db.execute(
                select(Integration).where(Integration.id == self.integration_id)
            )
            self.integration = result.scalars().first()

        if not self.integration:
            raise ValueError(f"Integration {self.integration_id} not found")

    def list_tools(self) -> List[Tool]:
        """Convert integration endpoints to MCP Tools."""
        if not self.integration:
            return []

        tools = []

        # Add basic management tools
        tools.append(
            Tool(
                name="get_status",
                description=f"Get the status of integration {self.integration.name}",
                inputSchema={"type": "object", "properties": {}},
            )
        )

        # Add tools from Source API Spec
        source_spec = self.integration.source_api_spec
        if source_spec and isinstance(source_spec, dict):
            # Handle dict or Pydantic model
            endpoints = source_spec.get("endpoints", [])

            for ep in endpoints:
                # endpoint logic to tool conversion
                path = ep.get("path") if isinstance(ep, dict) else ep.path
                method = ep.get("method") if isinstance(ep, dict) else ep.method
                desc = ep.get("description") if isinstance(ep, dict) else ep.description

                tool_name = f"{method.lower()}_{path.replace('/', '_').strip('_')}"

                tools.append(
                    Tool(
                        name=tool_name,
                        description=desc or f"Call {method} {path}",
                        inputSchema={
                            "type": "object",
                            "properties": {
                                "params": {
                                    "type": "object",
                                    "description": "Query/Path parameters",
                                },
                                "body": {
                                    "type": "object",
                                    "description": "Request body",
                                },
                            },
                        },
                    )
                )

        return tools

    async def call_tool(self, name: str, arguments: dict) -> List[TextContent]:
        """Execute the tool."""
        if name == "get_status":
            return [TextContent(type="text", text=f"Status: {self.integration.status}")]

        # TODO: Implement generic API call forwarding
        return [TextContent(type="text", text=f"Executed {name}")]
