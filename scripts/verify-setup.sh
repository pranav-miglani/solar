#!/bin/bash

# Setup Verification Script
# This script verifies that the Solar Information System setup is complete and working

echo "🔍 Solar Information System Setup Verification"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: Environment file exists
echo -e "${BLUE}Checking environment file...${NC}"
if [ -f ".env.local" ]; then
  echo -e "${GREEN}✅ .env.local exists${NC}"
else
  echo -e "${RED}❌ .env.local not found${NC}"
  echo "   Create .env.local with Supabase credentials"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 2: Environment variables
echo -e "${BLUE}Checking environment variables...${NC}"
if [ -f ".env.local" ]; then
  source .env.local 2>/dev/null || true
  
  if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL not set${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ NEXT_PUBLIC_SUPABASE_URL is set${NC}"
  fi
  
  if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ NEXT_PUBLIC_SUPABASE_ANON_KEY is set${NC}"
  fi
  
  if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_SERVICE_ROLE_KEY not set (optional for Edge Functions)${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}✅ SUPABASE_SERVICE_ROLE_KEY is set${NC}"
  fi
fi
echo ""

# Check 3: Node modules
echo -e "${BLUE}Checking dependencies...${NC}"
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✅ node_modules exists${NC}"
else
  echo -e "${RED}❌ node_modules not found${NC}"
  echo "   Run: npm install"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 4: Database migrations exist
echo -e "${BLUE}Checking migration files...${NC}"
if [ -f "supabase/migrations/001_initial_schema.sql" ]; then
  echo -e "${GREEN}✅ Migration files exist${NC}"
else
  echo -e "${RED}❌ Migration files not found${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 5: Server running (optional)
echo -e "${BLUE}Checking if server is running...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Server is running on http://localhost:3000${NC}"
  
  # Test login endpoint
  echo -e "${BLUE}Testing login endpoint...${NC}"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@woms.com","password":"admin123"}' 2>/dev/null)
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Login endpoint is accessible (HTTP $HTTP_CODE)${NC}"
    if [ "$HTTP_CODE" = "401" ]; then
      echo -e "${YELLOW}⚠️  Login failed - check if user exists in database${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo -e "${RED}❌ Login endpoint returned unexpected status: $HTTP_CODE${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${YELLOW}⚠️  Server is not running${NC}"
  echo "   Start server with: npm run dev"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "=========================="
echo "Verification Summary"
echo "=========================="
echo -e "${GREEN}✅ Checks passed: $((5 - ERRORS - WARNINGS))${NC}"
if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
fi
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Errors: $ERRORS${NC}"
  echo ""
  echo "Please fix the errors above before proceeding."
  exit 1
else
  echo -e "${GREEN}✅ Setup verification complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Ensure database migrations are applied"
  echo "2. Create users using SQL script (004 or 007)"
  echo "3. Test login with: npm run test:login"
  exit 0
fi

