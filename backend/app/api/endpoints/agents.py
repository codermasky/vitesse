from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any, Dict, Optional
from app.api import deps
from app.agents.orchestrator import agent_orchestrator

router = APIRouter()


@router.get("/")
async def list_agents(current_user: Any = Depends(deps.get_current_user)):
    """List available agents in AgentStack."""
    return {
        "agents": [
            {
                "id": "ingestor",
                "name": "Ingestor Agent",
                "role": "API Discovery and Specification",
                "description": "Authonomously discovers API endpoints and synthesizes OpenAPI specifications from raw documentation.",
                "capabilities": [
                    "api_discovery",
                    "spec_synthesis",
                    "html_parsing",
                ],
                "status": "active",
                "success_rate": 0.95,
                "avg_time_ms": 3200,
                "category": "Integration",
            },
            {
                "id": "deployer",
                "name": "Deployment Agent",
                "role": "Integration Deployment",
                "description": "Generates and deploys standalone integration containers with self-healing capabilities.",
                "capabilities": [
                    "code_generation",
                    "container_deployment",
                    "process_management",
                ],
                "status": "active",
                "success_rate": 1.00,
                "avg_time_ms": 4500,
                "category": "DevOps",
            },
            {
                "id": "sentinel",
                "name": "Sentinel Agent",
                "role": "Security and compliance monitoring",
                "description": "Monitors all system interactions for security threats, PII leakage, and policy violations.",
                "capabilities": [
                    "security_monitoring",
                    "pii_detection",
                    "audit_logging",
                ],
                "status": "active",
                "success_rate": 1.00,
                "avg_time_ms": 45,
                "category": "Security",
            },
        ]
    }


@router.get("/pipeline")
async def get_pipeline_structure(current_user: Any = Depends(deps.get_current_user)):
    """Get the generic workflow pipeline structure."""
    return {
        "nodes": [
            {"id": "analyst", "type": "agent", "label": "Analyst"},
            {"id": "reviewer", "type": "agent", "label": "Reviewer"},
            {"id": "writer", "type": "agent", "label": "Writer"},
        ],
        "edges": [
            {"source": "analyst", "target": "reviewer"},
            {"source": "reviewer", "target": "writer"},
        ],
    }


@router.post("/orchestrate")
async def orchestrate_workflow(
    payload: Dict[str, Any], current_user: Any = Depends(deps.get_current_user)
):
    """Generic entry point for agent orchestration."""
    workflow_id = payload.get("workflow_id", "gen-work-" + str(current_user.id))
    # Integration with orchestrator.process_workflow
    return await agent_orchestrator.process_workflow(
        workflow_id=workflow_id,
        line_items=payload.get("data", []),
        knowledge_context=[],
        metadata=payload.get("metadata", {}),
    )
