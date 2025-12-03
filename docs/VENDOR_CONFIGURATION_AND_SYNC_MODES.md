# Vendor Configuration & Sync Modes - Complete Guide

## Overview

This document explains all vendor configuration attributes and how the two sync modes work:
1. **Plant Sync Mode** - Controls how plant listing and basic info is synced
2. **Live Telemetry Sync Mode** - Controls how live telemetry (power, energy) is synced

---

## Vendor Configuration Attributes

### Database Schema (vendors table)

All vendor configuration is stored in the `vendors` table with the following fields:

#### 1. Basic Vendor Information

| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | TEXT | Vendor name (e.g., "Solarman", "SolarDM") |
| `vendor_type` | ENUM | Vendor type: `SOLARMAN`, `SOLARDM`, `SHINEMONITOR`, `PVBLINK`, `FOXESSCLOUD`, `OTHER` |
| `org_id` | INTEGER | Organization this vendor belongs to (nullable for global vendors) |
| `credentials` | JSONB | Encrypted API credentials (vendor-specific) |
| `is_active` | BOOLEAN | Whether vendor is active (default: true) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### 2. Token Storage (for API authentication)

| Field | Type | Description |
|-------|------|-------------|
| `access_token` | TEXT | Cached access token from vendor API |
| `refresh_token` | TEXT | Refresh token for token renewal (if supported) |
| `token_expires_at` | TIMESTAMPTZ | Token expiration timestamp |
| `token_metadata` | JSONB | Additional token metadata (token_type, scope, expires_in, etc.) |
| `last_synced_at` | TIMESTAMPTZ | Last time plants were synced from this vendor |

#### 3. Plant Sync Mode Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `plant_sync_mode` | TEXT | `'LIST_PLANTS'` | Controls how plant sync runs: `'LIST_PLANTS'` or `'PER_PLANT'` |
| `per_plant_sync_interval_minutes` | INTEGER | `15` | Interval for per-plant sync (reserved for future use) |
| `plant_list_sync_morning_ist` | TIME | `'06:00'` | Morning time (IST) for listPlants() sync when `plant_sync_mode = PER_PLANT` |
| `plant_list_sync_evening_ist` | TIME | `'23:00'` | Evening time (IST) for listPlants() sync when `plant_sync_mode = PER_PLANT` |

#### 4. Live Telemetry Sync Mode Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `telemetry_sync_mode` | TEXT | `'LIST_PLANTS'` | Controls how live telemetry is synced: `'LIST_PLANTS'` or `'PER_PLANT'` |
| `telemetry_sync_interval` | INTEGER | `15` | Interval in minutes (15, 30, or 45) for live telemetry sync |

#### 5. Restricted Sync Window (Per-Vendor)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `restricted_sync_window_start_ist` | TIME | `'20:00'` | Start time (IST) when syncs are skipped (default: 8 PM) |
| `restricted_sync_window_end_ist` | TIME | `'05:00'` | End time (IST) when syncs are skipped (default: 5 AM) |

**Note:** If sync window spans midnight (e.g., 20:00 to 05:00), syncs are skipped during that period.

---

## Sync Mode 1: Plant Sync Mode

### Purpose
Controls how **plant listing and basic plant information** is synced. This includes:
- Plant topology (id, name, capacity, location)
- Basic metadata (network status, created date, operating time)
- **Does NOT include live telemetry** (power, energy metrics)

### When It Runs
- **Twice daily** at configured times (morning and evening)
- **Manual/force sync** on user request
- Runs via cron: `lib/cron/plantSyncCron.js` → `GET /api/cron/sync-plants`

### Mode Options

#### `LIST_PLANTS` Mode (Default for Solarman, ShineMonitor)

**How it works:**
1. Calls `adapter.listPlants()` once to get all plants
2. Upserts all plants into database with topology and basic info
3. If live telemetry is available in `listPlants()` response, optionally enriches plants
4. Updates: `name`, `capacity_kw`, `location`, `network_status`, `vendor_created_date`, `start_operating_time`

**Used by:**
- Solarman
- ShineMonitor
- Foxesscloud
- Default for most vendors

**Example:**
```typescript
// Single API call gets all plants
const plants = await adapter.listPlants()
// Upsert all plants to database
await supabase.from('plants').upsert(plants)
```

#### `PER_PLANT` Mode (Default for SolarDM, PVBlink)

**How it works:**
1. **During regular cron (15-minute intervals):** Skips plant sync entirely
2. **Twice daily (morning/evening):** Calls `adapter.listPlants()` to refresh plant topology
3. Live telemetry is handled separately by Live Telemetry Sync Mode
4. Purpose: Avoid expensive `listPlants()` calls during regular syncs

