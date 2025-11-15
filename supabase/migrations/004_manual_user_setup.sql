-- ============================================
-- MANUAL USER SETUP SCRIPT (PLAIN TEXT PASSWORDS)
-- ============================================
-- This script deletes all existing accounts and creates new ones with plain text passwords
-- Run this in Supabase SQL Editor
-- 
-- Passwords (plain text):
--   - admin@woms.com: admin123
--   - govt@woms.com: govt123
--   - org1@woms.com: org1123
--
-- Note: Passwords are stored in plain text for simplicity.
-- For production, implement proper password hashing (bcrypt, argon2, etc.)

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

-- Step 1: Delete all existing accounts
DELETE FROM accounts;
RAISE NOTICE 'Deleted all existing accounts';

-- Step 2: Ensure organizations exist (create if needed)
INSERT INTO organizations (name, meta)
VALUES 
  ('Solar Energy Corp', '{"region": "North", "established": "2020"}'),
  ('Green Power Solutions', '{"region": "South", "established": "2019"}')
ON CONFLICT DO NOTHING;

-- Get organization ID for ORG account
DO $$
DECLARE
  org1_id INTEGER;
BEGIN
  SELECT id INTO org1_id FROM organizations WHERE name = 'Solar Energy Corp' LIMIT 1;
  
  -- Step 3: Create Super Admin account
  -- Password: admin123 (plain text)
  INSERT INTO accounts (account_type, email, password_hash, org_id)
  VALUES (
    'SUPERADMIN',
    'admin@woms.com',
    'admin123',  -- Plain text password
    NULL
  );
  RAISE NOTICE 'Created Super Admin: admin@woms.com (password: admin123)';
  
  -- Step 4: Create Government account
  -- Password: govt123 (plain text)
  INSERT INTO accounts (account_type, email, password_hash, org_id)
  VALUES (
    'GOVT',
    'govt@woms.com',
    'govt123',  -- Plain text password
    NULL
  );
  RAISE NOTICE 'Created Government: govt@woms.com (password: govt123)';
  
  -- Step 5: Create Organization account
  -- Password: org1123 (plain text)
  IF org1_id IS NOT NULL THEN
    INSERT INTO accounts (account_type, email, password_hash, org_id)
    VALUES (
      'ORG',
      'org1@woms.com',
      'org1123',  -- Plain text password
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

