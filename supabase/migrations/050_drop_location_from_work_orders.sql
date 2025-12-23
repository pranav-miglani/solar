-- ============================================
-- DROP LOCATION COLUMN FROM WORK ORDERS
-- ============================================
-- This migration removes the location column from work_orders table
-- Location field is no longer needed in the application
-- ============================================

-- Drop the location column from work_orders table
ALTER TABLE work_orders
DROP COLUMN IF EXISTS location;

-- Add comment explaining the removal
COMMENT ON TABLE work_orders IS 'Work orders table. Location column removed as it was not being used.';

