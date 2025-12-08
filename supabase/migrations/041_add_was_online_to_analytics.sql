-- Migration: Add was_online column to analytics plant_energy_readings table
-- This column tracks if a plant was online during that day (copied from main DB plants.was_online_today)

ALTER TABLE plant_energy_readings 
ADD COLUMN IF NOT EXISTS was_online BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_plant_energy_readings_was_online ON plant_energy_readings(was_online, reading_date DESC);

COMMENT ON COLUMN plant_energy_readings.was_online IS 'True if plant was online (network_status = "NORMAL") at any point during this day. Copied from main DB plants.was_online_today column during analytics snapshot.';

