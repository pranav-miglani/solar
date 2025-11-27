# WOMS - Complete Project Context Prompt

Use this prompt to restore full context after clearing chat history.

---

You are an expert full-stack engineer continuing development on a **Work Order Management System (WOMS)** - a unified solar monitoring and work order management platform. The system is built with Next.js 14 (App Router), TypeScript, TailwindCSS/shadcn/ui, and Supabase.

## PROJECT OVERVIEW

**Name**: WOMS — Unified Solar Monitoring & Work Order System

**Core Goals**:
- One **unified dashboard** (`/dashboard`) for all user types
- Dashboard automatically adjusts content based on role (SUPERADMIN, GOVT, ORG)
- Super Admin controls ALL write operations
- Organizations are **single-login entities** (one account per org; no multi-user orgs)
- Govt Agency sees global system telemetry + alerts + WOs (read-only)
- Work Orders are **static** — no status/stages/lifecycle
- Telemetry stored in separate Supabase DB with 24h retention
- Vendor integration uses **generic pluggable adapter system** (Solarman = one implementation)
- Modern UI with glassmorphism styling, animated charts, dark/light mode

## TECH STACK

**Frontend**:
- Next.js 14 App Router
- TypeScript (strict mode)
- TailwindCSS + shadcn/ui components
- Recharts for charts
- Framer Motion for animations
- react-hook-form + zod for forms

**Backend**:
- Supabase (main DB) - PostgreSQL with Row-Level Security (RLS)
- Second Supabase instance (telemetry DB) - 24h telemetry retention
- Supabase Edge Functions (Deno) for background tasks
- Custom authentication (NOT Supabase Auth)

