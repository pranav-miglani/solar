# Database Client Usage Guide

This document clarifies which database client should be used for different operations.

## Database Architecture

The system uses **two separate Supabase instances**:

1. **Main Database** (`NEXT_PUBLIC_SUPABASE_URL`)
   - Stores: plants, vendors, organizations, accounts, work orders, alerts
   - Client: `getMainClient()` from `@/lib/supabase/pooled`
   - Logged as: `db: main`

2. **Telemetry Database** (`TELEMETRY_SUPABASE_URL`)
   - Stores: telemetry_readings (24h retention)
   - Client: `getTelemetryClient()` from `@/lib/supabase/pooled`
   - Logged as: `db: telemetry`

## Client Usage Rules

### ✅ Use `getMainClient()` for:

- **Plant Operations**:
  - Reading plants: `supabase.from("plants").select()`
  - Creating/updating plants: `supabase.from("plants").insert()` / `.upsert()`
  - Plant sync operations: All plant data synced from vendors goes to main DB

- **Other Main DB Tables**:
  - `organizations`, `vendors`, `accounts`, `work_orders`, `work_order_plants`, `alerts`

### ✅ Use `getTelemetryClient()` for:

- **Telemetry Operations**:
  - Reading telemetry: `supabase.from("telemetry_readings").select()`
  - Writing telemetry: `supabase.from("telemetry_readings").insert()`
  - All telemetry queries (plant, org, workorder, global)

### ✅ Use Both Clients When Needed:

Some operations require both:
- Read plants from main DB → Query telemetry from telemetry DB
- Example: `/api/telemetry/org/[id]` - reads plants from main, telemetry from telemetry

## Examples

### Plant Sync (Main DB)
```typescript
import { getMainClient } from "@/lib/supabase/pooled"

const supabase = getMainClient()
// Plants go to MAIN database
await supabase.from("plants").upsert(plantData)
```

### Telemetry Write (Telemetry DB)
```typescript
import { getTelemetryClient } from "@/lib/supabase/pooled"

const telemetrySupabase = getTelemetryClient()
// Telemetry goes to TELEMETRY database
await telemetrySupabase.from("telemetry_readings").insert(telemetryData)
```

### Mixed Operation
```typescript
import { getMainClient, getTelemetryClient } from "@/lib/supabase/pooled"

const mainSupabase = getMainClient() // Read plants
const telemetrySupabase = getTelemetryClient() // Read telemetry

// Read from main DB
const { data: plants } = await mainSupabase.from("plants").select()

// Read from telemetry DB
const { data: telemetry } = await telemetrySupabase
  .from("telemetry_readings")
  .select()
```

## Verification

All queries are automatically logged with the database identifier:
- `db: main` - Query to main database
- `db: telemetry` - Query to telemetry database

Check logs to verify correct client usage.

