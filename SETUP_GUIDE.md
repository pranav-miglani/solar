# WOMS Setup Guide

This guide will help you set up the Work Order Management System from scratch.

## Prerequisites

1. **Node.js 18+** installed
2. **Two Supabase Projects**:
   - Main database for application data
   - Telemetry database (separate instance) for 24h telemetry retention
3. **npm** or **yarn** package manager

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd woms

# Install dependencies
npm install
```

## Step 2: Set Up Supabase Projects

### Main Database

1. Create a new Supabase project (or use existing)
2. Go to SQL Editor
3. Run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`

### Telemetry Database

1. Create a **separate** Supabase project for telemetry
2. Go to SQL Editor
3. Run: `supabase/migrations/003_telemetry_db_schema.sql`

## Step 3: Environment Variables

Create a `.env.local` file in the root directory:

```env
# Main Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Telemetry Database (Separate Instance)
TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
TELEMETRY_SUPABASE_ANON_KEY=your_telemetry_anon_key
TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_telemetry_service_role_key

# Node Environment
NODE_ENV=development
```

**Important**: Get these values from:
- Main DB: Project Settings → API (both anon key and service role key)
- Telemetry DB: Project Settings → API (both anon key and service role key from the separate project)

**Important Notes**:
- **SUPABASE_SERVICE_ROLE_KEY** is **required** for the login endpoint. During login, users are not authenticated yet, so Row-Level Security (RLS) would block queries to the `accounts` table. The service role key bypasses RLS, allowing authentication to work.
- The service role key for telemetry DB is required for Edge Functions to perform write operations (inserting telemetry data).

## Step 4: Seed Database

### Option A: Using Seed Script

Run the seed script to create initial data:

```bash
npm run seed
# or
npx tsx scripts/seed.ts
```

This creates:
- 2 organizations
- 1 Super Admin account (`admin@woms.com` / `admin123`)
- 1 Government account (`govt@woms.com` / `govt123`)
- 1 Organization account (`org1@woms.com` / `org1123`)
- 1 vendor (Solarman)
- 1 plant

### Option B: Manual Setup via Supabase Console

**If the seed script fails or you prefer manual setup:**

1. Open Supabase SQL Editor
2. Copy and paste the contents of `supabase/migrations/004_manual_user_setup.sql`
3. Run the script
4. This creates 3 accounts with hashed passwords:
   - `admin@woms.com` / `admin123` (Super Admin)
   - `govt@woms.com` / `govt123` (Government)
   - `org1@woms.com` / `org1123` (Organization)

5. Verify accounts were created:
   ```sql
   SELECT email, account_type, org_id FROM accounts ORDER BY email;
   ```

**Note**: This system uses a **custom `accounts` table** for authentication (NOT Supabase Auth). Passwords are hashed using bcrypt before storage. Users input plain text passwords, which are automatically hashed and compared with stored hashes during login.

## Step 5: Deploy Edge Functions (Cloud Supabase)

### Prerequisites

1. **Supabase CLI** installed:
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # Or using npm
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Get Project Reference ID**:
   - Go to Supabase Dashboard → Settings → General
   - Copy the "Reference ID"

### Deploy Functions

1. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Set secrets** (for telemetry database):
   ```bash
   supabase secrets set TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
   supabase secrets set TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_telemetry_service_role_key
   ```

3. **Deploy functions**:
   ```bash
   supabase functions deploy vendor-auth
   supabase functions deploy sync-telemetry
   supabase functions deploy sync-alerts
   supabase functions deploy compute-efficiency
   ```

4. **Verify deployment**:
   ```bash
   supabase functions list
   ```

**Note**: Edge Functions use service role keys automatically (provided by cloud Supabase). No additional configuration needed for main database access.

## Step 6: Verify Setup

Before starting the server, verify your setup:

```bash
# Verify environment and dependencies
npm run verify:setup
```

This will check:
- ✅ Environment file exists
- ✅ Required environment variables are set
- ✅ Dependencies are installed
- ✅ Migration files exist
- ✅ Server is accessible (if running)

## Step 7: Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`. You should see:
- Server logs in the terminal
- Any errors or warnings

Visit `http://localhost:3000` and you should be redirected to the login page.

**Important**: Keep the terminal open to see login debug logs when testing!

## Step 8: Test Login

### Option A: Test via Browser

