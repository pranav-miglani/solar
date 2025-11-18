-- ============================================
-- FRESH INSTALL SCHEMA
-- ============================================
-- This file contains the complete database schema for a fresh installation.
-- All migrations have been consolidated into this single file.
-- 
-- Key features:
-- - No api_base_url in vendors table (stored in environment variables)
-- - Complete production metrics in plants table
-- - Auto-sync settings in organizations table
-- - Token storage in vendors table
-- - last_refreshed_at tracking in plants table
--
-- Run this file for a fresh database installation.
-- ============================================
-- DROP EXISTING SCHEMA (CLEAN SLATE)
-- ============================================
-- Drop in reverse dependency order to avoid constraint errors
-- Using DO block to handle errors gracefully

-- Drop triggers safely (check if table exists first)
DO $$
BEGIN
  -- Drop triggers only if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts') THEN
    DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_plant_eff') THEN
    DROP TRIGGER IF EXISTS update_work_order_plant_eff_updated_at ON work_order_plant_eff;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_orders') THEN
    DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plants') THEN
    DROP TRIGGER IF EXISTS update_plants_updated_at ON plants;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'Error dropping triggers (this is OK if tables don''t exist): %', SQLERRM;
END $$;

-- Drop tables (CASCADE to handle foreign key dependencies)
-- Order matters: drop dependent tables first
DROP TABLE IF EXISTS work_order_plant_eff CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS work_order_plants CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS plants CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop ENUM types (CASCADE to handle dependencies)
DROP TYPE IF EXISTS alert_status CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS work_order_priority CASCADE;
DROP TYPE IF EXISTS vendor_type CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;

-- ============================================
-- CREATE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE account_type AS ENUM ('SUPERADMIN', 'ORG', 'GOVT');
CREATE TYPE vendor_type AS ENUM ('SOLARMAN', 'SUNGROW', 'OTHER');
CREATE TYPE work_order_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');

-- Accounts table (replaces users table)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type account_type NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  org_id INTEGER, -- NULL for SUPERADMIN and GOVT, required for ORG
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_account_check CHECK (
    (account_type = 'ORG' AND org_id IS NOT NULL) OR
    (account_type IN ('SUPERADMIN', 'GOVT') AND org_id IS NULL)
  )
);

-- Organizations table
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  -- Auto-sync settings (enabled by default, 15 minutes interval)
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (sync_interval_minutes > 0 AND sync_interval_minutes <= 1440), -- 1 minute to 24 hours
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint for accounts.org_id
ALTER TABLE accounts ADD CONSTRAINT accounts_org_id_fkey 
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Vendors table
-- Vendors are mapped to organizations (one org can have multiple vendors)
-- Includes token storage for vendor API authentication (e.g., Solarman)
-- Tokens are cached in DB to avoid repeated API calls - checked before authentication
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  vendor_type vendor_type NOT NULL,
  -- Note: api_base_url removed - now stored in environment variables (e.g., SOLARMAN_API_BASE_URL)
  credentials JSONB NOT NULL,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  -- Token storage for vendor API authentication (Solarman, etc.)
  access_token TEXT, -- Cached access token from vendor API (stored after first auth)
  refresh_token TEXT, -- Refresh token for token renewal (if supported by vendor)
  token_expires_at TIMESTAMPTZ, -- Token expiration timestamp (checked before reuse)
  token_metadata JSONB DEFAULT '{}', -- Additional token metadata (token_type, scope, expires_in, etc.)
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ, -- Last time plants were synced from this vendor
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for token fields
COMMENT ON COLUMN vendors.access_token IS 'Cached access token from vendor API (e.g., Solarman). Stored after authentication to avoid repeated API calls.';
COMMENT ON COLUMN vendors.refresh_token IS 'Refresh token for token renewal (if supported by vendor)';
COMMENT ON COLUMN vendors.token_expires_at IS 'Token expiration timestamp - token is valid until this time. Checked before reuse to avoid expired tokens.';
COMMENT ON COLUMN vendors.token_metadata IS 'Additional token metadata (token_type, scope, expires_in, stored_at, etc.)';
COMMENT ON COLUMN vendors.org_id IS 'Organization this vendor belongs to. NULL means vendor is global/shared.';
COMMENT ON COLUMN vendors.last_synced_at IS 'Last time plants were synced from this vendor (updated after successful sync)';

