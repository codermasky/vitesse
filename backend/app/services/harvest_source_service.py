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
