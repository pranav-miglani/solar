-- Migration: Add was_online_today column to plants table for daily online status tracking
-- This column tracks if a plant was online (network_status = "NORMAL") during the current day (IST)
-- Reset function is called daily to reset the flag for the next day

-- Add was_online_today column
ALTER TABLE plants 
ADD COLUMN IF NOT EXISTS was_online_today BOOLEAN NOT NULL DEFAULT FALSE;

-- Note: No index needed - statistics are derived from analytics DB.
-- The reset function (UPDATE ... WHERE was_online_today = TRUE) runs infrequently (daily),
-- so a full table scan is acceptable for this operation.

COMMENT ON COLUMN plants.was_online_today IS 'True if plant was online (network_status = "NORMAL") at any point during the current day (IST). Reset to false daily at start of day via reset_was_online_today() function.';

-- Function to reset was_online_today flag for all plants
-- This should be called daily (via cron or during analytics snapshot) at start of day IST
CREATE OR REPLACE FUNCTION reset_was_online_today()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset was_online_today to false for all plants
  UPDATE plants
  SET was_online_today = FALSE
  WHERE was_online_today = TRUE;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;

COMMENT ON FUNCTION reset_was_online_today() IS 'Resets was_online_today flag to false for all plants. Should be called daily at start of day (IST) via cron job or during analytics snapshot.';

