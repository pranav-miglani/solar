-- Adds grid downtime readings table to the analytics database
-- and mirrors plant capacity for runtime benefit calculations.

-- Add capacity to analytics plants mirror
ALTER TABLE plants
ADD COLUMN IF NOT EXISTS capacity_kw NUMERIC(10, 2);

-- Create grid downtime readings table (analytics DB)
CREATE TABLE IF NOT EXISTS plant_grid_downtime_readings (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  plant_id INTEGER NOT NULL,
  vendor_plant_id TEXT NOT NULL,
  reading_date DATE NOT NULL,

  -- Daily counters (seconds)
  daily_grid_down_seconds INTEGER NOT NULL DEFAULT 0,

  -- Total counters (seconds, monotonically increasing; can be NULL while pending recompute)
  total_grid_down_seconds INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (plant_id, reading_date)
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_pgdr_plant_date ON plant_grid_downtime_readings(plant_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pgdr_vendor_date ON plant_grid_downtime_readings(vendor_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pgdr_org_date ON plant_grid_downtime_readings(org_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pgdr_date ON plant_grid_downtime_readings(reading_date DESC);

-- Foreign keys (analytics schema mirrors main IDs)
ALTER TABLE plant_grid_downtime_readings
  ADD CONSTRAINT fk_pgdr_org_id FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE plant_grid_downtime_readings
  ADD CONSTRAINT fk_pgdr_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

ALTER TABLE plant_grid_downtime_readings
  ADD CONSTRAINT fk_pgdr_plant_id FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;

-- Cleanup function to keep 100-day rolling window
CREATE OR REPLACE FUNCTION cleanup_old_grid_downtime_readings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM plant_grid_downtime_readings
  WHERE reading_date < CURRENT_DATE - INTERVAL '100 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_grid_downtime_readings() IS 'Deletes plant_grid_downtime_readings older than 100 days to maintain rolling retention.';

-- updated_at trigger (reuses existing function if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pgdr_updated_at'
  ) THEN
    CREATE TRIGGER trg_pgdr_updated_at
    BEFORE UPDATE ON plant_grid_downtime_readings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

