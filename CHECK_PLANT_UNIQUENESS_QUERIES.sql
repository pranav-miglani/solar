-- ============================================
-- SQL Queries to Check Plant Uniqueness Constraints
-- ============================================

-- Query 1: Find plants that violate (vendor_plant_id, vendor_id, org_id) uniqueness
-- This finds cases where the same vendor_plant_id + vendor_id combination exists
-- with different org_id values (which would violate the proposed constraint)
SELECT 
  vendor_id,
  vendor_plant_id,
  COUNT(DISTINCT org_id) as org_count,
  STRING_AGG(DISTINCT org_id::TEXT, ', ' ORDER BY org_id::TEXT) as org_ids,
  STRING_AGG(DISTINCT id::TEXT, ', ' ORDER BY id::TEXT) as plant_ids,
  STRING_AGG(DISTINCT name, ' | ') as plant_names
FROM plants
GROUP BY vendor_id, vendor_plant_id
HAVING COUNT(DISTINCT org_id) > 1
ORDER BY vendor_id, vendor_plant_id;

-- Query 2: Detailed view of violating plants with all details
-- Shows all plant records that share the same (vendor_id, vendor_plant_id) but have different org_id
SELECT 
  p1.id,
  p1.name,
  p1.vendor_id,
  v.name as vendor_name,
  p1.vendor_plant_id,
  p1.org_id,
  o.name as org_name,
  p1.created_at,
  p1.updated_at,
  p1.is_active
FROM plants p1
JOIN vendors v ON p1.vendor_id = v.id
JOIN organizations o ON p1.org_id = o.id
WHERE EXISTS (
  SELECT 1
  FROM plants p2
  WHERE p2.vendor_id = p1.vendor_id
    AND p2.vendor_plant_id = p1.vendor_plant_id
    AND p2.org_id != p1.org_id
)
ORDER BY p1.vendor_id, p1.vendor_plant_id, p1.org_id;

-- Query 3: Check for duplicate (vendor_plant_id, vendor_id, org_id) combinations
-- This finds exact duplicates where all three values are the same
SELECT 
  vendor_id,
  vendor_plant_id,
  org_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::TEXT, ', ' ORDER BY id::TEXT) as plant_ids,
  STRING_AGG(name, ' | ') as plant_names
FROM plants
GROUP BY vendor_id, vendor_plant_id, org_id
HAVING COUNT(*) > 1
ORDER BY vendor_id, vendor_plant_id, org_id;

-- Query 4: Summary statistics
-- Shows how many plants would be affected by the constraint
SELECT 
  'Total Plants' as metric,
  COUNT(*) as count
FROM plants
UNION ALL
SELECT 
  'Unique (vendor_id, vendor_plant_id) combinations' as metric,
  COUNT(DISTINCT (vendor_id, vendor_plant_id)) as count
FROM plants
UNION ALL
SELECT 
  'Unique (vendor_id, vendor_plant_id, org_id) combinations' as metric,
  COUNT(DISTINCT (vendor_id, vendor_plant_id, org_id)) as count
FROM plants
UNION ALL
SELECT 
  'Violations: Same (vendor_id, vendor_plant_id) with different org_id' as metric,
  COUNT(DISTINCT (vendor_id, vendor_plant_id)) as count
FROM (
  SELECT vendor_id, vendor_plant_id
  FROM plants
  GROUP BY vendor_id, vendor_plant_id
  HAVING COUNT(DISTINCT org_id) > 1
) violations
UNION ALL
SELECT 
  'Exact duplicates: Same (vendor_id, vendor_plant_id, org_id)' as metric,
  COUNT(*) as count
FROM (
  SELECT vendor_id, vendor_plant_id, org_id
  FROM plants
  GROUP BY vendor_id, vendor_plant_id, org_id
  HAVING COUNT(*) > 1
) duplicates;

-- Query 5: Check if current constraint (vendor_id, vendor_plant_id) is being violated
-- This should return 0 rows if the current constraint is working
SELECT 
  vendor_id,
  vendor_plant_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::TEXT, ', ' ORDER BY id::TEXT) as plant_ids,
  STRING_AGG(org_id::TEXT, ', ' ORDER BY org_id::TEXT) as org_ids,
  STRING_AGG(name, ' | ') as plant_names
FROM plants
GROUP BY vendor_id, vendor_plant_id
HAVING COUNT(*) > 1
ORDER BY vendor_id, vendor_plant_id;

-- Query 6: Plants grouped by vendor showing org distribution
-- Useful for understanding vendor-org relationships
SELECT 
  v.id as vendor_id,
  v.name as vendor_name,
  v.org_id as vendor_org_id,
  COUNT(DISTINCT p.org_id) as distinct_org_count,
  STRING_AGG(DISTINCT p.org_id::TEXT, ', ' ORDER BY p.org_id::TEXT) as plant_org_ids,
  COUNT(*) as total_plants
FROM plants p
JOIN vendors v ON p.vendor_id = v.id
GROUP BY v.id, v.name, v.org_id
HAVING COUNT(DISTINCT p.org_id) > 1
ORDER BY v.id;

