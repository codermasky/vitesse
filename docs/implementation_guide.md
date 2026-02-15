# Vitesse AI - Implementation Guide

## Overview

Vitesse AI is an autonomous integration factory that automates end-to-end third-party business integrations. This guide provides developers with the technical details for understanding, extending, and deploying Vitesse integrations.

## Architecture Deep-Dive

### 1. The Agent Factory (4-Step Pipeline)

#### 1.1 Ingestor Agent (Discovery)
**File**: `app/agents/ingestor.py`

The Ingestor autonomously discovers and documents API specifications:

```python
from app.agents.ingestor import VitesseIngestor
from app.agents.base import AgentContext
from app.services.aether_intel import AetherIntelligenceProvider

context = AgentContext()
intel = AetherIntelligenceProvider()
ingestor = VitesseIngestor(context, intelligence=intel)

result = await ingestor.execute(
    context={...},
    input_data={
        "api_url": "https://api.shopify.com/swagger.json",
        "api_name": "Shopify",
        "auth_details": {"type": "oauth2", "...": "..."}
    }
)

# Result contains:
# - api_spec: APISpecification (standardized schema)
# - endpoints_count: int
# - auth_type: str
```

**What it does**:
- Fetches OpenAPI/Swagger documentation
- Parses all endpoints, methods, parameters
- Extracts authentication requirements
- Detects pagination patterns
- Returns machine-readable APISpecification

**Key methods**:
- `_fetch_spec()`: Retrieves API docs from URL
- `_parse_openapi_spec()`: Parses JSON schema
- `_extract_endpoints()`: Lists all API endpoints
- `_extract_auth()`: Detects auth method
- `_detect_pagination()`: Identifies pagination style

**Handling APIs without public OpenAPI specs**:

Some APIs (like CoinGecko) don't expose OpenAPI/Swagger documentation at standard paths. In these cases, you can provide a direct `spec_url` parameter:

```python
# If CoinGecko spec is available at a specific URL:
result = await ingestor.execute(
    context={...},
    input_data={
        "api_url": "https://api.coingecko.com/api/v3",
        "api_name": "CoinGecko",
        "spec_url": "https://api.coingecko.com/swagger.json",  # Direct spec URL
        "auth_details": {}
    }
)
```

**Common OpenAPI spec locations**:
- `https://api.example.com/swagger.json` - Swagger 2.0
- `https://api.example.com/openapi.json` - OpenAPI 3.0
- `https://api.example.com/api-docs` - Some APIs use this
- `https://apis.guru/` - Third-party spec repository

If an API doesn't publish its spec publicly, you may need to:
1. Check the API provider's documentation for a spec URL
2. Look in the `apis.guru` repository
3. Manually create or find a community-maintained spec

---

#### 1.2 Semantic Mapper Agent (Logic)
**File**: `app/agents/mapper.py`

Generates intelligent field mappings between two APIs:

```python
from app.agents.mapper import VitesseMapper
from app.services.aether_intel import AetherIntelligenceProvider

intel = AetherIntelligenceProvider()
mapper = VitesseMapper(context, intelligence=intel)

result = await mapper.execute(
    context={...},
    input_data={
        "source_api_spec": source_spec,
        "dest_api_spec": dest_spec,
        "user_intent": "Sync Shopify customers to Credo CRM",
        "source_endpoint": "/customers",
        "dest_endpoint": "/contacts"
    }
)

# Result contains:
# - mapping_logic: MappingLogic with transformations
# - transformation_count: int
# - complexity_score: float (1-10)
```

**Transformation types**:
- `direct`: Source type == Dest type (e.g., string → string)
- `mapping`: Semantic name mapping (e.g., "first_name" → "given_name")
- `parse`: String → numeric conversion
- `stringify`: Numeric → string conversion
- `parse_bool`: String → boolean
- `collect`: Multiple source fields → array
- `custom`: User-defined transformation

**Technology**:
- Uses LLM for semantic understanding
- Name similarity matching (fuzzy)
- Type-based inference

---

#### 1.3 Guardian Agent (Quality & Self-Healing)
**File**: `app/agents/guardian.py`

Tests integrations exhaustively with synthetic data:

```python
from app.agents.guardian import VitesseGuardian
from app.services.aether_intel import AetherIntelligenceProvider

intel = AetherIntelligenceProvider()
guardian = VitesseGuardian(context, intelligence=intel)

result = await guardian.execute(
    context={...},
    input_data={
        "integration_instance": integration_obj,
        "test_count": 100,
        "source_endpoint": "/customers",
        "dest_endpoint": "/contacts"
    }
)

# Result contains:
# - health_score: HealthScore (0-100)
# - test_results: List[TestResult]
# - critical_issues: List[str]
```

**Testing process**:
1. Generate synthetic test data matching source schema
2. Execute 100+ shadow calls to both APIs
3. Track response times (p95 metric)
4. Analyze success rates
5. Detect critical issues:
   - Auth failures (401)
   - Rate limiting (429)
   - Schema mismatches (400)
   - Connectivity issues

**Health Score Formula**:
```
overall_score = (success_rate * 0.7) + (endpoint_coverage * 0.3)
Passing threshold: >= 70/100
```

**Self-Healing**:
- If score < 70: Triggers re-mapping
- Detects schema changes automatically
- Logs issues for developer review

---

#### 1.4 VitesseOrchestrator (Master Coordination)
**File**: `app/agents/vitesse_orchestrator.py`

Orchestrates all agents in sequence:

