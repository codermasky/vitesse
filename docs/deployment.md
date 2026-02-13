# Vitesse AI - Deployment Guide

## Overview

This guide covers deploying Vitesse AI in three scenarios:

1. **Local Development** - Docker Compose on your machine
2. **VPS Deployment** - Docker with Traefik on a Linux VPS
3. **Cloud Deployment** - EKS/ECS on AWS

---

## 1. Local Development Setup

### Prerequisites
- Docker Desktop (Mac/Windows) or Docker Engine (Linux)
- Docker Compose 2.0+
- Python 3.12+
- PostgreSQL 15+

### Quick Start

```bash
# Clone and navigate
cd /Users/sujitm/Sandbox/vitesse

# Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Start all services
docker-compose up -d

# Verify services
docker-compose ps

# Create database schema
docker-compose exec backend uv run python -m app.db.init_db

# Access services
# Frontend: http://localhost:8080
# API Docs: http://localhost:8003/docs
# Database: localhost:5435
```

### Development Workflow

```bash
# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend uv run alembic upgrade head

# Create test integration
curl -X POST http://localhost:8003/api/v1/vitesse/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "source_api_url": "https://petstore.swagger.io/v2/swagger.json",
    "source_api_name": "Petstore",
    "dest_api_url": "https://jsonplaceholder.typicode.com/todo",
    "dest_api_name": "JSONPlaceholder",
    "user_intent": "Sync pets to todos"
  }'
```

---

## 2. VPS Deployment (Docker + Traefik)

### Architecture

```
Internet
    ↓
[Traefik Reverse Proxy] :80, :443
    ↓
┌─────────────────────────────┐
│  Docker Network             │
│                             │
│  ┌───────────────────────┐  │
│  │  Vitesse API          │  │
│  │  Port: 8000           │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Integration #1       │  │
│  │  Port: 8001           │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Integration #N       │  │
│  │  Port: 800N           │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
    ↓
  PostgreSQL
```

### Prerequisites

- Ubuntu 22.04 LTS or similar
- Docker Engine 20.10+
- Traefik 2.0+
- At least 4GB RAM, 2 vCPU
- Public IP and domain name
- Firewall rules: allow 80, 443, 22

### Installation Steps

#### Step 1: Set up server

```bash
# SSH into your VPS
ssh ubuntu@your.vps.ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Allow Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

#### Step 2: Clone Vitesse

```bash
cd /opt
sudo git clone https://github.com/your-org/vitesse.git
sudo chown -R ubuntu:ubuntu vitesse
cd vitesse
```

#### Step 3: Configure Traefik

Create `traefik/traefik.yml`:

```yaml
api:
  insecure: false
  dashboard: true
  debug: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entrypoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      caServer: https://acme-v02.api.letsencrypt.org/directory
      email: admin@example.com
      storage: ./acme.json
      httpChallenge:
        entrypoint: web

providers:
  docker:
    endpoint: unix:///var/run/docker.sock
    exposedbydefault: false
  file:
    filename: ./traefik/dynamic.yml
    watch: true

log:
  level: INFO
  filePath: ./logs/traefik.log

accessLog:
  filePath: ./logs/access.log
```

Create `traefik/dynamic.yml`:

```yaml
http:
  routers:
    vitesse-api:
      rule: "Host(`api.your-domain.com`)"
      service: vitesse-backend
      tls:
        certResolver: letsencrypt

  services:
    vitesse-backend:
      loadBalancer:
        servers:
          - url: http://backend:8000
```

#### Step 4: Update docker-compose.yml

Create production override: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./traefik:/traefik
    command:
      - "--configFile=/traefik/traefik.yml"
    networks:
      - vitesse-net

  backend:
    environment:
      - POSTGRES_SERVER=db
      - POSTGRES_DB=vitesse_prod
      - SECRET_KEY=${SECRET_KEY}
      - ENVIRONMENT=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vitesse-api.rule=Host(`api.your-domain.com`)"
      - "traefik.http.routers.vitesse-api.entrypoints=websecure"
      - "traefik.http.routers.vitesse-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.vitesse-api.loadbalancer.server.port=8000"
    depends_on:
      db:
        condition: service_healthy

  db:
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vitesse"]
      interval: 5s
      timeout: 5s
      retries: 5

networks:
  vitesse-net:
    driver: bridge

volumes:
  postgres_prod_data:
```

