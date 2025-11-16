-- ============================================
-- MANUAL USER SETUP SCRIPT (WITH PASSWORD HASHING)
-- ============================================
-- This script deletes all existing accounts and creates new ones with hashed passwords
-- Run this in Supabase SQL Editor
-- 
-- Passwords (plain text - for reference only):
--   - admin@woms.com: admin123
--   - govt@woms.com: govt123
--   - org1@woms.com: org1123
--
-- All passwords are stored as bcrypt hashes in the database.
-- Users input plain text passwords which are compared with stored hashes during login.
--
-- RECOMMENDED: Use the seed script instead for automatic hashing:
--   npm run seed
--   or
--   npx tsx scripts/seed.ts

BEGIN;

-- ============================================
-- VERIFY PREREQUISITES
-- ============================================
DO $$
BEGIN
  -- Check if accounts table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'accounts'
  ) THEN
    RAISE EXCEPTION 'accounts table does not exist. Run 001_initial_schema.sql first!';
  END IF;
  
  -- Check if organizations table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'organizations'
  ) THEN
    RAISE EXCEPTION 'organizations table does not exist. Run 001_initial_schema.sql first!';
  END IF;
END $$;

-- Step 1: Delete existing accounts (by email) before inserting
-- This makes the script idempotent - safe to run multiple times
DELETE FROM accounts WHERE email IN ('admin@woms.com', 'govt@woms.com', 'org1@woms.com');
-- RAISE NOTICE 'Deleted existing accounts (if any)';

-- Step 2: Ensure organizations exist (create if needed)
INSERT INTO organizations (name, meta)
VALUES 
  ('Solar Energy Corp', '{"region": "North", "established": "2020"}')
ON CONFLICT DO NOTHING;

-- Get organization ID for ORG account
DO $$
DECLARE
  org1_id INTEGER;
BEGIN
  SELECT id INTO org1_id FROM organizations WHERE name = 'Solar Energy Corp' LIMIT 1;
  
  -- Step 3: Delete and Create Super Admin account
  -- Password: admin123 (stored as bcrypt hash)
  DELETE FROM accounts WHERE email = 'admin@woms.com';
  
  INSERT INTO accounts (account_type, email, password_hash, org_id)
  VALUES (
    'SUPERADMIN',
    'admin@woms.com',
    '$2b$10$pVV0zXjApE8jNhIMTOZ9peqyzIMVPVw/ybhJfHWR.2KerTCu1H1Cq',
    NULL
  );
  RAISE NOTICE 'Created Super Admin: admin@woms.com (password: admin123)';
  
  -- Step 4: Delete and Create Government account
  -- Password: govt123 (stored as bcrypt hash)
  DELETE FROM accounts WHERE email = 'govt@woms.com';
  
  INSERT INTO accounts (account_type, email, password_hash, org_id)
  VALUES (
    'GOVT',
    'govt@woms.com',
    '$2b$10$Jlzo9l/joTHPE4CClPOsPOiNpiWEw1OpvJyDUSLTedLhk8SMvqITe',
    NULL
  );
  RAISE NOTICE 'Created Government: govt@woms.com (password: govt123)';
  
  -- Step 5: Delete and Create Organization account
  -- Password: org1123 (stored as bcrypt hash)
  IF org1_id IS NOT NULL THEN
    DELETE FROM accounts WHERE email = 'org1@woms.com';
    
    INSERT INTO accounts (account_type, email, password_hash, org_id)
    VALUES (
      'ORG',
      'org1@woms.com',
      '$2b$10$PeXXkSCeoSKLVXdMLOGSb.xbB7avvbH52FzPqXjg/J8xTj9NeEwwG',
      org1_id
    );
    RAISE NOTICE 'Created Organization: org1@woms.com (password: org1123)';
  ELSE
    RAISE EXCEPTION 'Organization not found';
  END IF;
END $$;

-- Step 6: Verify all accounts were created
SELECT 
  id,
  email,
  account_type,
  org_id,
  created_at
FROM accounts
ORDER BY account_type, email;

COMMIT;

