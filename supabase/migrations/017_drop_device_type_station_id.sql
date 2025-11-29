-- ============================================
-- DROP DEVICE_TYPE AND STATION_ID FROM ALERTS
-- ============================================
-- This migration removes the device_type and station_id columns
-- from the alerts table as they are redundant.
--
-- - device_type: Redundant, filtering can be done via metadata if needed
-- - station_id: Redundant, vendor_plant_id already stores this information

-- Remove comments for dropped columns
COMMENT ON COLUMN alerts.device_type IS NULL;
COMMENT ON COLUMN alerts.station_id IS NULL;


-- Drop device_type column
ALTER TABLE alerts DROP COLUMN IF EXISTS device_type;

-- Drop station_id column
ALTER TABLE alerts DROP COLUMN IF EXISTS station_id;

