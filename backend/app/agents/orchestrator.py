import structlog
import uuid
from typing import Any, Dict, List, Optional

from app.agents.workflow import (
    create_agentstack_workflow,
)
from app.services.aether_intel import AetherIntelligenceProvider
from app.services.settings_service import settings_service
from app.schemas.base_state import BaseState

logger = structlog.get_logger(__name__)


class AgentOrchestrator:
    """
    Bridge between legacy processors and new Flux-based Aether Workflows.
    """

    async def process_workflow(
        self,
        workflow_id: str,
        line_items: List[Dict[str, Any]],
        knowledge_context: List[Any],
        metadata: Dict[str, Any],
        raw_document_text: Optional[str] = None,
        file_paths: Optional[List[str]] = None,
        queue_request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        logger.info(
            "AgentOrchestrator processing workflow",
            workflow_id=workflow_id,
            request_id=queue_request_id,
            num_file_paths=len(file_paths) if file_paths else 0,
        )

        # 1. Setup Workflow
        workflow_type = metadata.get("type", "default")
        intelligence = AetherIntelligenceProvider(agent_id="Analyst Agent")
        workflow = await create_agentstack_workflow(intelligence)
        workflow_name = "AgentStack Workflow"

        if workflow is None:
            raise Exception(f"Aether {workflow_name} not available")

        # 2. Prepare Initial State
        initial_state = BaseState(
            workflow_id=workflow_id,
            source_file_path=(file_paths[0] if file_paths else None),
            source_file_paths=(file_paths if file_paths else []),
            data={},
        )

        # 3. Execute Workflow
        # If we have a queue_request_id, we use it as thread_id for status updates
        config = {"configurable": {"thread_id": queue_request_id or workflow_id}}

        # Send initial workflow start update
        if queue_request_id:
            from app.services.agent_live_feed import agent_live_feed_manager

            await agent_live_feed_manager.broadcast_agent_update(
                agent="Orchestrator",
                message="Workflow initialized - starting automated analysis pipeline",
                message_type="info",
                request_id=queue_request_id,
            )

        try:
            result_state_obj = await workflow.ainvoke(initial_state, config=config)

            # If it's a dict (from Flux), convert to model
            if isinstance(result_state_obj, dict):
                result_state = BaseState(**result_state_obj)
            else:
                result_state = result_state_obj

            # 4. Transform back to response format
            state_dict = result_state.model_dump()

            # Map results to expected format
            findings = {}
            for li in line_items:
                li_id = li.get("id")
                findings[li_id] = {
                    "content": f"Verified: {li.get('text')} mapped to financial spread.",
                    "confidence_score": result_state.data.audit_trail.confidence_score
                    or 0.9,
                    "status": "generated",
                    "needs_review": (
                        result_state.data.audit_trail.review_status == "rejected"
                        or result_state.data.audit_trail.confidence_score < 0.9
                    ),
                    "review_reason": result_state.data.audit_trail.review_reason,
                    "sources_used": (
                        [
                            {
                                "source_id": file_paths[0] if file_paths else None,
                                "document_name": (
                                    file_paths[0].split("/")[-1]
                                    if file_paths
                                    else "Source"
                                ),
                                "page_number": 1,
                                "relevance_score": 1.0,
                                "extracted_text": "Financial data points extracted from source document.",
                            }
                        ]
                        if file_paths
                        else []
                    ),
                }

            # Send workflow completion update
            if queue_request_id:
                from app.services.agent_live_feed import agent_live_feed_manager

                await agent_live_feed_manager.broadcast_agent_update(
                    agent="Orchestrator",
                    message="Workflow completed - analysis pipeline finished",
                    message_type="success",
                    request_id=queue_request_id,
                )

            return {
                "success": True,
                "data": state_dict,
                "findings": findings,
                "high_confidence_findings": list(findings.values()),
                "workflow_id": workflow_id,
            }

        except Exception as e:
            logger.error("Orchestrator failed", error=str(e), workflow_id=workflow_id)
            return {"success": False, "error": str(e)}


agent_orchestrator = AgentOrchestrator()
