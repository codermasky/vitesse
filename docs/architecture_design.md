"""
VITESSE AI: AGENTIC SYSTEM DESIGN & MEMORY ARCHITECTURE
========================================================

A comprehensive guide to the newly extended Vitesse AI system with:
1. Multi-Step Integration Workflow (Sequential REST API)
2. Collaborative Intelligence (Shared Whiteboard)
3. Persistent Memory & Context Preservation (Vector DB)
4. Knowledge Harvesting (Financial Services)
510. Aether Platform Integration
11. Flux Engine Orchestration (LangGraph-powered)
"""

# ===== 0. MULTI-STEP INTEGRATION WORKFLOW =====

## Overview

Vitesse AI now implements a **5-step sequential workflow** for integration creation, replacing the previous monolithic approach. This design provides transparency, control, and clear state management throughout the integration lifecycle.

### Workflow Architecture

```
REST API Layer (Frontend-facing)
  │
  ├─ POST /integrations               → Step 1: CREATE (DISCOVERING)
  ├─ POST /integrations/{id}/ingest   → Step 2: INGEST (MAPPING) 
  ├─ POST /integrations/{id}/map      → Step 3: MAP (TESTING)
  ├─ POST /integrations/{id}/test     → Step 4: TEST (DEPLOYING)
  ├─ POST /integrations/{id}/deploy   → Step 5: DEPLOY (ACTIVE)
  └─ GET  /integrations/{id}          → Check status
```

### State Progression

```
DISCOVERING → MAPPING → TESTING → DEPLOYING → ACTIVE
    ↓            ↓         ↓          ↓         ↓
  Step 1       Step 2    Step 3     Step 4    Step 5
  Create       Ingest    Map        Test      Deploy
  discovery    API       field      Guardian  Deployer
  results      specs     mappings   tests     Agent
```

### Key Benefits

- **Transparency**: User sees progress at each step
- **Control**: User decides when to proceed
- **Debuggability**: Issues isolated to specific step
- **Reliability**: Each step independently tested
- **Repeatability**: Can retry failed steps
- **Human Review**: Optional step for complex integrations

### Implementation

**Base Endpoint**: `/api/v1/vitesse`

**Orchestrator**: `VitesseOrchestrator` manages step progression

**Agents Used**:
- Step 2: `VitesseIngestor` - Parses API specs (Aether BaseAgent)
- Step 3: `VitesseMapper` - Generates field mappings (Aether BaseAgent)
- Step 4: `VitesseGuardian` - Runs integration tests (Aether BaseAgent)
- Step 5: `Deployer` - Deploys to target environment
- Step 5: `Deployer` - Deploys to target environment

**Persistence**: All state stored in PostgreSQL Integration table

### Full Documentation

See [Multi-Step Workflow Guide](./multi_step_workflow.md) for detailed step-by-step instructions.

---

# ===== 1. SHARED WHITEBOARD (COLLABORATIVE INTELLIGENCE) =====

## Overview
The "Shared Whiteboard" is a collaborative intelligence mechanism powered by Aether's `FluxEngine` (utilizing LangGraph's State Management).
It enables agents to read from and write to a centralized shared state that serves as the source of truth.

## Implementation Files
- `app/core/shared_state.py` - Core Whiteboard implementation
  - SharedWhiteboardState: Main state object all agents interact with
  - AgentContribution: Tracks what each agent adds
  - SharedStateLimiter: Manages concurrent access

## Key Features

### 1.1 Emergent Intelligence
Each agent reads the current state, adds its insights, and the next agent builds upon it:

    Discovery Agent  →  [State with discovered APIs]
         ↓
    Ingestor Agent   →  [State + API specs + schemas]
         ↓
    Mapper Agent     →  [State + mapping logic + transformations]
         ↓
    Guardian Agent   →  [State + test results + health scores]
         ↓
    Deployer         →  [Deployment ready integration]
         ↓
    Monitor Agent    →  [Real-time metrics + health status]
         ↓
    Healer Agent     →  [Self-healing actions + recovery status]

### 1.2 State Recovery via Checkpoints
- PostgreSQL persistent checkpoints (already configured in `app/core/checkpoint.py`)
- State snapshots created before each major operation
- Recovery from interrupted workflows using `SharedStateLimiter.restore_from_checkpoint()`

### 1.3 Usage Example in Agents

```python
```
from app.core.shared_state import SharedWhiteboardState

