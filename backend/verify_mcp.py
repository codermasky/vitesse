import asyncio
import sys
from mcp.client.stdio import stdio_client
from mcp.client.session import ClientSession
from mcp.types import ClientRequest, CallToolRequest
from mcp.client.stdio import StdioServerParameters


async def run_verification():
    # We need a valid integration ID. For testing, we might need to query one or use a dummy.
    # Let's try to query one first via direct DB access, or just let 'main.py' fail gracefully if not found.
    # But for a robust test, we want to succeed.

    # Prerequisite: ensure we have at least one integration in DB.
    # We can rely on the fact that existing tests/seeding might have created one,
    # or we can just fail if none exists.

    from app.db.session import async_session_factory
    from app.models.integration import Integration
    from sqlalchemy import select

    integration_id = None
    async with async_session_factory() as db:
        result = await db.execute(select(Integration).limit(1))
        integration = result.scalars().first()
        if integration:
            integration_id = integration.id
            print(f"Found Integration ID: {integration_id}")
        else:
            print("No integration found. Seeding test integration...")
            from app.models.integration import (
                IntegrationStatusEnum,
                DeploymentTargetEnum,
            )
            import uuid

            test_id = str(uuid.uuid4())
            new_integration = Integration(
                id=test_id,
                name="MCP Test Integration",
                status=IntegrationStatusEnum.ACTIVE,
                source_api_spec={
                    "base_url": "https://api.example.com",
                    "endpoints": [
                        {
                            "path": "/users",
                            "method": "GET",
                            "description": "List users",
                        },
                        {
                            "path": "/users",
                            "method": "POST",
                            "description": "Create user",
                        },
                    ],
                },
                dest_api_spec={"base_url": "https://api.dest.com"},
                deployment_config={},
                deployment_target=DeploymentTargetEnum.LOCAL,
                created_by="system",
            )
            db.add(new_integration)
            await db.commit()
            integration_id = test_id
            print(f"Seeded Integration ID: {integration_id}")

    server_params = StdioServerParameters(
        command="python",
        args=["-m", "app.mcp.main", "--integration-id", str(integration_id)],
        env=None,
    )

    print("\nStarting MCP Client Session...")

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("✅ MCP Session Initialized")

            # List Tools
            tools = await session.list_tools()
            print(f"✅ Listed {len(tools.tools)} tools")

            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")

            # Call 'get_status' tool if available
            status_tool = next((t for t in tools.tools if t.name == "get_status"), None)
            if status_tool:
                print("\nCalling 'get_status'...")
                result = await session.call_tool("get_status", {})
                print(f"✅ Call Result: {result.content}")
            else:
                print("❌ 'get_status' tool not found")


if __name__ == "__main__":
    asyncio.run(run_verification())
