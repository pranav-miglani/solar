-- ============================================
-- DETAILED DUPLICATE ANALYSIS WITH RCA
-- ============================================
-- Run this to get comprehensive analysis of duplicate alerts
-- ============================================

-- Step 1: Find all duplicate groups with vendor names
SELECT 
  a.vendor_id,
  v.name as vendor_name,
  a.vendor_plant_id,
  a.vendor_alert_id,
  COUNT(*) as duplicate_count,
  COUNT(DISTINCT a.plant_id) as unique_system_plant_ids,
  ARRAY_AGG(DISTINCT a.plant_id ORDER BY a.plant_id) as system_plant_ids,
  ARRAY_AGG(a.id ORDER BY a.created_at DESC, a.id DESC) as alert_ids,
  ARRAY_AGG(a.title ORDER BY a.created_at DESC) as titles,
  MIN(a.created_at) as oldest_created_at,
  MAX(a.created_at) as newest_created_at,
  EXTRACT(EPOCH FROM (MAX(a.created_at) - MIN(a.created_at))) / 3600 as hours_between_oldest_newest,
  -- RCA Analysis fields
  CASE 
    WHEN COUNT(DISTINCT a.plant_id) = 1 THEN 'Same system plant_id - likely vendor_plant_id mapping issue'
    WHEN COUNT(DISTINCT a.plant_id) > 1 THEN 'Different system plant_ids - likely plant remapping occurred'
    ELSE 'Unknown'
  END as rca_reason,
  CASE 
    WHEN MAX(a.created_at) > NOW() - INTERVAL '24 hours' THEN 'Recent duplicates - active issue'
    WHEN MAX(a.created_at) > NOW() - INTERVAL '7 days' THEN 'Recent duplicates - within last week'
    ELSE 'Old duplicates - historical issue'
  END as recency_status
FROM alerts a
LEFT JOIN vendors v ON a.vendor_id = v.id
WHERE a.vendor_id IS NOT NULL 
  AND a.vendor_plant_id IS NOT NULL
  AND a.vendor_alert_id IS NOT NULL
GROUP BY a.vendor_id, v.name, a.vendor_plant_id, a.vendor_alert_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, a.vendor_id, a.vendor_plant_id, a.vendor_alert_id;

-- Step 2: Detailed view of each duplicate group
SELECT 
  'Detailed Duplicate View' as analysis_type,
  a.id as alert_id,
  a.vendor_id,
  v.name as vendor_name,
  a.vendor_plant_id,
  a.vendor_alert_id,
  a.plant_id as system_plant_id,
  p.name as system_plant_name,
  a.title,
  a.description,
  a.created_at,
  a.updated_at,
  ROW_NUMBER() OVER (
    PARTITION BY a.vendor_id, a.vendor_plant_id, a.vendor_alert_id 
    ORDER BY a.created_at DESC, a.id DESC
  ) as duplicate_rank,
  CASE 
    WHEN ROW_NUMBER() OVER (
      PARTITION BY a.vendor_id, a.vendor_plant_id, a.vendor_alert_id 
      ORDER BY a.created_at DESC, a.id DESC
    ) = 1 THEN 'KEEP (most recent)'
    ELSE 'DELETE (duplicate)'
  END as action
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

-- Step 3: Summary statistics
SELECT 
  'Summary Statistics' as analysis_type,
  COUNT(*) as total_alerts,
  COUNT(DISTINCT (vendor_id, vendor_plant_id, vendor_alert_id)) as unique_alert_combinations,
  COUNT(*) - COUNT(DISTINCT (vendor_id, vendor_plant_id, vendor_alert_id)) as total_duplicate_alerts,
  COUNT(DISTINCT vendor_id) as unique_vendors_with_duplicates,
  COUNT(DISTINCT plant_id) as unique_system_plant_ids,
  COUNT(DISTINCT vendor_plant_id) as unique_vendor_plant_ids,
  MIN(created_at) as oldest_alert,
  MAX(created_at) as newest_alert
FROM alerts
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL
  AND vendor_alert_id IS NOT NULL;

-- Step 4: Duplicates by vendor (top offenders)
SELECT 
  'Top Vendors with Duplicates' as analysis_type,
  a.vendor_id,
  v.name as vendor_name,
  COUNT(DISTINCT (a.vendor_plant_id, a.vendor_alert_id)) as duplicate_groups,
  SUM(duplicate_counts.count - 1) as total_duplicate_alerts_to_delete,
  MIN(a.created_at) as first_duplicate_seen,
  MAX(a.created_at) as last_duplicate_seen
FROM alerts a
LEFT JOIN vendors v ON a.vendor_id = v.id
INNER JOIN (
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
  HAVING COUNT(*) > 1
) duplicate_counts ON 
  a.vendor_id = duplicate_counts.vendor_id
  AND a.vendor_plant_id = duplicate_counts.vendor_plant_id
  AND a.vendor_alert_id = duplicate_counts.vendor_alert_id
GROUP BY a.vendor_id, v.name
ORDER BY total_duplicate_alerts_to_delete DESC;

-- Step 5: Check if vendor_plant_id matches plant_id mapping
-- This helps identify if duplicates are due to plant remapping
SELECT 
  'Plant ID Mapping Analysis' as analysis_type,
  a.vendor_id,
  v.name as vendor_name,
  a.vendor_plant_id,
  COUNT(DISTINCT a.plant_id) as system_plant_ids_for_vendor_plant,
  ARRAY_AGG(DISTINCT a.plant_id) as system_plant_ids,
  ARRAY_AGG(DISTINCT p.name) as system_plant_names,
  CASE 
    WHEN COUNT(DISTINCT a.plant_id) > 1 THEN '⚠️ Vendor plant mapped to multiple system plants - likely remapping issue'
    ELSE '✓ Vendor plant mapped to single system plant'
  END as mapping_status
FROM alerts a
LEFT JOIN vendors v ON a.vendor_id = v.id
LEFT JOIN plants p ON a.plant_id = p.id
WHERE a.vendor_id IS NOT NULL 
  AND a.vendor_plant_id IS NOT NULL
GROUP BY a.vendor_id, v.name, a.vendor_plant_id
HAVING COUNT(DISTINCT a.plant_id) > 1
ORDER BY system_plant_ids_for_vendor_plant DESC;

