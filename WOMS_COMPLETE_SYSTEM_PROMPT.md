# WOMS (Work Order Management System) - Complete System Specification

## System Overview

Build a production-ready **Work Order Management System (WOMS)** for managing solar power plant operations, work orders, alerts, and vendor integrations. The system must handle multiple organizations, vendors (Solarman, Sungrow, etc.), plants, telemetry data, alerts, and work order efficiency tracking.

## Tech Stack Requirements

### Core Framework
- **Next.js 14+** with App Router (TypeScript)
- **React 18+** with Server Components and Client Components
- **TypeScript** (strict mode enabled)

### Database & Backend
- **Supabase** (PostgreSQL) with two database instances:
  - Main database: accounts, organizations, vendors, plants, work_orders, alerts
  - Telemetry database: time-series telemetry data
- **Supabase Edge Functions** (Deno) for vendor API integrations
- Use **service role** client for backend operations (bypasses RLS)
- Connection pooling for database clients

### Authentication & Authorization
- **Custom authentication** (NOT Supabase Auth):
  - HTTP-only cookies for session tokens
  - Base64-encoded JSON session data
  - Password hashing with `bcryptjs`
  - Session validation in middleware
- **RBAC (Role-Based Access Control)**:
  - `SUPERADMIN`: Full system access
  - `GOVT`: Read-only access to all organizations
  - `ORG`: Access only to their organization's data

### UI & Styling
- **TailwindCSS** for styling
- **shadcn/ui** component library (Button, Card, Badge, Dialog, Table, etc.)
- **Recharts** for data visualization
- **Framer Motion** for animations
- **Lucide React** for icons
- **date-fns** for date formatting

### Additional Libraries
- **node-cron** for scheduled tasks
- **MDC (Mapped Diagnostic Context)** for request tracing across async operations

## Database Schema

### Core Tables

#### `accounts`
- `id` (UUID, primary key)
- `account_type` (ENUM: SUPERADMIN, ORG, GOVT)
- `email` (TEXT, unique)
- `password_hash` (TEXT)
- `org_id` (INTEGER, nullable, FK to organizations)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **Constraint**: ORG accounts must have org_id; SUPERADMIN/GOVT must have org_id = NULL

#### `organizations`
- `id` (SERIAL, primary key)
- `name` (TEXT)
- `auto_sync_enabled` (BOOLEAN, default true)
- `sync_interval_minutes` (INTEGER, default 15, range 1-1440)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `vendors`
- `id` (SERIAL, primary key)
- `name` (TEXT)
- `vendor_type` (ENUM: SOLARMAN, SUNGROW, OTHER)
- `credentials` (JSONB) - encrypted vendor API credentials
- `org_id` (INTEGER, nullable, FK to organizations) - NULL means global vendor
- `access_token` (TEXT, nullable) - cached vendor API token
- `refresh_token` (TEXT, nullable)
- `token_expires_at` (TIMESTAMPTZ, nullable)
- `token_metadata` (JSONB, default '{}')
- `is_active` (BOOLEAN, default true)
- `last_synced_at` (TIMESTAMPTZ) - last plant sync
- `last_alert_synced_at` (TIMESTAMPTZ) - last alert sync
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `plants`
- `id` (SERIAL, primary key)
- `org_id` (INTEGER, FK to organizations, NOT NULL)
- `vendor_id` (INTEGER, FK to vendors, NOT NULL)
- `vendor_plant_id` (TEXT, NOT NULL) - vendor's plant identifier
- `name` (TEXT)
- `capacity_kw` (NUMERIC(10, 2))
- `location` (JSONB) - { lat, lng, address }
- **Production Metrics**:
  - `current_power_kw` (NUMERIC(10, 3))
  - `daily_energy_kwh` (NUMERIC(10, 3)) - Daily energy in kWh (stored in kWh to avoid rounding errors)
  - `monthly_energy_mwh` (NUMERIC(10, 3))
  - `yearly_energy_mwh` (NUMERIC(10, 3))
  - `total_energy_mwh` (NUMERIC(10, 3)) - Total cumulative energy (from `generationUploadTotalOffset` for Solarman)
  - `performance_ratio` (NUMERIC(5, 4)) - 0-1 range