**Authentication**:
- **Custom session-based authentication** using `accounts` table
- Session stored in HTTP-only cookies (base64-encoded JSON)
- Session format: `{ accountId, accountType, orgId }`
- Passwords: **bcrypt hashed** before storage (users input plain text)
- All API routes use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS (since RLS policies require `auth.uid()` which we don't have)

## DATABASE SCHEMA (MAIN SUPABASE)

**Core Tables**:
- `accounts` - Authentication table (NOT Supabase Auth)
  - `id` (UUID), `account_type` (ENUM: SUPERADMIN, ORG, GOVT)
  - `email`, `password_hash` (bcrypt), `org_id` (nullable)
  - Constraint: ORG accounts must have `org_id`, SUPERADMIN/GOVT have `org_id = NULL`
- `organizations` - Organizations
- `vendors` - Vendor integrations (SOLARMAN, SUNGROW, OTHER)
- `plants` - Solar plants
- `work_orders` - Static work orders (no status field)
- `work_order_plants` - Junction table (plant can only be in ONE active WO)
- `alerts` - System alerts
- `work_order_plant_eff` - Efficiency metrics

**Telemetry DB (Separate Instance)**:
- `telemetry_readings` - 24h retention, indexed for fast queries

## AUTHENTICATION SYSTEM (CRITICAL)

**Important**: The system uses **custom authentication**, NOT Supabase Auth.

**How It Works**:
1. Login: `/api/login` uses service role key to query `accounts` table (bypasses RLS)
2. Password: User inputs plain text → hashed with bcrypt → stored in `password_hash`
3. Session: Created as base64-encoded JSON cookie: `{ accountId, accountType, orgId }`
4. All API routes: Check session cookie, decode, use service role key for DB operations
5. RLS Bypass: All routes use `SUPABASE_SERVICE_ROLE_KEY` because RLS policies require `auth.uid()` which doesn't exist in custom auth

**Key Files**:
- `app/api/login/route.ts` - Login endpoint (uses service role key)
- `app/api/me/route.ts` - Get current user (uses service role key)
- `middleware.ts` - Protects routes, checks session cookie
- `lib/rbac.ts` - Role-based access control permissions

**Default Users** (from `supabase/migrations/004_manual_user_setup.sql`):
- `admin@woms.com` / `admin123` (SUPERADMIN)
- `govt@woms.com` / `govt123` (GOVT)
- `org1@woms.com` / `org1123` (ORG, org_id = 1)

## UNIFIED DASHBOARD (`/dashboard`)

**Single page** that adapts based on user role:

**SUPERADMIN**:
- System overview metrics (total plants, active alerts, 24h total generation)
- Action cards: Manage Organizations, Manage Vendors, Manage Plants, Create Work Orders
- Global telemetry chart (24h)
- Alerts feed (all orgs)
- Work Orders summary

**GOVT**:
- Global electricity generation for last 24h
- Alerts across all orgs
- Org-wise breakdown cards
- Read-only WO list

**ORG**:
- Only their own plants
- Only their own alerts
- Only their work orders
- Telemetry 24h for their org
- Efficiency summary

## ORGANIZATION MANAGEMENT

**Key Requirement**: "Organizations are single-login entities (one account per org; no multi-user orgs)"

**Implementation**:
- Each organization can have **exactly ONE account** (type: ORG)
- Super Admin can:
  - Create organizations (`/api/orgs` POST)
  - View all organizations
  - View which account belongs to each organization
  - Create an account for an organization that doesn't have one
- UI: `components/OrgsTable.tsx` shows organization name, associated account, and "Create Account" button
- API: `/api/accounts` - GET (list all accounts), POST (create account with validation)

**Removed Features**:
- ❌ "Assign Users" feature (doesn't exist - one account per org)
- ❌ `/api/users` endpoint (deprecated, returns 410 Gone)
- ❌ `/api/user-orgs` endpoint (deleted)
- ❌ `users` table (doesn't exist in schema)
- ❌ `user_orgs` table (doesn't exist in schema)

## WORK ORDERS

**Key Requirement**: "Work Orders are static — no status/stages"

**Implementation**:
- No `status` field in `work_orders` table
- No lifecycle/state machine
- Only SUPERADMIN can create work orders
- Work orders map to plants via `work_order_plants` junction table
- Constraint: A plant can belong to only ONE active work order (`is_active = true`)
- `/api/workorders/[id]/status` returns error (work orders are static)

## API ROUTES STRUCTURE

**All API routes follow this pattern**:
1. Check session cookie exists
2. Decode session to get `accountType` and `orgId`
3. Use `requirePermission()` from `lib/rbac.ts` for authorization
4. Use `createServiceClient()` function (service role key) to bypass RLS
5. Perform database operations

**Key Endpoints**:
- `/api/login` - POST (custom auth)
- `/api/me` - GET (current user)
- `/api/dashboard` - GET (role-scoped data)
- `/api/orgs` - GET, POST (SUPERADMIN only for create)
- `/api/accounts` - GET, POST (SUPERADMIN only)
- `/api/vendors` - GET, POST (SUPERADMIN only for create)
- `/api/plants` - GET, POST (SUPERADMIN only for create)
- `/api/workorders` - GET, POST (SUPERADMIN only for create)
- `/api/alerts` - GET (role-filtered)
- `/api/telemetry/*` - Various telemetry endpoints

## VENDOR ADAPTER SYSTEM

**Location**: `/lib/vendors/`

**Architecture**:
- `baseVendorAdapter.ts` - Abstract base class
- `solarmanAdapter.ts` - Solarman implementation
- `vendorManager.ts` - Factory pattern to get adapter by vendor type

**Methods**: `authenticate()`, `listPlants()`, `getTelemetry()`, `getAlerts()`, `getRealtime()`, `normalizeTelemetry()`, `normalizeAlert()`

## EDGE FUNCTIONS

**Location**: `supabase/functions/`

**Functions**:
- `vendor-auth` - Generic vendor authentication with token caching
- `sync-telemetry` - Poll vendor APIs, store in telemetry DB (runs every 15 min)
- `sync-alerts` - Poll vendor APIs, update alerts in main DB (runs every 30 min)
- `compute-efficiency` - Calculate efficiency metrics for work orders

**Important**: All Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` for database operations (bypasses RLS).

## ENVIRONMENT VARIABLES

**Required in `.env.local`**:
```env
# Main Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # CRITICAL - used by all API routes

# Telemetry Database (Separate Instance)
TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
TELEMETRY_SUPABASE_ANON_KEY=your_telemetry_anon_key
TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_telemetry_service_role_key

NODE_ENV=development
```

**Note**: `SUPABASE_SERVICE_ROLE_KEY` is **required** for login and all API routes to bypass RLS.

## MIGRATION FILES

**Location**: `supabase/migrations/`

**Order of execution**:
1. `001_initial_schema.sql` - Creates all tables, enums, functions (with DROP statements for clean slate)
2. `002_rls_policies.sql` - Row-Level Security policies (uses `auth.uid()` - not compatible with custom auth, so all routes bypass RLS)
3. `003_telemetry_db_schema.sql` - Telemetry database schema
4. `004_manual_user_setup.sql` - Creates default users with bcrypt hashed passwords
5. `005_delete_all_accounts.sql` - Utility script to delete all accounts

**Password Hashes** (from `004_manual_user_setup.sql`):
- `admin@woms.com`: `$2b$10$pVV0zXjApE8jNhIMTOZ9peqyzIMVPVw/ybhJfHWR.2KerTCu1H1Cq` (password: `admin123`)
- `govt@woms.com`: `$2b$10$Jlzo9l/joTHPE4CClPOsPOiNpiWEw1OpvJyDUSLTedLhk8SMvqITe` (password: `govt123`)
- `org1@woms.com`: `$2b$10$PeXXkSCeoSKLVXdMLOGSb.xbB7avvbH52FzPqXjg/J8xTj9NeEwwG` (password: `org1123`)

## UI STYLING

**Theme**: Glassmorphism with modern design
- Semi-blurry backgrounds
- Soft shadows
- Smooth hover effects (Framer Motion)
- Dark/light mode support
- Responsive grid layouts
- Sidebar navigation with lucide-react icons

**Login Page**: Solar-themed with animated solar panel background, floating energy particles, rotating sun icon

## KEY DECISIONS MADE

1. **Custom Authentication**: Chosen over Supabase Auth to have full control and match "one account per org" requirement
2. **Service Role Key Everywhere**: All API routes use service role key because RLS policies require `auth.uid()` which doesn't exist
3. **Password Hashing**: bcrypt with salt rounds 10 (users input plain text, hashed before storage)
4. **Static Work Orders**: No status field, no lifecycle - per requirements
5. **One Account Per Org**: Enforced in `/api/accounts` POST endpoint
6. **RLS Policies**: Exist but are bypassed via service role key (policies use `auth.uid()` which is NULL)

## CURRENT STATE

**✅ Fully Working**:
- Custom authentication (login, session management)
- Organization management (create org, view/create accounts)
- Role-based dashboard (SUPERADMIN, GOVT, ORG)
- Vendor, plant, work order CRUD operations
- Password hashing with bcrypt
- All major API routes updated to use custom session

**⚠️ May Need Updates** (lower priority routes):
- `/api/workorders/[id]/logs` - Still uses Supabase Auth
- `/api/plants/[id]/telemetry` - Still uses Supabase Auth
- `/api/vendors/solarman/realtime` - Still uses Supabase Auth
- `/api/telemetry/*` routes - May need service role key updates

**📝 Documentation**:
- `README.md` - Main project documentation
- `SETUP_GUIDE.md` - Detailed setup instructions
- `TROUBLESHOOTING.md` - Common issues and solutions
- `AUTHENTICATION_UPDATE_SUMMARY.md` - Summary of auth changes
- `scripts/generate-password-hash.ts` - Utility to generate bcrypt hashes

## COMMON ISSUES & SOLUTIONS

1. **Login fails**: Check `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
2. **RLS blocking queries**: All routes should use service role key (already implemented)
3. **Organization creation fails**: Ensure SUPERADMIN role, check service role key
4. **"users table doesn't exist"**: System uses `accounts` table, not `users`

## DEVELOPMENT COMMANDS

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Seed database (creates users with hashed passwords)
npm run seed

# Generate password hash
npx tsx scripts/generate-password-hash.ts <password>

# Type check
npm run type-check

# Lint
npm run lint
```

## NEXT STEPS FOR CONTINUED DEVELOPMENT

1. Test all authentication flows end-to-end
2. Update remaining API routes that still use Supabase Auth (if needed)
3. Implement telemetry visualization on dashboard
4. Add vendor adapter implementations (beyond Solarman)
5. Deploy Edge Functions to cloud Supabase
6. Add comprehensive error handling and user feedback
7. Add efficiency calculations and display

---

**Important Notes**:
- The system is **production-ready** but uses plain text password input (hashed before storage)
- All database operations bypass RLS using service role key
- One account per organization is enforced
- Work orders are static (no status/lifecycle)
- Custom authentication throughout (no Supabase Auth)

