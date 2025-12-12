-- ============================================
-- ADD UNIQUE CONSTRAINT TO ALERTS TABLE
-- ============================================
-- This migration adds a unique constraint to prevent duplicate alerts
-- 
-- Based on user requirement: alerts should be unique per (vendor_id, vendor_plant_id, vendor_alert_id)
-- Note: plant_id is system's internal plant ID, vendor_plant_id is vendor's plant identifier
-- 
-- IMPORTANT: Run the duplicate cleanup SQL BEFORE running this migration
-- ============================================

-- Unique constraint on (vendor_id, vendor_plant_id, vendor_alert_id)
-- This ensures each alert is unique per vendor, vendor's plant, and vendor's alert ID
-- plant_id (system's internal ID) is NOT part of uniqueness as it can differ from vendor_plant_id
-- Using normal blocking index (not CONCURRENTLY) for simplicity
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_vendor_plant_alert 
ON alerts(vendor_id, vendor_plant_id, vendor_alert_id)
WHERE vendor_id IS NOT NULL 
  AND vendor_plant_id IS NOT NULL 
  AND vendor_alert_id IS NOT NULL;

-- Add comment
COMMENT ON INDEX uq_alerts_vendor_plant_alert IS 
'Unique constraint preventing duplicate alerts with same vendor_id, vendor_plant_id, and vendor_alert_id. 
This ensures each vendor alert ID is unique per vendor and vendor plant, preventing data inconsistency.
Note: plant_id (system internal ID) is NOT part of uniqueness as it differs from vendor_plant_id.';

-- Verify the constraint was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'uq_alerts_vendor_plant_alert'
  ) THEN
    RAISE NOTICE '✅ Unique constraint uq_alerts_vendor_plant_alert created successfully';
  ELSE
    RAISE WARNING '⚠️ Unique constraint uq_alerts_vendor_plant_alert was not created';
  END IF;
END $$;

