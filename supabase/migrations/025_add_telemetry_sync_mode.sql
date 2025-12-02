-- ============================================
-- ADD TELEMETRY SYNC MODE CONFIGURATION
-- ============================================
-- This migration adds telemetry_sync_mode and telemetry_sync_interval fields
-- to control how live telemetry is synced for each vendor.
--
-- Fields:
-- - telemetry_sync_mode:
--     'LIST_PLANTS'  -> Sync all plants telemetry in single API call (efficient)
--     'PER_PLANT'    -> Sync each plant telemetry individually (costly but necessary for some vendors)
-- - telemetry_sync_interval:
--     Interval in minutes (15, 30, or 45) for live telemetry sync

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS telemetry_sync_mode TEXT NOT NULL DEFAULT 'LIST_PLANTS';

COMMENT ON COLUMN vendors.telemetry_sync_mode IS
  'Controls how live telemetry is synced: LIST_PLANTS (all plants in single call) or PER_PLANT (individual plant calls).';

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS telemetry_sync_interval INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN vendors.telemetry_sync_interval IS
  'Interval in minutes for live telemetry sync (15, 30, or 45). Sync runs at fixed clock times based on this interval.';

-- Update existing vendors to use LIST_PLANTS as default (most efficient)
UPDATE vendors
SET telemetry_sync_mode = 'LIST_PLANTS'
WHERE telemetry_sync_mode IS NULL;

-- Update existing vendors to use 15 minutes as default interval
UPDATE vendors
SET telemetry_sync_interval = 15
WHERE telemetry_sync_interval IS NULL;

