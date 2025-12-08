# Alert Sync Configuration

## Overview

The alert sync system automatically fetches alerts from vendor APIs and stores them in the main database. It supports **SOLARMAN** and **SOLARDM** vendors only.

---

## Schedule & Frequency

### Cron Schedule
- **Frequency**: Every 15 minutes (`*/15 * * * *`)
- **Cron File**: `lib/cron/alertSyncCron.js`
- **API Endpoint**: `/api/cron/sync-alerts`
- **Enabled by default**: Yes (can be disabled via `ENABLE_ALERT_SYNC_CRON=false`)

### Environment Variable
```bash
ENABLE_ALERT_SYNC_CRON=true  # Default: true (enabled)
```

---

## Configuration Levels

### 1. Organization Level (`organizations.auto_sync_enabled`)

**Purpose**: Master switch for all sync operations (plant, telemetry, alerts, WMS)

**Behavior**:
- If `auto_sync_enabled = false` → Alert sync is **skipped** for all vendors in that organization
- If `auto_sync_enabled = true` → Alert sync proceeds (subject to vendor-level checks)

**Location**: `organizations` table

---

### 2. Vendor Level

#### Supported Vendors
- ✅ **SOLARMAN**: Uses PRO API station alert endpoint
- ✅ **SOLARDM**: Uses inverter fault API
- ❌ **Other vendors**: Not supported (skipped)

#### Vendor Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `is_active` | BOOLEAN | Must be `true` for sync to run |
| `org_id` | INTEGER | Must not be NULL (vendors must belong to an org) |
| `vendor_type` | ENUM | Must be `SOLARMAN` or `SOLARDM` |
| `credentials.alertsStartDate` | STRING (ISO date) | Optional: Lookback start date (default: 1 year ago) |

#### Lookback Window Configuration

**Field**: `vendor.credentials.alertsStartDate` (stored in JSONB)

**Format**: ISO date string (e.g., `"2024-01-01"`)

**Behavior**:
- If not configured → Defaults to **1 year lookback**
- If configured → Uses configured date (but never more than 1 year)
- Maximum lookback: **1 year** (enforced)

**Example**:
```json
{
  "username": "user@example.com",
  "password": "password123",
  "alertsStartDate": "2024-06-01"  // Only sync alerts from June 1, 2024 onwards
}
```

---

## Sync Process Flow

### 1. Trigger
- **Cron**: Automatic every 15 minutes
- **Manual**: POST `/api/cron/sync-alerts` (SUPERADMIN/DEVELOPER only)

### 2. Vendor Filtering
```typescript
// Step 1: Fetch active vendors with org info
vendors WHERE is_active = true AND org_id IS NOT NULL

// Step 2: Filter by vendor type
vendors WHERE vendor_type IN ('SOLARMAN', 'SOLARDM')

// Step 3: Filter by org auto_sync_enabled
vendors WHERE organizations.auto_sync_enabled = true
```

### 3. Per-Vendor Sync

#### SOLARMAN Sync (`syncSolarmanVendorAlerts`)
- **API**: PRO station alert endpoint
- **Pagination**: Page size = 100, continues until no data
- **Filter**: `deviceType === "INVERTER"` (filtered but not stored)
- **Lookback**: From `alertsStartDate` (or 1 year ago) to now
- **Data Mapping**:
  - `alertTime` → `alert_time`
  - `endTime` → `end_time`
  - `level` + `influence` → `severity` (LOW/MEDIUM/HIGH/CRITICAL)
  - `endTime === null` → `status = ACTIVE`, else → `status = RESOLVED`
- **Calculations**:
  - `grid_down_seconds` = `max(0, end_time - alert_time)`
  - `grid_down_benefit_kwh` = `0.5 × hours(9AM-4PM overlap) × capacity_kw`

#### SolarDM Sync (`syncSolarDmVendorAlerts`)
- **API**: Inverter fault API
- **Pagination**: Page size = 100, continues until `current > pages`
- **Filter**: `faultInfo === "There is no mains voltage"`
- **Lookback**: From `alertsStartDate` (or 1 year ago) to now
- **Data Mapping**:
  - `faultTime` → `alert_time`
  - `recoverTime` → `end_time`
  - `faultLevel` → `severity` (1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL)
  - `recoverTime === null` → `status = ACTIVE`, else → `status = RESOLVED`
- **Calculations**: Same as SOLARMAN

### 4. Alert Deduplication

**Key**: `(vendor_id, vendor_alert_id, plant_id)`

**Behavior**:
- If alert exists → **Update** existing alert
- If alert doesn't exist → **Insert** new alert

---

## API Endpoints

### GET `/api/cron/sync-alerts`
**Purpose**: Cron trigger (automatic)

**Authentication**: 
- `CRON_SECRET` header (if configured)
- Format: `Authorization: Bearer <CRON_SECRET>`

