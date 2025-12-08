# Grid Downtime Counter System - Analysis & Design

## Executive Summary

This document analyzes the requirements and design for implementing a cumulative grid downtime counter system, similar to how total energy is tracked. The system will maintain:
- **Daily** grid downtime counters (100-day rolling retention)
- **Monthly** grid downtime counters (100-day rolling retention)
- **Total** grid downtime counter (monotonically increasing, never resets, kept for 1 year)

---

## Current State Analysis

### 1. Current Grid Downtime Tracking

**Location**: `alerts` table
- `grid_down_seconds` (INTEGER) - Duration of each alert in seconds
- `grid_down_benefit_kwh` (NUMERIC(12,3)) - Calculated benefit energy

**Calculation**:
- `grid_down_seconds` = `max(0, end_time - alert_time)` 
- `grid_down_benefit_kwh` = `0.5 × hours(9AM-4PM overlap) × capacity_kw`

**Characteristics**:
- ✅ Per-alert granularity (individual alert records)
- ✅ Calculated during alert sync
- ❌ No cumulative aggregation
- ❌ No time-series tracking
- ❌ No daily/monthly/total counters

### 2. Reference Pattern: Energy Counters

**Main DB (`plants` table)**:
- `daily_energy_kwh` - Current day's energy
- `monthly_energy_mwh` - Month-to-date energy
- `yearly_energy_mwh` - Year-to-date energy
- `total_energy_mwh` - Cumulative total (monotonically increasing)

**Analytics DB (`plant_energy_readings` table)**:
- Daily snapshots with 100-day retention
- Columns: `daily_energy_kwh`, `monthly_energy_kwh`, `yearly_energy_mwh`, `total_energy_mwh`
- Unique constraint: `(plant_id, reading_date)`
- Cleanup function: Deletes records older than 100 days

**Sync Mechanism**:
- Updated during telemetry sync (every 15 minutes)
- Snapshot captured daily at 10 PM IST via `analyticsSnapshotService.ts`
- Values come directly from vendor API (not aggregated from alerts)

---

## Requirements Analysis

### Functional Requirements

1. **Cumulative Counter**: Similar to `total_energy_mwh`, a monotonically increasing counter
2. **Daily Counter**: Grid downtime accumulated per day (100-day retention)
3. **Monthly Counter**: Grid downtime accumulated per month (100-day retention)
4. **Total Counter**: Cumulative grid downtime (never resets, kept for 1 year)
5. **Aggregation Source**: Aggregate from `alerts` table (not vendor API)

### Non-Functional Requirements

1. **Performance**: Efficient aggregation queries
2. **Data Integrity**: Accurate cumulative calculations
3. **Retention**: 100-day rolling window for daily/monthly, 1 year for total
4. **Consistency**: Counters should match sum of alerts

---

## Design Options

### Option 1: Dual Storage (Main DB + Analytics DB) - **RECOMMENDED**

**Main DB (`plants` table)** - Add columns:
```sql
-- Current day/month/year counters (updated during alert sync)
daily_grid_down_seconds INTEGER DEFAULT 0,
monthly_grid_down_seconds INTEGER DEFAULT 0,
yearly_grid_down_seconds INTEGER DEFAULT 0,
total_grid_down_seconds INTEGER DEFAULT 0,  -- Monotonically increasing

-- Benefit energy counters (optional, if needed)
daily_grid_down_benefit_kwh NUMERIC(12,3) DEFAULT 0,
monthly_grid_down_benefit_kwh NUMERIC(12,3) DEFAULT 0,
yearly_grid_down_benefit_kwh NUMERIC(12,3) DEFAULT 0,
total_grid_down_benefit_kwh NUMERIC(14,3) DEFAULT 0,  -- Monotonically increasing
```

