import asyncio
from langchain_openai import ChatOpenAI
from app.core.config import settings


async def test_llm():
    print(f"Testing LLM connectivity to: {settings.OLLAMA_REMOTE_API_BASE}")
    print(f"Model: {settings.DEFAULT_LLM_MODEL}")

    llm = ChatOpenAI(
        api_key=settings.OLLAMA_REMOTE_API_KEY,
        base_url=settings.OLLAMA_REMOTE_API_BASE,
        model=settings.DEFAULT_LLM_MODEL,
        temperature=0.7,
        max_retries=1,
        request_timeout=10,  # Short timeout for test
    )

    try:
        print("Invoking LLM...")
        response = await llm.ainvoke("Hi, who are you?")
        print(f"Response: {response.content}")
    except Exception as e:
        print(f"LLM call failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_llm())
