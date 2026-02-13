"""
Dockerfile template generator for Vitesse integrations.
Generates containerized integration applications.
"""

from typing import Dict, Any
import structlog

logger = structlog.get_logger(__name__)


class DockerfileGenerator:
    """Generates Dockerfile templates for Vitesse integrations."""

    @staticmethod
    def generate_base_dockerfile(
        integration_id: str,
        python_version: str = "3.12",
        base_image: str = "python:3.12-slim",
    ) -> str:
        """
        Generate base Dockerfile for integration container.
        """
        dockerfile = f'''# Vitesse AI Integration Container
# Generated for: {integration_id}
# Base image: {base_image}

FROM {base_image}

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \\
    pip install -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 vitesse && \\
    chown -R vitesse:vitesse /app
USER vitesse

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
'''
        return dockerfile

    @staticmethod
    def generate_integration_app_template(
        integration_id: str,
        source_api_name: str,
        dest_api_name: str,
        mapping_json: str,
    ) -> str:
        """
        Generate main.py template for integration container.
        This is the runtime application that performs the integration.
        """
        main_py = f'''"""
Vitesse AI Integration: {source_api_name} → {dest_api_name}
Integration ID: {integration_id}

This is an auto-generated integration container that:
1. Pulls data from {source_api_name}
2. Transforms data according to mapping rules
3. Pushes data to {dest_api_name}
4. Monitors health and self-heals on API changes
"""

import os
import json
import asyncio
from datetime import datetime
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import httpx

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="Vitesse Integration",
    description="{source_api_name} ↔ {dest_api_name}",
    version="1.0.0",
)

# Load mapping configuration
MAPPING_CONFIG = {mapping_json}

# API Configuration
SOURCE_API_URL = os.getenv("SOURCE_API_URL", "https://api.source.com")
SOURCE_API_KEY = os.getenv("SOURCE_API_KEY", "")
DEST_API_URL = os.getenv("DEST_API_URL", "https://api.dest.com")
DEST_API_KEY = os.getenv("DEST_API_KEY", "")

# Sync configuration
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL_SECONDS", "3600"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {{
        "status": "healthy",
        "integration_id": "{integration_id}",
        "timestamp": datetime.utcnow().isoformat(),
    }}


@app.get("/status")
async def get_status():
    """Get integration status."""
    return {{
        "integration_id": "{integration_id}",
        "source_api": "{source_api_name}",
        "dest_api": "{dest_api_name}",
        "status": "active",
        "last_sync": None,
        "sync_interval_seconds": SYNC_INTERVAL,
    }}


@app.post("/sync")
async def trigger_sync():
    """Manually trigger a sync."""
    try:
        logger.info("Manual sync triggered", integration_id="{integration_id}")
        
        # Fetch from source
        source_data = await fetch_from_source()
        logger.info("Fetched from source", records=len(source_data))
        
        # Transform
        transformed_data = await transform_data(source_data)
        
        # Push to destination
        result = await push_to_destination(transformed_data)
        
        return {{
            "status": "success",
            "records_synced": len(transformed_data),
            "timestamp": datetime.utcnow().isoformat(),
        }}
    
    except Exception as e:
        logger.error("Sync failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def fetch_from_source():
    """Fetch data from source API."""
    async with httpx.AsyncClient() as client:
        headers = {{"Authorization": f"Bearer {{SOURCE_API_KEY}}"}}
        response = await client.get(f"{{SOURCE_API_URL}}/api/v1/data", headers=headers)
        response.raise_for_status()
        return response.json()


async def transform_data(source_data: list) -> list:
    """Transform data according to mapping."""
    transformed = []
    
    for record in source_data:
        transformed_record = {{}}
        
        for transformation in MAPPING_CONFIG.get("transformations", []):
            source_field = transformation["source_field"]
            dest_field = transformation["dest_field"]
            transform_type = transformation.get("transform_type", "direct")
            
            if source_field in record:
                value = record[source_field]
                
                # Apply transformation
                if transform_type == "direct":
                    transformed_record[dest_field] = value
                elif transform_type == "mapping":
                    transformed_record[dest_field] = str(value)
                elif transform_type == "custom":
                    # Apply custom transformation
                    transformed_record[dest_field] = process_custom(value, transformation)
            
            transformed.append(transformed_record)
    
    return transformed


async def push_to_destination(data: list) -> dict:
    """Push transformed data to destination API."""
    async with httpx.AsyncClient() as client:
        headers = {{
            "Authorization": f"Bearer {{DEST_API_KEY}}",
            "Content-Type": "application/json",
        }}
        
        response = await client.post(
            f"{{DEST_API_URL}}/api/v1/data",
            json={{"records": data}},
            headers=headers,
        )
        response.raise_for_status()
        return response.json()


def process_custom(value: any, transformation: dict) -> any:
    """Apply custom transformation logic."""
    # This would contain generated custom logic
    return value


async def sync_worker():
    """Background sync worker."""
    while True:
        try:
            logger.info("Running scheduled sync", integration_id="{integration_id}")
            await trigger_sync()
            await asyncio.sleep(SYNC_INTERVAL)
        except Exception as e:
            logger.error("Sync worker error", error=str(e))
            await asyncio.sleep(60)  # Retry after 1 minute


@app.on_event("startup")
async def startup_event():
    """Start background sync worker on startup."""
    asyncio.create_task(sync_worker())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
'''
        return main_py

    @staticmethod
    def generate_requirements_txt() -> str:
        """Generate requirements.txt for integration container."""
        requirements = """fastapi>=0.128.0
uvicorn>=0.40.0
httpx>=0.28.0
pydantic>=2.0
structlog>=25.0.0
python-dotenv>=1.0
"""
        return requirements

    @staticmethod
    def generate_docker_compose_override(
        integration_id: str,
        source_api_url: str,
        dest_api_url: str,
    ) -> str:
        """Generate docker-compose override for local development."""
        compose = f"""version: '3.8'

services:
  vitesse-integration-{integration_id}:
    build: ./integrations/{integration_id}
    ports:
      - "8001:8000"
    environment:
      - SOURCE_API_URL={source_api_url}
      - SOURCE_API_KEY=${{SOURCE_API_KEY}}
      - DEST_API_URL={dest_api_url}
      - DEST_API_KEY=${{DEST_API_KEY}}
      - SYNC_INTERVAL_SECONDS=3600
      - BATCH_SIZE=100
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    networks:
      - vitesse-network

networks:
  vitesse-network:
    driver: bridge
"""
        return compose

    @staticmethod
    def generate_kubernetes_manifest(
        integration_id: str,
        image_uri: str,
        replicas: int = 2,
        memory_mb: int = 512,
        cpu_cores: float = 0.5,
    ) -> str:
        """Generate Kubernetes manifests for EKS deployment."""
        manifest = f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: vitesse-{integration_id}
  namespace: vitesse
  labels:
    app: vitesse-integration
    integration: {integration_id}