```python
from app.agents.vitesse_orchestrator import VitesseOrchestrator
from app.agents.base import AgentContext
from app.schemas.integration import DeploymentConfig, DeploymentTarget

context = AgentContext()
orchestrator = VitesseOrchestrator(context)
# (Orchestrator automatically injects shared AetherIntelligenceProvider to all agents)

result = await orchestrator.create_integration(
    source_api_url="https://api.shopify.com/swagger.json",
    source_api_name="Shopify",
    dest_api_url="https://api.credo.com/openapi.json",
    dest_api_name="Credo CRM",
    user_intent="Sync customers and orders",
    deployment_config=DeploymentConfig(
        target=DeploymentTarget.LOCAL,
        memory_mb=512,
        cpu_cores=0.5,
    ),
    created_by="user@example.com"
)

# Returns: complete IntegrationInstance with:
# - Integration ID
# - Health score (if passed)
# - Deployment ready status
```

**Workflow**:
4. **Step 4**: Run Guardian tests
5. **Step 5**: Ready for deployment
6. **Step 6**: Monitor & Self-Heal (Post-deployment)

---

#### 1.5 Integration Monitor & Self-Healing
**Files**: `app/agents/integration_monitor.py`, `app/agents/self_healing.py`

Post-deployment agents that ensure long-term reliability:

**Monitor Agent**:
- Tracks specific metrics: `success_rate`, `p95_latency`, `error_distribution`
- Calculates real-time `health_score`
- Triggers healing when score < 60%

**Healer Agent**:
- **Diagnose**: Identifies root cause (e.g., Auth vs Schema)
- **Strategy**:
  - `refresh_schema`: Refetch OpenAPI spec
  - `remap_fields`: Re-run Mapper with new schema
  - `switch_endpoint`: Use alternative base URL
- **Verify**: Runs Guardian tests before applying fix

---

### 2. Deployment Layer (Pluggable)

#### 2.1 Deployer Interface
**File**: `app/deployer/base.py`

```python
from app.deployer.base import DeployerFactory, DeploymentMode

# Create appropriate deployer
deployer = DeployerFactory.create_deployer(
    target="local",  # or "eks", "ecs"
    config={...}
)

# Deploy an integration
result = await deployer.deploy(
    integration_id="integ_abc123",
    container_config={
        "image": "vitesse/integration:latest",
        "env": {
            "SOURCE_API_KEY": "sk_...",
            "DEST_API_KEY": "sk_..."
        }
    }
)
```

---

#### 2.2 Local Deployer (Docker + Traefik)
**Mode**: `DeploymentTarget.LOCAL`

**What it does**:
- Creates Docker containers on VPS
- Registers with Traefik for reverse proxying
- Assigns DNS subdomain (e.g., `vitesse-integ_abc123.local`)
- Manages networking and volume mounts

**Requirements**:
- Docker Engine 20.10+
- Traefik 2.0+
- Linux VPS (Ubuntu 22.04+ recommended)

**Config**:
```python
config = {
    "host": "10.0.0.5",
    "docker_socket": "unix:///var/run/docker.sock",
    "traefik_config": {...},
    "network": "vitesse-net"
}
```

---

#### 2.3 Cloud Deployers (EKS/ECS)
**Mode**: `DeploymentTarget.CLOUD_EKS` or `DeploymentTarget.CLOUD_ECS`

**EKS (Kubernetes)**:
- Creates Kubernetes Deployment (default 2 replicas)
- Sets up Service and Ingress
- Autoscaling via HPA
- Persistent state via external PostgreSQL

**ECS (Fargate)**:
- Creates ECS Task Definition
- Registers ECS Service
- Configures ALB routing
- Manages CloudWatch logging

---

### 3. Container Templates

**File**: `app/deployer/templates.py`

Generates Dockerfiles and runtime configurations:

```python
from app.deployer.templates import DockerfileGenerator

# Generate Dockerfile
dockerfile = DockerfileGenerator.generate_base_dockerfile(
    integration_id="integ_abc123",
    python_version="3.12"
)

# Generate main.py (runtime app)
main_py = DockerfileGenerator.generate_integration_app_template(
    integration_id="integ_abc123",
    source_api_name="Shopify",
    dest_api_name="Credo CRM",
    mapping_json=json.dumps(mapping_logic)
)

# Generate Kubernetes manifests (for EKS)
k8s_manifest = DockerfileGenerator.generate_kubernetes_manifest(
    integration_id="integ_abc123",
    image_uri="123456789.dkr.ecr.us-east-1.amazonaws.com/vitesse:latest",
    replicas=3
)
```

---

## Integration Lifecycle (Multi-Step Workflow)

### Overview

Vitesse AI implements a **5-step sequential workflow** for creating integrations, aligned with the Vitesse AI Framework baseline. Each step is a separate REST endpoint that progresses the integration through its lifecycle.

### Workflow States

```
DISCOVERING  →  MAPPING  →  TESTING  →  DEPLOYING  →  ACTIVE
(Step 1)       (Step 2)     (Step 3)     (Step 4)      (Step 5)
```

### Step 1: CREATE - Discovery Results to Integration

**Endpoint**: `POST /api/v1/vitesse/integrations`

**Input**: Discovery results from user selection
- `source_discovery`: DiscoveryResult object
- `dest_discovery`: DiscoveryResult object
- `user_intent`: User's integration goal
- `deployment_target`: Where to deploy (local, cloud)

**Process**:
1. Create Integration record in database
2. Store discovery results (source and destination)
3. Set status to `DISCOVERING`
4. Return integration ID for next steps

**Database Record**:
```python
Integration(
    id=uuid,
    name="Salesforce to HubSpot",
    status="discovering",
    source_discovery={source_discovery.model_dump(mode='json')},
    dest_discovery={dest_discovery.model_dump(mode='json')},
    source_api_spec=None,  # Will be populated in step 2
    dest_api_spec=None,    # Will be populated in step 2
    deployment_config=deployment_config.model_dump(mode='json'),
    created_by="system",
)
```

