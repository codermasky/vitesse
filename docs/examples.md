# Vitesse AI - Example: Shopify → Credo CRM Integration

## Overview

This example demonstrates creating a complete integration from Shopify's customer API to Credo CRM using Vitesse AI. It showcases:

1. API discovery (Ingestor)
2. Intelligent field mapping (Mapper)
3. Comprehensive testing (Guardian)
4. Deployment options

---

## Step 1: Create the Integration (Using API)

```bash
# Set your API endpoint
API_URL="http://localhost:8003/api/v1"

# First, test connectivity
curl -X POST $API_URL/vitesse/test-endpoint \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.shopify.com/swagger.json",
    "method": "GET"
  }'
```

### Create Integration Request

```bash
curl -X POST $API_URL/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "source_api_url": "https://api.shopify.com/2024-01/swagger.json",
    "source_api_name": "Shopify",
    "dest_api_url": "https://api.credo.com/v1/openapi.json",
    "dest_api_name": "Credo CRM",
    "user_intent": "Sync all customers from Shopify to Credo CRM",
    "deployment_target": "local",
    "source_auth": {
      "type": "oauth2",
      "token": "shppa_xxxxxxxxxxxx",
      "store_url": "mystore.myshopify.com"
    },
    "dest_auth": {
      "type": "api_key",
      "key": "sk_live_xxxxxxxxxxxx"
    },
    "metadata": {
      "team": "sales",
      "project": "omnichannel-sync",
      "sync_frequency": "hourly"
    }
  }'
```

### Expected Response

```json
{
  "status": "success",
  "integration_id": "integ_shopify_credo_20260212",
  "integration": {
    "id": "integ_shopify_credo_20260212",
    "name": "Shopify → Credo CRM",
    "status": "active",
    "source_api_spec": {
      "api_name": "Shopify",
      "api_version": "2024-01",
      "base_url": "https://mystore.myshopify.com/admin/api",
      "auth_type": "oauth2",
      "endpoints": [
        {
          "path": "/customers.json",
          "method": "GET",
          "description": "Retrieve all customers",
          "rate_limit": "2 requests per second"
        },
        {
          "path": "/customers/{id}.json",
          "method": "GET",
          "parameters": {
            "id": {"in": "path", "type": "string", "required": true}
          }
        },
        {
          "path": "/orders.json",
          "method": "GET"
        }
      ]
    },
    "dest_api_spec": {
      "api_name": "Credo CRM",
      "base_url": "https://api.credo.com/v1",
      "auth_type": "api_key",
      "endpoints": [
        {
          "path": "/contacts",
          "method": "POST",
          "description": "Create a new contact"
        },
        {
          "path": "/contacts/{id}",
          "method": "PUT"
        }
      ]
    },
    "mapping_logic": {
      "source_api": "Shopify",
      "dest_api": "Credo CRM",
      "source_endpoint": "/customers.json",
      "dest_endpoint": "/contacts",
      "transformations": [
        {
          "source_field": "email",
          "dest_field": "email",
          "transform_type": "direct"
        },
        {
          "source_field": "first_name",
          "dest_field": "first_name",
          "transform_type": "direct"
        },
        {
          "source_field": "last_name",
          "dest_field": "last_name",
          "transform_type": "direct"
        },
        {
          "source_field": "phone",
          "dest_field": "phone_number",
          "transform_type": "mapping"
        },
        {
          "source_field": "created_at",
          "dest_field": "created_date",
          "transform_type": "custom",
          "transform_config": {
            "function": "parse_iso8601_to_date"
          }
        },
        {
          "source_field": "total_spent",
          "dest_field": "lifetime_value",
          "transform_type": "parse",
          "transform_config": {"decimal_places": 2}
        },
        {
          "source_field": "tags",
          "dest_field": "segments",
          "transform_type": "collect"
        }
      ]
    },
    "health_score": {
      "integration_id": "integ_shopify_credo_20260212",
      "overall_score": 92.5,
      "endpoint_coverage": 100,
      "success_rate": 99.2,
      "response_time_p95": 245,
      "critical_issues": [],
      "warnings": [
        "Shopify API rate limit is 2 requests/sec - consider batching"
      ],
      "test_results": [
        {
          "test_id": "integ_shopify_credo_20260212_src_0",
          "endpoint": "/customers.json",
          "method": "GET",
          "status_code": 200,
          "response_time_ms": 185,
          "success": true
        },
        ...// 99 more test results
      ]
    }
  },
  "health_score": {
    "overall_score": 92.5,
    "success_rate": 99.2,
    "endpoint_coverage": 100
  }
}
```