**Analytics DB** - New table `plant_grid_downtime_readings`:
```sql
CREATE TABLE plant_grid_downtime_readings (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  plant_id INTEGER NOT NULL,
  vendor_plant_id TEXT NOT NULL,
  reading_date DATE NOT NULL,
  
  -- Daily counters (for this specific day)
  daily_grid_down_seconds INTEGER DEFAULT 0,
  daily_grid_down_benefit_kwh NUMERIC(12,3) DEFAULT 0,
  
  -- Monthly counters (month-to-date as of this day)
  monthly_grid_down_seconds INTEGER DEFAULT 0,
  monthly_grid_down_benefit_kwh NUMERIC(12,3) DEFAULT 0,
  
  -- Yearly counters (year-to-date as of this day)
  yearly_grid_down_seconds INTEGER DEFAULT 0,
  yearly_grid_down_benefit_kwh NUMERIC(12,3) DEFAULT 0,
  
  -- Total counters (cumulative, never resets)
  total_grid_down_seconds INTEGER DEFAULT 0,
  total_grid_down_benefit_kwh NUMERIC(14,3) DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(plant_id, reading_date)
);

-- Indexes
CREATE INDEX idx_grid_downtime_plant_date ON plant_grid_downtime_readings(plant_id, reading_date DESC);
CREATE INDEX idx_grid_downtime_date ON plant_grid_downtime_readings(reading_date DESC);
CREATE INDEX idx_grid_downtime_vendor_date ON plant_grid_downtime_readings(vendor_id, reading_date DESC);

-- Cleanup function (100-day retention for daily/monthly, 1 year for total)
CREATE OR REPLACE FUNCTION cleanup_old_grid_downtime_readings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete records older than 100 days
  -- Note: Total counters are preserved in main DB, so we can safely delete old snapshots
  DELETE FROM plant_grid_downtime_readings
  WHERE reading_date < CURRENT_DATE - INTERVAL '100 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

**Pros**:
- ✅ Consistent with energy counter pattern
- ✅ Main DB has current values (fast queries)
- ✅ Analytics DB has historical snapshots (100-day retention)
- ✅ Total counter preserved in main DB (never lost)
- ✅ Can query current values without joining analytics DB

**Cons**:
- ⚠️ Requires maintaining counters in two places
- ⚠️ More complex sync logic

---

### Option 2: Analytics DB Only

Store all counters only in `plant_grid_downtime_readings` table.

**Pros**:
- ✅ Single source of truth
- ✅ Simpler schema

**Cons**:
- ❌ Current values require querying analytics DB
- ❌ Slower for real-time queries
- ❌ Inconsistent with energy counter pattern

---

### Option 3: Main DB Only (No Analytics)

Store counters only in `plants` table, no historical snapshots.

**Pros**:
- ✅ Simple implementation
- ✅ Fast queries

**Cons**:
- ❌ No historical tracking (can't see trends)
- ❌ No 100-day retention for daily/monthly
- ❌ Inconsistent with energy counter pattern

---

## Recommended Approach: Option 1 (Dual Storage)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Alert Sync Process                        │
│  (Every hour via alertSyncCron.js)                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│        1. Sync Alerts from Vendor API                       │
│        2. Calculate grid_down_seconds per alert             │
│        3. Calculate grid_down_benefit_kwh per alert         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│    Update Main DB Counters (plants table)                   │
│                                                              │
│    For each alert:                                          │
│    - daily_grid_down_seconds += alert.grid_down_seconds     │
│    - monthly_grid_down_seconds += alert.grid_down_seconds   │
│    - yearly_grid_down_seconds += alert.grid_down_seconds   │
│    - total_grid_down_seconds += alert.grid_down_seconds    │
│                                                              │
│    Same for benefit_kwh counters                            │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│    Daily Snapshot (10 PM IST via analyticsSnapshotService) │
│                                                              │
│    For each plant:                                           │
│    1. Read current counters from plants table                │
│    2. Upsert into plant_grid_downtime_readings              │
│    3. Reset daily counters (keep monthly/yearly/total)       │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│    Monthly Reset (1st of month, 12:05 AM IST)                │
│                                                              │
│    Reset monthly_grid_down_seconds = 0                      │
│    (Keep yearly and total counters)                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│    Yearly Reset (Jan 1st, 12:05 AM IST)                      │
│                                                              │
│    Reset yearly_grid_down_seconds = 0                       │
│    (Keep total counter - never resets)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Database Schema Changes

#### Main DB Migration

**File**: `supabase/migrations/043_add_grid_downtime_counters.sql`

```sql
-- Add grid downtime counters to plants table
ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS daily_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_grid_down_benefit_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_grid_down_benefit_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_grid_down_benefit_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_grid_down_benefit_kwh NUMERIC(14,3) NOT NULL DEFAULT 0;