async def agent_execute_with_shared_state(
    context: Dict[str, Any],
    input_data: Dict[str, Any],
    shared_whiteboard: SharedWhiteboardState,
) -> Dict[str, Any]:
    # 1. Read context from previous agents
    previous_context = shared_whiteboard.get_agent_context("my_agent_type")
    api_spec = previous_context["source_api_spec"]
    
    # 2. Do agent work
    result = await my_agent_logic(api_spec, input_data)
    
    # 3. Contribute to shared state
    shared_whiteboard.record_agent_contribution(
        agent_id="agent_123",
        agent_type="mapper",
        input_keys=["source_api_spec"],
        output_data=result,
        execution_time_ms=150.0,
    )
    
    # 4. Add learned patterns for future integrations
    shared_whiteboard.add_learned_pattern(
        "payment_mapping",
        {"source_field": "amount", "target_field": "value"}
    )
    
    return result
```

## State Structure

```python
SharedWhiteboardState(
    workflow_id="uuid",
    
    # Agent tracking
    agent_contributions={},          # Each agent's contribution
    execution_log=[],                # Complete audit trail
    
    # Shared knowledge (the "whiteboard" content)
    discovered_apis={},              # APIs found
    source_api_spec={},              # Ingestor results
    dest_api_spec={},                # Ingestor results
    mapping_logic={},                # Mapper results
    test_results={},                 # Guardian results
    
    # Learning & patterns
    learned_patterns={},             # Patterns discovered
    harvested_knowledge={},          # From knowledge harvester
    domain_knowledge={},             # Standards, best practices
    
    # User context
    user_intent="",                  # What user wants
    user_constraints={},             # Limitations
    user_preferences={},             # Preferences
    
    # Metadata
    errors=[],                       # For recovery
    retry_count=0,
)
```

# ===== 2. PERSISTENT MEMORY & CONTEXT PRESERVATION =====

## Overview
Vector Database layer enables semantic search and storage of integration knowledge.
Two implementations available: Qdrant (recommended, production-grade).

## Implementation Files
- `app/core/knowledge_db.py` - Vector DB abstraction layer
  - KnowledgeDB (abstract base)
  - QdrantKnowledge: Production-grade implementation
  - PineconeKnowledge: Cloud, managed implementation (template)
  - KnowledgeDBManager: Unified interface

## Features

### 2.1 Qdrant Setup (Default)
- Production-grade vector database
- High-performance similarity search with 40x speedup via quantization
- Docker deployment ready
- Automatic embedding using Sentence Transformers
- Horizontal scaling support
- Enterprise security and monitoring

### 2.2 Collections
Six semantic collections store different types of knowledge:

1. `financial_apis` - API specifications (Plaid, Stripe, Yodlee)
2. `financial_schemas` - Data schemas for financial entities
3. `financial_standards` - Regulatory frameworks (PSD2, FDX)
4. `api_specifications` - General API specs
5. `mapping_patterns` - Common field mappings
6. `domain_knowledge` - Best practices, guidelines

### 2.3 Search Capability
Semantic search finds relevant knowledge by meaning, not just keywords:

```python
from app.core.knowledge_db import get_knowledge_db

knowledge_db = await get_knowledge_db()

# Find similar APIs
results = await knowledge_db.search(
    collection="financial_apis",
    query="payment processing with strong authentication",
    top_k=5,
)

# Results: [(document, similarity_score), ...]
for doc, score in results:
    print(f"API: {doc['metadata']['api_name']}, Similarity: {score:.2f}")
```

## Usage Pattern

```python
# Add financial knowledge at startup (in seed_data.py)
await knowledge_db.add_documents(
    collection="financial_apis",
    documents=[
        {
            "content": "Detailed API spec",
            "api_name": "Plaid",
            "category": "open_banking",
        },
        # More APIs...
    ],
)

