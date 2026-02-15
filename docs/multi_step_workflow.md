# Multi-Step Integration Workflow Guide

## Overview

Vitesse AI implements a **5-step sequential workflow** for creating integrations. This design aligns with the Vitesse AI Framework baseline and provides transparent, controllable progression through the integration lifecycle.

## Why Multi-Step?

**Previous Approach** (Single Monolithic Endpoint):
- User clicked "Create Integration"
- System ran all steps (ingest, map, test, deploy) automatically
- No visibility into progress
- Hard to debug if something failed mid-process

**New Approach** (Sequential 5-Step):
- User has control over progression
- Each step is independent and can be monitored
- Clear indication of current integration state
- Easier to debug and troubleshoot
- Enables human review between steps (optional)

## Workflow State Diagram

```
START
  ↓
┌──────────────────────────────────────┐
│ Step 1: CREATE (DISCOVERING)         │
│ User provides discovery results      │
│ → Creates integration record         │
└──────────────────────────────────────┘
  ↓ [user calls Step 2]
┌──────────────────────────────────────┐
│ Step 2: INGEST (MAPPING)             │
│ Fetch API specifications             │
│ → Stores specs in database           │
│ → Ingestor Agent analyzes APIs       │
└──────────────────────────────────────┘
  ↓ [user calls Step 3]
┌──────────────────────────────────────┐
│ Step 3: MAP (TESTING)                │
│ Generate field mappings              │
│ → Mapper Agent creates transformations│
│ → Stores mapping logic               │
└──────────────────────────────────────┘
  ↓ [user calls Step 4]
┌──────────────────────────────────────┐
│ Step 4: TEST (DEPLOYING)             │
│ Run integration tests                │
│ → Guardian Agent runs tests          │
│ → Calculates health score            │
│ → Check: health_score >= 70?         │
└──────────────────────────────────────┘
  ↓ [if passed] [user calls Step 5]
┌──────────────────────────────────────┐
│ Step 5: DEPLOY (ACTIVE)              │
│ Deploy to target environment         │
│ → Deployer Agent builds container    │
│ → Deploys & assigns service URL      │
│ → Integration ready for use          │
└──────────────────────────────────────┘
  ↓
Success ✅
```

## Step-by-Step Execution

### Step 1: CREATE - Establish the Foundation

**Endpoint**: `POST /api/v1/vitesse/integrations`

**Purpose**: Create integration record from user's discovery selections

**What the user provides**:
- Source API discovery result (from discovery search)
- Destination API discovery result (from discovery search)
- Integration name
- User's intent ("Sync Salesforce customers to HubSpot")
- Target deployment environment

**What the system does**:
1. Validate inputs
2. Create Integration record in database
3. Store discovery results as-is (for reference)
4. Initialize deployment config
5. Set status to `DISCOVERING`

**Database state after Step 1**:
```python
{
  "id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "name": "Salesforce to HubSpot",
  "status": "discovering",
  "source_discovery": { "api_name": "Salesforce", ... },
  "dest_discovery": { "api_name": "HubSpot", ... },
  "source_api_spec": null,  # ← Will be populated in Step 2
  "dest_api_spec": null,    # ← Will be populated in Step 2
  "mapping_logic": null,    # ← Will be populated in Step 3
  "health_score": null,     # ← Will be populated in Step 4
  "container_id": null,     # ← Will be populated in Step 5
  "created_at": "2026-02-14T22:35:19"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Salesforce to HubSpot Sync",
    "source_discovery": {
      "api_name": "Salesforce",
      "description": "CRM Platform",
      "base_url": "https://api.salesforce.com",
      "documentation_url": "https://salesforce.com",
      "confidence_score": 0.95,
      "source": "catalog"
    },
    "dest_discovery": {
      "api_name": "HubSpot",
      "description": "Marketing Platform",
      "base_url": "https://api.hubspot.com",
      "documentation_url": "https://hubspot.com",
      "confidence_score": 0.95,
      "source": "catalog"
    },
    "user_intent": "Sync contacts between platforms",
    "deployment_target": "local"
  }'
```