#### Step 5: Start services

```bash
# Create environment file
cat > .env.production << EOF
SECRET_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)
POSTGRES_USER=vitesse
POSTGRES_DB=vitesse_prod
POSTGRES_PASSWORD=${DB_PASSWORD}
EOF

# Start with production compose
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f backend

# Create database
docker-compose exec backend uv run python -m app.db.init_db

# Verify
curl https://api.your-domain.com/health
```

### Scaling Integrations

Each integration runs in its own container:

```bash
# Deploy a new integration
curl -X POST https://api.your-domain.com/api/v1/vitesse/integrations \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "source_api_url": "...",
    "source_api_name": "...",
    ...
  }'

# Traefik automatically routes:
# vitesse-integ_abc123.your-domain.com → integration container
```

---

## 3. Cloud Deployment (AWS EKS)

### Architecture

```
Internet
    ↓
     [AWS Route53] (DNS)
    ↓
[AWS Application Load Balancer]
    ↓
[AWS EKS Cluster]
    ├─ namespace: vitesse-prod
    ├─ vitesse-api deployment (3 replicas)
    ├─ vitesse-integration-1 deployment (2 replicas)
    ├─ vitesse-integration-N deployment (2 replicas)
    └─ PostgreSQL RDS instance
```

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI v2 configured
- kubectl 1.27+
- Helm 3.0+ (optional, for advanced deployments)
- eksctl (AWS EKS CLI)

### Installation Steps

#### Step 1: Create EKS Cluster

```bash
# Install tools
brew install awscli eksctl kubectl

# Configure AWS credentials
aws configure

# Create cluster (this takes ~15 minutes)
eksctl create cluster \
  --name vitesse-prod \
  --region us-east-1 \
  --nodegroup-name vitesse-nodes \
  --nodes 3 \
  --node-type t3.medium \
  --with-oidc \
  --enable-ssm

# Update kubeconfig
aws eks update-kubeconfig \
  --region us-east-1 \
  --name vitesse-prod

# Verify
kubectl get nodes
```

#### Step 2: Create RDS PostgreSQL

```bash
# Set variables
CLUSTER_NAME="vitesse-prod"
DB_INSTANCE="vitesse-db"
REGION="us-east-1"

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier $DB_INSTANCE \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username vitesse \
  --master-user-password $(openssl rand -hex 16) \
  --allocated-storage 100 \
  --storage-type gp3 \
  --multi-az \
  --region $REGION \
  --backup-retention-period 30

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier $DB_INSTANCE \
  --query 'DBInstances[0].Endpoint.Address'
```

#### Step 3: Set up ECR (Container Registry)

```bash
# Create ECR repositories
aws ecr create-repository \
  --repository-name vitesse/backend \
  --region us-east-1

aws ecr create-repository \
  --repository-name vitesse/integration-runtime \
  --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend image
cd backend
docker build -t vitesse/backend:latest .
docker tag vitesse/backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/vitesse/backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/vitesse/backend:latest
```

#### Step 4: Deploy to EKS

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vitesse-prod
```

Create `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: vitesse-secrets
  namespace: vitesse-prod
type: Opaque
stringData:
  SECRET_KEY: <generated-secret>
  POSTGRES_PASSWORD: <db-password>
  POSTGRES_SERVER: vitesse-db.123456.us-east-1.rds.amazonaws.com
