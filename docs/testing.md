# Automated Testing & Verification

Vitesse AI employs the **Guardian Agent** to ensure the reliability and correctness of generated integrations.

## The Guardian Agent

The Guardian Agent acts as an autonomous QA engineer. It validates integrations by running "shadow calls"—real HTTP requests against the source and destination APIs using synthetic data or replay traffic.

### Key Features

1.  **Shadow Testing**:
    -   Executes 100+ requests per integration test cycle.
    -   Verifies status codes, response times, and schema compliance.
    
2.  **Authentication Injection**:
    -   Automatically detects `auth_type` (API Key, Bearer Token, Basic) from the `Integration` configuration.
    -   Injects the correct credentials into every test request header.
    -   *Security Note*: Credentials are encrypted at rest (planned) and injected only during runtime.

3.  **Rate Limiting**:
    -   Implements client-side throttling to protect your API quotas.
    -   Default limit: **5 requests per second** (configurable).

4.  **Self-Healing**:
    -   If tests fail due to schema mismatches (e.g., 400 Bad Request), Guardian flags the integration for "Drift Detection," triggering the Ingestor agent to re-scan the API.

## Running Tests

### End-to-End Verification
To run a full verification of the entire Vitesse pipeline:

```bash
docker compose exec backend python verify_integration.py
```

### Manual Guardian Trigger
You can execute the Guardian independently via the `verify.sh` script (if configured) or by invoking the agent directly in python:

```python
from app.agents.guardian import VitesseGuardian
# ... initialization logic ...
guardian = VitesseGuardian()
results = await guardian.verify_integration(integration_id)
```
