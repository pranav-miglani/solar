# Sync Frequencies - Complete Reference

## Overview

This document lists all sync operations, their frequencies, schedules, and configuration options.

---

## 1. Alert Sync

### Frequency
- **Cron Schedule**: Every **hour** (`0 * * * *`) - Runs at minute 0 of every hour
- **Cron File**: `lib/cron/alertSyncCron.js`
- **API Endpoint**: `/api/cron/sync-alerts`

### Configuration
- **Enable/Disable**: `ENABLE_ALERT_SYNC_CRON` (default: `true`)
- **Restricted Window**: ❌ **No restrictions** (runs 24/7)

### What It Syncs
- Alerts from **SOLARMAN** and **SolarDM** vendors only
- Filters by `organizations.auto_sync_enabled`
- Lookback window: Configurable per vendor (`credentials.alertsStartDate`, default: 1 year)

### Details
- Processes vendors in parallel
- Deduplicates by `(vendor_id, vendor_alert_id, plant_id)`
- Calculates `grid_down_seconds` and `grid_down_benefit_kwh`

---

## 2. Plant Sync

### Frequency
- **Cron Schedule**: Every **15 minutes** (`*/15 * * * *`)
- **Actual Sync**: **Once daily** at vendor-configured time (default: **02:00 IST**)
- **Cron File**: `lib/cron/plantSyncCron.js`
- **API Endpoint**: `/api/cron/sync-plants`

### Configuration
- **Enable/Disable**: `ENABLE_PLANT_SYNC_CRON` (default: `true`)
- **Vendor Time**: `vendors.plant_sync_time_ist` (default: `"02:00"`)
- **Restricted Window**: ❌ **No restrictions** (can run at 2 AM)

### What It Syncs
- Plant metadata (name, capacity, location)
- Production metrics (if available in `listPlants()`)
- Plant topology/structure
- Only syncs vendors at their configured time (checks every 15 min)

### Details
- Cron runs every 15 min but only syncs vendors at their configured time
- Filters by `organizations.auto_sync_enabled`
- Always calls `adapter.listPlants()` (no mode-based branching)

---

## 3. Live Telemetry Sync

### Frequency
- **Cron Schedule**: Every **15 minutes** (`*/15 * * * *`)
- **Vendor-Specific**: Based on `vendors.telemetry_sync_interval` (15/30/45 minutes)
- **Cron File**: `lib/cron/liveTelemetrySyncCron.js`
- **API Endpoint**: `/api/cron/sync-live-telemetry`

### Configuration
- **Enable/Disable**: `ENABLE_LIVE_TELEMETRY_SYNC_CRON` (default: `true`)
- **Vendor Interval**: `vendors.telemetry_sync_interval` (default: `15` minutes)
- **Restricted Window**: ✅ **Yes** - Skips during **8 PM - 5 AM IST** (configurable)
  - `RESTRICTED_WINDOW_START` (default: `"20:00"`)
  - `RESTRICTED_WINDOW_END` (default: `"05:00"`)

