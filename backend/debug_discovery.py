import asyncio
import structlog
from app.agents.discovery import VitesseDiscoveryAgent
from app.agents.base import AgentContext
from unittest.mock import MagicMock


async def test_discovery():
    structlog.configure(processors=[structlog.processors.JSONRenderer()])
    context = AgentContext()
    agent = VitesseDiscoveryAgent(context)

    print("Testing catalog search for 'salesforce'...")
    results = agent._search_known_apis("salesforce", 5)
    print(f"Catalog results: {len(results)}")
    for r in results:
        print(f"  - {r.api_name} (Source: {r.source})")

    print("\nTesting basic LLM invoke...")
    from app.services.llm_provider import LLMProviderService

    llm = await LLMProviderService.create_llm(agent_id=agent.agent_id)
    print(f"LLM Instance: {type(llm)}")
    print(f"Model: {getattr(llm, 'model_name', 'unknown')}")
    try:
        resp = await llm.ainvoke("Say hello")
        print(f"Basic invoke response: {resp.content}")
    except Exception as e:
        print(f"Basic invoke failed: {e}")

    print("\nTesting structured output with ChatOpenAI directly...")
    from pydantic import BaseModel
    from typing import List

    class TestResult(BaseModel):
        items: List[str]

    try:
        structured_llm = llm.with_structured_output(TestResult)
        print("Invoking structured LLM...")
        resp = await structured_llm.ainvoke("List 3 fruit")
        print(f"Structured response: {resp}")
    except Exception as e:
        print(f"Structured invoke failed: {e}")

    print("\nTesting execute for 'salesforce'...")
    # Mocking knowledge_db to avoid Qdrant error in this test if possible,
    # but let's see if it fails.
    try:
        result = await agent.execute(
            context={}, input_data={"query": "salesforce", "limit": 5}
        )
        print(f"Execute status: {result['status']}")
        print(f"Total found: {result['total_found']}")
    except Exception as e:
        print(f"Execute failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_discovery())