- `last_update_time` (TIMESTAMPTZ) - last vendor update
- `last_refreshed_at` (TIMESTAMPTZ) - last DB sync
- `contact_phone` (TEXT)
- `network_status` (TEXT) - NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE
- `vendor_created_date` (TIMESTAMPTZ)
- `start_operating_time` (TIMESTAMPTZ)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **Unique constraint**: (vendor_id, vendor_plant_id)

#### `alerts`
- `id` (SERIAL, primary key)
- `plant_id` (INTEGER, FK to plants, NOT NULL)
- `vendor_id` (INTEGER, FK to vendors, NOT NULL)
- `vendor_alert_id` (TEXT, NOT NULL) - vendor's alert identifier
- `vendor_plant_id` (TEXT, NOT NULL) - vendor's plant identifier
- `station_id` (TEXT, nullable) - vendor station ID
- `device_type` (TEXT) - e.g., "INVERTER"
- `title` (TEXT)
- `description` (TEXT, nullable)
- `severity` (ENUM: LOW, MEDIUM, HIGH, CRITICAL)
- `status` (ENUM: ACTIVE, RESOLVED, ACKNOWLEDGED)
- `alert_time` (TIMESTAMPTZ) - when alert started
- `end_time` (TIMESTAMPTZ, nullable) - when alert ended
- `grid_down_seconds` (INTEGER) - calculated as max(0, end_time - alert_time)
- `grid_down_benefit_kwh` (NUMERIC(12,3)) - downtime benefit energy computed as `0.5 × hours(overlap between 9AM-4PM local window) × installed capacity (kW)`
- `metadata` (JSONB, default '{}') - vendor-specific data
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **Unique constraint**: (vendor_id, vendor_alert_id, plant_id)

#### `work_orders`
- `id` (SERIAL, primary key)
- `title` (TEXT)
- `description` (TEXT, nullable)
- `location` (TEXT)
- `org_id` (INTEGER, FK to organizations, NOT NULL)
- `priority` (ENUM: LOW, MEDIUM, HIGH) - deprecated but kept for compatibility
- `created_by` (UUID, FK to accounts) - deprecated but kept for compatibility
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `work_order_plants`
- `id` (SERIAL, primary key)
- `work_order_id` (INTEGER, FK to work_orders)
- `plant_id` (INTEGER, FK to plants)
- `is_active` (BOOLEAN, default true)
- `added_at` (TIMESTAMPTZ)
- **Unique constraint**: (work_order_id, plant_id)
- **Unique index**: one active work order per plant (is_active = true)

#### `work_order_plant_eff`
- `id` (SERIAL, primary key)
- `work_order_id` (INTEGER, FK to work_orders)
- `plant_id` (INTEGER, FK to plants)
- `recorded_at` (TIMESTAMPTZ)
- `actual_gen` (NUMERIC(10, 2))
- `expected_gen` (NUMERIC(10, 2))
- `pr` (NUMERIC(5, 4))
- `efficiency_pct` (NUMERIC(5, 2))
- `category` (TEXT)
- `created_at` (TIMESTAMPTZ)

### Telemetry Database (Separate Instance)
- **Separate PostgreSQL instance** for high-volume time-series records
- **Table**: `telemetry_15m`
  - `ts` (TIMESTAMPTZ) - Timestamp at 15-minute interval
  - `plant_id` (INTEGER) - Foreign key reference to main database `plants.id`
  - `total_energy_mwh` (NUMERIC(12, 3)) - Cumulative energy at this timestamp
  - `power_kw` (NUMERIC(12, 3)) - Instantaneous power
  - `raw` (JSONB) - Vendor raw telemetry snapshot (untouched vendor data)
- **Indexes**:
  - `(plant_id, ts)` btree (mandatory for efficient queries)
  - `(ts)` for dashboard queries
- **Retention**: 31-day rolling window for summary data, long-term data stays indefinitely in raw 15-minute table

### Indexes
- Indexes on all foreign keys
- Indexes on frequently queried columns (email, org_id, vendor_id, plant_id, alert_time, etc.)
- Composite indexes for common query patterns

