-- ============================================
-- DROP METADATA COLUMN FROM ALERTS TABLE
-- ============================================
-- This migration removes the metadata column from the alerts table.
-- 
-- Rationale:
-- - All alerts use the same timezone (Asia/Calcutta), so no timezone diversity
-- - Vendor-specific data in metadata is not used in business logic or UI
-- - Simplifies code by removing unnecessary writes
-- - Reduces storage overhead
--
-- Impact:
-- - backfill-grid-downtime.ts: Updated to use default "Asia/Calcutta" timezone
-- - alertSyncService.ts: Removed metadata: raw from Solarman and SolarDM adapters
-- - supabase/functions/sync-alerts/index.ts: Removed metadata: alert from inserts
-- - lib/vendors/types.ts: Removed metadata from Alert interface
-- ============================================

-- Drop the metadata column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE alerts DROP COLUMN metadata;
    RAISE NOTICE '✅ Dropped metadata column from alerts table';
  ELSE
    RAISE NOTICE 'ℹ️  metadata column does not exist in alerts table (already dropped or never created)';
  END IF;
END $$;

