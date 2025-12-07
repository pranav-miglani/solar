-- ============================================
-- ADD SCADA WMS VENDOR TYPE
-- ============================================
-- This migration adds SCADA as a new WMS vendor type

-- Add SCADA to the wms_vendor_type enum
ALTER TYPE wms_vendor_type ADD VALUE IF NOT EXISTS 'SCADA';

COMMENT ON TYPE wms_vendor_type IS 'WMS vendor types: INTELLO, SCADA';