### Triggers
- `update_updated_at_column()` function to auto-update `updated_at` on all tables

## Authentication System

### Session Management
- **Middleware** (`middleware.ts`):
  - Intercepts all requests
  - Validates session cookie
  - Decodes base64 session data
  - Redirects unauthenticated users to `/auth/login`
  - Allows public routes (login page)

### Login Flow
- **POST `/api/login`**:
  - Accepts `email` and `password`
  - Queries `accounts` table using service role client (bypasses RLS)
  - Verifies password with `bcryptjs.compare()`
  - Creates session token: base64-encoded JSON with `{ accountId, email, accountType, orgId }`
  - Sets HTTP-only cookie named `session`
  - Returns success response

### Session Token Structure
```json
{
  "accountId": "uuid",
  "email": "user@example.com",
  "accountType": "SUPERADMIN" | "ORG" | "GOVT",
  "orgId": 123 | null
}
```

### RBAC Implementation
- **File**: `lib/rbac.ts`
- Defines `ROLE_PERMISSIONS` mapping
- Helper functions:
  - `hasPermission(accountType, permission)`
  - `requirePermission(accountType, permission)`
  - `canCreate(accountType)`
  - `canEdit(accountType)`
  - `canDelete(accountType)`

## Vendor Adapter System

### Architecture Pattern
- **Strategy Pattern** + **Factory Pattern**
- Base abstract class: `BaseVendorAdapter`
- Concrete implementations: `SolarmanAdapter`, `SungrowAdapter`, etc.
- Factory: `VendorManager` creates adapters based on vendor type

### BaseVendorAdapter Interface
```typescript
abstract class BaseVendorAdapter {
  abstract authenticate(): Promise<void>
  abstract listPlants(): Promise<NormalizedPlant[]>
  abstract getTelemetry(
    plantVendorId: string,
    start: Date,
    end: Date
  ): Promise<NormalizedTelemetry[]>
  abstract getRealtime(plantId: string): Promise<RealtimeData>
  abstract getAlerts(plantId: string, startDate: Date, endDate: Date): Promise<NormalizedAlert[]>
  
  // Normalization methods
  normalizePlant(vendorPlant: any): NormalizedPlant
  normalizeTelemetry(raw: any): TelemetryData
  normalizeAlert(vendorAlert: any): NormalizedAlert
}

// Telemetry Data Structure
interface TelemetryData {
  ts: Date
  totalEnergyMWh: number
  powerKW: number
  raw: any  // Vendor-specific untouched value
}
```

### Solarman Implementation
- **Authentication**:
  - Uses PRO API endpoint
  - Token stored in `vendors` table (access_token, refresh_token, token_expires_at)
  - Checks token expiration before reuse
  - Handles token refresh if needed
- **Plant Sync**:
  - Fetches plants from vendor API
  - Maps vendor plant data to normalized format
  - Upserts into `plants` table
  - Updates `last_synced_at` on vendor
- **Telemetry Sync**:
  - Fetches telemetry data from Solarman PRO API
  - Maps vendor-specific fields to normalized `TelemetryData` format
  - Handles pagination for long date ranges
  - Preserves raw vendor data in `raw` JSONB field
  - Supports both real-time and historical backfill modes
- **Alert Sync**:
  - Paginated API calls (size: 100)
  - Filters by `deviceType === "INVERTER"`
  - Uses `alertsStartDate` from vendor credentials (default: 1 year lookback)
  - Maps vendor alerts to normalized format
- Calculates `grid_down_seconds` from alert_time and end_time
- Derives `grid_down_benefit_kwh` using `0.5 × hours(9AM-4PM overlap) × installed capacity`
  - Upserts into `alerts` table
  - Updates `last_alert_synced_at` on vendor

### Token Storage
- Tokens cached in database to avoid repeated API calls
- Token expiration checked before reuse
- Automatic token refresh when expired

## API Routes Structure

### Authentication
- `POST /api/login` - User login

### User & Session
- `GET /api/me` - Get current user info
- `GET /api/accounts` - List accounts (SUPERADMIN only)

### Organizations
- `GET /api/orgs` - List organizations
- `GET /api/orgs/[id]` - Get organization details
- `GET /api/orgs/[id]/plants` - Get plants for organization

