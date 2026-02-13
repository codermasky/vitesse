from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any, Dict
from app.api import deps

router = APIRouter()


@router.get("/status")
async def get_system_status():
    return {"status": "healthy", "version": "0.1.0"}


@router.get("/products")
async def get_products():
    """Return generic product categories."""
    return ["AgentStack Core", "AgentStack Professional", "AgentStack Enterprise"]


@router.get("/azure-ad/config")
async def get_azure_ad_config():
    return {"enabled": False, "tenant_id": None}


@router.get("/feature-flags")
async def get_feature_flags():
    return {"enable_vision": True, "enable_rag": True, "enable_multi_agent": True}


@router.get("/whitelabel")
async def get_whitelabel_config():
    from app.services.settings_service import settings_service

    return settings_service.get_whitelabel_config()


@router.post("/whitelabel")
async def update_whitelabel_config(config: Dict[str, Any]):
    from app.services.settings_service import settings_service

    return settings_service.update_whitelabel_config(config)
