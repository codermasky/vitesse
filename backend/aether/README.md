# Project Aether

A modular agentic orchestration platform and intelligence layer for building high-performance, production-ready agentic applications.

## 🚀 Core Components

### Orchestration
- **Flux**: Futuristic orchestration engine built on LangGraph
- **BaseAgent**: Foundation for structured, observable agents with typed inputs/outputs
- **BaseWorkflowState**: Standard state container for workflows

### Protocols
- **IntelligenceProvider**: Abstract interface for LLM interactions
- **Context & Persistence**: Protocols for context retrieval and state persistence

### 🆕 Observability (v0.2.0)
- **Prometheus Metrics**: Pre-configured metrics for agents, workflows, LLMs, caching
- **WebSocket Live Feed**: Real-time agent monitoring and status updates
- **Telemetry**: Structured logging with automatic PII masking

### 🆕 Resilience (v0.2.0)
- **Error Handling**: Comprehensive error handling framework with graceful degradation
- **Validation**: Utilities for data validation, type checking, and range validation
- **Safe Operations**: Safe mathematical operations with fallbacks
- **Recovery Strategies**: Type-based default recovery for missing/invalid data

### 🆕 Infrastructure (v0.2.0)
- **Caching**: Multi-tier caching with TTL, request deduplication, and hit-rate tracking
- **Checkpoint**: LangGraph checkpoint management for workflow persistence

### 🆕 Security (v0.2.0)
- **PII Masking**: Automatic detection and hashing of SSN, EIN, credit cards, emails, phone numbers
- **Secure Logging**: Safe logging utilities with PII protection

### 🆕 Workflows (v0.2.0 - Phase 2)
- **Routing Helpers**: Pre-built routers for quality gates, retries, validation, branching
- **Human-in-the-Loop**: Patterns and utilities for workflow review and approval
- **Workflow Registry**: Plugin-style workflow management and dynamic routing
- **Standard Patterns**: Common workflow patterns ready to use

### 🆕 Testing (v0.2.0 - Phase 2)
- **Mock Provider**: Test agents without LLM API calls
- **Test Fixtures**: Helpers for creating test states and running tests
- **Assertions**: Pre-built assertions for common validations
- **Performance Testing**: Benchmark agent performance

---

## 📦 Installation

```bash
pip install -e .
```

**Dependencies:**
- Python >= 3.11
- pydantic >= 2.0.0
- langgraph >= 0.0.10
- langchain-core >= 0.1.0
- structlog >= 23.2.0
- prometheus-client >= 0.19.0
- redis >= 5.0.0

---

## 🎯 Quick Start

### Basic Workflow with Flux
```python
from aether.flux.engine import Flux
from aether.core.state import BaseWorkflowState

class MyState(BaseWorkflowState):
    result: str = ""

flux = Flux(state_schema=MyState)

# Define workflow nodes
async def step1(state, config):
    state["result"] = "Processed"
    return state

flux.add_node("process", step1)
flux.set_entry_point("process")
flux.add_edge("process", "__end__")

# Execute
workflow = flux.compile()
result = await workflow.ainvoke({"workflow_id": "test"})
```

### Agent with Error Handling
```python
from aether.agents.base import BaseAgent
from aether.protocols.intelligence import IntelligenceProvider
from aether.resilience import async_error_handler, ErrorSeverity

class MyAgent(BaseAgent):
    @async_error_handler(
        fallback_value={},
        error_severity=ErrorSeverity.ERROR,
        context="Agent execution"
    )
    async def run(self, input_data, **kwargs):
        # Your agent logic here
        result = await self.intelligence.ainvoke("Process this data")
        return {"output": result}
```

### Observability with Metrics
```python
from aether.observability.metrics import (
    record_agent_execution,
    record_llm_call,
    get_metrics
)
import time

# Record agent execution
start = time.time()
# ... agent logic ...
duration = time.time() - start
record_agent_execution("my_agent", duration, success=True)

# Record LLM call
record_llm_call(
    provider="openai",
    model="gpt-4",
    duration=1.2,
    tokens_input=100,
    tokens_output=50,
    cost=0.003
)

# Expose metrics endpoint
metrics_text = get_metrics()  # Prometheus format
```