### Vendors
- `GET /api/vendors` - List vendors (filtered by org for ORG users)
- `GET /api/vendors/[id]` - Get vendor details
- `POST /api/vendors/[id]/sync-plants` - Manual plant sync
- `POST /api/vendors/[id]/sync-alerts` - Manual alert sync
- `GET /api/vendors/sync-status` - Get sync status for all vendors

### Plants
- `GET /api/plants` - List plants (filtered by org for ORG users)
- `GET /api/plants/[id]` - Get plant details
- `GET /api/plants/[id]/production` - Get production metrics
- `GET /api/plants/[id]/telemetry` - Get telemetry data
- `GET /api/plants/unassigned` - Get unassigned plants

### Alerts
- `GET /api/alerts` - List alerts (supports `plantId` and `limit` query params)
- Filtered by organization for ORG users

### Telemetry
- `GET /api/telemetry/global` - Global telemetry (SUPERADMIN/GOVT)
- `GET /api/telemetry/org/[id]` - Organization telemetry
- `GET /api/telemetry/plant/[id]` - Plant telemetry (supports `hours` query param, optimized for 31-day window)
- `GET /api/telemetry/workorder/[id]` - Work order telemetry
- `POST /api/telemetry/plant/[id]/backfill` - Trigger one-time backfill for a plant (SUPERADMIN only)
- `POST /api/telemetry/sync-all` - Trigger daily sync for all plants (requires CRON_SECRET or SUPERADMIN)

### Work Orders
- `GET /api/workorders` - List work orders
- `GET /api/workorders/[id]` - Get work order details
- `POST /api/workorders` - Create work order
- `PATCH /api/workorders/[id]` - Update work order
- `GET /api/workorders/[id]/plants` - Get plants for work order
- `GET /api/workorders/[id]/production` - Get production data
- `GET /api/workorders/[id]/efficiency` - Get efficiency metrics
- `GET /api/workorders/[id]/logs` - Get work order logs

### Dashboard
- `GET /api/dashboard` - Get dashboard data (role-specific)

### Cron Jobs
- `GET /api/cron/sync-plants` - Trigger plant sync (requires CRON_SECRET)
- `GET /api/cron/sync-alerts` - Trigger alert sync (requires CRON_SECRET)

## UI Pages Structure

### Public Pages
- `/auth/login` - Login page

### Dashboard
- `/dashboard` - Unified dashboard (role-specific widgets)

### Superadmin Pages
- `/superadmin/vendors` - Vendor management
- `/superadmin/vendor-sync` - Vendor sync status dashboard
- `/superadmin/orgs` - Organization management

### Organization Pages
- `/orgs/[id]/plants` - Organization plants view

### Plant Pages
- `/plants/[id]` - Plant detail view (shows metrics, telemetry, alerts)

### Work Orders
- `/workorders` - Work orders list
- `/workorders/create` - Create work order
- `/workorders/[id]` - Work order detail

### Engineer Pages
- `/engineer/tasks` - Engineer task list

### Alerts Flow
- `/alerts` - Alerts overview (organized by Organization → Vendor)
- `/alerts/vendor/[vendorId]` - Plants with alerts for a vendor
- `/alerts/vendor/[vendorId]/plant/[plantId]` - Month-by-month alerts for a plant

## Key Components

### Layout Components
- `DashboardSidebar` - Navigation sidebar (role-based menu items)
- `ThemeToggle` - Dark/light mode toggle

### Dashboard Components
- `DashboardMetrics` - Key metrics cards
- `OrgBreakdown` - Organization breakdown chart
- `ProductionOverview` - Production metrics
- `EfficiencySummary` - Efficiency metrics
- `EfficiencyBadge` - Efficiency badge display
- `AlertsFeed` - Recent alerts feed

### Plant Components
- `PlantDetailView` - Complete plant detail page
- `PlantSelector` - Plant selection dropdown
- `TelemetryChart` - Telemetry visualization (Recharts)

### Work Order Components
- `WorkOrdersList` - Work orders table
- `WorkOrderDetail` - Work order detail view
- `WorkOrderDetailView` - Work order detail component
- `WorkOrderModal` - Create/edit work order modal
- `CreateWorkOrderForm` - Work order form