-- Plants table
-- Includes production metrics from Production Overview dashboard
CREATE TABLE plants (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_plant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity_kw NUMERIC(10, 2) NOT NULL, -- Installed Capacity (shown in Production Overview)
  location JSONB DEFAULT '{}',
  -- Production metrics (from Production Overview dashboard)
  current_power_kw NUMERIC(10, 3), -- Current Power in kW
  daily_energy_mwh NUMERIC(10, 3), -- Daily Energy in MWh
  monthly_energy_mwh NUMERIC(10, 3), -- Monthly Energy in MWh
  yearly_energy_mwh NUMERIC(10, 3), -- Yearly Energy in MWh
  total_energy_mwh NUMERIC(10, 3), -- Total Energy in MWh
  performance_ratio NUMERIC(5, 4), -- PR (0-1 range, displayed as percentage in circular indicator)
  last_update_time TIMESTAMPTZ, -- Last time production data was updated from vendor (shown as "Last Updated" timestamp)
  last_refreshed_at TIMESTAMPTZ, -- Last time this plant data was refreshed/synced in our database (shown as "Last Refresh" timestamp)
  -- Additional metadata fields (refreshed on every sync)
  contact_phone TEXT, -- Contact phone number from vendor
  network_status TEXT, -- Network status from vendor (e.g., NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE). May include leading/trailing whitespace which is normalized during sync.
  vendor_created_date TIMESTAMPTZ, -- Original creation date from vendor (Unix timestamp converted to TIMESTAMPTZ)
  start_operating_time TIMESTAMPTZ, -- When plant started operating (Unix timestamp converted to TIMESTAMPTZ)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, vendor_plant_id)
);

-- Add comments for plant production metrics
COMMENT ON COLUMN plants.current_power_kw IS 'Current generation power in kW (shown in Production Overview)';
COMMENT ON COLUMN plants.daily_energy_mwh IS 'Daily energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.monthly_energy_mwh IS 'Monthly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.yearly_energy_mwh IS 'Yearly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.total_energy_mwh IS 'Total cumulative energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.performance_ratio IS 'Performance Ratio (PR) 0-1 range, displayed as percentage in circular indicator';
COMMENT ON COLUMN plants.last_update_time IS 'Last time production data was updated from vendor (shown as "Last Updated" timestamp)';
COMMENT ON COLUMN plants.last_refreshed_at IS 'Last time this plant data was refreshed/synced in our database (shown as "Last Refresh" timestamp) - set to NOW() on every sync';
COMMENT ON COLUMN plants.contact_phone IS 'Contact phone number from vendor (refreshed on sync)';
COMMENT ON COLUMN plants.network_status IS 'Network status from vendor. Valid values: NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE. May include leading/trailing whitespace which is normalized during sync. Unknown values are displayed as N/A in UI.';
COMMENT ON COLUMN plants.vendor_created_date IS 'Original creation date from vendor (Unix timestamp converted to TIMESTAMPTZ) - refreshed on sync';
COMMENT ON COLUMN plants.start_operating_time IS 'When plant started operating (Unix timestamp converted to TIMESTAMPTZ) - refreshed on sync';

-- Work Orders table (static, no status)
-- Note: priority and created_by are nullable/deprecated but kept for backward compatibility
-- org_id is required for cascade delete: when an organization is deleted, all its work orders are automatically deleted
CREATE TABLE work_orders (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT, -- Physical location of the work order
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- Organization this work order belongs to (required for cascade delete)
  priority work_order_priority DEFAULT 'MEDIUM', -- DEPRECATED: No longer used in UI, kept for backward compatibility
  created_by UUID REFERENCES accounts(id) ON DELETE CASCADE, -- DEPRECATED: No longer used in UI, kept for backward compatibility
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work Order - Plant mapping
CREATE TABLE work_order_plants (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_order_id, plant_id)
);

-- Unique constraint: one active work order per plant
CREATE UNIQUE INDEX uq_active_plant ON work_order_plants (plant_id)
WHERE is_active = true;

-- Alerts table
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  vendor_alert_id TEXT, -- Original alert ID from vendor
  title TEXT NOT NULL,
  description TEXT,
  severity alert_severity NOT NULL DEFAULT 'MEDIUM',
  status alert_status NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Work Order Plant Efficiency table
