# Telemetry System - Complete Documentation

## Overview

The Telemetry System is a **vendor-agnostic, adapter-driven, time-series ingestion system** designed for high-volume solar plant monitoring data. It provides 15-minute resolution data storage, automatic aggregation, and efficient querying for visualization.

**Key Architecture Principle**: All telemetry data, including aggregates, is stored exclusively in the **Telemetry Database**. No data is written to the Main Database, even if this means duplicating information. Aggregates are maintained at both the **plant level** and **work order level** for efficient querying.

## Quick Reference: Data Sources and Update Schedule

| Visualization Need | Data Source | Table/Field | Update Schedule |
|-------------------|-------------|-------------|-----------------|
| **Current Day** - Total energy & power graph | Real-time telemetry | `telemetry_15m` | 15-min sync cron (same as plant list sync, every 15 mins) |
| **Current Month** + Last 35 days | Historical aggregates | `plant_aggregates.daily_energy_35d` | Morning cron (00:15 AM) - updates yesterday |
| **Current Year** + Last 13 months | Historical aggregates | `plant_aggregates.monthly_energy_13m` | Morning cron (00:15 AM) - updates yesterday's month if completed |
| **Year-on-Year (2023+)** | Historical aggregates | `plant_aggregates.yearly_energy_mwh` | Morning cron (00:15 AM) - updates yesterday's year if completed |
| **Before 2023** | Historical aggregates | `plant_aggregates.previous_years_energy_mwh` | Morning cron (00:15 AM) - updates if year completed |

**Update Processes**:
- **A) 15-Minute Sync Cron** (Same as Plant List Sync): Updates plant list in Main DB and telemetry data in Telemetry DB (`telemetry_15m` and `plant_aggregates` for current data)
- **B) Backfill Mode Complete**: Super Admin triggered, per plant - backfills complete historical data using `/maintain-s/history/power/` endpoints
- **C) Morning Cron (00:15 AM)**: Per plant - gets last day information and updates (current day - 1)'s stats at daily, monthly, and yearly basis

## Table of Contents

- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Data Flow](#data-flow)
- [Sync Modes](#sync-modes)
- [Vendor Adapter Interface](#vendor-adapter-interface)
- [Attribute Mapping](#attribute-mapping)
- [Example: Loading All Metrics from Plant Start Date](#example-loading-all-metrics-from-plant-start-date)
- [API Endpoints](#api-endpoints)
- [Visualization Requirements](#visualization-requirements)
- [Failure Recovery](#failure-recovery)

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Telemetry System Architecture                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Vendor     │         │   Vendor     │         │   Vendor     │
│   Adapter    │         │   Adapter    │         │   Adapter    │
│  (Solarman)  │         │  (Sungrow)   │         │   (Other)   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  getTelemetry()        │  getTelemetry()        │  getTelemetry()
       │                        │                        │
       └────────────┬───────────┴───────────┬───────────┘
                    │                       │
                    ▼                       ▼
         ┌──────────────────────────────────────┐
         │   Telemetry Sync Service             │
         │   (telemetrySyncService.ts)          │
         │                                      │
         │  • Normalize vendor data             │
         │  • Compute aggregates                │
         │  • Handle failures                   │
         └──────────────┬───────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │         Telemetry Database            │
         │      (All Data Stored Here)           │
         └──────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ telemetry_15m│ │plant_aggregates│ │work_order_   │
│              │ │                │ │aggregates     │
│ • ts         │ │ • plant_id    │ │ • work_order_ │
│ • plant_id   │ │ • vendor_     │ │   id          │
│ • vendor_    │ │   plant_id    │ │ • daily_      │
│   plant_id   │ │ • daily_      │ │   energy_kwh  │
│ • total_     │ │   energy_kwh  │ │ • monthly_    │
│   energy_mwh │ │ • monthly_    │ │   energy_mwh  │
│ • power_kw   │ │   energy_mwh  │ │ • yearly_     │
│ • raw (JSONB)│ │ • yearly_     │ │   energy_mwh   │
│              │ │   energy_mwh   │ │ • total_      │
│              │ │ • total_       │ │   energy_mwh   │
│              │ │   energy_mwh   │ │ • last_update │
│              │ │ • current_    │ │   _time        │
│              │ │   power_kw    │ │               │
│              │ │ • last_update  │ │               │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Telemetry Sync Process Flow                   │
└─────────────────────────────────────────────────────────────────┘

[Start] → [Get Plant List] → [For Each Plant]
    │                              │
    │                              ▼
    │                    [Get Vendor Adapter]
    │                              │
    │                              ▼
    │                    [Determine Sync Window]
    │                              │
    │                    ┌─────────┴─────────┐
    │                    │                   │
    │                    ▼                   ▼
    │            [15-Min Sync]      [Backfill Mode]
    │            (Last 24h)          (Full History)
    │                    │                   │
    │                    └─────────┬─────────┘
    │                              │
    │                              ▼
    │                    [Call adapter.getTelemetry()]
    │                              │
    │                              ▼
    │                    [Receive Raw Vendor Data]
    │                              │
    │                              ▼
    │                    [Normalize to Standard Format]
    │                              │
    │                    ┌─────────┴─────────┐
    │                    │                   │
    │                    ▼                   ▼
    │            [Extract Fields]    [Preserve Raw]
    │            • ts                • raw (JSONB)
    │            • totalEnergyMWh
    │            • powerKW
    │                    │                   │
    │                    └─────────┬─────────┘
    │                              │
    │                              ▼
    │                    [Upsert to telemetry_15m]
    │                    (on plant_id, ts)
    │                              │
    │                              ▼
    │                    [Compute Plant Aggregates]
    │                    │
    │                    ├─→ [Fetch Year-on-Year Data]
    │                    │   • Call Solarman /stats/total API
    │                    │   • Extract year-by-year records (2023+)
    │                    │   • Calculate previous_years = statistics - sum(records)
    │                    │   • Store in yearly_energy_mwh JSONB: {"2023": 22.935, "2024": 27.780, ...}
    │                    │
    │                    ├─→ [Fetch Rolling 13 Months Data] (backfilled)
    │                    │   • Call Solarman monthly stats API
    │                    │   • Store last 13 months in monthly_energy_13m JSONB (backfilled)
    │                    │
    │                    ├─→ [Fetch Last 35 Days Data] (backfilled)
    │                    │   • Call Solarman daily stats API
    │                    │   • Store last 35 days in daily_energy_35d JSONB (backfilled)
    │                    │
    │                    ├─→ [Compute Current Metrics]
    │                    │   • current_power_kw = latest power value
    │                    │   • total_energy_mwh = statistics.generationValue
    │                    │
    │                    └─→ [Upsert to plant_aggregates]
    │                        (on plant_id)
    │                              │
    │                              ▼
    │                    [Compute Work Order Aggregates]
    │                    (for all work orders containing this plant)
    │                              │
    │                              ▼
    │                    [Upsert to work_order_aggregates]
    │                    (on work_order_id)
    │                              │
    │                              ▼
    │                    [Log Success/Errors]
    │                              │
    └──────────────────────────────┘
                    │
                    ▼
                [End]
```

## Database Schema

**All tables are located in the Telemetry Database (separate PostgreSQL instance). No data is written to the Main Database.**

**Note**: The Telemetry System may **read** from the Main Database to determine relationships (e.g., which plants belong to which work orders via `work_order_plants`), but it **never writes** to the Main Database. All telemetry data and aggregates are stored exclusively in the Telemetry Database.

### 1. Telemetry Table: `telemetry_15m`

**Purpose**: Store raw 15-minute interval telemetry data for real-time visualization and current day/month calculations

**Key Use Case**: This table is the **primary source of truth for real-time visualization**, graphs, and current day/month energy calculations. For "today" and current visualizations, always query `telemetry_15m`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `ts` | TIMESTAMPTZ | NOT NULL | Timestamp at 15-minute interval |
| `plant_id` | INTEGER | NOT NULL | Internal plant identifier (FK to main DB) |
| `vendor_plant_id` | TEXT | NOT NULL | Vendor-provided plant identifier |
| `total_energy_mwh` | NUMERIC(12,3) | NOT NULL | Cumulative energy at this timestamp |
| `power_kw` | NUMERIC(12,3) | NULL | Instantaneous power (kW) |
| `raw` | JSONB | DEFAULT '{}' | Vendor raw telemetry snapshot (untouched) |

**Primary Key**: `(plant_id, ts)` (retain deterministic key while storing `vendor_plant_id` for cross-reference)

**Indexes**:
- `idx_telemetry_plant_ts` on `(plant_id, ts)` btree (mandatory)
- `idx_telemetry_ts` on `(ts)` btree (for dashboard queries)
- `idx_telemetry_vendor_plant_ts` on `(vendor_plant_id, ts)` btree (fast vendor lookups)

**Retention Policy**:
- **Long-term storage**: Raw 15-minute data stays indefinitely for historical analysis
- **Real-time queries**: Optimized for queries on recent data (last 31+ days)

**Visualization Usage**:
- **Current day energy**: Query `telemetry_15m` for today's data and calculate `max(total_energy_mwh) - min(total_energy_mwh)`
- **Current month energy**: Query `telemetry_15m` from 1st of month to now
- **Graphs and charts**: All real-time visualizations use `telemetry_15m` for 15-minute resolution data

### 2. Plant Aggregates Table: `plant_aggregates`

**Purpose**: Store **backfilled historical aggregates** at the plant level for efficient querying of year-on-year, month-on-month, and day-on-day data

**Key Use Case**: This table contains **pre-computed historical aggregates** that are backfilled from vendor APIs. For real-time visualization and current day/month calculations, use `telemetry_15m` instead.

**Backfilled Data** (Updated by Morning Cron - 00:15 AM):
- **Current month + Last 35 days**: `daily_energy_35d` JSONB (updated daily for yesterday)
- **Current year + Last 13 months**: `monthly_energy_13m` JSONB (updated when month completes)
- **Year-on-year (2023+)**: `yearly_energy_mwh` JSONB (updated when year completes)
- **Before 2023**: `previous_years_energy_mwh` (updated when year completes)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `plant_id` | INTEGER | NOT NULL | Internal plant identifier (FK to main DB) |
| `vendor_plant_id` | TEXT | NOT NULL | Vendor-provided plant identifier |
| `current_power_kw` | NUMERIC(10,3) | NULL | Current power from latest timestamp |
| `last_update_time` | TIMESTAMPTZ | NOT NULL | Last telemetry sync timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Record update timestamp |
| **Year-on-Year Data** (from Solarman `/stats/total` API, updated by morning cron - 00:15 AM) | | | |
| `previous_years_energy_mwh` | NUMERIC(10,3) | NULL | Total energy before 2023 (blanket entry for all data prior to 2023). Calculated as: statistics.generationValue - sum of all year records. Updated when year completes. |
| `yearly_energy_mwh` | JSONB | DEFAULT '{}' | Year-on-year energy data (extensible, 2023+): `{"2023": 22.935, "2024": 27.780, "2025": 22.854, ...}` (year as string key, energy in MWh). Used for: Year-on-year comparison visualization. Updated when year completes. |
| `total_energy_mwh` | NUMERIC(10,3) | NOT NULL | Total cumulative energy till date (from `statistics.generationValue`). Updated when year completes. |
| **Current Year + Last 13 Months Data** (backfilled, updated by morning cron - 00:15 AM) | | | |
| `monthly_energy_13m` | JSONB | DEFAULT '{}' | Rolling 13 months of monthly energy data: `{"2024-11": 1250.5, "2024-12": 1320.3, ...}` (month as "YYYY-MM", energy in MWh). Used for: Current year view + last 13 months visualization. Updated when month completes. |
| **Current Month + Last 35 Days Data** (backfilled, updated by morning cron - 00:15 AM) | | | |
| `daily_energy_35d` | JSONB | DEFAULT '{}' | Rolling 35 days of daily energy data: `{"2025-11-22": 125.0, "2025-11-21": 130.5, ...}` (date as "YYYY-MM-DD", energy in kWh). Used for: Current month view + last 35 days visualization. Updated daily for yesterday. |

**Primary Key**: `(plant_id)`

**Indexes**:
- `idx_plant_aggregates_plant_id` on `(plant_id)` btree (mandatory)
- `idx_plant_aggregates_vendor_plant_id` on `(vendor_plant_id)` btree (vendor lookups)
- `idx_plant_aggregates_last_update` on `(last_update_time)` btree (for sync tracking)
- `idx_plant_aggregates_total_energy` on `(total_energy_mwh)` btree (for sorting/filtering)

**Data Source**: Year-on-year data is fetched from Solarman PRO API endpoint:
- **Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/total?startYear=2023&endYear={currentYear}`
- **Response Structure**:
  ```json
  {
    "statistics": {
      "systemId": 1053617,
      "year": null,
      "month": null,
      "day": null,
      "generationValue": 88779.1  // Total energy till date
    },
    "records": [
      {"year": 2021, "generationValue": 7476.0},
      {"year": 2022, "generationValue": 7733.7},
      {"year": 2023, "generationValue": 22935.4},
      {"year": 2024, "generationValue": 27779.8},
      {"year": 2025, "generationValue": 22854.4}
    ]
  }
  ```
- **Previous Years Calculation**: `previous_years_energy_mwh = statistics.generationValue - sum(records[].generationValue)`
- **Year Storage**: Each year from 2023 onwards is stored in `yearly_energy_mwh` JSONB field (extensible, no schema changes needed for new years)

### 3. Work Order Aggregates Table: `work_order_aggregates`

**Purpose**: Store computed aggregates at the work order level (sum of all plants in work order)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `work_order_id` | INTEGER | NOT NULL | Reference to work order (from main database) |
| **Year-on-Year Data** (summed from all plants) | | | |
| `previous_years_energy_mwh` | NUMERIC(10,3) | NULL | Sum of previous_years_energy_mwh from all plants |
| `yearly_energy_mwh` | JSONB | DEFAULT '{}' | Aggregated year-on-year energy from all plants: `{"2023": 68.805, "2024": 83.340, "2025": 68.562, ...}` (sum of all plants' yearly values) |
| `total_energy_mwh` | NUMERIC(10,3) | NOT NULL | Sum of total_energy_mwh from all plants |
| **Rolling Data** (aggregated from all plants) | | | |
| `monthly_energy_13m` | JSONB | DEFAULT '{}' | Aggregated monthly energy from all plants: `{"2024-11": 3750.5, ...}` (sum of all plants' monthly values) |
| `daily_energy_35d` | JSONB | DEFAULT '{}' | Aggregated daily energy from all plants: `{"2025-11-22": 375.0, ...}` (sum of all plants' daily values) |
| **Current Metrics** | | | |
| `current_power_kw` | NUMERIC(10,3) | NULL | Sum of current_power_kw from all plants |
| `last_update_time` | TIMESTAMPTZ | NOT NULL | Last telemetry sync timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Record update timestamp |

**Primary Key**: `(work_order_id)`

**Indexes**:
- `idx_work_order_aggregates_wo_id` on `(work_order_id)` btree (mandatory)
- `idx_work_order_aggregates_last_update` on `(last_update_time)` btree (for sync tracking)

**Note**: Work order aggregates are computed by summing the corresponding values from `plant_aggregates` for all plants associated with the work order (via `work_order_plants` table in main database). For JSONB fields (`yearly_energy_mwh`, `monthly_energy_13m`, `daily_energy_35d`), values are aggregated by summing the corresponding year/month/day values across all plants.

### 4. Organization Aggregates Table: `organization_aggregates`

**Purpose**: Store computed aggregates at the organization level (sum of all plants from all vendors in the organization)

**Priority Order**: Plant (1st) → Work Order (2nd) → Organization (3rd)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `organization_id` | INTEGER | NOT NULL | Reference to organization (from main database) |
| **Year-on-Year Data** (summed from all plants in org) | | | |
| `previous_years_energy_mwh` | NUMERIC(10,3) | NULL | Sum of previous_years_energy_mwh from all plants in organization |
| `yearly_energy_mwh` | JSONB | DEFAULT '{}' | Aggregated year-on-year energy from all plants: `{"2023": 150.250, "2024": 180.500, "2025": 145.750, ...}` (sum of all plants' yearly values) |
| `total_energy_mwh` | NUMERIC(10,3) | NOT NULL | Sum of total_energy_mwh from all plants in organization |
| **Rolling Data** (aggregated from all plants in org) | | | |
| `monthly_energy_13m` | JSONB | DEFAULT '{}' | Aggregated monthly energy from all plants: `{"2024-11": 12500.5, ...}` (sum of all plants' monthly values) |
| `daily_energy_35d` | JSONB | DEFAULT '{}' | Aggregated daily energy from all plants: `{"2025-11-22": 1250.0, ...}` (sum of all plants' daily values) |
| **Current Metrics** | | | |
| `current_power_kw` | NUMERIC(10,3) | NULL | Sum of current_power_kw from all plants in organization |
| `last_update_time` | TIMESTAMPTZ | NOT NULL | Last telemetry sync timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Record update timestamp |

**Primary Key**: `(organization_id)`

**Indexes**:
- `idx_organization_aggregates_org_id` on `(organization_id)` btree (mandatory)
- `idx_organization_aggregates_last_update` on `(last_update_time)` btree (for sync tracking)

**Note**: Organization aggregates are computed by summing the corresponding values from `plant_aggregates` for all plants belonging to vendors in the organization. For JSONB fields (`yearly_energy_mwh`, `monthly_energy_13m`, `daily_energy_35d`), values are aggregated by summing the corresponding year/month/day values across all plants in the organization.

### Schema Extensibility and Priority Order

**Extensible Schema Design**:
- **Year-on-year data**: Uses `yearly_energy_mwh` JSONB field instead of individual columns (`year_2023_energy_mwh`, `year_2024_energy_mwh`, etc.)
  - **Benefit**: No schema changes needed when new years are added
  - **Format**: `{"2023": 22.935, "2024": 27.780, "2025": 28.125, "2026": 30.500, ...}`
  - **Extensible**: Automatically supports any future year without ALTER TABLE statements
- **Rolling windows**: JSONB fields for monthly (13 months) and daily (35 days) data
  - **Benefit**: Flexible structure, easy to query and aggregate
  - **Maintenance**: Rolling windows automatically maintained (oldest entries removed)

**Data Rendering Priority Order**:
1. **Plant Level** (Priority 1 - Highest):
   - `plant_aggregates` table contains plant-specific aggregates
   - Primary source for plant-level visualizations and reports
   - Computed first during sync operations

2. **Work Order Level** (Priority 2):
   - `work_order_aggregates` table contains work order aggregates
   - Sums data from all plants in the work order (may include plants from multiple vendors)
   - Computed after plant aggregates are updated

3. **Organization Level** (Priority 3):
   - `organization_aggregates` table contains organization-wide aggregates
   - Sums data from all plants across all vendors in the organization
   - Computed last after work order aggregates are updated

**Computation Flow**:
```
Plant Aggregates (Priority 1)
    ↓
Work Order Aggregates (Priority 2) - Sums from plants
    ↓
Organization Aggregates (Priority 3) - Sums from all plants in org
```

## Data Sources by Time Range

### Data Source Mapping

| Time Range | Data Source | Table/Field | Update Frequency | Use Case |
|------------|-------------|-------------|------------------|----------|
| **Current Day** | Real-time telemetry | `telemetry_15m` | Continuous (15-min intervals) | Total energy and power graphs for today |
| **Current Month** | Backfilled aggregates | `plant_aggregates.daily_energy_35d` | Morning cron (00:15 AM) - updates yesterday | Current month view + last 35 days |
| **Last 35 Days** | Backfilled aggregates | `plant_aggregates.daily_energy_35d` | Morning cron (00:15 AM) - updates yesterday | Daily trends, last 35 days view |
| **Current Year** | Backfilled aggregates | `plant_aggregates.monthly_energy_13m` | Morning cron (00:15 AM) - updates yesterday's month if completed | Current year view + last 13 months |
| **Last 13 Months** | Backfilled aggregates | `plant_aggregates.monthly_energy_13m` | Morning cron (00:15 AM) - updates yesterday's month if completed | Monthly trends, last 13 months view |
| **Year-on-Year (2023+)** | Backfilled aggregates | `plant_aggregates.yearly_energy_mwh` | Morning cron (00:15 AM) - updates yesterday's year if completed | Year-on-year comparison |
| **Before 2023** | Backfilled aggregates | `plant_aggregates.previous_years_energy_mwh` | Morning cron (00:15 AM) - updates if year completed | Historical total before 2023 |

### Visualization Data Sources

**Current Day Total Energy and Power Graph**:
- **Source**: `telemetry_15m` table
- **Query**: 
  ```sql
  SELECT ts, total_energy_mwh, power_kw
  FROM telemetry_15m
  WHERE plant_id = $1
    AND ts >= CURRENT_DATE
    AND ts < CURRENT_DATE + INTERVAL '1 day'
  ORDER BY ts ASC
  ```
- **Update**: 15-minute sync cron (same as plant list sync) - continuously synced every 15 minutes

**Current Month and Last 35 Days**:
- **Source**: `plant_aggregates.daily_energy_35d` JSONB field
- **Query**: Extract from JSONB, filter to current month or last 35 days
- **Update**: Morning cron (00:15 AM) updates yesterday's data

**Current Year and Last 13 Months**:
- **Source**: `plant_aggregates.monthly_energy_13m` JSONB field
- **Query**: Extract from JSONB, filter to current year or last 13 months
- **Update**: Morning cron (00:15 AM) updates yesterday's month (if month completed)

**Year-on-Year (2023 onwards)**:
- **Source**: `plant_aggregates.yearly_energy_mwh` JSONB field
- **Query**: Extract from JSONB, filter years >= 2023
- **Update**: Morning cron (00:15 AM) updates yesterday's year (if year completed)

**Before 2023**:
- **Source**: `plant_aggregates.previous_years_energy_mwh` field
- **Query**: Direct field access
- **Update**: Morning cron (00:15 AM) updates if year completed

## Backfilled Aggregates vs Real-Time Telemetry

### Key Distinction

**`plant_aggregates` and `work_order_aggregates`**:
- Contains **backfilled historical data** from vendor APIs
- Year-on-year data (backfilled from `/stats/total` API)
- Rolling 13 months data (backfilled from monthly stats API)
- Rolling 35 days data (backfilled from daily stats API)
- Used for: Historical analysis, year-on-year comparisons, pre-computed aggregates
- **Updated via morning cron (00:15 AM)**: Updates yesterday's day, month (if completed), and year (if completed)

**`telemetry_15m`**:
- Contains **real-time 15-minute interval data** continuously synced from vendor APIs
- Used for: **Real-time visualization, graphs, current day/month calculations**
- **Primary source of truth for "today" and current visualizations**

### When to Use Which

| Use Case | Data Source | Reason |
|----------|-------------|--------|
| Current day energy | `telemetry_15m` | Real-time calculation: `max(total_energy_mwh) - min(total_energy_mwh)` for today |
| Current month energy | `telemetry_15m` | Real-time calculation from 1st of month to now |
| Graphs and charts | `telemetry_15m` | 15-minute resolution for detailed visualization |
| Year-on-year comparison | `plant_aggregates` | Pre-computed historical aggregates |
| Historical monthly trends | `plant_aggregates.monthly_energy_13m` | Backfilled 13-month rolling data |
| Historical daily trends | `plant_aggregates.daily_energy_35d` | Backfilled 35-day rolling data |
| Total cumulative energy | `plant_aggregates.total_energy_mwh` | From vendor statistics API |

### Example: Calculating Current Day Energy

```sql
-- ✅ CORRECT: Use telemetry_15m for real-time current day calculation
SELECT 
  (MAX(total_energy_mwh) - MIN(total_energy_mwh)) * 1000 as daily_energy_kwh
FROM telemetry_15m
WHERE plant_id = 123
  AND ts >= CURRENT_DATE
  AND ts < CURRENT_DATE + INTERVAL '1 day';

-- ❌ INCORRECT: Don't use backfilled aggregate for current day
-- The daily_energy_35d JSONB may not include today's data yet
```

## Data Flow

### Complete Telemetry Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Complete Telemetry Data Flow                  │
└─────────────────────────────────────────────────────────────────┘

Vendor API (Solarman/Sungrow/etc.)
    │
    │ Raw Response:
    │ {
    │   "timestamp": 1763468017,
    │   "generationValue": 1250.5,      // kWh
    │   "generationPower": 50000,       // W
    │   "generationUploadTotalOffset": 50000.5,  // kWh
    │   ...vendor-specific fields...
    │ }
    │
    ▼
┌─────────────────────────────────┐
│   Vendor Adapter                │
│   normalizeTelemetry()          │
└─────────────┬───────────────────┘
              │
              │ Normalized:
              │ {
              │   ts: Date,
              │   totalEnergyMWh: 50.0005,
              │   powerKW: 50.0,
              │   raw: { ...original... }
              │ }
              │
              ▼
┌─────────────────────────────────┐
│   Telemetry Sync Service        │
│   • Validate monotonic energy   │
│   • Handle duplicates           │
│   • Compute aggregates          │
└─────────────┬───────────────────┘
              │
              ├──────────────────────────────────────────────┐
              │                                              │
              ▼                                              ▼
┌─────────────────────────┐              ┌─────────────────────────┐
│   Telemetry DB          │              │   Telemetry DB          │
│   telemetry_15m         │              │   plant_aggregates       │
│                         │              │                         │
│   INSERT/UPDATE         │              │   UPSERT                │
│   ON CONFLICT           │              │   (plant_id)             │
│   (plant_id, ts)        │              │   • daily_energy_kwh    │
│   DO UPDATE             │              │   • monthly_energy_mwh  │
│                         │              │   • yearly_energy_mwh    │
│   • ts                  │              │   • total_energy_mwh     │
│   • plant_id            │              │   • current_power_kw      │
│   • total_energy_mwh    │              │   • last_update_time     │
│   • power_kw            │              └─────────────────────────┘
│   • raw                 │                          │
└─────────────────────────┘                          │
                                                      ▼
                                      ┌─────────────────────────┐
                                      │   Telemetry DB          │
                                      │   work_order_aggregates │
                                      │                         │
                                      │   UPSERT                │
                                      │   (work_order_id)       │
                                      │   • daily_energy_kwh    │
                                      │     (sum of plants)      │
                                      │   • monthly_energy_mwh  │
                                      │     (sum of plants)      │
                                      │   • yearly_energy_mwh    │
                                      │     (sum of plants)      │
                                      │   • total_energy_mwh     │
                                      │     (sum of plants)      │
                                      │   • current_power_kw     │
                                      │     (sum of plants)      │
                                      │   • last_update_time     │
                                      └─────────────────────────┘
```

## Sync Modes and Cron Jobs

### A) 15-Minute Sync Cron (Plant List + Telemetry Sync)

**Purpose**: Syncs plant list data and telemetry data for real-time visualization

**Schedule**: Runs every 15 minutes (same as existing plant list sync cron)

**Note**: This is the **same cron job** that syncs the plant list. It now also updates telemetry data.

**API Endpoint**: Uses `getAllPlantsForStation` Pro API (same endpoint used for plant list sync)

**Process**:

```
┌─────────────────────────────────────────────────────────────────┐
│        15-Minute Sync Cron Flow (Plant List + Telemetry)        │
└─────────────────────────────────────────────────────────────────┘

[Cron Trigger: Every 15 Minutes]
    │
    ▼
[Get All Active Plants]
    │
    ├─→ Filter: plants where org.auto_sync_enabled = true
    └─→ Group by: organization
    │
    ▼
[For Each Plant]
    │
    ├─→ Call getAllPlantsForStation Pro API
    └─→ plantVendorId = plant.vendor_plant_id
    │
    ▼
    [1. Update Plant List Data] (Existing functionality)
    │
    ├─→ Sync plant metadata (name, capacity, status, etc.)
    ├─→ Update plants table in Main DB
    └─→ Update daily_energy_kwh, total_energy_mwh from API response
    │
    ▼
    [2. Update telemetry_15m]
    │
    ├─→ Extract total_energy_mwh from API response
    ├─→ Extract power_kw from API response
    ├─→ Extract timestamp (15-minute interval)
    └─→ Upsert to telemetry_15m:
        • ts (timestamp)
        • plant_id
        • vendor_plant_id
        • total_energy_mwh
        • power_kw
        • raw (full API response)
    │
    ▼
    [Update plant_aggregates - Current Data]
    │
    ├─→ [Update Total Energy Till Date]
    │   • total_energy_mwh = latest total_energy_mwh from telemetry_15m
    │
    ├─→ [Update Current Year's Energy]
    │   • Fetch year-on-year data: GET /maintain-s/history/power/{systemId}/stats/total?startYear=2023&endYear={currentYear}
    │   • Extract current year's energy from records[]
    │   • Update yearly_energy_mwh JSONB: {"2025": latest_value, ...}
    │
    ├─→ [Update Current Month's Energy]
    │   • Fetch monthly data: GET /maintain-s/history/power/{systemId}/stats/year?year={currentYear}
    │   • Extract current month's energy from records[]
    │   • Update monthly_energy_13m JSONB: {"2025-11": latest_value, ...}
    │   • Remove oldest month if > 13 months
    │
    ├─→ [Update Current Day's Energy]
    │   • Calculate from telemetry_15m: max(total_energy_mwh) - min(total_energy_mwh) for today
    │   • Update daily_energy_35d JSONB: {"2025-11-22": today_energy_kwh, ...}
    │   • Remove oldest day if > 35 days
    │
    ├─→ [Update Current Power]
    │   • current_power_kw = latest power_kw from telemetry_15m
    │
    └─→ [Upsert to plant_aggregates]
        │
        │   ON CONFLICT (plant_id) DO UPDATE
        │   • total_energy_mwh
        │   • yearly_energy_mwh (current year updated)
        │   • monthly_energy_13m (current month updated)
        │   • daily_energy_35d (current day updated)
        │   • current_power_kw
    │
    ▼
[End]
```

**Updates**:

**Main Database** (existing plant sync):
1. **plants table**: Plant metadata, `daily_energy_kwh`, `total_energy_mwh` (from API response)

**Telemetry Database**:
2. **telemetry_15m**: `total_energy_mwh`, `power_kw` (15-minute intervals)
3. **plant_aggregates**: 
   - `total_energy_mwh` (till date)
   - `yearly_energy_mwh` (current year)
   - `monthly_energy_13m` (current month)
   - `daily_energy_35d` (current day)
   - `current_power_kw` (latest power)

### B) Backfill Mode Complete (On-Demand, Super Admin Trigger)

**Purpose**: Complete historical data backfill for a plant

**Trigger**: Super Admin manual trigger, per plant basis

**API Endpoint**: Uses `/maintain-s/history/power/` endpoints

**Process**:

```
┌─────────────────────────────────────────────────────────────────┐
│              Backfill Mode Complete Flow                        │
└─────────────────────────────────────────────────────────────────┘

[Super Admin Triggers Backfill for Plant]
    │
    ▼
[Get Plant Info]
    │
    ├─→ plantVendorId = plant.vendor_plant_id
    └─→ currentYear = NOW().getFullYear()
    │
    ▼
    [1. Update Year-on-Year Data (2023+)]
    │
    ├─→ Fetch: GET /maintain-s/history/power/{systemId}/stats/total?startYear=2023&endYear={currentYear}
    │
    ├─→ Extract:
    │   • statistics.generationValue → total_energy_mwh
    │   • records[] (year-by-year from 2023+) → yearly_energy_mwh JSONB
    │   • Calculate previous_years_energy_mwh = total - sum(years 2023+)
    │
    └─→ Update plant_aggregates:
        • total_energy_mwh
        • yearly_energy_mwh: {"2023": value, "2024": value, ..., "2025": value}
        • previous_years_energy_mwh
    │
    ▼
    [2. Update Monthly Energy (Rolling 13 Months)]
    │
    ├─→ Calculate: yesterday = TODAY - 1 day
    ├─→ yesterdayMonth = yesterday.getMonth() + 1
    ├─→ yesterdayYear = yesterday.getFullYear()
    │
    ├─→ Fetch current year: GET /maintain-s/history/power/{systemId}/stats/year?year={currentYear}
    ├─→ Fetch previous year (if needed): GET /maintain-s/history/power/{systemId}/stats/year?year={previousYear}
    │
    ├─→ Extract monthly records from both years
    ├─→ Filter to last 13 months (up to yesterday's month)
    ├─→ Format: {"YYYY-MM": energy_mwh, ...}
    │
    └─→ Update plant_aggregates.monthly_energy_13m:
        • Rolling 13 months window
        • Up to (current day - 1)'s month
    │
    ▼
    [3. Update Daily Energy (Rolling 35 Days)]
    │
    ├─→ Calculate: yesterday = TODAY - 1 day
    ├─→ yesterdayMonth = yesterday.getMonth() + 1
    ├─→ yesterdayYear = yesterday.getFullYear()
    │
    ├─→ Fetch current month: GET /maintain-s/history/power/{systemId}/stats/month?year={currentYear}&month={currentMonth}
    ├─→ Fetch previous month (if needed): GET /maintain-s/history/power/{systemId}/stats/month?year={previousYear}&month={previousMonth}
    │
    ├─→ Extract daily records from both months
    ├─→ Filter to last 35 days (up to yesterday)
    ├─→ Format: {"YYYY-MM-DD": energy_kwh, ...}
    │
    └─→ Update plant_aggregates.daily_energy_35d:
        • Rolling 35 days window
        • Up to (current day - 1)
    │
    ▼
    [Upsert to plant_aggregates]
    │
    │   ON CONFLICT (plant_id) DO UPDATE
    │   • total_energy_mwh
    │   • yearly_energy_mwh (complete year-on-year from 2023+)
    │   • monthly_energy_13m (rolling 13 months up to yesterday's month)
    │   • daily_energy_35d (rolling 35 days up to yesterday)
    │
    ▼
[End]
```

**Updates**:
1. **plant_aggregates**: 
   - `total_energy_mwh` (till date)
   - `yearly_energy_mwh` (year-on-year from 2023+)
2. **plant_aggregates**: 
   - `monthly_energy_13m` (rolling 13 months, up to yesterday's month)
3. **plant_aggregates**: 
   - `daily_energy_35d` (rolling 35 days, up to yesterday)

### C) Morning Cron (00:15 AM - Yesterday's Data Finalization)

**Purpose**: Finalize yesterday's data at daily, monthly, and yearly levels

**Schedule**: Runs daily at 00:15 AM local time

**Process**: Per plant basis

**Process**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Daily Sync Flow                               │
└─────────────────────────────────────────────────────────────────┘

[Cron Trigger: 00:15 Local Time]
    │
    ▼
[Get All Active Plants]
    │
    ├─→ Filter: plants where org.auto_sync_enabled = true
    └─→ Group by: organization
    │
    ▼
[For Each Organization]
    │
    ├─→ syncInterval = org.sync_interval_minutes
    └─→ [If shouldSync(org)] → Continue
    │
    ▼
[For Each Plant in Organization]
    │
    ├─→ startDate = NOW() - 24 hours
    ├─→ endDate = NOW()
    └─→ plantVendorId = plant.vendor_plant_id
    │
    ▼
    [Call adapter.getTelemetry(plantVendorId, startDate, endDate)]
    │
    ▼
    [Normalize & Upsert to telemetry_15m]
    │
    │   • Real-time 15-minute data for visualization
    │   • Used for current day/month calculations
    │   • Continuously synced for real-time graphs
    │
    ▼
    [Update Current Power]
    │
    │   • current_power_kw = latest power value from telemetry_15m
    │   • Update plant_aggregates.current_power_kw (for quick access)
    │
    ▼
[Log Results]
    │
    ├─→ successCount
    ├─→ errorCount
    └─→ errors[] (vendor, plant, error message)
    │
    ▼
[End]
```

**Updates** (all in Telemetry DB):

1. **telemetry_15m**: `total_energy_mwh`, `power_kw` (15-minute intervals)
2. **plant_aggregates**: 
   - `total_energy_mwh` (till date)
   - `yearly_energy_mwh` (current year)
   - `monthly_energy_13m` (current month)
   - `daily_energy_35d` (current day)
   - `current_power_kw` (latest power)

### C) Morning Cron (00:15 AM - Yesterday's Data Finalization)

**Purpose**: Finalize yesterday's data at daily, monthly, and yearly levels

**Schedule**: Runs daily at 00:15 AM local time

**Key Principle**: Updates data for **(current day - 1)**, ensuring yesterday's data is finalized and available for historical views.

**Process**: Per plant basis

```
┌─────────────────────────────────────────────────────────────────┐
│              Morning Cron Flow (00:15 AM Local Time)             │
└─────────────────────────────────────────────────────────────────┘

[Cron Trigger: 00:15 AM Local Time]
    │
    ▼
[Calculate Yesterday's Date]
    │
    ├─→ yesterday = TODAY - 1 day
    ├─→ yesterdayYear = yesterday.getFullYear()
    ├─→ yesterdayMonth = yesterday.getMonth() + 1
    ├─→ yesterdayDay = yesterday.getDate()
    └─→ yesterdayDateKey = "YYYY-MM-DD"
    │
    ▼
[For Each Active Plant]
    │
    ├─→ Get plant vendor adapter
    └─→ plantVendorId = plant.vendor_plant_id
    │
    ▼
    [Get Last Day Information (Current Day - 1)]
    │
    ├─→ yesterday = TODAY - 1 day
    ├─→ yesterdayYear = yesterday.getFullYear()
    ├─→ yesterdayMonth = yesterday.getMonth() + 1
    ├─→ yesterdayDay = yesterday.getDate()
    └─→ yesterdayDateKey = "YYYY-MM-DD"
    │
    ▼
    [Update Yesterday's Day Data (Daily Basis)]
    │
    ├─→ Fetch yesterday's daily energy:
    │   • GET /maintain-s/history/power/{systemId}/stats/month?year={yesterdayYear}&month={yesterdayMonth}
    │   • Extract record where day = yesterdayDay
    │   • Add/Update daily_energy_35d JSONB: {yesterdayDateKey: energy_kwh}
    │   • Remove oldest day entry (maintain exactly 35 days)
    │   • Example: If yesterday was 2025-11-22, update {"2025-11-22": 42.5}
    │
    ▼
    [Update Yesterday's Month Data (Monthly Basis - if applicable)]
    │
    ├─→ Check: Is yesterday the last day of the month?
    │   │
    │   ├─→ [If YES - Month Completed]
    │   │   • Fetch completed month's total energy:
    │   │     GET /maintain-s/history/power/{systemId}/stats/year?year={yesterdayYear}
    │   │   • Extract record where month = yesterdayMonth
    │   │   • Update monthly_energy_13m JSONB: {"YYYY-MM": energy_mwh}
    │   │   • Remove oldest month entry (maintain exactly 13 months)
    │   │   • Example: If yesterday was last day of October 2025, update {"2025-10": 1.351}
    │   │
    │   └─→ [If NO - Month Not Completed]
    │       • Skip month update (will update when month completes)
    │
    ▼
    [Update Yesterday's Year Data (Yearly Basis - if applicable)]
    │
    ├─→ Check: Is yesterday the last day of the year? (December 31)
    │   │
    │   ├─→ [If YES - Year Completed]
    │   │   • Fetch year-on-year data:
    │   │     GET /maintain-s/history/power/{systemId}/stats/total?startYear=2023&endYear={yesterdayYear}
    │   │   • Extract statistics.generationValue (total till date)
    │   │   • Extract records[] (year-by-year from 2023+)
    │   │   • Calculate previous_years_energy_mwh = statistics.generationValue - sum(records)
    │   │   • Update yearly_energy_mwh JSONB: {"YYYY": energy_mwh}
    │   │   • Update total_energy_mwh = statistics.generationValue
    │   │   • Example: If yesterday was Dec 31, 2025, update {"2025": 22.854}
    │   │
    │   └─→ [If NO - Year Not Completed]
    │       • Skip year update (will update when year completes)
    │
    ▼
    [Upsert to plant_aggregates]
    │
    │   ON CONFLICT (plant_id) DO UPDATE
    │   • Update daily_energy_35d JSONB (always)
    │   • Update monthly_energy_13m JSONB (if month completed)
    │   • Update yearly_energy_mwh JSONB (if year completed)
    │   • Update previous_years_energy_mwh (if year completed)
    │   • Update total_energy_mwh (if year completed)
    │
    ▼
    [Compute Work Order Aggregates] (Priority 2)
    │
    │   • Recompute work_order_aggregates from updated plant_aggregates
    │
    ▼
    [Compute Organization Aggregates] (Priority 3)
    │
    │   • Recompute organization_aggregates from updated plant_aggregates
    │
    ▼
[Log Results]
    │
    ├─→ successCount
    ├─→ errorCount
    └─→ errors[] (vendor, plant, error message)
    │
    ▼
[End]
```

**Update Logic Summary**:

1. **Yesterday's Day (Always Updated - Daily Basis)**:
   - Get last day information: (current day - 1)
   - Fetch yesterday's daily energy from vendor API
   - Update `daily_energy_35d` JSONB with yesterday's date as key
   - Remove oldest day (maintain exactly 35 days)
   - **Runs every day at 00:15 AM**

2. **Yesterday's Month (Updated if Month Completed - Monthly Basis)**:
   - Check if yesterday was the last day of the month
   - If yes: Fetch completed month's total energy from vendor API
   - Update `monthly_energy_13m` JSONB for that month
   - Remove oldest month (maintain exactly 13 months)
   - **Runs only on last day of month at 00:15 AM**

3. **Yesterday's Year (Updated if Year Completed - Yearly Basis)**:
   - Check if yesterday was December 31
   - If yes: Fetch year-on-year data from vendor API
   - Update `yearly_energy_mwh` JSONB for completed year
   - Update `previous_years_energy_mwh` and `total_energy_mwh`
   - **Runs only on December 31 at 00:15 AM**

**Updates** (all in Telemetry DB):
- `plant_aggregates.daily_energy_35d`: Yesterday's day data (always updated)
- `plant_aggregates.monthly_energy_13m`: Yesterday's month data (updated if month completed)
- `plant_aggregates.yearly_energy_mwh`: Yesterday's year data (updated if year completed)
- `plant_aggregates.previous_years_energy_mwh`: Energy before 2023 (updated if year completed)
- `plant_aggregates.total_energy_mwh`: Total cumulative energy (updated if year completed)
- `work_order_aggregates.*`: Recomputed from updated plant aggregates (Priority 2)
- `organization_aggregates.*`: Recomputed from updated plant aggregates (Priority 3)

**Benefits**:
- **Efficient**: Only updates what changed (day always, month/year conditionally)
- **Accurate**: Finalizes yesterday's data before it's needed for historical views
- **Rolling Windows**: Automatically maintains 35-day and 13-month rolling windows
- **Extensible**: Year-on-year data automatically extends without schema changes

### Cron Jobs Summary

| Cron Job | Schedule | Trigger | Scope | Updates |
|----------|----------|---------|-------|---------|
| **A) 15-Minute Sync Cron** (Plant List + Telemetry) | Every 15 minutes | Automatic | All active plants | **Main DB**: `plants` table (plant metadata, daily_energy_kwh, total_energy_mwh)<br>**Telemetry DB**: `telemetry_15m` (total_energy_mwh, power_kw)<br>`plant_aggregates` (total energy, current year, current month, current day) |
| **B) Backfill Mode Complete** | On-demand | Super Admin manual trigger | Per plant | Complete historical backfill:<br>• Year-on-year (2023+)<br>• Rolling 13 months (up to yesterday's month)<br>• Rolling 35 days (up to yesterday) |
| **C) Morning Cron** | 00:15 AM daily | Automatic | Per plant | Yesterday's data:<br>• Daily (always)<br>• Monthly (if month completed)<br>• Yearly (if year completed) |

**Key Differences**:
- **15-Minute Sync**: Same cron as plant list sync - updates plant metadata in Main DB and real-time telemetry/aggregates in Telemetry DB for current day visualization
- **Backfill Mode**: One-time complete historical data reconstruction (Super Admin triggered)
- **Morning Cron**: Daily finalization of yesterday's historical aggregates (runs at 00:15 AM)

## Solarman API Endpoints for Aggregates

### Year-on-Year Statistics Endpoint

**Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/total?startYear=2023&endYear={currentYear}`

**Purpose**: Fetch year-on-year energy statistics starting from 2023

**Request Headers**:
- `Authorization: Bearer {token}`
- `accept: application/json`

**Response Structure**:
```json
{
  "statistics": {
    "systemId": 1053617,
    "year": null,
    "month": null,
    "day": null,
    "generationValue": 88779.1  // Total energy till date (kWh)
  },
  "records": [
    {
      "systemId": 1053617,
      "year": 2021,
      "month": 0,
      "day": 0,
      "generationValue": 7476.0  // Energy for year 2021 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2022,
      "month": 0,
      "day": 0,
      "generationValue": 7733.7  // Energy for year 2022 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2023,
      "month": 0,
      "day": 0,
      "generationValue": 22935.4  // Energy for year 2023 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2024,
      "month": 0,
      "day": 0,
      "generationValue": 27779.8  // Energy for year 2024 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 0,
      "day": 0,
      "generationValue": 22854.4  // Energy for year 2025 (kWh)
    }
  ]
}
```

**Data Processing**:
1. `total_energy_mwh` = `statistics.generationValue / 1000` (convert kWh to MWh)
2. Extract year-by-year data from `records[]` where `year >= 2023`
3. Store each year in `yearly_energy_mwh` JSONB: `{"2023": 22.935, "2024": 27.780, ...}` (extensible, no schema changes needed)
4. Calculate `previous_years_energy_mwh` = `total_energy_mwh - sum(all year columns from 2023+)`

**Note**: The `records[]` array may include years before 2023 (e.g., 2021, 2022), but only years from 2023 onwards are stored in dedicated columns. All energy before 2023 is aggregated into `previous_years_energy_mwh`.

### Monthly Statistics Endpoint (Rolling 13 Months)

**Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/year?year={year}`

**Purpose**: Fetch monthly energy data for a specific year (used to build rolling 13 months window)

**Request Headers**:
- `Authorization: Bearer {token}`
- `accept: application/json`

**Response Structure**:
```json
{
  "statistics": {
    "systemId": 1053617,
    "year": 2025,
    "month": 0,
    "day": 0,
    "generationValue": 22854.4  // Total energy for the year (kWh) - sum across all months
  },
  "records": [
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 1,
      "day": 0,
      "generationValue": 1640.1  // Energy for January 2025 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 2,
      "day": 0,
      "generationValue": 1968.0  // Energy for February 2025 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 3,
      "day": 0,
      "generationValue": 2389.8  // Energy for March 2025 (kWh)
    },
    // ... more months
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 11,
      "day": 0,
      "generationValue": 888.4  // Energy for November 2025 (kWh)
    }
  ]
}
```

**Data Processing for Rolling 13 Months**:

To get the last 13 months of data:

1. **Determine date range**: Calculate the date 13 months ago from today
2. **Fetch current year data**: Call `/stats/year?year={currentYear}` (e.g., `year=2025`)
3. **Fetch previous year data** (if needed): If 13 months ago falls in previous year, call `/stats/year?year={previousYear}` (e.g., `year=2024`)
4. **Combine and filter**: Merge records from both years, filter to last 13 months, sort by year/month
5. **Format for storage**: Convert to `monthly_energy_13m` JSONB format

**Example**: If today is November 2025, last 13 months = November 2024 to November 2025
- Call `/stats/year?year=2024` → Get months 11, 12
- Call `/stats/year?year=2025` → Get months 1-11
- Combine: `{"2024-11": 1.250, "2024-12": 1.320, "2025-01": 1.640, ..., "2025-11": 0.888}`

**Storage Format**:
- Store in `monthly_energy_13m` JSONB field (backfilled historical data)
- Format: `{"2024-11": 1.250, "2024-12": 1.320, "2025-01": 1.640, "2025-02": 1.968, ...}`
- Key: `"YYYY-MM"` (year-month identifier, e.g., "2025-01" for January 2025)
- Value: Monthly energy in MWh (convert from kWh: `generationValue / 1000`)
- **Rolling window**: Maintain exactly 13 months, remove oldest month when adding new month

**Note**: 
- **For real-time visualization**: Use `telemetry_15m` table to calculate current month energy, not this backfilled aggregate.
- The `statistics.generationValue` represents the total energy for the entire year (sum of all months).

### Daily Statistics Endpoint (Last 35 Days)

**Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/month?year={year}&month={month}`

**Purpose**: Fetch daily energy data for a specific month (used to build rolling 35 days window)

**Request Headers**:
- `Authorization: Bearer {token}`
- `accept: application/json`

**Response Structure**:
```json
{
  "statistics": {
    "systemId": 1053617,
    "year": 2025,
    "month": 10,
    "day": 0,
    "generationValue": 1350.6  // Total energy for the month (kWh) - sum across all days
  },
  "records": [
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 10,
      "day": 1,
      "generationValue": 47.4  // Energy for October 1, 2025 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 10,
      "day": 2,
      "generationValue": 41.8  // Energy for October 2, 2025 (kWh)
    },
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 10,
      "day": 3,
      "generationValue": 40.7  // Energy for October 3, 2025 (kWh)
    },
    // ... more days
    {
      "systemId": 1053617,
      "year": 2025,
      "month": 10,
      "day": 31,
      "generationValue": 33.4  // Energy for October 31, 2025 (kWh)
    }
  ]
}
```

**Data Processing for Rolling 35 Days**:

To get the last 35 days of data:

1. **Determine date range**: Calculate the date 35 days ago from today
2. **Identify months needed**: Determine which months contain the last 35 days (current month and possibly previous month)
3. **Fetch current month data**: Call `/stats/month?year={currentYear}&month={currentMonth}` (e.g., `year=2025&month=11`)
4. **Fetch previous month data** (if needed): If 35 days ago falls in previous month, call `/stats/month?year={previousYear}&month={previousMonth}` (e.g., `year=2025&month=10`)
5. **Combine and filter**: Merge records from both months, filter to last 35 days, sort by year/month/day
6. **Format for storage**: Convert to `daily_energy_35d` JSONB format

**Example**: If today is November 22, 2025, last 35 days = October 19 to November 22, 2025
- Call `/stats/month?year=2025&month=10` → Get days 19-31 (October)
- Call `/stats/month?year=2025&month=11` → Get days 1-22 (November)
- Combine: `{"2025-10-19": 40.4, "2025-10-20": 44.6, ..., "2025-11-22": 42.5}`

**Storage Format**:
- Store in `daily_energy_35d` JSONB field (backfilled historical data)
- Format: `{"2025-10-19": 40.4, "2025-10-20": 44.6, "2025-10-21": 31.3, ..., "2025-11-22": 42.5}`
- Key: `"YYYY-MM-DD"` (date identifier, e.g., "2025-10-19" for October 19, 2025)
- Value: Daily energy in kWh (keep as kWh, no conversion needed)
- **Rolling window**: Maintain exactly 35 days, remove oldest day when adding new day

**Note**: 
- **For real-time visualization**: Use `telemetry_15m` table to calculate current day energy, not this backfilled aggregate.
- The `statistics.generationValue` represents the total energy for the entire month (sum of all days).
- Daily values are stored in kWh (not converted to MWh) for precision in daily tracking.

## Vendor Adapter Interface

### BaseVendorAdapter Telemetry Methods

```typescript
abstract class BaseVendorAdapter {
  /**
   * Fetch telemetry data from vendor API
   * @param plantVendorId - Vendor's plant identifier
   * @param start - Start date/time
   * @param end - End date/time
   * @returns Array of normalized telemetry records
   */
  abstract getTelemetry(
    plantVendorId: string,
    start: Date,
    end: Date
  ): Promise<NormalizedTelemetry[]>
  
  /**
   * Normalize vendor-specific telemetry data to standard format
   * @param raw - Raw vendor telemetry record
   * @returns Normalized telemetry data
   */
  protected abstract normalizeTelemetry(raw: any): TelemetryData
}
```

### Telemetry Data Structure

```typescript
interface TelemetryData {
  ts: Date                    // Timestamp (15-minute interval)
  totalEnergyMWh: number      // Cumulative energy at this timestamp
  powerKW: number            // Instantaneous power (kW)
  raw: any                    // Vendor-specific untouched value (JSONB)
}

interface NormalizedTelemetry extends TelemetryData {
  plantVendorId: string      // Vendor's plant ID
}
```

## Attribute Mapping

### Vendor-Specific to Standard Mapping

#### Solarman Mapping

| Vendor Field | Standard Field | Conversion | Notes |
|--------------|----------------|------------|-------|
| `lastUpdateTime` (Unix timestamp) | `ts` | `new Date(timestamp * 1000)` | Convert to Date |
| `generationUploadTotalOffset` (kWh) | `totalEnergyMWh` | `value / 1000` | Convert kWh → MWh |
| `generationPower` (W) | `powerKW` | `value / 1000` | Convert W → kW |
| `generationValue` (kWh) | `daily_energy_kwh` | `value` (direct) | Stored in kWh |
| Entire vendor response | `raw` | `JSON.stringify(response)` | Preserve as JSONB |

**Example Solarman Response**:
```json
{
  "stationId": 64786338,
  "lastUpdateTime": 1763468017.0,
  "generationPower": 50000,
  "generationValue": 1250.5,
  "generationUploadTotalOffset": 50000.5,
  "generationMonth": 37500.0,
  "generationYear": 450000.0,
  "generationTotal": 500000.0,
  "installedCapacity": 2000.0,
  "prYesterday": 0.85
}
```

**Normalized Output**:
```typescript
{
  ts: new Date(1763468017000),
  totalEnergyMWh: 50.0005,  // generationUploadTotalOffset / 1000
  powerKW: 50.0,             // generationPower / 1000
  raw: {
    stationId: 64786338,
    lastUpdateTime: 1763468017.0,
    generationPower: 50000,
    generationValue: 1250.5,
    generationUploadTotalOffset: 50000.5,
    generationMonth: 37500.0,
    generationYear: 450000.0,
    generationTotal: 500000.0,
    installedCapacity: 2000.0,
    prYesterday: 0.85
  }
}
```

#### Sungrow Mapping (Example)

| Vendor Field | Standard Field | Conversion | Notes |
|--------------|----------------|------------|-------|
| `collectTime` (ISO string) | `ts` | `new Date(collectTime)` | Parse ISO string |
| `totalEnergy` (kWh) | `totalEnergyMWh` | `value / 1000` | Convert kWh → MWh |
| `activePower` (kW) | `powerKW` | `value` (direct) | Already in kW |
| Entire vendor response | `raw` | `JSON.stringify(response)` | Preserve as JSONB |

### Attributes to Persist

#### In `telemetry_15m` Table

| Attribute | Source | Type | Required | Description |
|-----------|--------|------|----------|-------------|
| `ts` | Vendor timestamp | TIMESTAMPTZ | Yes | 15-minute interval timestamp |
| `plant_id` | Plant reference | INTEGER | Yes | Internal plant identifier (from main DB) |
| `vendor_plant_id` | Vendor payload | TEXT | Yes | Vendor-provided plant identifier |
| `total_energy_mwh` | Vendor cumulative energy | NUMERIC(12,3) | Yes | Cumulative energy at timestamp |
| `power_kw` | Vendor instantaneous power | NUMERIC(12,3) | No | Current power (may be null) |
| `raw` | Entire vendor response | JSONB | Yes | Complete vendor data snapshot |

#### In `plant_aggregates` Table

| Attribute | Source | Type | Description |
|-----------|--------|------|-------------|
| `plant_id` | Plant reference | INTEGER | Internal plant identifier (from main DB) |
| `vendor_plant_id` | Vendor payload | TEXT | Vendor-provided plant identifier |
| **Year-on-Year Data** | | | |
| `previous_years_energy_mwh` | Solarman `/stats/total` API | NUMERIC(10,3) | Energy before 2023: `statistics.generationValue - sum(records[].generationValue)` |
| `yearly_energy_mwh` | Solarman `/stats/total` API | JSONB | Year-on-year energy (extensible): `{"2023": 22.935, "2024": 27.780, "2025": 22.854, ...}` (MWh) |
| `total_energy_mwh` | Solarman `/stats/total` API | NUMERIC(10,3) | Total cumulative energy till date (from `statistics.generationValue`) |
| **Rolling Data** | | | |
| `monthly_energy_13m` | Solarman monthly stats API | JSONB | Rolling 13 months: `{"2024-11": 1250.5, "2024-12": 1320.3, ...}` (MWh) |
| `daily_energy_35d` | Solarman daily stats API | JSONB | Last 35 days: `{"2025-11-22": 125.0, "2025-11-21": 130.5, ...}` (kWh) |
| **Current Metrics** | | | |
| `current_power_kw` | Latest telemetry record | NUMERIC(10,3) | Current power from latest `ts` |
| `last_update_time` | Latest telemetry `ts` | TIMESTAMPTZ | Last telemetry sync timestamp |
| `updated_at` | System timestamp | TIMESTAMPTZ | Record update timestamp |

#### In `work_order_aggregates` Table

| Attribute | Source | Type | Description |
|-----------|--------|------|-------------|
| `work_order_id` | Work order reference | INTEGER | Reference to work order (from main DB) |
| `daily_energy_kwh` | Sum from `plant_aggregates` | NUMERIC(10,3) | Sum of daily energy from all plants in work order |
| `monthly_energy_mwh` | Sum from `plant_aggregates` | NUMERIC(10,3) | Sum of monthly energy from all plants in work order |
| `yearly_energy_mwh` | Sum from `plant_aggregates` | NUMERIC(10,3) | Sum of yearly energy from all plants in work order |
| `total_energy_mwh` | Sum from `plant_aggregates` | NUMERIC(10,3) | Sum of total energy from all plants in work order |
| `current_power_kw` | Sum from `plant_aggregates` | NUMERIC(10,3) | Sum of current power from all plants in work order |
| `last_update_time` | Latest sync timestamp | TIMESTAMPTZ | Last telemetry sync timestamp |
| `updated_at` | System timestamp | TIMESTAMPTZ | Record update timestamp |

## Example: Loading All Metrics from Plant Start Date

### Scenario

**Plant Information**:
- Plant ID: `123`
- Vendor Plant ID: `64786338`
- Vendor: Solarman
- Start Operating Time: `2024-01-01T00:00:00Z`
- Current Date: `2025-11-22T12:00:00Z`

### Step-by-Step Process

#### Step 1: Initialize Backfill

```typescript
// lib/services/telemetrySyncService.ts

async function backfillPlantTelemetry(plantId: number) {
  // 1. Get plant information
  const plant = await supabase
    .from('plants')
    .select('id, vendor_plant_id, vendor_id, start_operating_time, vendors!inner(vendor_type)')
    .eq('id', plantId)
    .single()
  
  const startDate = new Date(plant.start_operating_time)  // 2024-01-01T00:00:00Z
  const endDate = new Date()                              // 2025-11-22T12:00:00Z
  const plantVendorId = plant.vendor_plant_id              // "64786338"
  
  // 2. Get vendor adapter
  const vendor = await getVendor(plant.vendor_id)
  const adapter = VendorManager.getAdapter(vendor)
  
  // 3. Calculate chunks (7-day chunks)
  const chunkSizeDays = 7
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
  const totalChunks = Math.ceil(totalDays / chunkSizeDays)
  
  console.log(`Starting backfill for plant ${plantId}: ${totalChunks} chunks`)
}
```

#### Step 2: Process Chunks

```typescript
// Process each 7-day chunk
for (let chunk = 0; chunk < totalChunks; chunk++) {
  const chunkStart = new Date(startDate)
  chunkStart.setDate(chunkStart.getDate() + (chunk * chunkSizeDays))
  
  const chunkEnd = new Date(chunkStart)
  chunkEnd.setDate(chunkEnd.getDate() + chunkSizeDays)
  chunkEnd = chunkEnd > endDate ? endDate : chunkEnd
  
  console.log(`Processing chunk ${chunk + 1}/${totalChunks}: ${chunkStart.toISOString()} to ${chunkEnd.toISOString()}`)
  
  // Fetch telemetry from vendor
  const telemetryData = await adapter.getTelemetry(
    plantVendorId,
    chunkStart,
    chunkEnd
  )
  
  // Normalize and store
  for (const record of telemetryData) {
    await upsertTelemetry(plantId, record)
  }
}

// After processing all chunks, compute aggregates
await computePlantAggregates(plantId, plantVendorId)
await computeWorkOrderAggregates(plantId)
```

#### Step 3: Normalize and Store

```typescript
async function upsertTelemetry(plantId: number, data: TelemetryData) {
  const telemetryClient = getTelemetryClient()
  
  // Normalize to database format
  const dbRecord = {
    ts: data.ts,
    plant_id: plantId,
    total_energy_mwh: data.totalEnergyMWh,
    power_kw: data.powerKW,
    raw: data.raw
  }
  
  // Upsert (handle duplicates)
  await telemetryClient
    .from('telemetry_15m')
    .upsert(dbRecord, {
      onConflict: 'plant_id,ts',
      ignoreDuplicates: false
    })
}
```

#### Step 4: Compute Plant Aggregates

```typescript
async function computePlantAggregates(plantId: number, vendorPlantId: string) {
  const telemetryClient = getTelemetryClient()
  const adapter = VendorManager.getAdapter(vendorConfig)
  
  // 1. Fetch Year-on-Year Data from Solarman API
  const currentYear = new Date().getFullYear()
  const yearStatsUrl = `${proBaseUrl}/maintain-s/history/power/${vendorPlantId}/stats/total?startYear=2023&endYear=${currentYear}`
  
  const yearStatsResponse = await adapter.loggedFetch(
    yearStatsUrl,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await adapter.authenticate()}`,
        'accept': 'application/json'
      }
    },
    { operation: 'FETCH_YEAR_STATS', description: `Fetch year-on-year stats for plant ${plantId}` }
  )
  
  const yearStats = await yearStatsResponse.json()
  const totalEnergyMwh = (yearStats.statistics?.generationValue || 0) / 1000 // Convert kWh to MWh
  
  // Extract year-by-year data (2023+)
  const yearData: Record<number, number> = {}
  let sumOfYears = 0
  if (yearStats.records && Array.isArray(yearStats.records)) {
    for (const record of yearStats.records) {
      if (record.year >= 2023) {
        yearData[record.year] = (record.generationValue || 0) / 1000 // Convert kWh to MWh
        sumOfYears += yearData[record.year]
      }
    }
  }
  
  // Calculate previous years (before 2023)
  const previousYearsEnergyMwh = totalEnergyMwh - sumOfYears
  
  // 2. Fetch Rolling 13 Months Data from Solarman API
  const monthlyEnergy13m: Record<string, number> = {}
  
  // Calculate date range for last 13 months
  const today = new Date()
  const thirteenMonthsAgo = new Date(today)
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)
  
  const currentYear = today.getFullYear()
  const previousYear = currentYear - 1
  const startYear = thirteenMonthsAgo.getFullYear()
  const startMonth = thirteenMonthsAgo.getMonth() + 1 // 1-based month
  
  // Fetch current year monthly data
  const currentYearUrl = `${proBaseUrl}/maintain-s/history/power/${vendorPlantId}/stats/year?year=${currentYear}`
  const currentYearResponse = await adapter.loggedFetch(
    currentYearUrl,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await adapter.authenticate()}`,
        'accept': 'application/json'
      }
    },
    { operation: 'FETCH_MONTHLY_STATS', description: `Fetch monthly stats for year ${currentYear} for plant ${plantId}` }
  )
  const currentYearData = await currentYearResponse.json()
  
  // Fetch previous year monthly data if needed (for rolling 13 months)
  let previousYearData = null
  if (startYear < currentYear) {
    const previousYearUrl = `${proBaseUrl}/maintain-s/history/power/${vendorPlantId}/stats/year?year=${previousYear}`
    const previousYearResponse = await adapter.loggedFetch(
      previousYearUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await adapter.authenticate()}`,
          'accept': 'application/json'
        }
      },
      { operation: 'FETCH_MONTHLY_STATS', description: `Fetch monthly stats for year ${previousYear} for plant ${plantId}` }
    )
    previousYearData = await previousYearResponse.json()
  }
  
  // Process and combine monthly records
  const allMonthlyRecords: Array<{year: number, month: number, generationValue: number}> = []
  
  // Add previous year records (if fetched)
  if (previousYearData?.records && Array.isArray(previousYearData.records)) {
    for (const record of previousYearData.records) {
      if (record.year === previousYear && record.month >= startMonth) {
        allMonthlyRecords.push({
          year: record.year,
          month: record.month,
          generationValue: record.generationValue || 0
        })
      }
    }
  }
  
  // Add current year records
  if (currentYearData?.records && Array.isArray(currentYearData.records)) {
    for (const record of currentYearData.records) {
      if (record.year === currentYear && record.month > 0) { // month > 0 to exclude year totals
        allMonthlyRecords.push({
          year: record.year,
          month: record.month,
          generationValue: record.generationValue || 0
        })
      }
    }
  }
  
  // Sort by year and month, then take last 13 months
  allMonthlyRecords.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
  
  // Take last 13 months and format for storage
  const last13Months = allMonthlyRecords.slice(-13)
  for (const record of last13Months) {
    const monthKey = `${record.year}-${String(record.month).padStart(2, '0')}` // Format: "2024-11"
    const energyMwh = (record.generationValue || 0) / 1000 // Convert kWh to MWh
    monthlyEnergy13m[monthKey] = energyMwh
  }
  
  // Format: {"2024-11": 1.250, "2024-12": 1.320, "2025-01": 1.640, ..., "2025-11": 0.888}
  
  // 3. Fetch Last 35 Days Data from Solarman API
  const dailyEnergy35d: Record<string, number> = {}
  
  // Calculate date range for last 35 days
  const today = new Date()
  const thirtyFiveDaysAgo = new Date(today)
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)
  
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1 // 1-based month
  const startYear = thirtyFiveDaysAgo.getFullYear()
  const startMonth = thirtyFiveDaysAgo.getMonth() + 1 // 1-based month
  const startDay = thirtyFiveDaysAgo.getDate()
  
  // Fetch current month daily data
  const currentMonthUrl = `${proBaseUrl}/maintain-s/history/power/${vendorPlantId}/stats/month?year=${currentYear}&month=${currentMonth}`
  const currentMonthResponse = await adapter.loggedFetch(
    currentMonthUrl,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await adapter.authenticate()}`,
        'accept': 'application/json'
      }
    },
    { operation: 'FETCH_DAILY_STATS', description: `Fetch daily stats for ${currentYear}-${currentMonth} for plant ${plantId}` }
  )
  const currentMonthData = await currentMonthResponse.json()
  
  // Fetch previous month daily data if needed (for rolling 35 days)
  let previousMonthData = null
  if (startMonth < currentMonth || startYear < currentYear) {
    // Calculate previous month
    let prevYear = currentYear
    let prevMonth = currentMonth - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear = currentYear - 1
    }
    
    const previousMonthUrl = `${proBaseUrl}/maintain-s/history/power/${vendorPlantId}/stats/month?year=${prevYear}&month=${prevMonth}`
    const previousMonthResponse = await adapter.loggedFetch(
      previousMonthUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await adapter.authenticate()}`,
          'accept': 'application/json'
        }
      },
      { operation: 'FETCH_DAILY_STATS', description: `Fetch daily stats for ${prevYear}-${prevMonth} for plant ${plantId}` }
    )
    previousMonthData = await previousMonthResponse.json()
  }
  
  // Process and combine daily records
  const allDailyRecords: Array<{year: number, month: number, day: number, generationValue: number}> = []
  
  // Add previous month records (if fetched)
  if (previousMonthData?.records && Array.isArray(previousMonthData.records)) {
    for (const record of previousMonthData.records) {
      if (record.day > 0 && record.day >= startDay) { // day > 0 to exclude month totals
        allDailyRecords.push({
          year: record.year,
          month: record.month,
          day: record.day,
          generationValue: record.generationValue || 0
        })
      }
    }
  }
  
  // Add current month records
  if (currentMonthData?.records && Array.isArray(currentMonthData.records)) {
    for (const record of currentMonthData.records) {
      if (record.day > 0) { // day > 0 to exclude month totals
        allDailyRecords.push({
          year: record.year,
          month: record.month,
          day: record.day,
          generationValue: record.generationValue || 0
        })
      }
    }
  }
  
  // Sort by year, month, and day, then take last 35 days
  allDailyRecords.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    return a.day - b.day
  })
  
  // Take last 35 days and format for storage
  const last35Days = allDailyRecords.slice(-35)
  for (const record of last35Days) {
    const dayKey = `${record.year}-${String(record.month).padStart(2, '0')}-${String(record.day).padStart(2, '0')}` // Format: "2025-10-19"
    const energyKwh = record.generationValue || 0 // Keep in kWh for daily precision
    dailyEnergy35d[dayKey] = energyKwh
  }
  
  // Format: {"2025-10-19": 40.4, "2025-10-20": 44.6, "2025-10-21": 31.3, ..., "2025-11-22": 42.5}
  
  // 4. Get current power from latest telemetry
  const { data: latestTelemetry } = await telemetryClient
    .from('telemetry_15m')
    .select('power_kw, ts')
    .eq('plant_id', plantId)
    .order('ts', { ascending: false })
    .limit(1)
    .single()
  
  const currentPowerKw = latestTelemetry?.power_kw || null
  const lastUpdateTime = latestTelemetry?.ts || new Date().toISOString()
  
  // 5. Convert yearData to JSONB format (extensible - no schema changes needed)
  const yearlyEnergyMwh: Record<string, number> = {}
  for (const [year, energy] of Object.entries(yearData)) {
    yearlyEnergyMwh[year.toString()] = energy
  }
  
  // 6. Upsert to plant_aggregates (Telemetry DB only)
  await telemetryClient
    .from('plant_aggregates')
    .upsert({
      plant_id: plantId,
      vendor_plant_id: vendorPlantId,
      // Year-on-year data (JSONB - extensible)
      previous_years_energy_mwh: previousYearsEnergyMwh,
      yearly_energy_mwh: yearlyEnergyMwh, // {"2023": 22.935, "2024": 27.780, "2025": 22.854, ...}
      total_energy_mwh: totalEnergyMwh,
      // Rolling data
      monthly_energy_13m: monthlyEnergy13m,
      daily_energy_35d: dailyEnergy35d,
      // Current metrics
      current_power_kw: currentPowerKw,
      last_update_time: lastUpdateTime,
      updated_at: new Date()
    }, {
      onConflict: 'plant_id'
    })
}
```

#### Step 5: Compute Work Order Aggregates

```typescript
async function computeWorkOrderAggregates(plantId: number) {
  const telemetryClient = getTelemetryClient()
  const mainClient = getMainClient() // Only for reading work_order_plants
  
  // Get all work orders containing this plant
  const { data: workOrderPlants } = await mainClient
    .from('work_order_plants')
    .select('work_order_id')
    .eq('plant_id', plantId)
  
  if (!workOrderPlants || workOrderPlants.length === 0) return
  
  // For each work order, compute aggregates
  for (const wop of workOrderPlants) {
    const workOrderId = wop.work_order_id
    
    // Get all plants in this work order
    const { data: allPlants } = await mainClient
      .from('work_order_plants')
      .select('plant_id')
      .eq('work_order_id', workOrderId)
    
    if (!allPlants || allPlants.length === 0) continue
    
    const plantIds = allPlants.map(p => p.plant_id)
    
    // Get aggregates for all plants in this work order
    const { data: plantAggregates } = await telemetryClient
      .from('plant_aggregates')
      .select('previous_years_energy_mwh, yearly_energy_mwh, total_energy_mwh, monthly_energy_13m, daily_energy_35d, current_power_kw, last_update_time')
      .in('plant_id', plantIds)
    
    if (!plantAggregates || plantAggregates.length === 0) continue
    
    // Sum year-on-year aggregates
    const previousYearsEnergyMwh = plantAggregates.reduce((sum, p) => sum + (p.previous_years_energy_mwh || 0), 0)
    const totalEnergyMwh = plantAggregates.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0)
    
    // Aggregate yearly_energy_mwh JSONB (sum values for each year across all plants)
    const yearlyEnergyMwh: Record<string, number> = {}
    for (const plant of plantAggregates) {
      if (plant.yearly_energy_mwh && typeof plant.yearly_energy_mwh === 'object') {
        for (const [year, value] of Object.entries(plant.yearly_energy_mwh)) {
          yearlyEnergyMwh[year] = (yearlyEnergyMwh[year] || 0) + (value as number)
        }
      }
    }
    
    // Aggregate monthly_energy_13m JSONB (sum values for each month across all plants)
    const monthlyEnergy13m: Record<string, number> = {}
    for (const plant of plantAggregates) {
      if (plant.monthly_energy_13m && typeof plant.monthly_energy_13m === 'object') {
        for (const [month, value] of Object.entries(plant.monthly_energy_13m)) {
          monthlyEnergy13m[month] = (monthlyEnergy13m[month] || 0) + (value as number)
        }
      }
    }
    
    // Aggregate daily_energy_35d JSONB (sum values for each day across all plants)
    const dailyEnergy35d: Record<string, number> = {}
    for (const plant of plantAggregates) {
      if (plant.daily_energy_35d && typeof plant.daily_energy_35d === 'object') {
        for (const [day, value] of Object.entries(plant.daily_energy_35d)) {
          dailyEnergy35d[day] = (dailyEnergy35d[day] || 0) + (value as number)
        }
      }
    }
    
    // Sum current power
    const currentPowerKw = plantAggregates.reduce((sum, p) => sum + (p.current_power_kw || 0), 0)
    
    // Get latest update time
    const lastUpdateTime = new Date(Math.max(...plantAggregates.map(p => new Date(p.last_update_time).getTime())))
    
    // Upsert to work_order_aggregates (Telemetry DB only)
    await telemetryClient
      .from('work_order_aggregates')
      .upsert({
        work_order_id: workOrderId,
        previous_years_energy_mwh: previousYearsEnergyMwh,
        yearly_energy_mwh: yearlyEnergyMwh, // {"2023": 68.805, "2024": 83.340, "2025": 68.562, ...}
        total_energy_mwh: totalEnergyMwh,
        monthly_energy_13m: monthlyEnergy13m,
        daily_energy_35d: dailyEnergy35d,
        current_power_kw: currentPowerKw,
        last_update_time: lastUpdateTime,
        updated_at: new Date()
      }, {
        onConflict: 'work_order_id'
      })
  }
}
```

### Complete Example Flow

```
┌─────────────────────────────────────────────────────────────────┐
│          Example: Backfill Plant 123 (Solarman)                │
└─────────────────────────────────────────────────────────────────┘

Plant Info:
  • ID: 123
  • Vendor Plant ID: 64786338
  • Start Date: 2024-01-01T00:00:00Z
  • End Date: 2025-11-22T12:00:00Z
  • Duration: ~690 days

Step 1: Calculate Chunks
  • Chunk Size: 7 days
  • Total Chunks: 99 chunks

Step 2: Process Chunk 1 (2024-01-01 to 2024-01-08)
  │
  ├─→ Call Solarman API:
  │   GET /station/list
  │   stationId: 64786338
  │   startTime: 2024-01-01T00:00:00Z
  │   endTime: 2024-01-08T00:00:00Z
  │
  ├─→ Response: 672 records (7 days × 96 intervals/day)
  │   [
  │     {
  │       "lastUpdateTime": 1704067200,
  │       "generationUploadTotalOffset": 0.0,
  │       "generationPower": 0,
  │       ...
  │     },
  │     {
  │       "lastUpdateTime": 1704068100,  // +15 min
  │       "generationUploadTotalOffset": 0.125,
  │       "generationPower": 500,
  │       ...
  │     },
  │     ... (670 more records)
  │   ]
  │
  ├─→ Normalize Each Record:
  │   Record 1:
  │   {
  │     ts: 2024-01-01T00:00:00Z,
  │     totalEnergyMWh: 0.0,
  │     powerKW: 0.0,
  │     raw: { ...original... }
  │   }
  │
  │   Record 2:
  │   {
  │     ts: 2024-01-01T00:15:00Z,
  │     totalEnergyMWh: 0.000125,
  │     powerKW: 0.5,
  │     raw: { ...original... }
  │   }
  │
  └─→ Upsert to telemetry_15m:
      INSERT INTO telemetry_15m (ts, plant_id, total_energy_mwh, power_kw, raw)
      VALUES
        ('2024-01-01T00:00:00Z', 123, 0.0, 0.0, '{"lastUpdateTime":1704067200,...}'),
        ('2024-01-01T00:15:00Z', 123, 0.000125, 0.5, '{"lastUpdateTime":1704068100,...}'),
        ...
      ON CONFLICT (plant_id, ts) DO UPDATE
      SET total_energy_mwh = EXCLUDED.total_energy_mwh,
          power_kw = EXCLUDED.power_kw,
          raw = EXCLUDED.raw

Step 3: Process Remaining Chunks (2-99)
  │
  └─→ Repeat Step 2 for each chunk
      Progress: 2/99, 3/99, ..., 99/99

Step 4: Compute Final Aggregates
  │
  ├─→ [Fetch Year-on-Year Data from Solarman API]
  │   GET /maintain-s/history/power/64786338/stats/total?startYear=2023&endYear=2025
  │   │
  │   ├─→ Response:
  │   │   {
  │   │     "statistics": {
  │   │       "generationValue": 88779.1  // Total till date (kWh)
  │   │     },
  │   │     "records": [
  │   │       {"year": 2021, "generationValue": 7476.0},
  │   │       {"year": 2022, "generationValue": 7733.7},
  │   │       {"year": 2023, "generationValue": 22935.4},
  │   │       {"year": 2024, "generationValue": 27779.8},
  │   │       {"year": 2025, "generationValue": 22854.4}
  │   │     ]
  │   │   }
  │   │
  │   ├─→ Calculate:
  │   │   • total_energy_mwh = 88779.1 / 1000 = 88.779 MWh
    │   │   • yearly_energy_mwh = {"2023": 22.935, "2024": 27.780, "2025": 22.854, ...} (MWh)
  │   │   • sum_of_years = 22.935 + 27.780 + 22.854 = 73.569 MWh
  │   │   • previous_years_energy_mwh = 88.779 - 73.569 = 15.210 MWh
  │   │
  │   └─→ Note: Previous years (2021 + 2022) = 7476.0 + 7733.7 = 15,209.7 kWh ≈ 15.210 MWh ✓
  │
  ├─→ [Fetch Rolling 13 Months Data]
  │   │
  │   ├─→ Call 1: GET /maintain-s/history/power/64786338/stats/year?year=2024
  │   │   Response:
  │   │   {
  │   │     "statistics": {"generationValue": 27779.8},
  │   │     "records": [
  │   │       {"year": 2024, "month": 11, "generationValue": 1250.0},
  │   │       {"year": 2024, "month": 12, "generationValue": 1320.0}
  │   │     ]
  │   │   }
  │   │
  │   ├─→ Call 2: GET /maintain-s/history/power/64786338/stats/year?year=2025
  │   │   Response:
  │   │   {
  │   │     "statistics": {"generationValue": 22854.4},
  │   │     "records": [
  │   │       {"year": 2025, "month": 1, "generationValue": 1640.1},
  │   │       {"year": 2025, "month": 2, "generationValue": 1968.0},
  │   │       {"year": 2025, "month": 3, "generationValue": 2389.8},
  │   │       {"year": 2025, "month": 4, "generationValue": 3379.2},
  │   │       {"year": 2025, "month": 5, "generationValue": 2667.6},
  │   │       {"year": 2025, "month": 6, "generationValue": 3052.3},
  │   │       {"year": 2025, "month": 7, "generationValue": 2324.1},
  │   │       {"year": 2025, "month": 8, "generationValue": 1687.5},
  │   │       {"year": 2025, "month": 9, "generationValue": 1506.8},
  │   │       {"year": 2025, "month": 10, "generationValue": 1350.6},
  │   │       {"year": 2025, "month": 11, "generationValue": 888.4}
  │   │     ]
  │   │   }
  │   │
  │   └─→ Combine and filter to last 13 months:
  │       • Store in monthly_energy_13m JSONB
  │       • Format: {"2024-11": 1.250, "2024-12": 1.320, "2025-01": 1.640, "2025-02": 1.968, "2025-03": 2.390, "2025-04": 3.379, "2025-05": 2.668, "2025-06": 3.052, "2025-07": 2.324, "2025-08": 1.688, "2025-09": 1.507, "2025-10": 1.351, "2025-11": 0.888}
  │       • Convert kWh to MWh: generationValue / 1000
  │
  ├─→ [Fetch Last 35 Days Data]
  │   │
  │   ├─→ Call 1: GET /maintain-s/history/power/64786338/stats/month?year=2025&month=10
  │   │   Response:
  │   │   {
  │   │     "statistics": {"generationValue": 1350.6},
  │   │     "records": [
  │   │       {"year": 2025, "month": 10, "day": 19, "generationValue": 40.4},
  │   │       {"year": 2025, "month": 10, "day": 20, "generationValue": 44.6},
  │   │       {"year": 2025, "month": 10, "day": 21, "generationValue": 31.3},
  │   │       {"year": 2025, "month": 10, "day": 22, "generationValue": 42.5},
  │   │       {"year": 2025, "month": 10, "day": 23, "generationValue": 42.0},
  │   │       {"year": 2025, "month": 10, "day": 24, "generationValue": 35.9},
  │   │       {"year": 2025, "month": 10, "day": 25, "generationValue": 40.4},
  │   │       {"year": 2025, "month": 10, "day": 26, "generationValue": 38.8},
  │   │       {"year": 2025, "month": 10, "day": 27, "generationValue": 37.1},
  │   │       {"year": 2025, "month": 10, "day": 28, "generationValue": 33.7},
  │   │       {"year": 2025, "month": 10, "day": 29, "generationValue": 33.0},
  │   │       {"year": 2025, "month": 10, "day": 30, "generationValue": 33.2},
  │   │       {"year": 2025, "month": 10, "day": 31, "generationValue": 33.4}
  │   │       // ... more days from October
  │   │     ]
  │   │   }
  │   │
  │   ├─→ Call 2: GET /maintain-s/history/power/64786338/stats/month?year=2025&month=11
  │   │   Response:
  │   │   {
  │   │     "statistics": {"generationValue": 888.4},
  │   │     "records": [
  │   │       {"year": 2025, "month": 11, "day": 1, "generationValue": 47.4},
  │   │       {"year": 2025, "month": 11, "day": 2, "generationValue": 41.8},
  │   │       // ... more days
  │   │       {"year": 2025, "month": 11, "day": 22, "generationValue": 42.5}
  │   │     ]
  │   │   }
  │   │
  │   └─→ Combine and filter to last 35 days:
  │       • Store in daily_energy_35d JSONB
  │       • Format: {"2025-10-19": 40.4, "2025-10-20": 44.6, "2025-10-21": 31.3, "2025-10-22": 42.5, ..., "2025-11-22": 42.5}
  │       • Keep in kWh (no conversion): generationValue (kWh)
  │
  ├─→ [Get Current Power from Latest Telemetry]
  │   SELECT power_kw, ts FROM telemetry_15m
  │   WHERE plant_id = 123 ORDER BY ts DESC LIMIT 1
  │   │
  │   └─→ Result:
  │       • ts: 2025-11-22T12:00:00Z
  │       • power_kw: 2.5 kW

Step 5: Upsert Plant Aggregates (Telemetry DB)
  │
  └─→ INSERT INTO plant_aggregates (
        plant_id, vendor_plant_id,
        previous_years_energy_mwh, yearly_energy_mwh,
        total_energy_mwh,
        monthly_energy_13m, daily_energy_35d,
        current_power_kw, last_update_time, updated_at
      )
      VALUES (
        123, '64786338',
        15.210,
        '{"2023": 22.935, "2024": 27.780, "2025": 22.854}'::jsonb,
        88.779,
        '{"2024-11": 1.250, "2024-12": 1.320, ...}'::jsonb,
        '{"2025-11-22": 125.0, "2025-11-21": 130.5, ...}'::jsonb,
        2.5, '2025-11-22T12:00:00Z', NOW()
      )
      ON CONFLICT (plant_id) DO UPDATE
      SET previous_years_energy_mwh = EXCLUDED.previous_years_energy_mwh,
          yearly_energy_mwh = EXCLUDED.yearly_energy_mwh,
          total_energy_mwh = EXCLUDED.total_energy_mwh,
          monthly_energy_13m = EXCLUDED.monthly_energy_13m,
          daily_energy_35d = EXCLUDED.daily_energy_35d,
          current_power_kw = EXCLUDED.current_power_kw,
          last_update_time = EXCLUDED.last_update_time,
          updated_at = NOW()

Step 6: Compute Work Order Aggregates (Telemetry DB)
  │
  ├─→ Get all work orders containing plant 123
  │   (from work_order_plants table in main DB)
  │
  ├─→ For each work order:
  │   ├─→ Get all plants in work order
  │   ├─→ Sum aggregates from plant_aggregates
  │   └─→ Upsert to work_order_aggregates
  │
  └─→ Example: Work Order 456 contains plants [123, 124, 125]
      • Sum daily_energy_kwh: 125.0 + 130.0 + 120.0 = 375.0 kWh
      • Sum monthly_energy_mwh: 0.625 + 0.650 + 0.600 = 1.875 MWh
      • Sum yearly_energy_mwh: 5.125 + 5.300 + 5.000 = 15.425 MWh
      • Sum total_energy_mwh: 50.125 + 52.000 + 48.500 = 150.625 MWh
      • Sum current_power_kw: 2.5 + 2.6 + 2.4 = 7.5 kW

Result:
  ✅ 66,240 telemetry records stored in telemetry_15m
  ✅ Plant aggregates stored in plant_aggregates:
     • Previous years (before 2023): 15.210 MWh
     • Year 2023: 22.935 MWh
     • Year 2024: 27.780 MWh
     • Year 2025: 22.854 MWh
     • Total energy: 88.779 MWh
     • Rolling 12 months: {"2024-11": 1.250, "2024-12": 1.320, ...} (MWh)
     • Last 31 days: {"2025-11-22": 125.0, "2025-11-21": 130.5, ...} (kWh)
     • Current power: 2.5 kW
  ✅ Work order aggregates updated in work_order_aggregates
     (for all work orders containing this plant)
     • Year-on-year data summed from all plants
     • Monthly and daily JSONB fields aggregated by summing corresponding month/day values
```

### Sample Data After Backfill

#### Telemetry DB (`telemetry_15m`)

| ts | plant_id | vendor_plant_id | total_energy_mwh | power_kw | raw |
|----|----------|-----------------|------------------|----------|-----|
| 2024-01-01T00:00:00Z | 123 | 64786338 | 0.000 | 0.0 | `{"lastUpdateTime":1704067200,...}` |
| 2024-01-01T00:15:00Z | 123 | 64786338 | 0.000125 | 0.5 | `{"lastUpdateTime":1704068100,...}` |
| 2024-01-01T00:30:00Z | 123 | 64786338 | 0.000250 | 1.0 | `{"lastUpdateTime":1704069000,...}` |
| ... | ... | ... | ... | ... | ... |
| 2025-11-22T12:00:00Z | 123 | 64786338 | 50.125 | 2.5 | `{"lastUpdateTime":1763468017,...}` |

#### Telemetry DB (`plant_aggregates`)

| plant_id | vendor_plant_id | previous_years_energy_mwh | yearly_energy_mwh | total_energy_mwh | monthly_energy_13m | daily_energy_35d | current_power_kw | last_update_time | updated_at |
|----------|-----------------|---------------------------|-------------------|------------------|-------------------|------------------|------------------|------------------|------------|
| 123 | 64786338 | 15.210 | `{"2023": 22.935, "2024": 27.780, "2025": 22.854}` | 88.779 | `{"2024-11": 1.250, "2024-12": 1.320, ...}` | `{"2025-11-22": 125.0, "2025-11-21": 130.5, ...}` | 2.5 | 2025-11-22T12:00:00Z | 2025-11-22T12:00:00Z |

**Note**: 
- `previous_years_energy_mwh` = Total energy before 2023 (calculated as: `total_energy_mwh - sum(yearly_energy_mwh values)`)
- `yearly_energy_mwh` = JSONB object with year-on-year energy (extensible, no schema changes needed for new years)
- `monthly_energy_13m` = JSONB object with last 13 months of monthly energy (MWh)
- `daily_energy_35d` = JSONB object with last 35 days of daily energy (kWh)

#### Telemetry DB (`work_order_aggregates`)

| work_order_id | previous_years_energy_mwh | yearly_energy_mwh | total_energy_mwh | monthly_energy_13m | daily_energy_35d | current_power_kw | last_update_time | updated_at |
|---------------|---------------------------|-------------------|------------------|-------------------|------------------|------------------|------------------|------------|
| 456 | 45.630 | `{"2023": 68.805, "2024": 83.340, "2025": 68.562}` | 266.337 | `{"2024-11": 3.750, "2024-12": 3.960, ...}` | `{"2025-11-22": 375.0, "2025-11-21": 391.5, ...}` | 7.5 | 2025-11-22T12:00:00Z | 2025-11-22T12:00:00Z |

**Note**: Work order 456 contains plants [123, 124, 125]. The aggregates are the sum of all plants in the work order:
- `yearly_energy_mwh`, `monthly_energy_13m`, and `daily_energy_35d` JSONB fields are aggregated by summing corresponding year/month/day values across all plants

## API Endpoints

### Telemetry Endpoints

#### GET /api/telemetry/plant/[id]?hours=24

Get telemetry for a specific plant.

**Query Parameters**:
- `hours` (optional): Hours of data to retrieve (default: 24, max: 744 for 31 days)

**Response**:
```json
{
  "plantId": 123,
  "data": [
    {
      "ts": "2025-11-22T00:00:00Z",
      "total_energy_mwh": 50.000,
      "power_kw": 2.0,
      "raw": { ... }
    },
    {
      "ts": "2025-11-22T00:15:00Z",
      "total_energy_mwh": 50.004,
      "power_kw": 2.1,
      "raw": { ... }
    }
  ],
  "period": "24h",
  "recordCount": 96
}
```

#### POST /api/telemetry/plant/[id]/backfill

Trigger one-time backfill for a plant (SUPERADMIN only).

**Response**:
```json
{
  "success": true,
  "plantId": 123,
  "recordsSynced": 66240,
  "chunksProcessed": 99,
  "duration": "45m 30s",
  "aggregates": {
    "daily_energy_kwh": 125.0,
    "monthly_energy_mwh": 0.625,
    "yearly_energy_mwh": 5.125,
    "total_energy_mwh": 50.125,
    "current_power_kw": 2.5
  }
}
```

#### POST /api/telemetry/sync-all

Trigger 15-minute sync cron for all plants (same as plant list sync, requires CRON_SECRET or SUPERADMIN). This updates plant list in Main DB and telemetry data (`telemetry_15m` and current aggregates) in Telemetry DB.

**Response**:
```json
{
  "success": true,
  "plantsSynced": 150,
  "totalRecords": 14400,
  "aggregatesUpdated": 150,
  "errors": [],
  "duration": "12m 45s"
}
```

## Visualization Requirements

**Important**: All real-time visualizations, graphs, and current day/month calculations use the `telemetry_15m` table. The `plant_aggregates` table contains backfilled historical data and should not be used for real-time visualization.

### Frontend Charts

#### 1. 15-Minute Energy Graph (Last 31 Days)

**Data Source**: `telemetry_15m` table
**Query**:
```sql
SELECT ts, total_energy_mwh
FROM telemetry_15m
WHERE plant_id = $1
  AND ts >= NOW() - INTERVAL '31 days'
ORDER BY ts ASC
```

**Chart Type**: Line chart
**X-Axis**: Time (ts)
**Y-Axis**: Cumulative Energy (MWh)

#### 2. Power vs Time Graph

**Data Source**: `telemetry_15m` table
**Query**:
```sql
SELECT ts, power_kw
FROM telemetry_15m
WHERE plant_id = $1
  AND ts >= NOW() - INTERVAL '24 hours'
  AND power_kw IS NOT NULL
ORDER BY ts ASC
```

**Chart Type**: Line chart
**X-Axis**: Time (ts)
**Y-Axis**: Power (kW)

#### 3. Daily Energy Bar Chart (Last 31 Days)

**Data Source**: Aggregated from `telemetry_15m`
**Query**:
```sql
SELECT 
  DATE(ts) as date,
  (MAX(total_energy_mwh) - MIN(total_energy_mwh)) * 1000 as daily_energy_kwh
FROM telemetry_15m
WHERE plant_id = $1
  AND ts >= NOW() - INTERVAL '31 days'
GROUP BY DATE(ts)
ORDER BY date ASC
```

**Chart Type**: Bar chart
**X-Axis**: Date
**Y-Axis**: Daily Energy (kWh)

### Backend Optimization

- **Index Usage**: All queries use `(plant_id, ts)` index
- **No Blocking Scans**: Queries limited to 31-day window
- **Pagination**: Large result sets paginated
- **Caching**: Consider caching for frequently accessed data

## Failure Recovery

### Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Failure Recovery Flow                         │
└─────────────────────────────────────────────────────────────────┘

[API Call Fails]
    │
    ├─→ [Retry Logic]
    │   │
    │   ├─→ Attempt 1: Immediate retry
    │   ├─→ Attempt 2: Wait 5 seconds
    │   ├─→ Attempt 3: Wait 15 seconds
    │   └─→ Attempt 4: Wait 30 seconds
    │
    ├─→ [If All Retries Fail]
    │   │
    │   ├─→ Log error to vendor_sync_logs
    │   ├─→ Skip this plant
    │   └─→ Continue with next plant
    │
    └─→ [Partial Backfill Recovery]
        │
        ├─→ Check last successful timestamp
        ├─→ Resume from last timestamp + 1 interval
        └─→ Continue backfill
```

### Error Logging

**Table**: `vendor_sync_logs` (if exists)

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `vendor_id` | INTEGER | Vendor ID |
| `plant_id` | INTEGER | Plant ID (nullable) |
| `sync_type` | TEXT | 'telemetry', 'plant', 'alert' |
| `status` | TEXT | 'success', 'error', 'partial' |
| `error_message` | TEXT | Error details |
| `records_processed` | INTEGER | Number of records processed |
| `started_at` | TIMESTAMPTZ | Sync start time |
| `completed_at` | TIMESTAMPTZ | Sync completion time |
| `metadata` | JSONB | Additional context |

### Recovery Scenarios

#### Scenario 1: API Rate Limit

```
Error: 429 Too Many Requests
Action:
  1. Wait for rate limit window (check Retry-After header)
  2. Resume from last successful timestamp
  3. Reduce chunk size if needed
  4. Log rate limit event
```

#### Scenario 2: Network Timeout

```
Error: Network timeout after 30s
Action:
  1. Retry with exponential backoff
  2. If fails 3 times, skip this chunk
  3. Log timeout error
  4. Continue with next chunk
```

#### Scenario 3: Corrupted Data

```
Error: Invalid data format from vendor
Action:
  1. Skip corrupted record
  2. Log warning with raw data
  3. Continue processing
  4. Maintain data integrity
```

#### Scenario 4: Partial Backfill Interruption

```
Interruption: Process killed or server restart
Recovery:
  1. On restart, check last successful timestamp per plant
  2. Resume from last timestamp + 1 interval
  3. Continue backfill from interruption point
  4. Log recovery event
```

## Implementation Checklist

- [ ] Create `telemetry_15m` table in telemetry database
- [ ] Create indexes `(plant_id, ts)`, `(ts)`, and `(vendor_plant_id, ts)` for `telemetry_15m`
- [ ] Create `plant_aggregates` table in telemetry database
- [ ] Create indexes `(plant_id)` and `(last_update_time)` for `plant_aggregates`
- [ ] Create `work_order_aggregates` table in telemetry database
- [ ] Create indexes `(work_order_id)` and `(last_update_time)` for `work_order_aggregates`
- [ ] Implement `telemetrySyncService.ts`:
  - [ ] `syncPlantTelemetry(plantId)`
  - [ ] `syncAllPlantsDaily()`
  - [ ] `backfillPlantTelemetry(plantId)`
  - [ ] `computePlantAggregates(plantId, vendorPlantId)`
  - [ ] `computeWorkOrderAggregates(plantId)`
- [ ] Add telemetry methods to `BaseVendorAdapter`
- [ ] Implement vendor-specific telemetry adapters:
  - [ ] Solarman telemetry adapter
  - [ ] Sungrow telemetry adapter (if needed)
- [ ] Create telemetry API routes:
  - [ ] `GET /api/telemetry/plant/[id]`
  - [ ] `POST /api/telemetry/plant/[id]/backfill`
  - [ ] `POST /api/telemetry/sync-all`
- [ ] Implement backfill functionality:
  - [ ] Chunked processing (7-day chunks)
  - [ ] Pagination support
  - [ ] Partial backfill recovery
- [ ] Extend existing 15-minute plant list sync cron to also update telemetry_15m and current aggregates
- [ ] Set up morning cron (00:15 AM - updates yesterday's data at daily, monthly, yearly basis)
- [ ] Implement backfill mode complete (Super Admin triggered, per plant)
- [ ] Implement rolling window maintenance (35 days, 13 months)
- [ ] Add aggregate computation logic
- [ ] Create failure recovery and logging
- [ ] Add telemetry visualization components:
  - [ ] 15-min energy graph
  - [ ] Power vs time graph
  - [ ] Daily energy bar chart

---

**Last Updated**: 2025-11-22
**Version**: 1.0.0

