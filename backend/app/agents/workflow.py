import structlog
from typing import Any, Dict, Optional, Union
from langchain_core.runnables import RunnableConfig

from aether.flux.engine import Flux
from aether.protocols.intelligence import IntelligenceProvider
from app.services.aether_intel import AetherIntelligenceProvider

AETHER_AVAILABLE = True


from app.schemas.base_state import BaseState
from app.agents.analyst import AnalystAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.writer import WriterAgent
from app.agents.sentinel import SentinelAgent

logger = structlog.get_logger(__name__)


async def create_agentstack_workflow(
    intelligence: IntelligenceProvider, checkpointer: Optional[Any] = None
):
    if not AETHER_AVAILABLE:
        logger.warning("Aether not available - returning None for workflow")
        return None

    # Initialize Flux
    flux = Flux(BaseState)

    # Initialize Agents
    analyst = AnalystAgent(intelligence=intelligence)
    reviewer = ReviewerAgent(intelligence=intelligence)
    writer = WriterAgent(intelligence=intelligence)
    sentinel = SentinelAgent(intelligence=intelligence)

    async def _update_status(config: Dict, node_id: str, stage: str, percentage: int):
        """Helper to update QueueRequest status in database."""
        # Log config to debug matching
        logger.info(
            f"DEBUG: _update_status called for {node_id} with config keys: {list(config.keys()) if config else 'None'}"
        )

        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            logger.warning(f"DEBUG: No thread_id found in config for node {node_id}")
            return

        from app.db.session import async_session_factory
        from app.services.queue_service import queue_service
        from app.models.queue_request import QueueStatus
        from app.services.agent_live_feed import agent_live_feed_manager

        # Map node_id to agent name for display
        agent_name_map = {
            "entity_extraction": "Entity Extraction",
            "analyst": "Analyst",
            "collateral": "Collateral Analyst",
            "reviewer": "Credit Reviewer",
            "committee": "Credit Committee",
            "writer": "Credit Writer",
            "sentinel": "Sentinel",
            "human_review": "Human Review",
            "classifier": "Classifier",
            "covenant_compliance": "Covenant Compliance",
        }

        agent_display_name = agent_name_map.get(node_id, node_id.title())

        try:
            async with async_session_factory() as db:
                request = await queue_service.get(db, id=thread_id)
                if request:
                    logger.info(
                        f"Updating status for node {node_id}: {stage} ({percentage}%) [request_id={thread_id}]"
                    )
                    await queue_service.update(
                        db,
                        db_obj=request,
                        obj_in={
                            "active_node_id": node_id,
                            "progress_stage": stage,
                            "progress_percentage": percentage,
                            "status": QueueStatus.IN_PROGRESS,
                        },
                    )
                    await db.commit()

                    # Broadcast agent update to live feed
                    await agent_live_feed_manager.broadcast_agent_update(
                        agent=agent_display_name,
                        message=f"Starting {stage}",
                        message_type="info",
                        request_id=thread_id,
                    )
                else:
                    logger.warning(
                        f"Queue request {thread_id} not found for status update"
                    )
        except Exception as e:
            logger.error(f"Failed to update status for node {node_id}: {e}")

    # Define wrapper functions to match Flux node signature (State, Config -> State)
    async def run_analyst(state: BaseState, config: RunnableConfig) -> BaseState:
        await _update_status(dict(config), "analyst", "Data Analysis", 15)
        result = await analyst.execute(context={}, input_data=state.model_dump())
        return result

    async def run_reviewer(state: BaseState, config: RunnableConfig) -> BaseState:
        await _update_status(dict(config), "reviewer", "Validation", 40)
        result = await reviewer.execute(context={}, input_data=state.model_dump())
        return result

    async def run_writer(state: BaseState, config: RunnableConfig) -> BaseState:
        await _update_status(dict(config), "writer", "Output Generation", 80)
        result = await writer.execute(context={}, input_data=state.model_dump())
        return result

    async def run_sentinel(state: BaseState, config: RunnableConfig) -> BaseState:
        await _update_status(dict(config), "sentinel", "Final Review", 95)
        result = await sentinel.execute(context={}, input_data=state.model_dump())
        return result

    async def run_human_review(state: BaseState, config: RunnableConfig) -> BaseState:
        await _update_status(dict(config), "human_review", "Awaiting Human Review", 65)
        return state

    # Build the Graph
    # Build the Graph
    flux.add_node("analyst", run_analyst)
    flux.add_node("reviewer", run_reviewer)
    flux.add_node("human_review", run_human_review)
    flux.add_node("writer", run_writer)
    flux.add_node("sentinel", run_sentinel)

    flux.set_entry_point("analyst")
    flux.add_edge("analyst", "reviewer")
    flux.add_edge("reviewer", "writer")
    flux.add_edge("human_review", "writer")
    flux.add_edge("writer", "sentinel")
    flux.add_edge("sentinel", "__end__")

    from app.core.checkpoint import get_checkpointer

    if checkpointer is None:
        checkpointer = await get_checkpointer()

    return flux.compile(checkpointer=checkpointer, interrupt_before=["human_review"])
