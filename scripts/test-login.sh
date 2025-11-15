#!/bin/bash

# Test Login API Script
# This script tests the login API endpoint with various scenarios

echo "🧪 Testing WOMS Login API"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (change if your server runs on different port)
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Using base URL: $BASE_URL"
echo ""

# Test 1: Valid login - Super Admin
echo -e "${YELLOW}Test 1: Valid login (Super Admin)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 2: Valid login - Government
echo -e "${YELLOW}Test 2: Valid login (Government)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"govt@woms.com","password":"govt123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Valid login - Organization
echo -e "${YELLOW}Test 3: Valid login (Organization)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"org1@woms.com","password":"org1123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 4: Wrong password
echo -e "${YELLOW}Test 4: Wrong password (should fail)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"wrongpassword"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE - Correctly rejected)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (Expected 401, got $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 5: Non-existent email
echo -e "${YELLOW}Test 5: Non-existent email (should fail)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@woms.com","password":"admin123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE - Correctly rejected)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (Expected 401, got $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 6: Missing email
echo -e "${YELLOW}Test 6: Missing email (should fail)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE - Correctly rejected)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (Expected 400, got $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

# Test 7: Missing password
echo -e "${YELLOW}Test 7: Missing password (should fail)${NC}"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✅ SUCCESS${NC} (HTTP $HTTP_CODE - Correctly rejected)"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAILED${NC} (Expected 400, got $HTTP_CODE)"
  echo "Response: $BODY"
fi
echo ""

echo "=========================="
echo "🧪 Testing complete!"
echo ""
echo "💡 Tips:"
echo "  - Check server logs for detailed debugging information"
echo "  - If tests fail, verify users exist in database"
echo "  - Ensure plain text password mode is enabled for debugging"
echo ""

