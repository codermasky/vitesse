from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.api import deps

router = APIRouter()


@router.get("/health")
async def get_admin_health():
    return {"status": "healthy", "components": {"database": "up", "agents": "ready"}}


@router.get("/feature-flags")
async def get_feature_flags():
    return {
        "feature_flags": {
            "enable_vision": True,
            "enable_rag": True,
            "enable_multi_agent": True,
            "enable_sidekick": True,
            "knowledge_base": True,
            "document_intelligence": True,
        },
        "descriptions": {
            "enable_vision": "Enables multi-modal vision capabilities for agents",
            "enable_rag": "Enables Retrieval Augmented Generation for document querying",
            "enable_multi_agent": "Allows coordination between multiple specialized agents",
            "enable_sidekick": "Activates the AI Sidekick for contextual assistance",
            "knowledge_base": "Enables the Knowledge Base management system",
            "document_intelligence": "Enables advanced document processing and extraction",
        },
    }
