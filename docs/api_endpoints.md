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

## Integration Builder

### Integrations

#### List Integrations
```http
GET /api/v1/integration-builder/
```

**Query Parameters:**
- `skip` (int, optional): Number of integrations to skip (default: 0)
- `limit` (int, optional): Maximum number of integrations to return (default: 50, max: 100)
- `status` (str, optional): Filter by integration status

#### Create Integration
```http
POST /api/v1/integration-builder/
```

**Request Body:**
```json
{
  "name": "Shopify to Credo CRM Integration",
  "description": "Sync customer data from Shopify to Credo CRM",
  "source_api": "Shopify API",
  "target_api": "Credo CRM API"
}
```

#### Get Integration
```http
GET /api/v1/integration-builder/{integration_id}
```

#### Update Integration
```http
PUT /api/v1/integration-builder/{integration_id}
```

#### Delete Integration
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

## Database Implementation

All endpoints now use real database operations instead of mock data:

- **Harvest Jobs**: Stored in `harvest_jobs` table with progress tracking
- **Agent Activities**: Persisted in `agent_activities` table with real-time metrics
- **Communications**: Logged in `agent_communications` table for audit trails
- **Integrations**: Managed through `integrations`, `field_mappings`, and `transformation_rules` tables
- **Test Results**: Stored in `integration_test_results` table with execution details

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

Error responses include detailed error messages for debugging.</content>
<parameter name="filePath">/Users/sujitm/Sandbox/vitesse/docs/api_endpoints.md