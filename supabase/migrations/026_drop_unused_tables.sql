-- ============================================
-- DROP UNUSED TABLES
-- ============================================
-- This migration removes tables that are not being used in the system:
-- 1. work_order_plant_eff - Performance ratio calculations not implemented
--    (Table exists but is never populated, only read by deprecated efficiency endpoint)

-- Drop work_order_plant_eff table and related objects
DROP TABLE IF EXISTS work_order_plant_eff CASCADE;

-- Drop related indexes if they exist
DROP INDEX IF EXISTS idx_work_order_plant_eff_work_order_id;
DROP INDEX IF EXISTS idx_work_order_plant_eff_plant_id;

-- Note: The /api/workorders/[id]/efficiency endpoint should be removed or deprecated
-- as it reads from this table which is no longer available.

