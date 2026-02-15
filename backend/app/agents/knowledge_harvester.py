"""
Knowledge Harvesting Agent: Proactive Integration Pattern Discovery

The Knowledge Harvester is an autonomous agent that:
1. Crawls API documentation (GitHub, APIs.guru, company websites)
2. Extracts API specifications and field mappings
3. Identifies common patterns across integrations
4. Stores harvested knowledge in vector DB for self-onboarding
5. Tracks regulatory compliance and standards

This enables the system to extend its capabilities without manual updates.
"""

import structlog
from typing import Any, Dict, Optional, List, Set
from datetime import datetime
import uuid
import asyncio
import httpx
import hashlib
import json

from app.agents.base import VitesseAgent, AgentContext
from app.core.knowledge_db import (
    get_knowledge_db,
    FINANCIAL_APIS_COLLECTION,
    FINANCIAL_SCHEMAS_COLLECTION,
    FINANCIAL_STANDARDS_COLLECTION,
    API_SPECS_COLLECTION,
    HARVEST_SOURCES_COLLECTION,
)
from app.core.financial_services import (
    PLAID_API_KNOWLEDGE,
    STRIPE_API_KNOWLEDGE,
    YODLEE_API_KNOWLEDGE,
    PSD2_STANDARD,
    FDX_STANDARD,
)

logger = structlog.get_logger(__name__)


