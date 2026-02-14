"""
Agent Collaboration Hub API Endpoints

REST API for monitoring agent collaboration, shared state, and inter-agent communication.
"""

import structlog
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.harvest_collaboration_integration import AgentCollaborationService
from app.schemas.agent_collaboration import (
    SharedStateResponse,
    AgentActivityResponse,
    AgentCommunicationLog,
    AgentMetrics,
    CollaborationStats,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/agent-collaboration", tags=["agent-collaboration"])


@router.get("/shared-state", response_model=SharedStateResponse)
async def get_shared_state(db: Session = Depends(get_db)):
    """Get the current shared whiteboard state."""
    try:
        # TODO: Implement shared state management with database
        # For now, return a basic structure that can be extended
        current_state = {
            "workflow_id": "wf-001",
            "status": "running",
            "current_agent": "analyst-001",
            "progress": 65,
            "last_update": datetime.now().isoformat(),
        }

        # Mock recent changes - replace with database query
        recent_changes = [
            {
                "timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(),
                "agent_id": "analyst-001",
                "action": "analyzed_performance_data",
                "data_keys": ["performance_metrics", "bottlenecks"],
            },
            {
                "timestamp": (datetime.now() - timedelta(minutes=3)).isoformat(),
                "agent_id": "writer-001",
                "action": "generated_report",
                "data_keys": ["performance_report"],
            },
        ]

        return SharedStateResponse(
            current_state=current_state,
            recent_changes=recent_changes,
            last_updated=datetime.now().isoformat(),
        )

    except Exception as e:
        logger.error("Failed to get shared state", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve shared state")


@router.get("/agents/activity", response_model=List[AgentActivityResponse])
async def get_agent_activity(
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
):
    """Get recent agent activity."""
    try:
        activities = AgentCollaborationService.get_agent_activities(db, hours=hours)
        return activities

    except Exception as e:
        logger.error("Failed to get agent activity", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve agent activity")


@router.get("/communication/log", response_model=List[AgentCommunicationLog])
async def get_communication_log(
    hours: int = Query(1, ge=1, le=24),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get recent inter-agent communication logs."""
    try:
        communications = AgentCollaborationService.get_agent_communications(db, hours=hours, limit=limit)
        return communications

    except Exception as e:
        logger.error("Failed to get communication log", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve communication log")


@router.get("/agents/{agent_id}/metrics", response_model=AgentMetrics)
async def get_agent_metrics(agent_id: str, db: Session = Depends(get_db)):
    """Get detailed metrics for a specific agent."""
    try:
        metrics = AgentCollaborationService.get_agent_metrics(db, agent_id)
        if not metrics:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        return metrics

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get agent metrics", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve agent metrics")


@router.get("/stats/overview", response_model=CollaborationStats)
async def get_collaboration_stats(db: Session = Depends(get_db)):
    """Get overall collaboration statistics."""
    try:
        stats = AgentCollaborationService.get_collaboration_stats(db)
        return stats

    except Exception as e:
        logger.error("Failed to get collaboration stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve collaboration statistics")