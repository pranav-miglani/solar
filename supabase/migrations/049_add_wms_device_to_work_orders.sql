-- ============================================
-- ADD WMS DEVICE TO WORK ORDERS
-- ============================================
-- This migration adds wms_device_id to work_orders table
-- Allows associating a WMS device with each work order
-- Only SUPERADMIN/DEVELOPER can assign WMS devices
-- ============================================

-- Add wms_device_id column to work_orders table
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS wms_device_id INTEGER NULL REFERENCES wms_devices(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_work_orders_wms_device_id ON work_orders(wms_device_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN work_orders.wms_device_id IS 'Optional WMS device assigned to this work order. Only SUPERADMIN/DEVELOPER can assign. Device must belong to same organization as work order.';