**Example**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Integration",
    "source_discovery": {
      "api_name": "Salesforce",
      "base_url": "https://api.salesforce.com",
      "documentation_url": "https://salesforce.com"
    },
    "dest_discovery": {
      "api_name": "HubSpot",
      "base_url": "https://api.hubspot.com",
      "documentation_url": "https://hubspot.com"
    },
    "user_intent": "Sync contacts",
    "deployment_target": "local"
  }'
```

### Step 2: INGEST - Fetch API Specifications

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/ingest`

**Input**: API specification URLs
- `source_spec_url`: URL to source API's OpenAPI/Swagger spec
- `dest_spec_url`: URL to destination API's OpenAPI/Swagger spec

**Process**:
1. Fetch both API specifications from provided URLs
2. Parse OpenAPI/Swagger documents
3. Extract endpoints, methods, parameters, auth requirements
4. Store specs in integration record
5. Update status to `MAPPING`
6. Return discovered endpoints

**Technology**:
- Uses Ingestor Agent to parse OpenAPI specs
- Extracts standardized APISpecification schema
- Detects authentication methods and pagination patterns

**Database Update**:
```python
integration.source_api_spec = {
    "api_name": "Salesforce",
    "base_url": "https://api.salesforce.com",
    "endpoints": [
        {"path": "/customers", "method": "GET", ...},
        {"path": "/orders", "method": "GET", ...},
    ]
}
integration.dest_api_spec = {...}
integration.status = "mapping"
```

**Example**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source_spec_url": "https://api.salesforce.com/openapi.json",
    "dest_spec_url": "https://api.hubspot.com/openapi.json"
  }'
```

### Step 3: MAP - Generate Field Mappings

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/map`

**Input**: Endpoint mapping hints
- `source_endpoint`: Source API endpoint path (e.g., "/customers")
- `dest_endpoint`: Destination API endpoint path (e.g., "/contacts")
- `mapping_hints`: Optional manual mapping hints

**Process**:
1. Use Mapper Agent to generate semantic mappings
2. Analyze source and destination schemas
3. Match fields based on:
   - Name similarity
   - Type compatibility
   - User intent (context)
   - Manual hints (if provided)
4. Generate DataTransformation objects for each mapping
5. Determine complexity score (1-10)
6. Store mapping logic in integration record
7. Update status to `TESTING`

**Mapper Agent Output**:
```python
result = {
    "mapping_logic": {
        "source_endpoint": "/customers",
        "dest_endpoint": "/contacts",
        "transformations": [
            {
                "source_field": "first_name",
                "dest_field": "given_name",
                "transform_type": "direct",
            },
            {
                "source_field": "email",
                "dest_field": "email_address",
                "transform_type": "mapping",
            },
        ]
    },
    "transformation_count": 12,
    "complexity_score": 5,
    "status": "success"
}
```

**Example**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/map \
  -H "Content-Type: application/json" \
  -d '{
    "source_endpoint": "/customers",
    "dest_endpoint": "/contacts",
    "mapping_hints": {"email": "email_address"}
  }'
```

### Step 4: TEST - Run Integration Tests

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/test`

**Input**: Test configuration
- `test_sample_size`: Number of test records (1-100, default: 5)
- `skip_destructive`: Skip tests that modify data (default: true)

**Process**:
1. Use Guardian Agent to run comprehensive tests
2. Generate synthetic test data matching source schema
3. Execute shadow calls to both APIs (no real data modified)
4. Track response times, success rates, error patterns
5. Detect critical issues:
   - Authentication failures (401)
   - Rate limiting (429)
   - Schema mismatches (400)
   - Connectivity issues
6. Calculate health score
7. Update status to `DEPLOYING` (if health >= 70)

**Health Score Formula**:
```
overall_score = (success_rate * 0.7) + (endpoint_coverage * 0.3)
Passing: >= 70/100
```

**Guardian Agent Output**:
```python
result = {
    "health_score": {
        "overall": 85,
        "data_quality": 90,
        "reliability": 80,
    },
    "test_count": 10,
    "passed_tests": 10,
    "failed_tests": 0,
    "status": "success"
}
```

**Example**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/test \
  -H "Content-Type: application/json" \
  -d '{
    "test_sample_size": 10,
    "skip_destructive": true
  }'
```

### Step 5: DEPLOY - Deploy Integration to Target

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/deploy`

**Input**: Deployment configuration
- `replicas`: Number of replicas (default: 1)
- `memory_mb`: Memory in MB (default: 512)
- `cpu_cores`: CPU cores (default: 0.5)
- `auto_scale`: Enable autoscaling (default: false)

**Process**:
1. Use Deployer Agent to deploy to target environment
2. Generate Dockerfile with integration logic
3. Build container image
4. Deploy to target:
   - **local**: Docker containers with Traefik routing
   - **cloud**: Kubernetes/ECS with managed scaling
5. Assign service URL
6. Update status to `ACTIVE`
7. Store container ID and service URL

**Deployer Support**:
- **Local**: Docker + Traefik
- **Kubernetes (EKS)**: Deployments, Services, Ingress
- **AWS ECS**: Fargate tasks with ALB routing

**Deployer Agent Output**:
```python
result = {
    "container_id": "vitesse-ad9cb833",
    "service_url": "http://localhost:8080/vitesse-ad9cb833",
    "deployment_time_seconds": 15,
    "status": "success"
}
```

**Example**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/{id}/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "replicas": 1,
    "memory_mb": 512,
    "cpu_cores": 0.5
  }'
```

### Workflow Error Handling & Recovery

**Step Failures**:
- Each step validates inputs and dependencies
- Returns 400 Bad Request if validation fails
- Returns 500 Internal Server Error if execution fails
- Includes detailed error messages for debugging

**State Recovery**:
- Integration record persists in database
- Can retry failed step without restarting workflow
- Each step is idempotent (safe to retry)

**Example Error Responses**:
```json
{
  "status": "failed",
  "error": "Integration not found",
  "http_status": 404
}
```

---

### Full Flow Diagram

```
User Input (Discovery Results)
    ↓
