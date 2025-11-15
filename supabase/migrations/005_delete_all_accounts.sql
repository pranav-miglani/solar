-- ============================================
-- DELETE ALL ACCOUNTS SCRIPT
-- ============================================
-- Use this script to delete all existing accounts
-- Run this in Supabase SQL Editor before creating new accounts

BEGIN;

-- Delete all accounts
DELETE FROM accounts;

-- Verify deletion
SELECT COUNT(*) as remaining_accounts FROM accounts;

COMMIT;

