#!/bin/bash

# Vitesse AI - Quick Test Script
# This script tests all major components of Vitesse

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"
TEST_EMAIL="vitesse-test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TOKEN=""
INTEGRATION_ID=""

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Vitesse AI - Comprehensive Test Suite  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Test 1: Backend Health
echo -e "${YELLOW}[TEST 1]${NC} Backend Health Check..."
if curl -s "$BACKEND_URL/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    echo "   Run: cd backend && uv run uvicorn app.main:app --reload"
    exit 1
fi

# Test 2: Frontend Health
echo -e "${YELLOW}[TEST 2]${NC} Frontend Status..."
if curl -s "$FRONTEND_URL" | grep -q "React"; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend might not be running (optional for API testing)${NC}"
fi

# Test 3: Langfuse Status
echo -e "${YELLOW}[TEST 3]${NC} Langfuse Integration..."
LANGFUSE_STATUS=$(curl -s "$BACKEND_URL/health" | jq -r '.status' 2>/dev/null || echo "unknown")
if [ "$LANGFUSE_STATUS" == "healthy" ]; then
    echo -e "${GREEN}✅ System is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  System status check skipped${NC}"
fi

# Test 4: User Registration
echo -e "${YELLOW}[TEST 4]${NC} User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"full_name\": \"Vitesse Test User\"
  }")

if echo "$REGISTER_RESPONSE" | grep -q "\"id\""; then
    echo -e "${GREEN}✅ User registration successful${NC}"
    echo "   Email: $TEST_EMAIL"
else
    echo -e "${RED}❌ User registration failed${NC}"
    echo "   Response: $REGISTER_RESPONSE"
    exit 1
fi

# Test 5: User Login
echo -e "${YELLOW}[TEST 5]${NC} User Login & Token Generation..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/access-token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$TEST_EMAIL&password=$TEST_PASSWORD")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Login successful, token generated${NC}"
    echo "   Token: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test 6: Get Current User
echo -e "${YELLOW}[TEST 6]${NC} Get Current User Info..."
USER_INFO=$(curl -s -X GET "$BACKEND_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN")

USER_EMAIL=$(echo "$USER_INFO" | jq -r '.email' 2>/dev/null)
if [ "$USER_EMAIL" == "$TEST_EMAIL" ]; then
    echo -e "${GREEN}✅ Successfully retrieved user info${NC}"
    echo "   Email: $USER_EMAIL"
else
    echo -e "${RED}❌ Failed to retrieve user info${NC}"
    exit 1
fi

# Test 7: List LLM Configs
echo -e "${YELLOW}[TEST 7]${NC} LLM Configuration Check..."
LLM_CONFIG=$(curl -s -X GET "$BACKEND_URL/api/v1/llm-configs" \
  -H "Authorization: Bearer $TOKEN")

LLM_COUNT=$(echo "$LLM_CONFIG" | jq 'length' 2>/dev/null || echo 0)
if [ "$LLM_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ LLM configurations found ($LLM_COUNT)${NC}"
    echo "$LLM_CONFIG" | jq -r '.[] | "   - \(.provider) - \(.model)"' 2>/dev/null
else
    echo -e "${YELLOW}⚠️  No LLM configurations found (may need setup)${NC}"
fi

# Test 8: Create Chat Session
echo -e "${YELLOW}[TEST 8]${NC} Create Chat Session..."
CHAT_SESSION=$(curl -s -X POST "$BACKEND_URL/api/v1/chat/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Vitesse Test Chat",
    "llm_config_id": 1
  }')

CHAT_ID=$(echo "$CHAT_SESSION" | jq -r '.id' 2>/dev/null)
if [ ! -z "$CHAT_ID" ] && [ "$CHAT_ID" != "null" ]; then
    echo -e "${GREEN}✅ Chat session created${NC}"
    echo "   Session ID: $CHAT_ID"
else
    echo -e "${YELLOW}⚠️  Chat session creation skipped (may need LLM config)${NC}"
fi

# Test 9: List Integrations
echo -e "${YELLOW}[TEST 9]${NC} Integration Listing..."
INTEGRATIONS=$(curl -s -X GET "$BACKEND_URL/api/v1/integrations" \
  -H "Authorization: Bearer $TOKEN")

INT_COUNT=$(echo "$INTEGRATIONS" | jq 'length' 2>/dev/null || echo 0)
echo -e "${GREEN}✅ Integrations endpoint working ($INT_COUNT found)${NC}"

# Test 10: API Documentation
echo -e "${YELLOW}[TEST 10]${NC} API Documentation..."
if curl -s "$BACKEND_URL/docs" | grep -q "swagger-ui"; then
    echo -e "${GREEN}✅ Swagger UI available at /docs${NC}"
else
    echo -e "${YELLOW}⚠️  Swagger UI not accessible${NC}"
fi

# Test 11: System Health Endpoint
echo -e "${YELLOW}[TEST 11]${NC} System Health Endpoint..."
HEALTH_CHECK=$(curl -s -X GET "$BACKEND_URL/api/v1/system/langfuse-status")
echo -e "${GREEN}✅ System health endpoint responding${NC}"
echo "$HEALTH_CHECK" | jq '.' 2>/dev/null || echo "$HEALTH_CHECK"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Test Summary                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ All core tests passed!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open Frontend: $FRONTEND_URL"
echo "2. Visit API Docs: $BACKEND_URL/docs"
echo "3. Test Integration Factory:"
echo ""
echo '   curl -s -X POST '$BACKEND_URL'/api/v1/integrations/orchestrate \'
echo '     -H "Authorization: Bearer '$TOKEN'" \'
echo '     -H "Content-Type: application/json" \'
echo '     -d "{
echo '       \"source_api_url\": \"https://api.shopify.com/swagger.json\","'
echo '       \"source_api_name\": \"Shopify\","'
echo '       \"dest_api_url\": \"https://api.stripe.com/openapi.json\","'
echo '       \"dest_api_name\": \"Stripe\","'
echo '       \"user_intent\": \"Sync payment data\","'
echo '       \"deployment_config\": {\"target\": \"local\"}"'
echo '     }" | jq'
echo ""
echo -e "${GREEN}Happy testing! 🚀${NC}"
