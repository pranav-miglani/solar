# Cron Implementation Analysis

## Overview

This document provides a comprehensive analysis of the cron job implementation for plant synchronization in the WOMS (Work Order Management System). The cron system automatically syncs plant data from vendor APIs at regular intervals, with support for time-based restrictions, organization-level configuration, and comprehensive logging.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Server Startup (server.js)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. Start Next.js HTTP Server                            │   │
│  │  2. Wait 2 seconds for compilation                      │   │
│  │  3. Initialize Cron Job (plantSyncCron.js)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cron Job (lib/cron/plantSyncCron.js)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Schedule: */15 * * * * (Every 15 minutes)              │   │
│  │                                                           │   │
│  │  On Trigger:                                             │   │
│  │  1. Check time window restrictions (IST)                │   │
│  │  2. Skip if in restricted window (7 PM - 6 AM IST)     │   │
│  │  3. Make HTTP request to /api/cron/sync-plants          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│         API Endpoint (app/api/cron/sync-plants/route.ts)        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GET Handler:                                            │   │
│  │  1. Verify CRON_SECRET (if configured)                  │   │
│  │  2. Check time window restrictions                       │   │
│  │  3. Set MDC context (source: "cron")                    │   │
│  │  4. Call syncAllPlants() service                         │   │
│  │  5. Return summary JSON                                 │   │
│  │                                                           │   │
│  │  POST Handler:                                           │   │
│  │  - Manual trigger (SUPERADMIN only)                      │   │
│  │  - Same flow as GET but with user context                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│      Sync Service (lib/services/plantSyncService.ts)           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  syncAllPlants():                                        │   │
│  │  1. Fetch active vendors with org settings              │   │
│  │  2. Filter by auto_sync_enabled & interval matching     │   │
│  │  3. Process vendors in parallel                          │   │
│  │                                                           │   │
│  │  syncVendorPlants(vendor):                               │   │
│  │  1. Create vendor adapter                                │   │
│  │  2. Validate/refresh token                               │   │
│  │  3. Fetch plants from vendor API                         │   │
│  │  4. Transform & batch upsert to database                 │   │
│  │  5. Update last_synced_at timestamp                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

### Core Files

1. **`server.js`** - Custom Next.js server that initializes the cron job
2. **`lib/cron/plantSyncCron.js`** - Cron job scheduler using node-cron
3. **`app/api/cron/sync-plants/route.ts`** - API endpoint handler
4. **`lib/services/plantSyncService.ts`** - Core sync logic
5. **`lib/api/mdcHelper.ts`** - MDC context helpers for logging
6. **`lib/context/mdc.ts`** - MDC (Mapped Diagnostic Context) implementation
7. **`lib/context/logger.ts`** - Context-aware logger

## Detailed Flow

### 1. Server Initialization (`server.js`)

```javascript
// Server starts Next.js app
app.prepare().then(() => {
  createServer(async (req, res) => {
    // Handle Next.js requests
  }).listen(port, (err) => {
    // After server is ready, start cron job
    setTimeout(() => {
      const { startPlantSyncCron } = require('./lib/cron/plantSyncCron')
      startPlantSyncCron()
    }, 2000) // Wait 2 seconds for Next.js compilation
  })
})
```

**Key Points:**
- Waits 2 seconds after server start to ensure Next.js compilation is complete
- Loads and starts the cron job from `lib/cron/plantSyncCron.js`
- Cron runs in the same Node.js process as the Next.js server

### 2. Cron Job Scheduler (`lib/cron/plantSyncCron.js`)

```javascript
function startPlantSyncCron() {
  const cron = require('node-cron')
  const http = require('http')
  
  // Schedule: Every 15 minutes
  const cronSchedule = '*/15 * * * *'
  
  cronJob = cron.schedule(cronSchedule, async () => {
    // 1. Check time window restrictions (IST timezone)
    // 2. Skip if in restricted window (7 PM - 6 AM IST)
    // 3. Make HTTP GET request to /api/cron/sync-plants
  })
}
```

