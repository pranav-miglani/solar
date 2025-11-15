-- ============================================
-- MIGRATION 006: OBSOLETE - Merged into 001_initial_schema.sql
-- ============================================
-- This migration is no longer needed as org_id is now included
-- in the initial schema creation (001_initial_schema.sql).
-- 
-- If you're running a fresh install, use 001_initial_schema.sql only.
-- If you're upgrading an existing database, you can run this migration
-- but it's recommended to use the consolidated schema instead.

-- Add org_id to vendors table to map vendors to organizations
-- This allows multiple vendors per organization (same or different types)

ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vendors_org_id ON vendors(org_id);

-- Add comment
COMMENT ON COLUMN vendors.org_id IS 'Organization this vendor belongs to. NULL means vendor is global/shared.';