```

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vitesse-api
  namespace: vitesse-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vitesse-api
  template:
    metadata:
      labels:
        app: vitesse-api
    spec:
      serviceAccountName: vitesse-sa
      containers:
      - name: api
        image: 123456789.dkr.ecr.us-east-1.amazonaws.com/vitesse/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: POSTGRES_SERVER
          valueFrom:
            secretKeyRef:
              name: vitesse-secrets
              key: POSTGRES_SERVER
        - name: POSTGRES_USER
          value: vitesse
        - name: POSTGRES_DB
          value: vitesse_prod
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: vitesse-secrets
              key: SECRET_KEY
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: vitesse-api
  namespace: vitesse-prod
spec:
  type: LoadBalancer
  selector:
    app: vitesse-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
```

Deploy:

```bash
# Create namespace and secrets
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml

# Verify
kubectl get pods -n vitesse-prod
kubectl get svc -n vitesse-prod

# Get load balancer URL
kubectl get svc vitesse-api -n vitesse-prod \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

#### Step 5: Configure DNS

```bash
# Get load balancer hostname
LB_HOSTNAME=$(kubectl get svc vitesse-api -n vitesse-prod \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# In Route53, create CNAME record:
# api.your-domain.com → $LB_HOSTNAME
```

### Auto-Scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vitesse-api-hpa
  namespace: vitesse-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vitesse-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Monitoring & Observability

### Application Metrics

```bash
# Check Langfuse integration
curl https://api.your-domain.com/api/v1/system/langfuse-status

# View health scores
curl https://api.your-domain.com/api/v1/vitesse/status
```

### Logs

**Local Development**:
```bash
docker-compose logs -f backend
```

**VPS with Traefik**:
```bash
tail -f logs/traefik.log
tail -f logs/access.log
```

**EKS**:
```bash
kubectl logs -n vitesse-prod deployment/vitesse-api -f
kubectl logs -n vitesse-prod deployment/vitesse-integration-1 -f
```

### Alerting

Set up alerts for:
- Integration health score < 70
- Sync failure rate > 5%
- API response time p95 > 2s
- Database connection errors

---

## Backup & Recovery

### Database Backups

```bash
# Local dev
docker-compose exec db pg_dump -U vitesse vitesse_dev > backup.sql

# Restore
docker-compose exec db psql -U vitesse vitesse_dev < backup.sql

# AWS RDS
aws rds create-db-snapshot \
  --db-instance-identifier vitesse-db \
  --db-snapshot-identifier vitesse-db-snapshot-$(date +%Y%m%d)
```

---

## Troubleshooting

### API not responding

```bash
# Check services
docker-compose ps
kubectl get pods -n vitesse-prod

# Check logs
docker-compose logs backend
kubectl logs vitesse-api -n vitesse-prod

# Check database connectivity
docker-compose exec backend python -c "from app.db.session import engine; print(engine.execute('SELECT 1'))"
```

### Traefik returning 404

- Verify labels in docker-compose (for Traefik provider)
- Check Traefik dashboard: http://traefik.local:8080

### High memory usage

- Reduce BATCH_SIZE environment variable
- Implement periodic container restarts
- Add memory limits in docker-compose/k8s

---

## Security Checklist

- [ ] Secrets stored in environment variables, not code
- [ ] Database has SSL/TLS enabled
- [ ] API behind HTTPS (Let's Encrypt)
- [ ] CORS origins whitelist configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Regular security updates scheduled
- [ ] VPS firewall allows only necessary ports

---

## Performance Tuning

```bash
# Optimize PostgreSQL connection pool
SQLALCHEMY_POOL_SIZE=20
SQLALCHEMY_MAX_OVERFLOW=40

# Increase integration batch size
BATCH_SIZE=500

# Adjust sync interval
SYNC_INTERVAL_SECONDS=7200

# Enable caching
CACHE_ENABLED=true
CACHE_TTL=3600
```

---

## Next Steps

1. Test a local integration (use Petstore API)
2. Deploy to VPS with Traefik
3. Set up monitoring and alerting
4. Create your first production integration
5. Monitor health scores and optimize

---

## Support

For issues or questions:
- Check [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- Review logs for detailed error messages
- Contact the Vitesse development team
