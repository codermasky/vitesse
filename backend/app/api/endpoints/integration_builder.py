"""
Integration Builder API Endpoints

REST API for managing API integrations, field mappings, and testing.
"""

import structlog
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.services.harvest_collaboration_integration import IntegrationService
from app.schemas.integration_builder import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationList,
    FieldMapping,
    TransformationRule,
    TestResult,
    IntegrationStats,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/integration-builder", tags=["integration-builder"])


@router.get("/", response_model=IntegrationList)
async def list_integrations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List integrations with optional filtering."""
    try:
        integrations = IntegrationService.get_integrations(db, skip=skip, limit=limit, status=status)
        return integrations

    except Exception as e:
        logger.error("Failed to list integrations", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve integrations")


@router.post("/", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    integration_data: IntegrationCreate,
    db: Session = Depends(get_db),
):
    """Create a new integration."""
    try:
        integration = IntegrationService.create_integration(db, integration_data)
        return integration

    except Exception as e:
        logger.error("Failed to create integration", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create integration")


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(integration_id: str, db: Session = Depends(get_db)):
    """Get a specific integration by ID."""
    try:
        integration = IntegrationService.get_integration(db, integration_id)
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        return integration

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get integration", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve integration")


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    update_data: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """Update an integration."""
    try:
        integration = IntegrationService.update_integration(db, integration_id, update_data)
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        return integration

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update integration", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update integration")


@router.delete("/{integration_id}")
async def delete_integration(integration_id: str, db: Session = Depends(get_db)):
    """Delete an integration."""
    try:
        success = IntegrationService.delete_integration(db, integration_id)
        if not success:
            raise HTTPException(status_code=404, detail="Integration not found")
        return {"message": f"Integration {integration_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete integration", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete integration")


@router.post("/{integration_id}/field-mappings", response_model=FieldMapping)
async def add_field_mapping(
    integration_id: str,
    mapping_data: FieldMapping,
    db: Session = Depends(get_db),
):
    """Add a field mapping to an integration."""
    try:
        mapping = IntegrationService.add_field_mapping(db, integration_id, mapping_data)
        if not mapping:
            raise HTTPException(status_code=404, detail="Integration not found")
        return mapping

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add field mapping", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to add field mapping")


@router.post("/{integration_id}/transformations", response_model=TransformationRule)
async def add_transformation_rule(
    integration_id: str,
    rule_data: TransformationRule,
    db: Session = Depends(get_db),
):
    """Add a transformation rule to an integration."""
    try:
        rule = IntegrationService.add_transformation_rule(db, integration_id, rule_data)
        if not rule:
            raise HTTPException(status_code=404, detail="Integration not found")
        return rule

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add transformation rule", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to add transformation rule")


@router.post("/{integration_id}/test", response_model=TestResult)
async def test_integration(
    integration_id: str,
    test_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Test an integration with sample data."""
    try:
        test_result = IntegrationService.start_integration_test(db, integration_id, test_data)
        background_tasks.add_task(run_integration_test, integration_id, test_data, db)
        return test_result

    except Exception as e:
        logger.error("Failed to start integration test", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to start integration test")


@router.get("/{integration_id}/test-results", response_model=List[TestResult])
async def get_test_results(
    integration_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get test results for an integration."""
    try:
        test_results = IntegrationService.get_integration_test_results(db, integration_id, limit=limit)
        return test_results

    except Exception as e:
        logger.error("Failed to get test results", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve test results")


@router.get("/stats/overview", response_model=IntegrationStats)
async def get_integration_stats(db: Session = Depends(get_db)):
    """Get integration statistics."""
    try:
        stats = IntegrationService.get_integration_stats(db)
        return stats

    except Exception as e:
        logger.error("Failed to get integration stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve integration statistics")


async def run_integration_test(integration_id: str, test_data: Dict[str, Any]):
    """Background task to run integration test."""
    try:
        logger.info("Running integration test", integration_id=integration_id, test_data=test_data)

        # Simulate test execution
        import asyncio
        await asyncio.sleep(2)  # Simulate processing time

        # Mock test result storage
        logger.info("Integration test completed", integration_id=integration_id)

    except Exception as e:
        logger.error("Integration test failed", integration_id=integration_id, error=str(e))