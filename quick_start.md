# Vitesse AI - Quick Start (5 Minutes)

## 🚀 Super Quick Setup

### Prerequisites Check
```bash
python3 --version    # Should be 3.12+
uv --version         # Install from https://astral.sh/uv if missing
npm --version        # Should be 14+
node --version       # Should be 18+
```

---

## Terminal 1: Start Backend

```bash
cd /Users/sujitm/Sandbox/vitesse/backend

# First time only
cp .env.example .env
# Edit .env: Set SECRET_KEY, OPENAI_API_KEY, DATABASE_URL

# Install & run
uv sync
uv run uvicorn app.main:app --reload
```

✅ Backend ready at: **http://localhost:8000**  
📚 Swagger UI: **http://localhost:8000/docs**

---

## Terminal 2: Start Frontend

```bash
cd /Users/sujitm/Sandbox/vitesse/frontend

# First time only
npm install

# Run
npm run dev
```

✅ Frontend ready at: **http://localhost:5173**

---

## Terminal 3: Run Tests

```bash
cd /Users/sujitm/Sandbox/vitesse

# Make executable if needed
chmod +x test_vitesse.sh

# Run comprehensive tests
./test_vitesse.sh
```

---

## 🧪 Manual Quick Test

```bash
# 1. Register user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "full_name": "Test User"
  }'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/access-token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=test@example.com&password=Test123!' | jq -r '.access_token')

echo "Token: $TOKEN"

# 3. Get user info
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Create integration (main Vitesse feature - takes 2-5 minutes)
curl -X POST http://localhost:8000/api/v1/integrations/orchestrate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_api_url": "https://api.shopify.com/swagger.json",
    "source_api_name": "Shopify",
    "dest_api_url": "https://api.stripe.com/openapi.json",
    "dest_api_name": "Stripe",
    "user_intent": "Sync payment transactions",
    "deployment_config": {"target": "local"}
  }' | jq
```

---

## 🎯 What You Can Test Right Now

| Feature | URL | Expected |
|---------|-----|----------|
| **Swagger UI** | http://localhost:8000/docs | API browser |
| **ReDoc** | http://localhost:8000/redoc | API documentation |
| **Frontend** | http://localhost:5173 | Login page |
| **Health** | http://localhost:8000/health | `{"status":"healthy"}` |

### New UI Features (Database-Backed)

| Feature | URL Path | Description |
|---------|----------|-------------|
| **Knowledge Harvester Dashboard** | `/harvest-jobs` | Monitor autonomous knowledge harvesting |
| **Agent Collaboration Hub** | `/agent-collaboration` | Real-time agent activity and communication |
| **Integration Builder** | `/integration-builder` | Visual integration creation and mapping |

---

## 🧬 Architecture at a Glance

```
Frontend    →  Backend    →  Database
(React)        (FastAPI)     (PostgreSQL)
:5173          :8000         

Within Backend:
┌─────────────────────────────┐
│ API Routes (auth, chat, ...) │
├─────────────────────────────┤
│ Services (LLM, chat, email) │
├─────────────────────────────┤
│ Agent Factory (4 agents)      │
│ - Ingestor (parse APIs)       │
│ - Mapper (field mapping)      │
│ - Guardian (testing)          │
│ - Orchestrator (pipeline)     │
├─────────────────────────────┤
│ Database Models               │
└─────────────────────────────┘
```

---

## 🔧 Environment Setup

### `.env` Required Variables

```env
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost/vitesse_db
```

### Optional for Full Features

```env
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...
SENTRY_DSN=https://...
SMTP_SERVER=smtp.gmail.com
```

---

## ⚡ 5-Minute Success Criteria

- [x] Backend starts without errors
- [x] Frontend loads
- [x] Can login via `/docs` 
- [x] Swagger UI shows all endpoints
- [x] Test script passes 80%+ tests

---

## 🚨 Common Issues

**Backend fails to start**
```bash
# Check Python version
python3 --version  # Must be 3.12+

# Reinstall dependencies
uv sync --upgrade
```

**Port 8000 already in use**
```bash
# Find & kill process
lsof -ti:8000 | xargs kill -9
```

**Database connection error**
```bash
# Verify environment variable
grep DATABASE_URL .env

# Test connection directly
psql "YOUR_DATABASE_URL"
```

---

## 📚 Full Documentation

- **[Complete Setup Guide](./VITESSE_COMPLETE_SETUP.md)** - Comprehensive with all tests
- **[Implementation Guide](./docs/implementation_guide.md)** - Technical deep dive
- **[Features List](./docs/features.md)** - All capabilities
- **[API Reference](./docs/api.md)** - Endpoint documentation

---

## 🎯 Main Features to Explore

1. **Authentication** - User registration, login, JWT tokens
2. **LLM Integration** - OpenAI, Anthropic, Ollama
3. **Chat Interface** - Real-time conversation with agents
4. **Knowledge Base** - Upload & search documents
5. **Integration Factory** (⭐ Main) - Orchestrate API integrations automatically
6. **Observability** - Langfuse tracing & cost tracking
7. **Admin Dashboard** - User & system management

---

**Ready?** Start with Terminal 1 above! 🚀
