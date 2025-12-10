-- ============================================
-- GRID DOWNTIME BASELINE FUNCTION
-- ============================================
-- IMPORTANT: This migration MUST be run on the ANALYTICS DB (not main DB)
-- 
-- The function queries plant_grid_downtime_readings table which exists
-- only in the analytics database (created in migration 045).
-- 
-- Creates an efficient database function to fetch latest baseline
-- for all plants in a single query using DISTINCT ON
-- This eliminates the need to fetch all historical rows
-- ============================================

-- Function to get latest baseline per plant efficiently
-- CORRECTNESS: Returns the latest total_grid_down_seconds for each plant
-- before the cutoff_date. This is used as the starting point for accumulation.
-- If a plant has no baseline (first-time computation), it won't be in results
-- and the application will start from 0 (baselineTotal = null).
CREATE OR REPLACE FUNCTION get_latest_grid_downtime_baselines(cutoff_date DATE)
RETURNS TABLE (
  plant_id INTEGER,
  total_grid_down_seconds INTEGER,
  reading_date DATE
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (plant_id)
    plant_id,
    total_grid_down_seconds,
    reading_date
  FROM plant_grid_downtime_readings
  WHERE reading_date < cutoff_date
    AND total_grid_down_seconds IS NOT NULL  -- CORRECTNESS: Only return non-NULL baselines
  ORDER BY plant_id, reading_date DESC;
$$;

COMMENT ON FUNCTION get_latest_grid_downtime_baselines(DATE) IS 
'Returns the latest baseline total_grid_down_seconds for each plant before the cutoff date.
Uses DISTINCT ON for efficient per-plant latest record retrieval.
This function is critical for grid downtime analytics performance.';