CREATE TABLE work_order_plant_eff (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual_gen NUMERIC(10, 2) NOT NULL,
  expected_gen NUMERIC(10, 2) NOT NULL,
  pr NUMERIC(5, 4) NOT NULL,
  efficiency_pct NUMERIC(5, 2) NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_org_id ON accounts(org_id);
CREATE INDEX idx_accounts_account_type ON accounts(account_type);
CREATE INDEX idx_vendors_org_id ON vendors(org_id);
CREATE INDEX idx_vendors_token_expires_at ON vendors(token_expires_at) WHERE token_expires_at IS NOT NULL;
CREATE INDEX idx_plants_org_id ON plants(org_id);
CREATE INDEX idx_plants_vendor_id ON plants(vendor_id);
CREATE INDEX idx_plants_vendor_id_org_id ON plants(vendor_id, org_id);
CREATE INDEX idx_plants_last_update_time ON plants(last_update_time);
CREATE INDEX idx_plants_network_status ON plants(network_status);
CREATE INDEX idx_work_orders_org_id ON work_orders(org_id);
CREATE INDEX idx_work_orders_location ON work_orders(location) WHERE location IS NOT NULL;
CREATE INDEX idx_work_orders_created_by ON work_orders(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_work_order_plants_work_order_id ON work_order_plants(work_order_id);
CREATE INDEX idx_work_order_plants_plant_id ON work_order_plants(plant_id);
CREATE INDEX idx_alerts_plant_id ON alerts(plant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_work_order_plant_eff_work_order_id ON work_order_plant_eff(work_order_id);
CREATE INDEX idx_work_order_plant_eff_plant_id ON work_order_plant_eff(plant_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for organization sync settings
COMMENT ON COLUMN organizations.auto_sync_enabled IS 'Whether automatic plant sync is enabled for this organization (default: true)';
COMMENT ON COLUMN organizations.sync_interval_minutes IS 'Sync interval in minutes (default: 15). Must be between 1 and 1440 (24 hours). Sync runs at fixed clock times based on this interval.';

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plants_updated_at BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY SCHEMA CREATION
-- ============================================
-- Verify all tables were created successfully
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'accounts', 'organizations', 'vendors', 'plants',
      'work_orders', 'work_order_plants', 'alerts', 'work_order_plant_eff'
    );
  
  IF table_count < 8 THEN
    RAISE EXCEPTION 'Not all tables were created. Expected 8, found %', table_count;
  END IF;
  
  RAISE NOTICE '✅ All 8 tables created successfully';
  
  -- Verify production metrics columns exist in plants table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plants' AND column_name = 'current_power_kw'
  ) THEN
    RAISE EXCEPTION 'Production metrics columns not found in plants table';
  END IF;
  
  -- Verify org_id exists in vendors table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'org_id column not found in vendors table';
  END IF;
  
  -- Verify token storage columns exist in vendors table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'access_token'
  ) THEN
    RAISE EXCEPTION 'Token storage columns not found in vendors table';
  END IF;
  
  -- Verify location column exists in work_orders table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'location'
  ) THEN
    RAISE EXCEPTION 'location column not found in work_orders table';
  END IF;
  
  -- Verify org_id column exists in work_orders table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'org_id column not found in work_orders table';
  END IF;
  
  -- Verify last_refreshed_at column exists in plants table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plants' AND column_name = 'last_refreshed_at'
  ) THEN
    RAISE EXCEPTION 'last_refreshed_at column not found in plants table';
  END IF;
  
  -- Verify api_base_url does NOT exist in vendors table (should be in env vars)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'api_base_url'
  ) THEN
    RAISE EXCEPTION 'api_base_url column should not exist in vendors table - it should be in environment variables';
  END IF;
  
  RAISE NOTICE '✅ Schema verification complete - all required columns present';
  RAISE NOTICE '✅ Token storage fields verified in vendors table';
  RAISE NOTICE '✅ org_id column verified in work_orders table for cascade delete';
  RAISE NOTICE '✅ Work orders location field verified';
  RAISE NOTICE '✅ last_refreshed_at column verified in plants table';
  RAISE NOTICE '✅ api_base_url correctly removed from vendors table (using env vars)';
END $$;
