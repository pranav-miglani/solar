# Plant-Related Cron Jobs Summary

## Overview

This document lists all cron jobs related to plant synchronization, telemetry, and management.

---

## 1. Plant Sync Cron (`plantSyncCron.js`)

**Purpose:** Synchronizes plant data (metadata, topology, capacity) from all active vendors

**Schedule:** Every 15 minutes (`*/15 * * * *`)

**Endpoint:** `GET /api/cron/sync-plants`

**What it does:**
- Fetches all plants from vendor APIs using `listPlants()`
- Updates plant metadata (name, capacity, location, etc.)
- Only runs for vendors with `plant_sync_mode = 'LIST_PLANTS'`
- Skips vendors with `plant_sync_mode = 'PER_PLANT'` (handled separately)
- Respects restricted time window (8 PM - 5 AM IST) - skips during this window
- Checks vendor's morning/evening sync times for PER_PLANT vendors

**Code Location:** `lib/cron/plantSyncCron.js`

**Service:** `lib/services/plantSyncService.ts` → `syncAllPlants()`

**Enable/Disable:** `ENABLE_PLANT_SYNC_CRON` (default: true)

**Restrictions:**
- Skips during 8 PM - 5 AM IST window (configurable via `RESTRICTED_WINDOW_START` and `RESTRICTED_WINDOW_END`)
- Only syncs LIST_PLANTS mode vendors during regular 15-minute runs
- PER_PLANT vendors are synced at configured morning/evening times

---

## 2. Live Telemetry Sync Cron (`liveTelemetrySyncCron.js`)

**Purpose:** Updates live telemetry fields (current_power_kw, daily_energy_kwh, monthly_energy_mwh, etc.) for all plants

**Schedule:** Every 15 minutes (`*/15 * * * *`)

**Endpoint:** `GET /api/cron/sync-live-telemetry`

**What it does:**
- Updates real-time metrics for all active plants
- Uses `LIST_PLANTS` or `PER_PLANT` mode based on vendor's `telemetry_sync_mode`
- Filters vendors by `telemetry_sync_interval` (15/30/45 min) - only syncs at interval boundaries
- Updates fields: `current_power_kw`, `daily_energy_kwh`, `monthly_energy_mwh`, `yearly_energy_mwh`, `total_energy_mwh`, `network_status`, `last_update_time`
- Does NOT update plant metadata (capacity, name, location) - that's handled by plant sync

**Code Location:** `lib/cron/liveTelemetrySyncCron.js`

**Service:** `lib/services/liveTelemetrySyncService.ts` → `syncAllLiveTelemetry()`

**Enable/Disable:** `ENABLE_LIVE_TELEMETRY_SYNC_CRON` (default: true)

**Interval-Based Sync:**
- Cron runs every 15 minutes
- But only syncs vendors whose `telemetry_sync_interval` matches current time
- Example: Vendor with 30-min interval syncs at :00 and :30 of each hour
- Example: Vendor with 15-min interval syncs at :00, :15, :30, :45

**Restrictions:**
- Skips during 8 PM - 5 AM IST window (configurable via `RESTRICTED_WINDOW_START` and `RESTRICTED_WINDOW_END`)

---

## 3. Disable Inactive Plants Cron (`disableInactivePlantsCron.js`)

**Purpose:** Automatically disables plants that haven't received vendor updates for 3+ days

**Schedule:** Daily at 2:00 AM IST (`30 20 * * *` - 20:30 UTC = 2:00 AM IST next day)

**Endpoint:** `GET /api/cron/disable-inactive-plants`

