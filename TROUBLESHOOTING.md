# WOMS Troubleshooting Guide

This guide helps you resolve common issues when setting up and running WOMS.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Database Migration Issues](#database-migration-issues)
- [Login Testing](#login-testing)
- [Database Connection Issues](#database-connection-issues)
- [Edge Functions Issues](#edge-functions-issues)
- [Telemetry Issues](#telemetry-issues)

## Authentication Issues

### Issue: "Invalid credentials" error

**Symptoms:**
- Login fails with "Invalid credentials"
- Server logs show password mismatch

**Solutions:**

1. **Verify user exists:**
   ```sql
   SELECT * FROM accounts WHERE email = 'admin@woms.com';
   ```

2. **Check password format:**
   - Password should be stored as plain text (e.g., 'admin123')

3. **Recreate user:**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: supabase/migrations/004_manual_user_setup.sql
   ```

4. **Check server logs** for detailed error messages (look for `🔐 [LOGIN]`)

### Issue: "Account not found" or RLS blocking login

**Symptoms:**
- Login fails with "Invalid credentials"
- Server logs show "Account not found" or database errors
- Database query returns empty results even though users exist

**Root Cause:**
Row-Level Security (RLS) policies require authentication to read the `accounts` table. During login, the user is not authenticated yet, creating a chicken-and-egg problem.

**Solutions:**

1. **Verify SUPABASE_SERVICE_ROLE_KEY is set:**
   ```bash
   # Check your .env.local file
   grep SUPABASE_SERVICE_ROLE_KEY .env.local
   ```
   The login endpoint uses the service role key to bypass RLS during authentication.

2. **Verify user exists in database:**
   ```sql
   SELECT email, account_type, org_id FROM accounts;
   ```

2. **Create user if missing:**
   ```sql
   -- Run: supabase/migrations/004_manual_user_setup.sql
   ```

3. **Check email spelling** (case-sensitive)

### Issue: "Database connection failed"

**Symptoms:**
- Server logs show database connection errors
- Login fails immediately

**Solutions:**

1. **Verify environment variables:**
   ```bash
   cat .env.local | grep SUPABASE
   ```

2. **Check Supabase project is active** (not paused)

3. **Restart development server** after changing `.env.local`

4. **Test database connection:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT COUNT(*) FROM accounts;
   ```

## Database Migration Issues

### Issue: "alerts does not exist"

**Symptoms:**
- Migration fails with "relation 'alerts' does not exist"

**Solutions:**

1. **Run complete migration:**
   - Copy entire `001_initial_schema.sql`
   - Paste in Supabase SQL Editor
   - Run the script
   - Should see: `✅ All 8 tables created successfully`

2. **Check if table exists:**
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables 
     WHERE table_name = 'alerts'
   );
   ```

3. **See [TROUBLESHOOTING_MIGRATIONS.md](./TROUBLESHOOTING_MIGRATIONS.md) for detailed migration troubleshooting**

### Issue: "policy already exists"

**Symptoms:**
- RLS policies migration fails

**Solutions:**

1. **Migration script handles this automatically** - it drops existing policies first
2. **If still failing**, manually drop policies:
   ```sql
   DROP POLICY IF EXISTS "policy_name" ON table_name;
   ```

### Issue: "type already exists"

**Symptoms:**
- ENUM type creation fails

**Solutions:**

1. **Migration script handles this** - uses `DROP TYPE IF EXISTS ... CASCADE`
2. **If still failing**, check if type exists:
   ```sql
   SELECT typname FROM pg_type WHERE typname = 'account_type';
   ```

## Login Testing

### Quick Test with cURL

```bash
# Test successful login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}' \
  -v

# Expected: HTTP 200 with account data and Set-Cookie header

# Test wrong password
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"wrong"}' \
  -v

# Expected: HTTP 401
```

### Automated Testing

```bash
# Run automated login tests
npm run test:login
```

### Check Server Logs

When testing login, watch your terminal for detailed logs:

```
🔐 [LOGIN] Login attempt started
🔐 [LOGIN] Request received: { email: 'admin@woms.com', passwordLength: 8 }
✅ [LOGIN] Database connection successful
✅ [LOGIN] Account found: { email: 'admin@woms.com', ... }
🔐 [LOGIN] Comparing passwords (plain text)
✅ [LOGIN] Password verified successfully
✅ [LOGIN] Login successful, session cookie set
```

### Verify User in Database

```sql
-- Check user details
SELECT 
  id,
  email,
  account_type,
  org_id,
  LENGTH(password_hash) as hash_length,
  LEFT(password_hash, 10) as hash_prefix,
  created_at
FROM accounts 
WHERE email = 'admin@woms.com';
```

## Database Connection Issues

### Issue: "Missing Supabase environment variables"

**Solutions:**

1. **Create `.env.local` file:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Verify file exists:**
   ```bash
   ls -la .env.local
   ```

3. **Restart development server** after creating/updating `.env.local`

### Issue: "Invalid API key"

**Solutions:**

1. **Verify keys are correct** in Supabase Dashboard → Settings → API
2. **Check for extra spaces** when copying keys
3. **Ensure keys are from the correct project** (main DB vs telemetry DB)

## Edge Functions Issues

### Issue: "Missing Supabase environment variables" in Edge Functions

**Solutions:**

1. **Set secrets in Supabase:**
   ```bash
   supabase secrets set TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
   supabase secrets set TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_key
   ```

2. **Verify secrets are set:**
   ```bash
   supabase secrets list
   ```

### Issue: Edge Functions not deploying

**Solutions:**

1. **Verify Supabase CLI is installed:**
   ```bash
   supabase --version
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Deploy functions:**
   ```bash
   supabase functions deploy vendor-auth
   supabase functions deploy sync-telemetry
   supabase functions deploy sync-alerts
   supabase functions deploy compute-efficiency
   ```

### Issue: Edge Functions returning errors

**Solutions:**

1. **Check function logs** in Supabase Dashboard → Edge Functions → Logs
2. **Verify service role key** is set correctly
3. **Check function code** for errors
4. **Test function locally** (if using Supabase CLI)

## Telemetry Issues

### Issue: Telemetry not showing

**Solutions:**

1. **Verify telemetry database is set up:**
   - Run `003_telemetry_db_schema.sql` in telemetry DB project
   - Check table exists: `SELECT COUNT(*) FROM telemetry_readings;`

2. **Check environment variables:**
   ```env
   TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
   TELEMETRY_SUPABASE_ANON_KEY=your_key
   TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_key
   ```

3. **Verify Edge Functions are running:**
   - Check `sync-telemetry` function logs
   - Ensure function is deployed and scheduled

### Issue: Telemetry data missing

**Solutions:**

1. **Check data retention** (24-hour window)
2. **Verify plant IDs** match between main DB and telemetry DB
3. **Check Edge Function logs** for sync errors

## Common SQL Queries for Debugging

### Check all accounts
```sql
SELECT email, account_type, org_id, created_at 
FROM accounts 
ORDER BY email;
```

### Check organizations
```sql
SELECT id, name FROM organizations;
```

### Check if tables exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Check RLS policies
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check migration status
```sql
-- Count tables (should be 8)
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'accounts', 'organizations', 'vendors', 'plants',
    'work_orders', 'work_order_plants', 'alerts', 'work_order_plant_eff'
  );
```

## Getting More Help

1. **Check server logs** - Most issues show detailed error messages
2. **Check Supabase logs** - Dashboard → Logs
3. **Verify setup** - Run `npm run verify:setup`
4. **Review migration files** - Ensure all migrations ran successfully
5. **Check documentation** - See [SETUP_GUIDE.md](./SETUP_GUIDE.md) and [README.md](./README.md)

