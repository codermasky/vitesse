"""
Database services for harvest jobs, agent collaboration, and integrations.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_

from app.models.harvest_collaboration_integration import (
    HarvestJob,
    HarvestJobTestResult,
    AgentActivity,
    AgentCommunication,
    AgentMetrics,
    IntegrationBuilder,
    FieldMapping,
    TransformationRule,
    IntegrationTestResult,
)


class HarvestJobService:
    """Service for harvest job operations."""

    @staticmethod
    def get_harvest_jobs(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        harvest_type: Optional[str] = None,
    ) -> List[HarvestJob]:
        """Get harvest jobs with optional filtering."""
        query = db.query(HarvestJob)

        if status:
            query = query.filter(HarvestJob.status == status)
        if harvest_type:
            query = query.filter(HarvestJob.harvest_type == harvest_type)

        return (
            query.order_by(desc(HarvestJob.created_at)).offset(skip).limit(limit).all()
        )

    @staticmethod
    def get_harvest_job_by_id(db: Session, job_id: str) -> Optional[HarvestJob]:
        """Get a harvest job by ID."""
        return db.query(HarvestJob).filter(HarvestJob.id == job_id).first()

    @staticmethod
    def create_harvest_job(
        db: Session,
        job_id: str,
        harvest_type: str,
        source_ids: Optional[List[int]] = None,
    ) -> HarvestJob:
        """Create a new harvest job."""
        job = HarvestJob(
            id=job_id,
            harvest_type=harvest_type,
            status="queued",
            progress=0.0,
            total_sources=len(source_ids) if source_ids else 15,
            source_ids=source_ids,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def update_harvest_job_status(
        db: Session,
        job_id: str,
        status: str,
        progress: Optional[float] = None,
        error_message: Optional[str] = None,
    ) -> Optional[HarvestJob]:
        """Update harvest job status."""
        job = db.query(HarvestJob).filter(HarvestJob.id == job_id).first()
        if not job:
            return None

        job.status = status
        if progress is not None:
            job.progress = progress
        if error_message:
            job.error_message = error_message

        if status == "running" and not job.started_at:
            job.started_at = datetime.utcnow()
        elif status in ["completed", "failed"] and not job.completed_at:
            job.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def get_harvest_job_stats(db: Session) -> Dict[str, Any]:
        """Get harvest job statistics."""
        # Count jobs by status
        status_counts = (
            db.query(HarvestJob.status, func.count(HarvestJob.id).label("count"))
            .group_by(HarvestJob.status)
            .all()
        )

        total_jobs = sum(count for _, count in status_counts)

        # Calculate success rate
        completed_jobs = (
            db.query(HarvestJob).filter(HarvestJob.status == "completed").count()
        )

        success_rate = (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0

        # Get recent job counts
        now = datetime.utcnow()
        jobs_last_24h = (
            db.query(HarvestJob)
            .filter(HarvestJob.created_at >= now - timedelta(hours=24))
            .count()
        )

        jobs_last_7d = (
            db.query(HarvestJob)
            .filter(HarvestJob.created_at >= now - timedelta(days=7))
            .count()
        )

        jobs_last_30d = (
            db.query(HarvestJob)
            .filter(HarvestJob.created_at >= now - timedelta(days=30))
            .count()
        )

        # Get most common harvest type
        harvest_type_counts = (
            db.query(HarvestJob.harvest_type, func.count(HarvestJob.id).label("count"))
            .group_by(HarvestJob.harvest_type)
            .order_by(desc("count"))
            .first()
        )

        most_common_type = harvest_type_counts[0] if harvest_type_counts else "full"

        # Calculate average duration
        completed_jobs_with_duration = (
            db.query(HarvestJob)
            .filter(
                and_(
                    HarvestJob.status == "completed",
                    HarvestJob.started_at.isnot(None),
                    HarvestJob.completed_at.isnot(None),
                )
            )
            .all()
        )

        avg_duration = 0
        if completed_jobs_with_duration:
            total_duration = sum(
                (job.completed_at - job.started_at).total_seconds()
                for job in completed_jobs_with_duration
            )
            avg_duration = total_duration / len(completed_jobs_with_duration)

        # Get total APIs harvested
        total_apis = db.query(func.sum(HarvestJob.apis_harvested)).scalar() or 0

        return {
            "total_jobs": total_jobs,
            "running_jobs": next(
                (count for status, count in status_counts if status == "running"), 0
            ),
            "completed_jobs": completed_jobs,
            "failed_jobs": next(
                (count for status, count in status_counts if status == "failed"), 0
            ),
            "success_rate": round(success_rate, 1),
            "average_job_duration": int(avg_duration),
            "total_apis_harvested": total_apis,
            "jobs_last_24h": jobs_last_24h,
            "jobs_last_7d": jobs_last_7d,
            "jobs_last_30d": jobs_last_30d,
            "most_common_harvest_type": most_common_type,
            "peak_harvest_time": "14:00",  # This would need more complex analysis
        }


class AgentCollaborationService:
    """Service for agent collaboration operations."""

    @staticmethod
    def get_agent_activities(db: Session, hours: int = 24) -> List[AgentActivity]:
        """Get recent agent activities."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return (
            db.query(AgentActivity)
            .filter(AgentActivity.last_activity >= cutoff_time)
            .order_by(desc(AgentActivity.last_activity))
            .all()
        )

    @staticmethod
    def get_agent_communications(
        db: Session, hours: int = 1, limit: int = 50
    ) -> List[AgentCommunication]:
        """Get recent agent communications."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return (
            db.query(AgentCommunication)
            .filter(AgentCommunication.timestamp >= cutoff_time)
            .order_by(desc(AgentCommunication.timestamp))
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_agent_metrics(db: Session, agent_id: str) -> Optional[AgentMetrics]:
        """Get metrics for a specific agent."""
        return db.query(AgentMetrics).filter(AgentMetrics.agent_id == agent_id).first()

    @staticmethod
    def update_agent_activity(
        db: Session,
        agent_id: str,
        agent_name: str,
        status: str,
        current_task: Optional[str] = None,
    ) -> AgentActivity:
        """Update or create agent activity."""
        activity = (
            db.query(AgentActivity).filter(AgentActivity.agent_id == agent_id).first()
        )

        if activity:
            activity.status = status
            activity.current_task = current_task
            activity.last_activity = datetime.utcnow()
        else:
            activity = AgentActivity(
                agent_id=agent_id,
                agent_name=agent_name,
                status=status,
                current_task=current_task,
            )
            db.add(activity)

        db.commit()
        db.refresh(activity)
        return activity

    @staticmethod
    def create_agent_communication(
        db: Session,
        comm_id: str,
        from_agent: str,
        to_agent: str,
        message_type: str,
        content: str,
        priority: str = "normal",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AgentCommunication:
        """Create a new agent communication."""
        communication = AgentCommunication(
            id=comm_id,
            from_agent=from_agent,
            to_agent=to_agent,
            message_type=message_type,
            content=content,
            priority=priority,
            metadata=metadata,
        )
        db.add(communication)
        db.commit()
        db.refresh(communication)
        return communication

    @staticmethod
    def get_collaboration_stats(db: Session) -> Dict[str, Any]:
        """Get collaboration statistics."""
        # Agent counts
        total_agents = db.query(func.count(AgentActivity.id)).scalar()
        active_agents = (
            db.query(AgentActivity).filter(AgentActivity.status == "active").count()
        )

        # Workflow counts (simplified - would need workflow table)
        total_workflows = 0  # Placeholder
        active_workflows = 0  # Placeholder

        # Communication stats
        now = datetime.utcnow()
        communications_today = (
            db.query(AgentCommunication)
            .filter(
                AgentCommunication.timestamp
                >= now.replace(hour=0, minute=0, second=0, microsecond=0)
            )
            .count()
        )

        # Average collaboration score (simplified)
        avg_collaboration_score = 82.5  # Placeholder

        # System uptime (simplified)
        system_uptime = 99.7  # Placeholder

        # Average response time
        avg_response_time = (
            db.query(func.avg(AgentActivity.average_response_time)).scalar() or 45
        )

        # Tasks completed today
        tasks_today = (
            db.query(func.sum(AgentActivity.tasks_completed))
            .filter(
                AgentActivity.last_activity
                >= now.replace(hour=0, minute=0, second=0, microsecond=0)
            )
            .scalar()
            or 0
        )

        # Error rate (simplified)
        error_rate = 3.2  # Placeholder

        return {
            "total_agents": total_agents,
            "active_agents": active_agents,
            "total_workflows": total_workflows,
            "active_workflows": active_workflows,
            "total_communications_today": communications_today,
            "average_collaboration_score": avg_collaboration_score,
            "system_uptime": system_uptime,
            "average_response_time": int(avg_response_time),
            "tasks_completed_today": tasks_today,
            "error_rate": error_rate,
            "peak_collaboration_hour": "14:00",  # Placeholder
            "most_active_agent": "orchestrator-001",  # Placeholder
        }


class IntegrationService:
    """Service for integration operations."""

    @staticmethod
    def get_integrations(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> List[IntegrationBuilder]:
        """Get integrations with optional filtering."""
        query = db.query(IntegrationBuilder)

        if status:
            query = query.filter(IntegrationBuilder.status == status)

        return (
            query.order_by(desc(IntegrationBuilder.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_integration_by_id(
        db: Session, integration_id: str
    ) -> Optional[IntegrationBuilder]:
        """Get an integration by ID."""
        return (
            db.query(IntegrationBuilder)
            .filter(IntegrationBuilder.id == integration_id)
            .first()
        )

    @staticmethod
    def create_integration(
        db: Session,
        integration_id: str,
        name: str,
        description: str,
        source_api: str,
        target_api: str,
    ) -> IntegrationBuilder:
        """Create a new integration."""
        integration = IntegrationBuilder(
            id=integration_id,
            name=name,
            description=description,
            source_api=source_api,
            target_api=target_api,
            status="draft",
        )
        db.add(integration)
        db.commit()
        db.refresh(integration)
        return integration

    @staticmethod
    def update_integration(
        db: Session, integration_id: str, updates: Dict[str, Any]
    ) -> Optional[IntegrationBuilder]:
        """Update an integration."""
        integration = (
            db.query(IntegrationBuilder)
            .filter(IntegrationBuilder.id == integration_id)
            .first()
        )
        if not integration:
            return None

        for key, value in updates.items():
            if hasattr(integration, key):
                setattr(integration, key, value)

        integration.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(integration)
        return integration

    @staticmethod
    def delete_integration(db: Session, integration_id: str) -> bool:
        """Delete an integration."""
        integration = (
            db.query(IntegrationBuilder)
            .filter(IntegrationBuilder.id == integration_id)
            .first()
        )
        if not integration:
            return False

        db.delete(integration)
        db.commit()
        return True

    @staticmethod
    def add_field_mapping(
        db: Session,
        integration_id: str,
        mapping_id: str,
        source_field: str,
        target_field: str,
        data_type: str = "string",
        required: bool = True,
        transformation_rule_id: Optional[str] = None,
    ) -> FieldMapping:
        """Add a field mapping to an integration."""
        mapping = FieldMapping(
            id=mapping_id,
            integration_id=integration_id,
            source_field=source_field,
            target_field=target_field,
            data_type=data_type,
            required=required,
            transformation_rule_id=transformation_rule_id,
        )
        db.add(mapping)
        db.commit()
        db.refresh(mapping)
        return mapping

    @staticmethod
    def add_transformation_rule(
        db: Session,
        integration_id: str,
        rule_id: str,
        name: str,
        description: Optional[str],
        rule_type: str,
        source_field: str,
        target_field: str,
        transformation_logic: Dict[str, Any],
        enabled: bool = True,
    ) -> TransformationRule:
        """Add a transformation rule to an integration."""
        rule = TransformationRule(
            id=rule_id,
            integration_id=integration_id,
            name=name,
            description=description,
            rule_type=rule_type,
            source_field=source_field,
            target_field=target_field,
            transformation_logic=transformation_logic,
            enabled=enabled,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def create_test_result(
        db: Session,
        integration_id: str,
        status: str = "running",
        request_data: Optional[Dict[str, Any]] = None,
    ) -> IntegrationTestResult:
        """Create a test result for an integration."""
        result = IntegrationTestResult(
            integration_id=integration_id,
            status=status,
            request_data=request_data,
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result

    @staticmethod
    def update_test_result(
        db: Session,
        result_id: int,
        status: str,
        success: Optional[bool] = None,
        error_message: Optional[str] = None,
        response_data: Optional[Dict[str, Any]] = None,
        execution_time: int = 0,
    ) -> Optional[IntegrationTestResult]:
        """Update a test result."""
        result = (
            db.query(IntegrationTestResult)
            .filter(IntegrationTestResult.id == result_id)
            .first()
        )
        if not result:
            return None

        result.status = status
        result.success = success
        result.error_message = error_message
        result.response_data = response_data
        result.execution_time = execution_time

        if status in ["completed", "failed"]:
            result.end_time = datetime.utcnow()

        db.commit()
        db.refresh(result)
        return result

    @staticmethod
    def get_test_results(
        db: Session, integration_id: str, limit: int = 10
    ) -> List[IntegrationTestResult]:
        """Get test results for an integration."""
        return (
            db.query(IntegrationTestResult)
            .filter(IntegrationTestResult.integration_id == integration_id)
            .order_by(desc(IntegrationTestResult.start_time))
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_integration_stats(db: Session) -> Dict[str, Any]:
        """Get integration statistics."""
        total_integrations = db.query(func.count(IntegrationBuilder.id)).scalar()

        # Status counts
        status_counts = (
            db.query(Integration.status, func.count(Integration.id).label("count"))
            .group_by(IntegrationBuilder.status)
            .all()
        )

        active_integrations = next(
            (count for status, count in status_counts if status == "active"), 0
        )
        draft_integrations = next(
            (count for status, count in status_counts if status == "draft"), 0
        )
        testing_integrations = next(
            (count for status, count in status_counts if status == "testing"), 0
        )

        # Field mappings and rules counts
        total_field_mappings = db.query(func.count(FieldMapping.id)).scalar()
        total_transformation_rules = db.query(
            func.count(TransformationRule.id)
        ).scalar()

        # Success rate (simplified)
        avg_success_rate = 92.3  # Placeholder

        # API calls (simplified)
        total_api_calls_today = 1250  # Placeholder
        failed_calls_today = 45  # Placeholder

        # Most used APIs (simplified)
        most_used_source = "Internal Payment Service"  # Placeholder
        most_used_target = "Stripe API"  # Placeholder

        return {
            "total_integrations": total_integrations,
            "active_integrations": active_integrations,
            "draft_integrations": draft_integrations,
            "testing_integrations": testing_integrations,
            "total_field_mappings": total_field_mappings,
            "total_transformation_rules": total_transformation_rules,
            "average_success_rate": avg_success_rate,
            "total_api_calls_today": total_api_calls_today,
            "failed_calls_today": failed_calls_today,
            "most_used_source_api": most_used_source,
            "most_used_target_api": most_used_target,
        }
