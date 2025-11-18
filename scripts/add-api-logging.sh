#!/bin/bash
# Script to help identify API routes that need logging added
# This script checks for routes that don't have logApiRequest imported

echo "Checking API routes for logging..."
echo ""

ROUTES_WITHOUT_LOGGING=0
ROUTES_WITH_LOGGING=0

for file in $(find app/api -name "route.ts" -type f); do
  if grep -q "logApiRequest\|logApiResponse" "$file"; then
    ROUTES_WITH_LOGGING=$((ROUTES_WITH_LOGGING + 1))
  else
    ROUTES_WITHOUT_LOGGING=$((ROUTES_WITHOUT_LOGGING + 1))
    echo "⚠️  Missing logging: $file"
  fi
done

echo ""
echo "Summary:"
echo "  Routes with logging: $ROUTES_WITH_LOGGING"
echo "  Routes without logging: $ROUTES_WITHOUT_LOGGING"
echo ""
echo "To add logging to a route:"
echo "  1. Import: import { logApiRequest, logApiResponse } from '@/lib/api-logger'"
echo "  2. Add at start: const startTime = Date.now(); logApiRequest(request)"
echo "  3. Add before each return: logApiResponse(request, status, Date.now() - startTime)"

