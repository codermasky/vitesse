from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any
from app.api import deps
from app.services.queue_service import queue_service

router = APIRouter()


@router.get("/{request_id}")
async def get_status(
    request_id: str, current_user: Any = Depends(deps.get_current_user)
):
    """Get status of a background task."""
    return await queue_service.get_status(request_id)
