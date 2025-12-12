# Alert Duplicate Fix - Complete Checklist

## Overview
This document outlines all steps required to fix duplicate alerts and prevent future duplicates.

## Problem
- Multiple alerts with same `(vendor_id, vendor_plant_id, vendor_alert_id)` exist in the database
- This causes `PGRST116` errors when using `.maybeSingle()` or `.single()`
- Application-level duplicate checks are not sufficient (race conditions, errors)

## Solution
1. Clean up existing duplicates
2. Add unique constraint at database level
3. Update code to handle constraint violations gracefully

---

## Step-by-Step Execution Plan

### ✅ Step 1: Analyze Duplicates (Optional - For Verification)
**File**: `supabase/migrations/048_check_duplicates_before_constraint.sql`

**Purpose**: Identify duplicate groups before cleanup

**Action**: Run in Supabase SQL Editor to see:
- How many duplicate groups exist
- Which vendors/plants are affected
- Total count of duplicate alerts

**Expected Output**: List of duplicate groups with counts

---

### ✅ Step 2: Clean Up Duplicates
**File**: `supabase/migrations/048_cleanup_duplicate_alerts.sql`

**Purpose**: Remove duplicate alerts, keeping only the most recent one

**Execution Order**:
1. **Step 1** (Lines 12-29): Identify duplicate groups - **RUN FIRST** to see what will be deleted
2. **Step 2** (Lines 32-60): Show detailed duplicate information - **RUN SECOND** for verification
3. **Step 3** (Lines 63-82): **DELETE duplicates** - **RUN THIRD** (this is the actual cleanup)
4. **Step 4** (Lines 85-97): Verify no duplicates remain - **RUN FOURTH** to confirm (should return 0 rows)
5. **Step 5** (Lines 99-101): **MISSING** - Add summary query (see below)

**⚠️ IMPORTANT**: 
- Review Step 1 and Step 2 results BEFORE running Step 3 (DELETE)
- Step 3 will delete all duplicates except the most recent one per group
- Backup your database before running Step 3

**Missing Query for Step 5**:
```sql
-- Step 5: Show summary of deleted alerts
-- Compare total alerts before and after cleanup
SELECT 
  'Before Cleanup' as stage,
  COUNT(*) as total_alerts,
  COUNT(DISTINCT (vendor_id, vendor_plant_id, vendor_alert_id)) as unique_alert_combinations
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL
UNION ALL
SELECT 
  'After Cleanup' as stage,
  COUNT(*) as total_alerts,
  COUNT(DISTINCT (vendor_id, vendor_plant_id, vendor_alert_id)) as unique_alert_combinations
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL;
```

---

### ✅ Step 3: Add Unique Constraint
**File**: `supabase/migrations/048_add_alerts_unique_constraint.sql`

**Purpose**: Prevent future duplicates at database level

**Action**: Run in Supabase SQL Editor

**What it does**:
- Creates unique index on `(vendor_id, vendor_plant_id, vendor_alert_id)`
- Uses normal blocking index (not CONCURRENTLY)
- Includes WHERE clause to handle NULL values

**⚠️ IMPORTANT**: 
- **MUST run Step 2 (cleanup) FIRST**, otherwise constraint creation will fail
- The index creation will lock the `alerts` table briefly during creation
- Verify constraint was created using the DO block at the end

**Expected Output**: 
```
✅ Unique constraint uq_alerts_vendor_plant_alert created successfully
```

---

### ⚠️ Step 4: Update Edge Function (CRITICAL - MISSING)
**File**: `supabase/functions/sync-alerts/index.ts`

**Current Issue**: 
- Lines 126-131: Checks for duplicates using only `vendor_alert_id` and `plant_id`
- **MISSING**: `vendor_id` and `vendor_plant_id` checks
- This will cause constraint violations after Step 3

**Required Changes**:
```typescript
// BEFORE (Lines 126-131):
const { data: existing } = await supabase
  .from("alerts")
  .select("id")
  .eq("vendor_alert_id", alert.alertId)
  .eq("plant_id", plant.id)
  .single()

// AFTER (should be):
const { data: existing } = await supabase
  .from("alerts")
  .select("id")
  .eq("vendor_id", vendor.id)  // ADD THIS
  .eq("vendor_plant_id", plant.vendor_plant_id)  // ADD THIS (not plant.id)
  .eq("vendor_alert_id", alert.alertId)
  .maybeSingle()  // Use maybeSingle() instead of single() to handle no results gracefully
```

