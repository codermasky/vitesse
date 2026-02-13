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

context = AgentContext()
ingestor = VitesseIngestor(context)

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

mapper = VitesseMapper(context)

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

guardian = VitesseGuardian(context)

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
1. **Step 1**: Ingest source API
2. **Step 2**: Ingest destination API
3. **Step 3**: Generate mappings
4. **Step 4**: Run Guardian tests
5. **Step 5**: Ready for deployment

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

## Integration Lifecycle

### Full Flow Diagram

```
User Input
    ↓
┌─────────────────────────────────────────────┐
│  POST /api/v1/vitesse/integrations          │
│  {source_api_url, dest_api_url, ...}        │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Step 1: INGESTOR                           │
│  Fetch & parse APIs → APISpecification      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Step 2: MAPPER                             │
│  Generate field transformations             │
│  MappingLogic with DataTransformation[]     │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Step 3: GUARDIAN TESTING                   │
│  Generate synthetic data                    │
│  Run 100+ shadow calls to both APIs         │
│  Calculate health score                     │
└─────────────────────────────────────────────┘
    ↓
    Health Score >= 70/100?
    ├── YES → Ready for Deployment
    └── NO  → Failed (requires manual intervention)
```

---

## API Reference

### Create Integration
**POST** `/api/v1/vitesse/integrations`

```json
{
  "source_api_url": "https://api.shopify.com/swagger.json",
  "source_api_name": "Shopify",
  "dest_api_url": "https://api.credo.com/openapi.json",
  "dest_api_name": "Credo CRM",
  "user_intent": "Sync customers from Shopify to Credo",
  "deployment_target": "local",
  "source_auth": {
    "type": "oauth2",
    "token": "shppa_..."
  },
  "dest_auth": {
    "type": "api_key",
    "key": "sk_live_..."
  }
}
```

**Response**:
```json
{
  "status": "success",
  "integration_id": "integ_xyz789",
  "integration": {
    "id": "integ_xyz789",
    "name": "Shopify → Credo CRM",
    "status": "active|failed",
    "health_score": {
      "overall_score": 87.5,
      "success_rate": 95.0,
      "endpoint_coverage": 80.0,
      "critical_issues": []
    }
  }
}
```

### Get Integration Status
**GET** `/api/v1/vitesse/integrations/{integration_id}`

### Update Integration
**PUT** `/api/v1/vitesse/integrations/{integration_id}`

### Manual Sync
**POST** `/api/v1/vitesse/integrations/{integration_id}/sync`

### System Status
**GET** `/api/v1/vitesse/status`

---

## Database Schema

### Core Tables

**integrations**
- `id`: UUID (primary key)
- `name`: string
- `status`: enum (initializing, discovering, mapping, testing, deploying, active, failed)
- `source_api_spec`: JSON
- `dest_api_spec`: JSON
- `mapping_logic`: JSON
- `deployment_config`: JSON
- `health_score`: JSON
- `created_by`: string
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
