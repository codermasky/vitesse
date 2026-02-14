# Vitesse AI - Quick Start (5 Minutes)

## 🚀 Quick Start - Multi-Step Integration Workflow

Vitesse AI now uses a **5-step sequential workflow** for creating integrations with full transparency and control.

### Prerequisites
```bash
python3 --version    # Should be 3.12+
docker --version     # Docker required
node --version       # Should be 18+
```

---

## ⚡ 60-Second Demo: Create Your First Integration

### Step 0: Backend & Frontend

**Terminal 1 - Backend** (port 9001):
```bash
cd /Users/sujitm/Sandbox/vitesse
docker compose up -d backend
sleep 5
curl -s http://localhost:9001/api/v1/vitesse/status | jq .status
```

**Terminal 2 - Frontend** (port 5173):
```bash
cd /Users/sujitm/Sandbox/vitesse/frontend
npm install
npm run dev
```

### Step 1️⃣ DISCOVER APIs

```bash
# Search for APIs
curl -s "http://localhost:9001/api/v1/vitesse/discover?query=Salesforce&limit=5" | jq
```

Returns API candidates with confidence scores.

### Step 2️⃣ CREATE Integration (from discoveries)

```bash
INTEGRATION_ID=$(curl -s -X POST http://localhost:9001/api/v1/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Salesforce to HubSpot",
    "source_discovery": {
      "api_name": "Salesforce",
      "base_url": "https://api.salesforce.com",
      "documentation_url": "https://salesforce.com",
      "confidence_score": 0.95,
      "source": "catalog"
    },
    "dest_discovery": {
      "api_name": "HubSpot",
      "base_url": "https://api.hubspot.com",
      "documentation_url": "https://hubspot.com",
      "confidence_score": 0.95,
      "source": "catalog"
    },
    "user_intent": "Sync contacts",
    "deployment_target": "local"
  }' | jq -r '.integration_id')

echo "Integration ID: $INTEGRATION_ID"
```

**Status**: `DISCOVERING`

### Step 3️⃣ INGEST API Specs

```bash
curl -s -X POST "http://localhost:9001/api/v1/vitesse/integrations/$INTEGRATION_ID/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "source_spec_url": "https://salesforce.com/swagger.json",
    "dest_spec_url": "https://hubspot.com/swagger.json"
  }' | jq '.current_step'

# Output: "MAPPING"
```

**Status**: `MAPPING` (API specs fetched)

### Step 4️⃣ MAP Fields

```bash
curl -s -X POST "http://localhost:9001/api/v1/vitesse/integrations/$INTEGRATION_ID/map" \
  -H "Content-Type: application/json" \
  -d '{
    "source_endpoint": "/customers",
    "dest_endpoint": "/contacts"
  }' | jq '.current_step'

# Output: "TESTING"
```

**Status**: `TESTING` (Field mappings generated)

### Step 5️⃣ TEST Integration

```bash
curl -s -X POST "http://localhost:9001/api/v1/vitesse/integrations/$INTEGRATION_ID/test" \
  -H "Content-Type: application/json" \
  -d '{
    "test_sample_size": 5,
    "skip_destructive": true
  }' | jq '.data.health_score'

# Output: { "overall": 85, "data_quality": 90, "reliability": 80 }
```

**Status**: `DEPLOYING` (Tests passed, health_score >= 70)

### Step 6️⃣ DEPLOY Integration

```bash
curl -s -X POST "http://localhost:9001/api/v1/vitesse/integrations/$INTEGRATION_ID/deploy" \
  -H "Content-Type: application/json" \
  -d '{
    "replicas": 1,
    "memory_mb": 512,
    "cpu_cores": 0.5
  }' | jq '.data'

# Output shows: container_id, service_url, deployment_time_seconds
```

**Status**: `ACTIVE` ✅

### Step 7️⃣ Check Status

```bash
curl -s "http://localhost:9001/api/v1/vitesse/integrations/$INTEGRATION_ID" | jq

# Integration is now ACTIVE and ready to use!
```

---

## 📖 Full Documentation

- **[Multi-Step Workflow Guide](./docs/multi_step_workflow.md)** - Complete step-by-step tutorial
- **[API Endpoints](./docs/api_endpoints.md)** - All endpoints with examples
- **[Architecture Design](./docs/architecture_design.md)** - System design
- **[Implementation Guide](./docs/implementation_guide.md)** - Developer reference

---

## 🐳 Docker Compose

### Start All Services

```bash
# Start everything
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Stop everything
docker compose down
```

### Services

- **Backend** (FastAPI): http://localhost:9001
  - API: http://localhost:9001/api/v1/vitesse/
  - Swagger: http://localhost:9001/docs
- **Frontend** (React): http://localhost:5173
- **PostgreSQL**: localhost:5432
- **Traefik**: http://localhost:8080

---

## 🧪 Enhanced Testing

### Run Integration Tests

```bash
chmod +x test_vitesse.sh
./test_vitesse.sh
```

Tests the entire multi-step workflow end-to-end.

### Manual API Test

```bash
# 1. Discover APIs
curl -s "http://localhost:9001/api/v1/vitesse/discover?query=Stripe" | jq

# 2-7. Create and deploy (see above workflow)
```

---

## 🎯 Common Tasks

### List All Integrations
```bash
curl -s http://localhost:9001/api/v1/vitesse/integrations | jq '.data[] | {id, name, status}'
```

### Delete an Integration
```bash
curl -X DELETE "http://localhost:9001/api/v1/vitesse/integrations/$INTEGRATION_ID"
```