---

## Step 2: Understand the Generated Mapping

The integration automatically generated this mapping:

| Shopify Field | Credo Field | Transformation | Notes |
|---|---|---|---|
| `email` | `email` | Direct | 1:1 match |
| `first_name` | `first_name` | Direct | Identical names |
| `last_name` | `last_name` | Direct | Identical names |
| `phone` | `phone_number` | Semantic map | Different names, same concept |
| `created_at` | `created_date` | Custom format conversion | ISO8601 → Date |
| `total_spent` | `lifetime_value` | Parse string to decimal | Shopify returns as string |
| `tags` (array) | `segments` (array) | Collect | Direct array mapping |

### Transformation Examples

```python
# Direct Transformation
"email" → "email"  # No changes

# Semantic Mapping
"phone" → "phone_number"  # LLM understood these mean the same

# Custom Transformation
"created_at" → "created_date"
# Input: "2024-01-15T10:30:00Z"
# Output: "2024-01-15"

# Parse Transformation
"total_spent" → "lifetime_value"
# Input: "1999.99" (string in Shopify)
# Output: 1999.99 (decimal in Credo)

# Collect Transformation
"tags": ["vip", "repeat"] → "segments": ["vip", "repeat"]
```

---

## Step 3: Monitor Health Score

```bash
# Check integration status
curl -X GET $API_URL/vitesse/integrations/integ_shopify_credo_20260212
```

### Health Score Breakdown

- **Overall Score: 92.5/100** ✅ PASS (≥70 required)
  - **Success Rate: 99.2%** (100 tests, 99 passed)
  - **Endpoint Coverage: 100%** (tested /customers, /orders, /contacts, /contacts/{id})
  - **Response Time p95: 245ms** (acceptable)

### Test Results Summary

```json
{
  "test_results": {
    "total": 100,
    "passed": 99,
    "failed": 1,
    "by_endpoint": {
      "/customers.json": {"tested": 50, "passed": 50},
      "/orders.json": {"tested": 30, "passed": 30},
      "/contacts": {"tested": 20, "passed": 19}  // 1 test failed
    },
    "error_detail": {
      "failed_test": "integ_shopify_credo_20260212_dst_15",
      "endpoint": "/contacts",
      "error": "Invalid email format",
      "payload": {"email": "invalid@domain..com"}
    }
  }
}
```

The failure is understood - it's a synthetic data generation issue, not an API problem.

---

## Step 4: Deploy the Integration

### Option A: Local Docker

```bash
# Deploy locally (auto-generated container)
docker-compose up -d vitesse-integration-shopify-credo

# Access the integration
curl http://localhost:8001/status
```

### Option B: VPS with Traefik

The integration is automatically:
- Built into a Docker image
- Pushed to your registry
- Deployed to your VPS
- Accessible at: `vitesse-integ_shopify_credo_20260212.your-domain.com`

### Option C: AWS EKS

```bash
# Deployer automatically:
# 1. Pushes image to ECR
# 2. Creates Kubernetes Deployment
# 3. Sets up Service and Ingress
# 4. Configures autoscaling (2-5 replicas)

# Monitor pods
kubectl get pods -n vitesse-prod -l integration=integ_shopify_credo

# View logs
kubectl logs -n vitesse-prod \
  -l app=vitesse-integration,integration=integ_shopify_credo \
  -f
```

---

## Step 5: Trigger Manual Sync

```bash
# Manual sync (sync all customers)
curl -X POST $API_URL/vitesse/integrations/integ_shopify_credo_20260212/sync

# Response
{
  "status": "success",
  "records_synced": 1247,
  "timestamp": "2024-02-12T18:45:30Z",
  "details": {
    "fetched_from_source": 1247,
    "transformed": 1247,
    "pushed_to_dest": 1247,
    "failed": 0,
    "sync_duration_seconds": 45.3
  }
}
```

