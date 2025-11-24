# Telemetry System - Complete Documentation

## Overview

The Telemetry System is a **vendor-agnostic, adapter-driven, time-series ingestion system** designed for high-volume solar plant monitoring data. It provides 15-minute resolution data storage, automatic aggregation, and efficient querying for visualization.

**Key Architecture Principle**: All telemetry data, including aggregates, is stored exclusively in the **Telemetry Database**. No data is written to the Main Database, even if this means duplicating information. Aggregates are maintained at both the **plant level** and **work order level** for efficient querying.

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
    │            [Daily Sync]        [Backfill Mode]
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
    │                    • daily_energy_kwh
    │                    • monthly_energy_mwh
    │                    • yearly_energy_mwh
    │                    • total_energy_mwh
    │                    • current_power_kw
    │                              │
    │                              ▼
    │                    [Upsert to plant_aggregates]
    │                    (on plant_id)
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

**Purpose**: Store raw 15-minute interval telemetry data

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
- **31-day rolling window**: Summary data auto-deleted after 31 days
- **Long-term storage**: Raw 15-minute data stays indefinitely

### 2. Plant Aggregates Table: `plant_aggregates`

**Purpose**: Store computed aggregates at the plant level for efficient querying

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `plant_id` | INTEGER | NOT NULL | Internal plant identifier (FK to main DB) |
| `vendor_plant_id` | TEXT | NOT NULL | Vendor-provided plant identifier |
| `daily_energy_kwh` | NUMERIC(10,3) | NOT NULL | Daily energy in kWh (computed from telemetry) |
| `monthly_energy_mwh` | NUMERIC(10,3) | NOT NULL | Monthly energy from 1st of month |
| `yearly_energy_mwh` | NUMERIC(10,3) | NOT NULL | Yearly energy from 1st Jan |
| `total_energy_mwh` | NUMERIC(10,3) | NOT NULL | Total cumulative energy (from `generationUploadTotalOffset`) |
| `current_power_kw` | NUMERIC(10,3) | NULL | Current power from latest timestamp |
| `last_update_time` | TIMESTAMPTZ | NOT NULL | Last telemetry sync timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Record update timestamp |

**Primary Key**: `(plant_id)`

**Indexes**:
- `idx_plant_aggregates_plant_id` on `(plant_id)` btree (mandatory)
- `idx_plant_aggregates_vendor_plant_id` on `(vendor_plant_id)` btree (vendor lookups)
- `idx_plant_aggregates_last_update` on `(last_update_time)` btree (for sync tracking)

### 3. Work Order Aggregates Table: `work_order_aggregates`

**Purpose**: Store computed aggregates at the work order level (sum of all plants in work order)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `work_order_id` | INTEGER | NOT NULL | Reference to work order (from main database) |
| `daily_energy_kwh` | NUMERIC(10,3) | NOT NULL | Sum of daily energy from all plants in work order |
| `monthly_energy_mwh` | NUMERIC(10,3) | NOT NULL | Sum of monthly energy from all plants in work order |
| `yearly_energy_mwh` | NUMERIC(10,3) | NOT NULL | Sum of yearly energy from all plants in work order |
| `total_energy_mwh` | NUMERIC(10,3) | NOT NULL | Sum of total energy from all plants in work order |
| `current_power_kw` | NUMERIC(10,3) | NULL | Sum of current power from all plants in work order |
| `last_update_time` | TIMESTAMPTZ | NOT NULL | Last telemetry sync timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Record update timestamp |

**Primary Key**: `(work_order_id)`

**Indexes**:
- `idx_work_order_aggregates_wo_id` on `(work_order_id)` btree (mandatory)
- `idx_work_order_aggregates_last_update` on `(last_update_time)` btree (for sync tracking)

**Note**: Work order aggregates are computed by summing the corresponding values from `plant_aggregates` for all plants associated with the work order (via `work_order_plants` table in main database).

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

## Sync Modes

### 1. One-Time Reload (Backfill Mode)

**Purpose**: Full historical data reconstruction for a plant

**Process**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Backfill Mode Flow                            │
└─────────────────────────────────────────────────────────────────┘

[Start Backfill]
    │
    ▼
[Get Plant Info]
    │
    ├─→ startDate = plant.start_operating_time
    ├─→ endDate = NOW()
    └─→ plantVendorId = plant.vendor_plant_id
    │
    ▼
[Calculate Chunks]
    │
    ├─→ chunkSize = 7 days (or vendor max)
    ├─→ totalChunks = ceil((endDate - startDate) / chunkSize)
    └─→ currentChunk = 0
    │
    ▼
