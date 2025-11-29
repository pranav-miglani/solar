-- ============================================
-- DROP PERFORMANCE RATIO COLUMN
-- ============================================
-- This migration removes the performance_ratio column from the plants table
-- and all related calculations and UI references.

-- Drop the performance_ratio column from plants table
ALTER TABLE plants DROP COLUMN IF EXISTS performance_ratio;

-- Drop the comment if it exists
COMMENT ON COLUMN plants.performance_ratio IS NULL;

