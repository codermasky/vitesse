#!/bin/bash
set -e

echo "🔄 Running database migrations..."
alembic upgrade head

echo "✅ Database initialized"
echo "🚀 Starting Uvicorn..."

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
