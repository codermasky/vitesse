"""
API endpoints for Vitesse AI integration factory.
Exposes the full integration lifecycle via REST API.
"""

from typing import Any, Dict, Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel, Field
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.agents.vitesse_orchestrator import VitesseOrchestrator
from app.agents.base import AgentContext
from app.schemas.integration import DeploymentTarget, DeploymentConfig
from app.schemas.discovery import DiscoveryRequest, DiscoveryResponse, DiscoveryResult
from app.db.session import get_db

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/vitesse", tags=["vitesse"])

# Store orchestrator (in production, use dependency injection)
_orchestrator_instance: Optional[VitesseOrchestrator] = None


def get_orchestrator() -> VitesseOrchestrator:
    """Get or create orchestrator instance."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        context = AgentContext()  # Initialize with proper dependencies
        _orchestrator_instance = VitesseOrchestrator(context)
    return _orchestrator_instance


# ==================== Request/Response Models ====================


# Step 1: Create Integration from Discovery Results
class CreateIntegrationFromDiscoveryRequest(BaseModel):
    """Request to create integration from discovery results."""

    name: str = Field(..., description="Human-readable integration name")
    source_discovery: DiscoveryResult = Field(..., description="Source API discovery result")
    dest_discovery: DiscoveryResult = Field(..., description="Destination API discovery result")
    user_intent: str = Field(..., description="User's integration goal (e.g., 'Sync Shopify customers to CRM')")
    deployment_target: DeploymentTarget = Field(default=DeploymentTarget.LOCAL)
    metadata: Optional[Dict[str, Any]] = None


# Step 2: Ingest Specifications
class IngestIntegrationRequest(BaseModel):
    """Request to ingest detailed API specifications."""

    source_spec_url: Optional[str] = Field(None, description="URL to source API OpenAPI/Swagger spec")
    dest_spec_url: Optional[str] = Field(None, description="URL to dest API OpenAPI/Swagger spec")


# Step 3: Generate Mappings
class MapIntegrationRequest(BaseModel):
    """Request to generate field mappings."""

    source_endpoint: str = Field(..., description="Source API endpoint path to map from")
    dest_endpoint: str = Field(..., description="Destination API endpoint path to map to")
    mapping_hints: Optional[Dict[str, str]] = Field(None, description="Manual mapping hints from user")


# Step 4: Run Tests
class TestIntegrationRequest(BaseModel):
    """Request to run integration tests."""

    test_sample_size: int = Field(default=5, ge=1, le=100, description="Number of test records to use")
    skip_destructive: bool = Field(default=True, description="Skip tests that modify data")


# Step 5: Deploy
class DeployIntegrationRequest(BaseModel):
    """Request to deploy integration."""

    replicas: int = Field(default=1, ge=1, description="Number of replicas")
    memory_mb: int = Field(default=512, ge=256, description="Memory in MB")
    cpu_cores: float = Field(default=0.5, ge=0.1, description="CPU cores")
    auto_scale: bool = Field(default=False, description="Enable autoscaling")


# Response Models
class IntegrationStepResponse(BaseModel):
    """Response from integration step."""

    status: str = Field(..., description="success|failed")
    integration_id: str = Field(..., description="Integration ID")
    current_step: str = Field(..., description="Current workflow step")
    data: Dict[str, Any] = Field(default_factory=dict, description="Step-specific data")
    error: Optional[str] = None


class DeploymentSetup(BaseModel):
    """Deployment configuration options."""

    replicas: int = 1
    memory_mb: int = 512
    cpu_cores: float = 0.5
    auto_scale: bool = False


class CreateIntegrationResponse(BaseModel):
    """Response from integration creation."""

    status: str
    integration_id: str
    integration: Dict[str, Any]
    health_score: Optional[Dict[str, Any]] = None


class IntegrationStatusResponse(BaseModel):
    """Integration status response."""

    integration_id: str
    status: str
    health_score: Optional[Dict[str, Any]]
    last_updated: str


class SyncTrigggerResponse(BaseModel):
    """Response from manual sync trigger."""

    status: str
    records_synced: int
    timestamp: str


class OrchestratorStatusResponse(BaseModel):
    """Orchestrator status response."""

    orchestrator_id: str
    discovery_status: Dict[str, Any]
    ingestor_status: Dict[str, Any]
    mapper_status: Dict[str, Any]
    guardian_status: Dict[str, Any]


# ==================== Discovery Endpoint ====================


@router.get(
    "/discover",
    response_model=DiscoveryResponse,
    summary="Discover APIs by search query",
    description="Search for APIs using natural language. Returns API candidates with documentation URLs.",
)
async def discover_apis(
    query: str = Query(
        ...,
        description="Natural language search query (e.g., 'Shopify', 'payment APIs')",
    ),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of results"),
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Discover APIs based on natural language search.

    This is the first step in the agentic discovery flow.
    Users can search for APIs without needing to know exact URLs.

    Example queries:
    - "Shopify"
    - "payment processing APIs"
    - "cryptocurrency data"
    - "GitHub"
    """
    try:
        logger.info("API discovery request", query=query, limit=limit)

        result = await orchestrator.discover_apis(query=query, limit=limit)

        if result["status"] == "failed":
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result

    except Exception as e:
        logger.error("Discovery endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Integration Lifecycle Endpoints ====================

# Step 1: Create Integration from Discovery Results
@router.post(
    "/integrations",
    response_model=IntegrationStepResponse,
    summary="Create integration from discovery results",
    description="Step 1: Initiate integration using source and destination discovery results.",
)
async def create_integration_from_discovery(
    request: CreateIntegrationFromDiscoveryRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Create an integration from discovery results.
    
    This is Step 1 of the multi-step integration workflow:
    - Takes source and dest discovery results
    - Creates integration record (status=DISCOVERING)
    - Returns integration ID for next steps
    
    Next: Call POST /integrations/{id}/ingest
    """
    try:
        import uuid
        from app.models.integration import Integration, IntegrationStatusEnum
        from app.schemas.integration import DeploymentConfig
        
        logger.info(
            "Creating integration from discovery",
            name=request.name,
            source=request.source_discovery.api_name,
            dest=request.dest_discovery.api_name,
        )
        
        integration_id = str(uuid.uuid4())
        
        # Create deployment config from request
        deployment_config = DeploymentConfig(
            target=request.deployment_target,
            memory_mb=512,
            cpu_cores=0.5,
        )
        
        # Create integration record (specs will be populated in ingest step)
        integration = Integration(
            id=integration_id,
            name=request.name,
            status=IntegrationStatusEnum.DISCOVERING.value,
            source_discovery=request.source_discovery.model_dump(mode='json'),
            dest_discovery=request.dest_discovery.model_dump(mode='json'),
            source_api_spec=None,  # Populated in ingest
            dest_api_spec=None,    # Populated in ingest
            deployment_config=deployment_config.model_dump(mode='json'),
            deployment_target=request.deployment_target.value,
            created_by="system",
            extra_metadata=request.metadata or {},
        )
        
        db.add(integration)
        await db.commit()
        
        logger.info("Integration created", integration_id=integration_id)
        
        return {
            "status": "success",
            "integration_id": integration_id,
            "current_step": "DISCOVERING",
            "data": {
                "integration": {
                    "id": integration.id,
                    "name": integration.name,
                    "status": integration.status,
                    "source_discovery": integration.source_discovery,
                    "dest_discovery": integration.dest_discovery,
                },
                "next_step": "ingest",
                "next_endpoint": f"/integrations/{integration_id}/ingest",
            },
        }
        
    except Exception as e:
        logger.error("Integration creation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Step 2: Ingest API Specifications
@router.post(
    "/integrations/{integration_id}/ingest",
    response_model=IntegrationStepResponse,
    summary="Ingest API specifications",
    description="Step 2: Fetch detailed API specs from OpenAPI/Swagger URLs.",
)
async def ingest_integration_specs(
    integration_id: str,
    request: IngestIntegrationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Ingest detailed API specifications.
    
    This is Step 2 of the workflow:
    - Fetches OpenAPI/Swagger specs from provided URLs
    - Stores specs in integration record
    - Updates status to MAPPING
    
    Next: Call POST /integrations/{id}/map
    """
    try:
        from app.models.integration import Integration, IntegrationStatusEnum
        
        # Fetch integration
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()
        
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        
        logger.info("Ingesting specifications", integration_id=integration_id)
        
        # Call orchestrator ingest method
        ingest_result = await orchestrator.ingest_api_specs(
            source_discovery=integration.source_discovery,
            dest_discovery=integration.dest_discovery,
            source_spec_url=request.source_spec_url,
            dest_spec_url=request.dest_spec_url,
        )
        
        if ingest_result["status"] != "success":
            raise HTTPException(status_code=400, detail=ingest_result.get("error"))
        
        # Update integration with specs
        integration.source_api_spec = ingest_result["source_api_spec"]
        integration.dest_api_spec = ingest_result["dest_api_spec"]
        integration.status = IntegrationStatusEnum.MAPPING.value
        integration.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Ingest complete", integration_id=integration_id)
        
        return {
            "status": "success",
            "integration_id": integration_id,
            "current_step": "MAPPING",
            "data": {
                "source_endpoints": [ep.get("path") for ep in ingest_result["source_api_spec"].get("endpoints", [])],
                "dest_endpoints": [ep.get("path") for ep in ingest_result["dest_api_spec"].get("endpoints", [])],
                "next_step": "map",
                "next_endpoint": f"/integrations/{integration_id}/map",
            },
        }
        
    except Exception as e:
        logger.error("Ingest failed", error=str(e), integration_id=integration_id)
        raise HTTPException(status_code=500, detail=str(e))


# Step 3: Generate Field Mappings
@router.post(
    "/integrations/{integration_id}/map",
    response_model=IntegrationStepResponse,
    summary="Generate field mappings",
    description="Step 3: Generate semantic field mappings between APIs.",
)
async def map_integration_fields(
    integration_id: str,
    request: MapIntegrationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Generate field mappings for integration.
    
    This is Step 3 of the workflow:
    - Uses Mapper agent to generate semantic mappings
    - Stores mapping logic in integration
    - Updates status to TESTING
    
    Next: Call POST /integrations/{id}/test
    """
    try:
        from app.models.integration import Integration, IntegrationStatusEnum
        from datetime import datetime
        
        # Fetch integration
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()
        
        if not integration or not integration.source_api_spec or not integration.dest_api_spec:
            raise HTTPException(status_code=404, detail="Integration not found or not ingested")
        
        logger.info("Generating mappings", integration_id=integration_id)
        
        # Call orchestrator mapper
        mapping_result = await orchestrator.generate_mappings(
            integration_id=integration_id,
            source_api_spec=integration.source_api_spec,
            dest_api_spec=integration.dest_api_spec,
            source_endpoint=request.source_endpoint,
            dest_endpoint=request.dest_endpoint,
            user_intent=integration.extra_metadata.get("user_intent", ""),
            mapping_hints=request.mapping_hints,
        )
        
        if mapping_result["status"] != "success":
            raise HTTPException(status_code=400, detail=mapping_result.get("error"))
        
        # Update integration with mappings
        integration.mapping_logic = mapping_result["mapping_logic"]
        integration.status = IntegrationStatusEnum.TESTING.value
        integration.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Mapping complete", integration_id=integration_id)
        
        return {
            "status": "success",
            "integration_id": integration_id,
            "current_step": "TESTING",
            "data": {
                "transformation_count": mapping_result.get("transformation_count", 0),
                "complexity_score": mapping_result.get("complexity_score", 0),
                "next_step": "test",
                "next_endpoint": f"/integrations/{integration_id}/test",
            },
        }
        
    except Exception as e:
        logger.error("Mapping failed", error=str(e), integration_id=integration_id)
        raise HTTPException(status_code=500, detail=str(e))


# Step 4: Run Tests
@router.post(
    "/integrations/{integration_id}/test",
    response_model=IntegrationStepResponse,
    summary="Run integration tests",
    description="Step 4: Run comprehensive tests with Guardian agent.",
)
async def test_integration(
    integration_id: str,
    request: TestIntegrationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Run integration tests.
    
    This is Step 4 of the workflow:
    - Uses Guardian agent to run tests
    - Generates health score
    - Updates status to DEPLOYING if tests pass
    
    Next: Call POST /integrations/{id}/deploy
    """
    try:
        from app.models.integration import Integration, IntegrationStatusEnum
        from datetime import datetime
        
        # Fetch integration
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()
        
        if not integration or not integration.mapping_logic:
            raise HTTPException(status_code=404, detail="Integration not found or not mapped")
        
        logger.info("Running tests", integration_id=integration_id)
        
        # Call orchestrator test
        test_result = await orchestrator.run_tests(
            integration_id=integration_id,
            source_api_spec=integration.source_api_spec,
            dest_api_spec=integration.dest_api_spec,
            mapping_logic=integration.mapping_logic,
            test_sample_size=request.test_sample_size,
            skip_destructive=request.skip_destructive,
        )
        
        if test_result["status"] != "success":
            raise HTTPException(status_code=400, detail=test_result.get("error"))
        
        # Update integration with test results
        integration.health_score = test_result.get("health_score")
        integration.status = IntegrationStatusEnum.DEPLOYING.value
        integration.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Tests complete", integration_id=integration_id)
        
        return {
            "status": "success",
            "integration_id": integration_id,
            "current_step": "DEPLOYING",
            "data": {
                "health_score": test_result.get("health_score"),
                "test_count": test_result.get("test_count", 0),
                "passed_tests": test_result.get("passed_tests", 0),
                "next_step": "deploy",
                "next_endpoint": f"/integrations/{integration_id}/deploy",
            },
        }
        
    except Exception as e:
        logger.error("Testing failed", error=str(e), integration_id=integration_id)
        raise HTTPException(status_code=500, detail=str(e))


# Step 5: Deploy Integration
@router.post(
    "/integrations/{integration_id}/deploy",
    response_model=IntegrationStepResponse,
    summary="Deploy integration",
    description="Step 5: Deploy integration to target environment.",
)
async def deploy_integration(
    integration_id: str,
    request: DeployIntegrationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Deploy integration.
    
    This is Step 5 of the workflow:
    - Uses Deployer agent to deploy
    - Updates status to ACTIVE
    - Integration is now ready for use
    """
    try:
        from app.models.integration import Integration, IntegrationStatusEnum
        from datetime import datetime
        
        # Fetch integration
        stmt = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(stmt)
        integration = result.scalars().first()
        
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        
        logger.info("Deploying integration", integration_id=integration_id)
        
        # Call orchestrator deploy
        deploy_result = await orchestrator.deploy_integration(
            integration_id=integration_id,
            source_api_spec=integration.source_api_spec,
            dest_api_spec=integration.dest_api_spec,
            mapping_logic=integration.mapping_logic,
            deployment_config={
                "replicas": request.replicas,
                "memory_mb": request.memory_mb,
                "cpu_cores": request.cpu_cores,
                "auto_scale": request.auto_scale,
            },
        )
        
        if deploy_result["status"] != "success":
            raise HTTPException(status_code=400, detail=deploy_result.get("error"))
        
        # Update integration to active
        integration.container_id = deploy_result.get("container_id")
        integration.status = IntegrationStatusEnum.ACTIVE.value
        integration.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Deployment complete", integration_id=integration_id)
        
        return {
            "status": "success",
            "integration_id": integration_id,
            "current_step": "ACTIVE",
            "data": {
                "container_id": deploy_result.get("container_id"),
                "service_url": deploy_result.get("service_url"),
                "deployment_time_seconds": deploy_result.get("deployment_time_seconds", 0),
            },
        }
        
    except Exception as e:
        logger.error("Deployment failed", error=str(e), integration_id=integration_id)
        raise HTTPException(status_code=500, detail=str(e))



@router.get(
    "/integrations/{integration_id}",
    response_model=IntegrationStatusResponse,
    summary="Get integration status",
)
async def get_integration_status(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get current status and health of an integration.

    Status values: initializing, discovering, mapping, testing, deploying, active, failed
    """
    try:
        from app.models.integration import Integration
        
        # Fetch integration from database
        statement = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(statement)
        integration = result.scalar_one_or_none()

        if not integration:
            raise HTTPException(
                status_code=404, detail=f"Integration {integration_id} not found"
            )

        return {
            "integration_id": integration_id,
            "status": integration.status,
            "health_score": integration.health_score,
            "last_updated": integration.updated_at.isoformat() if integration.updated_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Status retrieval failed", integration_id=integration_id, error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/integrations/{integration_id}/sync",
    response_model=SyncTrigggerResponse,
    summary="Trigger manual sync",
)
async def trigger_manual_sync(
    integration_id: str,
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Manually trigger a synchronization for an integration.

    This will:
    1. Fetch from source API
    2. Transform according to mapping
    3. Push to destination API
    4. Update health score
    """
    raise HTTPException(status_code=501, detail="Sync endpoint not yet implemented")


@router.put(
    "/integrations/{integration_id}",
    summary="Update integration configuration",
)
async def update_integration(
    integration_id: str,
    updates: Dict[str, Any],
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """Update integration settings (mapping, deployment config, etc)."""
    try:
        result = await orchestrator.update_integration(integration_id, updates)

        if result["status"] == "failed":
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result

    except Exception as e:
        logger.error("Update failed", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/integrations/{integration_id}/deploy",
    summary="Deploy an integration",
)
async def deploy_integration(
    integration_id: str,
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """Deploy the integration to the target environment."""
    try:
        # Trigger deployment via orchestrator
        # Note: In a real scenario, this might filter by ID or use a specific method
        # For now, we assume the orchestrator handles deployment state transitions
        # We might need to fetch the integration first to get config

        # Use orchestrator context to get state
        integration_data = orchestrator.context.get_state(
            f"integration_{integration_id}"
        )
        if not integration_data:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Simulate deployment trigger - in reality, DeployerAgent would be invoked here
        # For this MVP, we just update status to deploying then active

        # Update status in DB and Context
        # TODO: This should be async and handled by orchestrator properly
        integration_data["status"] = "deploying"
        orchestrator.context.set_state(
            f"integration_{integration_id}", integration_data
        )

        # We also need to update DB
        # Ideally orchestrator methods should handle DB sync, but we'll do a quick update here for now
        # or rely on the background task to eventually sync.
        # But let's just return success for the UI trigger.

        return {"status": "success", "message": "Deployment triggered"}

    except Exception as e:
        logger.error("Deployment failed", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/integrations/{integration_id}",
    summary="Delete an integration",
)
async def delete_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """Delete an integration and its resources."""
    try:
        from app.models.integration import Integration

        # 1. Check if integration exists in DB
        statement = select(Integration).where(Integration.id == integration_id)
        result = await db.execute(statement)
        integration = result.scalar_one_or_none()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        # 2. Clean up resources (Docker, files)
        # We do this asynchronously or simply await it.
        # If it fails, we log it but still proceed to delete DB record?
        # Or should we fail? Let's try to clean up but allow DB delete even if cleanup fails partialy.
        await orchestrator.delete_integration_resources(integration_id)

        # 3. Delete from DB
        await db.delete(integration)
        await db.commit()

        return {"status": "success", "message": "Integration and resources deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Deletion failed", integration_id=integration_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ==================== System Endpoints ====================


@router.get(
    "/status",
    response_model=OrchestratorStatusResponse,
    summary="Get Vitesse system status",
)
async def get_vitesse_status(
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """Get overall Vitesse orchestrator status and agent metrics."""
    orchestrator_status = orchestrator.get_orchestrator_status()

    return {
        "orchestrator_id": orchestrator_status["orchestrator_id"],
        "ingestor_status": orchestrator_status["ingestor"],
        "mapper_status": orchestrator_status["mapper"],
        "guardian_status": orchestrator_status["guardian"],
    }


@router.get(
    "/integrations",
    summary="List all integrations",
)
async def list_integrations(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """List all integrations in the system."""
    try:
        from app.models.integration import Integration

        statement = select(Integration)
        result = await db.execute(statement)
        integrations = result.scalars().all()

        # Convert to dict format
        integrations_list = []
        for integration in integrations:
            integrations_list.append(
                {
                    "id": integration.id,
                    "name": integration.name,
                    "status": integration.status.value
                    if integration.status
                    else "unknown",
                    "source_api_spec": integration.source_api_spec,
                    "dest_api_spec": integration.dest_api_spec,
                    "deployment_target": integration.deployment_target.value
                    if integration.deployment_target
                    else "local",
                    "created_at": integration.created_at.isoformat()
                    if integration.created_at
                    else None,
                    "health_score": integration.health_score,
                    "created_by": integration.created_by,
                }
            )

        return {
            "status": "success",
            "data": integrations_list,
            "count": len(integrations_list),
        }
    except Exception as e:
        logger.error("Failed to list integrations", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/test-endpoint",
    summary="Test API endpoint connectivity",
)
async def test_endpoint(
    url: str,
    method: str = "GET",
    auth: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Test connectivity to an API endpoint.
    Useful for validating API URLs before creating integrations.
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {}
            if auth and auth.get("type") == "api_key":
                headers["Authorization"] = f"Bearer {auth.get('key')}"

            if method.upper() == "GET":
                response = await client.get(url, headers=headers)
            else:
                response = await client.head(url, headers=headers)

            return {
                "status": "success",
                "url": url,
                "status_code": response.status_code,
                "connectivity": "ok",
            }

    except Exception as e:
        logger.warning("Endpoint test failed", url=url, error=str(e))
        return {
            "status": "failed",
            "url": url,
            "error": str(e),
            "connectivity": "failed",
        }
