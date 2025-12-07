-- ============================================
-- ENABLE ROW LEVEL SECURITY FOR WMS TABLES
-- ============================================
-- This migration enables RLS and creates policies for WMS tables
-- Fixes security advisor warnings for:
-- - wms_vendors
-- - wms_sites
-- - wms_devices
-- - insolation_readings

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on WMS tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wms_vendors') THEN
    ALTER TABLE wms_vendors ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on wms_vendors';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wms_sites') THEN
    ALTER TABLE wms_sites ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on wms_sites';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wms_devices') THEN
    ALTER TABLE wms_devices ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on wms_devices';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insolation_readings') THEN
    ALTER TABLE insolation_readings ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on insolation_readings';
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error enabling RLS on WMS tables: %', SQLERRM;
END $$;

-- ============================================
-- DROP EXISTING POLICIES (IF ANY)
-- ============================================

DO $$
BEGIN
  -- Drop existing WMS policies if they exist
  DROP POLICY IF EXISTS "Superadmins can manage all wms_vendors" ON wms_vendors;
  DROP POLICY IF EXISTS "Developers can manage all wms_vendors" ON wms_vendors;
  DROP POLICY IF EXISTS "Govt can view all wms_vendors" ON wms_vendors;
  DROP POLICY IF EXISTS "Org accounts can view wms_vendors in their org" ON wms_vendors;
  
  DROP POLICY IF EXISTS "Superadmins can manage all wms_sites" ON wms_sites;
  DROP POLICY IF EXISTS "Developers can manage all wms_sites" ON wms_sites;
  DROP POLICY IF EXISTS "Govt can view all wms_sites" ON wms_sites;
  DROP POLICY IF EXISTS "Org accounts can view wms_sites in their org" ON wms_sites;
  
  DROP POLICY IF EXISTS "Superadmins can manage all wms_devices" ON wms_devices;
  DROP POLICY IF EXISTS "Developers can manage all wms_devices" ON wms_devices;
  DROP POLICY IF EXISTS "Govt can view all wms_devices" ON wms_devices;
  DROP POLICY IF EXISTS "Org accounts can view wms_devices in their org" ON wms_devices;
  
  DROP POLICY IF EXISTS "Superadmins can manage all insolation_readings" ON insolation_readings;
  DROP POLICY IF EXISTS "Developers can manage all insolation_readings" ON insolation_readings;
  DROP POLICY IF EXISTS "Govt can view all insolation_readings" ON insolation_readings;
  DROP POLICY IF EXISTS "Org accounts can view insolation_readings in their org" ON insolation_readings;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'Error dropping existing WMS policies (this is OK if they don''t exist): %', SQLERRM;
END $$;

-- ============================================
-- CREATE RLS POLICIES FOR WMS TABLES
-- ============================================

-- WMS Vendors policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wms_vendors') THEN
    CREATE POLICY "Superadmins can manage all wms_vendors"
      ON wms_vendors FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Developers can manage all wms_vendors"
      ON wms_vendors FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

    CREATE POLICY "Govt can view all wms_vendors"
      ON wms_vendors FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view wms_vendors in their org"
      ON wms_vendors FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        get_account_org_id(auth.uid()::uuid) = org_id
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating wms_vendors policies: %', SQLERRM;
END $$;

-- WMS Sites policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wms_sites') THEN
    CREATE POLICY "Superadmins can manage all wms_sites"
      ON wms_sites FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Developers can manage all wms_sites"
      ON wms_sites FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

    CREATE POLICY "Govt can view all wms_sites"
      ON wms_sites FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view wms_sites in their org"
      ON wms_sites FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        get_account_org_id(auth.uid()::uuid) = org_id
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating wms_sites policies: %', SQLERRM;
END $$;

-- WMS Devices policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wms_devices') THEN
    CREATE POLICY "Superadmins can manage all wms_devices"
      ON wms_devices FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Developers can manage all wms_devices"
      ON wms_devices FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

    CREATE POLICY "Govt can view all wms_devices"
      ON wms_devices FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view wms_devices in their org"
      ON wms_devices FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        EXISTS (
          SELECT 1 FROM wms_sites ws
          WHERE ws.id = wms_devices.wms_site_id
          AND ws.org_id = get_account_org_id(auth.uid()::uuid)
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating wms_devices policies: %', SQLERRM;
END $$;

-- Insolation Readings policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insolation_readings') THEN
    CREATE POLICY "Superadmins can manage all insolation_readings"
      ON insolation_readings FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Developers can manage all insolation_readings"
      ON insolation_readings FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

    CREATE POLICY "Govt can view all insolation_readings"
      ON insolation_readings FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view insolation_readings in their org"
      ON insolation_readings FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        EXISTS (
          SELECT 1 FROM wms_devices wd
          JOIN wms_sites ws ON ws.id = wd.wms_site_id
          WHERE wd.id = insolation_readings.wms_device_id
          AND ws.org_id = get_account_org_id(auth.uid()::uuid)
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating insolation_readings policies: %', SQLERRM;
END $$;

