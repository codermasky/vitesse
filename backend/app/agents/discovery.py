"""
Discovery Agent: Searches for and validates API specifications.
Uses LLM and curated knowledge to find reliable API documentation.
"""

import structlog
from typing import Any, Dict, Optional, List
from datetime import datetime
from app.agents.base import VitesseAgent, AgentContext
from app.schemas.discovery import DiscoveryResult, DiscoveryRequest, DiscoveryResponse
from app.services.llm_provider import LLMProviderService

logger = structlog.get_logger(__name__)


class VitesseDiscoveryAgent(VitesseAgent):
    """
    Discovery Agent: Finds API specifications based on natural language queries.

    Responsibilities:
    - Search for APIs using LLM knowledge
    - Query curated API directories (future: APIs.guru, RapidAPI)
    - Validate discovered API documentation URLs
    - Return ranked results with confidence scores
    """

    def __init__(self, context: AgentContext, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id, agent_type="discovery")
        self.context = context

        # Known API patterns (can be expanded or moved to a database)
        self.known_apis = {
            # External APIs
            "shopify": {
                "name": "Shopify Admin API",
                "doc_url": "https://shopify.dev/api/admin-rest",
                "spec_url": "https://shopify.dev/admin-api-reference.json",
                "base_url": "https://{shop}.myshopify.com/admin/api/2024-01",
                "tags": ["ecommerce", "retail", "payments"],
            },
            "stripe": {
                "name": "Stripe API",
                "doc_url": "https://stripe.com/docs/api",
                "spec_url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
                "base_url": "https://api.stripe.com",
                "tags": ["payments", "finance"],
            },
            "github": {
                "name": "GitHub REST API",
                "doc_url": "https://docs.github.com/en/rest",
                "spec_url": "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
                "base_url": "https://api.github.com",
                "tags": ["developer-tools", "git", "collaboration"],
            },
            "coingecko": {
                "name": "CoinGecko API",
                "doc_url": "https://www.coingecko.com/en/api/documentation",
                "spec_url": "https://www.coingecko.com/api/documentations/v3/swagger.json",
                "base_url": "https://api.coingecko.com/api/v3",
                "tags": ["cryptocurrency", "finance", "data"],
            },
            "petstore": {
                "name": "Petstore API (Demo)",
                "doc_url": "https://petstore.swagger.io",
                "spec_url": "https://petstore.swagger.io/v2/swagger.json",
                "base_url": "https://petstore.swagger.io/v2",
                "tags": ["demo", "testing"],
            },
            # Linedata Products (Common Destinations)
            "capitalstream": {
                "name": "Linedata CapitalStream",
                "doc_url": "https://www.linedata.com/capitalstream",
                "spec_url": None,  # To be configured per deployment
                "base_url": None,  # To be configured per deployment
                "tags": ["linedata", "asset-management", "portfolio", "finance"],
            },
            "longview": {
                "name": "Linedata Longview",
                "doc_url": "https://www.linedata.com/longview",
                "spec_url": None,  # To be configured per deployment
                "base_url": None,  # To be configured per deployment
                "tags": ["linedata", "tax", "compliance", "reporting"],
            },
            "ekip": {
                "name": "Linedata Ekip",
                "doc_url": "https://www.linedata.com/ekip",
                "spec_url": None,  # To be configured per deployment
                "base_url": None,  # To be configured per deployment
                "tags": ["linedata", "insurance", "policy-management"],
            },
            "mfex": {
                "name": "Linedata MFEX",
                "doc_url": "https://www.linedata.com/mfex",
                "spec_url": None,  # To be configured per deployment
                "base_url": None,  # To be configured per deployment
                "tags": ["linedata", "fund-accounting", "transfer-agency"],
            },
        }

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute Discovery: Find API candidates based on query.

        Input:
            - query: Natural language search query
            - limit: Maximum number of results
            - include_unofficial: Whether to include third-party APIs

        Output:
            - results: List of DiscoveryResult objects
            - total_found: Total number of candidates
        """
        query = input_data.get("query", "").lower()
        limit = input_data.get("limit", 5)
        include_unofficial = input_data.get("include_unofficial", False)

        if not query:
            raise ValueError("query is required")

        logger.info("Discovery agent starting", query=query, limit=limit)

        start_time = datetime.utcnow()
        results: List[DiscoveryResult] = []

        try:
            # Step 1: Check known APIs (fast path)
            known_results = self._search_known_apis(query, limit)
            results.extend(known_results)
            logger.info(f"Found {len(known_results)} results from known APIs")

            # Step 2: If we don't have enough results, use LLM discovery
            if len(results) < limit:
                remaining_limit = limit - len(results)
                llm_results = await self._llm_discovery(query, remaining_limit)
                results.extend(llm_results)
                logger.info(f"Found {len(llm_results)} additional results from LLM")

            # Step 3: Sort by confidence score
            results.sort(key=lambda x: x.confidence_score, reverse=True)
            results = results[:limit]

            search_time = (datetime.utcnow() - start_time).total_seconds()

            return {
                "status": "success",
                "query": query,
                "results": [r.model_dump() for r in results],
                "total_found": len(results),
                "search_time_seconds": search_time,
            }

        except Exception as e:
            logger.error("Discovery failed", error=str(e))
            return {
                "status": "failed",
                "error": str(e),
                "query": query,
                "results": [],
                "total_found": 0,
            }

    def _search_known_apis(self, query: str, limit: int) -> List[DiscoveryResult]:
        """Search through known API catalog."""
        results = []

        for key, api_info in self.known_apis.items():
            # Simple keyword matching (can be improved with fuzzy matching)
            if (
                key in query
                or query in api_info["name"].lower()
                or any(tag in query for tag in api_info["tags"])
            ):
                result = DiscoveryResult(
                    api_name=api_info["name"],
                    description=f"Official {api_info['name']} - {', '.join(api_info['tags'])}",
                    documentation_url=api_info["doc_url"],
                    spec_url=api_info.get("spec_url"),
                    base_url=api_info.get("base_url"),
                    confidence_score=0.95,  # High confidence for known APIs
                    source="catalog",
                    tags=api_info["tags"],
                )
                results.append(result)

        return results[:limit]

    async def _llm_discovery(self, query: str, limit: int) -> List[DiscoveryResult]:
        """Use LLM to discover APIs based on query."""
        try:
            llm = await LLMProviderService.create_llm(agent_id=self.agent_id)

            prompt = f"""You are an API Discovery expert. Given a user query, identify the most relevant public APIs.

