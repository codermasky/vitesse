# Vitesse AI API Reference

Vitesse AI provides a RESTful API for managing users, LLM configurations, agent workflows, and knowledge base documents.

## 🔑 Authentication
Most endpoints require a valid JWT bearer token.
- **Base URL**: `http://localhost:8000/api/v1`
- **Header**: `Authorization: Bearer <your-token>`

## 📌 Core Endpoints

### 👤 Authentication & Users
- `POST /auth/login`: Authenticate and receive a JWT.
- `GET /users/me`: Retrieve current user profile.
- `PUT /users/me`: Update user information.

### 🤖 LLM Configuration
- `GET /system/llm-configs/`: Retrieve all providers and agent mappings.
- `POST /system/llm-configs/providers`: Create a new LLM provider.
- `PUT /system/llm-configs/providers/{id}`: Update provider settings.
- `POST /system/llm-configs/mappings`: Update agent-to-model mappings.

### 🔄 Queue & Recovery
- `GET /queue/`: List all asynchronous requests and their status.
- `GET /queue/{id}`: Retrieve detailed status of a specific request.
- `GET /recovery/status`: Check system health and interrupted tasks.

### 📚 Knowledge Base
- `GET /knowledge/`: List all documents in the knowledge base.
- `POST /knowledge/upload`: Upload a new document for processing.
- `DELETE /knowledge/{id}`: Remove a document from the system.

### 🧪 Agents & Workflows
- `GET /agents/`: List all available agents and their capabilities.
- `POST /agents/execute/{agent_id}`: Trigger a specific agent behavior.

## 📡 WebSocket Live Feed
For real-time updates on agent progress, connect to our WebSocket endpoint:
- **URL**: `ws://localhost:8000/ws/agent-feed/{request_id}`

## 📖 Documentation & OpenAPI
A full OpenAPI specification and interactive Swagger UI are available at:
- `http://localhost:8000/docs`
