-- ============================================
-- GRID DOWNTIME ANALYTICS INDEX OPTIMIZATION
-- ============================================
-- Phase 1: Add optimized indexes for batch queries
-- This migration adds a composite index on alerts table to optimize
-- grid downtime analytics batch queries (reduces 3514 queries to 1)
--
-- Index: idx_alerts_description_time_plant
-- Purpose: Optimize batch fetching of GRID_DOWN alerts for all plants
--          within a time window for grid downtime analytics computation
-- ============================================

-- Composite index for batch alert queries
-- This index optimizes the query:
--   SELECT plant_id, alert_time, end_time 
--   FROM alerts 
--   WHERE description = 'GRID_DOWN' 
--     AND alert_time <= windowEnd 
--     AND (end_time IS NULL OR end_time >= windowStart)
--
-- Column order rationale:
--   1. description (first for WHERE filter, partial index condition)
--   2. alert_time DESC (for time range filtering and sorting)
--   3. end_time (for NULL/gte filtering)
--   4. plant_id (for grouping results by plant)
--
-- Partial index (WHERE description = 'GRID_DOWN') reduces index size
-- and improves performance by only indexing relevant rows.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_description_time_plant 
ON alerts(description, alert_time DESC, end_time, plant_id)
WHERE description = 'GRID_DOWN';

COMMENT ON INDEX idx_alerts_description_time_plant IS 
'Optimized index for batch fetching GRID_DOWN alerts for grid downtime analytics. 
Supports efficient batch queries that fetch alerts for all plants at once, 
reducing query count from 3514 (per-plant) to 1 (batch).';

-- Note: The baseline query for plant_grid_downtime_readings is already
-- optimized with idx_pgdr_plant_date (plant_id, reading_date DESC) which
-- was created in migration 045_add_analytics_grid_downtime.sql

