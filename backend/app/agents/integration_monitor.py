"""
Integration Monitor Agent: Tracks integration health and triggers self-healing.
"""

import structlog
from typing import Any, Dict, Optional, List
from datetime import datetime
import asyncio

from app.agents.base import VitesseAgent, AgentContext
from aether.protocols.intelligence import IntelligenceProvider
from app.models.mapping_feedback import MappingFeedback
from aether.observability import metrics

logger = structlog.get_logger(__name__)


class IntegrationMonitorAgent(VitesseAgent):
    """
    Monitors active integrations for health and drift.

    Responsibilities:
    - Consume metrics from aether.observability
    - Track integration health scores over time
    - Analyze success/failure rates
    - Detect drift (semantic mismatch over time)
    - Trigger Self-Healing Agent when thresholds are breached
    """

    def __init__(
        self,
        context: AgentContext,
        agent_id: Optional[str] = None,
        intelligence: Optional[IntelligenceProvider] = None,
    ):
        super().__init__(
            agent_id=agent_id,
            intelligence=intelligence,
            agent_type="integration_monitor",
        )
        self.context = context
        # Thresholds for triggering self-healing
        self.failure_threshold = 0.2  # 20% failure rate triggers warning/investigation
        self.critical_failure_threshold = 0.5  # 50% failure rate triggers self-healing

        # Internal state to track continuous monitoring
        self.monitored_integrations = {}

    async def _execute(
        self,
        context: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute monitoring logic.

        Can be called periodically or triggered by specific events.
        """

        target_integration_id = input_data.get("integration_id")
        action = input_data.get("action", "check_health")

        logger.info(
            "Integration Monitor executing",
            agent_id=self.agent_id,
            action=action,
            integration_id=target_integration_id,
        )

        try:
            if action == "report_metrics":
                # Update internal state with new metrics
                return await self._process_metrics_report(input_data)

            elif action == "check_health":
                # Analyze health of specific or all integrations
                if target_integration_id:
                    return await self._check_integration_health(target_integration_id)
                else:
                    return await self._check_all_integrations()

            else:
                raise ValueError(f"Unknown action: {action}")

        except Exception as e:
            self.error_count += 1
            logger.error("Monitoring execution failed", error=str(e))
            return {"status": "error", "error": str(e)}

    async def _process_metrics_report(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming metrics from Orchestrator or direct observation."""
        integration_id = data.get("integration_id")
        success = data.get("success", False)
        duration = data.get("duration", 0)
        error = data.get("error")

        if not integration_id:
            return {"status": "ignored", "reason": "no_integration_id"}

        # Update internal stats
        if integration_id not in self.monitored_integrations:
            self.monitored_integrations[integration_id] = {
                "total_calls": 0,
                "failed_calls": 0,
                "errors": [],
                "last_success": None,
                "last_failure": None,
                "health_score": 100.0,
            }

        stats = self.monitored_integrations[integration_id]
        stats["total_calls"] += 1
        if not success:
            stats["failed_calls"] += 1
            stats["last_failure"] = datetime.utcnow()
            stats["errors"].append(error)
            # Keep error log manageable
            if len(stats["errors"]) > 10:
                stats["errors"].pop(0)
        else:
            stats["last_success"] = datetime.utcnow()

        # Recalculate health info
        failure_rate = (
            stats["failed_calls"] / stats["total_calls"]
            if stats["total_calls"] > 0
            else 0
        )
        stats["health_score"] = max(0, 100 - (failure_rate * 100))

        # Check if we need to trigger self-healing
        healing_trigger = None
        if failure_rate > self.critical_failure_threshold and stats["total_calls"] > 5:
            healing_trigger = await self._trigger_self_healing(
                integration_id, "high_failure_rate"
            )

        return {
            "status": "success",
            "integration_id": integration_id,
            "updated_health": stats["health_score"],
            "healing_triggered": healing_trigger,
        }

    async def _check_integration_health(self, integration_id: str) -> Dict[str, Any]:
        """Evaluate current health of an integration."""
        stats = self.monitored_integrations.get(integration_id)
        if not stats:
            return {"status": "unknown", "integration_id": integration_id}

        return {
            "status": "active",
            "integration_id": integration_id,
            "health_score": stats["health_score"],
            "metrics": stats,
            "recommendation": "monitor"
            if stats["health_score"] > 80
            else "investigate",
        }

    async def _check_all_integrations(self) -> Dict[str, Any]:
        """Summary of all monitored integrations."""
        results = {}
        critical = []
        for i_id, stats in self.monitored_integrations.items():
            results[i_id] = stats["health_score"]
            if stats["health_score"] < 60:
                critical.append(i_id)

        return {
            "status": "success",
            "monitor_count": len(results),
            "health_summary": results,
            "critical_integrations": critical,
        }

    async def _trigger_self_healing(
        self, integration_id: str, reason: str
    ) -> Dict[str, Any]:
        """Request self-healing from Orchestrator."""
        logger.warning(
            "Triggering self-healing", integration_id=integration_id, reason=reason
        )

        # in a real implementation, this would call the Orchestrator
        # accessing orchestrator via context if available, or just returning the recommendation

        # Ideally, we emit an event or call a specialized service
        # For this implementation, we'll return the instruction
        return {
            "action": "heal",
            "integration_id": integration_id,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
        }
