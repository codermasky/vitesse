"""Knowledge base API endpoints - query and search functionality."""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Any, Optional
from app import models
from app.api import deps
from app.services.knowledge_base import knowledge_base_manager
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/")
async def read_knowledge_base(
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Get knowledge base statistics."""
    try:
        stats = await knowledge_base_manager.get_knowledge_stats()
        return {"status": "operational", "stats": stats}
    except Exception as e:
        logger.error("Failed to get knowledge base stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get knowledge base stats",
        )


@router.post("/query")
async def query_knowledge_base(
    query: str = Form(...),
    max_sources: int = Form(5),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Query the knowledge base."""
    if not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty"
        )

    try:
        result = await knowledge_base_manager.query_knowledge_base(
            query=query, max_sources=max_sources
        )
        return result
    except Exception as e:
        logger.error("Failed to query knowledge base", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to query knowledge base",
        )


@router.post("/search")
async def search_knowledge_base(
    query: str = Form(...),
    limit: int = Form(10),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Search for similar documents in the knowledge base."""
    if not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty"
        )

    try:
        results = await knowledge_base_manager.search_similar_documents(
            query=query, limit=limit
        )
        return {"query": query, "results": results, "count": len(results)}
    except Exception as e:
        logger.error("Failed to search knowledge base", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search knowledge base",
        )


@router.delete("/documents/{document_id}")
async def delete_document_from_kb(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Delete a document from the knowledge base."""
    try:
        from app.models.document import Document
        from sqlalchemy import select

        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this document"
            )

        success = await knowledge_base_manager.delete_document(document_id)

        if success:
            return {"message": f"Document {document_id} deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete document from KB", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document",
        )