**What it does:**
- Checks all active plants for inactivity
- Disables plants where `last_update_time` (vendor's last data update) is 3+ days old
- Uses `last_update_time` (not `last_refreshed_at`) to check vendor data freshness
- Marks plants as `is_active = false`
- Copies plant data to `disabled_plants` table
- Only SUPERADMIN and DEVELOPER can delete disabled plants

**Code Location:** `lib/cron/disableInactivePlantsCron.js`

**Service:** Calls SQL function `disable_inactive_plants()` in database

**Enable/Disable:** `ENABLE_DISABLE_INACTIVE_PLANTS_CRON` (default: true)

**Criteria:**
- Plant must have `last_update_time` older than 3 days
- Plant must be currently active (`is_active = true`)
- Plant must have been created at least 3 days ago (to avoid disabling new plants)

---

## 4. Alert Sync Cron (`alertSyncCron.js`)

**Purpose:** Synchronizes alerts/faults from vendor APIs for all active plants

**Schedule:** Every 30 minutes (`*/30 * * * *`)

**Endpoint:** `GET /api/cron/sync-alerts`

**What it does:**
- Fetches alerts from vendor APIs for all active plants
- Updates alert status (active/resolved) in database
- Creates new alerts for new faults
- Resolves alerts when vendor reports fault is cleared
- Vendor-specific alert mapping (e.g., Solarman "No Mains Voltage" → standard format)

**Code Location:** `lib/cron/alertSyncCron.js`

**Service:** `lib/services/alertSyncService.ts` → `syncAllAlerts()`

**Enable/Disable:** `ENABLE_ALERT_SYNC_CRON` (default: true)

**Restrictions:**
- Skips during 8 PM - 5 AM IST window (configurable via `RESTRICTED_WINDOW_START` and `RESTRICTED_WINDOW_END`)

---

## Summary Table

| Cron Job | Schedule | Purpose | Endpoint | Enable Var |
|----------|----------|---------|----------|------------|
| **Plant Sync** | Every 15 min | Sync plant metadata/topology | `/api/cron/sync-plants` | `ENABLE_PLANT_SYNC_CRON` |
| **Live Telemetry** | Every 15 min | Update real-time metrics | `/api/cron/sync-live-telemetry` | `ENABLE_LIVE_TELEMETRY_SYNC_CRON` |
| **Disable Inactive** | Daily 2 AM IST | Disable inactive plants | `/api/cron/disable-inactive-plants` | `ENABLE_DISABLE_INACTIVE_PLANTS_CRON` |
| **Alert Sync** | Every 30 min | Sync alerts/faults | `/api/cron/sync-alerts` | `ENABLE_ALERT_SYNC_CRON` |

---

## Time Restrictions

All sync crons (except Disable Inactive Plants) respect a restricted time window:

- **Default Window:** 8:00 PM - 5:00 AM IST
- **Configurable via:** `RESTRICTED_WINDOW_START` and `RESTRICTED_WINDOW_END` environment variables
- **Purpose:** Avoid syncing during peak vendor API usage hours
- **Behavior:** Cron runs but skips actual sync during this window

---

## Environment Variables

```bash
# Enable/Disable Crons
ENABLE_PLANT_SYNC_CRON=true                    # Plant sync (default: true)
ENABLE_LIVE_TELEMETRY_SYNC_CRON=true           # Live telemetry (default: true)
ENABLE_ALERT_SYNC_CRON=true                    # Alert sync (default: true)
ENABLE_DISABLE_INACTIVE_PLANTS_CRON=true       # Disable inactive (default: true)

# Time Restrictions
RESTRICTED_WINDOW_START=20:00                  # Start of restricted window (IST)
RESTRICTED_WINDOW_END=05:00                    # End of restricted window (IST)

# Security
CRON_SECRET=your-secret-token                  # Optional: Secure cron endpoints
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Plant-Related Crons                       │
└─────────────────────────────────────────────────────────────┘

1. Plant Sync (Every 15 min)
   └─> Fetches plant metadata/topology
   └─> Updates: name, capacity_kw, location, etc.

2. Live Telemetry Sync (Every 15 min)
   └─> Fetches real-time metrics
   └─> Updates: current_power_kw, daily_energy_kwh, etc.

3. Alert Sync (Every 30 min)
   └─> Fetches alerts/faults
   └─> Updates: alerts table

4. Disable Inactive Plants (Daily 2 AM IST)
   └─> Checks last_update_time
   └─> Disables plants inactive 3+ days
```

---

## Notes

1. **Plant Sync vs Live Telemetry:**
   - Plant Sync: Updates plant properties (metadata, topology)
   - Live Telemetry: Updates real-time metrics (power, energy)

2. **LIST_PLANTS vs PER_PLANT:**
   - Plant Sync: Only LIST_PLANTS vendors synced every 15 min
   - PER_PLANTS vendors synced at morning/evening times
   - Live Telemetry: Uses vendor's `telemetry_sync_mode` setting

3. **Interval-Based Sync:**
   - Live Telemetry cron runs every 15 min
   - But only syncs vendors whose interval matches current time
   - Example: 30-min interval vendor syncs at :00 and :30

4. **Disabled Plants:**
   - Continue to receive live telemetry sync until deleted
   - Only SUPERADMIN/DEVELOPER can delete
   - Can be re-enabled manually

