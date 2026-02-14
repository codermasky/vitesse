# Vitesse AI

*Autonomous Integration Factory*

**Vitesse AI** is an autonomous integration factory that automates end-to-end third-party business integrations using agentic orchestration. It transforms months-long integration engineering cycles into days.

## 🎯 Mission
Design a system where a user provides an API URL, and Vitesse AI delivers a live, containerized integration in **minutes**.

## 🚀 Quick Start

### Creating an Integration (5-Step Workflow)

Vitesse AI implements a **sequential 5-step workflow** for transparent, controllable integration creation:

```
Step 1: CREATE     → POST /integrations (DISCOVERING)
Step 2: INGEST     → POST /integrations/{id}/ingest (MAPPING)
Step 3: MAP        → POST /integrations/{id}/map (TESTING)
Step 4: TEST       → POST /integrations/{id}/test (DEPLOYING)
Step 5: DEPLOY     → POST /integrations/{id}/deploy (ACTIVE)
```

**[👉 Full Multi-Step Workflow Guide →](./docs/multi_step_workflow.md)**

**Example**: Create a Salesforce → HubSpot integration

```bash
# Step 1: Create integration from discovered APIs
curl -X POST http://localhost:9001/api/v1/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Salesforce to HubSpot",
    "source_discovery": {...salesforce discovery...},
    "dest_discovery": {...hubspot discovery...},
    "user_intent": "Sync contacts",
    "deployment_target": "local"
  }'
# Returns: integration_id

# Step 2: Ingest API specifications
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/ingest \
  -d '{"source_spec_url": "...", "dest_spec_url": "..."}'

# Step 3: Generate field mappings
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/map \
  -d '{"source_endpoint": "/customers", "dest_endpoint": "/contacts"}'

# Step 4: Run validation tests
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/test \
  -d '{"test_sample_size": 10}'

# Step 5: Deploy to target
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/deploy \
  -d '{"replicas": 1, "memory_mb": 512}'

# Integration is now ACTIVE and ready for use!
```

---

## 📖 Documentation

- **[Multi-Step Workflow Guide](./docs/multi_step_workflow.md)** - Detailed step-by-step guide
- **[API Endpoints](./docs/api_endpoints.md)** - Complete REST API reference
- **[Architecture Design](./docs/architecture_design.md)** - System architecture & design patterns
- **[Implementation Guide](./docs/implementation_guide.md)** - Developer reference & database schema
- **[Deployment Guide](./docs/deployment.md)** - Production deployment instructions
- **[Testing Guide](./docs/testing.md)** - Integration testing strategies

---

## 🔧 Configuration

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

### Create Your First Integration

1. **Navigate to Integrations**: Open http://localhost:5173/integrations
2. **Click "New Integration"**: Start the discovery wizard
3. **Search for Source API**: e.g., "Shopify", "GitHub", "Stripe"
4. **Select Destination**: Choose a Linedata product (CapitalStream, Longview, Ekip, MFEX)
5. **Configure Intent**: Describe what you want to sync
6. **Let Agents Build**: Vitesse AI will discover, map, test, and deploy automatically

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
| | **Knowledge Harvester Dashboard** | Monitor and manage knowledge harvesting jobs |
| | **Agent Collaboration Hub** | Real-time agent activity and communication monitoring |
| | **Integration Builder** | Visual integration creation and field mapping |

## 🎨 User Interface Features

### Knowledge Harvester Dashboard
Monitor and manage autonomous knowledge harvesting operations:
- **Real-time Job Tracking**: View active, completed, and failed harvesting jobs
- **Progress Monitoring**: Track harvesting progress with detailed metrics
- **Source Management**: Monitor API sources being harvested
- **Performance Analytics**: Success rates, processing times, and error tracking

### Agent Collaboration Hub
Real-time monitoring of multi-agent workflows:
- **Agent Activity Feed**: Live view of all agent activities and status
- **Communication Logs**: Inter-agent message passing and coordination
- **Shared State Management**: Centralized whiteboard for workflow state
- **Performance Metrics**: Individual agent metrics and collaboration scores

### Integration Builder
Visual interface for creating and managing API integrations:
- **Drag-and-Drop Mapping**: Intuitive field mapping between APIs
- **Transformation Rules**: Visual rule builder for data transformations
- **Testing Interface**: Built-in testing tools with real data validation
- **Deployment Management**: One-click deployment to multiple targets
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
