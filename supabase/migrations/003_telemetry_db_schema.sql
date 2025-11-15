-- ============================================
-- TELEMETRY DATABASE SCHEMA (Separate Supabase Instance)
-- ============================================
-- This schema is for a separate Supabase project dedicated to telemetry
-- with 24-hour retention policy
-- Run this in your TELEMETRY database project (separate from main DB)

-- ============================================
-- DROP EXISTING SCHEMA (CLEAN SLATE)
-- ============================================

-- Drop existing indexes
DROP INDEX IF EXISTS idx_telemetry_wo_ts;
DROP INDEX IF EXISTS idx_telemetry_org_ts;
DROP INDEX IF EXISTS idx_telemetry_plant_ts;
DROP INDEX IF EXISTS idx_telemetry_ts;
DROP INDEX IF EXISTS idx_telemetry_work_order_id;
DROP INDEX IF EXISTS idx_telemetry_org_id;
DROP INDEX IF EXISTS idx_telemetry_plant_id;

-- Drop existing table
DROP TABLE IF EXISTS telemetry_readings CASCADE;

-- Drop existing function
DROP FUNCTION IF EXISTS cleanup_old_telemetry() CASCADE;

-- ============================================
-- CREATE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Telemetry readings table (24h retention)
CREATE TABLE telemetry_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id INTEGER NOT NULL, -- Reference to main DB plant.id (not FK to keep DBs separate)
  org_id INTEGER NOT NULL, -- Denormalized for faster queries
  work_order_id INTEGER, -- Optional: if plant is in a work order
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_power_kw NUMERIC(10, 2),
  voltage NUMERIC(10, 2),
  current NUMERIC(10, 2),
  temperature NUMERIC(5, 2),
  irradiance NUMERIC(8, 2),
  efficiency_pct NUMERIC(5, 2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_telemetry_plant_id ON telemetry_readings(plant_id);
CREATE INDEX idx_telemetry_org_id ON telemetry_readings(org_id);
CREATE INDEX idx_telemetry_work_order_id ON telemetry_readings(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX idx_telemetry_ts ON telemetry_readings(ts);
CREATE INDEX idx_telemetry_plant_ts ON telemetry_readings(plant_id, ts DESC);

-- Composite index for common query patterns
CREATE INDEX idx_telemetry_org_ts ON telemetry_readings(org_id, ts DESC);
CREATE INDEX idx_telemetry_wo_ts ON telemetry_readings(work_order_id, ts DESC) WHERE work_order_id IS NOT NULL;

-- Function to automatically delete data older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_telemetry()
RETURNS void AS $$
BEGIN
  DELETE FROM telemetry_readings
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFY SCHEMA CREATION
-- ============================================
DO $$
DECLARE
  table_exists BOOLEAN;
  index_count INTEGER;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'telemetry_readings'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'telemetry_readings table was not created';
  END IF;
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'telemetry_readings';
  
  RAISE NOTICE '✅ Telemetry schema created successfully';
  RAISE NOTICE '   Table: telemetry_readings exists';
  RAISE NOTICE '   Indexes: % created', index_count;
END $$;

-- Create a scheduled job (requires pg_cron extension)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-telemetry', '0 * * * *', 'SELECT cleanup_old_telemetry()');

-- Alternative: Use a trigger-based approach with a cleanup function
-- that can be called by Edge Functions or scheduled tasks

-- Partitioning by time (optional, for better performance with large datasets)
-- Uncomment if needed:
-- CREATE TABLE telemetry_readings_partitioned (
--   LIKE telemetry_readings INCLUDING ALL
-- ) PARTITION BY RANGE (ts);
--
-- CREATE TABLE telemetry_readings_hourly PARTITION OF telemetry_readings_partitioned
--   FOR VALUES FROM (NOW() - INTERVAL '1 hour') TO (NOW());

