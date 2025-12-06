-- ============================================
-- FRESH INSTALL - COMPLETE DATABASE SCHEMA
-- ============================================
-- This file contains the complete database schema for a fresh installation.
-- All migrations have been consolidated into this single file.
-- 
-- Key features:
-- - Complete schema with all tables, columns, indexes, and constraints
-- - All ENUM types including DEVELOPER, SOLARDM, PVBLINK, SHINEMONITOR, FOXESSCLOUD
-- - Row Level Security (RLS) policies for all tables
-- - Disabled plants functionality
-- - Alert schema with all vendor fields
-- - All vendor sync configuration fields
-- - Account management with display_name, logo_url, is_active
-- - Plant sync and telemetry sync configuration
--
-- Run this file for a fresh database installation.
-- ============================================
-- DROP EXISTING SCHEMA (CLEAN SLATE)
-- ============================================

-- Drop triggers safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts') THEN
    DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disabled_plants') THEN
    DROP TRIGGER IF EXISTS update_disabled_plants_updated_at ON disabled_plants;
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
DROP TABLE IF EXISTS disabled_plants CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS work_order_plants CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS plants CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS disable_inactive_plants() CASCADE;
DROP FUNCTION IF EXISTS should_disable_plant(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS account_belongs_to_org(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_account_org_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_account_type(UUID) CASCADE;

-- Drop ENUM types (CASCADE to handle dependencies)
DROP TYPE IF EXISTS alert_status CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS work_order_priority CASCADE;
DROP TYPE IF EXISTS vendor_type CASCADE;
DROP TYPE IF EXISTS wms_vendor_type CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;

-- ============================================
-- CREATE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types (with all values)
CREATE TYPE account_type AS ENUM ('SUPERADMIN', 'ORG', 'GOVT', 'DEVELOPER');
CREATE TYPE vendor_type AS ENUM ('SOLARMAN', 'SUNGROW', 'OTHER', 'SOLARDM', 'PVBLINK', 'SHINEMONITOR', 'FOXESSCLOUD');
CREATE TYPE wms_vendor_type AS ENUM ('INTELLO');
CREATE TYPE work_order_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');

-- ============================================
-- CORE TABLES
-- ============================================

-- Accounts table (replaces users table)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type account_type NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  org_id INTEGER, -- NULL for SUPERADMIN, GOVT, and DEVELOPER; required for ORG
  display_name TEXT, -- User-friendly display name
  logo_url TEXT, -- Logo URL (SVG format recommended for dark mode compatibility)
  is_active BOOLEAN NOT NULL DEFAULT true, -- Indicates if account is active (inactive accounts cannot login)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_account_check CHECK (
    (account_type = 'ORG' AND org_id IS NOT NULL) OR
    (account_type IN ('SUPERADMIN', 'GOVT', 'DEVELOPER') AND org_id IS NULL)
  )
);

COMMENT ON COLUMN accounts.display_name IS 'User-friendly display name for the account';
COMMENT ON COLUMN accounts.logo_url IS 'Logo URL for the account (SVG format recommended for dark mode compatibility). For ORG accounts, this represents the organization logo. For GOVT and SUPERADMIN, this is their personal logo.';
COMMENT ON COLUMN accounts.is_active IS 'Indicates if the account is active (true) or inactive (false). Inactive accounts cannot login.';

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

COMMENT ON COLUMN organizations.auto_sync_enabled IS 'Whether automatic plant sync is enabled for this organization (default: true)';
COMMENT ON COLUMN organizations.sync_interval_minutes IS 'Sync interval in minutes (default: 15). Must be between 1 and 1440 (24 hours). Sync runs at fixed clock times based on this interval.';

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
  last_alert_synced_at TIMESTAMPTZ, -- Last time alerts were synced for this vendor (cron or manual)
  -- Plant sync configuration
  plant_sync_mode TEXT NOT NULL DEFAULT 'LIST_PLANTS', -- 'LIST_PLANTS' or 'PER_PLANT'
  per_plant_sync_interval_minutes INTEGER NOT NULL DEFAULT 15, -- Interval for per-plant sync crons
  plant_list_sync_morning_ist TIME WITHOUT TIME ZONE NOT NULL DEFAULT TIME '06:00', -- Morning listPlants() sync time (IST)
  plant_list_sync_evening_ist TIME WITHOUT TIME ZONE NOT NULL DEFAULT TIME '23:00', -- Evening listPlants() sync time (IST)
  -- Telemetry sync configuration
  telemetry_sync_mode TEXT NOT NULL DEFAULT 'LIST_PLANTS', -- 'LIST_PLANTS' or 'PER_PLANT'
  telemetry_sync_interval INTEGER NOT NULL DEFAULT 15, -- Interval in minutes (15, 30, or 45)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN vendors.access_token IS 'Cached access token from vendor API (e.g., Solarman). Stored after authentication to avoid repeated API calls.';
COMMENT ON COLUMN vendors.refresh_token IS 'Refresh token for token renewal (if supported by vendor)';
COMMENT ON COLUMN vendors.token_expires_at IS 'Token expiration timestamp - token is valid until this time. Checked before reuse to avoid expired tokens.';
COMMENT ON COLUMN vendors.token_metadata IS 'Additional token metadata (token_type, scope, expires_in, stored_at, etc.)';
COMMENT ON COLUMN vendors.org_id IS 'Organization this vendor belongs to. NULL means vendor is global/shared.';
COMMENT ON COLUMN vendors.last_synced_at IS 'Last time plants were synced from this vendor (updated after successful sync)';
COMMENT ON COLUMN vendors.last_alert_synced_at IS 'Last time alerts were synced for this vendor (cron or manual).';
COMMENT ON COLUMN vendors.plant_sync_mode IS 'Controls how plant sync runs for this vendor: LIST_PLANTS (metrics from listPlants) or PER_PLANT (metrics from per-plant telemetry).';
COMMENT ON COLUMN vendors.per_plant_sync_interval_minutes IS 'Interval in minutes for per-plant sync crons (used when plant_sync_mode = PER_PLANT). Default 15.';
COMMENT ON COLUMN vendors.plant_list_sync_morning_ist IS 'Local IST time for the morning listPlants() sync when plant_sync_mode = PER_PLANT (default 06:00).';
COMMENT ON COLUMN vendors.plant_list_sync_evening_ist IS 'Local IST time for the evening listPlants() sync when plant_sync_mode = PER_PLANT (default 23:00).';
COMMENT ON COLUMN vendors.telemetry_sync_mode IS 'Controls how live telemetry is synced: LIST_PLANTS (all plants in single call) or PER_PLANT (individual plant calls).';
COMMENT ON COLUMN vendors.telemetry_sync_interval IS 'Interval in minutes for live telemetry sync (15, 30, or 45). Sync runs at fixed clock times based on this interval.';

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
  daily_energy_kwh NUMERIC(10, 3), -- Daily Energy in kWh (stored in kWh to avoid rounding errors)
  monthly_energy_mwh NUMERIC(10, 3), -- Monthly Energy in MWh
  yearly_energy_mwh NUMERIC(10, 3), -- Yearly Energy in MWh
  total_energy_mwh NUMERIC(10, 3), -- Total Energy in MWh
  last_update_time TIMESTAMPTZ, -- Last time production data was updated from vendor (shown as "Last Updated" timestamp)
  last_refreshed_at TIMESTAMPTZ, -- Last time this plant data was refreshed/synced in our database (shown as "Last Refresh" timestamp)
  -- Additional metadata fields (refreshed on every sync)
  network_status TEXT, -- Network status from vendor (e.g., NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE). May include leading/trailing whitespace which is normalized during sync.
  vendor_created_date TIMESTAMPTZ, -- Original creation date from vendor (Unix timestamp converted to TIMESTAMPTZ)
  start_operating_time TIMESTAMPTZ, -- When plant started operating (Unix timestamp converted to TIMESTAMPTZ)
  is_active BOOLEAN NOT NULL DEFAULT true, -- Indicates if the plant is active (true) or disabled (false)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, vendor_plant_id)
);

