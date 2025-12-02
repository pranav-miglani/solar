-- ============================================
-- ADD DEVELOPER ACCOUNT TYPE
-- ============================================
-- This migration adds the DEVELOPER account type to the account_type enum.
-- DEVELOPER has all SUPERADMIN privileges plus access to documentation.

-- Add DEVELOPER to account_type enum
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'DEVELOPER';

-- Note: DEVELOPER permissions are handled in lib/rbac.ts
-- DEVELOPER can access all SUPERADMIN routes plus /superadmin/system-flow
-- SUPERADMIN cannot access /superadmin/system-flow (docs are DEVELOPER-only)

