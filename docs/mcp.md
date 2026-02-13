# Model Context Protocol (MCP) Integration

Vitesse AI implements the Model Context Protocol (MCP) to enable AI agents (like Claude Desktop) to directly discover and interact with your integrated APIs.

## Overview

The Vitesse MCP Server exposes your `Integration` objects as MCP Tools. This means that once an integration is defined in Vitesse (via the Ingestor Agent), it becomes immediately accessible to any MCP-compliant client.

### Architecture

- **Server**: A python-based MCP server running on `stdio` transport.
- **Wrapper**: `VitesseIntegrationWrapper` dynamically converts Vitesse `APISpecification` objects into MCP `ListTools` and `CallTool` responses.
- **Client**: Any MCP client (Claude Desktop, etc.) can connect to this server.

## Usage

### 1. Prerequisite
Ensure you have a running Vitesse instance (or at least the database is accessible).

### 2. Running via CLI
You can run the MCP server for a specific integration ID using the command line:

```bash
cd backend
python -m app.mcp.main --integration-id <YOUR_INTEGRATION_UUID>
```

This command starts the server and waits for JSON-RPC messages on `stdin`.

### 3. Configuring Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vitesse-integration-1": {
      "command": "docker",
      "args": [
        "compose",
        "exec",
        "-i",
        "backend",
        "python",
        "-m",
        "app.mcp.main",
        "--integration-id",
        "<YOUR_INTEGRATION_UUID>"
      ]
    }
  }
}
```
*Note: This configuration assumes you are running Vitesse via Docker Compose.*

## Verification

We provide a verification script to test the MCP server without a full client setup.

```bash
docker compose exec backend python verify_mcp.py
```
This script:
1. Seeds a test integration if none exists.
2. Connects to the MCP server via `stdio`.
3. Lists available tools.
4. Executes a test call to `get_status`.

## Supported Features

- **Dynamic Tool Discovery**: Endpoints defined in the `source_api_spec` are automatically exposed as tools (e.g., `get_users`, `post_orders`).
- **Authentication**: Usage of Vitesse's stored credentials (via Guardian/Integration config) is planned for the next phase. Currently, the MCP server provides the interface but may need explicit auth handling for shadow calls.