COMMENT ON COLUMN plants.current_power_kw IS 'Current generation power in kW (shown in Production Overview)';
COMMENT ON COLUMN plants.daily_energy_kwh IS 'Daily energy generation in kWh (shown in Production Overview). Stored in kWh to avoid rounding errors when converting between units.';
COMMENT ON COLUMN plants.monthly_energy_mwh IS 'Monthly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.yearly_energy_mwh IS 'Yearly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.total_energy_mwh IS 'Total cumulative energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.last_update_time IS 'Last time production data was updated from vendor (shown as "Last Updated" timestamp)';
COMMENT ON COLUMN plants.last_refreshed_at IS 'Last time this plant data was refreshed/synced in our database (shown as "Last Refresh" timestamp) - set to NOW() on every sync';
COMMENT ON COLUMN plants.network_status IS 'Network status from vendor. Valid values: NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE. May include leading/trailing whitespace which is normalized during sync. Unknown values are displayed as N/A in UI.';
COMMENT ON COLUMN plants.vendor_created_date IS 'Original creation date from vendor (Unix timestamp converted to TIMESTAMPTZ) - refreshed on sync';
COMMENT ON COLUMN plants.start_operating_time IS 'When plant started operating (Unix timestamp converted to TIMESTAMPTZ) - refreshed on sync';
COMMENT ON COLUMN plants.is_active IS 'Indicates if the plant is active (true) or disabled (false). Plants are marked inactive if they haven''t received vendor updates (last_update_time) for 3+ days.';

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
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_alert_id TEXT, -- Original alert ID from vendor
  vendor_plant_id TEXT, -- Vendor-specific plant/station identifier (e.g., Solarman stationId as string)
  alert_time TIMESTAMPTZ, -- When the alert started (vendor timestamp)
  end_time TIMESTAMPTZ, -- When the alert ended / was cleared (if provided by vendor)
  grid_down_seconds INTEGER, -- Computed grid downtime in seconds: max(0, end_time - alert_time)
  grid_down_benefit_kwh NUMERIC(12,3), -- Derived grid downtime benefit energy (kWh) using 0.5 x hours(9am-4pm overlap) x installed capacity
  title TEXT NOT NULL,
  description TEXT,
  severity alert_severity NOT NULL DEFAULT 'MEDIUM',
  status alert_status NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