**Also Update Insert** (Line 147):
```typescript
// BEFORE:
await supabase.from("alerts").insert({
  plant_id: plant.id,
  vendor_alert_id: alert.alertId,
  // ... other fields
})

// AFTER (add missing fields):
await supabase.from("alerts").insert({
  plant_id: plant.id,
  vendor_id: vendor.id,  // ADD THIS
  vendor_plant_id: plant.vendor_plant_id,  // ADD THIS
  vendor_alert_id: alert.alertId,
  // ... other fields
})
```

**Action**: **UPDATE THIS FILE** before deploying

---

### ✅ Step 5: Verify Code Already Updated
**File**: `lib/services/alertSyncService.ts`

**Status**: ✅ **ALREADY CORRECT**

**Verification**:
- Lines 513-519: Uses `vendor_id`, `vendor_plant_id`, and `vendor_alert_id` for duplicate check
- Lines 601-602: Includes `vendor_plant_id` in insert payload
- Lines 923-929: Uses correct fields for SolarDM vendor
- Uses `.order().limit(1)` instead of `.maybeSingle()` to handle duplicates gracefully

**No changes needed** ✅

---

### ⚠️ Step 6: Add Error Handling for Constraint Violations (RECOMMENDED)
**Files**: 
- `lib/services/alertSyncService.ts`
- `supabase/functions/sync-alerts/index.ts`

**Purpose**: Handle unique constraint violations gracefully

**Current Behavior**: If duplicate insert is attempted, database will throw error

**Recommended**: Catch constraint violation errors and log them (instead of failing)

**Example**:
```typescript
try {
  const { error: insertError } = await supabase.from("alerts").insert(payload)
  if (insertError) {
    // Check if it's a unique constraint violation
    if (insertError.code === '23505' || insertError.message?.includes('uq_alerts_vendor_plant_alert')) {
      logger.warn(`⚠️ Duplicate alert detected (constraint violation), skipping: ${vendorAlertId}`)
      // Optionally: fetch and update existing alert instead
    } else {
      logger.error(`❌ Failed to insert alert:`, insertError)
    }
  }
} catch (error) {
  // Handle other errors
}
```

**Action**: **OPTIONAL** - Can be added later if needed

---

## Execution Summary

### ✅ Completed
1. ✅ Cleanup SQL script created (`048_cleanup_duplicate_alerts.sql`)
2. ✅ Unique constraint migration created (`048_add_alerts_unique_constraint.sql`)
3. ✅ Code in `alertSyncService.ts` already uses correct uniqueness check
4. ✅ Duplicate detection logging added with RCA analysis

### ⚠️ Missing / Required Actions
1. ⚠️ **Update edge function** (`supabase/functions/sync-alerts/index.ts`) to use correct uniqueness check
2. ⚠️ **Add summary query** to Step 5 in cleanup SQL (optional but recommended)
3. ⚠️ **Add error handling** for constraint violations (optional but recommended)

### 📋 Execution Order (CRITICAL)
1. **First**: Run `048_check_duplicates_before_constraint.sql` (optional - for analysis)
2. **Second**: Run `048_cleanup_duplicate_alerts.sql` (Step 3 - DELETE statement)
3. **Third**: Run `048_add_alerts_unique_constraint.sql` (add constraint)
4. **Fourth**: Update and deploy `supabase/functions/sync-alerts/index.ts` (fix edge function)
5. **Fifth**: Test alert sync to ensure no constraint violations

---

## Verification Queries

### After Cleanup (Before Constraint):
```sql
-- Should return 0 rows
SELECT 
  vendor_id,
  vendor_plant_id,
  vendor_alert_id,
  COUNT(*) as count
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL
GROUP BY vendor_id, vendor_plant_id, vendor_alert_id
HAVING COUNT(*) > 1;
```

### After Constraint:
```sql
-- Should show the index exists
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname = 'uq_alerts_vendor_plant_alert';
```

### Test Constraint:
```sql
-- This should FAIL (prove constraint works)
INSERT INTO alerts (vendor_id, vendor_plant_id, vendor_alert_id, plant_id, title, description, severity, status)
VALUES (1, 'TEST_PLANT', 'TEST_ALERT', 1, 'Test', 'Test', 'LOW', 'ACTIVE');

-- Try inserting same again - should fail with unique constraint violation
INSERT INTO alerts (vendor_id, vendor_plant_id, vendor_alert_id, plant_id, title, description, severity, status)
VALUES (1, 'TEST_PLANT', 'TEST_ALERT', 1, 'Test', 'Test', 'LOW', 'ACTIVE');
```

---

## Notes
- The unique constraint uses `(vendor_id, vendor_plant_id, vendor_alert_id)` - **NOT** `plant_id`
- `plant_id` is the system's internal ID, `vendor_plant_id` is the vendor's identifier
- The constraint includes a WHERE clause to handle NULL values (only enforces uniqueness for non-NULL values)
- The index is a normal blocking index (not CONCURRENTLY) for simplicity