**Used by:**
- SolarDM
- PVBlink

**Example:**
```typescript
// During regular cron: Skip (no API calls)
if (plantSyncMode === 'PER_PLANT') {
  return // Skip sync
}

// During morning/evening sync: Full listPlants() refresh
const plants = await adapter.listPlants()
await supabase.from('plants').upsert(plants)
```

### Configuration Example

```sql
-- Solarman vendor (LIST_PLANTS mode)
UPDATE vendors SET
  plant_sync_mode = 'LIST_PLANTS',
  plant_list_sync_morning_ist = '06:00',
  plant_list_sync_evening_ist = '23:00'
WHERE vendor_type = 'SOLARMAN';

-- SolarDM vendor (PER_PLANT mode)
UPDATE vendors SET
  plant_sync_mode = 'PER_PLANT',
  plant_list_sync_morning_ist = '06:00',
  plant_list_sync_evening_ist = '20:00'
WHERE vendor_type = 'SOLARDM';
```

---

## Sync Mode 2: Live Telemetry Sync Mode

### Purpose
Controls how **live telemetry fields** are synced. This includes:
- `current_power_kw` - Current generation power
- `daily_energy_kwh` - Daily energy generation
- `monthly_energy_mwh` - Monthly energy generation
- `yearly_energy_mwh` - Yearly energy generation
- `total_energy_mwh` - Total cumulative energy
- `network_status` - Network connectivity status
- `last_update_time` - Last time data was updated from vendor

### When It Runs
- **Interval-based:** Every 15, 30, or 45 minutes (configurable per vendor)
- Syncs run at fixed clock times:
  - 15 min: `:00`, `:15`, `:30`, `:45`
  - 30 min: `:00`, `:30`
  - 45 min: `:00`, `:45`
- Runs via cron: `lib/cron/liveTelemetrySyncCron.js` → `GET /api/cron/sync-live-telemetry`
- **Respects restricted sync window** (skips syncs during configured hours)

### Mode Options

#### `LIST_PLANTS` Mode (Efficient - Single API Call)

**How it works:**
1. Calls `adapter.listPlants()` once to get all plants with live telemetry
2. Extracts telemetry fields from each plant's metadata
3. Updates all plants in database in batches (100 plants per transaction)
4. **Most efficient** - single API call for all plants

**Used by:**
- Solarman (when `listPlants()` provides live telemetry)
- ShineMonitor
- Default for most vendors

**Example:**
```typescript
// Single API call gets all plants with telemetry
const allPlants = await adapter.listPlants()

// Extract telemetry from metadata
for (const plantData of allPlants) {
  const metadata = plantData.metadata || {}
  updates.push({
    id: plant.id,
    current_power_kw: metadata.currentPowerKw,
    daily_energy_kwh: metadata.dailyEnergyKwh,
    // ... other fields
  })
}

// Batch update (100 plants per transaction)
await supabase.from('plants').update(updates)
```

#### `PER_PLANT` Mode (Costly - Individual API Calls)

**How it works:**
1. Fetches all active plants from database
2. For each plant, calls `adapter.listPlant(vendorPlantId)` individually
3. Fetches in batches of 50 plants (parallel API calls)
4. Updates database in batches of 100 plants per transaction
5. **More expensive** - one API call per plant, but necessary for some vendors