### Vendor Components
- `VendorsTable` - Vendor management table
- `VendorSyncDashboard` - Vendor sync status dashboard

### Alert Components
- Alert cards and lists (integrated into plant detail and alerts pages)

### UI Components (shadcn/ui)
- Button, Card, Badge, Dialog, Table, Tabs, Input, Label, Select, Textarea, Checkbox, Switch, Progress, AlertDialog

## Cron Jobs

### Plant Sync Cron
- **File**: `lib/cron/plantSyncCron.js`
- **Schedule**: Every 15 minutes (configurable per organization)
- **Trigger**: `GET /api/cron/sync-plants?secret={CRON_SECRET}`
- **Logic**: Calls `plantSyncService.syncAllPlants()`
- **Enabled**: `ENABLE_PLANT_SYNC_CRON` environment variable

### Alert Sync Cron
- **File**: `lib/cron/alertSyncCron.js`
- **Schedule**: Every 15 minutes
- **Trigger**: `GET /api/cron/sync-alerts?secret={CRON_SECRET}`
- **Logic**: Calls `alertSyncService.syncAllAlerts()`
- **Enabled**: `ENABLE_ALERT_SYNC_CRON` environment variable

### Server Integration
- **File**: `server.js` - Custom Next.js server entry point
- Starts cron jobs if enabled
- Runs alongside Next.js dev/production server

## Services

### Plant Sync Service
- **File**: `lib/services/plantSyncService.ts`
- `syncAllPlants()` - Syncs plants for all active vendors
- `syncVendorPlants(vendorId)` - Syncs plants for a specific vendor
- Handles vendor adapter creation, authentication, plant fetching, normalization, and database upserts

### Alert Sync Service
- **File**: `lib/services/alertSyncService.ts`
- `syncAllAlerts()` - Syncs alerts for all active vendors
- `syncSolarmanVendorAlerts(vendor)` - Syncs alerts for Solarman vendor
- Handles pagination, filtering (INVERTER only), date ranges, and database upserts

### Telemetry Sync Service
- **File**: `lib/services/telemetrySyncService.ts`
- **Vendor-Agnostic Architecture**: Adapter-driven system that works with any vendor
- **Process Flow**:
  1. Fetch raw telemetry from vendor API via adapter
  2. Normalize into unified standard format
  3. Persist in Telemetry DB (15-minute resolution)
  4. Compute daily/monthly/yearly aggregates
  5. Update plant metrics in main database
- **Functions**:
  - `syncPlantTelemetry(plantId: number)` - Sync telemetry for a single plant
    - Determines sync window (daily: last 24h, one-time: entire history)
    - Fetches → normalizes → stores
    - Updates plant metrics (daily/monthly/yearly energy, current power)
  - `syncAllPlantsDaily()` - Daily sync for all plants
    - Runs for all organizations where `auto_sync_enabled = true`
    - Uses org-level `sync_interval_minutes`
    - Updates `generation_month_energy`, `generation_year_energy`, `generation_last_day_energy`, `generation_current_energy`
    - Maintains 31-day rolling telemetry window
    - Auto-deletes data older than 31 days (summary table only)
  - `backfillPlantTelemetry(plantId: number)` - One-time historical backfill
    - Mandatory backfill: Year-on-Year, Month-on-Month, Till last day cumulative energy
    - Full 15-min time-series reconstruction (if vendor supports)
    - Supports paginated vendor APIs
    - Long date-range pulling
    - Partial backfill continuation if interrupted
    - Saves in chunks (7-day or vendor-max)
- **Sync Modes**:
  - **One-Time Reload (Backfill Mode)**: Full historical data reconstruction
  - **Daily Sync (Scheduled)**: Runs every day at 00:15 local time for all plants
- **Data Normalization**:
  - Every record standardized to `TelemetryData` interface
  - Vendor-specific fields preserved in `raw` JSONB field
  - Maintains monotonic cumulative energy (handles broken vendor values)