┌─────────────────────────────────────────────┐
│  STEP 1: CREATE                             │
│  POST /integrations                         │
│  Create Integration(status=DISCOVERING)     │
│  Store discovery results                    │
└─────────────────────────────────────────────┘
    ↓ (return integration_id)
┌─────────────────────────────────────────────┐
│  STEP 2: INGEST                             │
│  POST /integrations/{id}/ingest             │
│  Ingestor Agent: Fetch & parse API specs    │
│  Update status to MAPPING                   │
└─────────────────────────────────────────────┘
    ↓ (optional: review endpoints)
┌─────────────────────────────────────────────┐
│  STEP 3: MAP                                │
│  POST /integrations/{id}/map                │
│  Mapper Agent: Generate transformations     │
│  Update status to TESTING                   │
└─────────────────────────────────────────────┘
    ↓ (optional: review mappings)
┌─────────────────────────────────────────────┐
│  STEP 4: TEST                               │
│  POST /integrations/{id}/test               │
│  Guardian Agent: Run synthetic tests        │
│  Calculate health_score                     │
│  Update status to DEPLOYING                 │
└─────────────────────────────────────────────┘
    ↓ (if health_score >= 70)
┌─────────────────────────────────────────────┐
│  STEP 5: DEPLOY                             │
│  POST /integrations/{id}/deploy             │
│  Deployer Agent: Build & deploy container  │
│  Update status to ACTIVE                    │
│  Ready for data synchronization              │
└─────────────────────────────────────────────┘
    ↓
