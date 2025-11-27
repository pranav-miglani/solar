-- Add logo_url to accounts table (common for all users: ORG, GOVT, and SUPERADMIN)
-- For ORG users, this represents the organization logo (since each org has one account)
-- For GOVT and SUPERADMIN users, this is their personal logo
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment
COMMENT ON COLUMN accounts.logo_url IS 'Logo URL for the account (SVG format recommended for dark mode compatibility). For ORG accounts, this represents the organization logo. For GOVT and SUPERADMIN, this is their personal logo.';

