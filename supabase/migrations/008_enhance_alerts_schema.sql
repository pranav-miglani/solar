-- Add new columns to alerts table
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS alert_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS device_sn TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT;

-- Add metadata column to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