# Search during integration creation
relevant_apis = await knowledge_db.search(
    collection="financial_apis",
    query=user_source_api_query,
    top_k=5,
)
```

# ===== 3. KNOWLEDGE HARVESTING FOR FINANCIAL SERVICES =====

## Overview
Autonomous agent that proactively builds and maintains a financial services knowledge library.

## Implementation Files
- `app/agents/knowledge_harvester.py` - Main harvester agent
- `app/core/financial_services.py` - Financial knowledge seed data
- `app/core/seed_data.py` - Initialization system

## Knowledge Coverage

### 3.1 Expanded API Ecosystem
The knowledge harvester now discovers APIs from multiple sources beyond just financial services:

**API Directories:**
- **APIs.guru**: Comprehensive OpenAPI specification directory
- **API Directory**: Curated API marketplace
- **ProgrammableWeb**: Long-standing API directory

**API Marketplaces:**
- **RapidAPI**: Largest API marketplace with 10,000+ APIs
- **Postman API Network**: Developer-focused API collection
- **Direct API Providers**: Stripe, Shopify, HubSpot, etc.

**GitHub API Repositories:**
- **Payment APIs**: Stripe, Plaid, PayPal, Square, Adyen
- **E-commerce APIs**: Shopify, WooCommerce, Magento, BigCommerce
- **CRM APIs**: HubSpot, Salesforce, Zendesk
- **Communication APIs**: Twilio, SendGrid, Slack, Discord
- **Cloud APIs**: AWS, Google Cloud, Azure
- **Analytics APIs**: Segment, Mixpanel, Amplitude
- **Developer Tools**: GitHub, GitLab, Bitbucket

**Documentation Sites:**
- Official API documentation from providers
- Developer portals and SDK repositories

### 3.2 Regulatory Frameworks
- **PSD2** (Payment Services Directive 2)
  - Region: European Union
  - Key: Open Banking APIs + Strong Authentication (SCA/MFA)
  - API patterns: Account Info, Payment Initiation
  
- **FDX** (Financial Data Exchange)
  - Region: International
  - Key: Data minimization, user control, transparency
  - Standard data models for accounts, transactions, parties

### 3.3 Integration Patterns
Common transformation patterns that appear across integrations:
- Currency conversion (cents ↔ dollars)
- Timestamp normalization (Unix ↔ ISO8601)
- Amount standardization (amount ↔ value ↔ transactionAmount)
- Pagination handling (offset, cursor, page-based)

## Harvester Usage

```python
from app.agents.knowledge_harvester import KnowledgeHarvester
from app.agents.base import AgentContext

# Create harvester
harvester = KnowledgeHarvester(context)

# Full harvest at startup
result = await harvester.execute(
    context={},
    input_data={"harvest_type": "full"}
)

# Later: Search for similar APIs
similar = await harvester.find_similar_apis(
    "payment processing with PSD2 compliance",
    top_k=5
)

# Find applicable standards
standards = await harvester.find_applicable_standards(
    "European payment integration"
)

# Find relevant patterns
patterns = await harvester.find_relevant_patterns(
    "Stripe to Salesforce integration",
    top_k=3
)
```

## Automatic Seed Data Loading

At application startup (in `app/main.py`):

```python
from app.core.seed_data import seed_all, check_seed_status

# Check if already seeded
status = await check_seed_status()

# If not seeded, initialize
if status["status"] in ["partial", "error"]:
    result = await seed_all()
    # Seeds all financial APIs, standards, patterns, and domain knowledge
```

# ===== 4. ENHANCED AGENTIC WORKFLOW =====

## Overview
Improved agent orchestration leveraging Aether's `FluxEngine` and protocol-compliant agents.

## Aether BaseAgent Integration
All Vitesse agents now inherit from Aether's `BaseAgent`, providing:
- **Standardized IO**: Pydantic models for all agent inputs and outputs.
- **Protocol Compliance**: Seamless integration with Aether's intelligence providers.
- **Unified Telemetry**: Automated pre/post hooks for logging and tracing.

## Enhanced Discovery Agent

The Discovery Agent now has access to financial knowledge:

```python
from app.agents.enhanced_discovery import EnhancedDiscoveryContext

# Create enhanced context
enhanced = EnhancedDiscoveryContext(
    shared_whiteboard=state,
    knowledge_harvester=harvester,
)

# 1. Discover APIs with knowledge enhancement
apis = await enhanced.discover_apis_with_knowledge(
    query="payment processor with recurring billing",
    domain="financial",
    limit=5,
)
# Returns: Stripe, PayPal, Square ranked by relevance

# 2. Check regulatory compliance
compliance = await enhanced.check_regulatory_compliance(
    api_name="Stripe",
    region="EU",
)
# Returns: PSD2 requirements, SCA/MFA requirements

# 3. Get integration guidance
guidance = await enhanced.get_integration_guidance(
    source_api="Stripe",
    dest_api="Salesforce",
)
# Returns: Common patterns, field mappings, success rates