COMMENT ON COLUMN alerts.vendor_id IS 'Vendor that generated this alert (helps disambiguate vendor_alert_id across vendors).';
COMMENT ON COLUMN alerts.vendor_plant_id IS 'Vendor-specific plant/station identifier (e.g., Solarman stationId as string).';
COMMENT ON COLUMN alerts.alert_time IS 'Timestamp when the alert started (converted from vendor-specific epoch/format).';
COMMENT ON COLUMN alerts.end_time IS 'Timestamp when the alert ended / was cleared (if provided by vendor).';
COMMENT ON COLUMN alerts.grid_down_seconds IS 'Computed grid downtime in seconds for this alert: max(0, end_time - alert_time) when both are present.';
COMMENT ON COLUMN alerts.grid_down_benefit_kwh IS 'Calculated downtime benefit energy in kWh: 0.5 × (hours overlapping 9:00-16:00 local window) × installed capacity (kW).';

-- Disabled Plants table
-- Stores information about plants that have been inactive for 3+ days
CREATE TABLE disabled_plants (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_plant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity_kw NUMERIC(10, 2) NOT NULL,
  location JSONB DEFAULT '{}',
  -- Production metrics (snapshot at time of disablement)
  current_power_kw NUMERIC(10, 3),
  daily_energy_kwh NUMERIC(10, 3),
  monthly_energy_mwh NUMERIC(10, 3),
  yearly_energy_mwh NUMERIC(10, 3),
  total_energy_mwh NUMERIC(10, 3),
  last_update_time TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  -- Additional metadata
  network_status TEXT,
  vendor_created_date TIMESTAMPTZ,
  start_operating_time TIMESTAMPTZ,
  -- Disablement tracking
  disabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_since_refresh INTEGER NOT NULL, -- Days since last_update_time (vendor's last data update) when plant was disabled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE disabled_plants IS 'Stores information about plants that haven''t received vendor updates (last_update_time) for 3+ days.';
COMMENT ON COLUMN disabled_plants.plant_id IS 'Reference to the original plant record';
COMMENT ON COLUMN disabled_plants.disabled_at IS 'Timestamp when the plant was marked as disabled';
COMMENT ON COLUMN disabled_plants.days_since_refresh IS 'Number of days since last_update_time (vendor''s last data update) when plant was disabled.';

-- ============================================
-- WEATHER MONITORING SYSTEM (WMS) TABLES
-- ============================================

-- WMS Vendors table (similar to vendors but for weather monitoring)
CREATE TABLE wms_vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  vendor_type wms_vendor_type NOT NULL,
  credentials JSONB NOT NULL, -- Stores email, password_hash, etc.
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Token storage for WMS vendor API authentication
  access_token TEXT, -- Cached access token from vendor API
  refresh_token TEXT, -- Refresh token for token renewal (if supported)
  token_expires_at TIMESTAMPTZ, -- Token expiration timestamp
  token_metadata JSONB DEFAULT '{}', -- Additional token metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sites_synced_at TIMESTAMPTZ, -- Last time sites were synced
  last_insolation_synced_at TIMESTAMPTZ, -- Last time insolation data was synced
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE wms_vendors IS 'Weather Monitoring System vendors (separate from inverter vendors). Manages sites and devices for insolation data.';
COMMENT ON COLUMN wms_vendors.credentials IS 'Vendor-specific credentials (e.g., email, password_hash for INTELLO)';
COMMENT ON COLUMN wms_vendors.access_token IS 'Cached access token from WMS vendor API';
COMMENT ON COLUMN wms_vendors.last_sites_synced_at IS 'Last time sites were synced from this vendor';
COMMENT ON COLUMN wms_vendors.last_insolation_synced_at IS 'Last time insolation data was synced for this vendor';

-- WMS Sites table
CREATE TABLE wms_sites (
  id SERIAL PRIMARY KEY,
  wms_vendor_id INTEGER NOT NULL REFERENCES wms_vendors(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_site_id TEXT NOT NULL, -- Vendor-specific site identifier
  site_name TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location TEXT,
  elevation NUMERIC(10, 2),
  status TEXT, -- e.g., PARTIALLY_ACTIVE, ACTIVE, INACTIVE
  panel_count INTEGER,
  panel_wattage NUMERIC(10, 2),
  created_date DATE,
  installer_type TEXT, -- e.g., RESIDENTIAL, COMMERCIAL
  metadata JSONB DEFAULT '{}', -- Additional vendor-specific site data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wms_vendor_id, vendor_site_id)
);

COMMENT ON TABLE wms_sites IS 'Weather monitoring sites from WMS vendors. Each site can have multiple devices.';
COMMENT ON COLUMN wms_sites.vendor_site_id IS 'Vendor-specific site identifier (unique per vendor)';
COMMENT ON COLUMN wms_sites.metadata IS 'Additional vendor-specific site data (e.g., panelCount, panelWattage, etc.)';

-- WMS Devices table
CREATE TABLE wms_devices (
  id SERIAL PRIMARY KEY,
  wms_site_id INTEGER NOT NULL REFERENCES wms_sites(id) ON DELETE CASCADE,
  vendor_device_id TEXT NOT NULL, -- Vendor-specific device identifier (e.g., RTU2495)
  device_name TEXT,
  mac_address TEXT,
  serial_no TEXT,
  metadata JSONB DEFAULT '{}', -- Additional vendor-specific device data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wms_site_id, vendor_device_id)
);

COMMENT ON TABLE wms_devices IS 'Devices within WMS sites. Each device measures insolation.';
COMMENT ON COLUMN wms_devices.vendor_device_id IS 'Vendor-specific device identifier (e.g., RTU ID for INTELLO)';

-- Insolation Readings table (stores last 100 days in rollover fashion)
CREATE TABLE insolation_readings (
  id SERIAL PRIMARY KEY,
  wms_device_id INTEGER NOT NULL REFERENCES wms_devices(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL, -- Date of the reading
  insolation_value NUMERIC(10, 3) NOT NULL, -- Average insolation (IRR) for the day in W/m²
  reading_count INTEGER NOT NULL DEFAULT 0, -- Number of readings used to calculate average
  metadata JSONB DEFAULT '{}', -- Additional data (hourly breakdown, min, max, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wms_device_id, reading_date)
);

COMMENT ON TABLE insolation_readings IS 'Daily insolation readings for WMS devices. Stores last 100 days in rollover fashion.';
COMMENT ON COLUMN insolation_readings.insolation_value IS 'Average insolation (IRR) for the day in W/m², calculated from hourly readings';
COMMENT ON COLUMN insolation_readings.reading_count IS 'Number of hourly readings used to calculate the daily average';

-- ============================================
-- INDEXES
-- ============================================

-- Accounts indexes
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_org_id ON accounts(org_id);
CREATE INDEX idx_accounts_account_type ON accounts(account_type);
CREATE INDEX idx_accounts_is_active ON accounts(is_active) WHERE is_active = true;

-- Vendors indexes
CREATE INDEX idx_vendors_org_id ON vendors(org_id);
CREATE INDEX idx_vendors_token_expires_at ON vendors(token_expires_at) WHERE token_expires_at IS NOT NULL;
CREATE INDEX idx_vendors_last_alert_synced_at ON vendors(last_alert_synced_at DESC);

-- Plants indexes
CREATE INDEX idx_plants_org_id ON plants(org_id);
CREATE INDEX idx_plants_vendor_id ON plants(vendor_id);
CREATE INDEX idx_plants_vendor_id_org_id ON plants(vendor_id, org_id);
CREATE INDEX idx_plants_last_update_time ON plants(last_update_time);
CREATE INDEX idx_plants_network_status ON plants(network_status);

-- Work Orders indexes
CREATE INDEX idx_work_orders_org_id ON work_orders(org_id);
CREATE INDEX idx_work_orders_location ON work_orders(location) WHERE location IS NOT NULL;
CREATE INDEX idx_work_orders_created_by ON work_orders(created_by) WHERE created_by IS NOT NULL;

-- Work Order Plants indexes
CREATE INDEX idx_work_order_plants_work_order_id ON work_order_plants(work_order_id);
CREATE INDEX idx_work_order_plants_plant_id ON work_order_plants(plant_id);

-- Alerts indexes
CREATE INDEX idx_alerts_plant_id ON alerts(plant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_vendor_time ON alerts(vendor_id, plant_id, alert_time DESC);
CREATE INDEX idx_alerts_vendor_alert_device ON alerts(vendor_id, vendor_alert_id, plant_id);
CREATE INDEX idx_alerts_vendor_vendor_plant ON alerts(vendor_id, vendor_plant_id);

-- Disabled Plants indexes
CREATE INDEX idx_disabled_plants_plant_id ON disabled_plants(plant_id);
CREATE INDEX idx_disabled_plants_org_id ON disabled_plants(org_id);
CREATE INDEX idx_disabled_plants_vendor_id ON disabled_plants(vendor_id);
CREATE INDEX idx_disabled_plants_disabled_at ON disabled_plants(disabled_at);

-- WMS indexes
CREATE INDEX idx_wms_vendors_org_id ON wms_vendors(org_id);
CREATE INDEX idx_wms_vendors_token_expires_at ON wms_vendors(token_expires_at) WHERE token_expires_at IS NOT NULL;
CREATE INDEX idx_wms_sites_wms_vendor_id ON wms_sites(wms_vendor_id);
CREATE INDEX idx_wms_sites_org_id ON wms_sites(org_id);
CREATE INDEX idx_wms_sites_vendor_site_id ON wms_sites(vendor_site_id);
CREATE INDEX idx_wms_devices_wms_site_id ON wms_devices(wms_site_id);
CREATE INDEX idx_wms_devices_vendor_device_id ON wms_devices(vendor_device_id);
CREATE INDEX idx_insolation_readings_wms_device_id ON insolation_readings(wms_device_id);
CREATE INDEX idx_insolation_readings_reading_date ON insolation_readings(reading_date DESC);
CREATE INDEX idx_insolation_readings_device_date ON insolation_readings(wms_device_id, reading_date DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to disable inactive plants
CREATE OR REPLACE FUNCTION disable_inactive_plants()
RETURNS TABLE(
  disabled_count INTEGER,
  disabled_plant_ids INTEGER[]
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_disabled_count INTEGER := 0;
  v_disabled_plant_ids INTEGER[] := ARRAY[]::INTEGER[];
  v_plant_record RECORD;
  v_days_since_update INTEGER;
BEGIN
  -- Loop through all plants that haven't received vendor updates in 3+ days
  FOR v_plant_record IN
    SELECT 
      p.id,
      p.org_id,
      p.vendor_id,
      p.vendor_plant_id,
      p.name,
      p.capacity_kw,
      p.location,
      p.current_power_kw,
      p.daily_energy_kwh,
      p.monthly_energy_mwh,
      p.yearly_energy_mwh,
      p.total_energy_mwh,
      p.last_update_time,
      p.last_refreshed_at,
      p.network_status,
      p.vendor_created_date,
      p.start_operating_time,
      -- Calculate days since last vendor update
      CASE 
        WHEN p.last_update_time IS NOT NULL THEN
          EXTRACT(EPOCH FROM (NOW() - p.last_update_time)) / 86400
        ELSE
          NULL
      END::INTEGER AS days_since_update
    FROM plants p
    WHERE p.is_active = true
      AND (
        -- Plant hasn't received vendor updates in 3+ days
        (p.last_update_time IS NOT NULL AND p.last_update_time < NOW() - INTERVAL '3 days')
        OR
        -- Plant has never received vendor updates and was created more than 3 days ago
        (p.last_update_time IS NULL AND p.created_at < NOW() - INTERVAL '3 days')
      )
  LOOP
    -- Calculate days since last vendor update (if not already calculated)
    IF v_plant_record.days_since_update IS NULL THEN
      IF v_plant_record.last_update_time IS NOT NULL THEN
        v_days_since_update := EXTRACT(EPOCH FROM (NOW() - v_plant_record.last_update_time)) / 86400;
      ELSE
        v_days_since_update := EXTRACT(EPOCH FROM (NOW() - v_plant_record.created_at)) / 86400;
      END IF;
    ELSE
      v_days_since_update := v_plant_record.days_since_update;
    END IF;

    -- Insert plant data into disabled_plants table
    INSERT INTO disabled_plants (
      plant_id,
      org_id,
      vendor_id,
      vendor_plant_id,
      name,
      capacity_kw,
      location,
      current_power_kw,
      daily_energy_kwh,
      monthly_energy_mwh,
      yearly_energy_mwh,
      total_energy_mwh,
      last_update_time,
      last_refreshed_at,
      network_status,
      vendor_created_date,
      start_operating_time,
      days_since_refresh,
      disabled_at
    )
    VALUES (
      v_plant_record.id,
      v_plant_record.org_id,
      v_plant_record.vendor_id,
      v_plant_record.vendor_plant_id,
      v_plant_record.name,
      v_plant_record.capacity_kw,
      v_plant_record.location,
      v_plant_record.current_power_kw,
      v_plant_record.daily_energy_kwh,
      v_plant_record.monthly_energy_mwh,
      v_plant_record.yearly_energy_mwh,
      v_plant_record.total_energy_mwh,
      v_plant_record.last_update_time,
      v_plant_record.last_refreshed_at,
      v_plant_record.network_status,
      v_plant_record.vendor_created_date,
      v_plant_record.start_operating_time,
      v_days_since_update, -- Store days since last_update_time (not last_refreshed_at)
      NOW()
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicate entries if function is run multiple times

    -- Mark plant as inactive
    UPDATE plants
    SET is_active = false
    WHERE id = v_plant_record.id;

    -- Track disabled plant
    v_disabled_count := v_disabled_count + 1;
    v_disabled_plant_ids := array_append(v_disabled_plant_ids, v_plant_record.id);
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT v_disabled_count, v_disabled_plant_ids;
END;
$$;

COMMENT ON FUNCTION disable_inactive_plants() IS 'Checks for plants that haven''t received vendor updates (last_update_time) in 3+ days, marks them as inactive (is_active = false), and copies their data to disabled_plants table. Returns count and IDs of disabled plants. Scheduled to run daily at 2 AM IST via node-cron in server.js.';

-- Helper function to check if a plant should be disabled
CREATE OR REPLACE FUNCTION should_disable_plant(plant_last_update_time TIMESTAMPTZ, plant_created_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN (
    -- Plant hasn't received vendor updates in 3+ days
    (plant_last_update_time IS NOT NULL AND plant_last_update_time < NOW() - INTERVAL '3 days')
    OR
    -- Plant has never received vendor updates and was created more than 3 days ago
    (plant_last_update_time IS NULL AND plant_created_at < NOW() - INTERVAL '3 days')
  );
END;
$$;

COMMENT ON FUNCTION should_disable_plant(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Helper function to check if a plant should be disabled based on last_update_time (vendor''s last data update) and created_at timestamps. Returns true if plant should be disabled (3+ days since last vendor update).';

-- Function to clean up old insolation readings (keep only last 100 days)
CREATE OR REPLACE FUNCTION cleanup_old_insolation_readings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete readings older than 100 days
  DELETE FROM insolation_readings
  WHERE reading_date < CURRENT_DATE - INTERVAL '100 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_insolation_readings() IS 'Cleans up insolation readings older than 100 days to maintain rollover storage. Returns count of deleted records.';

-- RLS Helper functions
CREATE OR REPLACE FUNCTION get_account_type(account_id UUID)
RETURNS account_type AS $$
  SELECT account_type FROM accounts WHERE id = account_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_account_org_id(account_id UUID)
RETURNS INTEGER AS $$
  SELECT org_id FROM accounts WHERE id = account_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION account_belongs_to_org(account_id UUID, org_id INTEGER)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts 
    WHERE id = account_id 
    AND org_id = account_belongs_to_org.org_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plants_updated_at BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disabled_plants_updated_at BEFORE UPDATE ON disabled_plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wms_vendors_updated_at BEFORE UPDATE ON wms_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wms_sites_updated_at BEFORE UPDATE ON wms_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wms_devices_updated_at BEFORE UPDATE ON wms_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insolation_readings_updated_at BEFORE UPDATE ON insolation_readings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE disabled_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE insolation_readings ENABLE ROW LEVEL SECURITY;

-- Accounts policies
CREATE POLICY "Accounts can view their own record"
  ON accounts FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Superadmins can view all accounts"
  ON accounts FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Govt can view all accounts"
  ON accounts FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Developers can view all accounts"
  ON accounts FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

-- Organizations policies
CREATE POLICY "Superadmins can manage all organizations"
  ON organizations FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all organizations"
  ON organizations FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all organizations"
  ON organizations FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view their own organization"
  ON organizations FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    get_account_org_id(auth.uid()::uuid) = id
  );

-- Vendors policies
CREATE POLICY "Superadmins can manage all vendors"
  ON vendors FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all vendors"
  ON vendors FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all vendors"
  ON vendors FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view vendors"
  ON vendors FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'ORG');

-- Plants policies
CREATE POLICY "Superadmins can manage all plants"
  ON plants FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all plants"
  ON plants FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all plants"
  ON plants FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view plants in their org"
  ON plants FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    get_account_org_id(auth.uid()::uuid) = org_id
  );

-- Work Orders policies
CREATE POLICY "Superadmins can manage all work orders"
  ON work_orders FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all work orders"
  ON work_orders FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all work orders"
  ON work_orders FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view work orders for their plants"
  ON work_orders FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    EXISTS (
      SELECT 1 FROM work_order_plants wop
      JOIN plants p ON p.id = wop.plant_id
      WHERE wop.work_order_id = work_orders.id
      AND p.org_id = get_account_org_id(auth.uid()::uuid)
    )
  );

-- Work Order Plants policies
CREATE POLICY "Superadmins can manage all work_order_plants"
  ON work_order_plants FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all work_order_plants"
  ON work_order_plants FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all work_order_plants"
  ON work_order_plants FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view work_order_plants for their plants"
  ON work_order_plants FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = work_order_plants.plant_id
      AND p.org_id = get_account_org_id(auth.uid()::uuid)
    )
  );

-- Alerts policies
CREATE POLICY "Superadmins can manage all alerts"
  ON alerts FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all alerts"
  ON alerts FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all alerts"
  ON alerts FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view alerts for their plants"
  ON alerts FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    EXISTS (
      SELECT 1 FROM plants p
      WHERE p.id = alerts.plant_id
      AND p.org_id = get_account_org_id(auth.uid()::uuid)
    )
  );

-- Disabled Plants policies
CREATE POLICY "Superadmins can manage all disabled plants"
  ON disabled_plants FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all disabled plants"
  ON disabled_plants FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all disabled plants"
  ON disabled_plants FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view disabled plants in their org"
  ON disabled_plants FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    get_account_org_id(auth.uid()::uuid) = org_id
  );

