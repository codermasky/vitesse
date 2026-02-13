"""
Ingestor Agent: Discovers and parses API specifications.
Converts Swagger/OpenAPI docs into standardized APISpecification objects.
"""

import httpx
import json
from typing import Any, Dict, Optional, List
from datetime import datetime
import structlog
from app.agents.base import IngestorAgent, AgentContext
from app.schemas.integration import APISpecification, APIEndpoint, APIAuthType
from app.services.llm_provider import LLMProviderService

logger = structlog.get_logger(__name__)


class VitesseIngestor(IngestorAgent):
    """
    Concrete implementation of Ingestor agent.
    Parses API documentation and Swagger/OpenAPI specs.
    Authonomously synthesizes specs from HTML documentation if Swagger/OpenAPI is missing.
    """

    def __init__(self, context: AgentContext, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id)
        self.context = context
        self.http_client = None

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Parse API documentation and generate APISpecification.

        Input:
            - api_url: URL to API docs or Swagger spec
            - api_name: Human-readable name
            - auth_details: Optional auth config
            - spec_url: Optional direct URL to OpenAPI/Swagger spec

        Output:
            - api_spec: APISpecification object
            - endpoints_found: List of discovered endpoints
            - auth_detected: Detected auth type
        """
        api_url = input_data.get("api_url")
        api_name = input_data.get("api_name")
        auth_details = input_data.get("auth_details", {})
        spec_url = input_data.get("spec_url")

        if not api_url or not api_name:
            raise ValueError("api_url and api_name are required")

        logger.info(
            "Ingestor starting",
            api_name=api_name,
            api_url=api_url,
            has_spec_url=spec_url is not None,
        )

        try:
            # Step 1: Fetch documentation
            spec_content = await self._fetch_spec(api_url, spec_url)
            logger.info("Specification fetched", bytes_size=len(spec_content))

            # Step 2: Try to parse as Swagger/OpenAPI JSON
            try:
                parsed_spec = self._parse_openapi_spec(spec_content)
                logger.info("Successfully parsed as OpenAPI/Swagger JSON")

                # Standard extraction path
                endpoints = self._extract_endpoints(parsed_spec)
                auth_type, auth_config = self._extract_auth(parsed_spec, auth_details)
                rate_limits = self._extract_rate_limits(parsed_spec)
                headers = self._extract_headers(parsed_spec)
                pagination = self._detect_pagination(endpoints)

                api_spec = APISpecification(
                    source_url=api_url,
                    api_name=api_name,
                    api_version=parsed_spec.get("info", {}).get("version", "1.0.0"),
                    base_url=self._extract_base_url(parsed_spec, api_url),
                    auth_type=auth_type,
                    auth_config=auth_config,
                    endpoints=endpoints,
                    headers=headers,
                    rate_limits=rate_limits,
                    pagination_style=pagination,
                )

            except json.JSONDecodeError:
                # Fallback: Synthesize spec from HTML using LLM
                logger.warning(
                    "Failed to parse as JSON, triggering LLM synthesis from HTML"
                )

                api_spec = await self._synthesize_spec_from_html(
                    html_content=spec_content,
                    api_url=api_url,
                    api_name=api_name,
                    auth_details=auth_details,
                )

                endpoints = api_spec.endpoints
                auth_type = api_spec.auth_type

            return {
                "status": "success",
                "api_spec": api_spec.model_dump(),
                "endpoints_count": len(endpoints),
                "auth_type": auth_type.value,
                "discovery_time_seconds": (
                    datetime.utcnow() - context.get("start_time", datetime.utcnow())
                ).total_seconds(),
            }

        except Exception as e:
            logger.error("Ingestor failed", error=str(e))
            return {
                "status": "failed",
                "error": str(e),
            }

    async def _synthesize_spec_from_html(
        self,
        html_content: str,
        api_url: str,
        api_name: str,
        auth_details: Dict[str, Any],
    ) -> APISpecification:
        """
        Synthesize an OpenAPI specification from raw HTML documentation using an LLM.
        """
        try:
            # Create LLM instance
            llm = await LLMProviderService.create_llm(agent_id=self.agent_id)

            # Truncate HTML if too large (simple heuristic, could be improved)
            # Most LLMs have ~128k context, so ~400k chars is safe-ish, but let's be conservative
            truncated_html = html_content[:100000]

            prompt = f"""
            You are an expert API Ingestor. Your task is to extract a structured API specification from the provided raw API documentation HTML.
            
            Target API: {api_name}
            Documentation URL: {api_url}
            
            Instructions:
            1. Analyze the HTML content to identify all API endpoints.
            2. Extract HTTP methods, paths, and descriptions.
            3. Infer schema definitions for requests and responses where possible.
            4. Detect authentication mechanisms.
            5. Identify the Base URL.
            
            Output strictly a valid APISpecification object.
            
            Raw Documentation HTML (Truncated):
            {truncated_html}
            """

            logger.info("Invoking LLM for spec synthesis", api_name=api_name)

            result = await LLMProviderService.invoke_structured_with_monitoring(
                llm_instance=llm,
                prompt=prompt,
                schema=APISpecification,
                agent_id=self.agent_id,
                operation_name="synthesize_spec",
                db=self.context.db_session,
            )

            # Post-processing: ensure source_url and api_name are correct if LLM hallucinated
            result.source_url = api_url
            result.api_name = api_name
            if not result.base_url:
                result.base_url = api_url

            return result

        except Exception as e:
            logger.error("LLM synthesis failed", error=str(e))
            raise ValueError(f"Failed to synthesize API spec from HTML: {str(e)}")

    async def _fetch_spec(self, api_url: str, spec_url: Optional[str] = None) -> str:
        """Fetch API specification from URL."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(
            timeout=30.0, follow_redirects=True, headers=headers
        ) as client:
            errors = []
            try:
                # If spec_url is provided, use it directly
                if spec_url:
                    logger.info("Fetching spec from provided spec_url", url=spec_url)
                    try:
                        response = await client.get(spec_url)
                        if response.status_code == 200:
                            return response.text
                        errors.append(f"{spec_url}: {response.status_code}")
                    except Exception as e:
                        logger.warning(
                            "Error fetching from spec_url", url=spec_url, error=str(e)
                        )
                        errors.append(f"{spec_url}: {str(e)}")

                # Check if api_url itself returns JSON (it might be the spec)
                try:
                    response = await client.get(api_url)
                    if response.status_code == 200:
                        content_type = response.headers.get("content-type", "")
                        if (
                            "application/json" in content_type
                            or response.text.strip().startswith("{")
                        ):
                            return response.text
                        # If HTML, we return it for synthesis
                        return response.text
                    errors.append(f"{api_url}: {response.status_code}")
                except Exception as e:
                    logger.warning("Error fetching api_url", url=api_url, error=str(e))
                    errors.append(f"{api_url}: {str(e)}")

                # Try common Swagger/OpenAPI paths
                swagger_paths = [
                    f"{api_url.rstrip('/')}/swagger.json",
                    f"{api_url.rstrip('/')}/openapi.json",
                    f"{api_url.rstrip('/swagger.json')}/openapi.json",
                ]

                for path in swagger_paths:
                    try:
                        response = await client.get(path)
                        if response.status_code == 200:
                            return response.text
                        errors.append(f"{path}: {response.status_code}")
                    except Exception as e:
                        logger.debug(
                            "Failed to fetch from path", path=path, error=str(e)
                        )
                        errors.append(f"{path}: {str(e)}")

                # If we have content from api_url (likely HTML), return it
                # The _execute method will try to parse as JSON, fail, and then trigger synthesis
                raise Exception(f"Could not fetch data. Details: {'; '.join(errors)}")

            except Exception as e:
                logger.error("Fetch spec failed", error=str(e))
                raise

    def _parse_openapi_spec(self, spec_content: str) -> Dict[str, Any]:
        """Parse OpenAPI/Swagger JSON specification."""
        try:
            spec = json.loads(spec_content)
            return spec
        except json.JSONDecodeError as e:
            logger.error("Failed to parse JSON", error=str(e))
            raise

    def _extract_endpoints(self, spec: Dict[str, Any]) -> List[APIEndpoint]:
        """Extract API endpoints from OpenAPI spec."""
        endpoints = []

        paths = spec.get("paths", {})
        for path, path_item in paths.items():
            # Skip if path_item is not a dict (could be None, list, etc.)
            if not isinstance(path_item, dict):
                logger.debug(
                    "Skipping non-dict path item", path=path, type=type(path_item)
                )
                continue

            for method, operation in path_item.items():
                # Skip non-dict operations
                if not isinstance(operation, dict):
                    continue

                if method.lower() in ["get", "post", "put", "delete", "patch"]:
                    endpoint = APIEndpoint(
                        path=path,
                        method=method.upper(),
                        description=operation.get("summary", "")
                        or operation.get("description", ""),
                        parameters=self._extract_parameters(operation),
                        request_schema=self._extract_request_schema(operation),
                        response_schema=self._extract_response_schema(operation),
                        auth_required=self._is_auth_required(operation, spec),
                    )
                    endpoints.append(endpoint)

        return endpoints

    def _extract_parameters(self, operation: Dict[str, Any]) -> Dict[str, Any]:
        """Extract path/query parameters."""
        params = {}
        for param in operation.get("parameters", []):
            if not isinstance(param, dict):
                continue
            param_name = param.get("name")
            param_in = param.get("in", "query")
            if param_name:
                params[param_name] = {
                    "in": param_in,
                    "required": param.get("required", False),
                    "type": param.get("schema", {}).get("type", "string"),
                }
        return params

    def _extract_request_schema(
        self, operation: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Extract request body schema."""
        request_body = operation.get("requestBody", {})
        if not isinstance(request_body, dict):
            return None
        content = request_body.get("content", {})
        if not isinstance(content, dict):
            return None
        json_content = content.get("application/json", {})
        if not isinstance(json_content, dict):
            return None
        return json_content.get("schema", None)

    def _extract_response_schema(
        self, operation: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Extract response schema (200 status)."""
        responses = operation.get("responses", {})
        if not isinstance(responses, dict):
            return None
        ok_response = responses.get("200", {})
        if not isinstance(ok_response, dict):
            return None
        content = ok_response.get("content", {})
        if not isinstance(content, dict):
            return None
        json_content = content.get("application/json", {})
        if not isinstance(json_content, dict):
            return None
        return json_content.get("schema", None)

    def _is_auth_required(
        self, operation: Dict[str, Any], spec: Dict[str, Any]
    ) -> bool:
        """Check if authentication is required for endpoint."""
        security = operation.get("security", spec.get("security", []))
        return len(security) > 0

    def _extract_auth(
        self,
        spec: Dict[str, Any],
        provided_auth: Dict[str, Any],
    ) -> tuple[APIAuthType, Dict[str, Any]]:
        """Extract authentication configuration from spec."""
        components = spec.get("components", {})
        if not isinstance(components, dict):
            components = {}
        security_schemes = components.get("securitySchemes", {})
        if not isinstance(security_schemes, dict):
            security_schemes = {}

        if provided_auth:
            auth_type_str = provided_auth.get("type", "api_key").lower()
            if auth_type_str == "oauth2":
                return APIAuthType.OAUTH2, provided_auth
            elif auth_type_str == "api_key":
                return APIAuthType.API_KEY, provided_auth
            elif auth_type_str == "bearer":
                return APIAuthType.BEARER_TOKEN, provided_auth
            elif auth_type_str == "basic":
                return APIAuthType.BASIC, provided_auth

        # Auto-detect from spec
        for scheme_name, scheme in security_schemes.items():
            if not isinstance(scheme, dict):
                continue
            scheme_type = scheme.get("type", "").lower()
            if scheme_type == "oauth2":
                return APIAuthType.OAUTH2, {"name": scheme_name, "spec": scheme}
            elif scheme_type == "apikey":
                return APIAuthType.API_KEY, {"name": scheme_name, "spec": scheme}
            elif scheme_type == "http":
                scheme_scheme = scheme.get("scheme", "").lower()
                if scheme_scheme == "bearer":
                    return APIAuthType.BEARER_TOKEN, {
                        "name": scheme_name,
                        "spec": scheme,
                    }
                elif scheme_scheme == "basic":
                    return APIAuthType.BASIC, {"name": scheme_name, "spec": scheme}

        return APIAuthType.NONE, {}

    def _extract_rate_limits(self, spec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract rate limit information."""
        info = spec.get("info", {})
        if not isinstance(info, dict):
            return None
        # Look for rate limit info in extensions
        rate_limit_ext = info.get("x-rate-limit", {})
        return rate_limit_ext if rate_limit_ext else None

    def _extract_headers(self, spec: Dict[str, Any]) -> Dict[str, str]:
        """Extract required headers from spec."""
        headers = {}
        components = spec.get("components", {})
        if not isinstance(components, dict):
            return headers
        security_schemes = components.get("securitySchemes", {})
        if not isinstance(security_schemes, dict):
            return headers

        for scheme_name, scheme in security_schemes.items():
            if not isinstance(scheme, dict):
                continue
            if scheme.get("type") == "apiKey" and scheme.get("in") == "header":
                header_name = scheme.get("name")
                if header_name:
                    headers[header_name] = (
                        f"Required: {scheme.get('description', 'API Key')}"
                    )

        return headers

    def _detect_pagination(self, endpoints: List[APIEndpoint]) -> Optional[str]:
        """Detect pagination style used in API."""
        # Simple heuristic: check parameter names
        for endpoint in endpoints:
            params = endpoint.parameters
            if "page" in params or "limit" in params or "offset" in params:
                return "offset"
            elif "cursor" in params or "after" in params or "before" in params:
                return "cursor"
            elif "page_token" in params or "pageToken" in params:
                return "token"
        return None

    def _extract_base_url(self, spec: Dict[str, Any], api_url: str) -> str:
        """Extract base URL from spec."""
        servers = spec.get("servers", [])
        if servers and isinstance(servers, list) and len(servers) > 0:
            first_server = servers[0]
            if isinstance(first_server, dict):
                return first_server.get("url", api_url)
        return api_url
