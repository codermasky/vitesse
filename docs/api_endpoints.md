# Vitesse AI API Endpoints

This document describes the REST API endpoints for Vitesse AI's UI features, including the Knowledge Harvester Dashboard, Agent Collaboration Hub, and Integration Builder.

## Knowledge Harvester Dashboard

### Harvest Jobs

#### List Harvest Jobs
```http
GET /api/v1/harvest-jobs/
```

**Query Parameters:**
- `skip` (int, optional): Number of jobs to skip (default: 0)
- `limit` (int, optional): Maximum number of jobs to return (default: 50)
- `status` (str, optional): Filter by job status

**Response:**
```json
{
  "items": [
    {
      "id": "harvest-job-001",
      "harvest_type": "api_discovery",
      "status": "completed",
      "progress": 100.0,
      "source_ids": [1, 2, 3],
      "processed_sources": 15,
      "successful_harvests": 14,
      "failed_harvests": 1,
      "apis_harvested": 127,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T11:45:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

#### Create Harvest Job
```http
POST /api/v1/harvest-jobs/
```

**Request Body:**
```json
{
  "harvest_type": "api_discovery",
  "source_ids": [1, 2, 3]
}
```

#### Get Harvest Job
```http
GET /api/v1/harvest-jobs/{job_id}
```

#### Run Harvest Job
```http
POST /api/v1/harvest-jobs/{job_id}/run
```

**Request Body:**
```json
{
  "harvest_type": "api_discovery",
  "source_ids": [1, 2, 3]
}
```

#### Get Harvest Job Statistics
```http
GET /api/v1/harvest-jobs/stats/overview
```

## Agent Collaboration Hub

### Shared State

#### Get Shared State
```http
GET /api/v1/agent-collaboration/shared-state
```

**Response:**
```json
{
  "current_state": {
    "workflow_id": "wf-001",
    "status": "running",
    "current_agent": "analyst-001",
    "progress": 65,
    "last_update": "2024-01-15T10:30:00Z"
  },
  "recent_changes": [
    {
      "timestamp": "2024-01-15T10:25:00Z",
      "agent_id": "analyst-001",
      "action": "analyzed_performance_data",
      "data_keys": ["performance_metrics", "bottlenecks"]
    }
  ],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

### Agent Activity

#### Get Agent Activity
```http
GET /api/v1/agent-collaboration/agents/activity
```

**Query Parameters:**
- `hours` (int, optional): Hours of history to retrieve (default: 24, max: 168)

**Response:**
```json
[
  {
    "agent_id": "analyst-001",
    "agent_name": "Data Analyst",
    "status": "active",
    "current_task": "Analyzing API performance metrics",
    "last_activity": "2024-01-15T10:28:00Z",
    "tasks_completed": 15,
    "success_rate": 92.3,
    "average_response_time": 45
  }
]
```

### Communication Logs

#### Get Communication Log
```http
GET /api/v1/agent-collaboration/communication/log
```

**Query Parameters:**
- `hours` (int, optional): Hours of history to retrieve (default: 1, max: 24)
- `limit` (int, optional): Maximum number of messages to return (default: 50, max: 200)

**Response:**
```json
[
  {
    "id": "comm-001",
    "timestamp": "2024-01-15T10:25:00Z",
    "from_agent": "orchestrator-001",
    "to_agent": "analyst-001",
    "message_type": "task_assignment",
    "content": "Analyze performance metrics for the last 24 hours",
    "priority": "high",
    "status": "delivered"
  }
]
```

### Agent Metrics

#### Get Agent Metrics
```http
GET /api/v1/agent-collaboration/agents/{agent_id}/metrics
```

**Response:**
```json
{
  "agent_id": "analyst-001",
  "agent_name": "Data Analyst",
  "uptime_percentage": 98.5,
  "tasks_completed_today": 12,
  "tasks_completed_week": 67,
  "average_task_duration": 45,
  "success_rate": 94.2,
  "error_rate": 5.8,
  "collaboration_score": 87,
  "response_time_p95": 120,
  "cpu_usage_avg": 45.2,
  "memory_usage_avg": 234,
  "active_workflows": 3,
  "pending_tasks": 2
}
```

### Collaboration Statistics

#### Get Collaboration Stats
```http
GET /api/v1/agent-collaboration/stats/overview
```

**Response:**
```json
{
  "total_agents": 8,
  "active_agents": 5,
  "total_workflows": 23,
  "active_workflows": 7,
  "total_communications_today": 156,
  "average_collaboration_score": 82.5,
  "system_uptime": 99.7,
  "average_response_time": 45,
  "tasks_completed_today": 89,
  "error_rate": 3.2,
  "peak_collaboration_hour": "14:00",
  "most_active_agent": "orchestrator-001"
}
```

## Vitesse Integration Factory (Multi-Step Workflow)

The integration creation process follows a **5-step sequential workflow** aligned with the Vitesse AI Framework baseline:

### Workflow Overview

```
Step 1: CREATE          Step 2: INGEST           Step 3: MAP            Step 4: TEST              Step 5: DEPLOY
(DISCOVERING)   →      (MAPPING)        →       (TESTING)      →      (DEPLOYING)      →       (ACTIVE)
  |                       |                        |                     |                        |
  Create from          Fetch API specs       Generate mappings     Run Guardian tests       Deploy to target
  discovery results    from URLs             using Mapper agent    (health score)          environment
```

### Step 1: Discover APIs

#### Discover APIs by Search Query
```http
GET /api/v1/vitesse/discover?query=Salesforce&limit=5
```

**Query Parameters:**
- `query` (str, required): Natural language search query (e.g., "Salesforce", "payment APIs")
- `limit` (int, optional): Maximum results (default: 5, max: 20)

**Response:**
```json
{
  "status": "success",
  "results": [
    {
      "api_name": "Salesforce",
      "description": "CRM Platform",
      "base_url": "https://api.salesforce.com",
      "documentation_url": "https://salesforce.com/docs",
      "confidence_score": 0.95,
      "source": "catalog",
      "tags": ["crm", "enterprise"]
    }
  ]
}
```

### Step 1: Create Integration from Discovery Results

#### POST /integrations - Create Integration
```http
POST /api/v1/vitesse/integrations
```

**Request Body:**
```json
{
  "name": "Salesforce to HubSpot Sync",
  "source_discovery": {
    "api_name": "Salesforce",
    "description": "CRM Platform",
    "base_url": "https://api.salesforce.com",
    "documentation_url": "https://salesforce.com/docs",
    "confidence_score": 0.95,
    "source": "catalog"
  },
  "dest_discovery": {
    "api_name": "HubSpot",
    "description": "Marketing Platform",
    "base_url": "https://api.hubspot.com",
    "documentation_url": "https://hubspot.com/docs",
    "confidence_score": 0.95,
    "source": "catalog"
  },
  "user_intent": "Sync customer contacts from Salesforce to HubSpot",
  "deployment_target": "local"
}
```

**Response (201 Created):**
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

### Step 2: Ingest API Specifications

#### POST /integrations/{id}/ingest - Fetch API Specs
```http
POST /api/v1/vitesse/integrations/{integration_id}/ingest
```

**Request Body:**
```json
{
  "source_spec_url": "https://api.salesforce.com/openapi.json",
  "dest_spec_url": "https://api.hubspot.com/openapi.json"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "MAPPING",
  "data": {
    "source_endpoints": ["/customers", "/contacts"],
    "dest_endpoints": ["/contacts", "/deals"],
    "next_step": "map",
    "next_endpoint": "/integrations/ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba/map"
  }
}
```

### Step 3: Generate Field Mappings

#### POST /integrations/{id}/map - Generate Mappings
```http
POST /api/v1/vitesse/integrations/{integration_id}/map
```

**Request Body:**
```json
{
  "source_endpoint": "/customers",
  "dest_endpoint": "/contacts",
  "mapping_hints": {
    "email": "email_address",
    "name": "full_name"
  }
}
```

**Response (200 OK):**
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

### Step 4: Run Tests

#### POST /integrations/{id}/test - Execute Tests
```http
POST /api/v1/vitesse/integrations/{integration_id}/test
```

**Request Body:**
```json
{
  "test_sample_size": 10,
  "skip_destructive": true
}
```

**Response (200 OK):**
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

### Step 5: Deploy Integration

#### POST /integrations/{id}/deploy - Deploy
```http
POST /api/v1/vitesse/integrations/{integration_id}/deploy
```

**Request Body:**
```json
{
  "replicas": 1,
  "memory_mb": 512,
  "cpu_cores": 0.5,
  "auto_scale": false
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "current_step": "ACTIVE",
  "data": {
    "container_id": "vitesse-ad9cb833",
    "service_url": "http://localhost:8080/ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
    "deployment_time_seconds": 15
  }
}
```

### Workflow Status Endpoints

#### GET /integrations - List All Integrations
```http
GET /api/v1/vitesse/integrations
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
      "name": "Salesforce to HubSpot Sync",
      "status": "active",
      "health_score": {
        "overall": 85,
        "data_quality": 90,
        "reliability": 80
      },
      "created_at": "2026-02-14T22:35:19",
      "created_by": "system"
    }
  ],
  "count": 1
}
```

#### GET /integrations/{id} - Get Integration Status
```http
GET /api/v1/vitesse/integrations/{integration_id}
```

**Response (200 OK):**
```json
{
  "integration_id": "ad9cb833-cd8d-4a49-8fcc-4a98bb3dbbba",
  "status": "active",
  "health_score": {
    "overall": 85,
    "data_quality": 90,
    "reliability": 80
  },
  "last_updated": "2026-02-14T22:36:31.507280"
}
```

#### DELETE /integrations/{id} - Delete Integration
```http
DELETE /api/v1/vitesse/integrations/{integration_id}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Integration and resources deleted"
}
```

### System Status

#### GET /status - Get Vitesse System Status
```http
GET /api/v1/vitesse/status
```

**Response (200 OK):**
```json
{
  "orchestrator_id": "vitesse-orchestrator-001",
  "ingestor_status": { "status": "ready" },
  "mapper_status": { "status": "ready" },
  "guardian_status": { "status": "ready" }
}
```

---

## Legacy Integration Builder (Deprecated)

The following endpoints are for reference only and have been superseded by the multi-step workflow:

### List Integrations
```http
GET /api/v1/integration-builder/
```

### Create Integration (Legacy)
```http
POST /api/v1/integration-builder/
```

### Get Integration (Legacy)
```http
GET /api/v1/integration-builder/{integration_id}
```

### Update Integration (Legacy)
```http
PUT /api/v1/integration-builder/{integration_id}
```

### Delete Integration (Legacy)
```http
DELETE /api/v1/integration-builder/{integration_id}
```

### Field Mappings

#### Add Field Mapping
```http
POST /api/v1/integration-builder/{integration_id}/field-mappings
```

**Request Body:**
```json
{
  "source_field": "customer.email",
  "target_field": "contact.email_address",
  "data_type": "string",
  "required": true,
  "transformation": "lowercase"
}
```

### Transformation Rules

#### Add Transformation Rule
```http
POST /api/v1/integration-builder/{integration_id}/transformations
```

**Request Body:**
```json
{
  "name": "Email Normalization",
  "description": "Convert emails to lowercase",
  "rule_type": "field_transformation",
  "source_field": "customer.email",
  "target_field": "contact.email_address",
  "transformation_logic": "value.lower()",
  "enabled": true
}
```

### Testing

#### Test Integration
```http
POST /api/v1/integration-builder/{integration_id}/test
```

**Request Body:**
```json
{
  "test_data": {
    "customer": {
      "email": "JOHN.DOE@EXAMPLE.COM",
      "first_name": "John",
      "last_name": "Doe"
    }
  }
}
```

#### Get Test Results
```http
GET /api/v1/integration-builder/{integration_id}/test-results
```

**Query Parameters:**
- `limit` (int, optional): Maximum number of results to return (default: 10, max: 50)

### Statistics

#### Get Integration Statistics
```http
GET /api/v1/integration-builder/stats/overview
```

**Response:**
```json
{
  "total_integrations": 15,
  "active_integrations": 8,
  "draft_integrations": 4,
  "testing_integrations": 3,
  "total_field_mappings": 127,
  "total_transformation_rules": 34,
  "average_success_rate": 92.3,
  "total_api_calls_today": 1250,
  "failed_calls_today": 45,
  "most_used_source_api": "Shopify API",
  "most_used_target_api": "Credo CRM API"
}
```

## Knowledge Harvester Scheduler Control

### Get Scheduler Status
```http
GET /api/v1/harvest-jobs/scheduler/status
```

**Response:**
```json
{
  "status": "success",
  "scheduler": {
    "is_running": true,
    "last_harvest_times": {
      "full": "2026-02-14T11:50:00",
      "incremental": "2026-02-14T11:50:00",
      "patterns": "2026-02-13T11:50:00",
      "standards": "2026-02-07T11:50:00"
    },
    "harvest_schedule": {
      "full": 168,
      "incremental": 24,
      "patterns": 48,
      "standards": 168
    },
    "harvester_initialized": true
  }
}
```

### Get Scheduler Configuration
```http
GET /api/v1/harvest-jobs/scheduler/config
```

**Response:**
```json
{
  "harvest_types": [
    {
      "id": "full",
      "name": "Full Harvest",
      "description": "Complete harvest of all API sources (longest)",
      "interval_hours": 168
    },
    {
      "id": "incremental",
      "name": "Incremental Update",
      "description": "Quick updates to recent and changed APIs (fastest)",
      "interval_hours": 24
    },
    {
      "id": "financial",
      "name": "Financial APIs",
      "description": "Harvest only financial services APIs",
      "interval_hours": 24
    },
    {
      "id": "patterns",
      "name": "Integration Patterns",
      "description": "Update integration patterns and transformations",
      "interval_hours": 48
    }
  ],
  "current_schedule": {
    "full": 168,
    "incremental": 24,
    "patterns": 48,
    "standards": 168
  }
}
```

### Start Scheduler
```http
POST /api/v1/harvest-jobs/scheduler/start
```

**Response:**
```json
{
  "status": "success",
  "message": "Knowledge Harvester Scheduler started"
}
```

### Stop Scheduler
```http
POST /api/v1/harvest-jobs/scheduler/stop
```

**Response:**
```json
{
  "status": "success",
  "message": "Knowledge Harvester Scheduler stopped"
}
```

### Update Scheduler Configuration
```http
POST /api/v1/harvest-jobs/scheduler/update-config
```

**Request Body:**
```json
{
  "harvest_interval_hours": 12,
  "schedule": {
    "full": 168,
    "incremental": 12,
    "patterns": 48,
    "standards": 168
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Scheduler configuration updated",
  "current_config": {
    "harvest_interval_hours": 12,
    "schedule": {
      "full": 168,
      "incremental": 12,
      "patterns": 48,
      "standards": 168
    }
  }
}
```

### Get Harvest Dashboard
```http
GET /api/v1/harvest-jobs/dashboard
```

**Response:**
```json
{
  "status": "success",
  "scheduler": {
    "is_running": true,
    "last_harvest_times": {...},
    "harvest_schedule": {...}
  },
  "statistics": {
    "total_jobs": 42,
    "running_jobs": 1,
    "completed_jobs": 40,
    "failed_jobs": 1,
    "success_rate": 95.2,
    "average_job_duration": 1800,
    "total_apis_harvested": 1200,
    "jobs_last_24h": 4,
    "jobs_last_7d": 18,
    "jobs_last_30d": 38,
    "most_common_harvest_type": "incremental",
    "peak_harvest_time": "02:00"
  },
  "recent_jobs": [
    {
      "id": "harvest-20260214-115000-a1b2c3d4",
      "harvest_type": "incremental",
      "status": "completed",
      "progress": 100,
      "apis_harvested": 45,
      "created_at": "2026-02-14T11:50:00",
      "completed_at": "2026-02-14T11:52:00"
    }
  ]
}
```

### Manually Trigger Harvest
```http
POST /api/v1/harvest-jobs/trigger
```

**Query Parameters:**
- `harvest_type` (str): Type of harvest (full, incremental, financial, api_directory, patterns, standards)
- `source_ids` (list, optional): Specific source IDs to harvest from

**Request Body:**
```json
{
  "harvest_type": "incremental",
  "source_ids": null
}
```

**Response:**
```json
{
  "status": "success",
  "job_id": "manual-20260214-115030-xyz789",
  "harvest_type": "incremental",
  "message": "Harvest job initiated"
}
```

## Database Implementation

All endpoints now use real database operations instead of mock data:

- **Harvest Jobs**: Stored in `harvest_jobs` table with progress tracking
- **Agent Activities**: Persisted in `agent_activities` table with real-time metrics
- **Communications**: Logged in `agent_communications` table for audit trails
- **Integrations**: Managed through `integrations`, `field_mappings`, and `transformation_rules` tables
- **Test Results**: Stored in `integration_test_results` table with execution details
- **Harvest Configuration**: Tracked in `harvest_sources` table with last harvest timestamps

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized (authentication required)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include detailed error messages for debugging.</content>
<parameter name="filePath">/Users/sujitm/Sandbox/vitesse/docs/api_endpoints.md