**Features:**
- **Schedule**: Runs every 15 minutes (`*/15 * * * *`)
- **Time Window Restriction**: Skips sync during 7 PM - 6 AM IST (configurable)
- **HTTP-based**: Makes HTTP request to API endpoint (avoids TypeScript compilation issues)
- **Error Handling**: Logs errors but doesn't crash the cron job

**Time Window Logic:**
```javascript
// Get current IST time
const kolkataTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).formatToParts(now)

// Check if in restricted window (handles midnight spanning)
if (startTimeMinutes > endTimeMinutes) {
  // Window spans midnight (e.g., 19:00 to 06:00)
  inRestrictedWindow = currentTimeMinutes >= startTimeMinutes || 
                       currentTimeMinutes < endTimeMinutes
} else {
  // Normal window
  inRestrictedWindow = currentTimeMinutes >= startTimeMinutes && 
                       currentTimeMinutes < endTimeMinutes
}
```

### 3. API Endpoint (`app/api/cron/sync-plants/route.ts`)

#### GET Handler (Cron Trigger)

```typescript
export async function GET(request: NextRequest) {
  return withMDCContextCron("sync-plants", async () => {
    // 1. Verify CRON_SECRET (if configured)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get("authorization")
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    // 2. Check time window restrictions (same logic as cron job)
    // 3. Execute sync
    const summary = await syncAllPlants()
    
    // 4. Return summary
    return NextResponse.json({ success: true, summary })
  })
}
```

#### POST Handler (Manual Trigger)

```typescript
export async function POST(request: NextRequest) {
  return withMDCContext(request, "sync-plants-manual", async (sessionData) => {
    // Only SUPERADMIN can manually trigger
    if (sessionData.accountType !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    const summary = await syncAllPlants()
    return NextResponse.json({ success: true, summary })
  })
}
```

**Key Features:**
- **Security**: Optional `CRON_SECRET` for protecting the endpoint
- **MDC Context**: Sets `source: "cron"` for all logs
- **Time Window**: Double-checks time restrictions (both cron and API)
- **Error Handling**: Returns structured error responses

### 4. Sync Service (`lib/services/plantSyncService.ts`)

#### Main Function: `syncAllPlants()`

```typescript
export async function syncAllPlants(): Promise<SyncSummary> {
  // 1. Fetch active vendors with organization settings
  const { data: vendors } = await supabase
    .from("vendors")
    .select(`
      *,
      organizations (
        id,
        name,
        auto_sync_enabled,
        sync_interval_minutes
      )
    `)
    .eq("is_active", true)
    .not("org_id", "is", null)
  
  // 2. Filter vendors by organization sync settings
  const vendorsToSync = vendors.filter(vendor => {
    const org = vendor.organizations
    return shouldSyncOrg(org) // Checks auto_sync_enabled & interval matching
  })
  
  // 3. Process all vendors in parallel
  const results = await Promise.all(
    vendorsToSync.map(vendor => 
      MDC.withContextAsync(
        { vendorId: vendor.id, vendorName: vendor.name },
        () => syncVendorPlants(vendor, supabase)
      )
    )
  )
  
  // 4. Calculate and return summary
  return {
    totalVendors: vendorsToSync.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalPlantsSynced: results.reduce((sum, r) => sum + r.synced, 0),
    totalPlantsCreated: results.reduce((sum, r) => sum + r.created, 0),
    totalPlantsUpdated: results.reduce((sum, r) => sum + r.updated, 0),
    results,
    duration: Date.now() - startTime
  }
}
```

#### Organization Sync Logic: `shouldSyncOrg()`

```typescript
function shouldSyncOrg(org: any): boolean {
  if (!org.auto_sync_enabled) {
    return false
  }
  
  const intervalMinutes = org.sync_interval_minutes || 15
  
  // Get current IST time
  const kolkataTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    minute: "2-digit",
  }).formatToParts(now)
  
  const currentMinute = parseInt(kolkataTime.find(p => p.type === "minute")?.value || "0")
  
  // Check if current minute matches interval boundary
  // For 15-min interval: sync at :00, :15, :30, :45
  // For 30-min interval: sync at :00, :30
  // For 60-min interval: sync at :00
  const currentInterval = Math.floor(currentMinute / intervalMinutes)
  const expectedMinute = currentInterval * intervalMinutes
  
  return currentMinute === expectedMinute
}
```

