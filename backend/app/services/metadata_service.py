"""Metadata service for document tracking and management."""

from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
import structlog

from app.models.document import Document, ExtractionStatus

logger = structlog.get_logger(__name__)


class MetadataService:
    """Service for managing document metadata."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_document_metadata(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full metadata for a document."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return None

            return {
                "id": doc.id,
                "name": doc.name,
                "type": doc.type,
                "location": doc.location,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "size": doc.size or 0,
                "description": doc.description,
                "tags": doc.tags or [],
                "author": doc.author,
                "version": doc.version,
                "language": doc.language,
                "category": doc.category,
                "doc_type": doc.doc_type,
                "access_level": doc.access_level,
                "source": doc.source,
                "extraction_status": doc.extraction_status.value if hasattr(doc.extraction_status, "value") else str(doc.extraction_status),
                "extraction_started_at": doc.extraction_started_at.isoformat()
                if doc.extraction_started_at
                else None,
                "extraction_completed_at": doc.extraction_completed_at.isoformat()
                if doc.extraction_completed_at
                else None,
                "extraction_error": doc.extraction_error,
                "chunk_count": doc.chunk_count,
                "text_length": doc.text_length,
                "embedding_model": doc.embedding_model,
                "custom_metadata": doc.custom_metadata or {},
                "user_id": doc.user_id,
                "product_id": doc.product_id,
                "deployment_type": doc.deployment_type,
            }
        except Exception as e:
            logger.error(
                "Failed to get document metadata", error=str(e), document_id=document_id
            )
            return None

    async def update_document_metadata(
        self, document_id: str, metadata: Dict[str, Any]
    ) -> bool:
        """Update document metadata fields."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            # Update allowed fields
            updatable_fields = [
                "name",
                "description",
                "tags",
                "author",
                "version",
                "language",
                "category",
                "doc_type",
                "access_level",
                "custom_metadata",
                "product_id",
                "deployment_type",
                "source",
            ]

            for field in updatable_fields:
                if field in metadata:
                    setattr(doc, field, metadata[field])

            await self.db.commit()
            logger.info("Document metadata updated", document_id=document_id)
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(
                "Failed to update document metadata",
                error=str(e),
                document_id=document_id,
            )
            return False

    async def add_tags(self, document_id: str, tags: List[str]) -> bool:
        """Add tags to a document."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            current_tags = doc.tags or []
            # Merge tags, avoiding duplicates
            new_tags = list(set(current_tags + tags))
            doc.tags = new_tags

            await self.db.commit()
            logger.info("Tags added to document", document_id=document_id, tags=tags)
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error("Failed to add tags", error=str(e), document_id=document_id)
            return False

    async def remove_tags(self, document_id: str, tags: List[str]) -> bool:
        """Remove tags from a document."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            current_tags = doc.tags or []
            new_tags = [tag for tag in current_tags if tag not in tags]
            doc.tags = new_tags

            await self.db.commit()
            logger.info(
                "Tags removed from document", document_id=document_id, tags=tags
            )
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error("Failed to remove tags", error=str(e), document_id=document_id)
            return False

    async def update_extraction_status(
        self,
        document_id: str,
        status: ExtractionStatus,
        error: Optional[str] = None,
        chunk_count: Optional[int] = None,
        text_length: Optional[int] = None,
        embedding_model: Optional[str] = None,
    ) -> bool:
        """Update extraction flow status and statistics."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            doc.extraction_status = status

            if status == ExtractionStatus.PROCESSING and not doc.extraction_started_at:
                doc.extraction_started_at = datetime.utcnow()

            if status == ExtractionStatus.COMPLETED:
                doc.extraction_completed_at = datetime.utcnow()
                doc.extraction_error = None
                if chunk_count is not None:
                    doc.chunk_count = chunk_count
                if text_length is not None:
                    doc.text_length = text_length
                if embedding_model is not None:
                    doc.embedding_model = embedding_model

            if status == ExtractionStatus.FAILED:
                doc.extraction_completed_at = datetime.utcnow()
                doc.extraction_error = error

            await self.db.commit()
            logger.info(
                "Extraction status updated", document_id=document_id, status=status
            )
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(
                "Failed to update extraction status",
                error=str(e),
                document_id=document_id,
            )
            return False

    async def get_extraction_logs(self, document_id: str) -> Dict[str, Any]:
        """Get extraction flow logs and timeline."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return {"error": "Document not found"}

            timeline = []

            if doc.uploaded_at:
                timeline.append(
                    {
                        "event": "uploaded",
                        "timestamp": doc.uploaded_at.isoformat(),
                        "status": "completed",
                    }
                )

            if doc.extraction_started_at:
                timeline.append(
                    {
                        "event": "extraction_started",
                        "timestamp": doc.extraction_started_at.isoformat(),
                        "status": "completed",
                    }
                )

            if doc.extraction_completed_at:
                timeline.append(
                    {
                        "event": "extraction_completed",
                        "timestamp": doc.extraction_completed_at.isoformat(),
                        "status": "completed"
                        if doc.extraction_status == ExtractionStatus.COMPLETED
                        else "failed",
                        "error": doc.extraction_error
                        if doc.extraction_status == ExtractionStatus.FAILED
                        else None,
                    }
                )

            return {
                "document_id": document_id,
                "current_status": doc.extraction_status.value if hasattr(doc.extraction_status, "value") else str(doc.extraction_status),
                "timeline": timeline,
                "error": doc.extraction_error,
                "duration_seconds": (
                    (
                        doc.extraction_completed_at - doc.extraction_started_at
                    ).total_seconds()
                    if doc.extraction_started_at and doc.extraction_completed_at
                    else None
                ),
            }

        except Exception as e:
            logger.error(
                "Failed to get extraction logs", error=str(e), document_id=document_id
            )
            return {"error": str(e)}

    async def get_chunk_statistics(self, document_id: str) -> Dict[str, Any]:
        """Get chunk-level statistics for a document."""
        try:
            result = await self.db.execute(
                select(Document).filter(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return {"error": "Document not found"}

            return {
                "document_id": document_id,
                "chunk_count": doc.chunk_count or 0,
                "text_length": doc.text_length or 0,
                "embedding_model": doc.embedding_model,
                "avg_chunk_size": (
                    doc.text_length // doc.chunk_count
                    if doc.chunk_count and doc.chunk_count > 0
                    else 0
                ),
            }

        except Exception as e:
            logger.error(
                "Failed to get chunk statistics", error=str(e), document_id=document_id
            )
            return {"error": str(e)}

    async def search_by_metadata(
        self, filters: Dict[str, Any], user_id: int = None, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Search documents by metadata criteria."""
        try:
            stmt = select(Document)

            # Filter by user if provided
            if user_id:
                stmt = stmt.filter(Document.user_id == user_id)

            # Apply filters
            if "tags" in filters and filters["tags"]:
                # Filter by tags (assuming tags is a JSON array)
                for tag in filters["tags"]:
                    stmt = stmt.filter(func.json_contains(Document.tags, f'"{tag}"'))

            if "doc_type" in filters:
                stmt = stmt.filter(Document.doc_type == filters["doc_type"])

            if "category" in filters:
                stmt = stmt.filter(Document.category == filters["category"])

            if "extraction_status" in filters:
                stmt = stmt.filter(
                    Document.extraction_status == filters["extraction_status"]
                )

            if "author" in filters:
                stmt = stmt.filter(Document.author == filters["author"])

            if "product_id" in filters:
                stmt = stmt.filter(Document.product_id == filters["product_id"])

            if "deployment_type" in filters:
                stmt = stmt.filter(
                    Document.deployment_type == filters["deployment_type"]
                )

            if "date_from" in filters:
                stmt = stmt.filter(Document.uploaded_at >= filters["date_from"])

            if "date_to" in filters:
                stmt = stmt.filter(Document.uploaded_at <= filters["date_to"])

            # Execute query with pagination
            stmt = stmt.limit(limit).offset(offset)
            result = await self.db.execute(stmt)
            docs = result.scalars().all()

            return [
                {
                    "id": doc.id,
                    "name": doc.name,
                    "type": doc.type,
                    "doc_type": doc.doc_type,
                    "category": doc.category,
                    "tags": doc.tags or [],
                    "extraction_status": doc.extraction_status.value if hasattr(doc.extraction_status, "value") else str(doc.extraction_status),
                    "uploaded_at": doc.uploaded_at.isoformat()
                    if doc.uploaded_at
                    else None,
                }
                for doc in docs
            ]

        except Exception as e:
            logger.error("Failed to search by metadata", error=str(e), filters=filters)
            return []

    async def get_all_tags(self, user_id: int = None) -> List[str]:
        """Get all unique tags across all documents."""
        try:
            stmt = select(Document).filter(Document.tags.isnot(None))
            if user_id:
                stmt = stmt.filter(Document.user_id == user_id)
            result = await self.db.execute(stmt)
            docs = result.scalars().all()
            all_tags = set()
            for doc in docs:
                if doc.tags:
                    all_tags.update(doc.tags)
            return sorted(list(all_tags))

        except Exception as e:
            logger.error("Failed to get all tags", error=str(e))
            return []


def get_metadata_service(db: AsyncSession) -> MetadataService:
    """Get metadata service instance."""
    return MetadataService(db)
