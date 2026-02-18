# PR (Performance Ratio) Calculator - Status & History

## Current Status: **REMOVED** ❌

**PR (Performance Ratio) calculator has been completely removed from the codebase.**

---

## What Was Removed

### Migration: `013_drop_performance_ratio.sql`
- **Date**: November 29, 2025 (commit `44dd901`)
- **Action**: Dropped `performance_ratio` column from `plants` table
- **Reason**: PR calculations are not part of the current system

### Files Modified/Removed (from commit `44dd901`)

1. **Database Schema**
   - `supabase/migrations/013_drop_performance_ratio.sql` - Migration to drop column
   - `supabase/migrations/001_initial_schema.sql` - Removed PR column definition

2. **API Routes** (removed PR from responses)
   - `app/api/orgs/[id]/production/route.ts`
   - `app/api/plants/[id]/production/route.ts`
   - `app/api/vendors/[id]/production/route.ts`
   - `app/api/workorders/[id]/production/route.ts`

3. **Components** (removed PR display/calculation)
   - `components/ProductionOverview.tsx` - Removed PR display (51 lines removed)
   - `components/OrganizationProductionOverview.tsx`
   - `components/PlantDetailView.tsx` - Removed PR from plant details (19 lines)
   - `components/WorkOrderDetailView.tsx` - Removed PR from work order view (11 lines)
   - `components/OrganizationPlantsView.tsx`

4. **Services**
   - `lib/services/plantSyncService.ts` - Removed PR calculation/update logic
   - `lib/vendors/solarmanAdapter.ts` - Removed PR calculation from adapter (9 lines)

5. **Documentation**
   - `docs/SOLARMAN_DATA_MAPPING.md` - Removed PR references
   - `README.md`, `SCHEMA_SUMMARY.md`, `WOMS_COMPLETE_SYSTEM_PROMPT.md` - Cleaned up PR mentions

6. **Tables**
   - `work_order_plant_eff` table was also removed (mentioned in SystemFlowDocumentation) - this table stored PR-related efficiency metrics

---

## What PR Calculator Was

**Performance Ratio (PR)** is a metric that measures how efficiently a solar plant is performing compared to its theoretical maximum output.

### Typical PR Formula
```
PR = (Actual Energy Generated) / (Theoretical Maximum Energy) × 100%
```

Where:
- **Actual Energy Generated** = Energy produced by the plant (kWh/MWh)
- **Theoretical Maximum Energy** = Installed Capacity (kW) × Peak Sun Hours × Time Period

### Common PR Calculation Approach
1. **Daily PR**: `(Daily Energy kWh) / (Capacity kW × Peak Sun Hours × 1 day) × 100`
2. **Monthly PR**: `(Monthly Energy MWh) / (Capacity kW × Average Peak Sun Hours × Days in Month) × 100`
3. **Yearly PR**: `(Yearly Energy MWh) / (Capacity kW × Average Peak Sun Hours × 365) × 100`

**Peak Sun Hours** = Equivalent hours of full sun (typically 4-6 hours in India, varies by location/season)

---

## Why It Was Removed

Based on the migration and documentation:
- PR calculations are **not part of the current system requirements**
- The system focuses on:
  - **Energy metrics** (daily/monthly/yearly/total energy)
  - **Power metrics** (current power, installed capacity)
  - **Grid downtime analytics** (9-16 IST window benefit calculations)
  - **Alert sync** (grid down alerts, benefit kWh)
- PR was likely considered redundant or not needed for the current use case

---

## Current System Metrics (What We Have Instead)

### Plant-Level Metrics (in `plants` table)
- `capacity_kw` - Installed capacity
- `current_power_kw` - Current power output
- `daily_energy_kwh` - Daily energy generation
- `monthly_energy_mwh` - Monthly energy generation
- `yearly_energy_mwh` - Yearly energy generation
- `total_energy_mwh` - Cumulative total energy

### Analytics Metrics
- **Grid Downtime Analytics** (`plant_grid_downtime_readings` table)
  - `daily_grid_down_seconds` - Grid downtime per day (9-16 IST window)
  - `total_grid_down_seconds` - Cumulative grid downtime
  - `grid_down_benefit_kwh` - Calculated benefit energy (0.5 × hours × capacity)

### Display Components
- `ProductionOverview` - Shows energy metrics (daily/monthly/yearly/total)
- `PlantDetailView` - Plant details with energy metrics
- `OrganizationProductionOverview` - Org-level aggregated metrics

---

## If You Need to Re-implement PR Calculator

If PR calculation is needed in the future, you would need to:

1. **Add column back to schema**
   ```sql
   ALTER TABLE plants ADD COLUMN performance_ratio NUMERIC(5,2);
   ```

2. **Calculate PR in plant sync service**
   - Use `daily_energy_kwh` / `monthly_energy_mwh` / `yearly_energy_mwh`
   - Divide by `capacity_kw × peak_sun_hours × time_period`
   - Peak sun hours would need to be:
     - Stored per plant (location-based)
     - Or fetched from insolation data (WMS system)
     - Or use a default/average value

3. **Update adapters**
   - If vendor APIs provide PR directly, extract it
   - Otherwise calculate from energy/capacity data

4. **Update UI components**
   - Add PR display to `ProductionOverview`, `PlantDetailView`, etc.
   - Format as percentage (e.g., "85.5%")

5. **Consider using WMS Insolation Data**
   - The system has WMS (Weather Monitoring System) adapters (SCADA, INTELLO, TRACKSO)
   - These provide insolation data (kWh/m²) which could be used for more accurate PR calculations
   - Formula: `PR = (Actual Energy) / (Capacity × Insolation × Area) × 100`

---

## Related Systems

- **Grid Downtime Analytics**: `lib/services/gridDowntimeAnalyticsService.ts` - Calculates grid downtime benefit (similar calculation pattern)
- **WMS Insolation**: `lib/wms/` - Weather monitoring system that provides insolation data (could be used for PR if re-implemented)
- **Energy Metrics**: Stored in `plants` table, synced via `plantSyncService.ts`

---

## Summary

✅ **PR Calculator**: Completely removed  
✅ **Energy Metrics**: Still tracked (daily/monthly/yearly/total)  
✅ **Grid Downtime**: Tracked and calculated  
✅ **WMS Insolation**: Available (could be used for PR if needed)  
❌ **PR Column**: Not in database  
❌ **PR Calculation Logic**: Not in codebase  
❌ **PR Display**: Not in UI components  

**Status**: PR is not part of the current system. If needed, it can be re-implemented using existing energy metrics and WMS insolation data.
