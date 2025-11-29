-- ============================================
-- ADD SOLARDM VENDOR TYPE
-- ============================================
-- This migration adds SOLARDM to the vendor_type ENUM

-- Add SOLARDM to vendor_type ENUM
ALTER TYPE vendor_type ADD VALUE IF NOT EXISTS 'SOLARDM';

