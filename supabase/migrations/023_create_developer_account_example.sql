-- ============================================
-- CREATE DEVELOPER ACCOUNT (SQL)
-- ============================================
-- This script creates a DEVELOPER account for pranav.
-- 
-- IMPORTANT: Run migration 024_update_org_account_check_for_developer.sql FIRST!
-- This migration updates the constraint to allow DEVELOPER accounts with org_id = NULL.
--
-- Credentials:
--   Email/Username: pranav
--   Password: paytm@123
--   Password Hash: $2b$10$6qsTDVyhwUkCdmnughOr7eoGlRGbYppgCsmDKg0LjNevXb2ETbfXG
--
-- Usage:
--   1. First run: supabase/migrations/024_update_org_account_check_for_developer.sql
--   2. Then run this script in Supabase SQL Editor
--
-- Alternative: Use the TypeScript script instead:
--   npm run create:developer pranav paytm@123
--
-- ============================================

-- Check if DEVELOPER enum value exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'DEVELOPER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type')
  ) THEN
    RAISE EXCEPTION 'DEVELOPER account_type does not exist. Run migration 022_add_developer_account_type.sql first!';
  END IF;
END $$;

-- Delete existing account if it exists (makes script idempotent)
DELETE FROM accounts WHERE email = 'pranav';

-- Insert DEVELOPER account for pranav
INSERT INTO accounts (
  account_type,
  email,
  password_hash,
  org_id,
  is_active
) VALUES (
  'DEVELOPER',
  'pranav',
  '$2b$10$6qsTDVyhwUkCdmnughOr7eoGlRGbYppgCsmDKg0LjNevXb2ETbfXG',  -- bcrypt hash of 'paytm@123'
  NULL,  -- DEVELOPER accounts don't belong to any organization
  true
);

-- Verify account was created
SELECT 
  id,
  email,
  account_type,
  org_id,
  is_active,
  created_at
FROM accounts
WHERE email = 'pranav';

-- ============================================
-- NOTES:
-- ============================================
-- 1. DEVELOPER accounts have all SUPERADMIN privileges
-- 2. DEVELOPER accounts can access documentation at /superadmin/system-flow
-- 3. SUPERADMIN accounts CANNOT access documentation
-- 4. Login credentials:
--    Email/Username: pranav
--    Password: paytm@123
-- 5. Keep credentials secure!
-- ============================================

