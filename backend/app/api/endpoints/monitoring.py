"""
API endpoints for Vitesse AI Monitoring Dashboard.
Serves real-time data on integration health, recent activities, and self-healing events.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.sql import func
import structlog

from app.db.session import get_db
from app.models.integration import (
    Integration,
    IntegrationAuditLog,
    IntegrationStatusEnum,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/vitesse/monitoring", tags=["monitoring"])


@router.get(
    "/dashboard",
    summary="Get monitoring dashboard data",
    description="Returns aggregated metrics, active integrations, and recent events for the monitoring dashboard.",
)
async def get_monitoring_dashboard(
    db: AsyncSession = Depends(get_db),
    limit_events: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """
    Get all data required for the monitoring dashboard.
    """
    try:
        # 1. Fetch Integrations Summary
        stmt_integrations = select(Integration)
        result_integrations = await db.execute(stmt_integrations)
        integrations = result_integrations.scalars().all()

        total_integrations = len(integrations)
        active_integrations = [
            i for i in integrations if i.status == IntegrationStatusEnum.ACTIVE.value
        ]
        failed_integrations = [
            i for i in integrations if i.status == IntegrationStatusEnum.FAILED.value
        ]

        # Calculate Average Health Score
        total_health = 0.0
        health_count = 0
        for i in integrations:
            score_data = i.health_score
            if score_data and isinstance(score_data, dict):
                score = score_data.get("overall_score", 0.0)
                # Normalize if needed (assuming 0-100)
                total_health += score
                health_count += 1
            elif hasattr(i, "health_score") and isinstance(
                i.health_score, (int, float)
            ):
                total_health += float(i.health_score)
                health_count += 1

        avg_health = (total_health / health_count) if health_count > 0 else 100.0

        # 2. Fetch Recent "Healing Events" (Audit Logs)
        # We look for specific actions related to monitoring and healing
        event_actions = [
            "self_healing_triggered",
            "health_check_failed",
            "integration_created",
            "deployment_success",
            "deployment_failed",
        ]
        stmt_events = (
            select(IntegrationAuditLog)
            .where(IntegrationAuditLog.action.in_(event_actions))
            .order_by(desc(IntegrationAuditLog.created_at))
            .limit(limit_events)
        )
        result_events = await db.execute(stmt_events)
        recent_events = result_events.scalars().all()

        # 3. Format Response
        formatted_integrations = []
        for i in integrations:
            health = 0.0
            if i.health_score and isinstance(i.health_score, dict):
                health = i.health_score.get("overall_score", 0.0)

            formatted_integrations.append(
                {
                    "id": i.id,
                    "name": i.name,
                    "status": i.status,
                    "health_score": health,
                    "last_check": i.last_health_check.isoformat()
                    if i.last_health_check
                    else None,
                    "source": i.source_discovery.get("api_name")
                    if i.source_discovery
                    else "Unknown",
                    "destination": i.dest_discovery.get("api_name")
                    if i.dest_discovery
                    else "Unknown",
                }
            )

        formatted_events = []
        for e in recent_events:
            formatted_events.append(
                {
                    "id": e.id,
                    "integration_id": e.integration_id,
                    "action": e.action,
                    "status": e.status,
                    "details": e.details,
                    "timestamp": e.created_at.isoformat(),
                    "actor": e.actor,
                }
            )

        return {
            "status": "success",
            "metrics": {
                "total_integrations": total_integrations,
                "active_count": len(active_integrations),
                "failed_count": len(failed_integrations),
                "avg_health_score": round(avg_health, 1),
                "system_status": "healthy"
                if avg_health > 80
                else "degraded"
                if avg_health > 50
                else "critical",
            },
            "integrations": formatted_integrations,
            "recent_events": formatted_events,
        }

    except Exception as e:
        logger.error("Failed to fetch dashboard data", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
