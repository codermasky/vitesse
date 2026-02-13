# Vitesse AI - High-Velocity Integration Factory

*Autonomous Integration Factory*

**Vitesse AI** is an autonomous integration factory that automates end-to-end third-party business integrations using agentic orchestration. It transforms months-long integration engineering cycles into days.

## 🎯 Mission
Design a system where a user provides an API URL, and Vitesse AI delivers a live, containerized integration in **minutes**.

## 🏗️ Core Architecture

### The Four-Agent Factory Line

**1. The Ingestor Agent (Discovery)**
- Autonomously parses API endpoints, headers, and authentication logic
- Generates standardized integration specifications
- Input: API Documentation URL or Swagger/OpenAPI spec
- Output: Ready-to-deploy integration module

**2. The Semantic Mapper (Logic)**
- Maps source data to destination schemas using semantic reasoning
- Handles complex transformations (date formatting, data type conversions, name splitting)
- Input: User Intent (e.g., "Sync Shopify customers to Credo CRM")
- Output: Logic-flow configuration file

**3. The Guardian Agent (Quality & Self-Healing)**
- Spins up sandbox environments with synthetic test data
- Runs 100+ shadow calls to verify integration success
- Detects failures and autonomously triggers re-mapping if API schema changes
- Output: Health Score report

**4. The Vitesse Deployer (Pluggable Delivery)**
- **Local Mode**: Docker/Traefik on Ubuntu VPS
- **Cloud Mode**: EKS/ECS with ECR integration
- Configurable via `--target` flag for seamless scaling
- All instances are stateless, using external PostgreSQL (Supabase) for state

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
cp .env.example .env
# Update SECRET_KEY and deployment configuration
uv sync
uv run python -m app.db.init_db
uv run uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Deployment
```bash
# Local VPS deployment
python -m app.deployer.deployer_cli --target local --integration-id <id>

# Cloud deployment
python -m app.deployer.deployer_cli --target cloud --integration-id <id> --cloud-provider eks
```

## 📊 Core Infrastructure

| Layer | Feature | Purpose |
| :--- | :--- | :--- |
| **Agent Factory** | **Ingestor** | API documentation parsing & connector generation |
| | **Semantic Mapper** | Data transformation logic generation |
| | **Guardian** | Testing, validation, self-healing |
| **Orchestration** | **VitesseOrchestrator** | Master orchestration of all agents |
| **Deployment** | **Local Deployer** | Docker/Traefik/VPS deployment |
| | **Cloud Deployer** | EKS/ECS/ECR cloud deployment |
| **Persistence** | **Integration Models** | PostgreSQL schema for integrations |
| | **State Service** | Stateless operations via external DB |
| **Experience** | **Integration Dashboard** | Real-time connector management |
| | **Monitoring** | Health scores, error tracking |

## 🔐 Security & Observability

- **Authentication**: JWT + RBAC (role-based access control)
- **Observability**: Langfuse integration for distributed tracing
- **Rate Limiting**: Built-in request throttling
- **Secret Management**: Environment-based configuration

## 📈 Business Value

- **Velocity**: ⚡ 3 days vs. 3 months traditional cycle
- **Fluency**: 🔄 Auto-adapts to API changes
- **Scale**: 📈 Single config change from VPS to EKS/ECS

## 📝 Development Standards

Follows all Vitesse AI conventions:
- Python 3.12+
- LangChain + LangGraph for workflows
- SQLAlchemy for ORM
- Pydantic for validation
- Structured logging with structlog

## 🤖 Model Context Protocol (MCP)

Vitesse implements the Model Context Protocol (MCP) to allow AI agents (like Claude) to directly interact with integrations.

- **[Read the Full Documentation](docs/mcp.md)**
- **Server**: Exposes integrations as dynamic MCP tools.
- **Verification**: Run `python verify_mcp.py` to test connectivity.

## 🛡️ Guardian Enhancements

The Guardian agent automates quality assurance for your integrations.

- **[Read the Testing Documentation](docs/testing.md)**
- **Auth Injection**: Native support for API Key, Bearer, and Basic Auth.
- **Rate Limiting**: Gentle testing with built-in throttling (5 RPS).
