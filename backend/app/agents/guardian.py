"""
Guardian Agent: Tests integrations and implements self-healing.
Generates synthetic data, runs shadow calls, and detects API changes.
"""

import httpx
import json
import random
from typing import Any, Dict, Optional, List
from datetime import datetime
import structlog
from app.agents.base import GuardianAgent, AgentContext
from app.schemas.integration import HealthScore, TestResult
from app.services.drift.detector import SchemaDriftDetector, SchemaDriftReport

logger = structlog.get_logger(__name__)


class VitesseGuardian(GuardianAgent):
    """
    Concrete implementation of Guardian agent.
    Handles testing, validation, and self-healing of integrations.
    """

    def __init__(self, context: AgentContext, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id)
        self.context = context
        self.test_results: List[TestResult] = []

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Run comprehensive tests and generate health score.

        Input:
            - integration_instance: Full integration object
            - test_count: Number of shadow calls (default 100)
            - source_endpoint: Endpoint to test on source
            - dest_endpoint: Endpoint to test on destination

        Output:
            - health_score: HealthScore object
            - test_results: List of TestResult objects
            - critical_issues: List of issues found
        """
        integration = input_data.get("integration_instance")
        test_count = input_data.get("test_count", 100)
        source_endpoint = input_data.get("source_endpoint")
        dest_endpoint = input_data.get("dest_endpoint")

        if not integration or not source_endpoint or not dest_endpoint:
            raise ValueError(
                "integration_instance, source_endpoint, dest_endpoint required"
            )

        integration_id = integration.get("id")
        logger.info(
            "Guardian starting tests",
            integration_id=integration_id,
            test_count=test_count,
        )

        try:
            self.test_results = []

            # Step 1: Extract API specs
            source_spec = integration.get("source_api_spec", {})
            dest_spec = integration.get("dest_api_spec", {})

            # --- START SELF-HEALING CHECK ---
            # Check for passed "latest_source_spec" to detect drift
            latest_source_spec = input_data.get("latest_source_spec")
            drift_report = None

            if latest_source_spec:
                logger.info("Checking for schema drift", integration_id=integration_id)
                detector = SchemaDriftDetector()
                drift_report = detector.detect_drift(source_spec, latest_source_spec)

                if drift_report.drift_type != "none":
                    logger.warning(
                        "Schema drift detected",
                        type=drift_report.drift_type,
                        severity=drift_report.severity,
                    )

                    if drift_report.drift_type == "breaking":
                        input_data["drift_detected"] = True
                        input_data["drift_report"] = drift_report.model_dump()
            # --- END SELF-HEALING CHECK ---

            # Step 2: Generate synthetic test data
            synthetic_data = await self._generate_synthetic_data(
                source_endpoint=source_endpoint,
                source_spec=source_spec,
                test_count=test_count,
            )

            logger.info(
                "Synthetic data generated",
                integration_id=integration_id,
                data_count=len(synthetic_data),
            )

            # Step 3: Run shadow calls
            await self._run_shadow_calls(
                integration_id=integration_id,
                source_spec=source_spec,
                dest_spec=dest_spec,
                source_endpoint=source_endpoint,
                dest_endpoint=dest_endpoint,
                test_data=synthetic_data,
            )

            # Step 4: Analyze results
            health_score = self._analyze_results(
                integration_id=integration_id,
                test_results=self.test_results,
            )

            # Step 5: Detect critical issues
            critical_issues = self._detect_issues(self.test_results)

            # Add drift info to critical issues if present
            if drift_report and drift_report.drift_type != "none":
                critical_issues.append(
                    f"Schema Drift Detected: {drift_report.drift_type} ({drift_report.severity})"
                )

            if critical_issues:
                logger.warning(
                    "Critical issues detected",
                    integration_id=integration_id,
                    issue_count=len(critical_issues),
                )

                if "Schema Drift Detected" in str(critical_issues):
                    logger.info(
                        "Initiating Self-Healing Protocol: Requesting Re-Mapping"
                    )

            return {
                "status": "success",
                "health_score": health_score.model_dump(),
                "test_count": len(self.test_results),
                "success_rate": health_score.success_rate,
                "critical_issues": critical_issues,
                "drift_report": drift_report.model_dump() if drift_report else None,
                "testing_time_seconds": (
                    datetime.utcnow() - context.get("start_time", datetime.utcnow())
                ).total_seconds(),
            }

        except Exception as e:
            logger.error(
                "Guardian test execution failed",
                error=str(e),
                integration_id=integration.get("id"),
            )
            return {
                "status": "failed",
                "error": str(e),
            }

    async def _generate_synthetic_data(
        self,
        source_endpoint: str,
        source_spec: Dict[str, Any],
        test_count: int,
    ) -> List[Dict[str, Any]]:
        """Generate synthetic test data."""
        # Find the endpoint to get its schema
        endpoints = source_spec.get("endpoints", [])
        target_endpoint = None

        for ep in endpoints:
            if isinstance(ep, dict):
                if ep.get("path") == source_endpoint:
                    target_endpoint = ep
                    break
            else:
                if hasattr(ep, "path") and ep.path == source_endpoint:
                    target_endpoint = ep
                    break

        if not target_endpoint:
            logger.warning("Could not find endpoint schema", endpoint=source_endpoint)
            target_endpoint = {}

        # Extract schema
        if isinstance(target_endpoint, dict):
            schema = target_endpoint.get("response_schema", {})
        else:
            schema = getattr(target_endpoint, "response_schema", {})

        # Generate synthetic data based on schema
        synthetic_data = []
        for i in range(test_count):
            data = self._generate_from_schema(schema, iteration=i)
            synthetic_data.append(data)

        return synthetic_data

    def _generate_from_schema(
        self, schema: Dict[str, Any], iteration: int = 0
    ) -> Dict[str, Any]:
        """Generate synthetic data from JSON schema."""
        if not schema or schema.get("type") != "object":
            return self._generate_default_value("string", iteration)

        data = {}
        properties = schema.get("properties", {})

        for field_name, field_schema in properties.items():
            field_type = field_schema.get("type", "string")
            data[field_name] = self._generate_default_value(field_type, iteration)

        return data

    def _generate_default_value(self, field_type: str, iteration: int = 0) -> Any:
        """Generate default value for a field type."""
        if field_type == "string":
            return f"test_value_{iteration}"
        elif field_type == "integer":
            return iteration
        elif field_type == "number":
            return float(iteration) + random.random()
        elif field_type == "boolean":
            return iteration % 2 == 0
        elif field_type == "array":
            return []
        elif field_type == "object":
            return {}
        else:
            return None

    def _get_auth_headers(self, spec: Dict[str, Any]) -> Dict[str, str]:
        """Construct authentication headers from spec configuration."""
        headers = {}

        # Add global headers defined in spec
        if "headers" in spec and isinstance(spec["headers"], dict):
            headers.update(spec["headers"])

        auth_type = spec.get("auth_type", "none")
        auth_config = spec.get("auth_config", {})

        if not isinstance(auth_config, dict):
            auth_config = {}

        if auth_type == "api_key":
            name = auth_config.get("name", "X-API-Key")
            # Try to find the key in various places
            key = (
                auth_config.get("key")
                or auth_config.get("value")
                or auth_config.get("api_key")
            )
            if key:
                headers[name] = str(key)

        elif auth_type == "bearer_token":
            token = auth_config.get("token") or auth_config.get("value")
            if token:
                headers["Authorization"] = f"Bearer {token}"

        elif auth_type == "basic":
            import base64

            username = auth_config.get("username", "")
            password = auth_config.get("password", "")
            if username and password:
                credentials = f"{username}:{password}"
                encoded = base64.b64encode(credentials.encode()).decode()
                headers["Authorization"] = f"Basic {encoded}"

        return headers

    async def _run_shadow_calls(
        self,
        integration_id: str,
        source_spec: Dict[str, Any],
        dest_spec: Dict[str, Any],
        source_endpoint: str,
        dest_endpoint: str,
        test_data: List[Dict[str, Any]],
    ):
        """Execute shadow calls to both APIs."""
        # Rate limiting configuration (requests per second)
        rps = 5.0
        delay = 1.0 / rps

        # Prepare auth headers
        source_headers = self._get_auth_headers(source_spec)
        dest_headers = self._get_auth_headers(dest_spec)

        async with httpx.AsyncClient(timeout=10.0) as client:
            for idx, data in enumerate(test_data):
                try:
                    import asyncio

                    # Simple rate limiting
                    if idx > 0:
                        await asyncio.sleep(delay)

                    # Source API call (GET/read test)
                    await self._test_endpoint(
                        client=client,
                        test_id=f"{integration_id}_src_{idx}",
                        spec=source_spec,
                        endpoint=source_endpoint,
                        method="GET",
                        data=data,
                        is_source=True,
                        headers=source_headers,
                    )

                    # Destination API call (POST/write test)
                    await self._test_endpoint(
                        client=client,
                        test_id=f"{integration_id}_dst_{idx}",
                        spec=dest_spec,
                        endpoint=dest_endpoint,
                        method="POST",
                        data=data,
                        is_source=False,
                        headers=dest_headers,
                    )

                except Exception as e:
                    logger.debug(
                        "Shadow call failed",
                        test_id=f"{integration_id}_{idx}",
                        error=str(e),
                    )

    async def _test_endpoint(
        self,
        client: httpx.AsyncClient,
        test_id: str,
        spec: Dict[str, Any],
        endpoint: str,
        method: str,
        data: Dict[str, Any],
        is_source: bool,
        headers: Optional[Dict[str, str]] = None,
    ):
        """Test a single endpoint."""
        base_url = spec.get("base_url", "http://localhost:8000")
        url = f"{base_url}{endpoint}"

        try:
            import time

            start_time = time.time()
            req_headers = headers or {}

            if method == "GET":
                response = await client.get(url, timeout=5, headers=req_headers)
            elif method == "POST":
                response = await client.post(
                    url, json=data, timeout=5, headers=req_headers
                )
            else:
                response = await client.request(
                    method, url, json=data, timeout=5, headers=req_headers
                )

            response_time_ms = (time.time() - start_time) * 1000

            success = 200 <= response.status_code < 300

            test_result = TestResult(
                test_id=test_id,
                endpoint=endpoint,
                method=method,
                status_code=response.status_code,
                response_time_ms=response_time_ms,
                success=success,
                error_message=None if success else f"Status {response.status_code}",
            )

            self.test_results.append(test_result)

        except Exception as e:
            test_result = TestResult(
                test_id=test_id,
                endpoint=endpoint,
                method=method,
                status_code=0,
                response_time_ms=0,
                success=False,
                error_message=str(e),
            )
            self.test_results.append(test_result)

    def _analyze_results(
        self,
        integration_id: str,
        test_results: List[TestResult],
    ) -> HealthScore:
        """Analyze test results and generate health score."""
        if not test_results:
            return HealthScore(
                integration_id=integration_id,
                overall_score=0,
                endpoint_coverage=0,
                success_rate=0,
                response_time_p95=0,
            )

        # Calculate metrics
        successful = sum(1 for r in test_results if r.success)
        success_rate = (successful / len(test_results)) * 100

        response_times = sorted([r.response_time_ms for r in test_results])
        p95_idx = int(len(response_times) * 0.95)
        response_time_p95 = response_times[min(p95_idx, len(response_times) - 1)]

        # Unique endpoints tested
        unique_endpoints = len(set(r.endpoint for r in test_results))
        endpoint_coverage = min(
            (unique_endpoints / 5) * 100, 100
        )  # Assume ~5 endpoints

        # Overall score (weighted)
        overall_score = (success_rate * 0.7) + (endpoint_coverage * 0.3)

        return HealthScore(
            integration_id=integration_id,
            overall_score=overall_score,
            endpoint_coverage=endpoint_coverage,
            success_rate=success_rate,
            response_time_p95=response_time_p95,
            test_results=test_results,
        )

    def _detect_issues(self, test_results: List[TestResult]) -> List[str]:
        """Detect critical issues in test results."""
        issues = []

        success_rate = (
            sum(1 for r in test_results if r.success) / len(test_results)
            if test_results
            else 0
        )

        if success_rate < 0.95:
            issues.append(f"Low success rate: {success_rate * 100:.1f}%")

        # Check for auth failures
        auth_failures = sum(1 for r in test_results if r.status_code == 401)
        if auth_failures > 0:
            issues.append(f"Authentication failures: {auth_failures} tests")

        # Check for rate limiting
        rate_limit_errors = sum(1 for r in test_results if r.status_code == 429)
        if rate_limit_errors > 0:
            issues.append(f"Rate limit exceeded: {rate_limit_errors} tests")

        # Check for schema mismatches
        schema_errors = sum(1 for r in test_results if r.status_code == 400)
        if schema_errors > 0:
            issues.append(f"Potential schema mismatches: {schema_errors} tests")

        return issues
