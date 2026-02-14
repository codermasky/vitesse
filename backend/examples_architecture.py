"""
Example: Using Shared State & Knowledge Harvesting in Agent Pipeline
====================================================================

This example shows how the new architecture is used in practice.
"""

from typing import Dict, Any
from app.core.shared_state import SharedWhiteboardState, create_shared_whiteboard
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext
from app.agents.enhanced_discovery import EnhancedDiscoveryContext
import structlog

logger = structlog.get_logger(__name__)


# ===== EXAMPLE 1: Complete Workflow with Shared State =====


async def example_integration_with_shared_state():
    """
    Demonstrates the full agent pipeline using shared whiteboard.
    """

    logger.info("=" * 60)
    logger.info("EXAMPLE 1: Integration with Shared State & Knowledge")
    logger.info("=" * 60)

    # 1. Create shared whiteboard for this workflow
    shared_state = create_shared_whiteboard()
    logger.info(f"Created shared whiteboard: {shared_state.workflow_id}")

    # 2. Set user intent
    shared_state.user_intent = "Integrate Stripe payments to Salesforce accounting"
    shared_state.user_constraints = {"region": "EU", "compliance": "PSD2"}

    # 3. Initialize Knowledge Harvester
    context = AgentContext()  # Simplified for example
    harvester = KnowledgeHarvester(context)

    # 4. Create Enhanced Discovery
    enhanced_discovery = EnhancedDiscoveryContext(shared_state, harvester)

    # 5. Execute enriched discovery workflow
    discovery_result = await enhanced_discovery.enriched_discovery_workflow(
        user_intent=shared_state.user_intent,
        source_api_query="payment processing Stripe",
        dest_api_query="accounting Salesforce",
        region="EU",
    )

    logger.info(f"Discovery Result:", discovery_result)

    # 6. Check what's now in shared state after discovery
    logger.info(f"Discovered APIs: {list(shared_state.discovered_apis.keys())}")
    logger.info(f"Domain Knowledge: {list(shared_state.domain_knowledge.keys())}")

    # 7. Next agent (Ingestor) would read from shared state
    ingestor_context = shared_state.get_agent_context("ingestor")
    logger.info(
        f"Ingestor sees previously discovered APIs: {ingestor_context['previously_discovered_apis']}"
    )

    # 8. Simulate ingestor adding to state
    shared_state.source_api_spec = {
        "api": "Stripe",
        "endpoints": ["/v1/charges", "/v1/customers"],
        "auth": "Bearer Token",
    }
    shared_state.dest_api_spec = {
        "api": "Salesforce",
        "endpoints": ["/sobjects/Account", "/sobjects/Invoice"],
        "auth": "OAuth2",
    }

    # Track contribution
    shared_state.record_agent_contribution(
        agent_id="ingestor_001",
        agent_type="ingestor",
        input_keys=["discovered_apis"],
        output_data={
            "source_api_spec": shared_state.source_api_spec,
            "dest_api_spec": shared_state.dest_api_spec,
        },
        execution_time_ms=200.0,
    )

    # 9. Get execution summary
    summary = shared_state.get_execution_summary()
    logger.info("Execution Summary:", summary)

    return shared_state


# ===== EXAMPLE 2: Knowledge Harvester Usage =====


async def example_knowledge_harvester():
    """
    Demonstrates knowledge harvesting capabilities.
    """

    logger.info("=" * 60)
    logger.info("EXAMPLE 2: Knowledge Harvester")
    logger.info("=" * 60)

    # 1. Create harvester
    context = AgentContext()
    harvester = KnowledgeHarvester(context)

    # 2. Execute full harvest
    logger.info("Starting knowledge harvest...")
    result = await harvester.execute(context={}, input_data={"harvest_type": "full"})
    logger.info(f"Harvest Result: {result}")

    # 3. Search for similar APIs
    logger.info("\nSearching for payment APIs...")
    similar_apis = await harvester.find_similar_apis(
        "payment processing with recurring billing", top_k=5
    )

    for api in similar_apis:
        logger.info(f"  - {api['api_name']}: {api['similarity_score']:.2f}")

    # 4. Find applicable standards
    logger.info("\nFinding applicable standards for EU integration...")
    standards = await harvester.find_applicable_standards(
        "European payment integration PSD2"
    )

    for standard in standards:
        logger.info(f"  - {standard['standard']}: {standard['relevance']:.2f}")

    # 5. Find relevant patterns
    logger.info("\nFinding relevant integration patterns...")
    patterns = await harvester.find_relevant_patterns(
        "Stripe to accounting system field mapping", top_k=3
    )

    for pattern in patterns:
        logger.info(f"  - {pattern['pattern']}: {pattern['relevance']:.2f}")


# ===== EXAMPLE 3: State Checkpointing & Recovery =====