### Scheduled Sync

The integration runs automatic syncs every hour (configured in metadata). To change:

```bash
# Update sync frequency
curl -X PUT $API_URL/vitesse/integrations/integ_shopify_credo_20260212 \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "sync_frequency": "every 30 minutes"
    }
  }'
```

---

## Step 6: Monitor Integration in Production

### Get Latest Health Score

```bash
curl -X GET $API_URL/vitesse/integrations/integ_shopify_credo_20260212
```

### Key Metrics to Watch

```json
{
  "health_score": {
    "overall_score": 92.5,
    "success_rate": 99.2,
    "endpoint_coverage": 100,
    "response_time_p95": 245,
    "critical_issues": [],
    "warnings": [
      "Shopify API rate limit is 2 requests/sec - consider batching"
    ]
  }
}
```

### Alerts (if health score drops)

If `overall_score < 70`:
1. **Guardian** detects the issue
2. **Mapper** is automatically re-triggered
3. New transformation logic is generated
4. Integration is re-tested
5. Developer is notified via webhook

---

## Troubleshooting

### Mapping Generated Fewer Transformations Than Expected

```json
// Expected ~15 transformations, got 8
"mapping_logic": {
  "transformations": [...]  // Only 8 items
}
```

**Solutions**:
1. Ensure Shopify schema is well-documented
2. Add more specific `user_intent`
3. Manually add missing transformations via UPDATE endpoint

### Health Score Below 70

```json
"health_score": {
  "overall_score": 62.0,  // FAILED
  "critical_issues": [
    "Rate limit exceeded: 5 tests",
    "Low success rate: 88.0%"
  ]
}
```

**Solutions**:
1. Implement batching (increase BATCH_SIZE)
2. Reduce test frequency
3. Check Shopify API limits
4. Verify API credentials

### Integration Container Crashing

```bash
# Check logs
kubectl logs integ-shopify-credo-abc123 -n vitesse-prod

# Common causes:
# - Invalid API credentials (403 errors)
# - Memory limit too low (OOM)
# - Sync interval too aggressive
```

---

## Next Steps

1. ✅ Integration created and tested
2. ✅ Deployed to production
3. ⏭️ **Monitor daily for 1 week**
4. ⏭️ Add error notifications to Slack
5. ⏭️ Create additional integrations (Orders, Products, etc)
6. ⏭️ Scale to EKS when volume increases

---

## Real-World Considerations

### Idempotency
- Shopify customer emails are unique
- Use email as deduplication key in Credo
- Add idempotency tracking to handle retries

### Incremental Syncs
```python
# Instead of syncing all customers every hour,
# sync only modified customers since last sync:

# Modification endpoint: GET /customers.json?updated_at_min={timestamp}
# Store last_sync_timestamp in integration metadata
```

### Handling New Fields
- If Shopify adds new fields, Mapper automatically includes them
- Guardian tests will discover incompatibilities
- Self-healing triggers Mapper re-generation

### Rate Limiting
- Shopify: 2 requests/sec per app
- Respect backoff headers (X-Shopify-Shop-Api-Call-Limit)
- Implement exponential backoff in Guardian tests

---

## Performance Tips

| Configuration | Value | Impact |
|---|---|---|
| `BATCH_SIZE` | 500 | Reduces API calls by 90% |
| `SYNC_INTERVAL_SECONDS` | 3600 | Balances freshness vs load |
| `REPLICAS` | 3 | Distributes load across instances |
| Connection Pool Size | 20 | Optimizes DB connections |

---

## Conclusion

This example demonstrates Vitesse AI's end-to-end integration workflow:

1. ⚡ **Discovery** (Ingestor) - 2 minutes
2. 🧠 **Mapping** (Mapper) - 3 minutes
3. ✅ **Testing** (Guardian) - 5 minutes
4. 🚀 **Deployment** - 1 minute

**Total: ~11 minutes** from "I want to sync Shopify to Credo" to production-ready integration.

Without Vitesse, this would take 3-4 weeks of engineering work!