### Caching for LLM Calls
```python
from aether.infrastructure.caching import get_llm_cache

cache = get_llm_cache()

# Cache with TTL
prompt = "What is the capital of France?"
async def fetch_llm_response():
    # Your LLM call here
    return await llm.ainvoke(prompt)

# Get from cache or fetch (with request deduplication)
result = await cache.get_or_fetch(prompt, fetch_llm_response, ttl_seconds=3600)

# Check cache stats
stats = cache.get_stats()
print(f"Hit rate: {stats['hit_rate_percent']}%")
```

### PII Masking for Compliance
```python
from aether.security import mask_pii_in_data, mask_pii_in_text

# Mask PII in text
text = "John's SSN is 123-45-6789 and email is john@example.com"
safe_text = mask_pii_in_text(text)
# Output: "John's SSN is <SSN:a1b2c3d4e5f6> and email is <EMAIL:x7y8z9a0b1c2>"

# Mask PII in nested data
data = {
    "user": "John Doe",
    "ssn": "123-45-6789",
    "contact": {"email": "john@example.com"}
}
safe_data = mask_pii_in_data(data)
# All PII fields are automatically hashed
```

---

## 📚 Documentation

- [Feature Extraction Analysis](docs/plan/credo_to_aether_extraction_analysis.md) - Detailed analysis of features extracted from Credo
- [Phase 1 Implementation Plan](docs/plan/phase1_implementation.md) - Implementation roadmap
- [Phase 1 Progress](docs/plan/phase1_progress.md) - Current progress and completed features

---

## 🏗️ Architecture

Aether follows a modular, protocol-oriented architecture:

```
aether/
├── core/          # State management, base classes
├── flux/          # Workflow orchestration engine
├── agents/        # Agent base classes and utilities
├── protocols/     # Abstract interfaces
├── observability/ # Metrics, live feed, telemetry
├── resilience/    # Error handling, validation
├── infrastructure/# Caching, checkpointing, optimization
└── security/      # PII masking, secure logging
```

**Design Principles:**
- **Protocol-oriented**: Define interfaces, not implementations
- **Graceful degradation**: Never break workflows due to errors
- **Observable by default**: Built-in metrics and monitoring
- **Production-ready**: Security, resilience, and performance built-in

---

## 🎓 Example Applications

### Credo - Agentic Credit Analyst
A production application built on Aether demonstrating:
- Multi-agent workflows with conditional routing
- Real-time WebSocket monitoring
- Comprehensive error handling
- LLM cost tracking with caching

See [`~/Sandbox/credo`](file:///Users/sujitm/Sandbox/credo) for full implementation.

---

## 🛣️ Roadmap

### ✅ Phase 1: Core Platform (COMPLETE)
- ✅ Error Handling Framework
- ✅ Prometheus Metrics
- ✅ Multi-tier Caching
- ✅ PII Masking
- ✅ Enhanced Intelligence Provider
- ✅ WebSocket Live Feed
- ✅ Checkpoint Management
- ✅ Agent Execution Hooks

### ✅ Phase 2: Developer Experience (COMPLETE)
- ✅ Conditional routing helpers
- ✅ Human-in-the-loop patterns
- ✅ Workflow registry and management
- ✅ Testing utilities with mock provider
- ✅ Utility functions
- ✅ Comprehensive documentation

### Phase 3: Advanced Features (Optional)
- Agent name mapping patterns
- Multi-document workflow support
- Load testing framework
- Prompt registry and versioning
- Advanced profiling utilities
- Sample data generation

---

## 🤝 Contributing

Aether is following a staged extraction approach from the Credo project. See the [extraction analysis](docs/plan/credo_to_aether_extraction_analysis.md) for details on upcoming features.

---

## 📄 License

This project is under active development.

---

**Version:** 0.2.0  
**Status:** Alpha - Phase 1 in progress  
**Last Updated:** 2026-02-03