async def example_state_recovery():
    """
    Demonstrates state checkpointing for fault recovery.
    """

    logger.info("=" * 60)
    logger.info("EXAMPLE 3: State Checkpointing & Recovery")
    logger.info("=" * 60)

    from app.core.shared_state import get_state_limiter

    # 1. Create state
    state = create_shared_whiteboard()
    state.user_intent = "Complex financial integration"
    state.integration_status = "ingesting"

    # 2. Create checkpoint before risky operation
    limiter = get_state_limiter()
    checkpoint_id = limiter.create_checkpoint(state.workflow_id, state)
    logger.info(f"Created checkpoint: {checkpoint_id}")

    # 3. Simulate risky operation
    state.integration_status = "mapping"
    state.add_error("Simulated error during mapping", "mapper")

    # 4. Restore from checkpoint
    recovered_state = limiter.restore_from_checkpoint(checkpoint_id)
    logger.info(f"Restored state from checkpoint")
    logger.info(f"Status: {recovered_state.integration_status}")
    logger.info(f"Errors: {len(recovered_state.errors)}")  # Should be 0

    # 5. View version history
    history = limiter.get_workflow_history(state.workflow_id)
    logger.info(f"Workflow has {len(history)} checkpoint(s)")


# ===== EXAMPLE 4: Discovery-to-Deployment Pipeline =====


async def example_full_pipeline():
    """
    Shows the complete pipeline from discovery to deployment.
    """

    logger.info("=" * 60)
    logger.info("EXAMPLE 4: Complete Discovery-to-Deployment Pipeline")
    logger.info("=" * 60)

    # Step 1: Create shared state
    shared_state = create_shared_whiteboard()
    shared_state.user_intent = "Automate payment to invoice reconciliation"
    shared_state.user_constraints = {"region": "US", "volume": "high"}

    logger.info(f"[1/5] Workflow initialized: {shared_state.workflow_id}")

    # Step 2: Discovery (with knowledge)
    context = AgentContext()
    harvester = KnowledgeHarvester(context)
    enhanced_discovery = EnhancedDiscoveryContext(shared_state, harvester)

    discovery_result = await enhanced_discovery.enriched_discovery_workflow(
        user_intent=shared_state.user_intent,
        source_api_query="payment processor transactions",
        dest_api_query="invoicing system",
        region="US",
    )

    logger.info(
        f"[2/5] Discovery complete - found {len(discovery_result['source_apis'])} source APIs"
    )

    # Step 3: Ingestor (simulated)
    shared_state.source_api_spec = {
        "api_name": "Stripe",
        "endpoints": discovery_result["source_apis"],
        "auth_type": "oauth2",
    }
    shared_state.dest_api_spec = {
        "api_name": discovery_result["dest_apis"][0]["api_name"],
        "endpoints": discovery_result["dest_apis"],
        "auth_type": "oauth2",
    }

    logger.info(f"[3/5] Ingestion complete")

    # Step 4: Mapper (simulated, using patterns from knowledge)
    patterns = discovery_result["integration_patterns"]
    shared_state.mapping_logic = {
        "type": "direct_mapping",
        "patterns": patterns,
        "complexity": len(patterns) * 10,
    }

    shared_state.learned_patterns["payment_to_invoice"] = {
        "source_field": "amount",
        "dest_field": "invoice_total",
        "transformation": "direct",
    }

    logger.info(f"[4/5] Mapping complete - {len(patterns)} patterns applied")

    # Step 5: Guardian assessment
    shared_state.health_score = 85.0
    shared_state.test_results = {
        "total_tests": 100,
        "passed": 95,
        "failed": 5,
        "avg_response_time_ms": 150.0,
    }

    if shared_state.can_proceed_to_next_phase(min_health_score=70.0):
        shared_state.integration_status = "ready_for_deployment"
        logger.info(
            f"[5/5] READY FOR DEPLOYMENT - Health score: {shared_state.health_score}"
        )
    else:
        logger.warning(
            f"[5/5] NOT READY - Health score too low: {shared_state.health_score}"
        )

    # Final summary
    summary = shared_state.get_execution_summary()
    logger.info("\nFinal Execution Summary:")
    for key, value in summary.items():
        logger.info(f"  {key}: {value}")


# ===== RUN EXAMPLES =====


async def run_all_examples():
    """Run all examples."""

    print("\\n\\n" + "=" * 70)
    print("VITESSE AI: NEW ARCHITECTURE EXAMPLES")
    print("=" * 70 + "\\n")

    try:
        await example_integration_with_shared_state()
        print("\\n")
        await example_knowledge_harvester()
        print("\\n")
        await example_state_recovery()
        print("\\n")
        await example_full_pipeline()

        print("\\n" + "=" * 70)
        print("ALL EXAMPLES COMPLETED SUCCESSFULLY")
        print("=" * 70 + "\\n")

    except Exception as e:
        logger.error(f"Example failed: {str(e)}")
        import traceback

        traceback.print_exc()


# ===== ENTRY POINT =====

if __name__ == "__main__":
    import asyncio

    asyncio.run(run_all_examples())