**Key Features:**
- **Organization-level Control**: Each organization can enable/disable auto-sync
- **Configurable Intervals**: Organizations can set `sync_interval_minutes` (15, 30, 60, etc.)
- **Time-based Matching**: Only syncs when current minute matches interval boundary
- **Parallel Processing**: All vendors processed simultaneously (no concurrency limit)

#### Vendor Sync: `syncVendorPlants()`

```typescript
async function syncVendorPlants(vendor: any, supabase: any): Promise<SyncResult> {
  // 1. Create vendor adapter
  const adapter = VendorManager.getAdapter(vendorConfig)
  
  // 2. Set token storage (for token caching)
  if (typeof adapter.setTokenStorage === "function") {
    adapter.setTokenStorage(vendor.id, supabase)
  }
  
  // 3. Validate/refresh token
  const tokenValid = await validateAndRefreshToken(adapter, vendor.id, supabase)
  if (!tokenValid) {
    return { success: false, error: "Token validation failed" }
  }
  
  // 4. Fetch plants from vendor API
  const vendorPlants = await adapter.listPlants()
  
  // 5. Transform plant data
  const plantDataArray = vendorPlants.map(plant => ({
    org_id: vendor.org_id,
    vendor_id: vendor.id,
    vendor_plant_id: plant.id.toString(),
    name: plant.name,
    capacity_kw: plant.capacityKw,
    // ... other fields
  }))
  
  // 6. Batch upsert to database (batches of 100)
  const BATCH_SIZE = 100
  for (let i = 0; i < plantDataArray.length; i += BATCH_SIZE) {
    const batch = plantDataArray.slice(i, i + BATCH_SIZE)
    await supabase.from("plants").upsert(batch, {
      onConflict: "vendor_id,vendor_plant_id"
    })
  }
  
  // 7. Update last_synced_at timestamp
  await supabase
    .from("vendors")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", vendor.id)
  
  return result
}
```

**Key Features:**
- **Token Management**: Automatically validates and refreshes tokens
- **Vendor Agnostic**: Works with any vendor adapter (Solarman, Sungrow, etc.)
- **Batch Processing**: Upserts plants in batches of 100 for efficiency
- **Error Isolation**: One vendor failure doesn't stop others
- **Upsert Logic**: Uses `vendor_id,vendor_plant_id` as unique constraint

### 5. MDC Context System

The system uses MDC (Mapped Diagnostic Context) for structured logging and context propagation.

#### MDC Implementation (`lib/context/mdc.ts`)

```typescript
class MDC {
  private static storage = new AsyncLocalStorage<MDCContext>()
  
  static runAsync<T>(context: Partial<MDCContext>, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(fullContext, fn)
  }
  
  static getContext(): MDCContext | undefined {
    return this.storage.getStore()
  }
}
```

**Context Properties:**
- `source`: "user" | "cron" | "system" | "api"
- `requestId`: Unique request identifier
- `operation`: Operation name (e.g., "sync-plants")
- `vendorId`, `vendorName`: Vendor context
- `orgId`: Organization context
- `userEmail`: User email for tracking

#### Context Propagation

```typescript
// In API endpoint
withMDCContextCron("sync-plants", async () => {
  // Context: { source: "cron", operation: "sync-plants" }
  
  await syncAllPlants() // Context automatically propagated
  
  // Inside syncAllPlants
  MDC.withContextAsync(
    { vendorId: vendor.id },
    () => syncVendorPlants(vendor) // Context: { source: "cron", vendorId: 1, ... }
  )
})
```

#### Logger Integration (`lib/context/logger.ts`)

```typescript
logger.info("Starting sync") 
// Output: [2024-01-01T00:00:00.000Z] [CRON] [sync-plants] [INFO] Starting sync

logger.error("Sync failed", error)
// Output: [2024-01-01T00:00:00.000Z] [CRON] [sync-plants] [ERROR] Sync failed: ...
```