spec:
  replicas: {replicas}
  selector:
    matchLabels:
      app: vitesse-integration
      integration: {integration_id}
  template:
    metadata:
      labels:
        app: vitesse-integration
        integration: {integration_id}
    spec:
      serviceAccountName: vitesse-sa
      containers:
      - name: integration
        image: {image_uri}
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: SOURCE_API_URL
          valueFrom:
            configMapKeyRef:
              name: vitesse-{integration_id}-config
              key: source_api_url
        - name: DEST_API_URL
          valueFrom:
            configMapKeyRef:
              name: vitesse-{integration_id}-config
              key: dest_api_url
        - name: SOURCE_API_KEY
          valueFrom:
            secretKeyRef:
              name: vitesse-{integration_id}-secrets
              key: source_api_key
        - name: DEST_API_KEY
          valueFrom:
            secretKeyRef:
              name: vitesse-{integration_id}-secrets
              key: dest_api_key
        resources:
          requests:
            memory: "{memory_mb}Mi"
            cpu: "{cpu_cores}"
          limits:
            memory: "{memory_mb * 2}Mi"
            cpu: "{cpu_cores * 2}"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: vitesse-{integration_id}
  namespace: vitesse
  labels:
    integration: {integration_id}
spec:
  type: ClusterIP
  selector:
    app: vitesse-integration
    integration: {integration_id}
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
    name: http
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vitesse-{integration_id}
  namespace: vitesse
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - vitesse-{integration_id}.example.com
    secretName: vitesse-{integration_id}-tls
  rules:
  - host: vitesse-{integration_id}.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vitesse-{integration_id}
            port:
              number: 80
"""
        return manifest
