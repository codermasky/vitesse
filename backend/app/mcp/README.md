# Vitesse MCP Server

This directory contains the implementation of the Model Context Protocol (MCP) server for Vitesse.
It exposes Vitesse Integrations as MCP tools, allowing AI agents (like Claude) to interact with them naturally.

## Architecture

- **`server.py`**: The main server implementation using `mcp` library.
- **`wrapper.py`**: A wrapper around `Integration` models that converts API specifications into MCP Tools.
- **`main.py`**: The CLI entry point to run the server.

## Usage

To run the MCP server for a specific integration, use the `app.mcp.main` module:

```bash
python -m app.mcp.main --integration-id <INTEGRATION_UUID>
```

This will start an MCP server over `stdio`, which can be composed into any MCP client (like Claude Desktop).

## Configuration

The server relies on the standard Vitesse environment variables (DB connection, etc.). Ensure `.env` is loaded or variables are set.

## Tools

The server automatically exposes:
- `get_status`: Returns the status of the integration.
- Dynamic tools based on the `source_api_spec` of the integration (e.g., `get_users`, `post_orders`).