1. Start the development server: `npm run dev`
2. Visit `http://localhost:3000`
3. You should be redirected to the login page
4. Use one of the seeded accounts:
   - **Super Admin**: `admin@woms.com` / `admin123`
   - **Government**: `govt@woms.com` / `govt123`
   - **Organization**: `org1@woms.com` / `org1123`

### Option B: Test via cURL (Recommended for Debugging)

Test the login API directly using curl:

```bash
# Test login API
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}' \
  -v

# Expected successful response:
# {
#   "account": {
#     "id": "...",
#     "email": "admin@woms.com",
#     "accountType": "SUPERADMIN",
#     "orgId": null
#   }
# }
# 
# Check for Set-Cookie header in response

# Test with wrong password (should fail)
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"wrongpassword"}' \
  -v

# Test with non-existent email (should fail)
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@woms.com","password":"admin123"}' \
  -v
```

### Check Server Logs

When testing login, watch your terminal where `npm run dev` is running. You should see detailed logs:

```
🔐 [LOGIN] Login attempt started
🔐 [LOGIN] Request received: { email: 'admin@woms.com', passwordLength: 8 }
🔐 [LOGIN] Supabase config check: { hasUrl: true, hasKey: true, ... }
✅ [LOGIN] Database connection successful
✅ [LOGIN] Account found: { id: '...', email: 'admin@woms.com', ... }
🔐 [LOGIN] Comparing password hash
✅ [LOGIN] Password verified successfully
✅ [LOGIN] Login successful, session cookie set
```

### Verify User Exists in Database

If login fails, verify the user exists:

```sql
-- Run in Supabase SQL Editor
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

### Verify Password Format

If login fails, check the password format in the database:

```sql
-- Check password for admin account
SELECT email, password_hash FROM accounts WHERE email = 'admin@woms.com';
```

The password should be stored as a bcrypt hash (starts with `$2a$`, `$2b$`, or `$2y$`). If it's still plain text, run the seed script to update it: `npm run seed`

## Troubleshooting

### Database Connection Issues

- Verify your Supabase URLs and keys are correct in `.env.local`
- Check that migrations have been applied (001, 002)
- Ensure RLS policies are enabled
- Test connection: Check server logs when attempting login

### Authentication Issues

**Most Common Issues:**

1. **"Invalid credentials" error:**
   - Check server logs for detailed error messages
   - Verify user exists: `SELECT * FROM accounts WHERE email = 'admin@woms.com';`
   - Ensure password_hash is a bcrypt hash (starts with `$2a$`, `$2b$`, or `$2y$`)
   - Generate hashes using: `npx tsx scripts/generate-password-hash.ts <password>`
   - If password is still plain text, run the seed script: `npm run seed`

2. **"Account not found":**
   - Run the user setup script: `supabase/migrations/004_manual_user_setup.sql`
   - Verify email matches exactly (case-sensitive)
   - Check database connection is working

3. **"Database connection failed":**
   - Verify `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Check Supabase project is active (not paused)
   - Restart development server after changing `.env.local`

**Debug Steps:**
1. Check server terminal logs (look for `🔐 [LOGIN]` messages)
2. Test with curl: `curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"email":"admin@woms.com","password":"admin123"}' -v`
3. Verify user in database: `SELECT email, password_hash FROM accounts WHERE email = 'admin@woms.com';`
4. Query Supabase directly: See `SUPABASE_DIRECT_QUERY.md` or run `./test-supabase-accounts.sh`

**See Troubleshooting section below for detailed testing instructions**

### Telemetry Not Showing

- Verify telemetry DB is set up correctly
- Check that `TELEMETRY_SUPABASE_URL`, `TELEMETRY_SUPABASE_ANON_KEY`, and `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` are set
- Ensure Edge Functions have access to telemetry DB

### Edge Functions Not Working

- Verify Supabase CLI is installed and logged in
- Check function deployment status in Supabase dashboard
- Review function logs in Supabase dashboard
- See Edge Functions deployment section below

## Next Steps

1. **Configure Vendors**: Add real vendor credentials in the Super Admin panel
2. **Add Plants**: Create plants and associate them with organizations
3. **Set Up Sync Jobs**: Schedule Edge Functions to run periodically (via cron or Supabase scheduled functions)
4. **Customize UI**: Adjust styling and components as needed

## Production Deployment

1. Build the application: `npm run build`
2. Deploy to Vercel, Netlify, or your preferred platform
3. Set environment variables in your hosting platform
4. Ensure Edge Functions are deployed to Supabase
5. Set up monitoring and logging

## Support

For issues or questions, please refer to the main README.md or open an issue in the repository.

