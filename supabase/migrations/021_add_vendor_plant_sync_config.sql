-- ============================================
-- ADD VENDOR PLANT SYNC CONFIGURATION
-- ============================================
-- This migration adds per-vendor configuration fields to control how
-- the 15-minute plant sync behaves, and when heavier listPlants()
-- syncs should run for vendors that rely on per-plant telemetry.
--
-- Fields:
-- - plant_sync_mode:
--     'LIST_PLANTS'  -> sync metrics directly from listPlants() (e.g. Solarman, ShineMonitor)
--     'PER_PLANT'    -> metrics come from per-plant telemetry; listPlants() is run
--                       only at configured times (e.g. SolarDM, PVBLINK)
-- - per_plant_sync_interval_minutes:
--     Interval used by the 15-minute cron (or vendor-specific override) for
--     vendors that use per-plant sync in future crons.
-- - plant_list_sync_morning_ist / plant_list_sync_evening_ist:
--     Local IST times when listPlants() should be run for PER_PLANT vendors.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS plant_sync_mode TEXT NOT NULL DEFAULT 'LIST_PLANTS';

COMMENT ON COLUMN vendors.plant_sync_mode IS
  'Controls how plant sync runs for this vendor: LIST_PLANTS (metrics from listPlants) or PER_PLANT (metrics from per-plant telemetry).';

-- Optional per-vendor override for per-plant sync interval. Note: the actual
-- 15-minute cadence is still driven by organization-level sync_interval_minutes;
-- this column is reserved for future per-plant crons.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS per_plant_sync_interval_minutes INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN vendors.per_plant_sync_interval_minutes IS
  'Interval in minutes for per-plant sync crons (used when plant_sync_mode = PER_PLANT). Default 15.';

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS plant_list_sync_morning_ist TIME WITHOUT TIME ZONE NOT NULL DEFAULT TIME '06:00';

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS plant_list_sync_evening_ist TIME WITHOUT TIME ZONE NOT NULL DEFAULT TIME '23:00';

COMMENT ON COLUMN vendors.plant_list_sync_morning_ist IS
  'Local IST time for the morning listPlants() sync when plant_sync_mode = PER_PLANT (default 06:00).';

COMMENT ON COLUMN vendors.plant_list_sync_evening_ist IS
  'Local IST time for the evening listPlants() sync when plant_sync_mode = PER_PLANT (default 23:00).';
