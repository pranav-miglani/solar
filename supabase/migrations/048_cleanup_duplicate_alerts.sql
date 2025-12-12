-- ============================================
-- CLEANUP DUPLICATE ALERTS
-- ============================================
-- This script identifies and removes duplicate alerts before adding unique constraint
-- 
-- Strategy: Keep the most recent alert (highest id or latest created_at)
-- Delete all older duplicates
-- ============================================

-- Step 1: Identify duplicate groups
-- This query shows all groups of duplicates based on (vendor_id, vendor_plant_id, vendor_alert_id)
SELECT 
  vendor_id,
  vendor_plant_id,
  vendor_alert_id,
  COUNT(*) as duplicate_count,
  COUNT(DISTINCT plant_id) as unique_system_plant_ids,
  ARRAY_AGG(DISTINCT plant_id) as system_plant_ids,
  ARRAY_AGG(id ORDER BY created_at DESC, id DESC) as alert_ids,
  MIN(created_at) as oldest_created_at,
  MAX(created_at) as newest_created_at,
  MAX(id) as keep_alert_id -- Keep the one with highest ID (most recent)
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL
GROUP BY vendor_id, vendor_plant_id, vendor_alert_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, vendor_id, vendor_plant_id, vendor_alert_id;

-- Step 2: Show detailed duplicate information (for verification)
-- Shows duplicates based on (vendor_id, vendor_plant_id, vendor_alert_id)
SELECT 
  a.id,
  a.vendor_id,
  v.name as vendor_name,
  a.vendor_alert_id,
  a.vendor_plant_id,
  a.plant_id as system_plant_id,
  p.name as plant_name,
  a.title,
  a.description,
  a.created_at,
  a.updated_at,
  ROW_NUMBER() OVER (
    PARTITION BY a.vendor_id, a.vendor_plant_id, a.vendor_alert_id 
    ORDER BY a.created_at DESC, a.id DESC
  ) as duplicate_rank
FROM alerts a
LEFT JOIN vendors v ON a.vendor_id = v.id
LEFT JOIN plants p ON a.plant_id = p.id
WHERE EXISTS (
  SELECT 1 
  FROM alerts a2 
  WHERE a2.vendor_id = a.vendor_id 
    AND a2.vendor_plant_id = a.vendor_plant_id
    AND a2.vendor_alert_id = a.vendor_alert_id 
    AND a2.id != a.id
)
ORDER BY a.vendor_id, a.vendor_plant_id, a.vendor_alert_id, duplicate_rank;

-- Step 3: Delete duplicates (keep most recent)
-- WARNING: Review the results from Step 1 and Step 2 before running this!
-- This will delete all duplicates except the most recent one (highest id)
-- based on (vendor_id, vendor_plant_id, vendor_alert_id)
DELETE FROM alerts
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY vendor_id, vendor_plant_id, vendor_alert_id 
        ORDER BY created_at DESC, id DESC
      ) as rn
    FROM alerts
    WHERE vendor_id IS NOT NULL 
      AND vendor_plant_id IS NOT NULL
      AND vendor_alert_id IS NOT NULL
  ) ranked
  WHERE rn > 1 -- Keep only the first (most recent), delete the rest
);

-- Step 4: Verify no duplicates remain
-- Check for duplicates based on (vendor_id, vendor_plant_id, vendor_alert_id)
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
-- This should return 0 rows if cleanup was successful

-- Step 5: Show summary of deleted alerts
-- Run this after deletion to see how many were removed
-- (Compare with Step 1 results)