- **Aggregate Computation**:
  - `daily_energy_mwh = max(totalEnergy) - min(totalEnergy)` per plant
  - `monthly_energy_mwh` from 1st of month
  - `yearly_energy_mwh` from 1st Jan
  - `current_power_kw` from latest timestamp
- **Failure Recovery**:
  - Retry API failures
  - Resume partial backfills
  - Skip corrupted vendor data
  - Log vendor and plant-level failures in `vendor_sync_logs` table
- **Database Operations**:
  - Upsert on `(plant_id, ts)` to handle duplicates
  - Optimized queries by `(plant_id, ts)` index
  - No blocking long scans

## Telemetry System - Complete Specification

### Overview

The Telemetry module is a **vendor-agnostic, adapter-driven, time-series ingestion system**. Every vendor exposes different telemetry fields, but the overall process remains identical across all vendors:

1. **Fetch raw telemetry** from vendor API
2. **Normalize** into unified standard format
3. **Persist** in Telemetry DB (15-minute resolution)
4. **Compute** daily/monthly/yearly aggregates
5. **Maintain** 31-day rolling window for graphing

This ensures **scalability, consistency, and extensibility** across Solarman, Sungrow, Growatt, and future vendors.

### Telemetry Database Structure

**Telemetry DB** is a separate PostgreSQL instance designed for high-volume time-series records.

#### Table: `telemetry_15m`

| Field | Type | Description |
|-------|------|-------------|
| `ts` | TIMESTAMPTZ | Timestamp (15-minute interval) |
| `plant_id` | INTEGER | FK reference to main database `plants.id` |
| `total_energy_mwh` | NUMERIC(12,3) | Cumulative energy at this timestamp |
| `power_kw` | NUMERIC(12,3) | Instantaneous power |
| `raw` | JSONB | Vendor raw telemetry snapshot (untouched) |

#### Indexes

- `(plant_id, ts)` btree (mandatory for efficient queries)
- `(ts)` for dashboard queries

#### Retention Policy

- **31-day rolling window**: Summary data auto-deleted after 31 days
- **Long-term storage**: Raw 15-minute data stays indefinitely in `telemetry_15m` table

### Telemetry Sync Modes

#### 1. One-Time Reload (Backfill Mode)

For each plant, mandatory backfill includes:

- **Year-on-Year** cumulative energy
- **Month-on-Month** cumulative energy
- **Till last day** cumulative energy history
- **Full 15-min time-series** reconstruction (if vendor supports)

**Backfill Logic Requirements**:

- Support paginated vendor APIs
- Long date-range pulling
- Partial backfill continuation if interrupted
- Chunked processing (7-day or vendor-max chunks)

#### 2. Daily Sync (Scheduled)

Runs for all plants every day at **00:15 local time**.

**Updates**:

- `generation_month_energy`
- `generation_year_energy`
- `generation_last_day_energy`
- `generation_current_energy`
- `instantaneous power_kw` (optional depending on vendor)

**31-Day Rolling Window**:

- Maintain last 31 days of 15-minute data
- Auto-delete anything older than 31 days (summary table only)
- Long-term data stays indefinitely in raw 15-minute table

### Telemetry Process Flow (Generic Vendor)

#### Step 1 – Adapter Invoked

```typescript
adapter.getTelemetry(plantVendorId, start, end)
```

#### Step 2 – Normalize

Every record must be standardized:

```typescript
interface TelemetryData {
  ts: Date
  totalEnergyMWh: number
  powerKW: number
  raw: any  // Vendor-specific untouched value
}
```

#### Step 3 – Insert into Telemetry DB

- **Upsert** on `(plant_id, ts)` to handle duplicates
- **Maintain monotonic** cumulative energy if vendor sends broken values
- **Preserve raw data** in `raw` JSONB field

#### Step 4 – Aggregate Computation

Per plant:

- `daily_energy_mwh = max(totalEnergy) - min(totalEnergy)` (for the day)
- `monthly_energy_mwh` = from 1st of month
- `yearly_energy_mwh` = from 1st Jan
- `current_power_kw` = from latest timestamp

### Telemetry Adapter Architecture (Generic)

Extend the existing vendor adapter pattern:

