from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Any, Optional
from app.api import deps
from app.services.knowledge_base import knowledge_base_manager

router = APIRouter()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: Any = Depends(deps.get_current_user),
):
    """Generic document upload endpoint."""
    return await knowledge_base_manager.upload(file, current_user.id)


@router.get("/")
async def list_documents(current_user: Any = Depends(deps.get_current_user)):
    """List documents in knowledge base."""
    return await knowledge_base_manager.list_all(current_user.id)