Integration Active in Production
```

### Full Flow Diagram (Legacy Single-Endpoint Model)

**Deprecated** - These step are now handled sequentially via multi-step endpoints.

Before this refactor, integration creation was monolithic:

---

## API Reference - Multi-Step Workflow

### Discovery
**GET** `/api/v1/vitesse/discover?query=Salesforce&limit=5`

Returns discovered APIs matching search query.

### Step 1: Create Integration
**POST** `/api/v1/vitesse/integrations`

Request:
```json
{
  "name": "Salesforce to HubSpot",
  "source_discovery": {...discovery result...},
  "dest_discovery": {...discovery result...},
  "user_intent": "Sync contacts",
  "deployment_target": "local"
}
```

Response:
```json
{
  "status": "success",
  "integration_id": "uuid",
  "current_step": "DISCOVERING",
  "data": {
    "integration": {...},
    "next_step": "ingest",
    "next_endpoint": "/integrations/{id}/ingest"
  }
}
```

### Step 2: Ingest Specifications
**POST** `/api/v1/vitesse/integrations/{integration_id}/ingest`

Request:
```json
{
  "source_spec_url": "https://api.salesforce.com/openapi.json",
  "dest_spec_url": "https://api.hubspot.com/openapi.json"
}
```

Response:
```json
{
  "status": "success",
  "integration_id": "uuid",
  "current_step": "MAPPING",
  "data": {
    "source_endpoints": [...],
    "dest_endpoints": [...],
    "next_step": "map",
    "next_endpoint": "/integrations/{id}/map"
  }
}
```

### Step 3: Generate Mappings
**POST** `/api/v1/vitesse/integrations/{integration_id}/map`

Request:
```json
{
  "source_endpoint": "/customers",
  "dest_endpoint": "/contacts",
  "mapping_hints": {...}
}
```

Response:
```json
{
  "status": "success",
  "integration_id": "uuid",
  "current_step": "TESTING",
  "data": {
    "transformation_count": 12,
    "complexity_score": 5,
    "next_step": "test",
    "next_endpoint": "/integrations/{id}/test"
  }
}
```

### Step 4: Run Tests
**POST** `/api/v1/vitesse/integrations/{integration_id}/test`

Request:
```json
{
  "test_sample_size": 10,
  "skip_destructive": true
}
```

Response:
```json
{
  "status": "success",
  "integration_id": "uuid",
  "current_step": "DEPLOYING",
  "data": {
    "health_score": {"overall": 85, "data_quality": 90, "reliability": 80},
    "test_count": 10,
    "passed_tests": 10,
    "next_step": "deploy",
    "next_endpoint": "/integrations/{id}/deploy"
  }
}
```

### Step 5: Deploy Integration
**POST** `/api/v1/vitesse/integrations/{integration_id}/deploy`

Request:
```json
{
  "replicas": 1,
  "memory_mb": 512,
  "cpu_cores": 0.5
}
```

Response:
```json
{
  "status": "success",
  "integration_id": "uuid",
  "current_step": "ACTIVE",
  "data": {
    "container_id": "vitesse-xyz",
    "service_url": "http://localhost:8080/xyz",
    "deployment_time_seconds": 15
  }
}
```

### Get Integration Status
**GET** `/api/v1/vitesse/integrations/{integration_id}`

Returns current status and health score.

### List All Integrations
**GET** `/api/v1/vitesse/integrations`

Returns paginated list of all integrations.

### Delete Integration
**DELETE** `/api/v1/vitesse/integrations/{integration_id}`

Deletes integration and its resources.

### System Status
**GET** `/api/v1/vitesse/status`

Returns orchestrator and agent statuses.

---

## Database Schema

### Core Tables

**integrations**
- `id`: UUID (primary key)
- `name`: string - Integration name
- `status`: enum (discovering, mapping, testing, deploying, active, failed)
- `source_discovery`: JSON - Discovery result for source API
  - `api_name`: string
  - `base_url`: string
  - `documentation_url`: string
  - `confidence_score`: float
  - `source`: string (catalog, github, etc)
  - `discovered_at`: timestamp
- `dest_discovery`: JSON - Discovery result for destination API (same structure)
- `source_api_spec`: JSON - OpenAPI/Swagger spec for source (populated in Step 2: INGEST)
  - `endpoints`: array of endpoint objects
  - `auth_type`: string
  - `pagination_type`: string
- `dest_api_spec`: JSON - OpenAPI/Swagger spec for destination (same structure)
- `mapping_logic`: JSON - Field mappings (populated in Step 3: MAP)
  - `transformations`: array of DataTransformation objects
  - `complexity_score`: float (1-10)
- `health_score`: JSON - Health metrics (populated in Step 4: TEST)
  - `overall`: float (0-100)
  - `data_quality`: float
  - `reliability`: float
- `deployment_config`: JSON - Deployment settings
  - `target`: string (local, eks, ecs)
  - `replicas`: int
  - `memory_mb`: int
  - `cpu_cores`: float
- `container_id`: string - Container ID (populated in Step 5: DEPLOY)
- `deployment_target`: string - Where deployment happens (local, cloud_eks, cloud_ecs)
- `created_by`: string - User who created integration
- `extra_metadata`: JSON - Additional metadata
- `created_at`: timestamp
- `updated_at`: timestamp

**transformations**
- `id`: UUID
- `integration_id`: FK → integrations
- `source_field`: string
- `dest_field`: string
- `transform_type`: enum
- `transform_config`: JSON

**test_results**
- `id`: UUID
- `integration_id`: FK → integrations
- `endpoint`: string
- `method`: string (GET, POST, etc)
- `status_code`: int
- `response_time_ms`: float
- `success`: boolean
- `error_message`: text
- `created_at`: timestamp

**integration_audit_logs**
- `id`: UUID
- `integration_id`: FK → integrations
- `action`: string (created, updated, tested, deployed)
- `actor`: string
- `status`: string (success, failed, partial)
- `details`: JSON
- `created_at`: timestamp

### UI Feature Tables

**harvest_jobs**
- `id`: string (primary key)
- `harvest_type`: string
- `status`: enum (pending, running, completed, failed)
- `progress`: float (0-100)
- `source_ids`: JSON array
- `processed_sources`: int
- `successful_harvests`: int
- `failed_harvests`: int
- `apis_harvested`: int
- `error_message`: text
- `created_at`: timestamp
- `updated_at`: timestamp

**agent_activities**
- `id`: UUID (primary key)
- `agent_id`: string
- `agent_name`: string
- `status`: enum (active, idle, error)
- `current_task`: text
- `last_activity`: timestamp
- `tasks_completed`: int
- `success_rate`: float
- `average_response_time`: int
- `created_at`: timestamp
- `updated_at`: timestamp

**agent_communications**
- `id`: UUID (primary key)
- `timestamp`: timestamp
- `from_agent`: string
- `to_agent`: string
- `message_type`: string
- `content`: text
- `priority`: enum (low, normal, high)
- `status`: enum (sent, delivered, read)
- `created_at`: timestamp

**agent_metrics**
- `id`: UUID (primary key)
- `agent_id`: string
- `uptime_percentage`: float
- `tasks_completed_today`: int
- `tasks_completed_week`: int
- `average_task_duration`: int
- `success_rate`: float
- `error_rate`: float
- `collaboration_score`: int
- `response_time_p95`: int
- `cpu_usage_avg`: float
- `memory_usage_avg`: float
- `active_workflows`: int
- `pending_tasks`: int
- `created_at`: timestamp

**integrations** (UI Builder)
- `id`: string (primary key)
- `name`: string
- `description`: text
- `source_api`: string
- `target_api`: string
- `status`: enum (draft, active, testing, inactive)
- `last_sync`: timestamp
- `success_rate`: float
- `created_at`: timestamp
- `updated_at`: timestamp

**field_mappings**
- `id`: string (primary key)
- `integration_id`: FK → integrations
- `source_field`: string
- `target_field`: string
- `data_type`: string
- `required`: boolean
- `transformation`: string
- `created_at`: timestamp

**transformation_rules**
- `id`: string (primary key)
- `integration_id`: FK → integrations
- `name`: string
- `description`: text
- `rule_type`: string
- `source_field`: string
- `target_field`: string
- `transformation_logic`: text
- `enabled`: boolean
- `created_at`: timestamp

**integration_test_results**
- `id`: string (primary key)
- `integration_id`: FK → integrations
- `status`: enum (running, completed, failed)
- `start_time`: timestamp
- `end_time`: timestamp
- `success`: boolean
- `error_message`: text
- `request_data`: JSON
- `response_data`: JSON
- `execution_time`: int
- `created_at`: timestamp

---

## Service Layer

### Database Services

Vitesse AI implements a clean service layer pattern for database operations, separating business logic from API endpoints.

**HarvestJobService** (`app/services/harvest_collaboration_integration.py`)
- `get_harvest_jobs()`: Retrieve paginated harvest jobs with filtering
- `create_harvest_job()`: Create new harvest job with validation
- `get_harvest_job()`: Get specific job by ID
- `update_harvest_job_status()`: Update job progress and status
- `get_harvest_job_stats()`: Aggregate statistics across all jobs

**AgentCollaborationService** (`app/services/harvest_collaboration_integration.py`)
- `get_agent_activities()`: Retrieve recent agent activities
- `get_agent_communications()`: Get inter-agent communication logs
- `get_agent_metrics()`: Calculate performance metrics for specific agent
- `get_collaboration_stats()`: System-wide collaboration statistics

**IntegrationService** (`app/services/harvest_collaboration_integration.py`)
- `get_integrations()`: List integrations with pagination and filtering
- `create_integration()`: Create new integration
- `get_integration()`: Retrieve specific integration with mappings and rules
- `update_integration()`: Update integration properties
- `delete_integration()`: Remove integration and related data
- `add_field_mapping()`: Add field mapping to integration
- `add_transformation_rule()`: Add transformation rule to integration
- `start_integration_test()`: Initiate background testing
- `get_integration_test_results()`: Retrieve test execution history
- `get_integration_stats()`: System-wide integration statistics

### Service Pattern Benefits

- **Separation of Concerns**: Business logic isolated from HTTP handling
- **Testability**: Services can be unit tested independently
- **Reusability**: Same service methods used across different endpoints
- **Maintainability**: Clear interface between data access and API layers
- **Error Handling**: Centralized error handling and validation

---

## Configuration

### Environment Variables

```bash
# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=vitesse
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=vitesse_db