```typescript
abstract class BaseVendorAdapter {
  abstract getTelemetry(
    plantVendorId: string,
    start: Date,
    end: Date
  ): Promise<NormalizedTelemetry[]>
  
  protected abstract normalizeTelemetry(raw: any): TelemetryData
}
```

**Vendor Implementations**:

- `SolarmanTelemetryAdapter` - Maps Solarman fields → normalized fields
- `SungrowTelemetryAdapter` - Maps Sungrow fields → normalized fields
- `OtherVendorTelemetryAdapter` - Maps other vendor fields → normalized fields

### Graph & Visualization Requirements

**Frontend Presentation**:

1. **15-min energy graph** (last 31 days)
2. **Power vs Time graph** (realtime/day)
3. **Daily energy bar chart** (last 31 days)

**Backend Requirements**:

- Query optimized by `(plant_id, ts)` index
- No blocking long scans
- Efficient pagination for large datasets
- Support for real-time updates (WebSocket or polling)

### Failure Recovery

Telemetry Sync must:

- **Retry API failures** with exponential backoff
- **Resume partial backfills** from last successful timestamp
- **Skip corrupted vendor data** and log warnings
- **Log vendor and plant-level failures** in `vendor_sync_logs` table

### Cron Job Integration

- **Daily Sync Cron**: `lib/cron/telemetrySyncCron.js`
  - **Schedule**: Every day at 00:15 local time
  - **Trigger**: `GET /api/cron/sync-telemetry?secret={CRON_SECRET}`
  - **Logic**: Calls `telemetrySyncService.syncAllPlantsDaily()`
  - **Enabled**: `ENABLE_TELEMETRY_SYNC_CRON` environment variable

## Database Client Utilities

### Pooled Clients
- **File**: `lib/supabase/pooled.ts`
- `getMainClient()` - Service role client for main database (connection pooling)
- `getTelemetryClient()` - Service role client for telemetry database (connection pooling)

### Server Client
- **File**: `lib/supabase/server.ts`
- Server-side client for browser interactions (handles cookies)

## Logging & Tracing

### MDC (Mapped Diagnostic Context)
- **File**: `lib/context/mdc.ts`
- Request ID generation and propagation
- Async context preservation

### API Logger
- **File**: `lib/api-logger.ts`
- Structured logging for API requests
- Includes MDC context

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telemetry Database
TELEMETRY_DB_URL=postgresql://...
TELEMETRY_DB_SERVICE_ROLE_KEY=your-telemetry-service-role-key

# Vendor APIs
SOLARMAN_API_BASE_URL=https://globalpro.solarmanpv.com
SOLARMAN_PRO_API_BASE_URL=https://globalpro.solarmanpv.com

# Cron Jobs
ENABLE_PLANT_SYNC_CRON=true
ENABLE_ALERT_SYNC_CRON=true
ENABLE_TELEMETRY_SYNC_CRON=true
CRON_SECRET=your-secret-key

