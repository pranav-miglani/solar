-- Add location field to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add index for location if needed for searches
CREATE INDEX IF NOT EXISTS idx_work_orders_location ON work_orders(location);

COMMENT ON COLUMN work_orders.location IS 'Physical location of the work order';

