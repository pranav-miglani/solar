#!/bin/bash

# Your Supabase Credentials (from .env.local)
SUPABASE_URL="https://kokexexwucjzognhirvn.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg"

echo "🔍 Testing Supabase Database - Accounts Table"
echo "=============================================="
echo ""

# Test 1: Count total accounts
echo "1️⃣  Counting total accounts..."
echo "----------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" \
  -I | grep -i "content-range" || echo "No content-range header"
echo ""

# Test 2: List all accounts (without password hash)
echo "2️⃣  Listing all accounts (without password)..."
echo "---------------------------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?select=id,email,account_type,org_id,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq . || echo "Response (if jq not installed):"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?select=id,email,account_type,org_id,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json"
echo ""
echo ""

# Test 3: Check admin account specifically
echo "3️⃣  Checking admin@woms.com..."
echo "-------------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=id,email,account_type,org_id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq . || \
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=id,email,account_type,org_id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json"
echo ""
echo ""

# Test 4: Check password hash format (first 30 chars for security)
echo "4️⃣  Checking password hash format..."
echo "-----------------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=email,password_hash" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq '.[0] | {email, password_hash: (.password_hash | .[0:30])}' || \
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=email,password_hash" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "=============================================="
echo "✅ Testing complete!"
echo ""
echo "💡 If you see empty arrays [], no accounts exist."
echo "💡 Run: supabase/migrations/007_setup_with_plain_text_passwords.sql"

