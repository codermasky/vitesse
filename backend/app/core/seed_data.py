"""
Seed Data Initialization System

Pre-loads the system with foundational domain knowledge and configuration
parameters during application startup. This enables immediate self-onboarding
to new financial integrations without manual updates.

Called during app lifespan initialization.
"""

import structlog
from typing import Dict, List, Any, Optional
import asyncio

from app.core.knowledge_db import (
    get_knowledge_db,
    FINANCIAL_APIS_COLLECTION,
    FINANCIAL_SCHEMAS_COLLECTION,
    FINANCIAL_STANDARDS_COLLECTION,
    INTEGRATION_PATTERNS_COLLECTION,
    DOMAIN_KNOWLEDGE_COLLECTION,
)
from app.core.financial_services import (
    get_financial_apis,
    get_financial_standards,
    get_financial_patterns,
    EXPANDED_API_KNOWLEDGE,
)

logger = structlog.get_logger(__name__)


async def seed_financial_apis() -> Dict[str, Any]:
    """Seed financial API knowledge base."""
    logger.info("Seeding financial APIs...")

    try:
        knowledge_db = await get_knowledge_db()
        financial_apis = get_financial_apis()

        documents = []
        for api_key, api_data in financial_apis.items():
            documents.append(
                {
                    "content": str(api_data),
                    "api_name": api_data.get("api_name"),
                    "category": api_data.get("category"),
                    "region": str(api_data.get("region")),
                    "doc_url": api_data.get("doc_url"),
                    "tags": ",".join(api_data.get("tags", [])),
                }
            )

        doc_ids = await knowledge_db.add_documents(
            collection=FINANCIAL_APIS_COLLECTION,
            documents=documents,
        )

        logger.info(
            "Financial APIs seeded",
            api_count=len(documents),
            collection=FINANCIAL_APIS_COLLECTION,
        )

        return {
            "status": "success",
            "collection": FINANCIAL_APIS_COLLECTION,
            "documents_seeded": len(doc_ids),
            "doc_ids": doc_ids,
        }

    except Exception as e:
        logger.error("Failed to seed financial APIs", error=str(e))
        return {
            "status": "error",
            "collection": FINANCIAL_APIS_COLLECTION,
            "error": str(e),
        }


async def seed_financial_standards() -> Dict[str, Any]:
    """Seed financial standards and regulatory knowledge."""
    logger.info("Seeding financial standards...")

    try:
        knowledge_db = await get_knowledge_db()
        standards = get_financial_standards()

        documents = []
        for std_key, std_data in standards.items():
            documents.append(
                {
                    "content": str(std_data),
                    "standard": std_data.get("standard"),
                    "region": std_data.get("region"),
                    "full_name": std_data.get("full_name"),
                    "version": str(std_data.get("version", "")),
                    "doc_url": std_data.get("doc_url"),
                }
            )

        doc_ids = await knowledge_db.add_documents(
            collection=FINANCIAL_STANDARDS_COLLECTION,
            documents=documents,
        )

        logger.info(
            "Financial standards seeded",
            standard_count=len(documents),
            collection=FINANCIAL_STANDARDS_COLLECTION,
        )

        return {
            "status": "success",
            "collection": FINANCIAL_STANDARDS_COLLECTION,
            "documents_seeded": len(doc_ids),
            "doc_ids": doc_ids,
        }

    except Exception as e:
        logger.error("Failed to seed financial standards", error=str(e))
        return {
            "status": "error",
            "collection": FINANCIAL_STANDARDS_COLLECTION,
            "error": str(e),
        }


async def seed_integration_patterns() -> Dict[str, Any]:
    """Seed common integration patterns."""
    logger.info("Seeding integration patterns...")

    try:
        knowledge_db = await get_knowledge_db()
        patterns = get_financial_patterns()

        documents = []
        for pattern_key, pattern_data in patterns.items():
            documents.append(
                {
                    "content": str(pattern_data),
                    "pattern_name": pattern_data.get("pattern_name"),
                    "description": pattern_data.get("description"),
                    "complexity_score": pattern_data.get("complexity_score", 0),
                    "success_rate": pattern_data.get("success_rate", 0),
                }
            )

        doc_ids = await knowledge_db.add_documents(
            collection=INTEGRATION_PATTERNS_COLLECTION,
            documents=documents,
        )

        logger.info(
            "Integration patterns seeded",
            pattern_count=len(documents),
            collection=INTEGRATION_PATTERNS_COLLECTION,
        )

        return {
            "status": "success",
            "collection": INTEGRATION_PATTERNS_COLLECTION,
            "documents_seeded": len(doc_ids),
            "doc_ids": doc_ids,
        }

    except Exception as e:
        logger.error("Failed to seed integration patterns", error=str(e))
        return {
            "status": "error",
            "collection": INTEGRATION_PATTERNS_COLLECTION,
            "error": str(e),
        }


