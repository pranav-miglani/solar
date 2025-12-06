-- ============================================
-- ENSURE TELEMETRY SYNC COLUMNS EXIST
-- ============================================
-- This migration ensures telemetry_sync_mode and telemetry_sync_interval columns exist
-- in the vendors table. This is a safety migration to handle cases where the schema
-- cache is out of date or the columns were not created properly.
--
-- Note: If you're seeing PGRST204 errors about missing columns, run this migration
-- and then refresh your Supabase schema cache (usually happens automatically, but
-- can be triggered manually in Supabase dashboard).

-- Add telemetry_sync_mode if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'telemetry_sync_mode'
  ) THEN
    ALTER TABLE vendors
      ADD COLUMN telemetry_sync_mode TEXT NOT NULL DEFAULT 'LIST_PLANTS';
    
    COMMENT ON COLUMN vendors.telemetry_sync_mode IS
      'Controls how live telemetry is synced: LIST_PLANTS (all plants in single call) or PER_PLANT (individual plant calls).';
  END IF;
END $$;

-- Add telemetry_sync_interval if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'telemetry_sync_interval'
  ) THEN
    ALTER TABLE vendors
      ADD COLUMN telemetry_sync_interval INTEGER NOT NULL DEFAULT 15;
    
    COMMENT ON COLUMN vendors.telemetry_sync_interval IS
      'Interval in minutes for live telemetry sync (15, 30, or 45). Sync runs at fixed clock times based on this interval.';
  END IF;
END $$;

-- Update existing vendors to use defaults if columns were just added
UPDATE vendors
SET 
  telemetry_sync_mode = COALESCE(telemetry_sync_mode, 'LIST_PLANTS'),
  telemetry_sync_interval = COALESCE(telemetry_sync_interval, 15)
WHERE 
  telemetry_sync_mode IS NULL 
  OR telemetry_sync_interval IS NULL;

