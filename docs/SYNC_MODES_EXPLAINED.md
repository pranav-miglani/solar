# LIST_PLANTS vs PER_PLANT Sync Modes Explained

## Overview

The system supports two sync modes for both **Plant Sync** and **Telemetry Sync**:
- **LIST_PLANTS**: Efficient single API call for all plants
- **PER_PLANT**: Individual API calls per plant (more costly but necessary for some vendors)

---

## Plant Sync Modes

### LIST_PLANTS Mode (Default for SOLARMAN, SHINEMONITOR)

**How it works:**
- Makes **ONE API call** to `adapter.listPlants()` to fetch ALL plants at once
- Gets plant metadata, topology, and metrics in a single response
- Updates all plants in the database in batches

**Code Location:** `lib/services/plantSyncService.ts` (lines 163-165)

```typescript
// LIST_PLANTS mode: Single API call
let vendorPlants = await adapter.listPlants()
```

**When used:**
- Default for: SOLARMAN, SHINEMONITOR, FOXESSCLOUD, OTHER
- When `plant_sync_mode = 'LIST_PLANTS'` in database

**Advantages:**
- ✅ **Efficient**: Only 1 API call regardless of plant count
- ✅ **Fast**: Single network request
- ✅ **Low API usage**: Minimal vendor API quota consumption
- ✅ **Works well for vendors** that provide all data in listPlants()

**Disadvantages:**
- ❌ Requires vendor API to support bulk plant listing
- ❌ All plants must be returned in one response

---

### PER_PLANT Mode (Default for SOLARDM, PVBLINK)

**How it works:**
- **SKIPS** the regular 15-minute plant sync cron
- Plant topology/metadata is refreshed via:
  - **Morning sync**: `listPlants()` at configured time (default 06:00 IST)
  - **Evening sync**: `listPlants()` at configured time (default 23:00 IST)
- Metrics come from per-plant telemetry APIs during telemetry sync

**Code Location:** `lib/services/plantSyncService.ts` (lines 142-149)

```typescript
if (plantSyncMode === "PER_PLANT") {
  logger.info(
    `[Sync] Skipping listPlants() sync for vendor ${vendor.name} because plant_sync_mode=PER_PLANT. ` +
    `Topology and metrics will be refreshed by the per-plant cron and twice-daily listPlants() job.`
  )
  result.success = true
  return result
}
```

**When used:**
- Default for: SOLARDM, PVBLINK
- When `plant_sync_mode = 'PER_PLANT'` in database

**Advantages:**
- ✅ **Works for vendors** that don't provide complete data in listPlants()
- ✅ **Flexible**: Can fetch detailed metrics per plant
- ✅ **Reduced API calls**: Only calls listPlants() twice daily

**Disadvantages:**
- ❌ Plant topology updates only twice daily (morning/evening)
- ❌ Metrics depend on telemetry sync (which may use PER_PLANT mode)

---

## Telemetry Sync Modes

### LIST_PLANTS Mode (Default, Efficient)

**How it works:**
- Makes **ONE API call** to `adapter.listPlants()` to get telemetry for ALL plants
- Extracts live telemetry fields (current_power_kw, daily_energy_kwh, etc.) from response
- Updates all plants in database in batches

**Code Location:** `lib/services/liveTelemetrySyncService.ts` (lines 197-284)

```typescript
if (telemetrySyncMode === 'LIST_PLANTS') {
  // Efficient mode: Fetch all plants telemetry in single API call
  const allPlantsData = await adapter.listPlants()
  
  // Create a map of vendor_plant_id -> plant data for quick lookup
  const plantDataMap = new Map<string, any>()
  for (const plantData of allPlantsData) {
    plantDataMap.set(plantData.id, plantData)
  }
  
  // Match fetched plants with database plants and prepare updates
  for (const plant of plants) {
    const plantData = plantDataMap.get(plant.vendor_plant_id)
    // Extract telemetry fields and update...
  }
}
```

**When used:**
- Default for all vendors
- When `telemetry_sync_mode = 'LIST_PLANTS'` in database

**Advantages:**
- ✅ **Very efficient**: 1 API call for all plants
- ✅ **Fast**: Single network request
- ✅ **Low API usage**: Minimal vendor API quota consumption
- ✅ **Works well** when vendor provides live telemetry in listPlants()

**Disadvantages:**
- ❌ Requires vendor API to include telemetry in listPlants() response
- ❌ Not suitable if vendor requires per-plant API calls for telemetry

---

### PER_PLANT Mode (Costly but Necessary)

