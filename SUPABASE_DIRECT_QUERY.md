# Direct Supabase Database Query Guide

This guide shows you how to query the Supabase database directly using curl to verify accounts exist and troubleshoot login issues.

## Prerequisites

You need these values from your Supabase project:
1. **Project URL**: `https://your-project-ref.supabase.co`
2. **Anon Key**: Your Supabase anon/public key

**Where to find them:**
- Go to Supabase Dashboard → Settings → API
- Copy "Project URL" and "anon public" key

## Quick Setup

Set these environment variables (or replace in commands):

```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key-here"
```

Or use directly in commands (replace the values).

---

## Query Commands

### 1. Check if Accounts Table Exists and Count Total Accounts

```bash
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" \
  -v
```

**Or with direct values:**
```bash
curl -X GET "https://your-project-ref.supabase.co/rest/v1/accounts?select=count" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Prefer: count=exact" \
  -v
```

**Expected Response:**
- Header: `content-range: 0-0/3` (last number is total count)
- If you see `/0`, no accounts exist
- If you see `/3` or more, accounts exist

---

### 2. List All Accounts

```bash
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?select=*" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -v
```

**Expected Response (if accounts exist):**
```json
[
  {
    "id": "uuid-here",
    "email": "admin@woms.com",
    "account_type": "SUPERADMIN",
    "org_id": null,
    "password_hash": "...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  ...
]
```

**Expected Response (if no accounts):**
```json
[]
```

---

### 3. Query Account by Email (Exact Match)

```bash
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=*" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -v
```

**Or for other emails:**
```bash
# Government account
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.govt@woms.com&select=*" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -v

# Organization account
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.org1@woms.com&select=*" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -v
```

**Expected Response (if account exists):**
```json
[
  {
    "id": "uuid-here",
    "email": "admin@woms.com",
    "account_type": "SUPERADMIN",
    "org_id": null,
    "password_hash": "admin123",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

**Expected Response (if account doesn't exist):**
```json
[]
```

---

### 4. Query Account by Email (Without Password Hash)

For security, you might want to exclude the password hash:

```bash
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=id,email,account_type,org_id,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -v
```

**Expected Response:**
```json
[
  {
    "id": "uuid-here",
    "email": "admin@woms.com",
    "account_type": "SUPERADMIN",
    "org_id": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 5. Check Password Hash Format

To verify password format:

```bash
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=email,password_hash" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -v
```

**Check the response:**
- Password should be stored as plain text: `"admin123"`

---

### 6. Query by Account Type

```bash
# Get all Super Admins
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?account_type=eq.SUPERADMIN&select=email,account_type" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -v

# Get all Organization accounts
curl -X GET "${SUPABASE_URL}/rest/v1/accounts?account_type=eq.ORG&select=email,account_type,org_id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -v
```

---

## Complete Test Script

Save this as `test-supabase-query.sh`:

```bash
#!/bin/bash

# Set your Supabase credentials here
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"

echo "🔍 Testing Supabase Database Connection"
echo "========================================"
echo ""

# Test 1: Count total accounts
echo "Test 1: Count total accounts"
echo "----------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" \
  -I | grep -i "content-range"
echo ""

# Test 2: List all accounts (without password)
echo "Test 2: List all accounts"
echo "-------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?select=id,email,account_type,org_id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  | jq .
echo ""

# Test 3: Check admin account
echo "Test 3: Check admin@woms.com"
echo "----------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=id,email,account_type" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  | jq .
echo ""

# Test 4: Check password hash format
echo "Test 4: Check password hash format (first 20 chars)"
echo "---------------------------------------------------"
curl -s -X GET "${SUPABASE_URL}/rest/v1/accounts?email=eq.admin@woms.com&select=email,password_hash" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  | jq '.[0] | {email, password_hash: (.password_hash | .[0:20])}'
echo ""

echo "========================================"
echo "✅ Testing complete!"
```

**Make it executable and run:**
```bash
chmod +x test-supabase-query.sh
./test-supabase-query.sh
```

---

## Postman Setup for Supabase Queries

### Step 1: Create New Request

1. Open Postman
2. Create new request
3. Name it "Supabase - List Accounts"

### Step 2: Configure Request

- **Method**: GET
- **URL**: `https://your-project-ref.supabase.co/rest/v1/accounts?select=*`

### Step 3: Add Headers

Add these headers:
- `apikey`: `your-anon-key`
- `Authorization`: `Bearer your-anon-key`
- `Content-Type`: `application/json`

### Step 4: Query by Email

To query by email, change URL to:
```
https://your-project-ref.supabase.co/rest/v1/accounts?email=eq.admin@woms.com&select=*
```

---

## Troubleshooting

### Error: "Invalid API key"

**Solution:**
- Verify you're using the **anon key** (not service role key)
- Check for extra spaces when copying
- Ensure key starts with `eyJ...`

### Error: "relation does not exist"

**Solution:**
- Table name might be wrong (should be `accounts`)
- Check if migrations were run
- Verify you're querying the correct Supabase project

### Error: "permission denied"

**Solution:**
- RLS policies might be blocking the query
- Try using service role key (for testing only)
- Check RLS policies in Supabase dashboard

### Empty Response `[]`

**Solution:**
- No accounts exist in database
- Run user setup script: `supabase/migrations/004_manual_user_setup.sql`
- Verify you're querying the correct project

### Connection Refused

**Solution:**
- Check Supabase URL is correct
- Verify project is active (not paused)
- Check network connectivity

---

## Using Service Role Key (Advanced)

⚠️ **Warning**: Service role key bypasses RLS. Use only for testing!

If RLS is blocking queries, you can use service role key:

```bash
export SUPABASE_SERVICE_KEY="your-service-role-key"

curl -X GET "${SUPABASE_URL}/rest/v1/accounts?select=*" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -v
```

---

## Quick Reference

### Supabase REST API Format

```
GET {SUPABASE_URL}/rest/v1/{table_name}?{filters}&select={columns}
```

**Examples:**
- List all: `/rest/v1/accounts?select=*`
- Filter by email: `/rest/v1/accounts?email=eq.admin@woms.com&select=*`
- Select specific columns: `/rest/v1/accounts?select=id,email,account_type`
- Count: `/rest/v1/accounts?select=count` (with `Prefer: count=exact` header)

### Required Headers

```
apikey: {your-anon-key}
Authorization: Bearer {your-anon-key}
Content-Type: application/json
```

### Common Filters

- `email=eq.value` - Exact match
- `account_type=eq.SUPERADMIN` - Exact match
- `org_id=is.null` - Is null
- `org_id=not.is.null` - Is not null

---

## Next Steps

After verifying accounts exist:

1. ✅ If accounts exist → Check login API route
2. ✅ If no accounts → Run setup script
3. ✅ If password format wrong → Update password hash
4. ✅ Test login again

See [QUICK_FIX_NO_USERS.md](./QUICK_FIX_NO_USERS.md) for creating users.

