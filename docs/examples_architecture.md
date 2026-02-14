# Vitesse AI: Architecture Examples

## Overview

This document provides practical examples of using Vitesse AI's extended architecture with collaborative intelligence, persistent memory, and knowledge harvesting capabilities.

## Example 1: Complete Workflow with Shared State

Demonstrates the full agent pipeline using the shared whiteboard for collaborative intelligence.

```python
from app.core.shared_state import create_shared_whiteboard
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext
from app.agents.enhanced_discovery import EnhancedDiscoveryContext

async def example_integration_with_shared_state():
    # 1. Create shared whiteboard for this workflow
    shared_state = create_shared_whiteboard()
    print(f"Created shared whiteboard: {shared_state.workflow_id}")

    # 2. Set user intent
    shared_state.user_intent = "Integrate Stripe payments to Salesforce accounting"
    shared_state.user_constraints = {"region": "EU", "compliance": "PSD2"}

    # 3. Initialize Knowledge Harvester
    context = AgentContext()
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

    print(f"Discovery Result: {discovery_result}")

    # 6. Check what's now in shared state after discovery
    print(f"Discovered APIs: {list(shared_state.discovered_apis.keys())}")
    print(f"Domain Knowledge: {list(shared_state.domain_knowledge.keys())}")

    # 7. Next agent (Ingestor) would read from shared state
    ingestor_context = shared_state.get_agent_context("ingestor")
    print(f"Ingestor sees previously discovered APIs: {ingestor_context['previously_discovered_apis']}")

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
    print("Execution Summary:", summary)

    return shared_state
```

## Example 2: Knowledge Harvester Usage

Demonstrates knowledge harvesting capabilities across multiple API sources.

```python
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext

async def example_knowledge_harvester():
    # 1. Create harvester
    context = AgentContext()
    harvester = KnowledgeHarvester(context)

    # 2. Execute full harvest (now includes multiple sources)
    print("Starting comprehensive knowledge harvest...")
    result = await harvester.execute(context={}, input_data={"harvest_type": "full"})
    print(f"Harvest Result: {result}")
    # Now harvests from: financial APIs, APIs.guru, marketplaces, GitHub repos, patterns

    # 3. Search for similar APIs across all sources
    print("\nSearching for payment APIs across all sources...")
    similar_apis = await harvester.find_similar_apis(
        "payment processing with recurring billing", top_k=5
    )
    for api in similar_apis:
        print(f"  - {api['api']}: {api['similarity_score']:.2f} (source: {api['source']})")

    # 4. Search for APIs by category
    print("\nSearching for communication APIs...")
    comm_apis = await harvester.find_similar_apis(
        "messaging and communication", top_k=3, category="communication"
    )
    for api in comm_apis:
        print(f"  - {api['api']}: {api['category']}")

    # 5. Find applicable standards
    print("\nFinding applicable standards for EU integration...")
    standards = await harvester.find_applicable_standards(
        "European payment integration PSD2"
    )
    for standard in standards:
        print(f"  - {standard['standard']}: {standard['relevance']:.2f}")

    # 6. Find relevant patterns
    print("\nFinding relevant integration patterns...")
    patterns = await harvester.find_relevant_patterns(
        "Stripe to accounting system field mapping", top_k=3
    )
    for pattern in patterns:
        print(f"  - {pattern['pattern']}: {pattern['relevance']:.2f}")
```

## Example 3: State Checkpointing & Recovery

Demonstrates fault-tolerant workflow execution with state recovery.

```python
from app.core.shared_state import create_shared_whiteboard, get_state_limiter

async def example_state_recovery():
    # 1. Create state
    state = create_shared_whiteboard()
    state.user_intent = "Complex financial integration"
    state.integration_status = "ingesting"

    # 2. Create checkpoint before risky operation
    limiter = get_state_limiter()
    checkpoint_id = limiter.create_checkpoint(state.workflow_id, state)
    print(f"Created checkpoint: {checkpoint_id}")

    # 3. Simulate risky operation
    state.integration_status = "mapping"
    state.add_error("Simulated error during mapping", "mapper")

    # 4. Restore from checkpoint
    recovered_state = limiter.restore_from_checkpoint(checkpoint_id)
    print(f"Restored state from checkpoint")
    print(f"Status: {recovered_state.integration_status}")
    print(f"Errors: {len(recovered_state.errors)}")  # Should be 0

    # 5. View version history
    history = limiter.get_workflow_history(state.workflow_id)
    print(f"Workflow has {len(history)} checkpoint(s)")
```

## Example 4: Discovery-to-Deployment Pipeline

Shows the complete pipeline from API discovery to deployment readiness.

```python
from app.core.shared_state import create_shared_whiteboard
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext
from app.agents.enhanced_discovery import EnhancedDiscoveryContext

async def example_full_pipeline():
    # Step 1: Create shared state
    shared_state = create_shared_whiteboard()
    shared_state.user_intent = "Automate payment to invoice reconciliation"
    shared_state.user_constraints = {"region": "US", "volume": "high"}

    print(f"[1/5] Workflow initialized: {shared_state.workflow_id}")

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

    print(f"[2/5] Discovery complete - found {len(discovery_result['source_apis'])} source APIs")

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

    print(f"[3/5] Ingestion complete")

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

    print(f"[4/5] Mapping complete - {len(patterns)} patterns applied")

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
        print(f"[5/5] READY FOR DEPLOYMENT - Health score: {shared_state.health_score}")
    else:
        print(f"[5/5] NOT READY - Health score too low: {shared_state.health_score}")

    # Final summary
    summary = shared_state.get_execution_summary()
    print("\nFinal Execution Summary:")
    for key, value in summary.items():
        print(f"  {key}: {value}")
```

## Running the Examples

To run all examples:

```python
from backend.examples_architecture import run_all_examples
import asyncio

asyncio.run(run_all_examples())
```

## Key Concepts Demonstrated

1. **Shared Whiteboard**: Centralized state management for agent collaboration
2. **Knowledge Harvesting**: Autonomous discovery and storage of financial API knowledge
3. **State Recovery**: Fault-tolerant execution with checkpointing
4. **Enhanced Discovery**: Knowledge-augmented API discovery and compliance checking
5. **Agent Coordination**: Sequential agent execution with shared context

## Architecture Benefits

- **Emergent Intelligence**: Agents build upon each other's insights
- **Fault Tolerance**: Automatic recovery from failures via checkpoints
- **Knowledge Reuse**: Learned patterns improve future integrations
- **Regulatory Compliance**: Built-in awareness of standards like PSD2/FDX
- **Scalability**: Horizontal scaling with persistent state management

## Next Steps

- [Read the Architecture Design Document](architecture_design.md)
- [Review the Implementation Guide](implementation_guide.md)
- [Set up Qdrant Vector Database](qdrant_setup.md)
- [Explore API Examples](examples.md)