# Quick cURL Commands for Supabase

Ready-to-use curl commands with your Supabase credentials.

## Your Supabase Project

- **URL**: `https://kokexexwucjzognhirvn.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg`

---

## Quick Commands

### 1. Count Total Accounts

```bash
curl -X GET "https://kokexexwucjzognhirvn.supabase.co/rest/v1/accounts?select=count" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Prefer: count=exact" \
  -v
```

**Check the `content-range` header** - the last number is the total count.

---

### 2. List All Accounts (Without Password)

```bash
curl -X GET "https://kokexexwucjzognhirvn.supabase.co/rest/v1/accounts?select=id,email,account_type,org_id,created_at" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- If accounts exist: JSON array with account objects
- If no accounts: `[]`

---

### 3. Check Specific Account by Email

```bash
curl -X GET "https://kokexexwucjzognhirvn.supabase.co/rest/v1/accounts?email=eq.admin@woms.com&select=id,email,account_type,org_id" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Content-Type: application/json"
```

**For other emails:**
- `govt@woms.com`
- `org1@woms.com`

Just replace `admin@woms.com` in the URL.

---

### 4. Check Password Hash Format

```bash
curl -X GET "https://kokexexwucjzognhirvn.supabase.co/rest/v1/accounts?email=eq.admin@woms.com&select=email,password_hash" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Content-Type: application/json"
```

**Check the response:**
- Password should be stored as plain text: `"admin123"`

---

## Run All Tests at Once

Use the automated script:

```bash
./test-supabase-accounts.sh
```

This will run all tests and show you:
1. Total account count
2. All accounts list
3. Specific account check
4. Password hash format

---

## Postman Setup

### Quick Import

1. Open Postman
2. Click "Import"
3. Select "Raw text"
4. Paste this curl command:

```bash
curl -X GET "https://kokexexwucjzognhirvn.supabase.co/rest/v1/accounts?select=id,email,account_type,org_id" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg"
```

### Manual Setup

1. **Method**: GET
2. **URL**: `https://kokexexwucjzognhirvn.supabase.co/rest/v1/accounts?select=id,email,account_type,org_id`
3. **Headers**:
   - `apikey`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg`
   - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva2V4ZXh3dWNqem9nbmhpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ3MTUsImV4cCI6MjA3ODc1MDcxNX0.Mw0J7y2NhsUkbHw9K8UYoEAEWYnPfHjkNZ5jiibEvBg`
   - `Content-Type`: `application/json`

---

## What to Look For

### ✅ Success - Accounts Exist

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

### ❌ Problem - No Accounts

```json
[]
```

**Solution**: Run user setup script in Supabase SQL Editor:
- `supabase/migrations/004_manual_user_setup.sql`

---

## Next Steps

1. **Run the test script**: `./test-supabase-accounts.sh`
2. **If accounts exist** → Check login API route
3. **If no accounts** → Create users via SQL script
4. **If password format wrong** → Update password hash

See [SUPABASE_DIRECT_QUERY.md](./SUPABASE_DIRECT_QUERY.md) for more details.