# Application
NODE_ENV=production
```

## Security Requirements

1. **Authentication**: HTTP-only cookies, secure session validation
2. **Authorization**: RBAC checks on all API routes
3. **Database**: Service role client only for backend operations
4. **Cron Endpoints**: Protected with `CRON_SECRET` query parameter
5. **Password Hashing**: bcryptjs with appropriate salt rounds
6. **SQL Injection**: Use parameterized queries (Supabase client handles this)
7. **XSS Protection**: React's built-in escaping, sanitize user inputs

## Performance Requirements

1. **Database**: Connection pooling for all database clients
2. **Caching**: Token caching in database to avoid repeated vendor API calls
3. **Pagination**: All list endpoints support pagination
4. **Indexing**: Proper database indexes on foreign keys and frequently queried columns
5. **Lazy Loading**: Code splitting for large components
6. **Image Optimization**: Next.js Image component for optimized images

## Error Handling

1. **API Routes**: Try-catch blocks, proper HTTP status codes, error messages
2. **Database Errors**: Logged and returned as 500 errors
3. **Vendor API Errors**: Handled gracefully, logged, and retried if appropriate
4. **UI Errors**: Error boundaries for React components
5. **Validation**: Input validation on all user inputs

## Testing Considerations

1. **Unit Tests**: Service functions, utility functions
2. **Integration Tests**: API routes, database operations
3. **E2E Tests**: Critical user flows (login, create work order, sync plants)
4. **Type Safety**: TypeScript strict mode for compile-time checks

## Deployment

1. **Build**: `npm run build` - Next.js production build
2. **Start**: `npm start` - Production server
3. **Dev**: `npm run dev` - Development server with hot reload
4. **Database Migrations**: Run SQL migration files in order
5. **Environment**: Set all required environment variables

## Code Quality Standards

1. **TypeScript**: Strict mode, no `any` types unless necessary
2. **ESLint**: Follow Next.js and React best practices
3. **Formatting**: Consistent code formatting (Prettier recommended)
4. **Comments**: JSDoc comments for complex functions
5. **File Organization**: Logical folder structure, clear naming conventions
6. **DRY Principle**: Reusable components and utilities
7. **Separation of Concerns**: Clear separation between UI, API, services, and database layers

## Migration Strategy

1. **Initial Schema**: `001_initial_schema.sql` - Core tables
2. **Alert Schema**: `001_alert_schema.sql` - Alerts table and related
3. **Additional Migrations**: Numbered sequentially (002, 003, etc.)
4. **Backward Compatibility**: Use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for safe migrations

## UI/UX Requirements

1. **Responsive Design**: Mobile-first, works on all screen sizes
2. **Dark Mode**: Full dark mode support
3. **Loading States**: Skeleton loaders, spinners for async operations
4. **Error States**: Clear error messages, retry buttons
5. **Empty States**: Helpful messages when no data available
6. **Animations**: Smooth transitions (Framer Motion)
7. **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Telemetry Visualization Requirements

1. **15-Minute Energy Graph**: Display last 31 days of 15-minute resolution energy data
2. **Power vs Time Graph**: Real-time and daily power visualization
3. **Daily Energy Bar Chart**: Last 31 days of daily energy aggregation
4. **Query Optimization**: Backend ensures queries optimized by `(plant_id, ts)` index
5. **No Blocking Scans**: Long-running queries must not block UI
6. **Real-Time Updates**: Support for live telemetry updates (WebSocket or polling)

## Future Extensibility

1. **Vendor Adapters**: Easy to add new vendors by implementing `BaseVendorAdapter`
2. **New Features**: Modular architecture allows easy feature additions
3. **Scalability**: Database connection pooling, efficient queries, caching strategies

---

## Implementation Checklist

- [ ] Set up Next.js 14 project with TypeScript
- [ ] Configure Supabase clients (main and telemetry)
- [ ] Implement authentication system (custom sessions)
- [ ] Create database schema (all tables, indexes, triggers)
- [ ] Implement RBAC system
- [ ] Build vendor adapter system (base class, Solarman implementation)
- [ ] Create all API routes with proper authorization
- [ ] Build UI components (shadcn/ui integration)
- [ ] Implement dashboard with role-specific views
- [ ] Build plant management pages
- [ ] Build work order management pages
- [ ] Implement alert sync and display
- [ ] Set up cron jobs for plant and alert syncing
- [ ] **Implement Telemetry System**:
  - [ ] Create `telemetry_15m` table in telemetry database
  - [ ] Implement `telemetrySyncService.ts` with sync modes (daily, backfill)
  - [ ] Add telemetry methods to `BaseVendorAdapter`
  - [ ] Implement vendor-specific telemetry adapters (Solarman, etc.)
  - [ ] Create telemetry API routes (plant, org, workorder, global)
  - [ ] Implement backfill functionality with pagination support
  - [ ] Set up daily sync cron (00:15 local time)
  - [ ] Implement 31-day rolling window retention
  - [ ] Add aggregate computation (daily/monthly/yearly)
  - [ ] Create failure recovery and logging
- [ ] Add telemetry visualization (15-min graphs, power charts, daily bars)
- [ ] Implement efficiency calculations
- [ ] Add error handling and logging
- [ ] Write comprehensive documentation
- [ ] Set up environment variables
- [ ] Test all user flows
- [ ] Deploy to production

---

**Note**: This specification is comprehensive and production-ready. Modify and extend as needed for additional features or requirements.

