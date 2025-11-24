-- ============================================
-- INITIAL ALERT SCHEMA
-- ============================================
-- This file contains the complete alert-related database schema
-- as a standalone module.
--
-- For a fresh installation:
--   1. Apply 001_initial_schema.sql (core tables)
--   2. Apply 001_alert_schema.sql (alerts)
--
-- ============================================

-- Enable UUID extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure required ENUM types exist (safe if already created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'alert_severity'
  ) THEN
    CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'alert_status'
  ) THEN
    CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');
  END IF;
END $$;

-- ============================================
-- ALERTS TABLE
-- ============================================
-- This block handles both fresh installs (no alerts table yet)
-- and upgrades (existing alerts table missing some columns).

-- Create table if it does not exist
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_alert_id TEXT, -- Original alert ID from vendor
  vendor_plant_id TEXT, -- Vendor-specific plant/station identifier (e.g., Solarman stationId as string)
  station_id BIGINT, -- Station ID from vendor (numeric form, if applicable)
  device_type TEXT, -- Device type from vendor (e.g., INVERTER). For Solarman we persist only INVERTER alerts.
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

-- Ensure all expected columns exist on existing alerts table
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vendor_alert_id TEXT,
  ADD COLUMN IF NOT EXISTS vendor_plant_id TEXT,
  ADD COLUMN IF NOT EXISTS station_id BIGINT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS alert_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grid_down_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS grid_down_benefit_kwh NUMERIC(12,3);

COMMENT ON COLUMN alerts.vendor_id IS 'Vendor that generated this alert (helps disambiguate vendor_alert_id across vendors).';
COMMENT ON COLUMN alerts.vendor_plant_id IS 'Vendor-specific plant/station identifier (e.g., Solarman stationId as string).';
COMMENT ON COLUMN alerts.station_id IS 'Vendor-specific station/plant identifier (numeric form, if applicable).';
COMMENT ON COLUMN alerts.device_type IS 'Vendor-specific device type (e.g., INVERTER). For Solarman alerts we only persist INVERTER alerts.';
COMMENT ON COLUMN alerts.alert_time IS 'Timestamp when the alert started (converted from vendor-specific epoch/format).';
COMMENT ON COLUMN alerts.end_time IS 'Timestamp when the alert ended / was cleared (if provided by vendor).';
COMMENT ON COLUMN alerts.grid_down_seconds IS 'Computed grid downtime in seconds for this alert: max(0, end_time - alert_time) when both are present.';
COMMENT ON COLUMN alerts.grid_down_benefit_kwh IS 'Calculated downtime benefit energy in kWh: 0.5 × (hours overlapping 9:00-16:00 local window) × installed capacity (kW).';

-- ============================================
-- ALERT INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_alerts_plant_id ON alerts(plant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_vendor_time ON alerts(vendor_id, plant_id, alert_time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_vendor_alert_device ON alerts(vendor_id, vendor_alert_id, plant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_vendor_vendor_plant ON alerts(vendor_id, vendor_plant_id);