**Log Format:**
```
[timestamp] [SOURCE] [OPERATION] [LEVEL] [Vendor:ID] [Org:ID] message
```

## Configuration

### Environment Variables

```bash
# Enable/disable cron (default: true)
ENABLE_PLANT_SYNC_CRON=true

# Secret token for securing cron endpoint (optional)
CRON_SECRET=your-secret-token-here

# Time window restrictions (IST timezone)
SYNC_WINDOW_START=19:00  # 7 PM IST (default)
SYNC_WINDOW_END=06:00    # 6 AM IST (default)

# Cron schedule (for external cron services)
PLANT_SYNC_CRON_SCHEDULE="*/15 * * * *"
```

### Database Configuration

**Organizations Table:**
- `auto_sync_enabled` (boolean): Enable/disable auto-sync for organization
- `sync_interval_minutes` (integer): Sync interval (15, 30, 60, etc.)

**Vendors Table:**
- `is_active` (boolean): Only active vendors are synced
- `org_id` (integer): Must be assigned to an organization
- `last_synced_at` (timestamp): Updated after successful sync

## Alert Sync (Separate System)

**Note**: Alert syncing is implemented as a **separate Supabase Edge Function** (`supabase/functions/sync-alerts/index.ts`), not part of the main cron flow.

### Alert Sync Flow

```
Supabase Edge Function (sync-alerts)
  ↓
1. Fetch all active plants
2. For each plant:
   - Get vendor adapter
   - Fetch alerts from vendor API
   - Upsert alerts to database
3. Return summary
```

**Key Differences:**
- Runs as Supabase Edge Function (Deno runtime)
- Separate from plant sync cron
- Can be triggered independently
- Processes alerts for all active plants

**To integrate alert sync into cron:**
1. Create API endpoint: `/api/cron/sync-alerts`
2. Add alert sync call in cron job or sync service
3. Or trigger Supabase Edge Function from cron

## Error Handling

### Cron Job Level
- Errors are logged but don't crash the cron job
- HTTP request errors are caught and logged
- Cron continues to run on next schedule

### API Endpoint Level
- Returns structured error responses
- Logs errors with full context
- Time window violations return `skipped: true`

### Sync Service Level
- Individual vendor failures don't stop other vendors
- Batch errors fall back to individual upserts
- Errors are collected and returned in summary

## Monitoring & Logging

### Log Messages

**Cron Job:**
```
✅ Plant sync cron job initialized - running every 15 minutes
🕐 Plant sync cron triggered at 14:30 IST
⏸️ Plant sync skipped - in restricted time window (19:00 - 06:00 IST)
✅ Sync complete: 4/5 vendors successful
```

**Sync Service:**
```
🚀 Starting plant sync for all organizations (source: cron)...
Found 5 active vendor(s)
Processing 3 vendor(s) from organizations with auto-sync enabled
✅ Vendor Solarman Vendor 1: 250/250 plants synced (10 created, 240 updated) in 45230ms
✅ Sync complete: 3/3 vendors successful, 750 plants synced in 120000ms
```

### Summary Response

```json
{
  "success": true,
  "message": "Plant sync completed",
  "summary": {
    "totalVendors": 5,
    "successful": 4,
    "failed": 1,
    "totalPlantsSynced": 1250,
    "totalPlantsCreated": 50,
    "totalPlantsUpdated": 1200,
    "duration": 45230,
    "results": [
      {
        "vendorId": 1,
        "vendorName": "Solarman Vendor 1",
        "orgId": 3,
        "orgName": "Organization A",
        "success": true,
        "synced": 250,
        "created": 10,
        "updated": 240,
        "total": 250,
        "error": null
      }
    ]
  }
}
```

## Testing

### Manual Trigger (SUPERADMIN)

```bash
# POST request with session cookie
curl -X POST \
  -H "Cookie: session=<session-cookie>" \
  http://localhost:3000/api/cron/sync-plants
```

### Cron Endpoint (with secret)

```bash
# GET request with CRON_SECRET
curl -X GET \
  -H "Authorization: Bearer <CRON_SECRET>" \
  http://localhost:3000/api/cron/sync-plants
```

