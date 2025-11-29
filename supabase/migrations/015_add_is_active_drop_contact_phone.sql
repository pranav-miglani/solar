-- ============================================
-- ADD IS_ACTIVE COLUMN AND DROP CONTACT_PHONE
-- ============================================
-- This migration:
-- 1. Adds is_active column to plants table (default: true)
-- 2. Drops contact_phone column from plants table

-- Add is_active column to plants table
ALTER TABLE plants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add comment for is_active column
COMMENT ON COLUMN plants.is_active IS 'Indicates if the plant is active (true) or disabled (false). Plants are marked inactive if not refreshed for 15+ days.';

-- Drop contact_phone column
ALTER TABLE plants DROP COLUMN IF EXISTS contact_phone;

-- Create disabled_plants table to store inactive plant information
CREATE TABLE IF NOT EXISTS disabled_plants (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_plant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity_kw NUMERIC(10, 2) NOT NULL,
  location JSONB DEFAULT '{}',
  -- Production metrics (snapshot at time of disablement)
  current_power_kw NUMERIC(10, 3),
  daily_energy_kwh NUMERIC(10, 3),
  monthly_energy_mwh NUMERIC(10, 3),
  yearly_energy_mwh NUMERIC(10, 3),
  total_energy_mwh NUMERIC(10, 3),
  last_update_time TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  -- Additional metadata
  network_status TEXT,
  vendor_created_date TIMESTAMPTZ,
  start_operating_time TIMESTAMPTZ,
  -- Disablement tracking
  disabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_since_refresh INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for disabled_plants table
COMMENT ON TABLE disabled_plants IS 'Stores information about plants that have been inactive for 15+ days (not refreshed).';
COMMENT ON COLUMN disabled_plants.plant_id IS 'Reference to the original plant record';
COMMENT ON COLUMN disabled_plants.disabled_at IS 'Timestamp when the plant was marked as disabled';
COMMENT ON COLUMN disabled_plants.days_since_refresh IS 'Number of days since last_refreshed_at when plant was disabled';

-- Create index on disabled_plants for efficient queries
CREATE INDEX IF NOT EXISTS idx_disabled_plants_plant_id ON disabled_plants(plant_id);
CREATE INDEX IF NOT EXISTS idx_disabled_plants_org_id ON disabled_plants(org_id);
CREATE INDEX IF NOT EXISTS idx_disabled_plants_vendor_id ON disabled_plants(vendor_id);
CREATE INDEX IF NOT EXISTS idx_disabled_plants_disabled_at ON disabled_plants(disabled_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_disabled_plants_updated_at
  BEFORE UPDATE ON disabled_plants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

