#!/usr/bin/env python3
import asyncio
import sys
import os
import argparse
from typing import Optional

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.db.session import async_session_factory
from app.services.llm_provider import LLMProviderService
from app.services.semantic.layer import SemanticLayer


async def verify_llm_connection():
    print("Verifying LLM Connection...")
    try:
        llm = await LLMProviderService.create_llm(model_name="gpt-3.5-turbo")
        response = await LLMProviderService.invoke_with_monitoring(
            llm_instance=llm,
            prompt="Hello, return the word 'Connected'",
            agent_id="Verifier",
        )
        if "Connected" in response:
            print("✅ LLM Connection: OK")
            return True
        else:
            print(f"❌ LLM Connection: Unexpected response: {response}")
            return False
    except Exception as e:
        print(f"❌ LLM Connection: Failed - {e}")
        return False


from sqlalchemy import text


async def verify_database():
    print("\nVerifying Database Connection...")
    try:
        async with async_session_factory() as db:
            await db.execute(text("SELECT 1"))
            print("✅ Database Connection: OK")
            return True
    except Exception as e:
        print(f"❌ Database Connection: Failed - {e}")
        return False


async def verify_semantic_layer():
    print("\nVerifying Semantic Layer (pgvector)...")
    try:
        async with async_session_factory() as db:
            layer = SemanticLayer(db)
            embedding = await layer._generate_embedding("test")
            if len(embedding) == 1536:  # OpenAI default
                print("✅ Embeddings Generation: OK")
            else:
                print(f"❌ Embeddings: Unexpected dimension {len(embedding)}")
                return False

            # Test getting similar (should be empty but not crash)
            results = await layer.get_similar_mappings("test", "", "test", "")
            print("✅ Vector Search: OK")
            return True
    except Exception as e:
        print(f"❌ Semantic Layer: Failed - {e}")
        return False


async def main():
    parser = argparse.ArgumentParser(description="Verify Integration Infrastructure")
    parser.add_argument(
        "--component", choices=["llm", "db", "semantic", "all"], default="all"
    )
    args = parser.parse_args()

    success = True

    if args.component in ["db", "all"]:
        if not await verify_database():
            success = False

    if args.component in ["llm", "all"]:
        if not await verify_llm_connection():
            success = False

    if args.component in ["semantic", "all"]:
        if not await verify_semantic_layer():
            success = False

    if success:
        print("\n✨ All systems go! Infrastructure is ready.")
        sys.exit(0)
    else:
        print("\n⚠️  Verification failed. Check logs above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