class KnowledgeHarvester(VitesseAgent):
    """
    Autonomous agent that harvests API knowledge and integration patterns.

    Responsibilities:
    - Discover and parse API documentation
    - Extract field mappings and transformation patterns
    - Identify regulatory compliance requirements
    - Store knowledge for future integrations
    - Update discovery agent with new sources
    """

    def __init__(self, context: AgentContext, agent_id: Optional[str] = None):
        super().__init__(agent_id=agent_id, agent_type="knowledge_harvester")
        self.context = context
        self.knowledge_db = None

        # Knowledge sources to harvest - expanded beyond financial APIs
        self.harvest_sources = {
            "api_directories": [
                "https://api.apis.guru/v2/list.json",  # Current APIs.guru directory
            ],
            "api_marketplaces": [
                "https://rapidapi.com/search/apis",  # RapidAPI marketplace
                "https://www.postman.com/explore/apis",  # Postman API Network
                "https://api.directory/",  # API Directory
                "https://www.programmableweb.com/apis/directory",  # ProgrammableWeb
            ],
            "github_api_repos": [
                # Payment & Financial APIs
                "stripe/stripe-go",
                "plaid/plaid-node",
                "square/square-go-sdk",
                "paypal/paypal-checkout",
                "adyen/adyen-node-api-library",
                # E-commerce APIs
                "woocommerce/woocommerce",
                "shopify/shopify-api-js",
                "magento/magento2",
                "bigcommerce/bigcommerce-api",
                # CRM & Marketing APIs
                "hubspot/hubspot-api-nodejs",
                "salesforce/forcedotcom-java-sdk",
                "mailchimp/mailchimp-api-python",
                "zendesk/zendesk_api_client_rb",
                # Communication APIs
                "twilio/twilio-node",
                "sendgrid/sendgrid-nodejs",
                "slackapi/node-slack-sdk",
                "discord/discord-api-docs",
                # Cloud & Infrastructure APIs
                "aws/aws-sdk-js",
                "googleapis/google-api-nodejs-client",
                "microsoft/azure-sdk-for-js",
                # Data & Analytics APIs
                "segmentio/analytics-node",
                "mixpanel/mixpanel-node",
                "amplitude/amplitude-node",
                # Developer Tools APIs
                "github/rest-api-description",
                "gitlabhq/gitlabhq",
                "bitbucket-api/bitbucket-api",
            ],
            "documentation_sites": [
                # Financial
                "https://developers.stripe.com/docs/api",
                "https://plaid.com/docs/",
                "https://developer.paypal.com/docs/api/",
                # E-commerce
                "https://shopify.dev/docs/api",
                "https://woocommerce.github.io/code-reference/",
                # CRM
                "https://developers.hubspot.com/docs/api/",
                "https://developer.salesforce.com/docs/",
                # Communication
                "https://www.twilio.com/docs",
                "https://docs.sendgrid.com/",
                # Cloud
                "https://docs.aws.amazon.com/",
                "https://cloud.google.com/apis",
                "https://docs.microsoft.com/en-us/rest/api/",
            ],
            "api_spec_repositories": [
                "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/",
                "https://api.github.com/repos/APIs-guru/openapi-directory/contents/APIs",
            ],
        }

    def _compute_content_hash(self, content: Any) -> str:
        """Compute a hash of the content for change detection."""
        content_str = json.dumps(content, sort_keys=True, default=str)
        return hashlib.sha256(content_str.encode('utf-8')).hexdigest()

    def _get_source_key(self, source_type: str, source_identifier: str) -> str:
        """Generate a unique key for tracking a harvest source."""
        return f"{source_type}:{source_identifier}"

    async def _should_process_source(
        self, source_key: str, content_hash: str
    ) -> bool:
        """
        Check if a source should be processed.
        Returns True if the source is new or has changed, False if it exists and hasn't changed.
        """
        try:
            existing_state = await self.knowledge_db.get_harvest_source_state(source_key)
            
            if existing_state is None:
                # New source - should process
                logger.debug("New source, will process", source_key=source_key)
                return True
            
            existing_hash = existing_state.get("content_hash")
            if existing_hash != content_hash:
                # Source has changed - should process
                logger.debug(
                    "Source changed, will process",
                    source_key=source_key,
                    old_hash=existing_hash[:8] if existing_hash else "none",
                    new_hash=content_hash[:8],
                )
                return True
            
            # Source exists and hasn't changed - skip processing
            logger.debug("Source unchanged, skipping", source_key=source_key)
            return False
            
        except Exception as e:
            # On any error, log and return True to process (fail-safe)
            logger.warning(
                "Error checking source state, will process to be safe",
                source_key=source_key,
                error=str(e),
            )
            return True

    async def _update_source_state(
        self, source_key: str, content_hash: str, metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update the tracking state for a processed source."""
        try:
            await self.knowledge_db.update_harvest_source_state(
                source_key=source_key,
                content_hash=content_hash,
                metadata=metadata or {},
            )
        except Exception as e:
            logger.warning("Failed to update source state", source_key=source_key, error=str(e))

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute knowledge harvesting."""
        logger.info(
            "Knowledge Harvester executing",
            agent_id=self.agent_id,
            harvest_type=input_data.get("harvest_type", "full"),
        )

        # Initialize knowledge DB
        self.knowledge_db = await get_knowledge_db()

        # Determine what to harvest
        harvest_type = input_data.get("harvest_type", "full")

        result = await self._harvest_knowledge(harvest_type)

        return result

    async def _harvest_knowledge(self, harvest_type: str) -> Dict[str, Any]:
        """Main harvest logic - expanded to cover broader API ecosystem with smart deduplication."""
        results = {
            "status": "success",
            "harvest_type": harvest_type,
            "timestamp": datetime.utcnow().isoformat(),
            "total_harvested": 0,
            "total_skipped_unchanged": 0,
            "collections_updated": [],
            "sources_harvested": [],
        }

        try:
            if harvest_type in ["full", "financial"]:
                # Harvest financial services knowledge
                harvested = await self._harvest_financial_apis()
                results["total_harvested"] += len(harvested)
                results["collections_updated"].append("financial_apis")
                results["sources_harvested"].append("financial_apis")

            if harvest_type in ["full", "standards"]:
                # Harvest regulatory standards
                harvested = await self._harvest_standards()
                results["total_harvested"] += len(harvested)
                results["collections_updated"].append("financial_standards")
                results["sources_harvested"].append("regulatory_standards")

            if harvest_type in ["full", "api_directory"]:
                # Harvest from APIs.guru directory
                harvested = await self._harvest_api_directory()
                results["total_harvested"] += len(harvested)
                results["collections_updated"].append("api_specifications")
                results["sources_harvested"].append("apis_guru")

            if harvest_type in ["full", "marketplaces"]:
                # Harvest from API marketplaces
                harvested = await self._harvest_api_marketplaces()
                results["total_harvested"] += len(harvested)
                results["collections_updated"].append("api_specifications")
                results["sources_harvested"].append("api_marketplaces")

            if harvest_type in ["full", "github"]:
                # Harvest from GitHub API repositories
                harvested = await self._harvest_github_apis()
                results["total_harvested"] += len(harvested)
                results["collections_updated"].append("api_specifications")
                results["sources_harvested"].append("github_repos")

            if harvest_type in ["full", "patterns"]:
                # Harvest integration patterns
                harvested = await self._harvest_patterns()
                results["total_harvested"] += len(harvested)
                results["collections_updated"].append("integration_patterns")
                results["sources_harvested"].append("integration_patterns")

            logger.info(
                "Knowledge harvest completed",
                total_harvested=results["total_harvested"],
                sources=results["sources_harvested"],
                collections=results["collections_updated"],
            )

            return results

        except Exception as e:
            logger.error("Knowledge harvest failed", error=str(e))
            results["status"] = "error"
            results["error"] = str(e)
            return results

    async def _harvest_financial_apis(self) -> List[Dict[str, Any]]:
        """Harvest financial API knowledge with validation and smart deduplication."""
        harvested = []
        skipped_unchanged = 0

        logger.info("Harvesting financial APIs...")

        # Add core financial APIs
        financial_apis = [
            PLAID_API_KNOWLEDGE,
            STRIPE_API_KNOWLEDGE,
            YODLEE_API_KNOWLEDGE,
        ]

        for api_knowledge in financial_apis:
            try:
                # Validate API knowledge structure
                if not api_knowledge.get("api_name"):
                    logger.warning("Skipping API with missing name", api=api_knowledge)
                    continue

                # Compute content hash for change detection
                content_hash = self._compute_content_hash(api_knowledge)
                source_key = self._get_source_key("financial_api", api_knowledge["api_name"])

                # Check if we should process this source (new or changed)
                if not await self._should_process_source(source_key, content_hash):
                    skipped_unchanged += 1
                    logger.debug("Skipping unchanged financial API", api=api_knowledge["api_name"])
                    continue

                # Store in knowledge DB
                doc_id = await self.knowledge_db.add_documents(
                    collection=FINANCIAL_APIS_COLLECTION,
                    documents=[
                        {
                            "content": str(api_knowledge),
                            "api_name": api_knowledge["api_name"],
                            "category": api_knowledge["category"],
                            "region": str(api_knowledge.get("region")),
                            "tags": ",".join(api_knowledge.get("tags", [])),
                        }
                    ],
                )

                # Validate doc_id is a non-empty list
                if not doc_id or not isinstance(doc_id, list) or len(doc_id) == 0:
                    logger.warning(
                        "Failed to store API document",
                        api=api_knowledge.get("api_name"),
                    )
                    # Still update source state to avoid retrying failed docs
                    await self._update_source_state(
                        source_key=source_key,
                        content_hash=content_hash,
                        metadata={
                            "source_type": "financial_api",
                            "api_name": api_knowledge["api_name"],
                            "category": api_knowledge["category"],
                            "store_failed": True,
                        },
                    )
                    continue

                # Update source state after successful processing
                await self._update_source_state(
                    source_key=source_key,
                    content_hash=content_hash,
                    metadata={
                        "source_type": "financial_api",
                        "api_name": api_knowledge["api_name"],
                        "category": api_knowledge["category"],
                    },
                )

                harvested.append(
                    {
                        "api": api_knowledge["api_name"],
                        "doc_id": doc_id[0],
                        "endpoints": len(api_knowledge.get("endpoints", [])),
                    }
                )

                logger.info(
                    "Financial API harvested",
                    api=api_knowledge["api_name"],
                    endpoints=len(api_knowledge.get("endpoints", [])),
                )

            except Exception as e:
                logger.error(
                    "Failed to harvest financial API",
                    api=api_knowledge.get("api_name"),
                    error=str(e),
                )

        # Log summary with smart harvesting stats
        logger.info(
            "Financial APIs harvest complete",
            harvested=len(harvested),
            skipped_unchanged=skipped_unchanged,
            total_sources=len(financial_apis),
        )

        return harvested

    async def _harvest_standards(self) -> List[Dict[str, Any]]:
        """Harvest regulatory standards and compliance knowledge with validation and smart deduplication."""
        harvested = []
        skipped_unchanged = 0

        logger.info("Harvesting financial standards...")

        standards = [
            PSD2_STANDARD,
            FDX_STANDARD,
        ]

        for standard in standards:
            try:
                # Validate standard structure
                if not standard.get("standard"):
                    logger.warning("Skipping standard with missing name", standard=standard)
                    continue

                # Compute content hash for change detection
                content_hash = self._compute_content_hash(standard)
                source_key = self._get_source_key("standard", standard["standard"])

                # Check if we should process this source (new or changed)
                if not await self._should_process_source(source_key, content_hash):
                    skipped_unchanged += 1
                    logger.debug("Skipping unchanged standard", standard=standard.get("standard"))
                    continue

                doc_id = await self.knowledge_db.add_documents(
                    collection=FINANCIAL_STANDARDS_COLLECTION,
                    documents=[
                        {
                            "content": str(standard),
                            "standard": standard.get("standard"),
                            "region": standard.get("region"),
                            "version": standard.get("version"),
                        }
                    ],
                )

                # Validate doc_id is a non-empty list
                if not doc_id or not isinstance(doc_id, list) or len(doc_id) == 0:
                    logger.warning("Failed to store standard document", standard=standard.get("standard"))
                    # Still update source state to avoid retrying failed documents
                    await self._update_source_state(
                        source_key=source_key,
                        content_hash=content_hash,
                        metadata={
                            "source_type": "standard",
                            "standard": standard.get("standard"),
                            "region": standard.get("region"),
                            "store_failed": True,
                        },
                    )
                    continue

                # Update source state after successful processing
                await self._update_source_state(
                    source_key=source_key,
                    content_hash=content_hash,
                    metadata={
                        "source_type": "standard",
                        "standard": standard.get("standard"),
                        "region": standard.get("region"),
                    },
                )

                harvested.append(
                    {
                        "standard": standard.get("standard"),
                        "doc_id": doc_id[0],
                        "requirements": len(standard.get("key_requirements", [])),
                    }
                )

                logger.info(
                    "Standard harvested",
                    standard=standard.get("standard"),
                )

            except Exception as e:
                logger.error(
                    "Failed to harvest standard",
                    standard=standard.get("standard"),
                    error=str(e),
                )

        # Log summary with smart harvesting stats
        logger.info(
            "Standards harvest complete",
            harvested=len(harvested),
            skipped_unchanged=skipped_unchanged,
            total_sources=len(standards),
        )

        return harvested

    async def _harvest_patterns(self) -> List[Dict[str, Any]]:
        """Identify and harvest common integration patterns with validation and smart deduplication."""
        harvested = []
        skipped_unchanged = 0

        logger.info("Harvesting integration patterns...")

        # Common transformation patterns
        patterns = [
            {
                "pattern_name": "Currency Conversion",
                "pattern_type": "transformation",
                "transformations": [
                    {"from": "cents", "to": "dollars", "operation": "divide_by_100"},
                    {"from": "dollars", "to": "cents", "operation": "multiply_by_100"},
                ],
                "used_by": ["stripe", "paypal", "square"],
                "success_rate": 0.98,
            },
            {
                "pattern_name": "Pagination Handling",
                "pattern_type": "api_pattern",
                "variants": [
                    {"type": "offset", "params": ["offset", "limit"]},
                    {"type": "cursor", "params": ["cursor", "limit"]},
                    {"type": "page_number", "params": ["page", "page_size"]},
                ],
                "used_by": ["stripe", "plaid", "github"],
                "success_rate": 0.99,
            },
            {
                "pattern_name": "Timestamp Normalization",
                "pattern_type": "transformation",
                "transformations": [
                    {"from": "unix_timestamp", "to": "iso8601"},
                    {"from": "iso8601", "to": "unix_timestamp"},
                    {"from": "milliseconds", "to": "seconds"},
                ],
                "used_by": ["stripe", "plaid", "google", "aws"],
                "success_rate": 0.99,
            },
            {
                "pattern_name": "Amount Standardization",
                "pattern_type": "field_mapping",
                "patterns": [
                    {"source": "amount", "target": "value"},
                    {"source": "transactionAmount", "target": "amount"},
                    {"source": "transaction_amount", "target": "amount"},
                ],
                "used_by": ["payments", "banking", "accounting"],
                "success_rate": 0.97,
            },
        ]

        for pattern in patterns:
            try:
                # Validate pattern structure
                if not pattern.get("pattern_name"):
                    logger.warning("Skipping pattern with missing name", pattern=pattern)
                    continue

                # Compute content hash for change detection
                content_hash = self._compute_content_hash(pattern)
                source_key = self._get_source_key("pattern", pattern["pattern_name"])

                # Check if we should process this source (new or changed)
                if not await self._should_process_source(source_key, content_hash):
                    skipped_unchanged += 1
                    logger.debug("Skipping unchanged pattern", pattern=pattern["pattern_name"])
                    continue

                from app.core.knowledge_db import INTEGRATION_PATTERNS_COLLECTION

                doc_id = await self.knowledge_db.add_documents(
                    collection=INTEGRATION_PATTERNS_COLLECTION,
                    documents=[
                        {
                            "content": str(pattern),
                            "pattern_name": pattern["pattern_name"],
                            "pattern_type": pattern["pattern_type"],
                            "success_rate": pattern.get("success_rate", 0),
                        }
                    ],
                )

                # Validate doc_id is a non-empty list
                if not doc_id or not isinstance(doc_id, list) or len(doc_id) == 0:
                    logger.warning(
                        "Failed to store pattern document",
                        pattern=pattern.get("pattern_name"),
                    )
                    # Still update source state to avoid retrying
                    await self._update_source_state(
                        source_key=source_key,
                        content_hash=content_hash,
                        metadata={
                            "source_type": "pattern",
                            "pattern_name": pattern["pattern_name"],
                            "pattern_type": pattern["pattern_type"],
                            "store_failed": True,
                        },
                    )
                    continue

                # Update source state after successful processing
                await self._update_source_state(
                    source_key=source_key,
                    content_hash=content_hash,
                    metadata={
                        "source_type": "pattern",
                        "pattern_name": pattern["pattern_name"],
                        "pattern_type": pattern["pattern_type"],
                    },
                )

                harvested.append(
                    {
                        "pattern": pattern["pattern_name"],
                        "doc_id": doc_id[0],
                        "type": pattern["pattern_type"],
                    }
                )

                logger.info(
                    "Pattern harvested",
                    pattern=pattern["pattern_name"],
                    type=pattern["pattern_type"],
                )

            except Exception as e:
                logger.error(
                    "Failed to harvest pattern",
                    pattern=pattern.get("pattern_name"),
                    error=str(e),
                )

        # Log summary with smart harvesting stats
        logger.info(
            "Patterns harvest complete",
            harvested=len(harvested),
            skipped_unchanged=skipped_unchanged,
            total_sources=len(patterns),
        )

        return harvested

    async def _harvest_api_directory(self) -> List[Dict[str, Any]]:
        """Harvest APIs from APIs.guru directory with validation and smart deduplication."""
        harvested = []
        skipped_count = 0
        skipped_unchanged = 0
        error_count = 0

        logger.info("Harvesting from APIs.guru directory...")

        for directory_url in self.harvest_sources["api_directories"]:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(directory_url)
                    response.raise_for_status()

                    api_data = response.json()

                    # Compute hash of the entire API list for change detection at directory level
                    directory_hash = self._compute_content_hash(api_data)
                    source_key = self._get_source_key("api_directory", directory_url)

                    # Check if we should process this directory (new or changed)
                    if not await self._should_process_source(source_key, directory_hash):
                        skipped_unchanged = len(api_data)  # Estimate all APIs unchanged
                        logger.info(
                            "Skipping unchanged API directory",
                            url=directory_url,
                            estimated_apis=skipped_unchanged,
                        )
                        continue

                    # APIs.guru returns a nested structure
                    for provider, versions in api_data.items():
                        # Skip if versions is not a dict (malformed data)
                        if not isinstance(versions, dict):
                            skipped_count += 1
                            continue

                        for version, spec_info in versions.items():
                            try:
                                # Skip if spec_info is not a dict (malformed data)
                                if not isinstance(spec_info, dict):
                                    skipped_count += 1
                                    continue

                                # Validate required fields exist
                                if not spec_info.get("info") or not isinstance(
                                    spec_info.get("info"), dict
                                ):
                                    skipped_count += 1
                                    continue

                                # Extract basic API information
                                api_info = {
                                    "api_name": spec_info.get("info", {}).get(
                                        "title", provider
                                    ),
                                    "provider": provider,
                                    "version": version,
                                    "description": spec_info.get("info", {}).get(
                                        "description", ""
                                    ),
                                    "swagger_url": spec_info.get("swaggerUrl"),
                                    "openapi_url": spec_info.get("openapiUrl"),
                                    "categories": spec_info.get("categories", []),
                                    "source": "apis_guru",
                                }

                                # Skip if description is empty (will cause vector dimension issues)
                                description = api_info.get("description", "").strip()
                                if not description:
                                    skipped_count += 1
                                    continue

                                # Compute hash for individual API
                                api_content_hash = self._compute_content_hash(api_info)
                                api_source_key = self._get_source_key("apis_guru", f"{provider}:{version}")

                                # Check if this specific API needs processing
                                if not await self._should_process_source(api_source_key, api_content_hash):
                                    skipped_count += 1
                                    continue

                                # Store in general API specifications collection
                                doc_id = await self.knowledge_db.add_documents(
                                    collection=API_SPECS_COLLECTION,
                                    documents=[
                                        {
                                            "content": f"{description} API: {api_info['api_name']}",
                                            "api_name": api_info["api_name"],
                                            "provider": api_info["provider"],
                                            "categories": api_info["categories"],
                                            "source": "apis_guru",
                                            "spec_urls": {
                                                "swagger": api_info.get("swagger_url"),
                                                "openapi": api_info.get("openapi_url"),
                                            },
                                        }
                                    ],
                                )

                                # Validate doc_id is a non-empty list
                                if not doc_id or not isinstance(doc_id, list) or len(doc_id) == 0:
                                    logger.warning(
                                        "Failed to store API document",
                                        api=api_info.get("api_name"),
                                        provider=provider,
                                    )
                                    # Still update source state so we don't retry failed docs
                                    await self._update_source_state(
                                        source_key=api_source_key,
                                        content_hash=api_content_hash,
                                        metadata={
                                            "source_type": "apis_guru",
                                            "api_name": api_info["api_name"],
                                            "provider": provider,
                                            "version": version,
                                            "store_failed": True,
                                        },
                                    )
                                    skipped_count += 1
                                    continue

                                # Update source state after successful processing
                                await self._update_source_state(
                                    source_key=api_source_key,
                                    content_hash=api_content_hash,
                                    metadata={
                                        "source_type": "apis_guru",
                                        "api_name": api_info["api_name"],
                                        "provider": provider,
                                        "version": version,
                                    },
                                )

                                harvested.append(
                                    {
                                        "api": api_info["api_name"],
                                        "provider": provider,
                                        "doc_id": doc_id[0],
                                        "source": "apis_guru",
                                    }
                                )

                            except Exception as e:
                                # Only log at debug level to reduce noise
                                error_count += 1
                                logger.debug(
                                    "Skipped malformed API entry",
                                    provider=provider,
                                    version=version,
                                    error_type=type(e).__name__,
                                )

                    # Update directory-level hash after processing all APIs
                    await self._update_source_state(
                        source_key=source_key,
                        content_hash=directory_hash,
                        metadata={
                            "source_type": "api_directory",
                            "url": directory_url,
                            "apis_processed": len(harvested),
                        },
                    )

            except Exception as e:
                logger.error(
                    "Failed to harvest from APIs.guru",
                    url=directory_url,
                    error=str(e),
                )

        # Log summary instead of individual errors
        logger.info(
            "APIs.guru harvest complete",
            harvested=len(harvested),
            skipped=skipped_count,
            skipped_unchanged=skipped_unchanged,
            errors=error_count,
        )

        return harvested

    async def _harvest_api_marketplaces(self) -> List[Dict[str, Any]]:
        """Harvest APIs from marketplaces like RapidAPI, Postman, etc. with smart deduplication."""
        harvested = []
        skipped_unchanged = 0

        logger.info("Harvesting from API marketplaces...")

        # For now, we'll add known APIs from these marketplaces
        # In a full implementation, this would scrape or use APIs from these services
        marketplace_apis = [
            {
                "name": "OpenWeatherMap",
                "category": "weather",
                "marketplace": "rapidapi",
                "description": "Weather data and forecasts API",
            },
            {
                "name": "Google Translate",
                "category": "translation",
                "marketplace": "rapidapi",
                "description": "Language translation API",
            },
            {
                "name": "Spotify Web API",
                "category": "music",
                "marketplace": "spotify",
                "description": "Access to Spotify music catalog and user data",
            },
            {
                "name": "GitHub API",
                "category": "developer_tools",
                "marketplace": "github",
                "description": "GitHub repository and user management API",
            },
            {
                "name": "Slack API",
                "category": "communication",
                "marketplace": "slack",
                "description": "Slack messaging and team collaboration API",
            },
            {
                "name": "Twilio SMS",
                "category": "communication",
                "marketplace": "twilio",
                "description": "SMS and voice communication API",
            },
            {
                "name": "Stripe Payments",
                "category": "payments",
                "marketplace": "stripe",
                "description": "Payment processing and financial services API",
            },
            {
                "name": "Shopify Admin",
                "category": "ecommerce",
                "marketplace": "shopify",
                "description": "E-commerce store management API",
            },
            {
                "name": "HubSpot CRM",
                "category": "crm",
                "marketplace": "hubspot",
                "description": "Customer relationship management API",
            },
            {
                "name": "Mailchimp Marketing",
                "category": "marketing",
                "marketplace": "mailchimp",
                "description": "Email marketing and automation API",
            },
        ]

        for api in marketplace_apis:
            try:
                # Compute content hash for change detection
                content_hash = self._compute_content_hash(api)
                source_key = self._get_source_key("marketplace", api["name"])

                # Check if we should process this source (new or changed)
                if not await self._should_process_source(source_key, content_hash):
                    skipped_unchanged += 1
                    logger.debug("Skipping unchanged marketplace source", api=api["name"])
                    continue

                doc_id = await self.knowledge_db.add_documents(
                    collection=API_SPECS_COLLECTION,
                    documents=[
                        {
                            "content": api["description"],
                            "api_name": api["name"],
                            "category": api["category"],
                            "marketplace": api["marketplace"],
                            "source": "api_marketplace",
                        }
                    ],
                )

                # Validate doc_id is a non-empty list
                if not doc_id or not isinstance(doc_id, list) or len(doc_id) == 0:
                    logger.warning(
                        "Failed to store marketplace API document",
                        api=api["name"],
                    )
                    # Still update source state to avoid retrying
                    await self._update_source_state(
                        source_key=source_key,
                        content_hash=content_hash,
                        metadata={
                            "source_type": "marketplace",
                            "api_name": api["name"],
                            "marketplace": api["marketplace"],
                            "category": api["category"],
                            "store_failed": True,
                        },
                    )
                    continue

                # Update source state after successful processing
                await self._update_source_state(
                    source_key=source_key,
                    content_hash=content_hash,
                    metadata={
                        "source_type": "marketplace",
                        "api_name": api["name"],
                        "marketplace": api["marketplace"],
                        "category": api["category"],
                    },
                )

                harvested.append(
                    {
                        "api": api["name"],
                        "category": api["category"],
                        "marketplace": api["marketplace"],
                        "doc_id": doc_id[0],
                        "source": "marketplace",
                    }
                )

                logger.info(
                    "Marketplace API harvested",
                    api=api["name"],
                    marketplace=api["marketplace"],
                )

            except Exception as e:
                logger.error(
                    "Failed to harvest marketplace API",
                    api=api["name"],
                    error=str(e),
                )

        # Log summary with smart harvesting stats
        logger.info(
            "Marketplace API harvest complete",
            harvested=len(harvested),
            skipped_unchanged=skipped_unchanged,
            total_sources=len(marketplace_apis),
        )

        return harvested

    async def _harvest_github_apis(self) -> List[Dict[str, Any]]:
        """Harvest API information from GitHub repositories with validation and smart deduplication."""
        harvested = []
        skipped_unchanged = 0
        skipped_error = 0

        logger.info("Harvesting from GitHub API repositories...")

        for repo in self.harvest_sources["github_api_repos"]:
            try:
                # Extract provider and repo name
                provider, repo_name = repo.split("/", 1)

                # Infer API category from repo name/provider
                category = self._infer_api_category(repo_name)

                api_info = {
                    "name": repo_name.replace("-api", "")
                    .replace("-sdk", "")
                    .replace("_", " ")
                    .title(),
                    "provider": provider,
                    "repo": repo,
                    "category": category,
                    "source": "github",
                    "description": f"API SDK for {provider} {repo_name}",
                }

                # Compute content hash for change detection
                content_hash = self._compute_content_hash(api_info)
                source_key = self._get_source_key("github", repo)

                # Check if we should process this source (new or changed)
                if not await self._should_process_source(source_key, content_hash):
                    skipped_unchanged += 1
                    logger.debug("Skipping unchanged GitHub source", repo=repo)
                    continue

                doc_id = await self.knowledge_db.add_documents(
                    collection=API_SPECS_COLLECTION,
                    documents=[
                        {
                            "content": api_info["description"],
                            "api_name": api_info["name"],
                            "provider": api_info["provider"],
                            "category": api_info["category"],
                            "repo": api_info["repo"],
                            "source": "github",
                            "github_url": f"https://github.com/{repo}",
                        }
                    ],
                )

                # Validate doc_id is a non-empty list
                if not doc_id or not isinstance(doc_id, list) or len(doc_id) == 0:
                    logger.warning(
                        "Failed to store GitHub API document",
                        repo=repo,
                        provider=provider,
                    )
                    skipped_error += 1
                    # Still update source state to avoid retrying
                    await self._update_source_state(
                        source_key=source_key,
                        content_hash=content_hash,
                        metadata={
                            "source_type": "github",
                            "api_name": api_info["name"],
                            "provider": provider,
                            "category": category,
                            "store_failed": True,
                        },
                    )
                    continue

                # Update source state after successful processing
                await self._update_source_state(
                    source_key=source_key,
                    content_hash=content_hash,
                    metadata={
                        "source_type": "github",
                        "api_name": api_info["name"],
                        "provider": provider,
                        "category": category,
                    },
                )

                harvested.append(
                    {
                        "api": api_info["name"],
                        "provider": provider,
                        "repo": repo,
                        "category": category,
                        "doc_id": doc_id[0],
                        "source": "github",
                    }
                )

                logger.info(
                    "GitHub API harvested",
                    api=api_info["name"],
                    repo=repo,
                    category=category,
                )

            except Exception as e:
                logger.error(
                    "Failed to harvest GitHub API",
                    repo=repo,
                    error=str(e),
                )
                skipped_error += 1

        # Log summary with smart harvesting stats
        logger.info(
            "GitHub API harvest complete",
            harvested=len(harvested),
            skipped_unchanged=skipped_unchanged,
            skipped_errors=skipped_error,
            total_sources=len(self.harvest_sources["github_api_repos"]),
        )

        return harvested

    def _infer_api_category(self, repo_name: str) -> str:
        """Infer API category from repository name."""
        repo_lower = repo_name.lower()

        # Category mapping based on keywords
        category_map = {
            "payment": "payments",
            "stripe": "payments",
            "plaid": "payments",
            "paypal": "payments",
            "square": "payments",
            "adyen": "payments",
            "shopify": "ecommerce",
            "woocommerce": "ecommerce",
            "magento": "ecommerce",
            "bigcommerce": "ecommerce",
            "hubspot": "crm",
            "salesforce": "crm",
            "zendesk": "crm",
            "twilio": "communication",
            "sendgrid": "communication",
            "slack": "communication",
            "discord": "communication",
            "aws": "cloud",
            "google": "cloud",
            "azure": "cloud",
            "segment": "analytics",
            "mixpanel": "analytics",
            "amplitude": "analytics",
            "github": "developer_tools",
            "gitlab": "developer_tools",
            "bitbucket": "developer_tools",
            "mailchimp": "marketing",
        }

        for keyword, category in category_map.items():
            if keyword in repo_lower:
                return category

        return "general"

    async def find_similar_apis(
        self, api_query: str, top_k: int = 5, category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find APIs similar to the query across all knowledge collections."""
        if self.knowledge_db is None:
            self.knowledge_db = await get_knowledge_db()

        all_results = []

        # Search across multiple collections
        collections_to_search = [
            FINANCIAL_APIS_COLLECTION,  # Financial APIs
            API_SPECS_COLLECTION,  # General API specifications
        ]

        for collection in collections_to_search:
            try:
                results = await self.knowledge_db.search(
                    collection=collection,
                    query=api_query,
                    top_k=top_k,
                )

                for doc, similarity in results:
                    result = {
                        "api": doc.get("metadata", {}).get("api_name"),
                        "similarity_score": similarity,
                        "doc_id": doc.get("id"),
                        "collection": collection,
                        "category": doc.get("metadata", {}).get("category", "unknown"),
                        "source": doc.get("metadata", {}).get("source", "unknown"),
                    }
                    all_results.append(result)

            except Exception as e:
                logger.error(
                    "Failed to search collection",
                    collection=collection,
                    error=str(e),
                )

        # Sort by similarity score and filter by category if specified
        all_results.sort(key=lambda x: x["similarity_score"], reverse=True)

        if category:
            all_results = [r for r in all_results if r["category"] == category]

        # Return top results
        return all_results[:top_k]

    async def find_applicable_standards(self, context: str) -> List[Dict[str, Any]]:
        """Find applicable regulatory standards for given context."""
        if self.knowledge_db is None:
            self.knowledge_db = await get_knowledge_db()

        results = await self.knowledge_db.search(
            collection=FINANCIAL_STANDARDS_COLLECTION,
            query=context,
            top_k=3,
        )

        formatted_results = []
        for doc, similarity in results:
            formatted_results.append(
                {
                    "standard": doc.get("metadata", {}).get("standard"),
                    "relevance": similarity,
                    "doc_id": doc.get("id"),
                }
            )

        return formatted_results

    async def find_relevant_patterns(
        self, integration_context: str, top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """Find integration patterns relevant to the current integration."""
        if self.knowledge_db is None:
            self.knowledge_db = await get_knowledge_db()

        from app.core.knowledge_db import INTEGRATION_PATTERNS_COLLECTION

        results = await self.knowledge_db.search(
            collection=INTEGRATION_PATTERNS_COLLECTION,
            query=integration_context,
            top_k=top_k,
        )

        formatted_results = []
        for doc, similarity in results:
            formatted_results.append(
                {
                    "pattern": doc.get("metadata", {}).get("pattern_name"),
                    "type": doc.get("metadata", {}).get("pattern_type"),
                    "relevance": similarity,
                    "doc_id": doc.get("id"),
                }
            )

        return formatted_results
