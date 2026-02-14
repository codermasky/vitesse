from typing import List, Dict, Any, Optional, Union, Callable
import structlog
from datetime import datetime
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile

from app.core.config import settings
from app.services.vectorization import get_vectorization_service
from app.db.session import async_session_factory

logger = structlog.get_logger(__name__)

# LangChain 1.x uses LCEL (LangChain Expression Language) instead of legacy chains
try:
    from langchain_core.prompts import PromptTemplate
    from langchain_core.runnables import RunnablePassthrough
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic

    LANGCHAIN_AVAILABLE = True
    logger.info("LangChain RAG functionality enabled with LCEL")
except ImportError as e:
    LANGCHAIN_AVAILABLE = False
    logger.warning(
        f"LangChain modules not available: {e}, knowledge base limited to vector search"
    )


class KnowledgeBaseManager:
    """Service for managing the RAG knowledge base."""

    def __init__(self):
        pass

    async def add_document(
        self,
        file_path: str,
        file_type: str,
        document_id: str,
        metadata: Dict[str, Any] = None,
        db_session=None,
    ) -> Dict[str, Any]:
        """Add a document to the knowledge base."""
        try:
            logger.info(f"Adding document to KB: {document_id}", file_path=file_path)

            # Enrich metadata
            doc_metadata = metadata or {}
            doc_metadata.update(
                {"ingested_at": datetime.utcnow().isoformat(), "status": "active"}
            )

            result = await get_vectorization_service().process_and_vectorize_document(
                file_path=file_path,
                file_type=file_type,
                document_id=document_id,
                metadata=doc_metadata,
                db_session=db_session,
            )

            return result

        except Exception as e:
            logger.error(
                "Failed to add document to KB", error=str(e), document_id=document_id
            )

            # Update document status to failed if db_session is available
            if db_session:
                try:
                    from sqlalchemy import select, update
                    from app.models.document import Document, ExtractionStatus

                    # Update document status to failed
                    stmt = (
                        update(Document)
                        .where(Document.id == document_id)
                        .values(
                            extraction_status=ExtractionStatus.FAILED.value,
                            extraction_error=str(e)[
                                :500
                            ],  # Store first 500 chars of error
                        )
                    )
                    await db_session.execute(stmt)
                    await db_session.commit()
                    logger.info(f"Updated document {document_id} status to FAILED")
                except Exception as update_error:
                    logger.error(f"Failed to update document status: {update_error}")

            return {
                "success": False,
                "error": str(e),
                "document_id": document_id,
            }

    async def revectorize_document(
        self,
        document_id: str,
        file_path: str,
        file_type: str,
        metadata: Dict[str, Any],
        chunk_count: int = None,
        db_session=None,
    ) -> Dict[str, Any]:
        """Re-vectorize a document to update metadata or content."""
        try:
            # Try to fetch current chunk count for deletion if db_session is provided AND chunk_count is missing
            if db_session and chunk_count is None:
                from app.services.metadata_service import get_metadata_service

                # We need to strip UUID if document_id format is confusing,
                # but usually document_id passed here is the UUID.
                ms = get_metadata_service(db_session)
                stats = await ms.get_chunk_statistics(document_id)
                chunk_count = stats.get("total_chunks")

            return await get_vectorization_service().revectorize_document(
                document_id=document_id,
                file_path=file_path,
                file_type=file_type,
                metadata=metadata,
                chunk_count_for_deletion=chunk_count,
                db_session=db_session,
            )
        except Exception as e:
            logger.error(
                "Re-vectorization failed", error=str(e), document_id=document_id
            )
            return {"success": False, "error": str(e)}

    async def query_knowledge_base(
        self, question: str, context_filter: Dict[str, Any] = None, max_sources: int = 5
    ) -> Dict[str, Any]:
        """Query the knowledge base for relevant information."""
        # For now, we'll just do a semantic search since full RAG requires more setup
        # Future: Implement full RAG chain here

        results = await self.search_similar_documents(
            query=question, limit=max_sources, filter_metadata=context_filter
        )

        return {
            "answer": "RAG generation temporarily disabled. See sources for relevant context.",
            "sources": results,
            "question": question,
            "confidence_score": 0.0,
        }

    async def search_similar_documents(
        self,
        query: str,
        limit: int = 10,
        filter_metadata: Union[Dict[str, Any], Callable[[Dict[str, Any]], bool]] = None,
    ) -> List[Dict[str, Any]]:
        """Search for similar documents without generating answers."""
        return await get_vectorization_service().search_similar(
            query=query, k=limit, filter_metadata=filter_metadata
        )

    async def delete_document(self, document_id: str) -> bool:
        """Delete a document from the knowledge base."""
        return await get_vectorization_service().delete_document(document_id)

    async def get_knowledge_stats(self) -> Dict[str, Any]:
        """Get statistics about the knowledge base."""
        vector_stats = await get_vectorization_service().get_document_stats()
        return {
            "vector_store": vector_stats,
            "status": "active",
            "backend": settings.VECTOR_DB_TYPE,
        }

    async def rebuild_index(self) -> Dict[str, Any]:
        """Rebuild the vector index (useful for maintenance)."""
        return {
            "success": False,
            "message": "Index rebuild not implemented for current vector store",
        }


# Global knowledge base manager instance
knowledge_base_manager = KnowledgeBaseManager()
