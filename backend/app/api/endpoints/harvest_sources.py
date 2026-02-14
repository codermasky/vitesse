"""
Harvest Source API Endpoints

REST API for managing configurable harvest sources.
"""

import structlog
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.harvest_source import HarvestSource
from app.schemas.harvest_source import (
    HarvestSourceCreate,
    HarvestSourceUpdate,
    HarvestSourceResponse,
    HarvestSourceList,
    HarvestTestResult,
    HarvestSourceStats,
)
from app.services.harvest_source_service import HarvestSourceService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/harvest-sources", tags=["harvest-sources"])


@router.get("/", response_model=HarvestSourceList)
async def list_harvest_sources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    enabled_only: bool = Query(False),
    source_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List harvest sources with optional filtering."""
    service = HarvestSourceService(db)
    sources = service.get_harvest_sources(
        skip=skip,
        limit=limit,
        enabled_only=enabled_only,
        source_type=source_type,
        category=category,
    )

    # Get total count for pagination
    total_query = db.query(HarvestSource)
    if enabled_only:
        total_query = total_query.filter(HarvestSource.enabled == True)
    if source_type:
        total_query = total_query.filter(HarvestSource.type == source_type)
    if category:
        total_query = total_query.filter(HarvestSource.category == category)

    total = total_query.count()
    pages = (total + limit - 1) // limit if limit > 0 else 1
    page = (skip // limit) + 1 if limit > 0 else 1

    return HarvestSourceList(
        items=sources,
        total=total,
        page=page,
        page_size=limit,
        pages=pages,
    )


@router.get("/{source_id}", response_model=HarvestSourceResponse)
async def get_harvest_source(source_id: int, db: Session = Depends(get_db)):
    """Get a specific harvest source by ID."""
    service = HarvestSourceService(db)
    source = service.get_harvest_source_by_id(source_id)

    if not source:
        raise HTTPException(status_code=404, detail="Harvest source not found")

    return source


@router.post("/", response_model=HarvestSourceResponse, status_code=201)
async def create_harvest_source(
    source_data: HarvestSourceCreate,
    db: Session = Depends(get_db),
):
    """Create a new harvest source."""
    service = HarvestSourceService(db)
    source = service.create_harvest_source(source_data)
    return source


@router.put("/{source_id}", response_model=HarvestSourceResponse)
async def update_harvest_source(
    source_id: int,
    update_data: HarvestSourceUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing harvest source."""
    service = HarvestSourceService(db)
    source = service.update_harvest_source(source_id, update_data)

    if not source:
        raise HTTPException(status_code=404, detail="Harvest source not found")

    return source


@router.delete("/{source_id}")
async def delete_harvest_source(source_id: int, db: Session = Depends(get_db)):
    """Delete a harvest source."""
    service = HarvestSourceService(db)
    deleted = service.delete_harvest_source(source_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Harvest source not found")

    return {"message": "Harvest source deleted successfully"}


@router.post("/{source_id}/test", response_model=HarvestTestResult)
async def test_harvest_source(source_id: int, db: Session = Depends(get_db)):
    """Test connection to a harvest source."""
    service = HarvestSourceService(db)
    result = await service.test_harvest_source(source_id)
    return result


@router.get("/stats/overview", response_model=HarvestSourceStats)
async def get_harvest_stats(db: Session = Depends(get_db)):
    """Get harvest source statistics."""
    service = HarvestSourceService(db)
    stats = service.get_harvest_stats()
    return HarvestSourceStats(**stats)


@router.post("/initialize-defaults")
async def initialize_default_sources(db: Session = Depends(get_db)):
    """Initialize default harvest sources if none exist."""
    service = HarvestSourceService(db)
    service.initialize_default_sources()
    return {"message": "Default harvest sources initialized successfully"}
