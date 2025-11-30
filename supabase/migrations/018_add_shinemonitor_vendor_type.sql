-- ============================================
-- ADD SHINEMONITOR VENDOR TYPE
-- ============================================
-- This migration adds 'SHINEMONITOR' to the vendor_type ENUM

-- Add SHINEMONITOR to vendor_type ENUM
ALTER TYPE vendor_type ADD VALUE IF NOT EXISTS 'SHINEMONITOR';