# LLM (for Ingestor/Mapper semantic understanding)
OPENAI_API_KEY=sk_...
LLM_MODEL=gpt-4

# Local Deployment
DOCKER_HOST=unix:///var/run/docker.sock
TRAEFIK_DASHBOARD_URL=http://traefik.local:8080

# Cloud Deployment (for EKS/ECS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
EKS_CLUSTER_NAME=vitesse-prod
ECR_REGISTRY_URL=123456789.dkr.ecr.us-east-1.amazonaws.com

# Security
SECRET_KEY=your_secret_key
JWT_SECRET=your_jwt_secret
```

---

## Extending Vitesse

### Adding Custom Transform Logic

```python
from app.schemas.integration import DataTransformation

# In VitesseMapper.generate_transformations()
# Add to transform_config for custom types

transformation = DataTransformation(
    source_field="user_timestamp",
    dest_field="created_at",
    transform_type="custom",
    transform_config={
        "function": "parse_shopify_timestamp",
        "params": {
            "format": "ISO8601",
            "timezone": "UTC"
        }
    }
)
```

### Adding New Deployment Target

1. Create new Deployer class inheriting from `Deployer`
2. Implement required methods:
   - `deploy()`
   - `update()`
   - `destroy()`
   - `get_status()`
   - `get_logs()`
3. Register in `DeployerFactory.create_deployer()`

Example:
```python
class AzureContainerInstancesDeployer(Deployer):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(DeploymentMode.AZURE, config)
    
    async def deploy(self, ...):
        # ... Azure implementation
```

---

## Troubleshooting

### Common Issues

**1. Ingestor fails to fetch API spec**
- Verify the API URL is publicly accessible
- Check if Swagger/OpenAPI endpoint exists at:
  - `{url}/swagger.json`
  - `{url}/openapi.json`
  - `{url}/v1/openapi.json`

**2. Mapping generates too few transformations**
- Ensure both APIs have well-defined schemas
- Check that field names have some semantic similarity
- Add hints via `user_intent`

**3. Guardian tests fail with auth errors**
- Verify API credentials in auth_config
- Check if APIs are accessible from deployed location
- For cloud deployments, verify security group rules

**4. Health score below 70**
- Review critical_issues in test results
- Check response times (p95 > 1s indicates slowness)
- Verify endpoint compatibility

---

## Best Practices

1. **API Compatibility**
   - Prefer OpenAPI 3.0+ specs
   - Document all required headers and auth
   - Version your APIs clearly

2. **Authentication**
   - Store API keys in environment variables
   - Rotate keys regularly
   - Use least-privilege scopes

3. **Monitoring**
   - Set up alerts for health scores < 70
   - Monitor sync latency and error rates
   - Log all transformation steps

4. **Performance**
   - Batch requests when possible (use BATCH_SIZE env var)
   - Implement idempotency for retries
   - Cache static mappings

5. **Security**
   - Run integration containers with least privileges
   - Use PostgreSQL SSL for remote connections
   - Encrypt sensitive data at rest

---

## Next Steps

1. [Read the Deployment Guide](DEPLOYMENT.md)
2. [Explore Example Integration: Shopify → Credo](EXAMPLES.md)
3. [Review API Endpoints](../api/endpoints/integrations.py)
4. [Configure Your Environment](.env.example)

---

# Extended Architecture: Collaborative Intelligence & Memory

## Overview

Vitesse AI has been extended with advanced agentic capabilities including collaborative intelligence, persistent memory, and knowledge harvesting for financial services. This section covers the newly implemented architecture components.

## 1. Shared Whiteboard (Collaborative Intelligence)

The "Shared Whiteboard" is a collaborative intelligence mechanism using LangGraph's State Management that enables agents to read from and write to a centralized shared state serving as the source of truth.

### Implementation Files
- `app/core/shared_state.py` - Core Whiteboard implementation
  - `SharedWhiteboardState`: Main state object all agents interact with
  - `AgentContribution`: Tracks what each agent adds
  - `SharedStateLimiter`: Manages concurrent access

### Key Features

#### 1.1 Emergent Intelligence
Each agent reads the current state, adds its insights, and the next agent builds upon it:

```
Discovery Agent  →  [State with discovered APIs]
     ↓
Ingestor Agent   →  [State + API specs + schemas]
     ↓
Mapper Agent     →  [State + mapping logic + transformations]
     ↓
Guardian Agent   →  [State + test results + health scores]
     ↓
Deployer         →  [Deployment ready integration]
```

#### 1.2 State Recovery via Checkpoints
- PostgreSQL persistent checkpoints (configured in `app/core/checkpoint.py`)
- State snapshots created before each major operation
- Recovery from interrupted workflows using `SharedStateLimiter.restore_from_checkpoint()`

#### 1.3 Usage Example in Agents

```python
from app.core.shared_state import SharedWhiteboardState

async def agent_execute_with_shared_state(
    context: Dict[str, Any],
    input_data: Dict[str, Any],
    shared_whiteboard: SharedWhiteboardState,
) -> Dict[str, Any]:
    # 1. Read context from previous agents
    previous_context = shared_whiteboard.get_agent_context("my_agent_type")
    api_spec = previous_context["source_api_spec"]
    
    # 2. Do agent work
    result = await my_agent_logic(api_spec, input_data)
    
    # 3. Contribute to shared state
    shared_whiteboard.record_agent_contribution(
        agent_id="agent_123",
        agent_type="mapper",
        input_keys=["source_api_spec"],
        output_data=result,
        execution_time_ms=150.0,
    )
    
    # 4. Add learned patterns for future integrations
    shared_whiteboard.add_learned_pattern(
        "payment_mapping",
        {"source_field": "amount", "target_field": "value"}
    )
    
    return result