**How it works:**
- Fetches telemetry **individually** for each plant using `adapter.listPlant(vendorPlantId)`
- Processes plants in batches (50 at a time) with parallel API calls
- Updates all plants in database in batches

**Code Location:** `lib/services/liveTelemetrySyncService.ts` (lines 286-406)

```typescript
else {
  // PER_PLANT mode: Fetch each plant individually (costly but necessary)
  logger.info(
    `[LiveTelemetry] Using PER_PLANT mode: fetching telemetry for each plant individually`
  )
  
  // Fetch telemetry for plants in batches (parallel API calls)
  for (let i = 0; i < plants.length; i += FETCH_BATCH_SIZE) {
    const batch = plants.slice(i, i + FETCH_BATCH_SIZE)
    
    // Fetch telemetry for all plants in batch in parallel
    const batchPromises = batch.map(async (plant) => {
      const plantData = await adapter.listPlant(plant.vendor_plant_id)
      // Extract telemetry fields...
    })
    
    const batchResults = await Promise.all(batchPromises)
    // Collect results...
  }
}
```

**When used:**
- When `telemetry_sync_mode = 'PER_PLANT'` in database
- For vendors that don't provide telemetry in listPlants() response

**Advantages:**
- ✅ **Works for any vendor**: Even if they don't support bulk telemetry
- ✅ **Detailed data**: Can get more detailed telemetry per plant
- ✅ **Flexible**: Can handle vendors with different API structures

**Disadvantages:**
- ❌ **Costly**: N API calls (where N = number of plants)
- ❌ **Slower**: Multiple network requests
- ❌ **High API usage**: Can consume significant vendor API quota
- ❌ **Rate limiting risk**: May hit vendor API rate limits

**Example:**
- If you have 500 plants, PER_PLANT mode makes 500 API calls
- LIST_PLANTS mode makes only 1 API call

---

## Configuration

### Database Fields

**Plant Sync:**
- `plant_sync_mode`: `'LIST_PLANTS'` or `'PER_PLANT'`
- `per_plant_sync_interval_minutes`: Interval for per-plant sync (default: 15)
- `plant_list_sync_morning_ist`: Morning listPlants() time (default: '06:00')
- `plant_list_sync_evening_ist`: Evening listPlants() time (default: '23:00')

**Telemetry Sync:**
- `telemetry_sync_mode`: `'LIST_PLANTS'` or `'PER_PLANT'`
- `telemetry_sync_interval`: Sync interval in minutes (15, 30, or 45)

### Defaults by Vendor Type

**Plant Sync Mode Defaults:**
```typescript
SOLARMAN, SHINEMONITOR → LIST_PLANTS
SOLARDM, PVBLINK       → PER_PLANT
FOXESSCLOUD, OTHER     → LIST_PLANTS
```

**Telemetry Sync Mode:**
- All vendors default to `LIST_PLANTS` (most efficient)
- Change to `PER_PLANT` only if vendor doesn't provide telemetry in listPlants()

---

## Current System Status

Based on the vendor settings report:
- **All 9 vendors** use `LIST_PLANTS` for both plant sync and telemetry sync
- This is the most efficient configuration
- All vendors are working correctly with this setup

---

## When to Use Each Mode

### Use LIST_PLANTS when:
- ✅ Vendor API supports bulk plant listing
- ✅ Vendor provides telemetry in listPlants() response
- ✅ You want maximum efficiency and minimal API usage
- ✅ You have many plants (100+)

### Use PER_PLANT when:
- ✅ Vendor API doesn't support bulk listing
- ✅ Vendor requires individual API calls per plant
- ✅ Vendor doesn't provide telemetry in listPlants()
- ✅ You need more detailed per-plant data
- ⚠️ You have a small number of plants (< 50) to avoid excessive API calls

---

## Performance Comparison

### Example: 500 Plants

**LIST_PLANTS Mode:**
- API Calls: 1
- Network Requests: 1
- Time: ~2-5 seconds
- API Quota: Minimal

**PER_PLANT Mode:**
- API Calls: 500
- Network Requests: 500 (batched in parallel)
- Time: ~30-60 seconds (with batching)
- API Quota: High

---

## Summary

| Aspect | LIST_PLANTS | PER_PLANT |
|--------|-------------|-----------|
| **API Calls** | 1 (all plants) | N (one per plant) |
| **Efficiency** | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Speed** | Fast | Slower |
| **API Usage** | Low | High |
| **Use Case** | Vendors with bulk APIs | Vendors requiring per-plant calls |
| **Current Usage** | All 9 vendors | 0 vendors |