### View System Status
```bash
curl -s http://localhost:9001/api/v1/vitesse/status | jq
```

### Monitor Logs
```bash
# Backend logs
docker compose logs -f backend | grep -E "Creating integration|Ingesting|Mapping|Testing|Deploying|ACTIVE"

# View just errors
docker compose logs -f backend | grep ERROR
```

---

## 🛠️ Troubleshooting

### Backend won't start
```bash
# Check if port 9001 is in use
lsof -i :9001

# Check Docker daemon
docker ps

# Restart services
docker compose restart backend
```

### Frontend connection refused
```bash
# Ensure backend is running
curl -s http://localhost:9001/api/v1/vitesse/status | jq .

# Clear frontend cache
rm -rf frontend/.vite
npm run dev
```

### Integration creation fails at step X
```bash
# Check logs for that step
docker compose logs backend | grep -E "Step|ERROR|Ingestor|Mapper|Guardian|Deployer"

# Retry the failed step (idempotent)
curl -X POST "http://localhost:9001/api/v1/vitesse/integrations/$ID/ingest" ...
```

---

## 📚 Next Steps

1. **Explore the [Multi-Step Workflow Guide](./docs/multi_step_workflow.md)** for detailed step explanations
2. **Review [API Examples](./docs/examples.md)** for real-world use cases
3. **Check [Architecture](./docs/architecture_design.md)** to understand how it works
4. **Read [Deployment Guide](./docs/deployment.md)** for production setup

---

## 💡 Key Concepts

**5-Step Workflow**:
1. **CREATE** (DISCOVERING) - Create integration from discovered APIs
2. **INGEST** (MAPPING) - Fetch detailed API specs
3. **MAP** (TESTING) - Generate semantic field mappings
4. **TEST** (DEPLOYING) - Validate with synthetic tests  
5. **DEPLOY** (ACTIVE) - Deploy to target environment

**Health Score**:
- Calculated in Step 4 (TEST)
- Formula: `(success_rate * 0.7) + (endpoint_coverage * 0.3)`
- Passing: >= 70 (allows deployment)
- Failing: < 70 (requires review and remapping)

**Deployment Targets**:
- `local` - Docker container on VPS
- `cloud_eks` - Kubernetes on AWS EKS
- `cloud_ecs` - AWS Fargate/ECS

---

**Happy integrating! 🚀**

---

## 🎯 What You Can Test Right Now

| Feature | URL | Expected |
|---------|-----|----------|
| **Swagger UI** | http://localhost:8000/docs | API browser |
| **ReDoc** | http://localhost:8000/redoc | API documentation |
| **Frontend** | http://localhost:5173 | Login page |
| **Health** | http://localhost:8000/health | `{"status":"healthy"}` |

### New UI Features (Database-Backed)

| Feature | URL Path | Description |
|---------|----------|-------------|
| **Knowledge Harvester Dashboard** | `/harvest-jobs` | Monitor autonomous knowledge harvesting |
| **Agent Collaboration Hub** | `/agent-collaboration` | Real-time agent activity and communication |
| **Integration Builder** | `/integration-builder` | Visual integration creation and mapping |

---

## 🧬 Architecture at a Glance

```
Frontend    →  Backend    →  Database
(React)        (FastAPI)     (PostgreSQL)
:5173          :8000         

Within Backend:
┌─────────────────────────────┐
│ API Routes (auth, chat, ...) │
├─────────────────────────────┤
│ Services (LLM, chat, email) │
├─────────────────────────────┤
│ Agent Factory (4 agents)      │
│ - Ingestor (parse APIs)       │
│ - Mapper (field mapping)      │
│ - Guardian (testing)          │
│ - Orchestrator (pipeline)     │
├─────────────────────────────┤
│ Database Models               │
└─────────────────────────────┘
```

---

## 🔧 Environment Setup

### `.env` Required Variables

```env
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost/vitesse_db
```

### Optional for Full Features

```env
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...
SENTRY_DSN=https://...
SMTP_SERVER=smtp.gmail.com
```

---

## ⚡ 5-Minute Success Criteria

- [x] Backend starts without errors
- [x] Frontend loads
- [x] Can login via `/docs` 
- [x] Swagger UI shows all endpoints
- [x] Test script passes 80%+ tests

---

## 🚨 Common Issues

**Backend fails to start**
```bash
# Check Python version
python3 --version  # Must be 3.12+

# Reinstall dependencies
uv sync --upgrade
```

**Port 8000 already in use**
```bash
# Find & kill process
lsof -ti:8000 | xargs kill -9
```

**Database connection error**
```bash
# Verify environment variable
grep DATABASE_URL .env

# Test connection directly
psql "YOUR_DATABASE_URL"
```

---

## 📚 Full Documentation

- **[Complete Setup Guide](./VITESSE_COMPLETE_SETUP.md)** - Comprehensive with all tests
- **[Implementation Guide](./docs/implementation_guide.md)** - Technical deep dive
- **[Features List](./docs/features.md)** - All capabilities
- **[API Reference](./docs/api.md)** - Endpoint documentation

---

## 🎯 Main Features to Explore

1. **Authentication** - User registration, login, JWT tokens
2. **LLM Integration** - OpenAI, Anthropic, Ollama
3. **Chat Interface** - Real-time conversation with agents
4. **Knowledge Base** - Upload & search documents
5. **Integration Factory** (⭐ Main) - Orchestrate API integrations automatically
6. **Observability** - Langfuse tracing & cost tracking
7. **Admin Dashboard** - User & system management

---

**Ready?** Start with Terminal 1 above! 🚀
