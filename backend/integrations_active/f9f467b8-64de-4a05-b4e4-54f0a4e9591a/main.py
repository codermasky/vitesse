"""
Vitesse AI Integration: PetstoreSource -> PetstoreDest
Integration ID: f9f467b8-64de-4a05-b4e4-54f0a4e9591a
Generated at: 2026-02-13T07:41:10.109209 

Running mode: Standalone Process
"""

import os
import sys
import json
import time
import asyncio
import signal
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx
from fastapi import FastAPI, HTTPException
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("integration.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("vitesse_integration")

# --- Configuration ---
INTEGRATION_ID = "f9f467b8-64de-4a05-b4e4-54f0a4e9591a"
SOURCE_API_NAME = "PetstoreSource"
DEST_API_NAME = "PetstoreDest"

# API Endpoints
SOURCE_API_URL = "https://petstore.swagger.io/v2/swagger.json"
DEST_API_URL = "https://petstore.swagger.io/v2/swagger.json"

# Auth Configuration
SOURCE_AUTH = {"type": "unknown"}
DEST_AUTH = {"type": "unknown"}

# Logic Configuration
MAPPING_CONFIG = {}
SYNC_INTERVAL = 3600

# Global State
is_running = True
last_sync_time = None
total_records_synced = 0
errors_count = 0

app = FastAPI(title=f"Vitesse: {SOURCE_API_NAME} -> {DEST_API_NAME}")

# --- Helper Functions ---

async def fetch_data(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Fetch data from source API."""
    try:
        url = SOURCE_API_URL
        headers = {}
        params = {}
        
        # Handle Source Auth
        if SOURCE_AUTH.get("type") == "api_key":
            location = SOURCE_AUTH.get("in", "header")
            key_name = SOURCE_AUTH.get("name", "Authorization")
            key_value = SOURCE_AUTH.get("key", "")
            
            if location == "header":
                headers[key_name] = key_value
            elif location == "query":
                params[key_name] = key_value
                
        elif SOURCE_AUTH.get("type") == "bearer":
            token = SOURCE_AUTH.get("token", "")
            headers["Authorization"] = f"Bearer {token}"
            
        elif SOURCE_AUTH.get("type") == "basic":
            # Handled by httpx auth if needed, or manual header
            pass

        logger.info(f"Fetching data from {url}")
        response = await client.get(url, headers=headers, params=params, timeout=30.0)
        response.raise_for_status()
        
        data = response.json()
        
        # Normalize data to list
        if isinstance(data, dict):
            # Try to find the list in common keys
            for key in ["data", "items", "results", "users", "customers", "orders"]:
                if key in data and isinstance(data[key], list):
                    return data[key]
            # Helper: if dict, wrap in list
            return [data]
        elif isinstance(data, list):
            return data
            
        return []
        
    except Exception as e:
        logger.error(f"Fetch failed: {str(e)}")
        raise

async def push_data(client: httpx.AsyncClient, data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Push data to destination API."""
    if not data:
        return {"status": "skipped", "reason": "no data"}

    try:
        url = DEST_API_URL
        headers = {"Content-Type": "application/json"}
        
        # Handle Dest Auth
        if DEST_AUTH.get("type") == "api_key":
            location = DEST_AUTH.get("in", "header")
            key_name = DEST_AUTH.get("name", "Authorization")
            key_value = DEST_AUTH.get("key", "")
            
            if location == "header":
                headers[key_name] = key_value
                
        elif DEST_AUTH.get("type") == "bearer":
            token = DEST_AUTH.get("token", "")
            headers["Authorization"] = f"Bearer {token}"

        # Simple strategy: One-by-one or Bulk? 
        # For MVP, let's try pushing individual records if endpoint looks singular, or bulk if plural.
        # But safer is one-by-one loop for generic integrations.
        
        success_count = 0
        error_count = 0
        
        for record in data:
            try:
                # Naive POST
                resp = await client.post(url, json=record, headers=headers, timeout=10.0)
                # If 405 Method Not Allowed, maybe try PUT?
                # For now, just log status
                if resp.status_code in [200, 201]:
                    success_count += 1
                else:
                    error_count += 1
                    logger.warning(f"Failed to push record: {resp.status_code}")
            except Exception as inner_e:
                error_count += 1
                logger.error(f"Push error: {str(inner_e)}")
                
        return {
            "status": "completed", 
            "synced": success_count, 
            "failed": error_count
        }

    except Exception as e:
        logger.error(f"Push failed: {str(e)}")
        raise

def transform_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Apply transformation logic."""
    output = {}
    transformations = MAPPING_CONFIG.get("transformations", [])
    
    for t in transformations:
        source_field = t.get("source_field")
        dest_field = t.get("dest_field")
        transform_type = t.get("transform_type", "direct")
        
        # Get value
        val = record.get(source_field)
        
        # Apply Logic
        if transform_type == "direct":
            output[dest_field] = val
        elif transform_type == "parse":
            try:
                output[dest_field] = float(val) if val is not None else 0
            except:
                output[dest_field] = 0
        elif transform_type == "stringify":
            output[dest_field] = str(val) if val is not None else ""
        else:
            output[dest_field] = val
            
    return output

# --- Core Sync Logic ---

async def run_sync_cycle():
    """Run one full synchronization cycle."""
    global last_sync_time, total_records_synced, errors_count
    
    logger.info("Starting sync cycle")
    async with httpx.AsyncClient() as client:
        try:
            # 1. Fetch
            source_data = await fetch_data(client)
            logger.info(f"Fetched {len(source_data)} records")
            
            # 2. Transform
            transformed_data = [transform_record(r) for r in source_data]
            
            # 3. Push
            result = await push_data(client, transformed_data)
            logger.info(f"Push result: {result}")
            
            # Update Stats
            last_sync_time = datetime.utcnow().isoformat()
            total_records_synced += result.get("synced", 0)
            
        except Exception as e:
            logger.error(f"Sync cycle error: {e}")
            errors_count += 1

# --- Background Worker ---

async def data_sync_loop():
    """Continuous loop for data synchronization."""
    logger.info(f"Starting background worker. Interval: {SYNC_INTERVAL}s")
    while is_running:
        try:
            await run_sync_cycle()
        except Exception as e:
            logger.error(f"Critical worker error: {e}")
        
        # Sleep until next interval
        await asyncio.sleep(SYNC_INTERVAL)

# --- FastAPI Implementation for Control/Status ---

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(data_sync_loop())

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/status")
def status():
    return {
        "integration_id": INTEGRATION_ID,
        "active": is_running,
        "last_sync": last_sync_time,
        "total_records": total_records_synced,
        "errors": errors_count
    }

@app.post("/trigger")
async def trigger():
    """Manually trigger immediate sync."""
    asyncio.create_task(run_sync_cycle())
    return {"status": "triggered"}

if __name__ == "__main__":
    # Determine port based on env or default (could be dynamic)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port)
