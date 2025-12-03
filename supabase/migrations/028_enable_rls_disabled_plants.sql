-- ============================================
-- ENABLE RLS ON disabled_plants TABLE
-- ============================================
-- This migration enables Row Level Security on the disabled_plants table
-- and creates appropriate access policies for all account types.
--
-- CRITICAL SECURITY FIX: disabled_plants was created without RLS enabled,
-- which is a security vulnerability. This migration fixes that.

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on disabled_plants table
ALTER TABLE disabled_plants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (IF ANY)
-- ============================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Superadmins can manage all disabled plants" ON disabled_plants;
  DROP POLICY IF EXISTS "Developers can manage all disabled plants" ON disabled_plants;
  DROP POLICY IF EXISTS "Govt can view all disabled plants" ON disabled_plants;
  DROP POLICY IF EXISTS "Org accounts can view disabled plants in their org" ON disabled_plants;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'Error dropping policies (this is OK if they don''t exist): %', SQLERRM;
END $$;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- SUPERADMIN policies: Full access to all disabled plants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disabled_plants') THEN
    CREATE POLICY "Superadmins can manage all disabled plants"
      ON disabled_plants FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating SUPERADMIN policy for disabled_plants: %', SQLERRM;
END $$;

-- DEVELOPER policies: Full access to all disabled plants (same as SUPERADMIN)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disabled_plants') THEN
    CREATE POLICY "Developers can manage all disabled plants"
      ON disabled_plants FOR ALL
      USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating DEVELOPER policy for disabled_plants: %', SQLERRM;
END $$;

-- GOVT policies: Read-only access to all disabled plants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disabled_plants') THEN
    CREATE POLICY "Govt can view all disabled plants"
      ON disabled_plants FOR SELECT
      USING (get_account_type(auth.uid()::uuid) = 'GOVT');
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating GOVT policy for disabled_plants: %', SQLERRM;
END $$;

-- ORG policies: Read-only access to disabled plants in their organization
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disabled_plants') THEN
    CREATE POLICY "Org accounts can view disabled plants in their org"
      ON disabled_plants FOR SELECT
      USING (
        get_account_type(auth.uid()::uuid) = 'ORG' AND
        get_account_org_id(auth.uid()::uuid) = org_id
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Error creating ORG policy for disabled_plants: %', SQLERRM;
END $$;

-- ============================================
-- VERIFY RLS IS ENABLED
-- ============================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check if RLS is enabled
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'disabled_plants';
  
  IF rls_enabled IS NULL THEN
    RAISE EXCEPTION 'disabled_plants table does not exist';
  ELSIF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS is still disabled on disabled_plants table';
  END IF;
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'disabled_plants';
  
  RAISE NOTICE '✅ RLS enabled on disabled_plants table';
  RAISE NOTICE '✅ Created % RLS policies for disabled_plants', policy_count;
END $$;

