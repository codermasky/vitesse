#!/bin/bash
set -e

echo "Verifying Vitesse..."

echo "Checking Backend Dependencies..."
cd backend
# Check if key files exist
if [ ! -f "app/core/config.py" ]; then
    echo "Error: app/core/config.py missing"
    exit 1
fi
if [ ! -f "app/services/llm_provider.py" ]; then
    echo "Error: app/services/llm_provider.py missing"
    exit 1
fi
# Try to import main app (basic check)
uv run python -c "from app.main import app; print('Backend import successful')" || { echo "Backend import failed"; exit 1; }
cd ..

echo "Checking Frontend Build..."
cd frontend
npm run build || { echo "Frontend build failed"; exit 1; }
cd ..

echo "AgentStack Verification Complete!"
