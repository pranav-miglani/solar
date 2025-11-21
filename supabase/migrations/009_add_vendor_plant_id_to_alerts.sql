-- Add vendor_plant_id column to alerts table
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS vendor_plant_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alerts_vendor_plant_id ON alerts(vendor_plant_id);
