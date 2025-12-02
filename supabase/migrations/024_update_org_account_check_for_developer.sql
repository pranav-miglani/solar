-- ============================================
-- UPDATE ORG_ACCOUNT_CHECK CONSTRAINT FOR DEVELOPER
-- ============================================
-- This migration updates the org_account_check constraint to include DEVELOPER accounts.
-- DEVELOPER accounts, like SUPERADMIN and GOVT, should have org_id = NULL.
--
-- The constraint currently only allows:
--   - ORG accounts: org_id IS NOT NULL
--   - SUPERADMIN/GOVT accounts: org_id IS NULL
--
-- This migration adds DEVELOPER to the list of account types that must have org_id = NULL.
-- ============================================

-- Drop the existing constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS org_account_check;

-- Recreate the constraint with DEVELOPER included
ALTER TABLE accounts ADD CONSTRAINT org_account_check CHECK (
  (account_type = 'ORG' AND org_id IS NOT NULL) OR
  (account_type IN ('SUPERADMIN', 'GOVT', 'DEVELOPER') AND org_id IS NULL)
);

-- Verify the constraint was updated
DO $$
BEGIN
  -- Check if constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'org_account_check' 
    AND conrelid = 'accounts'::regclass
  ) THEN
    RAISE NOTICE '✅ Constraint org_account_check updated successfully';
  ELSE
    RAISE EXCEPTION '❌ Constraint org_account_check was not created';
  END IF;
END $$;

