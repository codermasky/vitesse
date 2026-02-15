"""
Harvest Source Service

Business logic for managing harvest sources.
"""

import structlog
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, func, select

from app.models.harvest_source import HarvestSource
from app.schemas.harvest_source import (
    HarvestSourceCreate,
    HarvestSourceUpdate,
    HarvestSourceResponse,
    HarvestTestResult,
)
from app.core.knowledge_db import get_knowledge_db

logger = structlog.get_logger(__name__)


class HarvestSourceService:
    """Service for managing harvest sources."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_harvest_sources(
        self,
        skip: int = 0,
        limit: int = 100,
        enabled_only: bool = False,
        source_type: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[HarvestSource]:
        """Get harvest sources with optional filtering."""
        query = select(HarvestSource)

        if enabled_only:
            query = query.where(HarvestSource.enabled == True)

        if source_type:
            query = query.where(HarvestSource.type == source_type)

        if category:
            query = query.where(HarvestSource.category == category)

        query = query.order_by(HarvestSource.priority.desc(), HarvestSource.name)
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_harvest_source_by_id(self, source_id: int) -> Optional[HarvestSource]:
        """Get a harvest source by ID."""
        query = select(HarvestSource).where(HarvestSource.id == source_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_harvest_source(self, source_data: HarvestSourceCreate) -> HarvestSource:
        """Create a new harvest source."""
        db_source = HarvestSource(
            name=source_data.name,
            type=source_data.type,
            url=source_data.url,
            description=source_data.description,
            enabled=source_data.enabled,
            priority=source_data.priority,
            auth_type=source_data.auth_type,
            auth_config=source_data.auth_config,
            category=source_data.category,
            tags=source_data.tags,
        )

        self.db.add(db_source)
        await self.db.commit()
        await self.db.refresh(db_source)

        logger.info(
            "Created harvest source",
            source_id=db_source.id,
            name=db_source.name,
            type=db_source.type,
        )

        return db_source

    async def update_harvest_source(
        self, source_id: int, update_data: HarvestSourceUpdate
    ) -> Optional[HarvestSource]:
        """Update an existing harvest source."""
        db_source = await self.get_harvest_source_by_id(source_id)
        if not db_source:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(db_source, field, value)

        await self.db.commit()
        await self.db.refresh(db_source)

        logger.info(
            "Updated harvest source",
            source_id=db_source.id,
            name=db_source.name,
            changes=list(update_dict.keys()),
        )

        return db_source

    async def delete_harvest_source(self, source_id: int) -> bool:
        """Delete a harvest source."""
        db_source = await self.get_harvest_source_by_id(source_id)
        if not db_source:
            return False

        await self.db.delete(db_source)
        await self.db.commit()

        logger.info(
            "Deleted harvest source",
            source_id=source_id,
            name=db_source.name,
        )

        return True

    async def test_harvest_source(self, source_id: int) -> HarvestTestResult:
        """Test connection to a harvest source."""
        db_source = await self.get_harvest_source_by_id(source_id)
        if not db_source:
            return HarvestTestResult(
                success=False,
                message="Harvest source not found",
            )

        import httpx
        import time

        try:
            start_time = time.time()

            async with httpx.AsyncClient(timeout=10.0) as client:
                # Add authentication headers if configured
                headers = {}
                if db_source.auth_type == "api_key" and db_source.auth_config:
                    api_key = db_source.auth_config.get("api_key")
                    header_name = db_source.auth_config.get("header_name", "X-API-Key")
                    headers[header_name] = api_key

                response = await client.get(db_source.url, headers=headers)
                response_time = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    # Try to parse as JSON to count APIs
                    apis_found = None
                    try:
                        data = response.json()
                        if isinstance(data, dict):
                            # APIs.guru format
                            apis_found = len(data)
                        elif isinstance(data, list):
                            apis_found = len(data)
                    except:
                        pass

                    return HarvestTestResult(
                        success=True,
                        message=f"Successfully connected to {db_source.name}",
                        response_time_ms=round(response_time, 2),
                        status_code=response.status_code,
                        apis_found=apis_found,
                    )
                else:
                    return HarvestTestResult(
                        success=False,
                        message=f"HTTP {response.status_code}: {response.text[:200]}",
                        response_time_ms=round(response_time, 2),
                        status_code=response.status_code,
                    )

        except Exception as e:
            return HarvestTestResult(
                success=False,
                message=f"Connection failed: {str(e)}",
                error_details=str(e),
            )

    async def update_harvest_stats(
        self, source_id: int, success: bool, error_msg: Optional[str] = None
    ):
        """Update harvest statistics for a source."""
        db_source = await self.get_harvest_source_by_id(source_id)
        if not db_source:
            return

        db_source.last_harvested_at = datetime.utcnow()
        db_source.harvest_count += 1

        if not success and error_msg:
            db_source.last_error = error_msg[:1000]  # Truncate long errors

        await self.db.commit()

    async def get_harvest_stats(self) -> Dict[str, Any]:
        """Get overall harvest statistics."""
        # Total sources
        query = select(func.count(HarvestSource.id))
        result = await self.db.execute(query)
        total_sources = result.scalar()

        # Enabled sources
        query = select(func.count(HarvestSource.id)).where(HarvestSource.enabled == True)
        result = await self.db.execute(query)
        enabled_sources = result.scalar()

        disabled_sources = total_sources - enabled_sources

        # Count by type
        query = select(HarvestSource.type, func.count(HarvestSource.id)).group_by(HarvestSource.type)
        result = await self.db.execute(query)
        type_counts = result.all()
        sources_by_type = {t: c for t, c in type_counts}

        # Count by category
        query = select(HarvestSource.category, func.count(HarvestSource.id)).where(HarvestSource.category.isnot(None)).group_by(HarvestSource.category)
        result = await self.db.execute(query)
        category_counts = result.all()
        sources_by_category = {c: cnt for c, cnt in category_counts}

        return {
            "total_sources": total_sources,
            "enabled_sources": enabled_sources,
            "disabled_sources": disabled_sources,
            "sources_by_type": sources_by_type,
            "sources_by_category": sources_by_category,
        }

    async def initialize_default_sources(self):
        """Initialize default harvest sources if none exist."""
        query = select(func.count(HarvestSource.id))
        result = await self.db.execute(query)
        existing_count = result.scalar()
        
        if existing_count > 0:
            return  # Already initialized

        default_sources = [
            {
                "name": "APIs.guru Directory",
                "type": "api_directory",
                "url": "https://apis.guru/openapis.json",
                "description": "Comprehensive OpenAPI specification directory",
                "category": "general",
                "priority": 10,
            },
            {
                "name": "RapidAPI Marketplace",
                "type": "marketplace",
                "url": "https://rapidapi.com/search/apis",
                "description": "Largest API marketplace with 10,000+ APIs",
                "category": "general",
                "priority": 8,
            },
            {
                "name": "Postman API Network",
                "type": "marketplace",
                "url": "https://www.postman.com/explore/apis",
                "description": "Developer-focused API collection",
                "category": "general",
                "priority": 7,
            },
            {
                "name": "GitHub API Repositories",
                "type": "github",
                "url": "https://api.github.com/search/repositories?q=topic:api+language:JSON",
                "description": "GitHub repositories with API specifications",
                "category": "developer_tools",
                "priority": 5,
            },
        ]

        for source_data in default_sources:
            source = HarvestSource(**source_data)
            self.db.add(source)

        await self.db.commit()
        logger.info("Initialized default harvest sources", count=len(default_sources))

    async def search_web_sources(
        self, query: str, source_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for harvest sources on the web based on a query.
        This searches existing knowledge base and returns suggestions.
        """
        import httpx
        
        results = []
        query_lower = query.lower()
        
        # Search the knowledge base for matching APIs
        try:
            knowledge_db = await get_knowledge_db()
            if knowledge_db:
                # Search for APIs matching the query
                search_results = await knowledge_db.search(
                    collection="financial_apis" if source_type == "financial" else "api_specifications",
                    query=query,
                    top_k=10
                )
                
                for result in search_results:
                    results.append({
                        "name": result.get("api_name", result.get("name", "Unknown API")),
                        "type": "api_directory",
                        "url": result.get("documentation_url", result.get("url", "")),
                        "description": result.get("description", ""),
                        "category": result.get("category", "general"),
                        "source": "knowledge_base",
                        "confidence": result.get("score", 0.8),
                    })
        except Exception as e:
            logger.warning("Failed to search knowledge base", error=str(e))
        
        # If no results from knowledge base, return curated suggestions based on query
        if not results:
            # Provide curated suggestions based on common API categories
            curated_sources = self._get_curated_sources_for_query(query_lower, source_type)
            results.extend(curated_sources)
        
        return results
    
    def _get_curated_sources_for_query(self, query: str, source_type: Optional[str]) -> List[Dict[str, Any]]:
        """Get curated source suggestions based on query keywords."""
        suggestions = []
        
        # Define curated source templates based on common categories
        curated = [
            {
                "keywords": ["payment", "stripe", "paypal", "billing", "transaction"],
                "sources": [
                    {"name": "Stripe API", "type": "api_directory", "url": "https://stripe.com/docs/api", "description": "Stripe payment processing API", "category": "payments"},
                    {"name": "PayPal API", "type": "api_directory", "url": "https://developer.paypal.com/docs/api/overview/", "description": "PayPal payment APIs", "category": "payments"},
                ]
            },
            {
                "keywords": ["crm", "salesforce", "hubspot", "contact", "customer"],
                "sources": [
                    {"name": "Salesforce API", "type": "api_directory", "url": "https://developer.salesforce.com/docs/api", "description": "Salesforce CRM API", "category": "crm"},
                    {"name": "HubSpot API", "type": "api_directory", "url": "https://developers.hubspot.com/docs/api/overview", "description": "HubSpot CRM API", "category": "crm"},
                ]
            },
            {
                "keywords": ["ecommerce", "shopify", "commerce", "store", "product"],
                "sources": [
                    {"name": "Shopify Admin API", "type": "api_directory", "url": "https://shopify.dev/docs/api/admin-rest", "description": "Shopify e-commerce API", "category": "ecommerce"},
                    {"name": "WooCommerce API", "type": "api_directory", "url": "https://woocommerce.github.io/woocommerce-rest-api-docs/", "description": "WooCommerce REST API", "category": "ecommerce"},
                ]
            },
            {
                "keywords": ["accounting", "invoice", "quickbooks", "xero"],
                "sources": [
                    {"name": "QuickBooks API", "type": "api_directory", "url": "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities", "description": "QuickBooks Online API", "category": "accounting"},
                    {"name": "Xero API", "type": "api_directory", "url": "https://developer.xero.com/documentation/api/accounting/overview", "description": "Xero Accounting API", "category": "accounting"},
                ]
            },
            {
                "keywords": ["shipping", "logistics", "fedex", "ups", "tracking"],
                "sources": [
                    {"name": "FedEx API", "type": "api_directory", "url": "https://developer.fedex.com/us/en/apis.html", "description": "FedEx shipping API", "category": "shipping"},
                    {"name": "UPS API", "type": "api_directory", "url": "https://developer.ups.com/", "description": "UPS shipping API", "category": "shipping"},
                ]
            },
            {
                "keywords": ["communication", "email", "sms", "twilio", "message"],
                "sources": [
                    {"name": "Twilio API", "type": "api_directory", "url": "https://www.twilio.com/docs/usage/api", "description": "Twilio communication API", "category": "communication"},
                    {"name": "SendGrid API", "type": "api_directory", "url": "https://sendgrid.com/docs/api-reference/", "description": "SendGrid email API", "category": "communication"},
                ]
            },
        ]
        
        for category in curated:
            if any(kw in query for kw in category["keywords"]):
                for source in category["sources"]:
                    source_copy = source.copy()
                    source_copy["source"] = "curated"
                    source_copy["confidence"] = 0.95
                    suggestions.append(source_copy)
        
        # If no matches, provide general API directories
        if not suggestions:
            suggestions.extend([
                {"name": "APIs.guru Directory", "type": "api_directory", "url": "https://apis.guru/openapis.json", "description": "Comprehensive OpenAPI specification directory (~3000 APIs)", "category": "general", "source": "curated", "confidence": 0.7},
                {"name": "RapidAPI Marketplace", "type": "marketplace", "url": "https://rapidapi.com/discovery", "description": "Discover APIs on RapidAPI", "category": "general", "source": "curated", "confidence": 0.6},
                {"name": "Public APIs Directory", "type": "api_directory", "url": "https://github.com/public-apis/public-apis", "description": "Curated list of free APIs", "category": "general", "source": "curated", "confidence": 0.5},
            ])
        
        # Filter by source type if specified
        if source_type:
            suggestions = [s for s in suggestions if s.get("type") == source_type]
        
        return suggestions[:10]