```

### State Structure

```python
SharedWhiteboardState(
    workflow_id="uuid",
    
    # Agent tracking
    agent_contributions={},          # Each agent's contribution
    execution_log=[],                # Complete audit trail
    
    # Shared knowledge (the "whiteboard" content)
    discovered_apis={},              # APIs found
    source_api_spec={},              # Ingestor results
    dest_api_spec={},                # Ingestor results
    mapping_logic={},                # Mapper results
    test_results={},                 # Guardian results
    
    # Learning & patterns
    learned_patterns={},             # Patterns discovered
    harvested_knowledge={},          # From knowledge harvester
    domain_knowledge={},             # Standards, best practices
    
    # User context
    user_intent="",                  # What user wants
    user_constraints={},             # Limitations
    user_preferences={},             # Preferences
    
    # Metadata
    errors=[],                       # For recovery
    retry_count=0,
)
```

## 2. Persistent Memory & Context Preservation

Vector Database layer enables semantic search and storage of integration knowledge using Qdrant for enterprise-grade performance.

### Implementation Files
- `app/core/knowledge_db.py` - Vector DB abstraction layer
  - `KnowledgeDB` (abstract base)
  - `QdrantKnowledge`: Enterprise implementation with quantization
  - `KnowledgeDBManager`: Unified interface

### Features

#### 2.1 Qdrant Setup
- Automatic embedding using Sentence Transformers
- Binary quantization for 40x performance improvement
- Horizontal and vertical scaling capabilities
- Built-in monitoring and observability
- Docker deployment ready

#### 2.2 Collections
Six semantic collections store different types of knowledge:

1. `financial_apis` - API specifications (Plaid, Stripe, Yodlee)
2. `financial_schemas` - Data schemas for financial entities
3. `financial_standards` - Regulatory frameworks (PSD2, FDX)
4. `api_specifications` - General API specs
5. `mapping_patterns` - Common field mappings
6. `domain_knowledge` - Best practices, guidelines

#### 2.3 Search Capability
Semantic search finds relevant knowledge by meaning, not just keywords:

```python
from app.core.knowledge_db import get_knowledge_db

knowledge_db = await get_knowledge_db()

# Find similar APIs
results = await knowledge_db.search(
    collection="financial_apis",
    query="payment processing with strong authentication",
    top_k=5,
)

# Results: [(document, similarity_score), ...]
for doc, score in results:
    print(f"API: {doc['metadata']['api_name']}, Similarity: {score:.2f}")
```

### Usage Pattern

```python
# Add financial knowledge at startup (in seed_data.py)
await knowledge_db.add_documents(
    collection="financial_apis",
    documents=[
        {
            "content": "Detailed API spec",
            "api_name": "Plaid",
            "category": "open_banking",
        },
        # More APIs...
    ],
)

# Search during integration creation
relevant_apis = await knowledge_db.search(
    collection="financial_apis",
    query=user_source_api_query,
    top_k=5,
)
```

## 3. Knowledge Harvesting for Financial Services

Autonomous agent that proactively builds and maintains a financial services knowledge library.

### Implementation Files
- `app/agents/knowledge_harvester.py` - Main harvester agent
- `app/core/financial_services.py` - Financial knowledge seed data
- `app/core/seed_data.py` - Initialization system

### Knowledge Coverage

#### 3.1 Core Financial APIs
- **Plaid**: Open Banking, account aggregation
  - Collections: accounts, transactions, authentication
  - Pagination: offset-based
  - Auth: OAuth2
  
- **Stripe**: Payments processing
  - Collections: customers, payment_intents, charges, transfers
  - Pagination: timestamp-based
  - Auth: Bearer token (API keys)
  
- **Yodlee**: Data aggregation
  - Collections: accounts, transactions, account holders
  - Pagination: cursor-based
  - Auth: OAuth2

#### 3.2 Regulatory Frameworks
- **PSD2** (Payment Services Directive 2)
  - Region: European Union
  - Key: Open Banking APIs + Strong Authentication (SCA/MFA)
  - API patterns: Account Info, Payment Initiation
  
- **FDX** (Financial Data Exchange)
  - Region: International
  - Key: Data minimization, user control, transparency
  - Standard data models for accounts, transactions, parties

#### 3.3 Integration Patterns
Common transformation patterns that appear across integrations:
- Currency conversion (cents ↔ dollars)
- Timestamp normalization (Unix ↔ ISO8601)
- Amount standardization (amount ↔ value ↔ transactionAmount)
- Pagination handling (offset, cursor, page-based)

### Harvester Usage

```python
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext

# Create harvester
harvester = KnowledgeHarvester(context)

# Full harvest at startup
result = await harvester.execute(
    context={},
    input_data={"harvest_type": "full"}
)

# Later: Search for similar APIs
similar = await harvester.find_similar_apis(
    "payment processing with PSD2 compliance",
    top_k=5
)

# Find applicable standards
standards = await harvester.find_applicable_standards(
    "European payment integration"
)

# Find relevant patterns
patterns = await harvester.find_relevant_patterns(
    "Stripe to Salesforce integration",
    top_k=3
)
```

### Automatic Seed Data Loading

At application startup (in `app/main.py`):

```python
from app.core.seed_data import seed_all, check_seed_status

# Check if already seeded
status = await check_seed_status()

# If not seeded, initialize
if status["status"] in ["partial", "error"]:
    result = await seed_all()
    # Seeds all financial APIs, standards, patterns, and domain knowledge
