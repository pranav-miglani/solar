-- ============================================
-- CONSOLIDATED UPGRADE SCRIPT
-- ============================================
-- This script is for EXISTING databases that were created before these features were added.
-- For fresh installs, use 001_initial_schema.sql which already includes all these changes.
--
-- This script combines:
-- - Migration 006: Add org_id to vendors
-- - Migration 007: Add production metrics to plants
-- - Upgrade: Add org_id to work_orders
--
-- Run this script if you encounter errors about missing columns.

-- ============================================
-- PART 1: Add org_id to vendors table
-- ============================================
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vendors_org_id ON vendors(org_id);

COMMENT ON COLUMN vendors.org_id IS 'Organization this vendor belongs to. NULL means vendor is global/shared.';

-- ============================================
-- PART 2: Add production metrics to plants table
-- ============================================
ALTER TABLE plants 
ADD COLUMN IF NOT EXISTS current_power_kw NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS daily_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS monthly_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS yearly_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS total_energy_mwh NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS performance_ratio NUMERIC(5, 4),
ADD COLUMN IF NOT EXISTS last_update_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_plants_last_update_time ON plants(last_update_time);
CREATE INDEX IF NOT EXISTS idx_plants_vendor_id_org_id ON plants(vendor_id, org_id);

COMMENT ON COLUMN plants.current_power_kw IS 'Current generation power in kW (shown in Production Overview)';
COMMENT ON COLUMN plants.daily_energy_mwh IS 'Daily energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.monthly_energy_mwh IS 'Monthly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.yearly_energy_mwh IS 'Yearly energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.total_energy_mwh IS 'Total cumulative energy generation in MWh (shown in Production Overview)';
COMMENT ON COLUMN plants.performance_ratio IS 'Performance Ratio (PR) 0-1 range, displayed as percentage in circular indicator';
COMMENT ON COLUMN plants.last_update_time IS 'Last time production data was updated from vendor (shown as "Updated" timestamp)';

-- ============================================
-- PART 3: Add org_id to work_orders table
-- ============================================
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_work_orders_org_id ON work_orders(org_id);

-- Update existing work orders to set org_id based on their plants
UPDATE work_orders wo
SET org_id = (
  SELECT p.org_id
  FROM work_order_plants wop
  JOIN plants p ON p.id = wop.plant_id
  WHERE wop.work_order_id = wo.id
  LIMIT 1
)
WHERE wo.org_id IS NULL;

-- Delete any work orders that don't have plants (orphaned work orders)
DELETE FROM work_orders
WHERE org_id IS NULL;

-- Make org_id NOT NULL after cleaning up orphaned records
ALTER TABLE work_orders 
ALTER COLUMN org_id SET NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  -- Verify vendors.org_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'Failed to add org_id column to vendors table';
  END IF;
  
  -- Verify plants production metrics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plants' AND column_name = 'current_power_kw'
  ) THEN
    RAISE EXCEPTION 'Failed to add production metrics columns to plants table';
  END IF;
  
  -- Verify work_orders.org_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'Failed to add org_id column to work_orders table';
  END IF;
  
  RAISE NOTICE '✅ Successfully added org_id to vendors table';
  RAISE NOTICE '✅ Successfully added production metrics to plants table';
  RAISE NOTICE '✅ Successfully added org_id to work_orders table';
  RAISE NOTICE '✅ All upgrades completed successfully';
END $$;

