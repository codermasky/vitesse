#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Redeployment Sequence...${NC}"

# 1. Stop existing containers
echo -e "${YELLOW}Stopping containers...${NC}"
docker-compose down

# 2. Rebuild containers
echo -e "${YELLOW}Rebuilding containers...${NC}"
docker-compose build backend
# docker-compose build frontend # Optional if frontend code changed, uncomment if needed

# 3. Start database first
echo -e "${YELLOW}Starting database...${NC}"
docker-compose up -d db
echo "Waiting for DB to be healthy..."
until docker-compose exec -T db pg_isready -U vitesse; do
  echo "Waiting for postgres..."
  sleep 2
done

# 4. Run Migrations & Seeds inside backend container (ephemeral)
echo -e "${YELLOW}Running Migrations & Seeds...${NC}"
docker-compose run --rm backend bash -c "
    set -e
    echo 'Running migrations (alembic upgrade head)...'
    alembic upgrade head
    
    # Optional: Check for drift
    # echo 'Checking for schema drift...'
    # alembic revision --autogenerate -m 'schema_sync' || true
    # alembic upgrade head

    echo 'Seeding Data...'
    python -m app.db.llm_seed
"

# 5. Restart Full Stack
echo -e "${YELLOW}Starting full stack...${NC}"
docker-compose up -d

# 6. Show status
echo -e "${GREEN}Redeployment Complete!${NC}"
docker-compose ps
