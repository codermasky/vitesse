"""
Schemas for Agent Collaboration API

Pydantic models for agent collaboration monitoring and shared state.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class SharedStateResponse(BaseModel):
    """Schema for shared whiteboard state response."""

    current_state: Dict[str, Any] = Field(..., description="Current shared state data")
    recent_changes: List[Dict[str, Any]] = Field(..., description="Recent state changes")
    last_updated: str = Field(..., description="Last update timestamp")


class AgentActivityResponse(BaseModel):
    """Schema for agent activity response."""

    agent_id: str = Field(..., description="Unique agent identifier")
    agent_name: str = Field(..., description="Human-readable agent name")
    status: str = Field(..., description="Current agent status (active, idle, error)")
    current_task: Optional[str] = Field(None, description="Currently executing task")
    last_activity: str = Field(..., description="Last activity timestamp")
    tasks_completed: int = Field(..., ge=0, description="Total tasks completed")
    success_rate: float = Field(..., ge=0, le=100, description="Task success rate percentage")
    average_response_time: int = Field(..., ge=0, description="Average response time in seconds")

    class Config:
        from_attributes = True


class AgentCommunicationLog(BaseModel):
    """Schema for inter-agent communication log."""

    id: str = Field(..., description="Unique communication identifier")
    timestamp: str = Field(..., description="Communication timestamp")
    from_agent: str = Field(..., description="Sending agent ID")
    to_agent: str = Field(..., description="Receiving agent ID")
    message_type: str = Field(..., description="Type of communication (task_assignment, task_update, etc.)")
    content: str = Field(..., description="Communication content/message")
    priority: str = Field(..., description="Message priority (low, normal, high)")
    status: str = Field(..., description="Delivery status (sent, delivered, failed)")

    class Config:
        from_attributes = True


class AgentMetrics(BaseModel):
    """Schema for detailed agent metrics."""

    agent_id: str = Field(..., description="Agent identifier")
    agent_name: str = Field(..., description="Agent display name")
    uptime_percentage: float = Field(..., ge=0, le=100, description="Agent uptime percentage")
    tasks_completed_today: int = Field(..., ge=0, description="Tasks completed today")
    tasks_completed_week: int = Field(..., ge=0, description="Tasks completed this week")
    average_task_duration: int = Field(..., ge=0, description="Average task duration in seconds")
    success_rate: float = Field(..., ge=0, le=100, description="Success rate percentage")
    error_rate: float = Field(..., ge=0, le=100, description="Error rate percentage")
    collaboration_score: int = Field(..., ge=0, le=100, description="Collaboration effectiveness score")
    response_time_p95: int = Field(..., ge=0, description="95th percentile response time in seconds")
    cpu_usage_avg: float = Field(..., ge=0, description="Average CPU usage percentage")
    memory_usage_avg: int = Field(..., ge=0, description="Average memory usage in MB")
    active_workflows: int = Field(..., ge=0, description="Number of active workflows")
    pending_tasks: int = Field(..., ge=0, description="Number of pending tasks")


class CollaborationStats(BaseModel):
    """Schema for overall collaboration statistics."""

    total_agents: int = Field(..., ge=0, description="Total number of agents")
    active_agents: int = Field(..., ge=0, description="Number of currently active agents")
    total_workflows: int = Field(..., ge=0, description="Total number of workflows")
    active_workflows: int = Field(..., ge=0, description="Number of active workflows")
    total_communications_today: int = Field(..., ge=0, description="Total communications today")
    average_collaboration_score: float = Field(..., ge=0, le=100, description="Average collaboration score")
    system_uptime: float = Field(..., ge=0, le=100, description="System uptime percentage")
    average_response_time: int = Field(..., ge=0, description="Average response time in seconds")
    tasks_completed_today: int = Field(..., ge=0, description="Tasks completed today")
    error_rate: float = Field(..., ge=0, le=100, description="System error rate percentage")
    peak_collaboration_hour: str = Field(..., description="Peak collaboration hour (HH:MM)")
    most_active_agent: str = Field(..., description="Most active agent ID")