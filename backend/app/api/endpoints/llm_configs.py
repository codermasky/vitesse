from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.llm_config_service import llm_config_service

router = APIRouter()


@router.get("/")
async def get_llm_settings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_user),
):
    """Get all LLM providers and agent mappings."""
    return await llm_config_service.get_all_settings(db)


@router.post("/providers")
async def create_provider(
    config: Dict[str, Any],
    db: AsyncSession = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_user),
):
    return await llm_config_service.upsert_provider(db, config)


@router.put("/providers/{provider_id}")
async def update_provider(
    provider_id: str,
    update: Dict[str, Any],
    db: AsyncSession = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_user),
):
    return await llm_config_service.update_provider_partial(db, provider_id, update)


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_user),
):
    return await llm_config_service.delete_provider(db, provider_id)


@router.post("/mappings")
async def update_mapping(
    mapping: Dict[str, Any],
    db: AsyncSession = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_user),
):
    return await llm_config_service.upsert_mapping(db, mapping)


@router.get("/vision-enabled")
async def get_vision_status():
    return {"enabled": True}


@router.get("/devils-advocate-enabled")
async def get_devils_advocate_status():
    return {"enabled": False}
