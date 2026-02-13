from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.api import deps

router = APIRouter()


@router.get("/config")
async def get_sharepoint_config():
    return {"enabled": False, "site_url": None, "tenant_id": None}


@router.get("/status")
async def get_sharepoint_status():
    return {"connected": False, "message": "SharePoint integration not configured"}
