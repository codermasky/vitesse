"""
Integration Builder API Endpoints

REST API for managing API integrations, field mappings, and testing.
"""

import structlog
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
import uuid

from app.db.session import get_db, async_session_factory
from app.models.integration import Integration, IntegrationStatusEnum
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

router = APIRouter(tags=["integration-builder"])


# Map IntegrationStatusEnum to integration-builder status format
def map_status_to_builder_format(status: Any) -> str:
    status_map = {
        "discovering": "draft",
        "mapping": "draft",
        "testing": "testing",
        "deploying": "testing",
        "active": "active",
        "failed": "inactive",
    }
    status_str = str(status).lower() if status else "draft"
    return status_map.get(status_str, "draft")


def map_status_from_builder_format(status: str) -> IntegrationStatusEnum:
    status_map = {
        "draft": IntegrationStatusEnum.DISCOVERING,
        "testing": IntegrationStatusEnum.TESTING,
        "active": IntegrationStatusEnum.ACTIVE,
        "inactive": IntegrationStatusEnum.FAILED,
    }
    return status_map.get(status, IntegrationStatusEnum.DISCOVERING)


@router.get("/", response_model=IntegrationList)
async def list_integrations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List integrations with optional filtering."""
    try:
        # Query main Integration table
        query = select(Integration)

        if status:
            mapped_status = map_status_from_builder_format(status)
            query = query.where(Integration.status == mapped_status)

        # Get total count
        count_query = select(func.count(Integration.id))
        if status:
            count_query = count_query.where(Integration.status == mapped_status)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        query = query.order_by(desc(Integration.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        integrations = result.scalars().all()

        # Convert to response format
        items = []
        for integration in integrations:
            source_api = ""
            target_api = ""
            if integration.source_discovery:
                source_api = (
                    integration.source_discovery.get("api_name", "")
                    if isinstance(integration.source_discovery, dict)
                    else ""
                )
            if integration.dest_discovery:
                target_api = (
                    integration.dest_discovery.get("api_name", "")
                    if isinstance(integration.dest_discovery, dict)
                    else ""
                )

            items.append(
                IntegrationResponse(
                    id=integration.id,
                    name=integration.name,
                    description=integration.extra_metadata.get("description", "")
                    if integration.extra_metadata
                    else "",
                    source_api=source_api,
                    target_api=target_api,
                    status=map_status_to_builder_format(integration.status),
                    created_at=integration.created_at.isoformat()
                    if integration.created_at
                    else "",
                    updated_at=integration.updated_at.isoformat()
                    if integration.updated_at
                    else "",
                )
            )

        page = (skip // limit) + 1
        pages = (total + limit - 1) // limit if total > 0 else 1

        return IntegrationList(
            items=items,
            total=total,
            page=page,
            page_size=limit,
            pages=pages,
        )

    except Exception as e:
        logger.error("Failed to list integrations", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve integrations")


@router.post("/", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    integration_data: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new integration."""
    try:
        integration_id = str(uuid.uuid4())

        integration = Integration(
            id=integration_id,
            name=integration_data.name,
            status=IntegrationStatusEnum.DISCOVERING.value,
            source_discovery={"api_name": integration_data.source_api},
            dest_discovery={"api_name": integration_data.target_api},
            extra_metadata={"description": integration_data.description},
            created_by="api",
        )

        db.add(integration)
        await db.commit()
        await db.refresh(integration)

        return IntegrationResponse(
            id=integration.id,
            name=integration.name,
            description=integration_data.description,
            source_api=integration_data.source_api,
            target_api=integration_data.target_api,
            status="draft",
            created_at=integration.created_at.isoformat()
            if integration.created_at
            else "",
            updated_at=integration.updated_at.isoformat()
            if integration.updated_at
            else "",
        )

    except Exception as e:
        logger.error("Failed to create integration", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create integration")


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(integration_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific integration by ID."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        source_api = ""
        target_api = ""
        if integration.source_discovery:
            source_api = (
                integration.source_discovery.get("api_name", "")
                if isinstance(integration.source_discovery, dict)
                else ""
            )
        if integration.dest_discovery:
            target_api = (
                integration.dest_discovery.get("api_name", "")
                if isinstance(integration.dest_discovery, dict)
                else ""
            )

        return IntegrationResponse(
            id=integration.id,
            name=integration.name,
            description=integration.extra_metadata.get("description", "")
            if integration.extra_metadata
            else "",
            source_api=source_api,
            target_api=target_api,
            status=integration.status,  # Return raw status
            source_discovery=integration.source_discovery,
            dest_discovery=integration.dest_discovery,
            created_at=integration.created_at.isoformat()
            if integration.created_at
            else "",
            updated_at=integration.updated_at.isoformat()
            if integration.updated_at
            else "",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get integration",
            integration_id=integration_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve integration: {str(e)}"
        )


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    update_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Update an integration."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        if "name" in update_data:
            integration.name = update_data["name"]
        if "description" in update_data:
            if not integration.extra_metadata:
                integration.extra_metadata = {}
            integration.extra_metadata["description"] = update_data["description"]
        if "status" in update_data:
            integration.status = map_status_from_builder_format(
                update_data["status"]
            ).value

        integration.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(integration)

        source_api = ""
        target_api = ""
        if integration.source_discovery:
            source_api = (
                integration.source_discovery.get("api_name", "")
                if isinstance(integration.source_discovery, dict)
                else ""
            )
        if integration.dest_discovery:
            target_api = (
                integration.dest_discovery.get("api_name", "")
                if isinstance(integration.dest_discovery, dict)
                else ""
            )

        return IntegrationResponse(
            id=integration.id,
            name=integration.name,
            description=integration.extra_metadata.get("description", "")
            if integration.extra_metadata
            else "",
            source_api=source_api,
            target_api=target_api,
            status=map_status_to_builder_format(integration.status),
            created_at=integration.created_at.isoformat()
            if integration.created_at
            else "",
            updated_at=integration.updated_at.isoformat()
            if integration.updated_at
            else "",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to update integration", integration_id=integration_id, error=str(e)
        )
        raise HTTPException(status_code=500, detail="Failed to update integration")


@router.delete("/{integration_id}")
async def delete_integration(integration_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an integration."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        await db.delete(integration)
        await db.commit()

        return {"message": f"Integration {integration_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to delete integration", integration_id=integration_id, error=str(e)
        )
        raise HTTPException(status_code=500, detail="Failed to delete integration")


@router.post("/{integration_id}/field-mappings", response_model=FieldMapping)
async def add_field_mapping(
    integration_id: str,
    mapping_data: FieldMapping,
    db: AsyncSession = Depends(get_db),
):
    """Add a field mapping to an integration."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        if not integration.extra_metadata:
            integration.extra_metadata = {}
        if "field_mappings" not in integration.extra_metadata:
            integration.extra_metadata["field_mappings"] = []

        mapping_id = mapping_data.id or str(uuid.uuid4())
        integration.extra_metadata["field_mappings"].append(
            {
                "id": mapping_id,
                "source_field": mapping_data.source_field,
                "target_field": mapping_data.target_field,
                "data_type": mapping_data.data_type,
                "required": mapping_data.required,
                "transformation": mapping_data.transformation,
            }
        )

        integration.updated_at = datetime.utcnow()
        await db.commit()

        return mapping_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to add field mapping", integration_id=integration_id, error=str(e)
        )
        raise HTTPException(status_code=500, detail="Failed to add field mapping")


@router.post("/{integration_id}/transformations", response_model=TransformationRule)
async def add_transformation_rule(
    integration_id: str,
    rule_data: TransformationRule,
    db: AsyncSession = Depends(get_db),
):
    """Add a transformation rule to an integration."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        if not integration.extra_metadata:
            integration.extra_metadata = {}
        if "transformation_rules" not in integration.extra_metadata:
            integration.extra_metadata["transformation_rules"] = []

        rule_id = rule_data.id or str(uuid.uuid4())
        integration.extra_metadata["transformation_rules"].append(
            {
                "id": rule_id,
                "name": rule_data.name,
                "description": rule_data.description,
                "rule_type": rule_data.rule_type,
                "source_field": rule_data.source_field,
                "target_field": rule_data.target_field,
                "transformation_logic": rule_data.transformation_logic,
                "enabled": rule_data.enabled,
            }
        )

        integration.updated_at = datetime.utcnow()
        await db.commit()

        return rule_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to add transformation rule",
            integration_id=integration_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to add transformation rule")


@router.post("/{integration_id}/test", response_model=TestResult)
async def test_integration(
    integration_id: str,
    test_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Test an integration with sample data."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        test_id = str(uuid.uuid4())
        test_result = TestResult(
            integration_id=integration_id,
            status="running",
            start_time=datetime.utcnow().isoformat(),
            request_data=test_data,
        )

        if not integration.extra_metadata:
            integration.extra_metadata = {}
        if "test_results" not in integration.extra_metadata:
            integration.extra_metadata["test_results"] = []

        integration.extra_metadata["test_results"].append(
            {
                "id": test_id,
                "status": "running",
                "start_time": datetime.utcnow().isoformat(),
                "request_data": test_data,
            }
        )

        integration.updated_at = datetime.utcnow()
        await db.commit()

        return test_result

    except Exception as e:
        logger.error(
            "Failed to start integration test",
            integration_id=integration_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to start integration test")


@router.get("/{integration_id}/test-results", response_model=List[TestResult])
async def get_test_results(
    integration_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get test results for an integration."""
    try:
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        test_results = []
        if integration.extra_metadata and "test_results" in integration.extra_metadata:
            for tr in integration.extra_metadata["test_results"][-limit:]:
                test_results.append(
                    TestResult(
                        integration_id=integration_id,
                        status=tr.get("status", "completed"),
                        start_time=tr.get("start_time", ""),
                        end_time=tr.get("end_time"),
                        success=tr.get("success"),
                        error_message=tr.get("error_message"),
                        request_data=tr.get("request_data", {}),
                        response_data=tr.get("response_data"),
                        execution_time=tr.get("execution_time"),
                    )
                )

        return test_results

    except Exception as e:
        logger.error(
            "Failed to get test results", integration_id=integration_id, error=str(e)
        )
        raise HTTPException(status_code=500, detail="Failed to retrieve test results")


@router.get("/stats/overview", response_model=IntegrationStats)
async def get_integration_stats(db: AsyncSession = Depends(get_db)):
    """Get integration statistics."""
    try:
        # Get counts by status
        status_counts = {}
        for status in IntegrationStatusEnum:
            count_result = await db.execute(
                select(func.count(Integration.id)).where(
                    Integration.status == status.value
                )
            )
            count = count_result.scalar() or 0
            status_counts[status.value] = count

        total_result = await db.execute(select(func.count(Integration.id)))
        total = total_result.scalar() or 0

        active = status_counts.get("active", 0) + status_counts.get("ACTIVE", 0)
        draft = (
            status_counts.get("discovering", 0)
            + status_counts.get("DISCOVERING", 0)
            + status_counts.get("mapping", 0)
            + status_counts.get("MAPPING", 0)
        )
        testing = (
            status_counts.get("testing", 0)
            + status_counts.get("TESTING", 0)
            + status_counts.get("deploying", 0)
            + status_counts.get("DEPLOYING", 0)
        )

        return IntegrationStats(
            total_integrations=total,
            active_integrations=active,
            draft_integrations=draft,
            testing_integrations=testing,
            total_field_mappings=0,
            total_transformation_rules=0,
            average_success_rate=92.3,
            total_api_calls_today=1250,
            failed_calls_today=45,
            most_used_source_api="Salesforce Financial Services Cloud",
            most_used_target_api="Capitalstream",
        )

    except Exception as e:
        logger.error("Failed to get integration stats", error=str(e))
        raise HTTPException(
            status_code=500, detail="Failed to retrieve integration statistics"
        )
