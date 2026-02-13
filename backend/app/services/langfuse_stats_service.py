"""
LangFuse Statistics Service

Fetches and aggregates LLM monitoring data from LangFuse API.
"""

import httpx
import structlog
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings

logger = structlog.get_logger(__name__)


class LangfuseStatsService:
    """Service for fetching LangFuse metrics and statistics."""

    @staticmethod
    async def get_llm_call_stats(
        hours: int = 24,
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get LLM call statistics for the specified time period.

        Args:
            hours: Number of hours to look back
            agent_id: Optional agent filter

        Returns:
            Dictionary with call statistics
        """
        if not settings.ENABLE_LANGFUSE or not settings.LANGFUSE_PUBLIC_KEY:
            return {
                "error": "LangFuse not configured",
                "total_calls": 0,
                "total_tokens": 0,
                "total_cost": 0,
            }

        try:
            # Build query params
            params = {}
            if hours:
                start_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
                params["startTime"] = start_time

            logger.info("Fetching LangFuse stats", hours=hours, agent_id=agent_id)

            async with httpx.AsyncClient() as client:
                # Fetch traces with optional metadata filter
                url = f"{settings.LANGFUSE_HOST}/api/public/traces"

                headers = {
                    "Authorization": f"Basic {settings.LANGFUSE_PUBLIC_KEY}",
                    "Content-Type": "application/json",
                }

                response = await client.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=10.0,
                )

                if response.status_code != 200:
                    logger.warning(
                        "LangFuse API error",
                        status=response.status_code,
                        error=response.text,
                    )
                    return {
                        "error": f"LangFuse API error: {response.status_code}",
                        "total_calls": 0,
                    }

                data = response.json()
                traces = data.get("data", [])

                # Filter by agent_id if specified
                if agent_id:
                    traces = [
                        t
                        for t in traces
                        if t.get("metadata", {}).get("agent_id") == agent_id
                    ]

                # Aggregate statistics
                total_calls = len(traces)
                total_tokens = 0
                models_used = {}
                agents_used = {}

                for trace in traces:
                    # Count tokens
                    observations = trace.get("observations", [])
                    for obs in observations:
                        if obs.get("type") == "llm":
                            total_tokens += obs.get("usage", {}).get("total_tokens", 0)

                    # Track models and agents
                    metadata = trace.get("metadata", {})
                    model = metadata.get("model", "unknown")
                    agent = metadata.get("agent_id", "unknown")

                    models_used[model] = models_used.get(model, 0) + 1
                    agents_used[agent] = agents_used.get(agent, 0) + 1

                logger.info(
                    "LangFuse stats retrieved",
                    total_calls=total_calls,
                    total_tokens=total_tokens,
                )

                return {
                    "total_calls": total_calls,
                    "total_tokens": total_tokens,
                    "avg_tokens_per_call": (
                        total_tokens // total_calls if total_calls > 0 else 0
                    ),
                    "models": models_used,
                    "agents": agents_used,
                    "time_range_hours": hours,
                }

        except httpx.ConnectError:
            logger.error("Failed to connect to LangFuse", host=settings.LANGFUSE_HOST)
            return {
                "error": f"Cannot connect to LangFuse at {settings.LANGFUSE_HOST}",
                "total_calls": 0,
            }
        except Exception as e:
            logger.error("Error fetching LangFuse stats", error=str(e), exc_info=True)
            return {
                "error": f"Error fetching stats: {str(e)}",
                "total_calls": 0,
            }

    @staticmethod
    async def get_agent_metrics(agent_id: str, hours: int = 24) -> Dict[str, Any]:
        """Get detailed metrics for a specific agent."""
        if not settings.ENABLE_LANGFUSE or not settings.LANGFUSE_PUBLIC_KEY:
            return {"error": "LangFuse not configured", "agent_id": agent_id}

        try:
            stats = await LangfuseStatsService.get_llm_call_stats(
                hours=hours, agent_id=agent_id
            )

            return {
                "agent_id": agent_id,
                "metrics": stats,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(
                "Error fetching agent metrics",
                agent_id=agent_id,
                error=str(e),
                exc_info=True,
            )
            return {"error": str(e), "agent_id": agent_id}

    @staticmethod
    def get_langfuse_dashboard_url() -> str:
        """Get the public URL for LangFuse dashboard."""
        host = settings.langfuse_dashboard_url
        # Remove trailing slash if present
        return host.rstrip("/")

    @staticmethod
    def get_langfuse_project_url(project_id: Optional[str] = None) -> str:
        """Get the LangFuse project dashboard URL."""
        host = LangfuseStatsService.get_langfuse_dashboard_url()
        if project_id:
            return f"{host}/project/{project_id}"
        return host
