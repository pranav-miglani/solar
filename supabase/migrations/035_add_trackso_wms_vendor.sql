-- ============================================
-- ADD TRACKSO WMS VENDOR TYPE
-- ============================================
-- Adds TRACKSO to the wms_vendor_type enum

-- Add TRACKSO to the wms_vendor_type enum
ALTER TYPE wms_vendor_type ADD VALUE IF NOT EXISTS 'TRACKSO';

COMMENT ON TYPE wms_vendor_type IS 'WMS vendor types: INTELLO, SCADA, TRACKSO';