-- Comments
COMMENT ON COLUMN plants.daily_grid_down_seconds IS 'Grid downtime in seconds for current day. Reset daily at midnight IST.';
COMMENT ON COLUMN plants.monthly_grid_down_seconds IS 'Grid downtime in seconds for current month (month-to-date). Reset monthly on 1st.';
COMMENT ON COLUMN plants.yearly_grid_down_seconds IS 'Grid downtime in seconds for current year (year-to-date). Reset yearly on Jan 1st.';
COMMENT ON COLUMN plants.total_grid_down_seconds IS 'Cumulative grid downtime in seconds (monotonically increasing, never resets).';
COMMENT ON COLUMN plants.daily_grid_down_benefit_kwh IS 'Grid downtime benefit energy (kWh) for current day. Reset daily at midnight IST.';
COMMENT ON COLUMN plants.monthly_grid_down_benefit_kwh IS 'Grid downtime benefit energy (kWh) for current month (month-to-date). Reset monthly on 1st.';
COMMENT ON COLUMN plants.yearly_grid_down_benefit_kwh IS 'Grid downtime benefit energy (kWh) for current year (year-to-date). Reset yearly on Jan 1st.';
COMMENT ON COLUMN plants.total_grid_down_benefit_kwh IS 'Cumulative grid downtime benefit energy (kWh) (monotonically increasing, never resets).';
```

#### Analytics DB Migration

**File**: `supabase/migrations/044_add_grid_downtime_analytics.sql`

```sql
-- Create plant_grid_downtime_readings table in analytics DB
CREATE TABLE IF NOT EXISTS plant_grid_downtime_readings (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  plant_id INTEGER NOT NULL,
  vendor_plant_id TEXT NOT NULL,
  reading_date DATE NOT NULL,
  
  -- Daily counters (for this specific day)
  daily_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  daily_grid_down_benefit_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  
  -- Monthly counters (month-to-date as of this day)
  monthly_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  monthly_grid_down_benefit_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  
  -- Yearly counters (year-to-date as of this day)
  yearly_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  yearly_grid_down_benefit_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  
  -- Total counters (cumulative, never resets)
  total_grid_down_seconds INTEGER NOT NULL DEFAULT 0,
  total_grid_down_benefit_kwh NUMERIC(14,3) NOT NULL DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(plant_id, reading_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grid_downtime_plant_date ON plant_grid_downtime_readings(plant_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_grid_downtime_date ON plant_grid_downtime_readings(reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_grid_downtime_vendor_date ON plant_grid_downtime_readings(vendor_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_grid_downtime_org_date ON plant_grid_downtime_readings(org_id, reading_date DESC);

-- Foreign keys (same pattern as plant_energy_readings)
ALTER TABLE plant_grid_downtime_readings
  ADD CONSTRAINT fk_grid_downtime_org_id
  FOREIGN KEY (org_id) REFERENCES organizations(id)
  ON DELETE CASCADE;

ALTER TABLE plant_grid_downtime_readings
  ADD CONSTRAINT fk_grid_downtime_vendor_id
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  ON DELETE CASCADE;

ALTER TABLE plant_grid_downtime_readings
  ADD CONSTRAINT fk_grid_downtime_plant_id
  FOREIGN KEY (plant_id) REFERENCES plants(id)
  ON DELETE CASCADE;

-- Cleanup function (100-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_grid_downtime_readings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM plant_grid_downtime_readings
  WHERE reading_date < CURRENT_DATE - INTERVAL '100 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_grid_downtime_readings() IS 'Deletes plant_grid_downtime_readings older than 100 days to maintain rolling retention.';

-- Updated_at trigger
CREATE TRIGGER trg_grid_downtime_updated_at BEFORE UPDATE ON plant_grid_downtime_readings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 2. Counter Update Logic

#### During Alert Sync (`alertSyncService.ts`)

**Current Flow**:
1. Fetch alerts from vendor API
2. Calculate `grid_down_seconds` and `grid_down_benefit_kwh` per alert
3. Upsert alert into `alerts` table

**New Flow** (add after step 3):
4. Update plant counters:
   ```typescript
   // After inserting/updating alert
   const { error: updateError } = await supabase
     .from("plants")
     .update({
       daily_grid_down_seconds: sql`daily_grid_down_seconds + ${gridDownSeconds}`,
       monthly_grid_down_seconds: sql`monthly_grid_down_seconds + ${gridDownSeconds}`,
       yearly_grid_down_seconds: sql`yearly_grid_down_seconds + ${gridDownSeconds}`,
       total_grid_down_seconds: sql`total_grid_down_seconds + ${gridDownSeconds}`,
       daily_grid_down_benefit_kwh: sql`daily_grid_down_benefit_kwh + ${gridDownBenefitKwh}`,
       monthly_grid_down_benefit_kwh: sql`monthly_grid_down_benefit_kwh + ${gridDownBenefitKwh}`,
       yearly_grid_down_benefit_kwh: sql`yearly_grid_down_benefit_kwh + ${gridDownBenefitKwh}`,
       total_grid_down_benefit_kwh: sql`total_grid_down_benefit_kwh + ${gridDownBenefitKwh}`,
     })
     .eq("id", plantId)
   ```

**Important Considerations**:
- ⚠️ **Race Conditions**: Multiple alerts for same plant could cause race conditions
- ✅ **Solution**: Use PostgreSQL atomic increment (`column + value`)
- ⚠️ **Duplicate Alerts**: If alert is updated (not new), we might double-count
- ✅ **Solution**: Track which alerts have been counted (add `counted_in_downtime` flag to alerts table, or check if alert already exists before incrementing)

---

### 3. Daily Snapshot Logic

**New Service**: `lib/services/gridDowntimeSnapshotService.ts`

Similar to `analyticsSnapshotService.ts`, but for grid downtime:

```typescript
export async function runGridDowntimeSnapshot(): Promise<SnapshotSummary> {
  // 1. Fetch all plants from main DB
  // 2. For each plant, read current counters
  // 3. Upsert into plant_grid_downtime_readings (analytics DB)
  // 4. Reset daily counters in main DB (keep monthly/yearly/total)
  // 5. Call cleanup function (delete records older than 100 days)
}
```

**Reset Logic**:
- **Daily Reset**: After snapshot, reset `daily_grid_down_seconds = 0` and `daily_grid_down_benefit_kwh = 0`
- **Monthly Reset**: On 1st of month, reset `monthly_grid_down_seconds = 0` and `monthly_grid_down_benefit_kwh = 0`
- **Yearly Reset**: On Jan 1st, reset `yearly_grid_down_seconds = 0` and `yearly_grid_down_benefit_kwh = 0`
- **Total Reset**: Never reset (monotonically increasing)

---

### 4. Cron Jobs

#### Daily Snapshot Cron

**File**: `lib/cron/gridDowntimeSnapshotCron.js`

```javascript
// Runs daily at 10 PM IST (same time as energy snapshot)
const cronSchedule = '30 16 * * *' // 10 PM IST
```

**API Endpoint**: `/api/cron/analytics/snapshot-grid-downtime`

#### Daily Reset Cron

**File**: `lib/cron/resetDailyGridDowntimeCron.js`

```javascript
// Runs daily at 12:05 AM IST (after snapshot)
const cronSchedule = '5 18 * * *' // 12:05 AM IST
```

**Logic**: Reset `daily_grid_down_seconds = 0` and `daily_grid_down_benefit_kwh = 0` for all plants

#### Monthly Reset Cron

**File**: `lib/cron/resetMonthlyGridDowntimeCron.js`

```javascript
// Runs on 1st of every month at 12:05 AM IST
const cronSchedule = '5 18 1 * *' // 1st of month, 12:05 AM IST
```

**Logic**: Reset `monthly_grid_down_seconds = 0` and `monthly_grid_down_benefit_kwh = 0` for all plants

#### Yearly Reset Cron

**File**: `lib/cron/resetYearlyGridDowntimeCron.js`

```javascript
// Runs on Jan 1st at 12:05 AM IST
const cronSchedule = '5 18 1 1 *' // Jan 1st, 12:05 AM IST
```

**Logic**: Reset `yearly_grid_down_seconds = 0` and `yearly_grid_down_benefit_kwh = 0` for all plants

---

### 5. Duplicate Alert Handling

**Problem**: If an alert is updated (status changes from ACTIVE to RESOLVED), we might increment counters twice.

**Solution Options**:

**Option A**: Track counted alerts
```sql
-- Add column to alerts table
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS counted_in_downtime BOOLEAN DEFAULT FALSE;
```

**Logic**:
- When inserting new alert: Set `counted_in_downtime = TRUE`, increment counters
- When updating alert: Only increment if `counted_in_downtime = FALSE`
- When alert is resolved: If `end_time` changes, recalculate and update counters

**Option B**: Check if alert already exists
- Before incrementing, check if alert with same `(vendor_id, vendor_alert_id, plant_id)` already exists
- If exists: Don't increment (already counted)
- If new: Increment counters

**Option C**: Recalculate from alerts table
- Instead of incrementing, recalculate counters by summing all alerts
- More accurate but slower (requires full table scan)

**Recommendation**: **Option A** (track counted flag) - Most efficient and accurate

---

### 6. Backfill Strategy

**Problem**: Existing alerts don't have counters initialized.

**Solution**: Create backfill script `scripts/backfill-grid-downtime-counters.ts`

```typescript
// 1. Query all alerts grouped by plant_id
// 2. For each plant:
//    - Sum grid_down_seconds from all alerts
//    - Sum grid_down_benefit_kwh from all alerts
//    - Update plant counters
// 3. For historical data:
//    - Group alerts by date
//    - Create daily snapshots in analytics DB
```

---

## Data Flow Summary

### Alert Sync Flow (Every Hour)

```
1. Fetch alerts from vendor API
2. For each alert:
   a. Calculate grid_down_seconds and grid_down_benefit_kwh
   b. Upsert alert into alerts table
   c. If alert is new (counted_in_downtime = FALSE):
      - Increment plant counters (daily, monthly, yearly, total)
      - Set counted_in_downtime = TRUE
   d. If alert is updated (end_time changed):
      - Recalculate counters (subtract old, add new)
```

### Daily Snapshot Flow (10 PM IST)

```
1. For each plant:
   a. Read current counters from plants table
   b. Upsert into plant_grid_downtime_readings (analytics DB)
   c. Reset daily counters to 0 (keep monthly/yearly/total)
2. Call cleanup function (delete records older than 100 days)
```

### Monthly Reset Flow (1st of Month, 12:05 AM IST)

```
1. Reset monthly_grid_down_seconds = 0 for all plants
2. Reset monthly_grid_down_benefit_kwh = 0 for all plants
```

### Yearly Reset Flow (Jan 1st, 12:05 AM IST)

```
1. Reset yearly_grid_down_seconds = 0 for all plants
2. Reset yearly_grid_down_benefit_kwh = 0 for all plants
```

---

## Query Patterns

### Current Values (Main DB)

```sql
-- Get current grid downtime for a plant
SELECT 
  daily_grid_down_seconds,
  monthly_grid_down_seconds,
  yearly_grid_down_seconds,
  total_grid_down_seconds,
  daily_grid_down_benefit_kwh,
  monthly_grid_down_benefit_kwh,
  yearly_grid_down_benefit_kwh,
  total_grid_down_benefit_kwh
FROM plants
WHERE id = :plant_id;
```

### Historical Trends (Analytics DB)

```sql
-- Get last 100 days of grid downtime for a plant
SELECT 
  reading_date,
  daily_grid_down_seconds,
  monthly_grid_down_seconds,
  yearly_grid_down_seconds,
  total_grid_down_seconds
FROM plant_grid_downtime_readings
WHERE plant_id = :plant_id
ORDER BY reading_date DESC
LIMIT 100;
```

### Aggregation Queries

```sql
-- Total grid downtime across all plants (current)
SELECT 
  SUM(total_grid_down_seconds) as total_seconds,
  SUM(total_grid_down_benefit_kwh) as total_benefit_kwh
FROM plants;

-- Daily grid downtime trend (last 30 days)
SELECT 
  reading_date,
  SUM(daily_grid_down_seconds) as total_daily_seconds,
  SUM(daily_grid_down_benefit_kwh) as total_daily_benefit_kwh
FROM plant_grid_downtime_readings
WHERE reading_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY reading_date
ORDER BY reading_date DESC;
```

---

## Implementation Checklist

### Phase 1: Database Schema
- [ ] Create migration `043_add_grid_downtime_counters.sql` (main DB)
- [ ] Create migration `044_add_grid_downtime_analytics.sql` (analytics DB)
- [ ] Run migrations on staging
- [ ] Verify schema changes

### Phase 2: Counter Update Logic
- [ ] Update `alertSyncService.ts` to increment counters
- [ ] Add `counted_in_downtime` flag to alerts table
- [ ] Handle duplicate alerts (check flag before incrementing)
- [ ] Handle alert updates (recalculate if end_time changes)
- [ ] Test counter increments during alert sync

### Phase 3: Snapshot Service
- [ ] Create `gridDowntimeSnapshotService.ts`
- [ ] Implement daily snapshot logic
- [ ] Implement daily reset logic
- [ ] Create API endpoint `/api/cron/analytics/snapshot-grid-downtime`
- [ ] Create cron job `gridDowntimeSnapshotCron.js`
- [ ] Test snapshot and reset

### Phase 4: Reset Crons
- [ ] Create `resetDailyGridDowntimeCron.js`
- [ ] Create `resetMonthlyGridDowntimeCron.js`
- [ ] Create `resetYearlyGridDowntimeCron.js`
- [ ] Register crons in `server.js`
- [ ] Test reset logic

### Phase 5: Backfill
- [ ] Create `scripts/backfill-grid-downtime-counters.ts`
- [ ] Backfill main DB counters from existing alerts
- [ ] Backfill analytics DB snapshots (if historical data exists)
- [ ] Verify backfill accuracy

### Phase 6: UI Integration
- [ ] Add grid downtime counters to plant detail view
- [ ] Add grid downtime charts (daily/monthly/yearly/total trends)
- [ ] Add grid downtime to production overview (if needed)
- [ ] Add grid downtime to analytics dashboard

### Phase 7: Testing & Validation
- [ ] Unit tests for counter increment logic
- [ ] Integration tests for snapshot service
- [ ] End-to-end tests for full flow
- [ ] Validate counter accuracy against alerts table
- [ ] Performance testing (large number of alerts)

---

## Open Questions

1. **Units**: Should we store seconds or hours? (Recommendation: seconds for precision, convert to hours in UI)
2. **Benefit Energy**: Do we need benefit_kwh counters, or just seconds? (Recommendation: Keep both for consistency with current alerts)
3. **Alert Updates**: How to handle when alert's `end_time` changes? (Recommendation: Recalculate and update counters)
4. **Historical Data**: How far back should we backfill? (Recommendation: 1 year, or all available alerts)
5. **UI Display**: Where should grid downtime be displayed? (Recommendation: Plant detail page, analytics dashboard)
6. **Aggregation**: Should we aggregate at org/vendor level? (Recommendation: Yes, similar to energy aggregation)

---

## Cost & Performance Considerations

### Database Storage

**Main DB (`plants` table)**:
- 8 new columns × 4 bytes (INTEGER) + 8 bytes (NUMERIC) ≈ 48 bytes per plant
- For 10,000 plants: ~480 KB (negligible)

**Analytics DB (`plant_grid_downtime_readings` table)**:
- ~200 bytes per record (with indexes)
- 10,000 plants × 100 days = 1,000,000 records
- Total: ~200 MB (well within free tier)

### Query Performance

- **Counter Updates**: O(1) per alert (single UPDATE query)
- **Snapshot**: O(n) where n = number of plants (batch processing)
- **Historical Queries**: O(log n) with proper indexes

### Impact on Alert Sync

- **Additional Queries**: 1 UPDATE per alert (instead of 0)
- **Performance Impact**: Minimal (atomic increment is fast)
- **Latency**: +1-2ms per alert (acceptable)

---

## Conclusion

The recommended approach (Option 1: Dual Storage) provides:
- ✅ Consistent with existing energy counter pattern
- ✅ Fast current value queries (main DB)
- ✅ Historical trend analysis (analytics DB)
- ✅ 100-day retention for daily/monthly
- ✅ 1-year retention for total counter
- ✅ Monotonically increasing total counter
- ✅ Efficient aggregation from alerts

This design maintains consistency with the existing architecture while providing the required functionality for grid downtime tracking.

