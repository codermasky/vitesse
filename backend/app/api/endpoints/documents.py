"""Documents API endpoints - comprehensive document management."""

from typing import List, Dict, Any, Optional
import shutil
import os
import uuid
import json
import asyncio
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Form,
    Depends,
    BackgroundTasks,
)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app import models
from app.api import deps
from app.core.config import settings
from app.db.session import get_db
from app.services.knowledge_base import knowledge_base_manager
from app.services.metadata_service import get_metadata_service
from app.services.vectorization import get_vectorization_service
from app.models.document import Document, ExtractionStatus
import structlog

logger = structlog.get_logger(__name__)
router = APIRouter()


# Pydantic models for request/response
class MetadataUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None
    version: Optional[str] = None
    language: Optional[str] = None
    category: Optional[str] = None
    doc_type: Optional[str] = None
    access_level: Optional[str] = None
    custom_metadata: Optional[Dict[str, Any]] = None
    product_id: Optional[str] = None
    deployment_type: Optional[str] = None


class RenameRequest(BaseModel):
    new_name: str


class TagsRequest(BaseModel):
    tags: List[str]


class BulkDeleteRequest(BaseModel):
    document_ids: List[str]


class BulkUpdateRequest(BaseModel):
    document_ids: List[str]
    product_id: Optional[str] = None
    deployment_type: Optional[str] = None