```

## 4. Enhanced Agentic Workflow

Improved agent orchestration that leverages shared state and harvested knowledge.

### Implementation Files
- `app/agents/enhanced_discovery.py` - Discovery agent enhancements
- `app/agents/vitesse_orchestrator.py` - Coordinates agents

### Enhanced Discovery Agent

The Discovery Agent now has access to financial knowledge:

```python
from app.agents.enhanced_discovery import EnhancedDiscoveryContext

# Create enhanced context
enhanced = EnhancedDiscoveryContext(
    shared_whiteboard=state,
    knowledge_harvester=harvester,
)

# 1. Discover APIs with knowledge enhancement
apis = await enhanced.discover_apis_with_knowledge(
    query="payment processor with recurring billing",
    domain="financial",
    limit=5,
)
# Returns: Stripe, PayPal, Square ranked by relevance

# 2. Check regulatory compliance
compliance = await enhanced.check_regulatory_compliance(
    api_name="Stripe",
    region="EU",
)
# Returns: PSD2 requirements, SCA/MFA requirements

# 3. Get integration guidance
guidance = await enhanced.get_integration_guidance(
    source_api="Stripe",
    dest_api="Salesforce",
)
# Returns: Common patterns, field mappings, success rates

# 4. Complete enriched workflow
workflow = await enhanced.enriched_discovery_workflow(
    user_intent="Sync payments to accounting",
    source_api_query="payment processor",
    dest_api_query="accounting system",
    region="EU",
)
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  USER INTENT + CONSTRAINTS (from API request)           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              SHARED WHITEBOARD STATE                     │
│  (Persistent, Agent-Readable, LangGraph Checkpointed)   │
├─────────────────────────────────────────────────────────┤
│ • discovered_apis    ← Discovery Agent                  │
│ • source/dest_specs  ← Ingestor Agent                   │
│ • mapping_logic      ← Mapper Agent                     │
│ • test_results       ← Guardian Agent                   │
│ • learned_patterns   ← All Agents                       │
│ • harvested_knowledge← Knowledge Harvester              │
│ • domain_knowledge   ← Seed Data                        │
└─────────────────────────────────────────────────────────┘
         ▲                                    ▼
         │                          ┌─────────────────────┐
         │                          │ AGENTS PIPELINE     │
         │                          ├─────────────────────┤
         │                          │ 1. Discovery        │
         │                          │ 2. Ingestor(s)      │
         │                          │ 3. Mapper           │
         │                          │ 4. Guardian         │
         │                          │ 5. Deployer         │
         │                          └─────────────────────┘
         │
    ┌────┴──────────────────────────────────────────────┐
    │           KNOWLEDGE SYSTEMS                       │
    ├────────────────────────────────────────────────────┤
    │                                                    │
    │  ┌─────────────────────────────────────────────┐  │
    │  │  KNOWLEDGE HARVESTER AGENT                  │  │
    │  │  • Discovers APIs                           │  │
    │  │  • Extracts schemas & patterns              │  │
    │  │  • Tracks regulatory compliance             │  │
    │  └─────────────────────────────────────────────┘  │
    │                       │                            │
    │                       ▼                            │
    │  ┌─────────────────────────────────────────────┐  │
    │  │    VECTOR DATABASE (Qdrant)                 │  │
    │  │  Collections:                               │  │
    │  │  • financial_apis                           │  │
    │  │  • financial_standards (PSD2, FDX)          │  │
    │  │  • integration_patterns                     │  │
    │  │  • domain_knowledge                         │  │
    │  └─────────────────────────────────────────────┘  │
    │                       ▲                            │
    │                       │                            │
    │  ┌─────────────────────────────────────────────┐  │
    │  │    SEED DATA INITIALIZATION                 │  │
    │  │  • Financial APIs (Plaid, Stripe, Yodlee)  │  │
    │  │  • Standards (PSD2, FDX)                   │  │
    │  │  • Patterns & Best Practices               │  │
    │  └─────────────────────────────────────────────┘  │
    │                                                    │
    └────────────────────────────────────────────────────┘
```

## Deployment & Configuration

### Environment Setup
```bash
# Automatic at app startup:
# 1. Qdrant initialized with quantization for 40x performance
# 2. Seed data loaded into all collections
# 3. Shared state ready for agent coordination
# 4. Knowledge Harvester ready for queries

# No additional configuration needed beyond standard Vitesse setup
```

### Custom Configuration
```python
# In .env or settings:
KNOWLEDGE_DB_BACKEND="qdrant"  # Enterprise-grade vector DB
QDRANT_URL="http://localhost:6333"  # Local Qdrant instance
QDRANT_API_KEY=""  # For Qdrant Cloud (optional)
```

## Testing & Validation

```python
# Test 1: Verify seed data loaded
from app.core.seed_data import check_seed_status
status = await check_seed_status()
assert status["status"] == "ready"

# Test 2: Verify semantic search works
from app.core.knowledge_db import get_knowledge_db
db = await get_knowledge_db()
results = await db.search("financial_apis", "payment processing", top_k=5)
assert len(results) > 0

# Test 3: Verify shared state coordination
state = SharedWhiteboardState()
state.record_agent_contribution(
    agent_id="test",
    agent_type="discovery",
    input_keys=[],
    output_data={"found": ["Stripe", "Plaid"]},
)
assert len(state.agent_contributions) > 0

# Test 4: Verify workflow execution with knowledge
enhanced = EnhancedDiscoveryContext(state, harvester)
apis = await enhanced.discover_apis_with_knowledge("payment processor")
assert len(apis) > 0
```

## Future Extensions

1. **Web Crawling**: Auto-harvest APIs from docs sites
2. **Model Fine-tuning**: Train embeddings on financial domain
3. **Real-time Updates**: Periodic re-harvesting of API changes
4. **Multi-language Support**: Extend beyond English documentation
5. **Compliance Automation**: Auto-generate PSD2/FDX compliance reports