User Query: "{query}"

For each API you identify, provide:
1. API Name (official name)
2. Brief description
3. Documentation URL (where users can read about the API)
4. OpenAPI/Swagger spec URL (if known, otherwise leave empty)
5. Base URL for API calls (if known)
6. Confidence score (0.0-1.0) based on how well it matches the query
7. Tags/categories

Focus on official, well-documented APIs. Prioritize APIs with OpenAPI/Swagger specifications.
Return up to {limit} results.

Output as a JSON array of objects with keys: api_name, description, documentation_url, spec_url, base_url, confidence_score, tags
"""

            logger.info("Invoking LLM for API discovery", query=query)

            # Use structured output
            from pydantic import BaseModel

            class LLMDiscoveryResults(BaseModel):
                results: List[DiscoveryResult]

            llm_response = await LLMProviderService.invoke_structured_with_monitoring(
                llm_instance=llm,
                prompt=prompt,
                schema=LLMDiscoveryResults,
                agent_id=self.agent_id,
                operation_name="discover_apis",
                db=self.context.db_session,
            )

            # Mark all LLM results with lower confidence and "llm" source
            for result in llm_response.results:
                result.source = "llm"
                # Reduce confidence slightly for LLM results vs known catalog
                result.confidence_score = min(result.confidence_score * 0.9, 0.85)

            return llm_response.results

        except Exception as e:
            logger.error("LLM discovery failed", error=str(e))
            return []