[For Each Chunk]
    │
    ├─→ chunkStart = startDate + (currentChunk * chunkSize)
    ├─→ chunkEnd = min(chunkStart + chunkSize, endDate)
    │
    ▼
    [Call adapter.getTelemetry(plantVendorId, chunkStart, chunkEnd)]
    │
    ├─→ [Handle Pagination] (if vendor supports)
    │   │
    │   ├─→ page = 1
    │   ├─→ hasMore = true
    │   │
    │   └─→ [While hasMore]
    │       │
    │       ├─→ [Fetch page]
    │       ├─→ [Normalize data]
    │       ├─→ [Upsert to DB]
    │       ├─→ [Check for next page]
    │       └─→ page++
    │
    ▼
    [Log Progress]
    │
    ├─→ currentChunk++
    └─→ [If currentChunk < totalChunks] → Continue
    │
    ▼
[Compute Plant Aggregates]
    │
    ├─→ vendor_plant_id = plantVendorId (stored alongside internal ID)
    ├─→ vendor_plant_id = plantVendorId
    ├─→ daily_energy_kwh = max(totalEnergy) - min(totalEnergy) for today
    ├─→ monthly_energy_mwh = max(totalEnergy) - min(totalEnergy) from 1st of month
    ├─→ yearly_energy_mwh = max(totalEnergy) - min(totalEnergy) from 1st Jan
    ├─→ total_energy_mwh = max(totalEnergy) (from generationUploadTotalOffset)
    └─→ current_power_kw = latest power value
    │
    ▼
[Upsert to plant_aggregates]
    │
    │   ON CONFLICT (plant_id) DO UPDATE
    │
    ▼
[Compute Work Order Aggregates]
    │
    ├─→ Get all work orders containing this plant
    ├─→ For each work order:
    │   ├─→ Sum daily_energy_kwh from all plants in work order
    │   ├─→ Sum monthly_energy_mwh from all plants in work order
    │   ├─→ Sum yearly_energy_mwh from all plants in work order
    │   ├─→ Sum total_energy_mwh from all plants in work order
    │   └─→ Sum current_power_kw from all plants in work order
    │
    ▼
[Upsert to work_order_aggregates]
    │
    │   ON CONFLICT (work_order_id) DO UPDATE
    │
    ▼
