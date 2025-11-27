# RESTORE CONTEXT - Copy This Entire Prompt

---

You are an expert full-stack engineer continuing development on **WOMS (Work Order Management System)** - a unified solar monitoring and work order management platform.

## PROJECT SUMMARY

**WOMS** is a production-ready system built with:
- **Next.js 14** (App Router), **TypeScript**, **TailwindCSS/shadcn/ui**, **Supabase**
- **Custom authentication** (NOT Supabase Auth) using `accounts` table
- **Unified dashboard** at `/dashboard` that adapts to user role (SUPERADMIN, GOVT, ORG)
- **One account per organization** (single-login entities, no multi-user orgs)
- **Static work orders** (no status/lifecycle per requirements)
- **Generic vendor adapter system** for multi-vendor integration
- **Separate telemetry database** with 24h retention

## AUTHENTICATION SYSTEM (CRITICAL - READ FIRST)

**The system uses CUSTOM authentication, NOT Supabase Auth.**

**How it works:**
1. **Login**: `/api/login` receives plain text password → hashes with bcrypt → stores hash in `accounts.password_hash`
2. **Session**: Created as HTTP-only cookie containing base64-encoded JSON: `{ accountId, accountType, orgId }`
3. **All API routes**: Check session cookie → decode → use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
4. **Why service role key?**: RLS policies use `auth.uid()` which requires Supabase Auth. Since we use custom auth, `auth.uid()` is always NULL, so we bypass RLS using service role key.

**Key files:**
- `app/api/login/route.ts` - Uses service role key, bcrypt password comparison
- `app/api/me/route.ts` - Uses service role key to verify account
- `middleware.ts` - Protects routes, checks session cookie
- All API routes follow pattern: session check → decode → `createServiceClient()` → DB operation

**Default users** (passwords are bcrypt hashed in DB):
- `admin@woms.com` / `admin123` (SUPERADMIN, org_id = NULL)
- `govt@woms.com` / `govt123` (GOVT, org_id = NULL)
- `org1@woms.com` / `org1123` (ORG, org_id = 1)

## DATABASE SCHEMA

**Main Supabase Database:**
- `accounts` - Authentication table (id UUID, account_type ENUM, email, password_hash TEXT, org_id INTEGER nullable)
- `organizations` - Organizations (id SERIAL, name, auto_sync_enabled BOOLEAN, sync_interval_minutes INTEGER)
- `vendors` - Vendor integrations (vendor_type: SOLARMAN, SUNGROW, OTHER)
- `plants` - Solar plants (linked to org_id and vendor_id)
- `work_orders` - Static work orders (NO status field - per requirements)
- `work_order_plants` - Junction table (plant can only be in ONE active WO)
- `alerts` - System alerts
- `work_order_plant_eff` - Efficiency metrics

**Telemetry Database (Separate Instance):**
- `telemetry_readings` - 24h retention, indexed for fast queries

**Important**: There is NO `users` table or `user_orgs` table. The system uses `accounts` table only.

## ORGANIZATION MANAGEMENT

**Requirement**: "Organizations are single-login entities (one account per org; no multi-user orgs)"

**Implementation:**
- Each organization can have **exactly ONE account** (type: ORG)
- Super Admin can create organizations and accounts
- UI (`components/OrgsTable.tsx`): Shows org name, associated account email, "Create Account" button
- API (`/api/accounts`): Validates one account per org, enforces ORG accounts must have org_id
- **Removed**: "Assign Users" feature, `/api/users` endpoint (deprecated), `/api/user-orgs` endpoint (deleted)

## WORK ORDERS

**Requirement**: "Work Orders are static — no status/stages"

**Implementation:**
- No `status` field in `work_orders` table
- No lifecycle/state machine
- Only SUPERADMIN can create
- `/api/workorders/[id]/status` returns error (work orders are static)
- Plants can only be in ONE active work order (enforced via `work_order_plants.is_active`)

## UNIFIED DASHBOARD

**Single page** `/dashboard` that adapts:

**SUPERADMIN**:
- System metrics (total plants, alerts, work orders)
- Action cards: Manage Organizations, Manage Vendors, Manage Plants, Create Work Orders
- Global telemetry chart, alerts feed, work orders summary

**GOVT**:
- Global 24h generation, alerts across all orgs, org breakdown, read-only WO list

**ORG**:
- Own plants only, own alerts, own work orders, org telemetry 24h, efficiency summary

## API ROUTES PATTERN

**All API routes follow this pattern:**
```typescript
1. Check session cookie exists
2. Decode session: JSON.parse(Buffer.from(session, "base64").toString())
3. Get accountType and orgId from sessionData
4. Use requirePermission(accountType, resource, action) for authorization
5. Use createServiceClient() function (returns client with SUPABASE_SERVICE_ROLE_KEY)
6. Perform database operations (bypasses RLS)
```

