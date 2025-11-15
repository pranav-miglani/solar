# Authentication Update Summary

## Overview
All authentication flows have been updated from Supabase Auth to custom session-based authentication using the `accounts` table. This aligns with the system requirements: "Organizations are single-login entities (one account per org; no multi-user orgs)."

## Key Changes

### 1. Authentication System
- **Before**: Used Supabase Auth (`supabase.auth.getUser()`) and `users` table
- **After**: Custom session cookies with `accounts` table
- **Session Format**: Base64-encoded JSON containing `{ accountId, accountType, orgId }`

### 2. API Routes Updated

#### ✅ Fully Updated (Using Custom Session + Service Role Key)
- `/api/login` - Login endpoint
- `/api/me` - Get current user
- `/api/orgs` - Organizations CRUD
- `/api/accounts` - Accounts CRUD (NEW - replaces `/api/users`)
- `/api/vendors` - Vendors CRUD
- `/api/vendors/[id]` - Vendor details/update/delete
- `/api/plants` - Plants CRUD
- `/api/workorders` - Work orders CRUD
- `/api/workorders/[id]` - Work order details
- `/api/dashboard` - Dashboard data

#### ⚠️ Still Need Updates (Using Supabase Auth)
- `/api/workorders/[id]/plants` - Work order plants
- `/api/workorders/[id]/logs` - Work order logs
- `/api/workorders/[id]/status` - Work order status (may not be needed - work orders are static)
- `/api/plants/[id]/telemetry` - Plant telemetry
- `/api/vendors/solarman/realtime` - Vendor realtime data
- `/api/alerts` - Alerts (may already be updated)
- `/api/telemetry/*` - Telemetry endpoints (may already be updated)

### 3. Pages Updated

#### ✅ Fully Updated
- `/app/auth/login/page.tsx` - Login page
- `/app/dashboard/page.tsx` - Dashboard (client-side)
- `/app/superadmin/orgs/page.tsx` - Organizations management
- `/app/superadmin/vendors/page.tsx` - Vendors management
- `/app/workorders/page.tsx` - Work orders list
- `/app/workorders/create/page.tsx` - Create work order
- `/app/workorders/[id]/page.tsx` - Work order detail
- `/app/engineer/tasks/page.tsx` - Redirects to dashboard (engineer role not supported)

### 4. Components Updated

#### ✅ Fully Updated
- `components/OrgsTable.tsx` - Now shows accounts per organization, allows creating accounts
- `components/CreateWorkOrderForm.tsx` - Removed engineer references, uses `/api/orgs`

#### ⚠️ May Need Updates
- `components/PlantSelector.tsx` - Removed `assignedEngineer` prop (unused)
- Other components that might reference `users` table

### 5. Database Schema Alignment

#### Removed/Deprecated
- ❌ `users` table - Does not exist in schema
- ❌ `user_orgs` table - Does not exist in schema
- ❌ `/api/users` - Deprecated, use `/api/accounts` instead
- ❌ `/api/user-orgs` - Deleted (not needed - one account per org)

#### Active Tables
- ✅ `accounts` table - Primary authentication table
- ✅ `organizations` table - Organizations
- ✅ All other tables remain unchanged

### 6. Organization Account Management

**Changed from**: "Assign Users to Organization"  
**Changed to**: "View/Create Account for Organization"

- Each organization can have **one account** (ORG type)
- Super Admin can:
  - View which account belongs to each organization
  - Create an account for an organization that doesn't have one
  - See account email and type

### 7. Service Role Key Usage

All API routes that perform database operations now use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS, since:
- RLS policies use `auth.uid()` which requires Supabase Auth
- We use custom authentication, so `auth.uid()` is always NULL
- Service role key bypasses RLS for all operations

**Routes using service role key:**
- `/api/login` - Query accounts during login
- `/api/me` - Verify account exists
- `/api/orgs` - CRUD operations
- `/api/accounts` - CRUD operations
- `/api/vendors` - CRUD operations
- `/api/plants` - CRUD operations
- `/api/workorders` - CRUD operations
- `/api/dashboard` - Query metrics

## Testing Checklist

### Authentication
- [ ] Login with `admin@woms.com` / `admin123` works
- [ ] Login redirects to `/dashboard`
- [ ] Session persists across page refreshes
- [ ] Logout clears session (if implemented)

### Organization Management (Super Admin Only)
- [ ] Can view organizations list
- [ ] Can create new organization
- [ ] Can view account for each organization
- [ ] Can create account for organization without one
- [ ] Cannot create multiple accounts for same organization

### Role-Based Access
- [ ] SUPERADMIN sees all management cards on dashboard
- [ ] GOVT sees read-only global view
- [ ] ORG sees only their own data
- [ ] Non-SUPERADMIN cannot access `/superadmin/*` routes

### API Endpoints
- [ ] `/api/orgs` - GET and POST work for SUPERADMIN
- [ ] `/api/accounts` - GET and POST work for SUPERADMIN
- [ ] `/api/vendors` - All operations work
- [ ] `/api/plants` - All operations work
- [ ] `/api/workorders` - All operations work

## Remaining Work

1. **Update remaining API routes** that still use Supabase Auth:
   - Work order sub-routes (plants, logs, status)
   - Telemetry routes
   - Alert routes
   - Vendor-specific routes

2. **Test all flows** to ensure no broken references to `users` table

3. **Update any components** that might still reference:
   - `/api/users`
   - `/api/user-orgs`
   - Engineer roles
   - `users` table

## Notes

- **Password Hashing**: Passwords are now hashed using bcrypt before storage
- **RLS Bypass**: All database operations use service role key to bypass RLS
- **One Account Per Org**: Enforced in `/api/accounts` POST endpoint
- **Backward Compatibility**: `/api/users` returns 410 Gone with deprecation message