**Response**:
```json
{
  "success": true,
  "message": "Alert sync completed",
  "summary": {
    "totalVendors": 5,
    "successful": 4,
    "failed": 1,
    "totalAlertsSynced": 150,
    "totalAlertsCreated": 20,
    "totalAlertsUpdated": 130,
    "results": [...],
    "duration": 12345
  }
}
```

### POST `/api/cron/sync-alerts`
**Purpose**: Manual trigger (UI)

**Authentication**: Session cookie (SUPERADMIN or DEVELOPER only)

**Response**: Same as GET endpoint

---

## Manual Sync

### Per-Vendor Sync
**Endpoint**: `POST /api/vendors/[id]/sync-alerts`

**Access**: SUPERADMIN, DEVELOPER

**Behavior**: Syncs alerts for a single vendor only

---

## Data Stored

### Alert Fields

| Field | Type | Source |
|-------|------|--------|
| `plant_id` | INTEGER | From `plants` table (mapped via `vendor_plant_id`) |
| `vendor_id` | INTEGER | Vendor that generated the alert |
| `vendor_alert_id` | TEXT | Original alert ID from vendor API |
| `vendor_plant_id` | TEXT | Vendor-specific plant identifier |
| `alert_time` | TIMESTAMPTZ | When alert started (from vendor) |
| `end_time` | TIMESTAMPTZ | When alert ended (nullable, from vendor) |
| `grid_down_seconds` | INTEGER | Calculated: `max(0, end_time - alert_time)` |
| `grid_down_benefit_kwh` | NUMERIC(12,3) | Calculated: `0.5 × hours(9AM-4PM overlap) × capacity_kw` |
| `title` | TEXT | Alert title/type |
| `description` | TEXT | Alert description/message |
| `severity` | ENUM | LOW, MEDIUM, HIGH, CRITICAL |
| `status` | ENUM | ACTIVE, RESOLVED, ACKNOWLEDGED |

---

## Error Handling

- **Vendor-level errors**: Logged but don't stop other vendors from syncing
- **Missing org**: Vendor skipped with warning
- **Invalid credentials**: Vendor sync fails, others continue
- **API errors**: Logged per vendor, summary includes error count

---

## Logging

All sync operations are logged with:
- **Source**: `cron` or `user`
- **Request ID**: Unique UUID per sync run
- **Vendor ID/Name**: Per-vendor context
- **Operation**: `sync-alerts` or `sync-alerts-vendor-{id}`

**Log Levels**:
- `INFO`: Sync start, completion, summary
- `WARN`: Skipped vendors, invalid config
- `ERROR`: API failures, database errors

---

## Current Status

### Supported Vendors
- ✅ SOLARMAN (PRO API)
- ✅ SolarDM (Inverter Fault API)
- ❌ Other vendors (not implemented)

### Features
- ✅ Automatic cron sync (every 15 minutes)
- ✅ Manual sync (per-vendor and all vendors)
- ✅ Organization-level enable/disable
- ✅ Configurable lookback window (per vendor)
- ✅ Alert deduplication
- ✅ Grid downtime calculations
- ✅ Parallel vendor processing

---

## Configuration Checklist

- [ ] `ENABLE_ALERT_SYNC_CRON` environment variable set (default: true)
- [ ] `CRON_SECRET` set (optional but recommended)
- [ ] Organization `auto_sync_enabled = true` (if you want alerts synced)
- [ ] Vendor `is_active = true`
- [ ] Vendor `org_id` is set (not NULL)
- [ ] Vendor `vendor_type` is `SOLARMAN` or `SOLARDM`
- [ ] Vendor `credentials.alertsStartDate` configured (optional, defaults to 1 year)

---

## Troubleshooting

### Alerts Not Syncing

1. **Check cron is enabled**:
   ```bash
   # Check environment variable
   echo $ENABLE_ALERT_SYNC_CRON
   # Should be 'true' or unset (defaults to true)
   ```

2. **Check organization sync**:
   ```sql
   SELECT id, name, auto_sync_enabled 
   FROM organizations 
   WHERE id = <org_id>;
   ```

3. **Check vendor configuration**:
   ```sql
   SELECT id, name, vendor_type, is_active, org_id
   FROM vendors
   WHERE vendor_type IN ('SOLARMAN', 'SOLARDM');
   ```

4. **Check logs**: Look for `[CRON]` or `[sync-alerts]` log entries

### Manual Sync Test

```bash
# Test manual sync (requires SUPERADMIN session cookie)
curl -X POST http://localhost:3000/api/cron/sync-alerts \
  -H "Cookie: session=<your-session-cookie>"
```

---

## Future Enhancements

- [ ] Support for additional vendor types
- [ ] Configurable sync frequency per vendor
- [ ] Alert filtering rules (severity, type, etc.)
- [ ] Alert notification system
- [ ] Alert aggregation/grouping