**Key endpoints:**
- `/api/login` - POST (custom auth, uses service role key)
- `/api/me` - GET (current user, uses service role key)
- `/api/dashboard` - GET (role-scoped data, uses service role key)
- `/api/orgs` - GET, POST (SUPERADMIN only for create, uses service role key)
- `/api/accounts` - GET, POST (SUPERADMIN only, uses service role key)
- `/api/vendors` - GET, POST (SUPERADMIN only for create, uses service role key)
- `/api/plants` - GET, POST (SUPERADMIN only for create, uses service role key)
- `/api/workorders` - GET, POST (SUPERADMIN only for create, uses service role key)
- `/api/alerts` - GET (role-filtered, uses service role key)

## ENVIRONMENT VARIABLES

**Required in `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # CRITICAL - used by ALL API routes

TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
TELEMETRY_SUPABASE_ANON_KEY=your_telemetry_anon_key
TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_telemetry_service_role_key

NODE_ENV=development
```

**Critical**: `SUPABASE_SERVICE_ROLE_KEY` is required for login and all API routes.

## MIGRATION FILES

**Location**: `supabase/migrations/`

**Execution order:**
1. `001_initial_schema.sql` - Creates all tables (with DROP statements for clean slate)
2. `002_rls_policies.sql` - RLS policies (bypassed via service role key)
3. `003_telemetry_db_schema.sql` - Telemetry DB schema
4. `004_manual_user_setup.sql` - Creates default users with bcrypt hashed passwords

**Password hashes** (already in `004_manual_user_setup.sql`):
- admin@woms.com: `$2b$10$pVV0zXjApE8jNhIMTOZ9peqyzIMVPVw/ybhJfHWR.2KerTCu1H1Cq`
- govt@woms.com: `$2b$10$Jlzo9l/joTHPE4CClPOsPOiNpiWEw1OpvJyDUSLTedLhk8SMvqITe`
- org1@woms.com: `$2b$10$PeXXkSCeoSKLVXdMLOGSb.xbB7avvbH52FzPqXjg/J8xTj9NeEwwG`

## KEY DECISIONS

1. **Custom Auth**: Full control, matches "one account per org" requirement
2. **Service Role Key**: All routes use it because RLS requires `auth.uid()` which doesn't exist
3. **Password Hashing**: bcrypt (salt rounds 10), users input plain text
4. **Static Work Orders**: No status field per requirements
5. **One Account Per Org**: Enforced in `/api/accounts` POST

## CURRENT STATE

**✅ Fully Working:**
- Custom authentication (login, session, password hashing)
- Organization management (create org, view/create accounts)
- Role-based dashboard (SUPERADMIN, GOVT, ORG views)
- Vendor, plant, work order CRUD operations
- All major API routes updated to use custom session + service role key

**⚠️ Lower Priority (may need updates):**
- `/api/workorders/[id]/logs` - Still uses Supabase Auth
- `/api/plants/[id]/telemetry` - Still uses Supabase Auth
- `/api/vendors/solarman/realtime` - Still uses Supabase Auth
- `/api/telemetry/*` routes - May need service role key

## COMMON ISSUES

1. **Login fails**: Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
2. **RLS blocking**: All routes should use service role key (already implemented)
3. **Org creation fails**: Ensure SUPERADMIN role, check service role key
4. **"users table doesn't exist"**: System uses `accounts` table, not `users`

## FILES TO KNOW

**Authentication:**
- `app/api/login/route.ts` - Login endpoint
- `app/api/me/route.ts` - Current user endpoint
- `app/api/accounts/route.ts` - Account management (NEW, replaces users)
- `middleware.ts` - Route protection

**Organization Management:**
- `app/superadmin/orgs/page.tsx` - Organizations page (SUPERADMIN only)
- `components/OrgsTable.tsx` - Organization table with account management
- `app/api/orgs/route.ts` - Organizations API

**Core APIs:**
- `app/api/dashboard/route.ts` - Dashboard data
- `app/api/vendors/route.ts` - Vendors CRUD
- `app/api/plants/route.ts` - Plants CRUD
- `app/api/workorders/route.ts` - Work orders CRUD

**Utilities:**
- `scripts/generate-password-hash.ts` - Generate bcrypt hashes
- `scripts/seed.ts` - Seed database with initial data
- `lib/rbac.ts` - Role-based access control

## DEVELOPMENT COMMANDS

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run seed         # Seed database (creates users with hashed passwords)
npx tsx scripts/generate-password-hash.ts <password>  # Generate hash
npm run type-check   # Type check
npm run lint         # Lint code
```

## QUICK REFERENCE

- **Login**: `admin@woms.com` / `admin123` (SUPERADMIN)
- **Auth**: Custom session cookies, NOT Supabase Auth
- **DB Access**: All routes use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- **Accounts**: One account per organization (enforced)
- **Work Orders**: Static, no status field
- **Password**: Plain text input → bcrypt hash → stored

---

**When continuing development:**
1. Always use custom session authentication (check cookie, decode)
2. Always use service role key for database operations
3. Remember: one account per org, work orders are static
4. No `users` table - use `accounts` table
5. All write operations require SUPERADMIN role