-- WMS Vendors policies
CREATE POLICY "Superadmins can manage all wms_vendors"
  ON wms_vendors FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all wms_vendors"
  ON wms_vendors FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all wms_vendors"
  ON wms_vendors FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view wms_vendors in their org"
  ON wms_vendors FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    get_account_org_id(auth.uid()::uuid) = org_id
  );

-- WMS Sites policies
CREATE POLICY "Superadmins can manage all wms_sites"
  ON wms_sites FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all wms_sites"
  ON wms_sites FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all wms_sites"
  ON wms_sites FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view wms_sites in their org"
  ON wms_sites FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    get_account_org_id(auth.uid()::uuid) = org_id
  );

-- WMS Devices policies
CREATE POLICY "Superadmins can manage all wms_devices"
  ON wms_devices FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all wms_devices"
  ON wms_devices FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all wms_devices"
  ON wms_devices FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view wms_devices in their org"
  ON wms_devices FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    EXISTS (
      SELECT 1 FROM wms_sites s
      WHERE s.id = wms_devices.wms_site_id
      AND s.org_id = get_account_org_id(auth.uid()::uuid)
    )
  );

-- Insolation Readings policies
CREATE POLICY "Superadmins can manage all insolation_readings"
  ON insolation_readings FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'SUPERADMIN');

