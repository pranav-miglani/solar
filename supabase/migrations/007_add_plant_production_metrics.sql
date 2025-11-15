-- ============================================
-- MIGRATION 007: OBSOLETE - Merged into 001_initial_schema.sql
-- ============================================
-- This migration is no longer needed as production metrics are now included
-- in the initial schema creation (001_initial_schema.sql).
-- 
-- If you're running a fresh install, use 001_initial_schema.sql only.
-- If you're upgrading an existing database, you can run this migration
-- but it's recommended to use the consolidated schema instead.

-- Add production metrics fields to plants table
-- These metrics match the Production Overview dashboard display:
-- PR (Performance Ratio), Current Power, Installed Capacity (already exists as capacity_kw),
-- Daily/Monthly/Yearly/Total Energy, Last Update Time

ALTER TABLE plants 
ADD COLUMN IF NOT EXISTS current_power_kw NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS daily_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS monthly_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS yearly_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS total_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS performance_ratio NUMERIC(5, 4), -- PR (0-1 range, displayed as percentage)
ADD COLUMN IF NOT EXISTS last_update_time TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_plants_last_update_time ON plants(last_update_time);
CREATE INDEX IF NOT EXISTS idx_plants_vendor_id_org_id ON plants(vendor_id, org_id);

-- Add comments
COMMENT ON COLUMN plants.current_power_kw IS 'Current generation power in kW (shown in Production Overview)';
COMMENT ON COLUMN plants.daily_energy_mwh IS 'Daily energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.monthly_energy_mwh IS 'Monthly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.yearly_energy_mwh IS 'Yearly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.total_energy_mwh IS 'Total cumulative energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.performance_ratio IS 'Performance Ratio (PR) 0-1 range, displayed as percentage in circular indicator';
COMMENT ON COLUMN plants.last_update_time IS 'Last time production data was updated from vendor (shown as "Updated" timestamp)';