# 4. Complete enriched workflow
workflow = await enhanced.enriched_discovery_workflow(
    user_intent="Sync payments to accounting",
    source_api_query="payment processor",
    dest_api_query="accounting system",
    region="EU",
)
```

## Agent Workflow with Shared State

```
1. Discovery Agent
   ├─ Reads: user_intent, user_constraints
   ├─ Uses: Knowledge Harvester, Shared State
   └─ Writes: discovered_apis, domain_knowledge → shared state

2. Ingestor Agent(s)
   ├─ Reads: discovered_apis from shared state
   ├─ Parses: API specifications
   └─ Writes: source_api_spec, dest_api_spec → shared state

3. Mapper Agent
   ├─ Reads: API specs, learned_patterns from shared state
   ├─ Generates: Field mappings using patterns
   └─ Writes: mapping_logic, transformation_rules → shared state

4. Guardian Agent
   ├─ Reads: mapping_logic from shared state
   ├─ Tests: Full integration with synthetic data
   └─ Writes: test_results, health_score → shared state

5. Deployer
   ├─ Reads: health_score, mapping_logic from shared state
   ├─ Deploys: If health_score > threshold
   └─ Writes: integration_status → shared state
```

## State Recovery
If workflow is interrupted:
```python
from app.core.shared_state import get_state_limiter

limiter = get_state_limiter()

# Create checkpoint before risky operation
checkpoint_id = limiter.create_checkpoint(workflow_id, state)

# If failure, restore
recovered_state = limiter.restore_from_checkpoint(checkpoint_id)

# Continue from checkpoint
result = await continue_workflow(recovered_state)
```

# ===== 5. MONITORING & SELF-HEALING =====

## Overview
A closed-loop system that continuously monitors active integrations and attempts autonomous repair when issues are detected.

## Implementation Files
- `app/agents/integration_monitor.py`: Tracks success rates and latency.
- `app/agents/self_healing.py`: Diagnoses errors and executes recovery strategies.

## Workflow

1.  **IntegrationMonitorAgent**: Consumes metrics from `aether.observability`.
    *   Calculates health scores based on success rate and latency.
    *   Detects anomalies (e.g., sudden spike in 500 errors).
    *   Triggers `SelfHealingAgent` if health score drops below threshold.

2.  **SelfHealingAgent**: Reacts to triggers from the Monitor.
    *   **Diagnosis**: Analyzes error logs to determine root cause (e.g., Auth failure vs. Schema change).
    *   **Strategy Selection**:
        *   *Auth Failure*: Alert Admin (cannot auto-fix credentials).
        *   *Schema Drift*: Trigger `Ingestor` to refresh spec and `Mapper` to re-map fields.
        *   *Endpoint Drift*: Update base URL if alternative is found.
    *   **Execution**: Simulates the fix and validates with `Guardian`.

```python
# Self-healing trigger example
if failure_rate > self.critical_failure_threshold:
    diagnosis = await self._diagnose_issue(integration_id)
    strategy = self._select_strategy(diagnosis)
    result = await self._execute_strategy(strategy, integration_id)