@router.get("/")
async def read_documents(
    doc_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get all documents for current user with metadata from SQL database."""
    try:
        query = select(Document).where(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc())
        
        if doc_type:
            query = query.where(Document.doc_type == doc_type)

        result_set = await db.execute(query)
        docs = result_set.scalars().all()

        result = []
        for doc in docs:
            result.append(
                {
                    "id": doc.id,
                    "name": doc.name,
                    "path": doc.location,
                    "size": doc.size or 0,
                    "last_modified": (doc.uploaded_at.timestamp() * 1000)
                    if doc.uploaded_at
                    else 0,
                    "file_type": doc.type,
                    "source": doc.source or "local",
                    "status": str(doc.extraction_status.value)
                    if hasattr(doc.extraction_status, "value")
                    else str(doc.extraction_status),
                    "doc_type": doc.doc_type,
                    "product_id": doc.product_id,
                    "deployment_type": doc.deployment_type,
                }
            )

        return result
    except Exception as e:
        logger.error("Failed to get documents", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")


@router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("vault"),
    product_id: str = Form(None),
    deployment_type: str = Form(None),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Upload and process a document."""
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

        # Generate safe filename and ID
        file_id = str(uuid.uuid4())
        file_ext = file.filename.split(".")[-1] if "." in file.filename else ""
        safe_filename = f"{file_id}.{file_ext}" if file_ext else file_id
        file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

        # 1. Create SQL record first
        new_doc = Document(
            id=file_id,
            name=file.filename,
            type=file_ext,
            location=file_path,
            size=file.size,
            user_id=current_user.id,
            doc_type=doc_type,
            category=doc_type,
            extraction_status=ExtractionStatus.PENDING,
            uploaded_at=None,  # Will use DB default
            product_id=product_id,
            deployment_type=deployment_type,
        )
        db.add(new_doc)
        await db.commit()
        await db.refresh(new_doc)

        # 2. Save file locally
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # 3. Prepare metadata
        metadata = {
            "original_filename": file.filename,
            "doc_type": doc_type,
            "category": doc_type,
            "db_id": file_id,
            "product_id": product_id,
            "deployment_type": deployment_type,
        }

        # 4. Trigger ingestion
        if background_tasks:
            background_tasks.add_task(
                knowledge_base_manager.add_document,
                file_path=file_path,
                file_type=file_ext,
                document_id=file_id,
                metadata=metadata,
                db_session=None,
            )
        else:
            await knowledge_base_manager.add_document(
                file_path=file_path,
                file_type=file_ext,
                document_id=file_id,
                metadata=metadata,
                db_session=db,
            )

        return {
            "id": file_id,
            "filename": file.filename,
            "status": "success",
            "message": "Upload successful, processing started in background",
        }

    except Exception as e:
        await db.rollback()
        logger.error("File upload failed", error=str(e), user_id=current_user.id)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload-multiple")
async def upload_multiple(
    files: List[UploadFile] = File(...),
    doc_type: str = Form("vault"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Upload and process multiple documents."""
    results = []
    for file in files:
        try:
            res = await upload_document(
                file=file, doc_type=doc_type, db=db, current_user=current_user
            )
            results.append(res)
        except Exception as e:
            results.append(
                {"filename": file.filename, "status": "failed", "error": str(e)}
            )

    return {"status": "completed", "results": results}


@router.delete("/{document_id}/")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Delete a document from all storage layers."""
    try:
        logger.info(f"Deleting document: {document_id}")

        # Find the record in SQL Database
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc_record = result.scalar_one_or_none()

        if not doc_record:
            raise HTTPException(status_code=404, detail="Document not found")

        # Verify ownership
        if doc_record.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this document")

        # Delete from vector store
        await knowledge_base_manager.delete_document(document_id)

        # Delete file from disk
        if os.path.exists(doc_record.location):
            os.unlink(doc_record.location)
            logger.info(f"Deleted file: {doc_record.location}")

        # Delete SQL record
        await db.delete(doc_record)
        await db.commit()

        logger.info(f"Successfully deleted document: {document_id}")
        return {"status": "success", "message": f"Document {document_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Delete failed for document {document_id}: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.post("/bulk/delete/")
async def delete_bulk(
    request: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Delete multiple documents at once."""
    results = []
    for doc_id in request.document_ids:
        try:
            # Verify ownership first
            result = await db.execute(select(Document).filter(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc or doc.user_id != current_user.id:
                results.append({"id": doc_id, "status": "error", "message": "Not found or unauthorized"})
                continue

            res = await delete_document(document_id=doc_id, db=db, current_user=current_user)
            results.append({"id": doc_id, "status": res.get("status", "unknown")})
        except Exception as e:
            logger.error(f"Error in individual delete for {doc_id}: {e}")
            results.append({"id": doc_id, "status": "error", "message": str(e)})

    return {"status": "completed", "results": results}


@router.post("/bulk/update/")
async def update_bulk(
    request: BulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Update multiple documents at once."""
    try:
        # Verify all documents belong to current user
        result = await db.execute(
            select(Document).filter(
                Document.id.in_(request.document_ids),
                Document.user_id == current_user.id
            )
        )
        docs = result.scalars().all()
        
        if len(docs) != len(request.document_ids):
            raise HTTPException(status_code=403, detail="Not authorized to update all requested documents")

        # Prepare update data
        update_data = {}
        if request.product_id is not None:
            update_data["product_id"] = (
                request.product_id if request.product_id != "" else None
            )

        if request.deployment_type is not None:
            update_data["deployment_type"] = (
                request.deployment_type if request.deployment_type != "" else None
            )

        if not update_data:
            return {"status": "skipped", "message": "No fields to update provided"}

        # Perform bulk update
        stmt = (
            update(Document)
            .where(Document.id.in_(request.document_ids))
            .values(**update_data)
        )

        result = await db.execute(stmt)
        await db.commit()

        logger.info(f"Bulk update affected {result.rowcount} rows")

        # Re-vectorize affected documents
        if result.rowcount > 0:
            stmt_fetch = select(Document).where(Document.id.in_(request.document_ids))
            docs_result = await db.execute(stmt_fetch)
            updated_docs = docs_result.scalars().all()

            revectorization_tasks = []
            for doc in updated_docs:
                new_meta = {
                    "product_id": doc.product_id,
                    "deployment_type": doc.deployment_type,
                }

                task = knowledge_base_manager.revectorize_document(
                    document_id=doc.id,
                    file_path=doc.location,
                    file_type=doc.type,
                    metadata=new_meta,
                    chunk_count=doc.chunk_count,
                    db_session=None,
                )
                revectorization_tasks.append(task)

            if revectorization_tasks:
                await asyncio.gather(*revectorization_tasks)
                logger.info("Re-vectorization completed for bulk-updated documents")

        return {
            "status": "completed",
            "updated_count": result.rowcount,
            "message": f"Successfully updated and re-indexed {result.rowcount} documents",
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Bulk update failed: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/{document_id}/details/")
async def get_document_details(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get detailed document information including metadata."""
    try:
        metadata_service = get_metadata_service(db)
        doc_metadata = await metadata_service.get_document_metadata(document_id)

        if not doc_metadata:
            raise HTTPException(status_code=404, detail="Document not found")

        # Verify ownership
        if doc_metadata.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this document")

        # Also get file system info
        file_path = doc_metadata.get("location")
        if file_path and os.path.exists(file_path):
            stats = os.stat(file_path)
            doc_metadata["size"] = stats.st_size
            doc_metadata["last_modified"] = stats.st_mtime * 1000

        return doc_metadata

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get document details", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get document details: {str(e)}")


@router.put("/{document_id}/metadata/")
async def update_document_metadata(
    document_id: str,
    metadata: MetadataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Update document metadata."""
    try:
        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this document")

        metadata_service = get_metadata_service(db)
        metadata_dict = metadata.dict(exclude_none=True)

        success = await metadata_service.update_document_metadata(
            document_id, metadata_dict
        )

        if not success:
            raise HTTPException(status_code=404, detail="Document not found")

        # Re-vectorize if needed
        if "product_id" in metadata_dict or "deployment_type" in metadata_dict:
            try:
                doc = result.scalar_one_or_none()  # Refresh
                if doc:
                    new_meta = {
                        "product_id": doc.product_id,
                        "deployment_type": doc.deployment_type,
                        "doc_type": doc.doc_type,
                        "category": doc.category,
                        "original_filename": doc.name,
                    }

                    await knowledge_base_manager.revectorize_document(
                        document_id=doc.id,
                        file_path=doc.location,
                        file_type=doc.type,
                        metadata=new_meta,
                        db_session=None,
                    )
            except Exception as e:
                logger.warning(f"Re-vectorization warning: {e}")

        return {"status": "success", "message": "Metadata updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update metadata", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {str(e)}")


@router.put("/{document_id}/rename/")
async def rename_document(
    document_id: str,
    request: RenameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Rename a document."""
    try:
        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to rename this document")

        metadata_service = get_metadata_service(db)
        success = await metadata_service.update_document_metadata(
            document_id, {"name": request.new_name}
        )

        if not success:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "status": "success",
            "message": "Document renamed successfully",
            "new_name": request.new_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to rename document", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to rename document: {str(e)}")


@router.post("/{document_id}/tags/")
async def add_document_tags(
    document_id: str,
    request: TagsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Add tags to a document."""
    try:
        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to tag this document")

        metadata_service = get_metadata_service(db)
        success = await metadata_service.add_tags(document_id, request.tags)

        if not success:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "status": "success",
            "message": "Tags added successfully",
            "tags": request.tags,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add tags", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to add tags: {str(e)}")


@router.delete("/{document_id}/tags/")
async def remove_document_tags(
    document_id: str,
    request: TagsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Remove tags from a document."""
    try:
        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this document")

        metadata_service = get_metadata_service(db)
        success = await metadata_service.remove_tags(document_id, request.tags)

        if not success:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "status": "success",
            "message": "Tags removed successfully",
            "tags": request.tags,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to remove tags", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to remove tags: {str(e)}")


@router.get("/{document_id}/extraction-flow/")
async def get_extraction_flow(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get extraction flow status and logs."""
    try:
        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this document")

        metadata_service = get_metadata_service(db)
        logs = await metadata_service.get_extraction_logs(document_id)

        if "error" in logs and logs["error"] == "Document not found":
            raise HTTPException(status_code=404, detail="Document not found")

        return logs

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get extraction flow", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get extraction flow: {str(e)}")


@router.get("/{document_id}/indexed-stats/")
async def get_indexed_stats(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get indexed data statistics for a document."""
    try:
        # Verify ownership
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this document")

        metadata_service = get_metadata_service(db)
        stats = await metadata_service.get_chunk_statistics(document_id)

        if "error" in stats:
            raise HTTPException(status_code=404, detail="Document not found")

        return stats

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get indexed stats", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get indexed stats: {str(e)}")


@router.get("/tags/all/")
async def get_all_tags(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get all unique tags across user's documents."""
    try:
        metadata_service = get_metadata_service(db)
        tags = await metadata_service.get_all_tags(user_id=current_user.id)
        return {"tags": tags}

    except Exception as e:
        logger.error("Failed to get tags", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get tags: {str(e)}")


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Download the document file."""
    from fastapi.responses import FileResponse

    try:
        # Verify ownership and find file
        result = await db.execute(select(Document).filter(Document.id == document_id))
        doc_record = result.scalar_one_or_none()

        if not doc_record:
            raise HTTPException(status_code=404, detail="File not found")

        if doc_record.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to download this file")

        file_path = doc_record.location
        filename = doc_record.name

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")

        # Determine media type
        media_type = "application/octet-stream"
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext == "pdf":
            media_type = "application/pdf"
        elif ext in ["jpg", "jpeg"]:
            media_type = "image/jpeg"
        elif ext == "png":
            media_type = "image/png"
        elif ext == "txt":
            media_type = "text/plain"

        return FileResponse(file_path, media_type=media_type, filename=filename)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Download failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
