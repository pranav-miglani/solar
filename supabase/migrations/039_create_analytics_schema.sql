-- Analytics Database Schema (separate Supabase project)
-- Stores daily energy snapshots for analytics with 100-day retention

-- Organizations mirror (store full config as JSON to avoid drift)
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY,
  name TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_hash TEXT,
  config_ready BOOLEAN DEFAULT FALSE,
  config_last_run_at TIMESTAMPTZ,
  config_last_status TEXT,
  config_last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendors mirror (store full config as JSON to avoid drift)
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT,
  vendor_type TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_hash TEXT,
  config_ready BOOLEAN DEFAULT FALSE,
  config_last_run_at TIMESTAMPTZ,
  config_last_status TEXT,
  config_last_error TEXT,
  analytics_ready BOOLEAN DEFAULT FALSE, -- set when config mirror succeeds
  analytics_last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_org_id ON vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);

-- Plants mirror (stores plant metadata for analytics)
CREATE TABLE IF NOT EXISTS plants (
  id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  vendor_plant_id TEXT NOT NULL,
  plant_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, vendor_plant_id)
);

CREATE INDEX IF NOT EXISTS idx_plants_org_id ON plants(org_id);
CREATE INDEX IF NOT EXISTS idx_plants_vendor_id ON plants(vendor_id);
CREATE INDEX IF NOT EXISTS idx_plants_vendor_plant_id ON plants(vendor_plant_id);

-- Snapshot run tracking
CREATE TABLE IF NOT EXISTS analytics_snapshot_runs (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- 'running', 'success', 'error'
  error_message TEXT,
  plants_processed INTEGER DEFAULT 0,
  rows_upserted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_runs_vendor_id ON analytics_snapshot_runs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_runs_started_at ON analytics_snapshot_runs(started_at DESC);

-- Daily energy snapshots per plant (100-day rolling window maintained via cleanup function)
CREATE TABLE IF NOT EXISTS plant_energy_readings (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  plant_id INTEGER NOT NULL,
  vendor_plant_id TEXT NOT NULL,
  reading_date DATE NOT NULL,
  daily_energy_kwh NUMERIC(12,3),
  monthly_energy_kwh NUMERIC(12,3),
  yearly_energy_mwh NUMERIC(14,3),
  total_energy_mwh NUMERIC(14,3),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plant_id, reading_date)
);

CREATE INDEX IF NOT EXISTS idx_plant_energy_readings_plant_date ON plant_energy_readings(plant_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_plant_energy_readings_date ON plant_energy_readings(reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_plant_energy_readings_vendor_date ON plant_energy_readings(vendor_id, reading_date DESC);

-- Cleanup function to enforce 100-day retention
CREATE OR REPLACE FUNCTION cleanup_old_plant_energy_readings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM plant_energy_readings
  WHERE reading_date < CURRENT_DATE - INTERVAL '100 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_plant_energy_readings() IS 'Deletes plant_energy_readings older than 100 days to maintain rolling retention.';

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_plant_energy_updated_at BEFORE UPDATE ON plant_energy_readings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_plants_updated_at BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

-- Vendors -> Organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_vendors_org_id' 
    AND conrelid = 'vendors'::regclass
  ) THEN
    ALTER TABLE vendors
      ADD CONSTRAINT fk_vendors_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Plants -> Organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_plants_org_id' 
    AND conrelid = 'plants'::regclass
  ) THEN
    ALTER TABLE plants
      ADD CONSTRAINT fk_plants_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Plants -> Vendors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_plants_vendor_id' 
    AND conrelid = 'plants'::regclass
  ) THEN
    ALTER TABLE plants
      ADD CONSTRAINT fk_plants_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Analytics Snapshot Runs -> Vendors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_snapshot_runs_vendor_id' 
    AND conrelid = 'analytics_snapshot_runs'::regclass
  ) THEN
    ALTER TABLE analytics_snapshot_runs
      ADD CONSTRAINT fk_snapshot_runs_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Plant Energy Readings -> Organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_plant_energy_readings_org_id' 
    AND conrelid = 'plant_energy_readings'::regclass
  ) THEN
    ALTER TABLE plant_energy_readings
      ADD CONSTRAINT fk_plant_energy_readings_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Plant Energy Readings -> Vendors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_plant_energy_readings_vendor_id' 
    AND conrelid = 'plant_energy_readings'::regclass
  ) THEN
    ALTER TABLE plant_energy_readings
      ADD CONSTRAINT fk_plant_energy_readings_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Plant Energy Readings -> Plants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_plant_energy_readings_plant_id' 
    AND conrelid = 'plant_energy_readings'::regclass
  ) THEN
    ALTER TABLE plant_energy_readings
      ADD CONSTRAINT fk_plant_energy_readings_plant_id
      FOREIGN KEY (plant_id) REFERENCES plants(id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON CONSTRAINT fk_vendors_org_id ON vendors IS 'Foreign key to organizations table. Cascades deletes.';
COMMENT ON CONSTRAINT fk_plants_org_id ON plants IS 'Foreign key to organizations table. Cascades deletes.';
COMMENT ON CONSTRAINT fk_plants_vendor_id ON plants IS 'Foreign key to vendors table. Cascades deletes.';
COMMENT ON CONSTRAINT fk_snapshot_runs_vendor_id ON analytics_snapshot_runs IS 'Foreign key to vendors table. Cascades deletes.';
COMMENT ON CONSTRAINT fk_plant_energy_readings_org_id ON plant_energy_readings IS 'Foreign key to organizations table. Cascades deletes.';
COMMENT ON CONSTRAINT fk_plant_energy_readings_vendor_id ON plant_energy_readings IS 'Foreign key to vendors table. Cascades deletes.';
COMMENT ON CONSTRAINT fk_plant_energy_readings_plant_id ON plant_energy_readings IS 'Foreign key to plants table. Cascades deletes.';