```

---

# ===== ARCHITECTURE DIAGRAM =====

```
┌─────────────────────────────────────────────────────────┐
│  USER INTENT + CONSTRAINTS (from API request)           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AETHER FLUX ENGINE (LANGGRAPH)              │
│  (Persistent, Protocol-Compliant, Agent-Coordination)    │
├─────────────────────────────────────────────────────────┤
│ • discovered_apis    ← Discovery Agent                  │
│ • source/dest_specs  ← Ingestor Agent                   │
│ • mapping_logic      ← Mapper Agent                     │
│ • test_results       ← Guardian Agent                   │
│ • learned_patterns   ← All Agents                       │
│ • harvested_knowledge← Knowledge Harvester              │
│ • domain_knowledge   ← Seed Data                        │
└─────────────────────────────────────────────────────────┘
         ▲                                    ▼
         │                          ┌─────────────────────┐
         │                          │ AGENTS PIPELINE     │
         │                          ├─────────────────────┤
         │                          │ 1. Discovery        │
         │                          │ 2. Ingestor(s)      │
         │                          │ 3. Mapper           │
         │                          │ 4. Guardian         │
         │                          │ 5. Deployer         │
         │                          │ 6. Monitor          │
         │                          │ 7. Healer           │
         │                          └─────────────────────┘
         │
    ┌────┴──────────────────────────────────────────────┐
    │           KNOWLEDGE SYSTEMS                       │
    ├────────────────────────────────────────────────────┤
    │                                                    │
    │  ┌─────────────────────────────────────────────┐  │
    │  │  KNOWLEDGE HARVESTER AGENT                  │  │
    │  │  • Discovers APIs from multiple sources     │  │
    │  │  • APIs.guru, RapidAPI, Postman Network     │  │
    │  │  • GitHub repos, documentation sites        │  │
    │  │  • Extracts schemas & patterns              │  │
    │  │  • Tracks regulatory compliance             │  │
    │  └─────────────────────────────────────────────┘  │
    │                       │                            │
    │                       ▼                            │
    │  ┌─────────────────────────────────────────────┐  │
    │  │    VECTOR DATABASE (Qdrant)    │  │
    │  │  Collections:                               │  │
    │  │  • financial_apis                           │  │
    │  │  • financial_standards (PSD2, FDX)          │  │
    │  │  • integration_patterns                     │  │
    │  │  • domain_knowledge                         │  │
    │  └─────────────────────────────────────────────┘  │
    │                       ▲                            │
    │                       │                            │
    │  ┌─────────────────────────────────────────────┐  │
    │  │    SEED DATA INITIALIZATION                 │  │
    │  │  • Financial APIs (Plaid, Stripe, Yodlee)  │  │
    │  │  • General APIs (GitHub, Slack, Twilio)    │  │
    │  │  • Marketplaces (RapidAPI, Postman)        │  │
    │  │  • Standards (PSD2, FDX)                   │  │
    │  │  • Patterns & Best Practices               │  │
    │  └─────────────────────────────────────────────┘  │
    │                                                    │
    └────────────────────────────────────────────────────┘
```

# ===== DEPLOYMENT & CONFIGURATION =====

## Environment Setup
```bash
# Automatic at app startup:
# 1. Qdrant initialized at QDRANT_URL (default: http://localhost:6333)
# 2. All collections created with quantization for performance
# 3. Seed data loaded into all collections
# 4. Shared state ready for agent coordination
# 5. Knowledge Harvester ready for queries

# No additional configuration needed beyond standard Vitesse setup
```

## Configuration
```python
# In .env or settings:
QDRANT_URL="http://localhost:6333"  # Qdrant instance URL
QDRANT_API_KEY=""  # Optional, for cloud Qdrant
KNOWLEDGE_DB_BACKEND="qdrant"  # Default backend

# For Pinecone (optional alternative):
# PINECONE_API_KEY="..."
# PINECONE_ENVIRONMENT="us-east-1-aws"
```

# ===== TESTING & VALIDATION =====

```python
# Test 1: Verify seed data loaded
from app.core.seed_data import check_seed_status
status = await check_seed_status()
assert status["status"] == "ready"

# Test 2: Verify semantic search works
from app.core.knowledge_db import get_knowledge_db
db = await get_knowledge_db()
results = await db.search("financial_apis", "payment processing", top_k=5)
assert len(results) > 0

# Test 3: Verify shared state coordination
state = SharedWhiteboardState()
state.record_agent_contribution(
    agent_id="test",
    agent_type="discovery",
    input_keys=[],
    output_data={"found": ["Stripe", "Plaid"]},
)
assert len(state.agent_contributions) > 0

# Test 4: Verify workflow execution with knowledge
enhanced = EnhancedDiscoveryContext(state, harvester)
apis = await enhanced.discover_apis_with_knowledge("payment processor")
assert len(apis) > 0
```

# ===== FUTURE EXTENSIONS =====

1. **Web Crawling**: Auto-harvest APIs from docs sites
2. **Pinecone Integration**: Complete cloud implementation
3. **FAISS Optimization**: Ultra-fast vector search for large-scale deployments
4. **Model Fine-tuning**: Train embeddings on financial domain
5. **Real-time Updates**: Periodic re-harvesting of API changes
6. **Multi-language Support**: Extend beyond English documentation
7. **Compliance Automation**: Auto-generate PSD2/FDX compliance reports

---

Last Updated: 2026-02-13
Architecture Version: 1.0
Vitesse AI: Agentic System Design & Memory Architecture
"""

# This is a comprehensive documentation file
# Import it in docs or serve it via an API endpoint

ARCHITECTURE_DOCUMENTATION = __doc__