**Example Response**:
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "DISCOVERING",
  "data": {
    "integration": {
      "id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
      "name": "Salesforce to HubSpot Sync",
      "status": "discovering",
      "source_discovery": { ... },
      "dest_discovery": { ... }
    },
    "next_step": "ingest",
    "next_endpoint": "/integrations/ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba/ingest"
  }
}
```

---

### Step 2: INGEST - Fetch Specifications

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/ingest`

**Purpose**: Fetch detailed API specifications from OpenAPI/Swagger URLs

**What the user provides**:
- URL to source API's OpenAPI spec (optional, or inferred)
- URL to destination API's OpenAPI spec (optional, or inferred)

**What the system does**:
1. **Ingestor Agent** fetches specs from URLs
2. Parses OpenAPI 2.0 / OpenAPI 3.0 / Swagger JSON
3. Extracts:
   - All endpoints (paths, methods)
   - Request/response schemas
   - Authentication requirements
   - Pagination patterns
   - Rate limits
4. Stores specs in integration
5. Updates status to `MAPPING`
6. Returns discovered endpoints to user

**Behind the scenes**:
- Uses `VitesseIngestor.execute()` agent (Aether BaseAgent compliant)
- Performs semantic analysis on API structure via Aether Intelligence
- Validates schema compatibility using Pydantic models
- Flags missing or unusual patterns

**Database state after Step 2**:
```python
{
  # ... previous fields ...
  "source_api_spec": {
    "api_name": "Salesforce",
    "base_url": "https://api.salesforce.com",
    "auth": "oauth2",
    "endpoints": [
      {
        "path": "/customers",
        "method": "GET",
        "response_schema": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "email": {"type": "string"},
            ...
          }
        }
      },
      ...
    ]
  },
  "dest_api_spec": { ... },
  "status": "mapping"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/ad9cb833-cd8d.../ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source_spec_url": "https://api.salesforce.com/openapi.json",
    "dest_spec_url": "https://api.hubspot.com/openapi.json"
  }'
```

**Example Response**:
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "MAPPING",
  "data": {
    "source_endpoints": ["/customers", "/orders", "/contacts"],
    "dest_endpoints": ["/contacts", "/deals", "/companies"],
    "next_step": "map",
    "next_endpoint": "/integrations/ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba/map"
  }
}
```

---

### Step 3: MAP - Generate Field Mappings

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/map`

**Purpose**: Generate semantic field mappings between source and destination APIs

**What the user provides**:
- Source endpoint to map from (e.g., `/customers`)
- Destination endpoint to map to (e.g., `/contacts`)
- Optional mapping hints (manual overrides)

**What the system does**:
1. **Mapper Agent** analyzes both endpoint schemas
2. Generates field mappings using:
   - Name similarity (fuzzy matching)
   - Type inference
   - User intent context
   - Manual hints (if provided)
3. Creates DataTransformation objects:
   - direct: `email` → `email` (same type, same name)
   - mapping: `customer_name` → `full_name` (semantic match)
   - transform: `date_str` → `date_unix` (type conversion)
4. Calculates complexity score (1-10)
5. Updates status to `TESTING`

**Transformation Types**:
- **direct**: Field exists in both APIs with same type
- **mapping**: Semantic name mapping (fuzzy match)
- **parse**: String to numeric (parse_int, parse_float)
- **stringify**: Numeric to string
- **parse_bool**: String to boolean
- **collect**: Multiple source fields → array
- **custom**: User-defined transformation

**Database state after Step 3**:
```python
{
  # ... previous fields ...
  "mapping_logic": {
    "source_endpoint": "/customers",
    "dest_endpoint": "/contacts",
    "transformations": [
      {
        "source_field": "first_name",
        "dest_field": "given_name",
        "transform_type": "direct"
      },
      {
        "source_field": "last_name",
        "dest_field": "family_name",
        "transform_type": "direct"
      },
      {
        "source_field": "email",
        "dest_field": "email_address",
        "transform_type": "mapping"
      },
      ...
    ],
    "complexity_score": 5
  },
  "status": "testing"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/ad9cb833-cd8d.../map \
  -H "Content-Type: application/json" \
  -d '{
    "source_endpoint": "/customers",
    "dest_endpoint": "/contacts",
    "mapping_hints": {
      "customer_id": "contact_id",
      "customer_name": "full_name"
    }
  }'
```

