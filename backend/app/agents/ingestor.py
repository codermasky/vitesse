"""
Ingestor Agent: Discovers and parses API specifications.
Converts Swagger/OpenAPI docs into standardized APISpecification objects.
"""

import httpx
import json
from typing import Any, Dict, Optional, List
from datetime import datetime
import structlog
from app.agents.base import VitesseAgent, AgentContext
from aether.protocols.intelligence import IntelligenceProvider
from app.schemas.integration import APISpecification, APIEndpoint, APIAuthType
from app.services.llm_provider import LLMProviderService

logger = structlog.get_logger(__name__)


class VitesseIngestor(VitesseAgent):
    """
    Concrete implementation of Ingestor agent.
    Parses API documentation and Swagger/OpenAPI specs.
    Authonomously synthesizes specs from HTML documentation if Swagger/OpenAPI is missing.
    """

    def __init__(
        self,
        context: AgentContext,
        agent_id: Optional[str] = None,
        intelligence: Optional[IntelligenceProvider] = None,
    ):
        super().__init__(
            agent_id=agent_id, intelligence=intelligence, agent_type="ingestor"
        )
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

        # Detect placeholder URLs that can't be fetched
        is_placeholder = self._is_placeholder_url(api_url) or (
            spec_url and self._is_placeholder_url(spec_url)
        )

        try:
            # If we have placeholder URLs, skip fetching and go straight to LLM synthesis
            if is_placeholder:
                logger.info(
                    "Detected placeholder URL, using autonomous LLM synthesis",
                    api_name=api_name,
                )
                # Fetch the documentation URL instead
                doc_url = input_data.get("documentation_url", api_url)
                if not self._is_placeholder_url(doc_url):
                    spec_content = await self._fetch_spec(doc_url, None)
                    api_spec = await self._synthesize_spec_from_html(
                        html_content=spec_content,
                        api_url=api_url,
                        api_name=api_name,
                        auth_details=auth_details,
                    )
                else:
                    # Even the doc URL is a placeholder, use LLM with minimal context
                    logger.warning(
                        "All URLs are placeholders, synthesizing from API name only"
                    )
                    api_spec = await self._synthesize_spec_from_name(
                        api_name=api_name,
                        api_url=api_url,
                        auth_details=auth_details,
                    )

                endpoints = api_spec.endpoints
                auth_type = api_spec.auth_type

            else:
                try:
                    # Step 1: Fetch documentation
                    spec_content = await self._fetch_spec(api_url, spec_url)
                    logger.info("Specification fetched", bytes_size=len(spec_content))
                except Exception as e:
                    logger.warning(
                        "Failed to fetch spec/docs, falling back to autonomous synthesis",
                        error=str(e),
                    )
                    api_spec = await self._synthesize_spec_from_name(
                        api_name=api_name,
                        api_url=api_url,
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
                            datetime.utcnow()
                            - context.get("start_time", datetime.utcnow())
                        ).total_seconds(),
                    }

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
            
            Output strictly a valid JSON object matching this structure:
            {{
                "source_url": "{api_url}",
                "api_name": "{api_name}",
                "api_version": "1.0.0",
                "base_url": "THE_BASE_URL_YOU_FIND",
                "auth_type": "one of: oauth2, api_key, bearer_token, basic, none",
                "endpoints": [
                    {{
                        "path": "/example",
                        "method": "GET",
                        "description": "...",
                        "parameters": {{ "param_name": {{ "in": "query", "type": "string" }} }},
                        "response_schema": {{}}
                    }}
                ]
            }}

            IMPORTANT: 
            1. Return raw JSON only. DO NOT use markdown code blocks.
            2. "parameters" MUST be a dictionary keyed by parameter name, NOT a list.
            
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

    def _is_placeholder_url(self, url: str) -> bool:
        """Detect if a URL is a placeholder that can't be fetched."""
        if not url:
            return True
        # Common placeholder patterns
        placeholder_indicators = [
            "yourInstance",
            "{shop}",
            "{instance}",
            "{tenant}",
            "example.com",
            # "localhost" is valid for testing, so we don't block it
        ]
        return any(indicator in url for indicator in placeholder_indicators)

    async def _synthesize_spec_from_name(
        self,
        api_name: str,
        api_url: str,
        auth_details: Dict[str, Any],
    ) -> APISpecification:
        """
        Synthesize an API specification using only the API name and LLM knowledge.
        Used when even documentation URLs are placeholders.
        """
        try:
            llm = await LLMProviderService.create_llm(agent_id=self.agent_id)

            prompt = f"""You are an expert API architect. Generate a realistic API specification for the following API.

Target API: {api_name}
Placeholder Base URL: {api_url}

Your Goal:
Create a valid, working API specification that mimics the real-world API as closely as possible, based on your internal knowledge of this API's structure, endpoints, and authentication.

Instructions:
1. Recall the standard endpoints for {api_name} from your training data, documentation you have seen, and general web knowledge.
2. Recall the authentication method (OAuth2, API Key, etc.).
3. Define at least 3-5 core endpoints with their HTTP methods and paths.
4. Include realistic rate limits and headers.

4. Include realistic rate limits and headers.

If you cannot find specific details, use industry standard patterns for this type of service.

Output strictly a valid JSON object matching this structure:
{{
    "source_url": "{api_url}",
    "api_name": "{api_name}",
    "api_version": "1.0.0",
    "base_url": "THE_BASE_URL_YOU_DETERMINE",
    "auth_type": "one of: oauth2, api_key, bearer_token, basic, none",
    "endpoints": [
        {{
            "path": "/example",
            "method": "GET",
            "description": "...",
            "parameters": {{ "param_name": {{ "in": "query", "type": "string" }} }}, 
            "response_schema": {{}}
        }}
    ]
}}

IMPORTANT: 
1. Return raw JSON only. DO NOT use markdown code blocks.
2. "parameters" MUST be a dictionary keyed by parameter name, NOT a list.
"""

            from pydantic import BaseModel, Field
            from typing import List

            class SynthesizedEndpoint(BaseModel):
                path: str
                method: str
                description: str
                parameters: Dict[str, Any] = Field(default_factory=dict)
                response_schema: Dict[str, Any] = Field(default_factory=dict)

            class SynthesizedSpec(BaseModel):
                base_url: str
                auth_type: str
                auth_config: Dict[str, Any] = Field(default_factory=dict)
                endpoints: List[SynthesizedEndpoint]
                headers: Dict[str, str] = Field(default_factory=dict)
                rate_limits: Dict[str, Any] = Field(default_factory=dict)

            logger.info("Invoking LLM for spec synthesis from name", api_name=api_name)

            synthesized = await LLMProviderService.invoke_structured_with_monitoring(
                llm_instance=llm,
                prompt=prompt,
                schema=SynthesizedSpec,
                agent_id=self.agent_id,
                operation_name="synthesize_spec_from_name",
                db=self.context.db_session,
            )

            # Convert to APISpecification
            auth_type_map = {
                "oauth2": APIAuthType.OAUTH2,
                "api_key": APIAuthType.API_KEY,
                "bearer": APIAuthType.BEARER_TOKEN,
                "basic": APIAuthType.BASIC,
                "none": APIAuthType.NONE,
            }
            auth_type = auth_type_map.get(
                synthesized.auth_type.lower(), APIAuthType.API_KEY
            )

            endpoints = [
                APIEndpoint(
                    path=ep.path,
                    method=ep.method,
                    description=ep.description,
                    parameters=ep.parameters,
                    response_schema=ep.response_schema,
                )
                for ep in synthesized.endpoints
            ]

            api_spec = APISpecification(
                source_url=api_url,
                api_name=api_name,
                api_version="1.0.0",
                base_url=synthesized.base_url or api_url,
                auth_type=auth_type,
                auth_config=synthesized.auth_config or auth_details,
                endpoints=endpoints,
                headers=synthesized.headers,
                rate_limits=synthesized.rate_limits,
                pagination_style=None,
            )

            logger.info(
                "Successfully synthesized spec from name",
                endpoints_count=len(endpoints),
            )
            return api_spec

        except Exception as e:
            logger.error("Failed to synthesize spec from name", error=str(e))
            # Return a minimal fallback spec
            return APISpecification(
                source_url=api_url,
                api_name=api_name,
                api_version="1.0.0",
                base_url=api_url,
                auth_type=APIAuthType.API_KEY,
                auth_config=auth_details,
                endpoints=[],
                headers={},
                rate_limits=None,
                pagination_style=None,
            )
