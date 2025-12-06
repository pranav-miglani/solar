# Diagnostic Queries for Live Telemetry Sync org_id Error

## Current Status
✅ No plants with NULL org_id exist
✅ All vendors have org_id set (not NULL)
✅ No plants joined with vendors have NULL org_id

## Potential Root Causes to Investigate

### 1. Race Condition: Plant Deleted Between Fetch and Update
**Check if plants are being deleted during sync:**
```sql
-- Check for plants that were deleted recently (within last hour)
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.vendor_id,
  p.updated_at,
  v.name as vendor_name,
  v.org_id as vendor_org_id
FROM plants p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY p.updated_at DESC
LIMIT 50;
```

### 2. Plants with Invalid org_id (References Non-Existent Organization)
**Check if any plants reference organizations that don't exist:**
```sql
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.vendor_id,
  v.name as vendor_name
FROM plants p
JOIN vendors v ON p.vendor_id = v.id
LEFT JOIN organizations o ON p.org_id = o.id
WHERE o.id IS NULL;
```

### 3. Plants with Invalid vendor_id (References Non-Existent Vendor)
**Check if any plants reference vendors that don't exist:**
```sql
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.vendor_id
FROM plants p
LEFT JOIN vendors v ON p.vendor_id = v.id
WHERE v.id IS NULL;
```

### 4. Check for Plants That Might Be Updated Concurrently
**Check if multiple processes are updating the same plants:**
```sql
-- Check for plants updated very recently (potential concurrent updates)
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.updated_at,
  EXTRACT(EPOCH FROM (NOW() - p.updated_at)) as seconds_since_update
FROM plants p
WHERE p.updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY p.updated_at DESC;
```

### 5. Verify Plant IDs Exist for Specific Vendors
**Check if the plant IDs being updated actually exist:**
```sql
-- For SunAstra-Solarman (vendor_id = 9 based on your query)
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.vendor_id,
  p.is_active,
  p.updated_at
FROM plants p
WHERE p.vendor_id = 9
ORDER BY p.updated_at DESC
LIMIT 100;
```

### 6. Check for Plants with Missing Required Fields
**Verify all plants have all required NOT NULL fields:**
```sql
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.vendor_id,
  p.capacity_kw,
  CASE 
    WHEN p.org_id IS NULL THEN 'MISSING org_id'
    WHEN p.vendor_id IS NULL THEN 'MISSING vendor_id'
    WHEN p.capacity_kw IS NULL THEN 'MISSING capacity_kw'
    ELSE 'OK'
  END as status
FROM plants p
WHERE p.org_id IS NULL 
   OR p.vendor_id IS NULL 
   OR p.capacity_kw IS NULL;
```

### 7. Check Update History (if audit logging exists)
**Check recent updates to see if org_id was ever NULL:**
```sql
-- If you have an audit table or can check update logs
-- This would help identify if org_id was set to NULL during an update
SELECT * FROM plants 
WHERE id IN (
  -- Replace with actual plant IDs from error logs
  SELECT DISTINCT id FROM plants WHERE vendor_id = 9 LIMIT 10
)
ORDER BY updated_at DESC;
```

### 8. Verify Foreign Key Constraints Are Working
**Check if foreign key constraints are properly enforced:**
```sql
-- This should return 0 rows if constraints are working
SELECT 
  p.id,
  p.org_id,
  o.id as org_exists
FROM plants p
LEFT JOIN organizations o ON p.org_id = o.id
WHERE p.org_id IS NOT NULL AND o.id IS NULL;
```

### 9. Check for Plants That Were Just Created
**Check if new plants are being created without org_id:**
```sql
-- Check plants created in last hour
SELECT 
  p.id,
  p.name,
  p.vendor_plant_id,
  p.org_id,
  p.vendor_id,
  p.created_at,
  v.name as vendor_name
FROM plants p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```

### 10. Check Supabase RLS Policies
**Verify RLS policies aren't interfering:**
```sql
-- Check if RLS is enabled and what policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'plants';
```

### 11. Check for Trigger Issues
**Verify triggers aren't modifying org_id:**
```sql
-- Check all triggers on plants table
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'plants';
```

### 12. Test Update Query Directly
**Test if the update query works for a specific plant:**
```sql
-- Test update on a single plant (replace with actual plant ID from error)
-- This will help identify if the issue is with the query itself
BEGIN;
  UPDATE plants 
  SET 
    current_power_kw = 0.5,
    daily_energy_kwh = 10.0,
    last_refreshed_at = NOW()
  WHERE id = 123; -- Replace with actual plant ID
  
  -- Check if org_id is still set
  SELECT id, org_id, current_power_kw 
  FROM plants 
  WHERE id = 123;
ROLLBACK; -- Rollback to avoid changing data
```

## Additional Debugging Steps

### A. Add More Logging to Live Telemetry Sync
Add logging before each update to capture:
- Plant ID being updated
- Plant's current org_id before update
- Update data being sent
- Error details if update fails

### B. Check for Concurrent Plant Sync
If plant sync is running at the same time as live telemetry sync, there might be a race condition where:
- Plant sync updates a plant (possibly changing org_id)
- Live telemetry sync tries to update the same plant
- The update fails because of a constraint violation

### C. Verify Update Data Object
Ensure the update data object doesn't accidentally include `org_id: null` or `org_id: undefined`:
- Check if any code is spreading plant data that might include org_id
- Verify that `item.data` only contains telemetry fields

### D. Check for Supabase Client Issues
- Verify the Supabase client is using the correct database
- Check if there are multiple Supabase clients pointing to different databases
- Ensure the service role key is being used (not a user key with RLS restrictions)

## Most Likely Causes (Based on Analysis)

1. **Race Condition**: Plant sync and live telemetry sync running concurrently, causing org_id to be modified between fetch and update
2. **Invalid Plant ID**: The plant.id being used in the update doesn't exist or was deleted
3. **Data Object Contamination**: The update data object accidentally includes `org_id: null` or `org_id: undefined`
4. **Concurrent Updates**: Multiple live telemetry sync processes updating the same plant simultaneously
5. **Database Constraint Violation**: A foreign key constraint is being violated (org_id references non-existent organization)

