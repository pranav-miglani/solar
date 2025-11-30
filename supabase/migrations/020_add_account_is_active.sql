-- ============================================
-- ADD IS_ACTIVE COLUMN TO ACCOUNTS TABLE
-- ============================================
-- This migration adds is_active column to accounts table to allow
-- super admins to disable accounts (prevent login)

-- Add is_active column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add comment for is_active column
COMMENT ON COLUMN accounts.is_active IS 'Indicates if the account is active (true) or inactive (false). Inactive accounts cannot login.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active) WHERE is_active = true;

