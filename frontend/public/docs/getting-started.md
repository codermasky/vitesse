# Getting Started with Vitesse AI

Welcome to **Vitesse AI**, a professional-grade platform for API discovery, field mapping, and automated integration deployment. This guide will walk you through the initial setup and basic usage.

## 📋 Prerequisites

- **Python**: 3.12 or higher
- **Node.js**: 20.x or higher
- **Docker**: For containerized deployment
- **uv**: Recommended for Python package management

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd vitesse
```

### 2. Backend Setup
We use `uv` for lightning-fast dependency management.
```bash
cd backend
uv sync
# Initialize the database with seed data
uv run python -m app.db.init_db
# Start the development server
uv run uvicorn app.main:app --reload
```
The backend will be available at `http://localhost:8000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
# Start the Vite development server
npm run dev
```
The frontend will be available at `http://localhost:5173`.

## 🐳 Docker Deployment

For a production-like environment, use Docker Compose:
```bash
docker compose up -d --build
```
This will start the backend, frontend, and a PostgreSQL database.

## 🛠️ First Steps

1. **Login**: Use the default administrator credentials (see `.env.example`).
2. **Create Integration**: Navigate to **Integrations** to discover a new API.
3. **Configure Mapping**: Set up field mappings between source and destination APIs.
4. **Test Integration**: Use the test suite to validate your integration setup.
5. **Deploy**: Push your integration to your target environment (local, EKS, or ECS).

## 🤝 Need Help?
Check out the [Features Guide](./features.md) or visit the in-app **Help Center** in the Vitesse AI UI.
