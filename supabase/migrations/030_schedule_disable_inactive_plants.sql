-- ============================================
-- SCHEDULE DISABLE INACTIVE PLANTS FUNCTION
-- ============================================
-- This migration adds a comment to the disable_inactive_plants() function
-- The function is automatically scheduled via node-cron in server.js
-- Runs daily at 2 AM IST (8:30 PM UTC previous day)

-- Add comment
COMMENT ON FUNCTION disable_inactive_plants() IS 'Checks for plants that haven''t received vendor updates (last_update_time) in 3+ days, marks them as inactive (is_active = false), and copies their data to disabled_plants table. Returns count and IDs of disabled plants. Scheduled to run daily at 2 AM IST via node-cron in server.js.';