**Used by:**
- SolarDM (when `listPlants()` doesn't provide live telemetry)
- PVBlink
- Any vendor where `listPlants()` doesn't include telemetry

**Example:**
```typescript
// Fetch all active plants
const plants = await supabase.from('plants').select('id, vendor_plant_id')
  .eq('vendor_id', vendorId).eq('is_active', true)

// Fetch telemetry for each plant (batched in parallel)
const batchSize = 50
for (let i = 0; i < plants.length; i += batchSize) {
  const batch = plants.slice(i, i + batchSize)
  const promises = batch.map(plant => 
    adapter.listPlant(plant.vendor_plant_id)
  )
  const results = await Promise.all(promises)
  
  // Extract telemetry and prepare updates
  // ...
}

// Batch update (100 plants per transaction)
await supabase.from('plants').update(updates)
```

### Configuration Example

```sql
-- Solarman vendor (LIST_PLANTS mode - efficient)
UPDATE vendors SET
  telemetry_sync_mode = 'LIST_PLANTS',
  telemetry_sync_interval = 15
WHERE vendor_type = 'SOLARMAN';

-- SolarDM vendor (PER_PLANT mode - necessary)
UPDATE vendors SET
  telemetry_sync_mode = 'PER_PLANT',
  telemetry_sync_interval = 15
WHERE vendor_type = 'SOLARDM';
```

---

## Key Differences Summary

| Aspect | Plant Sync Mode | Live Telemetry Sync Mode |
|--------|----------------|-------------------------|
| **Purpose** | Sync plant listing & topology | Sync live telemetry (power, energy) |
| **Frequency** | Twice daily (morning/evening) | Every 15/30/45 minutes |
| **Fields Updated** | `name`, `capacity_kw`, `location`, `network_status`, `vendor_created_date`, `start_operating_time` | `current_power_kw`, `daily_energy_kwh`, `monthly_energy_mwh`, `yearly_energy_mwh`, `total_energy_mwh`, `network_status`, `last_update_time` |
| **LIST_PLANTS Mode** | Calls `listPlants()` twice daily | Calls `listPlants()` every interval |
| **PER_PLANT Mode** | Calls `listPlants()` twice daily only | Calls `listPlant()` for each plant every interval |
| **Default for Solarman** | `LIST_PLANTS` | `LIST_PLANTS` |
| **Default for SolarDM** | `PER_PLANT` | `PER_PLANT` |

---

## Complete Vendor Configuration Example

```sql
-- Example: SolarDM vendor configuration
INSERT INTO vendors (
  name,
  vendor_type,
  org_id,
  credentials,
  is_active,
  -- Plant Sync Mode
  plant_sync_mode,
  plant_list_sync_morning_ist,
  plant_list_sync_evening_ist,
  -- Live Telemetry Sync Mode
  telemetry_sync_mode,
  telemetry_sync_interval,
  -- Restricted Sync Window
  restricted_sync_window_start_ist,
  restricted_sync_window_end_ist
) VALUES (
  'SolarDM Production',
  'SOLARDM',
  1,
  '{"email": "user@example.com", "passwordRSA": "encrypted"}',
  true,
  -- Plant sync: PER_PLANT (only sync twice daily)
  'PER_PLANT',
  '06:00',
  '20:00',
  -- Telemetry sync: PER_PLANT (fetch each plant individually)
  'PER_PLANT',
  15,
  -- Restricted window: Skip syncs 8 PM - 5 AM IST
  '20:00',
  '05:00'
);
```

---

## How Syncs Work Together

### Scenario 1: Solarman (LIST_PLANTS for both)

1. **Plant Sync (twice daily):**
   - Calls `listPlants()` → Gets all plants with topology
   - Upserts to database

2. **Live Telemetry Sync (every 15 min):**
   - Calls `listPlants()` → Gets all plants with live telemetry
   - Updates telemetry fields in database

### Scenario 2: SolarDM (PER_PLANT for both)

1. **Plant Sync (twice daily):**
   - Morning (06:00): Calls `listPlants()` → Refreshes plant topology
   - Evening (20:00): Calls `listPlants()` → Refreshes plant topology
   - Regular cron (15-min): Skips (no API calls)

2. **Live Telemetry Sync (every 15 min):**
   - Fetches all active plants from database
   - For each plant: Calls `listPlant(vendorPlantId)` → Gets live telemetry
   - Updates telemetry fields in database

---

## Best Practices

1. **Use LIST_PLANTS when possible** - Most efficient (single API call)
2. **Use PER_PLANT only when necessary** - When vendor doesn't provide telemetry in `listPlants()`
3. **Set appropriate intervals** - 15 min for critical systems, 30-45 min for less critical
4. **Configure restricted windows** - Skip syncs during off-peak hours to reduce API load
5. **Monitor sync performance** - Check logs for failed syncs and adjust accordingly

---

## Troubleshooting

### Plant Sync Not Running
- Check `plant_sync_mode` configuration
- Verify cron is enabled: `ENABLE_PLANT_SYNC_CRON=true`
- Check vendor `is_active` status

### Live Telemetry Not Updating
- Check `telemetry_sync_mode` configuration
- Verify cron is enabled: `ENABLE_LIVE_TELEMETRY_SYNC_CRON=true`
- Check `telemetry_sync_interval` matches current time (syncs at fixed clock times)
- Verify restricted sync window isn't blocking syncs

### Too Many API Calls
- Switch to `LIST_PLANTS` mode if vendor supports it
- Increase `telemetry_sync_interval` (15 → 30 → 45 minutes)
- Configure restricted sync window to skip off-peak hours

