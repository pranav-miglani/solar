-- ============================================
-- UPDATE PLANT SYNC TO ONCE DAILY
-- ============================================
-- This migration:
-- 1. Adds plant_sync_time_ist (single daily sync time, default: 02:00 IST)
-- 2. Migrates existing plant_list_sync_morning_ist values to plant_sync_time_ist
-- 3. Removes plant_list_sync_morning_ist and plant_list_sync_evening_ist columns
-- 4. Removes sync_interval_minutes from organizations table (telemetry sync uses vendor-level telemetry_sync_interval)

-- ============================================
-- ADD plant_sync_time_ist TO vendors TABLE
-- ============================================

DO $$
BEGIN
  -- Add plant_sync_time_ist column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'plant_sync_time_ist'
  ) THEN
    ALTER TABLE vendors
      ADD COLUMN plant_sync_time_ist TIME WITHOUT TIME ZONE NOT NULL DEFAULT TIME '02:00';
    
    RAISE NOTICE 'Added plant_sync_time_ist column to vendors table';
  ELSE
    RAISE NOTICE 'plant_sync_time_ist column already exists in vendors table';
  END IF;
END $$;

-- ============================================
-- MIGRATE EXISTING DATA
-- ============================================

DO $$
BEGIN
  -- Migrate existing plant_list_sync_morning_ist values to plant_sync_time_ist
  -- If morning time is NULL, keep default 02:00
  UPDATE vendors
  SET plant_sync_time_ist = COALESCE(plant_list_sync_morning_ist, TIME '02:00')
  WHERE plant_list_sync_morning_ist IS NOT NULL OR plant_sync_time_ist = TIME '02:00';
  
  RAISE NOTICE 'Migrated plant_list_sync_morning_ist values to plant_sync_time_ist';
END $$;

-- ============================================
-- ADD COMMENT
-- ============================================

COMMENT ON COLUMN vendors.plant_sync_time_ist IS 'Local IST time for daily plant sync (default: 02:00). Plant sync runs once daily at this configured time.';

-- ============================================
-- REMOVE OLD PLANT SYNC COLUMNS
-- ============================================

DO $$
BEGIN
  -- Remove plant_list_sync_morning_ist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'plant_list_sync_morning_ist'
  ) THEN
    ALTER TABLE vendors DROP COLUMN plant_list_sync_morning_ist;
    RAISE NOTICE 'Removed plant_list_sync_morning_ist column from vendors table';
  ELSE
    RAISE NOTICE 'plant_list_sync_morning_ist column does not exist (already removed)';
  END IF;
  
  -- Remove plant_list_sync_evening_ist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'plant_list_sync_evening_ist'
  ) THEN
    ALTER TABLE vendors DROP COLUMN plant_list_sync_evening_ist;
    RAISE NOTICE 'Removed plant_list_sync_evening_ist column from vendors table';
  ELSE
    RAISE NOTICE 'plant_list_sync_evening_ist column does not exist (already removed)';
  END IF;
END $$;

-- ============================================
-- REMOVE sync_interval_minutes FROM organizations
-- ============================================
-- Note: Telemetry sync uses vendor-level telemetry_sync_interval, not org-level sync_interval_minutes

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'sync_interval_minutes'
  ) THEN
    ALTER TABLE organizations DROP COLUMN sync_interval_minutes;
    RAISE NOTICE 'Removed sync_interval_minutes column from organizations table';
  ELSE
    RAISE NOTICE 'sync_interval_minutes column does not exist in organizations table (already removed)';
  END IF;
END $$;

-- ============================================
-- VERIFY MIGRATION
-- ============================================

DO $$
DECLARE
  plant_sync_time_exists BOOLEAN;
  morning_exists BOOLEAN;
  evening_exists BOOLEAN;
  sync_interval_exists BOOLEAN;
BEGIN
  -- Check plant_sync_time_ist exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'plant_sync_time_ist'
  ) INTO plant_sync_time_exists;
  
  -- Check old columns are removed
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'plant_list_sync_morning_ist'
  ) INTO morning_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'plant_list_sync_evening_ist'
  ) INTO evening_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'sync_interval_minutes'
  ) INTO sync_interval_exists;
  
  IF plant_sync_time_exists AND NOT morning_exists AND NOT evening_exists AND NOT sync_interval_exists THEN
    RAISE NOTICE '✅ Migration completed successfully';
  ELSE
    RAISE WARNING '⚠️ Migration verification: plant_sync_time_ist=% morning_exists=% evening_exists=% sync_interval_exists=%', 
      plant_sync_time_exists, morning_exists, evening_exists, sync_interval_exists;
  END IF;
END $$;