### Direct Service Call

```typescript
import { syncAllPlants } from "@/lib/services/plantSyncService"

// In test or script
const summary = await syncAllPlants()
console.log(summary)
```

## Deployment Considerations

### Vercel Deployment

- Cron jobs can be configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-plants",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

- Note: Current `vercel.json` has empty crons array
- Server-side cron (`server.js`) won't work on Vercel (serverless)
- Use Vercel Cron Jobs or external cron service

### Self-Hosted / Custom Server

- Server-side cron works perfectly
- Runs in same process as Next.js server
- No additional configuration needed

### External Cron Services

- GitHub Actions
- cron-job.org
- EasyCron
- Any HTTP cron service

## Key Design Decisions

1. **HTTP-based Cron**: Cron job makes HTTP request to API endpoint
   - **Why**: Avoids TypeScript compilation issues
   - **Benefit**: Clean separation, easy to test

2. **Time Window Restrictions**: Skips sync during 7 PM - 6 AM IST
   - **Why**: Avoids syncing during peak hours or maintenance
   - **Configurable**: Via `SYNC_WINDOW_START` and `SYNC_WINDOW_END`

3. **Organization-level Control**: Each org can configure sync
   - **Why**: Different organizations may have different requirements
   - **Benefit**: Flexible, granular control

4. **Interval-based Matching**: Only syncs at interval boundaries
   - **Why**: Prevents duplicate syncs if cron runs multiple times
   - **Example**: 15-min interval syncs at :00, :15, :30, :45

5. **Parallel Processing**: All vendors processed simultaneously
   - **Why**: Faster sync, better resource utilization
   - **Trade-off**: Higher concurrent load

6. **MDC Context**: Structured logging with context propagation
   - **Why**: Better observability, easier debugging
   - **Benefit**: All logs include source, operation, vendor, org

## Importing to Another Branch

To import this cron functionality to another branch:

1. **Copy Files:**
   - `server.js` (or integrate cron initialization)
   - `lib/cron/plantSyncCron.js`
   - `app/api/cron/sync-plants/route.ts`
   - `lib/services/plantSyncService.ts`
   - `lib/api/mdcHelper.ts`
   - `lib/context/mdc.ts`
   - `lib/context/logger.ts`

2. **Install Dependencies:**
   ```bash
   npm install node-cron
   npm install --save-dev @types/node-cron
   ```

3. **Update Environment Variables:**
   - Add `CRON_SECRET`, `SYNC_WINDOW_START`, `SYNC_WINDOW_END`

4. **Database Schema:**
   - Ensure `organizations` table has `auto_sync_enabled` and `sync_interval_minutes`
   - Ensure `vendors` table has `last_synced_at`

5. **Vendor Adapter:**
   - Ensure vendor adapters implement `setTokenStorage()` method
   - Ensure adapters support token caching/refresh

6. **For Alert Sync:**
   - Copy `supabase/functions/sync-alerts/index.ts`
   - Create API endpoint `/api/cron/sync-alerts` (optional)
   - Integrate into cron flow if needed

## Troubleshooting

### Cron Not Running
- Check server logs for "✅ Plant sync cron job initialized"
- Verify `server.js` is being used (not just `next dev`)
- Check for errors in cron initialization

### Sync Not Triggering
- Verify time window restrictions
- Check organization `auto_sync_enabled` setting
- Verify `sync_interval_minutes` matches current time
- Check cron schedule matches current minute

### Token Validation Failures
- Check vendor credentials in database
- Verify vendor API is accessible
- Check token expiry logic in vendor adapter

### Database Errors
- Verify database connection
- Check RLS policies (service role key should bypass)
- Verify table schemas match expected structure

## Future Enhancements

1. **Alert Sync Integration**: Integrate alert sync into main cron flow
2. **Retry Logic**: Add retry mechanism for failed syncs
3. **Concurrency Control**: Add configurable concurrency limit
4. **Metrics**: Add Prometheus/metrics collection
5. **Notifications**: Send notifications on sync failures
6. **Scheduling UI**: Allow users to configure sync schedules via UI