### What It Syncs
- `current_power_kw` (current generation power)
- `daily_energy_kwh` (today's energy)
- `monthly_energy_mwh` (month-to-date)
- `yearly_energy_mwh` (year-to-date)
- `total_energy_mwh` (cumulative)
- `network_status` (NORMAL/OFFLINE/etc.)
- `was_online_today` (sets to `true` if `network_status = "NORMAL"`)

### Details
- Cron runs every 15 min
- Only syncs vendors whose `telemetry_sync_interval` matches current time boundary
- Example: Vendor with `telemetry_sync_interval = 30` syncs at :00 and :30 of each hour
- Filters by `organizations.auto_sync_enabled`
- Skips during restricted window (8 PM - 5 AM IST)

### Sync Modes
- **LIST_PLANTS**: Single API call for all plants (efficient)
- **PER_PLANT**: Individual API calls per plant (costly but necessary for some vendors)
- Controlled by `vendors.telemetry_sync_mode` (not `plant_sync_mode`)

---

## 4. WMS Site Sync

### Frequency
- **Cron Schedule**: **Twice daily** (`0 6,22 * * *`)
- **Times**: **6:00 AM IST** and **10:00 PM IST**
- **Cron File**: `lib/cron/wmsSiteSyncCron.js`
- **API Endpoint**: `/api/cron/sync-wms-sites`

### Configuration
- **Enable/Disable**: `ENABLE_WMS_SITE_SYNC_CRON` (default: `true`)
- **Restricted Window**: ❌ **No restrictions**

### What It Syncs
- WMS sites (locations)
- WMS devices (weather monitoring devices)
- Updates site/device metadata

---

## 5. WMS Insolation Sync

### Frequency
- **Cron Schedule**: **Daily at 6:00 AM IST** (`0 6 * * *`)
- **Cron File**: `lib/cron/wmsInsolationSyncMorningCron.js`
- **API Endpoint**: `/api/cron/sync-wms-insolation-morning`

### Configuration
- **Enable/Disable**: `ENABLE_WMS_INSOLATION_SYNC_MORNING_CRON` (default: `true`)
- **Restricted Window**: ❌ **No restrictions**

### What It Syncs
- **Yesterday's** insolation data (safety check)
- Syncs for all WMS vendors
- Data stored in `insolation_readings` table (100-day rolling retention)

### Note
- **End-of-day cron removed** (was syncing today's data)
- Only morning sync remains (syncs yesterday's data)

---

## 6. Disable Inactive Plants

### Frequency
- **Cron Schedule**: **Daily at 2:00 AM IST** (`30 20 * * *` UTC)
- **Cron File**: `lib/cron/disableInactivePlantsCron.js`
- **API Endpoint**: `/api/cron/disable-inactive-plants`

### Configuration
- **Enable/Disable**: `ENABLE_DISABLE_INACTIVE_PLANTS_CRON` (default: `true`)
- **Restricted Window**: ❌ **No restrictions**

### What It Does
- Marks plants as inactive if no telemetry updates for **3+ days**
- Uses `plants.last_update_time` to determine inactivity
- Stores disabled plants in `disabled_plants` table

---

## 7. Analytics Config Mirror

### Frequency
- **Cron Schedule**: **Daily at ~9:30 PM IST** (`0 16 * * *` UTC, configurable)
- **Cron File**: `lib/cron/analyticsConfigMirrorCron.js`
- **API Endpoint**: `/api/cron/analytics/mirror-config`

### Configuration
- **Enable/Disable**: `ENABLE_ANALYTICS_CONFIG_CRON` (default: `true`)
- **Schedule**: `ANALYTICS_CONFIG_CRON_SCHEDULE` (default: `"0 16 * * *"`)

### What It Syncs
- Mirrors `organizations` from main DB to analytics DB
- Mirrors `vendors` from main DB to analytics DB
- Mirrors `plants` from main DB to analytics DB (batches of 100)
- Uses hash-based change detection (only updates if config changed)
- Sets `config_ready = true` and `config_last_status = success` in analytics DB

---

## 8. Analytics Energy Snapshot

### Frequency
- **Cron Schedule**: **Daily at 10:00 PM IST** (`30 16 * * *` UTC, configurable)
- **Cron File**: `lib/cron/analyticsSnapshotCron.js`
- **API Endpoint**: `/api/cron/analytics/snapshot-energy`

### Configuration
- **Enable/Disable**: `ENABLE_ANALYTICS_SNAPSHOT_CRON` (default: `true`)
- **Schedule**: `ANALYTICS_SNAPSHOT_CRON_SCHEDULE` (default: `"30 16 * * *"`)

### What It Syncs
- Captures **today's** energy snapshot for all plants
- Reads from main DB `plants` table
- Stores in analytics DB `plant_energy_readings` table
- Includes `was_online` status (copied from `plants.was_online_today`)
- Resets `was_online_today` flag after snapshot (for tomorrow)
- Only runs for vendors marked `analytics_ready = true` and `config_last_status = success`

### Data Captured
- `daily_energy_kwh`
- `monthly_energy_kwh` (converted from MWh)
- `yearly_energy_mwh`
- `total_energy_mwh`
- `was_online` (from main DB)

---

## 9. Reset was_online_today Flag

### Frequency
- **Cron Schedule**: **Daily at 12:05 AM IST** (`5 18 * * *` UTC, configurable)
- **Cron File**: `lib/cron/resetWasOnlineTodayCron.js`
- **API Endpoint**: `/api/cron/reset-was-online-today`

### Configuration
- **Enable/Disable**: `ENABLE_RESET_WAS_ONLINE_TODAY_CRON` (default: `true`)
- **Schedule**: `RESET_WAS_ONLINE_TODAY_CRON_SCHEDULE` (default: `"5 18 * * *"`)

### What It Does
- Resets `plants.was_online_today = false` for all plants
- Primary reset mechanism (also reset during analytics snapshot as backup)
- Ensures flag starts fresh each day

---

## Summary Table

| Sync Operation | Frequency | Schedule | Restricted Window | Configurable |
|----------------|-----------|---------|-------------------|--------------|
| **Alert Sync** | Every hour | `0 * * * *` | ❌ No | `ENABLE_ALERT_SYNC_CRON` |
| **Plant Sync** | Once daily | Every 15 min (checks), syncs at vendor time (default: 02:00 IST) | ❌ No | `ENABLE_PLANT_SYNC_CRON`, `plant_sync_time_ist` |
| **Live Telemetry** | Every 15 min (vendor-specific intervals) | `*/15 * * * *` | ✅ Yes (8 PM - 5 AM IST) | `ENABLE_LIVE_TELEMETRY_SYNC_CRON`, `telemetry_sync_interval` |
| **WMS Site Sync** | Twice daily | `0 6,22 * * *` (6 AM & 10 PM IST) | ❌ No | `ENABLE_WMS_SITE_SYNC_CRON` |
| **WMS Insolation** | Daily | `0 6 * * *` (6 AM IST, syncs yesterday) | ❌ No | `ENABLE_WMS_INSOLATION_SYNC_MORNING_CRON` |
| **Disable Plants** | Daily | `30 20 * * *` (2 AM IST) | ❌ No | `ENABLE_DISABLE_INACTIVE_PLANTS_CRON` |
| **Analytics Config** | Daily | `0 16 * * *` (~9:30 PM IST) | ❌ No | `ENABLE_ANALYTICS_CONFIG_CRON`, `ANALYTICS_CONFIG_CRON_SCHEDULE` |
| **Analytics Snapshot** | Daily | `30 16 * * *` (10 PM IST) | ❌ No | `ENABLE_ANALYTICS_SNAPSHOT_CRON`, `ANALYTICS_SNAPSHOT_CRON_SCHEDULE` |
| **Reset was_online** | Daily | `5 18 * * *` (12:05 AM IST) | ❌ No | `ENABLE_RESET_WAS_ONLINE_TODAY_CRON`, `RESET_WAS_ONLINE_TODAY_CRON_SCHEDULE` |

---

## Notes

### Timezone
- All times are in **IST (Asia/Kolkata)** unless specified
- Cron expressions use **server timezone** (typically UTC)
- IST = UTC + 5:30

### Restricted Window (Telemetry Sync Only)
- **Default**: 8 PM - 5 AM IST
- **Purpose**: Avoid high API load during peak hours
- **Configurable**: `RESTRICTED_WINDOW_START` and `RESTRICTED_WINDOW_END`
- **Applies to**: Live telemetry sync only (not plant sync, alerts, or WMS)

### Organization-Level Control
- **Master Switch**: `organizations.auto_sync_enabled`
- **When `false`**: All sync operations (plant, telemetry, alerts, WMS) are skipped for that org
- **When `true`**: Sync proceeds (subject to vendor-level checks)

### Vendor-Level Intervals
- **Telemetry Sync**: `vendors.telemetry_sync_interval` (15/30/45 minutes)
- **Plant Sync**: `vendors.plant_sync_time_ist` (default: 02:00 IST)
- Vendors sync at their configured intervals/times

---

## Quick Reference

### Most Frequent
- **Alert Sync**: Every hour (at minute 0)
- **Live Telemetry**: Every 15 minutes (vendor-specific intervals)
- **Plant Sync Check**: Every 15 minutes (actual sync once daily)

### Daily Operations
- **Plant Sync**: Once at vendor-configured time (default: 2 AM IST)
- **WMS Site Sync**: Twice (6 AM & 10 PM IST)
- **WMS Insolation**: Once (6 AM IST, syncs yesterday)
- **Disable Plants**: Once (2 AM IST)
- **Analytics Config**: Once (~9:30 PM IST)
- **Analytics Snapshot**: Once (10 PM IST)
- **Reset was_online**: Once (12:05 AM IST)

### Manual Triggers
All sync operations can be manually triggered via API endpoints (SUPERADMIN/DEVELOPER only):
- `POST /api/cron/sync-alerts`
- `POST /api/cron/sync-plants`
- `POST /api/cron/sync-live-telemetry`
- `POST /api/vendors/[id]/sync-alerts` (per-vendor)
- `POST /api/vendors/[id]/sync-plants` (per-vendor)

