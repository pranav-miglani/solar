-- Migration: Drop plant_sync_mode column from vendors table
-- This column is not being used - plant sync always calls listPlants() regardless of mode
-- Telemetry sync uses telemetry_sync_mode (different field) instead

ALTER TABLE vendors 
DROP COLUMN IF EXISTS plant_sync_mode;

-- Remove comment if it exists
COMMENT ON COLUMN vendors.plant_sync_mode IS NULL;

