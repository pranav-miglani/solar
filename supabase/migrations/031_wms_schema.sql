-- ============================================
-- WEATHER MONITORING SYSTEM (WMS) SCHEMA
-- ============================================
-- This migration creates the schema for Weather Monitoring System (WMS)
-- WMS vendors are separate from inverter vendors and manage sites/devices for insolation data
--
-- Key features:
-- - WMS vendors mapped to organizations
-- - Sites contain multiple devices
-- - Insolation readings stored for last 100 days (rollover)
-- - Similar authentication structure to inverter vendors
-- ============================================

-- Create WMS vendor type enum (separate from inverter vendor types)
CREATE TYPE wms_vendor_type AS ENUM ('INTELLO');

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

-- Indexes for performance
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

-- Updated_at trigger for WMS tables
CREATE TRIGGER update_wms_vendors_updated_at BEFORE UPDATE ON wms_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wms_sites_updated_at BEFORE UPDATE ON wms_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wms_devices_updated_at BEFORE UPDATE ON wms_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insolation_readings_updated_at BEFORE UPDATE ON insolation_readings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