**Example Response**:
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "TESTING",
  "data": {
    "transformation_count": 12,
    "complexity_score": 5,
    "next_step": "test",
    "next_endpoint": "/integrations/ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba/test"
  }
}
```

---

### Step 4: TEST - Validate Integration

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/test`

**Purpose**: Run comprehensive tests to validate integration correctness and reliability

**What the user provides**:
- `test_sample_size`: Number of synthetic test records (1-100, default: 5)
- `skip_destructive`: Skip tests that modify data (default: true)

**What the system does**:
1. **Guardian Agent** generates synthetic test data
   - Matches source API schema
   - Realistic data variations
2. Executes shadow calls (no real data modified):
   - Generate: Create test record in memory
   - Transform: Apply mappings
   - Validate: Check schema compliance
   - Audit trail: Log everything
3. Tracks metrics:
   - Success rate (% tests passed)
   - Response times (p95 latency)
   - Error patterns (401, 429, 400, etc)
   - Endpoint coverage
4. Calculates health score:
   ```
   overall_score = (success_rate * 0.7) + (endpoint_coverage * 0.3)
   Threshold: >= 70/100 to pass
   ```
5. Updates status to `DEPLOYING` (if score >= 70)

**Test Results Structure**:
```python
{
  "health_score": {
    "overall": 85,        # Composite score
    "data_quality": 90,   # Schema compliance
    "reliability": 80     # Success rate
  },
  "test_count": 10,
  "passed_tests": 10,
  "failed_tests": 0,
  "test_details": [
    {
      "index": 1,
      "endpoint": "/customers",
      "method": "GET",
      "status": "passed",
      "response_time_ms": 45
    },
    ...
  ]
}
```

**Example Request**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/ad9cb833-cd8d.../test \
  -H "Content-Type: application/json" \
  -d '{
    "test_sample_size": 10,
    "skip_destructive": true
  }'
```

**Example Response**:
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "DEPLOYING",
  "data": {
    "health_score": {
      "overall": 85,
      "data_quality": 90,
      "reliability": 80
    },
    "test_count": 10,
    "passed_tests": 10,
    "next_step": "deploy",
    "next_endpoint": "/integrations/ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba/deploy"
  }
}
```

---

### Step 5: DEPLOY - Go Live

**Endpoint**: `POST /api/v1/vitesse/integrations/{integration_id}/deploy`

**Purpose**: Deploy integration to target environment and make it production-ready

**What the user provides**:
- `replicas`: Number of deployment replicas (default: 1)
- `memory_mb`: Memory per container (default: 512)
- `cpu_cores`: CPU cores per container (default: 0.5)
- `auto_scale`: Enable autoscaling (default: false)

**What the system does**:
1. **Deployer Agent** prepares deployment:
   - Generates Dockerfile
   - Injects mapping logic
   - Sets up environment variables
2. Builds container image
3. Deploys to target environment:
   - **LOCAL**: Docker container with Traefik routing
   - **EKS**: Kubernetes Deployment + Service + Ingress
   - **ECS**: Fargate task + ALB routing
4. Assigns service URL
5. Updates status to `ACTIVE`
6. Returns deployment details

**Deployment Targets**:

**Local (Docker)**:
- Single VPS/server with Docker
- Managed by Traefik reverse proxy
- URL: `http://localhost/vitesse-{integration_id}`

**EKS (Kubernetes)**:
- AWS Elastic Kubernetes Service
- Auto-scaling via HPA
- URL: `https://integrations.company.com/vitesse-{integration_id}`

**ECS (Fargate)**:
- AWS container service
- Managed by ALB
- URL: `https://integrations.company.com/vitesse-{integration_id}`

**Database state after Step 5**:
```python
{
  # ... previous fields ...
  "container_id": "vitesse-ad9cb833",
  "status": "active",
  "extra_metadata": {
    "service_url": "http://localhost:8080/vitesse-ad9cb833",
    "deployed_at": "2026-02-14T22:37:00",
    "deployment_duration_seconds": 15
  }
}
```

**Example Request**:
```bash
curl -X POST http://localhost:9001/api/v1/vitesse/integrations/ad9cb833-cd8d.../deploy \
  -H "Content-Type: application/json" \
  -d '{
    "replicas": 1,
    "memory_mb": 512,
    "cpu_cores": 0.5,
    "auto_scale": false
  }'
```

