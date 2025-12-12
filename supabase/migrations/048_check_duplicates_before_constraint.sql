-- ============================================
-- CHECK FOR DUPLICATES BEFORE ADDING CONSTRAINT
-- ============================================
-- Run this BEFORE running 048_add_alerts_unique_constraint.sql
-- This helps identify if there are any duplicates that would prevent the constraint
-- ============================================

-- Check for duplicates based on (vendor_id, vendor_plant_id, vendor_alert_id)
-- This is the correct uniqueness constraint
SELECT 
  'Duplicates by (vendor_id, vendor_plant_id, vendor_alert_id)' as check_type,
  vendor_id,
  vendor_plant_id,
  vendor_alert_id,
  COUNT(*) as duplicate_count,
  COUNT(DISTINCT plant_id) as unique_system_plant_ids,
  ARRAY_AGG(DISTINCT plant_id) as system_plant_ids,
  ARRAY_AGG(id ORDER BY created_at DESC) as alert_ids,
  MIN(created_at) as oldest_created_at,
  MAX(created_at) as newest_created_at
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL
GROUP BY vendor_id, vendor_plant_id, vendor_alert_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 50;

-- Summary statistics
SELECT 
  'Summary' as check_type,
  COUNT(*) as total_alerts,
  COUNT(DISTINCT (vendor_id, vendor_plant_id, vendor_alert_id)) as unique_vendor_plant_alert_combinations,
  COUNT(*) - COUNT(DISTINCT (vendor_id, vendor_plant_id, vendor_alert_id)) as duplicate_count_estimate,
  COUNT(DISTINCT plant_id) as unique_system_plant_ids,
  COUNT(DISTINCT vendor_plant_id) as unique_vendor_plant_ids
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL;