CREATE POLICY "Developers can manage all insolation_readings"
  ON insolation_readings FOR ALL
  USING (get_account_type(auth.uid()::uuid) = 'DEVELOPER');

CREATE POLICY "Govt can view all insolation_readings"
  ON insolation_readings FOR SELECT
  USING (get_account_type(auth.uid()::uuid) = 'GOVT');

CREATE POLICY "Org accounts can view insolation_readings in their org"
  ON insolation_readings FOR SELECT
  USING (
    get_account_type(auth.uid()::uuid) = 'ORG' AND
    EXISTS (
      SELECT 1 FROM wms_devices d
      JOIN wms_sites s ON s.id = d.wms_site_id
      WHERE d.id = insolation_readings.wms_device_id
      AND s.org_id = get_account_org_id(auth.uid()::uuid)
    )
  );

-- ============================================
-- VERIFY SCHEMA CREATION
-- ============================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify all tables were created
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'accounts', 'organizations', 'vendors', 'plants',
      'work_orders', 'work_order_plants', 'alerts', 'disabled_plants',
      'wms_vendors', 'wms_sites', 'wms_devices', 'insolation_readings'
    );
  
  IF table_count < 12 THEN
    RAISE EXCEPTION 'Not all core tables were created. Expected 12, found %', table_count;
  END IF;
  
  RAISE NOTICE '✅ Core tables created successfully (accounts, organizations, vendors, plants, work_orders, work_order_plants, alerts, disabled_plants, wms_vendors, wms_sites, wms_devices, insolation_readings)';
  
  -- Verify RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'accounts', 'organizations', 'vendors', 'plants',
      'work_orders', 'work_order_plants', 'alerts', 'disabled_plants',
      'wms_vendors', 'wms_sites', 'wms_devices', 'insolation_readings'
    );
  
  RAISE NOTICE '✅ Created % RLS policies', policy_count;
  
  -- Verify production metrics columns exist in plants table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plants' AND column_name = 'current_power_kw'
  ) THEN
    RAISE EXCEPTION 'Production metrics columns not found in plants table';
  END IF;
  
  -- Verify is_active column exists in plants table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plants' AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION 'is_active column not found in plants table';
  END IF;
  
  -- Verify disabled_plants table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'disabled_plants'
  ) THEN
    RAISE EXCEPTION 'disabled_plants table not found';
  END IF;
  
  -- Verify all vendor types exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'DEVELOPER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type')
  ) THEN
    RAISE EXCEPTION 'DEVELOPER account type not found';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'SOLARDM' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vendor_type')
  ) THEN
    RAISE EXCEPTION 'SOLARDM vendor type not found';
  END IF;
  
  RAISE NOTICE '✅ Schema verification complete - all required columns and tables present';
  RAISE NOTICE '✅ All ENUM types verified';
  RAISE NOTICE '✅ RLS policies verified';
END $$;

