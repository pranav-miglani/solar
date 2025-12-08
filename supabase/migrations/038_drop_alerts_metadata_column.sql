-- ============================================
-- DROP METADATA AND RESOLVED_AT COLUMNS FROM ALERTS TABLE
-- ============================================
-- This migration removes the metadata and resolved_at columns from the alerts table.
-- 
-- Rationale for metadata:
-- - All alerts use the same timezone (Asia/Calcutta), so no timezone diversity
-- - Vendor-specific data in metadata is not used in business logic or UI
-- - Simplifies code by removing unnecessary writes
-- - Reduces storage overhead
--
-- Rationale for resolved_at:
-- - Not being used in the application
-- - Alert resolution is tracked via status field (ACTIVE/RESOLVED)
-- - end_time already provides resolution timestamp when available
--
-- Impact:
-- - backfill-grid-downtime.ts: Updated to use default "Asia/Calcutta" timezone
-- - alertSyncService.ts: Removed metadata: raw from Solarman and SolarDM adapters
-- - supabase/functions/sync-alerts/index.ts: Removed metadata: alert from inserts
-- - lib/vendors/types.ts: Removed metadata from Alert interface
-- - lib/swagger.ts: Removed resolved_at from Alert schema
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

-- Drop the resolved_at column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE alerts DROP COLUMN resolved_at;
    RAISE NOTICE '✅ Dropped resolved_at column from alerts table';
  ELSE
    RAISE NOTICE 'ℹ️  resolved_at column does not exist in alerts table (already dropped or never created)';
  END IF;
END $$;

