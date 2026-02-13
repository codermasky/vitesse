# Vitesse AI - Quick Reference Guide

## File Locations & Purpose

### 🎯 Start Here
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - This file! Overview of everything built
- **[README.md](README.md)** - Project elevator pitch and quick start

### 📖 Documentation
- **[docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md)** - Technical deep-dive
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment instructions (Local/VPS/Cloud)
- **[docs/EXAMPLES.md](docs/EXAMPLES.md)** - Real-world example (Shopify → CRM)

---

## 🤖 Agent Components

### Base Classes
**File**: `backend/app/agents/base.py`

```python
class VitesseAgent(ABC)           # Base for all agents
class IngestorAgent(VitesseAgent) # Abstract for Ingestor
class SemanticMapperAgent(VitesseAgent)  # Abstract for Mapper
class GuardianAgent(VitesseAgent) # Abstract for Guardian
class DeployerAgent(VitesseAgent) # Abstract for Deployer
class AgentContext                # Shared execution context
```

### Concrete Implementations

| Agent | File | Purpose | Output |
|---|---|---|---|
| **Ingestor** | `agents/ingestor.py` | API discovery & parsing | `APISpecification` |
| **Mapper** | `agents/mapper.py` | Field mapping generation | `MappingLogic` |
| **Guardian** | `agents/guardian.py` | Integration testing | `HealthScore` |
| **Orchestrator** | `agents/vitesse_orchestrator.py` | Master coordination | `IntegrationInstance` |

---

## 🚀 Deployment Components

### Deployer Classes
**File**: `backend/app/deployer/base.py`

```python
class Deployer(ABC)          # Base interface
class LocalDeployer          # Docker + Traefik (VPS)
class CloudDeployer          # Base for cloud
class EKSDeployer            # AWS Kubernetes
class ECSDeployer            # AWS Fargate
class DeployerFactory        # Factory for creation
```

### Container Templates
**File**: `backend/app/deployer/templates.py`

```python
DockerfileGenerator.generate_base_dockerfile()
DockerfileGenerator.generate_integration_app_template()
DockerfileGenerator.generate_requirements_txt()
DockerfileGenerator.generate_kubernetes_manifest()
```

---

## 💾 Data Models

### Pydantic Schemas (Validation)
**File**: `backend/app/schemas/integration.py`

```python
class APIEndpoint
class APISpecification        # Discovered API spec
class DataTransformation      # Single transformation rule
class MappingLogic            # Complete mapping
class TestResult              # Test execution result
class HealthScore             # Integration health
class IntegrationInstance     # Full integration object
```

### SQLAlchemy Models (Database)
**File**: `backend/app/models/integration.py`

```python
class Integration             # Core table
class Transformation          # Transformation rules
class TestResult              # Test history
class IntegrationAuditLog     # Audit trail
class DeploymentLog           # Deployment history
```

---

## 🔌 API Endpoints

**File**: `backend/app/api/endpoints/integrations.py`

### Main Operations

```
POST   /api/v1/vitesse/integrations              # Create (discover → map → test)
GET    /api/v1/vitesse/integrations/{id}         # Get status
PUT    /api/v1/vitesse/integrations/{id}         # Update
DELETE /api/v1/vitesse/integrations/{id}         # Delete
POST   /api/v1/vitesse/integrations/{id}/sync    # Manual sync
```

### System Operations

```
GET    /api/v1/vitesse/status                    # System status
GET    /api/v1/vitesse/integrations              # List all
POST   /api/v1/vitesse/test-endpoint             # Test connectivity
```

---

## 🔄 Integration Flow

```
1. User provides source & dest API URLs
        ↓
2. POST /api/v1/vitesse/integrations
        ↓
3. VitesseOrchestrator.create_integration()
        ↓
4. INGESTOR: Parse both APIs → APISpecification
        ↓
5. MAPPER: Generate transformations → MappingLogic
        ↓
6. GUARDIAN: Run 100+ tests → HealthScore
        ↓
7. If health_score >= 70:
        SUCCESS → IntegrationInstance with status=ACTIVE
   Else:
        FAILURE → status=FAILED, requires review
```