[End]
```

**Backfill Requirements**:

- **Year-on-Year**: Cumulative energy from plant start to end of last year
- **Month-on-Month**: Cumulative energy from plant start to end of last month
- **Till Last Day**: Cumulative energy from plant start to end of yesterday
- **Full 15-min Series**: Complete time-series reconstruction (if vendor supports)

**Features**:

- Supports paginated vendor APIs
- Long date-range pulling (handles years of data)
- Partial backfill continuation (resumes from last successful timestamp)
- Chunked processing (7-day chunks or vendor maximum)
- Progress logging and error recovery

### 2. Daily Sync (Scheduled)

**Purpose**: Daily update of all plants' telemetry data

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
    [Normalize & Upsert]
    │
    ▼
    [Compute Plant Aggregates]
    │
    ├─→ daily_energy_kwh = max(totalEnergy) - min(totalEnergy) for today
    ├─→ monthly_energy_mwh = max(totalEnergy) - min(totalEnergy) from 1st of month
    ├─→ yearly_energy_mwh = max(totalEnergy) - min(totalEnergy) from 1st Jan
    ├─→ total_energy_mwh = max(totalEnergy) (from generationUploadTotalOffset)
    └─→ current_power_kw = latest power value
    │
    ▼
    [Upsert to plant_aggregates]
    │
    │   ON CONFLICT (plant_id) DO UPDATE
    │
    ▼
    [Compute Work Order Aggregates]
    │
    ├─→ Get all work orders containing this plant
    ├─→ For each work order:
    │   ├─→ Sum aggregates from all plants in work order
    │   └─→ Update work_order_aggregates
    │
    ▼
    [Upsert to work_order_aggregates]
    │
    │   ON CONFLICT (work_order_id) DO UPDATE
    │
    ▼
[Maintain 31-Day Window]
    │
    ├─→ [Delete telemetry_15m WHERE ts < NOW() - 31 days]
    └─→ (Only for summary/aggregate tables, raw data stays)
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

- `plant_aggregates.daily_energy_kwh` (daily aggregate for plant)
- `plant_aggregates.monthly_energy_mwh` (monthly aggregate for plant)
- `plant_aggregates.yearly_energy_mwh` (yearly aggregate for plant)
- `plant_aggregates.total_energy_mwh` (total cumulative for plant)
- `plant_aggregates.current_power_kw` (latest power for plant)
- `work_order_aggregates.*` (sum of all plants in each work order)

**31-Day Rolling Window**:

- Maintains last 31 days of 15-minute data for visualization
- Auto-deletes data older than 31 days (summary tables only)
- Long-term data stays indefinitely in raw `telemetry_15m` table

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
| `daily_energy_kwh` | Computed from telemetry | NUMERIC(10,3) | Daily energy (max - min for day) |
| `monthly_energy_mwh` | Computed from telemetry | NUMERIC(10,3) | Monthly energy from 1st of month |
| `yearly_energy_mwh` | Computed from telemetry | NUMERIC(10,3) | Yearly energy from 1st Jan |
| `total_energy_mwh` | `generationUploadTotalOffset` | NUMERIC(10,3) | Total cumulative (from vendor) |
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
  
  // Get all telemetry for this plant
  const { data: telemetry } = await telemetryClient
    .from('telemetry_15m')
    .select('ts, total_energy_mwh, power_kw')
    .eq('plant_id', plantId)
    .order('ts', { ascending: true })
  
  if (!telemetry || telemetry.length === 0) return
  
  // Compute daily energy (today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTelemetry = telemetry.filter(t => new Date(t.ts) >= today)
  
  const dailyEnergyKwh = todayTelemetry.length > 0
    ? (Math.max(...todayTelemetry.map(t => t.total_energy_mwh)) - 
       Math.min(...todayTelemetry.map(t => t.total_energy_mwh))) * 1000
    : 0
  
  // Compute monthly energy (from 1st of month)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthTelemetry = telemetry.filter(t => new Date(t.ts) >= monthStart)
  
  const monthlyEnergyMwh = monthTelemetry.length > 0
    ? (Math.max(...monthTelemetry.map(t => t.total_energy_mwh)) - 
       Math.min(...monthTelemetry.map(t => t.total_energy_mwh)))
    : 0
  
  // Compute yearly energy (from 1st Jan)
  const yearStart = new Date()
  yearStart.setMonth(0, 1)
  yearStart.setHours(0, 0, 0, 0)
  const yearTelemetry = telemetry.filter(t => new Date(t.ts) >= yearStart)
  
  const yearlyEnergyMwh = yearTelemetry.length > 0
    ? (Math.max(...yearTelemetry.map(t => t.total_energy_mwh)) - 
       Math.min(...yearTelemetry.map(t => t.total_energy_mwh)))
    : 0
  
  // Get total energy (max cumulative from telemetry)
  const totalEnergyMwh = Math.max(...telemetry.map(t => t.total_energy_mwh))
  
  // Get current power (latest record)
  const latestRecord = telemetry[telemetry.length - 1]
  const currentPowerKw = latestRecord.power_kw
  
  // Upsert to plant_aggregates (Telemetry DB only)
  await telemetryClient
    .from('plant_aggregates')
    .upsert({
      plant_id: plantId,
      vendor_plant_id: vendorPlantId,
      daily_energy_kwh: dailyEnergyKwh,
      monthly_energy_mwh: monthlyEnergyMwh,
      yearly_energy_mwh: yearlyEnergyMwh,
      total_energy_mwh: totalEnergyMwh,
      current_power_kw: currentPowerKw,
      last_update_time: latestRecord.ts,
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
      .select('daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, current_power_kw, last_update_time')
      .in('plant_id', plantIds)
    
    if (!plantAggregates || plantAggregates.length === 0) continue
    
    // Sum all aggregates
    const workOrderAggregates = {
      work_order_id: workOrderId,
      daily_energy_kwh: plantAggregates.reduce((sum, p) => sum + (p.daily_energy_kwh || 0), 0),
      monthly_energy_mwh: plantAggregates.reduce((sum, p) => sum + (p.monthly_energy_mwh || 0), 0),
      yearly_energy_mwh: plantAggregates.reduce((sum, p) => sum + (p.yearly_energy_mwh || 0), 0),
      total_energy_mwh: plantAggregates.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0),
      current_power_kw: plantAggregates.reduce((sum, p) => sum + (p.current_power_kw || 0), 0),
      last_update_time: new Date(Math.max(...plantAggregates.map(p => new Date(p.last_update_time).getTime()))),
      updated_at: new Date()
    }
    
    // Upsert to work_order_aggregates (Telemetry DB only)
    await telemetryClient
      .from('work_order_aggregates')
      .upsert(workOrderAggregates, {
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
  ├─→ Query all telemetry for plant 123:
  │   SELECT ts, total_energy_mwh, power_kw
  │   FROM telemetry_15m
  │   WHERE plant_id = 123
  │   ORDER BY ts ASC
  │
  ├─→ Result: ~66,240 records (690 days × 96 intervals/day)
  │
  ├─→ Compute Daily Energy (Today: 2025-11-22):
  │   • Filter: ts >= 2025-11-22T00:00:00Z
  │   • Records: 48 (12 hours × 4 intervals/hour)
  │   • Min: 50.000 MWh
  │   • Max: 50.125 MWh
  │   • Daily: (50.125 - 50.000) × 1000 = 125.0 kWh
  │
  ├─→ Compute Monthly Energy (November 2025):
  │   • Filter: ts >= 2025-11-01T00:00:00Z
  │   • Records: 1,440 (30 days × 48 intervals/day)
  │   • Min: 49.500 MWh
  │   • Max: 50.125 MWh
  │   • Monthly: 50.125 - 49.500 = 0.625 MWh
  │
  ├─→ Compute Yearly Energy (2025):
  │   • Filter: ts >= 2025-01-01T00:00:00Z
  │   • Records: ~33,600 (350 days × 96 intervals/day)
  │   • Min: 45.000 MWh
  │   • Max: 50.125 MWh
  │   • Yearly: 50.125 - 45.000 = 5.125 MWh
  │
  ├─→ Get Total Energy (from telemetry max value):
  │   • total_energy_mwh: 50.125 (max of total_energy_mwh from telemetry)
  │
  └─→ Get Current Power (Latest Record):
      • ts: 2025-11-22T12:00:00Z
      • power_kw: 2.5 kW

Step 5: Upsert Plant Aggregates (Telemetry DB)
  │
  └─→ INSERT INTO plant_aggregates (plant_id, vendor_plant_id, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, current_power_kw, last_update_time, updated_at)
      VALUES (123, '64786338', 125.0, 0.625, 5.125, 50.125, 2.5, '2025-11-22T12:00:00Z', NOW())
      ON CONFLICT (plant_id) DO UPDATE
      SET daily_energy_kwh = EXCLUDED.daily_energy_kwh,
          monthly_energy_mwh = EXCLUDED.monthly_energy_mwh,
          yearly_energy_mwh = EXCLUDED.yearly_energy_mwh,
          total_energy_mwh = EXCLUDED.total_energy_mwh,
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
     • Daily energy: 125.0 kWh
     • Monthly energy: 0.625 MWh
     • Yearly energy: 5.125 MWh
     • Total energy: 50.125 MWh
     • Current power: 2.5 kW
  ✅ Work order aggregates updated in work_order_aggregates
     (for all work orders containing this plant)
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

| plant_id | vendor_plant_id | daily_energy_kwh | monthly_energy_mwh | yearly_energy_mwh | total_energy_mwh | current_power_kw | last_update_time | updated_at |
|----------|-----------------|------------------|-------------------|-------------------|------------------|------------------|------------------|------------|
| 123 | 64786338 | 125.0 | 0.625 | 5.125 | 50.125 | 2.5 | 2025-11-22T12:00:00Z | 2025-11-22T12:00:00Z |

#### Telemetry DB (`work_order_aggregates`)

| work_order_id | daily_energy_kwh | monthly_energy_mwh | yearly_energy_mwh | total_energy_mwh | current_power_kw | last_update_time | updated_at |
|---------------|------------------|-------------------|-------------------|------------------|------------------|------------------|------------|
| 456 | 375.0 | 1.875 | 15.425 | 150.625 | 7.5 | 2025-11-22T12:00:00Z | 2025-11-22T12:00:00Z |

**Note**: Work order 456 contains plants [123, 124, 125]. The aggregates are the sum of all plants in the work order.

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

Trigger daily sync for all plants (requires CRON_SECRET or SUPERADMIN).

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
- [ ] Set up daily sync cron (00:15 local time)
- [ ] Implement 31-day rolling window retention
- [ ] Add aggregate computation logic
- [ ] Create failure recovery and logging
- [ ] Add telemetry visualization components:
  - [ ] 15-min energy graph
  - [ ] Power vs time graph
  - [ ] Daily energy bar chart

---

**Last Updated**: 2025-11-22
**Version**: 1.0.0