async def seed_domain_knowledge() -> Dict[str, Any]:
    """Seed domain-specific knowledge and best practices."""
    logger.info("Seeding domain knowledge...")

    try:
        knowledge_db = await get_knowledge_db()

        domain_docs = [
            {
                "content": "Financial API Best Practices: Always use OAuth2 for authentication, implement exponential backoff for rate limiting, validate all input data, handle network timeouts gracefully.",
                "topic": "best_practices",
                "domain": "financial",
            },
            {
                "content": "Field Mapping Conventions: Use snake_case for internal fields, respect original API field names in schemas, document custom transformations, maintain backward compatibility.",
                "topic": "field_mapping",
                "domain": "general",
            },
            {
                "content": "Error Handling: Implement retry logic with exponential backoff, distinguish between transient and permanent errors, log all errors with context, notify users of failures.",
                "topic": "error_handling",
                "domain": "general",
            },
            {
                "content": "Security Considerations: Never log sensitive data (credentials, PII), use environment variables for secrets, implement request signing where required, validate SSL certificates.",
                "topic": "security",
                "domain": "general",
            },
            {
                "content": "Pagination Patterns: Offset-based: use offset/limit; Cursor-based: use cursor/limit; Page-based: use page/page_size. Always check for next link in response.",
                "topic": "pagination",
                "domain": "general",
            },
            {
                "content": "Data Format Conversions: Timestamps: Unix (seconds/ms) to ISO8601; Currency: cents to dollars (divide by 100); Booleans: string representations to native types.",
                "topic": "data_transformations",
                "domain": "financial",
            },
        ]

        doc_ids = await knowledge_db.add_documents(
            collection=DOMAIN_KNOWLEDGE_COLLECTION,
            documents=domain_docs,
        )

        logger.info(
            "Domain knowledge seeded",
            topic_count=len(domain_docs),
            collection=DOMAIN_KNOWLEDGE_COLLECTION,
        )

        return {
            "status": "success",
            "collection": DOMAIN_KNOWLEDGE_COLLECTION,
            "documents_seeded": len(doc_ids),
            "doc_ids": doc_ids,
        }

    except Exception as e:
        logger.error("Failed to seed domain knowledge", error=str(e))
        return {
            "status": "error",
            "collection": DOMAIN_KNOWLEDGE_COLLECTION,
            "error": str(e),
        }


async def seed_expanded_apis() -> Dict[str, Any]:
    """Seed expanded API knowledge from multiple sources."""
    logger.info("Seeding expanded API knowledge...")

    try:
        knowledge_db = await get_knowledge_db()

        documents = []
        for api_data in EXPANDED_API_KNOWLEDGE:
            documents.append(
                {
                    "content": str(api_data),
                    "api_name": api_data.get("api_name"),
                    "category": api_data.get("category"),
                    "region": str(api_data.get("region")),
                    "doc_url": api_data.get("doc_url"),
                    "source": "seed_data",
                }
            )

        doc_ids = await knowledge_db.add_documents(
            collection=FINANCIAL_APIS_COLLECTION,
            documents=documents,
        )

        logger.info(
            "Seeded expanded APIs",
            count=len(doc_ids),
            apis=[api.get("api_name") for api in EXPANDED_API_KNOWLEDGE],
        )

        return {
            "status": "success",
            "collection": FINANCIAL_APIS_COLLECTION,
            "documents_seeded": len(doc_ids),
            "doc_ids": doc_ids,
        }

    except Exception as e:
        logger.error("Failed to seed expanded APIs", error=str(e))
        return {
            "status": "error",
            "collection": FINANCIAL_APIS_COLLECTION,
            "error": str(e),
        }


async def seed_all() -> Dict[str, Any]:
    """Seed all knowledge bases."""
    logger.info("Starting comprehensive seed data initialization...")

    results = {
        "status": "success",
        "timestamp": str(__import__("datetime").datetime.utcnow()),
        "seeds": {},
        "errors": [],
    }

    # Run all seeding tasks
    seed_tasks = [
        ("financial_apis", seed_financial_apis()),
        ("expanded_apis", seed_expanded_apis()),
        ("financial_standards", seed_financial_standards()),
        ("integration_patterns", seed_integration_patterns()),
        ("domain_knowledge", seed_domain_knowledge()),
    ]

    for name, task in seed_tasks:
        try:
            result = await task
            results["seeds"][name] = result

            if result["status"] != "success":
                results["errors"].append(
                    {
                        "seed": name,
                        "error": result.get("error"),
                    }
                )
                results["status"] = "partial"

        except Exception as e:
            logger.error("Seed task failed", task=name, error=str(e))
            results["errors"].append(
                {
                    "seed": name,
                    "error": str(e),
                }
            )
            results["status"] = "partial"

    # Summary
    total_seeded = sum(
        r.get("documents_seeded", 0)
        for r in results["seeds"].values()
        if r.get("status") == "success"
    )

    logger.info(
        "Seed data initialization complete",
        status=results["status"],
        total_documents_seeded=total_seeded,
        errors_count=len(results["errors"]),
    )

    return results


async def check_seed_status() -> Dict[str, Any]:
    """Check if seed data has been initialized."""
    logger.info("Checking seed data status...")

    try:
        knowledge_db = await get_knowledge_db()
        collections = await knowledge_db.list_collections()

        expected_collections = [
            FINANCIAL_APIS_COLLECTION,
            FINANCIAL_STANDARDS_COLLECTION,
            INTEGRATION_PATTERNS_COLLECTION,
            DOMAIN_KNOWLEDGE_COLLECTION,
        ]

        initialized_collections = [c for c in expected_collections if c in collections]

        return {
            "status": (
                "ready"
                if len(initialized_collections) == len(expected_collections)
                else "partial"
            ),
            "initialized_collections": initialized_collections,
            "missing_collections": [
                c for c in expected_collections if c not in collections
            ],
            "total_collections": len(collections),
        }

    except Exception as e:
        logger.error("Failed to check seed status", error=str(e))
        return {
            "status": "error",
            "error": str(e),
        }
