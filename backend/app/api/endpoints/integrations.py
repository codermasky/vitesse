"""
API endpoints for Vitesse AI integration factory.
Exposes the full integration lifecycle via REST API.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.agents.vitesse_orchestrator import VitesseOrchestrator
from app.agents.base import AgentContext
from app.schemas.integration import DeploymentTarget, DeploymentConfig
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


class CreateIntegrationRequest(BaseModel):
    """Request to create a new integration."""

    source_api_url: str
    source_api_name: str
    dest_api_url: str
    dest_api_name: str
    user_intent: str
    deployment_target: DeploymentTarget = DeploymentTarget.LOCAL
    source_auth: Optional[Dict[str, Any]] = None
    dest_auth: Optional[Dict[str, Any]] = None
    source_spec_url: Optional[str] = None
    dest_spec_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


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
    ingestor_status: Dict[str, Any]
    mapper_status: Dict[str, Any]
    guardian_status: Dict[str, Any]


# ==================== Integration Lifecycle Endpoints ====================


@router.post(
    "/integrations",
    response_model=CreateIntegrationResponse,
    summary="Create new integration",
    description="End-to-end integration creation: discovery → mapping → testing → ready for deployment",
)
async def create_integration(
    request: CreateIntegrationRequest,
    background_tasks: BackgroundTasks,
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Create a complete integration between two APIs.

    Process:
    1. **Ingestor**: Discover source and destination APIs
    2. **Mapper**: Generate semantic field mappings
    3. **Guardian**: Run comprehensive tests (100+ shadow calls)
    4. **Status**: Ready for deployment if health score ≥ 70/100

    For APIs with OpenAPI/Swagger specs available:
    ```json
    {
        "source_api_url": "https://api.shopify.com/swagger.json",
        "source_api_name": "Shopify",
        "dest_api_url": "https://api.credo.com/openapi.json",
        "dest_api_name": "Credo CRM",
        "user_intent": "Sync customers and orders from Shopify to Credo",
        "deployment_target": "local"
    }
    ```

    For APIs without public specs (use spec_url parameter):
    ```json
    {
        "source_api_url": "https://api.coingecko.com/api/v3",
        "source_api_name": "CoinGecko",
        "source_spec_url": "https://api.coingecko.com/swagger.json",
        "dest_api_url": "https://your-crm.com/api",
        "dest_api_name": "Your CRM",
        "dest_spec_url": "https://your-crm.com/api/openapi.json",
        "user_intent": "Sync cryptocurrency data",
        "deployment_target": "local"
    }
    ```
    """
    try:
        logger.info(
            "Creating integration",
            source=request.source_api_name,
            dest=request.dest_api_name,
        )

        # Build deployment config
        deployment_config = DeploymentConfig(
            target=request.deployment_target,
            memory_mb=512,
            cpu_cores=0.5,
        )

        # Create integration
        result = await orchestrator.create_integration(
            source_api_url=request.source_api_url,
            source_api_name=request.source_api_name,
            dest_api_url=request.dest_api_url,
            dest_api_name=request.dest_api_name,
            user_intent=request.user_intent,
            deployment_config=deployment_config,
            created_by="system",  # TODO: Get from auth context
            source_auth=request.source_auth,
            dest_auth=request.dest_auth,
            source_spec_url=request.source_spec_url,
            dest_spec_url=request.dest_spec_url,
            metadata=request.metadata,
        )

        if result["status"] == "failed":
            error_msg = result.get("error", "Unknown error")
            # Map common user errors to 400/422
            status_code = (
                400
                if "Could not fetch" in error_msg
                or "403" in error_msg
                or "404" in error_msg
                else 500
            )
            raise HTTPException(status_code=status_code, detail=error_msg)

        return result

    except Exception as e:
        logger.error("Integration creation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/integrations/{integration_id}",
    response_model=IntegrationStatusResponse,
    summary="Get integration status",
)
async def get_integration_status(
    integration_id: str,
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Get current status and health of an integration.

    Status values: initializing, discovering, mapping, testing, deploying, active, failed
    """
    try:
        integration = orchestrator.context.get_state(f"integration_{integration_id}")

        if not integration:
            raise HTTPException(
                status_code=404, detail=f"Integration {integration_id} not found"
            )

        return {
            "integration_id": integration_id,
            "status": integration.get("status", "unknown"),
            "health_score": integration.get("health_score"),
            "last_updated": integration.get("updated_at"),
        }

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


@router.delete(
    "/integrations/{integration_id}",
    summary="Delete an integration",
)
async def delete_integration(
    integration_id: str,
    orchestrator: VitesseOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """Delete an integration and stop all syncs."""
    raise HTTPException(status_code=501, detail="Delete endpoint not yet implemented")


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
