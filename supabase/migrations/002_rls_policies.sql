-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
-- This script sets up RLS policies for all tables
-- Run this AFTER 001_initial_schema.sql

-- ============================================
-- DROP EXISTING POLICIES AND FUNCTIONS
-- ============================================

-- Drop existing policies (if any)
DO $$
BEGIN
  -- Drop policies for each table
  DROP POLICY IF EXISTS "Accounts can view their own record" ON accounts;
  DROP POLICY IF EXISTS "Superadmins can view all accounts" ON accounts;
  DROP POLICY IF EXISTS "Govt can view all accounts" ON accounts;
  
  DROP POLICY IF EXISTS "Superadmins can manage all organizations" ON organizations;
  DROP POLICY IF EXISTS "Govt can view all organizations" ON organizations;
  DROP POLICY IF EXISTS "Org accounts can view their own organization" ON organizations;
  
  DROP POLICY IF EXISTS "Superadmins can manage all vendors" ON vendors;
  DROP POLICY IF EXISTS "Govt can view all vendors" ON vendors;
  DROP POLICY IF EXISTS "Org accounts can view vendors" ON vendors;
  
  DROP POLICY IF EXISTS "Superadmins can manage all plants" ON plants;
  DROP POLICY IF EXISTS "Govt can view all plants" ON plants;
  DROP POLICY IF EXISTS "Org accounts can view plants in their org" ON plants;
  
  DROP POLICY IF EXISTS "Superadmins can manage all work orders" ON work_orders;
  DROP POLICY IF EXISTS "Govt can view all work orders" ON work_orders;
  DROP POLICY IF EXISTS "Org accounts can view work orders for their plants" ON work_orders;
  
  DROP POLICY IF EXISTS "Superadmins can manage all work_order_plants" ON work_order_plants;
  DROP POLICY IF EXISTS "Govt can view all work_order_plants" ON work_order_plants;
  DROP POLICY IF EXISTS "Org accounts can view work_order_plants for their plants" ON work_order_plants;
  
  DROP POLICY IF EXISTS "Superadmins can manage all alerts" ON alerts;
  DROP POLICY IF EXISTS "Govt can view all alerts" ON alerts;
  DROP POLICY IF EXISTS "Org accounts can view alerts for their plants" ON alerts;
  
  DROP POLICY IF EXISTS "Superadmins can view all efficiency data" ON work_order_plant_eff;
  DROP POLICY IF EXISTS "Govt can view all efficiency data" ON work_order_plant_eff;
  DROP POLICY IF EXISTS "Org accounts can view efficiency for their plants" ON work_order_plant_eff;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'Error dropping policies (this is OK if they don''t exist): %', SQLERRM;
END $$;

-- Drop existing helper functions
DROP FUNCTION IF EXISTS account_belongs_to_org(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_account_org_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_account_type(UUID) CASCADE;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable Row Level Security on all tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plants') THEN
    ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_orders') THEN
    ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_plants') THEN
    ALTER TABLE work_order_plants ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts') THEN
    ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_plant_eff') THEN
    ALTER TABLE work_order_plant_eff ENABLE ROW LEVEL SECURITY;
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error enabling RLS. Ensure tables exist (run 001_initial_schema.sql first): %', SQLERRM;
END $$;

-- ============================================
-- CREATE HELPER FUNCTIONS
-- ============================================

-- Helper function to get account type
CREATE OR REPLACE FUNCTION get_account_type(account_id UUID)
RETURNS account_type AS $$
  SELECT account_type FROM accounts WHERE id = account_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get account org_id
CREATE OR REPLACE FUNCTION get_account_org_id(account_id UUID)
RETURNS INTEGER AS $$
  SELECT org_id FROM accounts WHERE id = account_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if account belongs to org
CREATE OR REPLACE FUNCTION account_belongs_to_org(account_id UUID, org_id INTEGER)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts 
    WHERE id = account_id 
    AND org_id = account_belongs_to_org.org_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- Accounts policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    CREATE POLICY "Accounts can view their own record"
      ON accounts FOR SELECT
      USING (auth.uid()::text = id::text);

    CREATE POLICY "Superadmins can view all accounts"
      ON accounts FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all accounts"
      ON accounts FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating accounts policies: %', SQLERRM;
END $$;

-- Organizations policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    CREATE POLICY "Superadmins can manage all organizations"
      ON organizations FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all organizations"
      ON organizations FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view their own organization"
      ON organizations FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        get_account_org_id(auth.uid()::uuid) = id
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating organizations policies: %', SQLERRM;
END $$;

-- Vendors policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    CREATE POLICY "Superadmins can manage all vendors"
      ON vendors FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all vendors"
      ON vendors FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view vendors"
      ON vendors FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'ORG');
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating vendors policies: %', SQLERRM;
END $$;

-- Plants policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plants') THEN
    CREATE POLICY "Superadmins can manage all plants"
      ON plants FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all plants"
      ON plants FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view plants in their org"
      ON plants FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        get_account_org_id(auth.uid()::uuid) = org_id
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating plants policies: %', SQLERRM;
END $$;

-- Work Orders policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_orders') THEN
    CREATE POLICY "Superadmins can manage all work orders"
      ON work_orders FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all work orders"
      ON work_orders FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view work orders for their plants"
      ON work_orders FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        EXISTS (
          SELECT 1 FROM work_order_plants wop
          JOIN plants p ON p.id = wop.plant_id
          WHERE wop.work_order_id = work_orders.id
          AND p.org_id = get_account_org_id(auth.uid()::uuid)
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating work_orders policies: %', SQLERRM;
END $$;

-- Work Order Plants policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_plants') THEN
    CREATE POLICY "Superadmins can manage all work_order_plants"
      ON work_order_plants FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all work_order_plants"
      ON work_order_plants FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view work_order_plants for their plants"
      ON work_order_plants FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        EXISTS (
          SELECT 1 FROM plants p
          WHERE p.id = work_order_plants.plant_id
          AND p.org_id = get_account_org_id(auth.uid()::uuid)
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating work_order_plants policies: %', SQLERRM;
END $$;

-- Alerts policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts') THEN
    CREATE POLICY "Superadmins can manage all alerts"
      ON alerts FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all alerts"
      ON alerts FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view alerts for their plants"
      ON alerts FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        EXISTS (
          SELECT 1 FROM plants p
          WHERE p.id = alerts.plant_id
          AND p.org_id = get_account_org_id(auth.uid()::uuid)
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating alerts policies: %', SQLERRM;
END $$;

-- Work Order Plant Efficiency policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_plant_eff') THEN
    CREATE POLICY "Superadmins can view all efficiency data"
      ON work_order_plant_eff FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

    CREATE POLICY "Govt can view all efficiency data"
      ON work_order_plant_eff FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');

    CREATE POLICY "Org accounts can view efficiency for their plants"
      ON work_order_plant_eff FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        EXISTS (
          SELECT 1 FROM plants p
          WHERE p.id = work_order_plant_eff.plant_id
          AND p.org_id = get_account_org_id(auth.uid()::uuid)
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating work_order_plant_eff policies: %', SQLERRM;
END $$;

-- ============================================
-- VERIFY POLICIES CREATED
-- ============================================
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'accounts', 'organizations', 'vendors', 'plants',
      'work_orders', 'work_order_plants', 'alerts', 'work_order_plant_eff'
    );
  
  RAISE NOTICE '✅ Created % RLS policies', policy_count;
END $$;
