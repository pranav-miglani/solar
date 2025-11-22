-- ============================================
-- Change daily_energy from MWh to kWh
-- ============================================
-- This migration changes daily_energy_mwh to daily_energy_kwh
-- to avoid rounding errors when converting between units.
-- Existing MWh values are converted to kWh (multiply by 1000)

-- Rename column and convert existing values
ALTER TABLE plants 
  RENAME COLUMN daily_energy_mwh TO daily_energy_kwh;

-- Update the column to store kWh (no precision change needed, just semantic)
-- Convert existing MWh values to kWh (multiply by 1000)
UPDATE plants 
SET daily_energy_kwh = daily_energy_kwh * 1000 
WHERE daily_energy_kwh IS NOT NULL;

-- Update comment
COMMENT ON COLUMN plants.daily_energy_kwh IS 'Daily energy generation in kWh (shown in Production Overview). Previously stored as MWh but changed to kWh to avoid rounding errors.';

