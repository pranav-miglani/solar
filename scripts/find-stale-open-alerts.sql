-- Find plants with open alerts that have more recent resolved/ended alerts
-- This identifies stale open alerts that should probably be closed

WITH open_alerts AS (
  -- All currently open alerts
  SELECT 
    a.id as alert_id,
    a.plant_id,
    a.alert_time as open_alert_time,
    a.title as open_alert_title,
    a.status as open_alert_status,
    p.name as plant_name,
    p.vendor_plant_id,
    v.name as vendor_name
  FROM alerts a
  INNER JOIN plants p ON a.plant_id = p.id
  LEFT JOIN vendors v ON a.vendor_id = v.id
  WHERE a.status = 'ACTIVE'
    AND a.alert_time IS NOT NULL
),
resolved_or_ended_alerts AS (
  -- All alerts that are resolved or have end_time set
  SELECT 
    a.id as alert_id,
    a.plant_id,
    a.alert_time as resolved_alert_time,
    a.end_time,
    a.status as resolved_alert_status,
    a.title as resolved_alert_title
  FROM alerts a
  WHERE (a.status = 'RESOLVED' OR a.end_time IS NOT NULL)
    AND a.alert_time IS NOT NULL
)
SELECT DISTINCT
  oa.plant_id,
  oa.plant_name,
  oa.vendor_plant_id,
  oa.vendor_name,
  oa.alert_id as open_alert_id,
  oa.open_alert_time,
  oa.open_alert_title,
  COUNT(DISTINCT rea.alert_id) as newer_resolved_count,
  MIN(rea.resolved_alert_time) as earliest_newer_resolved_time,
  MAX(rea.resolved_alert_time) as latest_newer_resolved_time,
  -- Show sample of newer resolved alerts (ordered by most recent first)
  STRING_AGG(
    rea.resolved_alert_title || ' (' || rea.resolved_alert_status || 
    CASE WHEN rea.end_time IS NOT NULL THEN ', ended: ' || rea.end_time::text ELSE '' END || ')',
    '; '
    ORDER BY rea.resolved_alert_time DESC
  ) FILTER (WHERE rea.alert_id IS NOT NULL) as newer_resolved_alerts_sample
FROM open_alerts oa
LEFT JOIN resolved_or_ended_alerts rea 
  ON oa.plant_id = rea.plant_id
  AND rea.resolved_alert_time > oa.open_alert_time
GROUP BY 
  oa.plant_id,
  oa.plant_name,
  oa.vendor_plant_id,
  oa.vendor_name,
  oa.alert_id,
  oa.open_alert_time,
  oa.open_alert_title
HAVING COUNT(DISTINCT rea.alert_id) > 0
ORDER BY 
  newer_resolved_count DESC,
  oa.open_alert_time ASC;

-- Summary query: Count of plants with stale open alerts
SELECT 
  COUNT(DISTINCT plant_id) as plants_with_stale_open_alerts,
  COUNT(*) as total_stale_open_alerts
FROM (
  WITH open_alerts AS (
    SELECT 
      a.id as alert_id,
      a.plant_id,
      a.alert_time as open_alert_time
    FROM alerts a
    WHERE a.status = 'ACTIVE'
      AND a.alert_time IS NOT NULL
  ),
  resolved_or_ended_alerts AS (
    SELECT 
      a.id as alert_id,
      a.plant_id,
      a.alert_time as resolved_alert_time
    FROM alerts a
    WHERE (a.status = 'RESOLVED' OR a.end_time IS NOT NULL)
      AND a.alert_time IS NOT NULL
  )
  SELECT DISTINCT oa.plant_id, oa.alert_id
  FROM open_alerts oa
  INNER JOIN resolved_or_ended_alerts rea 
    ON oa.plant_id = rea.plant_id
    AND rea.resolved_alert_time > oa.open_alert_time
) stale_alerts;