**Example Response**:
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "ACTIVE",
  "data": {
    "container_id": "vitesse-ad9cb833",
    "service_url": "http://localhost:8080/vitesse-ad9cb833",
    "deployment_time_seconds": 15
  }
}
```

---

## Error Handling

Each step validates prerequisites and returns helpful errors:

### Common Error Scenarios

**Step 2 (Ingest) fails**:
- API spec URL is invalid or unreachable
- API spec is malformed JSON
- OpenAPI schema is not compatible

Response:
```json
{
  "status": "failed",
  "error": "Failed to fetch source API spec: Connection timeout",
  "http_status": 400
}
```

**Step 4 (Test) fails**:
- Health score < 70
- Critical auth failure
- Schema mismatch detected

Response:
```json
{
  "status": "failed",
  "error": "Integration tests failed: health_score = 45 (threshold: 70)",
  "http_status": 400
}
```

**Step 5 (Deploy) fails**:
- Docker image build failed
- Kubernetes deployment failed
- Resource constraints

Response:
```json
{
  "status": "failed",
  "error": "Docker image build failed: base image not found",
  "http_status": 500
}
```

## Monitoring & Status

### Get Current Integration Status
```bash
GET /api/v1/vitesse/integrations/{integration_id}

Response:
{
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "status": "active",
  "health_score": {
    "overall": 85,
    "data_quality": 90,
    "reliability": 80
  },
  "last_updated": "2026-02-14T22:37:00"
}
```

### List All Integrations
```bash
GET /api/v1/vitesse/integrations

Response:
{
  "status": "success",
  "data": [
    {
      "id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
      "name": "Salesforce to HubSpot",
      "status": "active",
      "health_score": { ... },
      "created_at": "2026-02-14T22:35:19"
    }
  ],
  "count": 1
}
```

## Frontend Implementation

### React Component Flow

```tsx
// Step 1: Discover APIs
<APIDiscovery 
  onSelect={setSourceAndDest}
/>

// Step 2: Create Integration
const response1 = await api.createVitesseIntegration({
  name, source_discovery, dest_discovery, user_intent, deployment_target
});

// Step 3: Ingest Specs
const response2 = await api.ingestIntegrationSpecs(
  response1.integration_id,
  { source_spec_url, dest_spec_url }
);

// Step 4: Map Fields
const response3 = await api.mapIntegrationFields(
  response1.integration_id,
  { source_endpoint, dest_endpoint }
);

// Step 5: Test
const response4 = await api.testVitesseIntegration(
  response1.integration_id,
  { test_sample_size, skip_destructive }
);

// Step 6: Deploy
const response5 = await api.deployVitesseIntegration(
  response1.integration_id,
  { replicas, memory_mb, cpu_cores }
);

// Integration now ACTIVE and ready to use
```

## Best Practices

1. **Monitor Each Step**: Check health scores and error messages
2. **Retry on Failure**: Each step is idempotent, safe to retry
3. **Review Mappings**: Optional step for complex integrations
4. **Start Small**: Use test_sample_size=5 initially
5. **Version Your Configs**: Store deployment configs for reproducibility
6. **Set Alerts**: Alert on health_score < 70 or deployment failures
7. **Document Transformations**: Add notes to complex mappings

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Step 2 fails | API spec unreachable | Verify spec URL is public, check firewall |
| Step 3 returns empty mappings | Incompatible schemas | Review field names, add mapping_hints |
| Step 4 fails with health < 70 | Auth errors (401) | Verify API credentials |
| Step 4 fails with health < 70 | Rate limiting (429) | Reduce test_sample_size |
| Step 5 fails | Docker build issue | Check Dockerfile generation logs |
| Step 5 fails | Kubernetes failure | Verify cluster permissions |

## Summary

The multi-step workflow provides:
- ✅ **Transparency**: Clear status at each stage
- ✅ **Control**: User decides when to progress
- ✅ **Debugging**: Easy to identify where problems occur
- ✅ **Reliability**: Each step validated independently
- ✅ **Repeatability**: Can retry failed steps
- ✅ **Learning**: System learns from each integration