---

## 🗄️ Database Schema

### integrations
- `id` (PK): UUID
- `name`: string
- `status`: enum (initializing, discovering, mapping, testing, deploying, active, failed, updating, paused)
- `source_api_spec`: JSON
- `dest_api_spec`: JSON
- `mapping_logic`: JSON (nullable)
- `deployment_config`: JSON
- `container_id`: string (nullable)
- `health_score`: JSON (nullable)
- `error_log`: text (nullable)
- `created_by`: string
- `created_at`: timestamp
- `updated_at`: timestamp
- `metadata`: JSON

### transformations
- `id` (PK): UUID
- `integration_id` (FK)
- `source_field`: string
- `dest_field`: string
- `transform_type`: enum (direct, mapping, parse, stringify, parse_bool, collect, custom)
- `transform_config`: JSON

### test_results
- `id` (PK): UUID
- `integration_id` (FK)
- `test_id`: string
- `endpoint`: string
- `method`: enum (GET, POST, PUT, DELETE, PATCH)
- `status_code`: int
- `response_time_ms`: float
- `success`: boolean
- `error_message`: text (nullable)
- `created_at`: timestamp

### integration_audit_logs
- `id` (PK): UUID
- `integration_id` (FK)
- `action`: string (created, updated, tested, deployed, destroyed)
- `actor`: string (user_id or "system")
- `status`: enum (success, failed, partial)
- `details`: JSON
- `created_at`: timestamp

### deployment_logs
- `id` (PK): UUID
- `integration_id` (FK)
- `deployment_target`: enum (local, eks, ecs)
- `status`: enum (pending, in_progress, success, failed)
- `container_id`: string (nullable)
- `image_uri`: string (nullable)
- `deployment_config`: JSON
- `logs`: text (nullable)
- `error_message`: text (nullable)
- `started_at`: timestamp
- `completed_at`: timestamp (nullable)

---

## 🔑 Key Classes & Methods

### VitesseOrchestrator
```python
async create_integration(         # Create full integration
    source_api_url: str,
    source_api_name: str,
    dest_api_url: str,
    dest_api_name: str,
    user_intent: str,
    deployment_config: DeploymentConfig,
    created_by: str,
    ...
) → Dict[str, Any]

get_orchestrator_status() → Dict  # Get agent metrics
```

### Ingestor
```python
async _execute(context, input_data) → Dict
# Returns: {
#   "status": "success|failed",
#   "api_spec": APISpecification,
#   "endpoints_count": int,
#   "auth_type": str
# }
```

### Mapper
```python
async _execute(context, input_data) → Dict
# Returns: {
#   "status": "success|failed",
#   "mapping_logic": MappingLogic,
#   "transformation_count": int,
#   "complexity_score": float
# }
```

### Guardian
```python
async _execute(context, input_data) → Dict
# Returns: {
#   "status": "success|failed",
#   "health_score": HealthScore,
#   "test_count": int,
#   "success_rate": float,
#   "critical_issues": List[str]
# }
```

---

## 📝 Configuration

### Environment Variables
- `SECRET_KEY` - App secret
- `POSTGRES_SERVER` - DB host
- `POSTGRES_USER` - DB user
- `POSTGRES_PASSWORD` - DB password
- `POSTGRES_DB` - DB name

### Vitesse-Specific
- `DEPLOYMENT_TARGET` - "local", "eks", or "ecs"
- `BATCH_SIZE` - Records per sync (default 100)
- `SYNC_INTERVAL_SECONDS` - Schedule (default 3600)
- `AWS_REGION` - For cloud deployments
- `ECR_REGISTRY_URL` - Container registry

---

## 🧪 Testing Flow

Guardian runs 100 shadow calls:

```
For test_count (default 100):
  1. Generate synthetic data matching source schema
  2. Calls source API (GET) with synthetic data
  3. Calls destination API (POST) with synthetic data
  4. Track: status_code, response_time_ms, success
  5. Detect issues:
     - 401 → Auth failure
     - 429 → Rate limit
     - 400 → Schema mismatch
     - Other → Connectivity issue

Results aggregated into HealthScore:
  - success_rate = (passed tests / total tests) * 100
  - overall_score = (success_rate * 0.7) + (coverage * 0.3)
  - Threshold: 70/100 required
```

---

## 🚀 Deployment Decision Tree

```
User runs: POST /api/v1/vitesse/integrations
                  ↓
     VitesseOrchestrator.create_integration()
                  ↓
         4-Step Agent Pipeline
         (Ingest → Map → Test → Result)
                  ↓
      Health Score >= 70 ?
        ↙                  ↘
      YES                   NO
       ↓                    ↓
   CREATE                 FAILED
   Container              (Manual
   with                   review)
   DeployerFactory
       ↓
   Select Target
    ↙   ┃   ↖
LOCAL  EKS  ECS
  ↓     ↓    ↓
 Docker Kubernetes Fargate
 +      +      +
Traefik ECR    ECR
```

---

## 📊 Status Codes

### Integration Status
- `initializing` - Creating, setting up
- `discovering` - Ingestor running
- `mapping` - Mapper generating rules
- `testing` - Guardian testing
- `deploying` - Container being deployed
- `active` - ✅ Running and ready
- `updating` - Configuration updated
- `failed` - ❌ Requires intervention
- `paused` - Manually paused

### Test Success Criteria
- `200-299` - Success ✅
- `400` - Client error (likely schema mismatch)
- `401` - Auth failure
- `429` - Rate limit
- `5xx` - Server error
- Timeout - Connection error

---

## 💡 Common Tasks

### Create a test integration
```bash
curl -X POST http://localhost:8003/api/v1/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "source_api_url": "https://petstore.swagger.io/v2/swagger.json",
    "source_api_name": "Petstore",
    "dest_api_url": "https://jsonplaceholder.typicode.com",
    "dest_api_name": "JSONPlaceholder",
    "user_intent": "Sync pets to todos"
  }'
```

### Check integration status
```bash
curl http://localhost:8003/api/v1/vitesse/integrations/{integration_id}
```

### Trigger manual sync
```bash
curl -X POST http://localhost:8003/api/v1/vitesse/integrations/{integration_id}/sync
```

### View API docs
```
http://localhost:8003/docs
```

---

## 🎯 Extension Points

### Add Custom Transform Type
1. Update `DataTransformation.transform_type` enum
2. Add logic in `SemanticMapperAgent._determine_transform_type()`
3. Implement in integration runtime (generated main.py)

### Add New Deployment Target
1. Create `class MyDeployer(Deployer)` in `deployer/base.py`
2. Implement required methods
3. Register in `DeployerFactory.create_deployer()`

### Add New Auth Type
1. Update `APIAuthType` enum in `schemas/integration.py`
2. Add detection in `VitesseIngestor._extract_auth()`
3. Update deployment templates for secret handling

---

## 📞 Support Resources

| Question | Resource |
|---|---|
| How does architecture work? | IMPLEMENTATION_GUIDE.md |
| How do I deploy? | DEPLOYMENT.md |
| Show me an example | EXAMPLES.md |
| What's in that file? | Look for docstrings in code |
| API reference | /docs (FastAPI Swagger UI) |

---

## ✅ Checklist: First Time Setup

- [ ] Read PROJECT_SUMMARY.md (this file)
- [ ] Read docs/IMPLEMENTATION_GUIDE.md
- [ ] Run local development setup
- [ ] Create test integration (Petstore)
- [ ] Check health score
- [ ] Review EXAMPLES.md (Shopify example)
- [ ] Try deployment to VPS (docs/DEPLOYMENT.md)
- [ ] Set up AWS account for cloud
- [ ] Deploy to EKS/ECS
- [ ] Set up monitoring and alerts

---

**You're ready to build integrations with Vitesse AI! 🚀**
