-- ============================================
-- FUNCTION TO DISABLE INACTIVE PLANTS
-- ============================================
-- This function checks plants that haven't been refreshed in 15+ days,
-- marks them as inactive, and copies their data to disabled_plants table.

CREATE OR REPLACE FUNCTION disable_inactive_plants()
RETURNS TABLE(
  disabled_count INTEGER,
  disabled_plant_ids INTEGER[]
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_disabled_count INTEGER := 0;
  v_disabled_plant_ids INTEGER[] := ARRAY[]::INTEGER[];
  v_plant_record RECORD;
  v_days_since_refresh INTEGER;
BEGIN
  -- Loop through all plants that haven't been refreshed in 15+ days
  FOR v_plant_record IN
    SELECT 
      p.id,
      p.org_id,
      p.vendor_id,
      p.vendor_plant_id,
      p.name,
      p.capacity_kw,
      p.location,
      p.current_power_kw,
      p.daily_energy_kwh,
      p.monthly_energy_mwh,
      p.yearly_energy_mwh,
      p.total_energy_mwh,
      p.last_update_time,
      p.last_refreshed_at,
      p.network_status,
      p.vendor_created_date,
      p.start_operating_time,
      -- Calculate days since last refresh
      CASE 
        WHEN p.last_refreshed_at IS NOT NULL THEN
          EXTRACT(EPOCH FROM (NOW() - p.last_refreshed_at)) / 86400
        ELSE
          NULL
      END::INTEGER AS days_since_refresh
    FROM plants p
    WHERE p.is_active = true
      AND (
        -- Plant hasn't been refreshed in 15+ days
        (p.last_refreshed_at IS NOT NULL AND p.last_refreshed_at < NOW() - INTERVAL '15 days')
        OR
        -- Plant has never been refreshed and was created more than 15 days ago
        (p.last_refreshed_at IS NULL AND p.created_at < NOW() - INTERVAL '15 days')
      )
  LOOP
    -- Calculate days since refresh (if not already calculated)
    IF v_plant_record.days_since_refresh IS NULL THEN
      IF v_plant_record.last_refreshed_at IS NOT NULL THEN
        v_days_since_refresh := EXTRACT(EPOCH FROM (NOW() - v_plant_record.last_refreshed_at)) / 86400;
      ELSE
        v_days_since_refresh := EXTRACT(EPOCH FROM (NOW() - v_plant_record.created_at)) / 86400;
      END IF;
    ELSE
      v_days_since_refresh := v_plant_record.days_since_refresh;
    END IF;

    -- Insert plant data into disabled_plants table
    INSERT INTO disabled_plants (
      plant_id,
      org_id,
      vendor_id,
      vendor_plant_id,
      name,
      capacity_kw,
      location,
      current_power_kw,
      daily_energy_kwh,
      monthly_energy_mwh,
      yearly_energy_mwh,
      total_energy_mwh,
      last_update_time,
      last_refreshed_at,
      network_status,
      vendor_created_date,
      start_operating_time,
      days_since_refresh,
      disabled_at
    )
    VALUES (
      v_plant_record.id,
      v_plant_record.org_id,
      v_plant_record.vendor_id,
      v_plant_record.vendor_plant_id,
      v_plant_record.name,
      v_plant_record.capacity_kw,
      v_plant_record.location,
      v_plant_record.current_power_kw,
      v_plant_record.daily_energy_kwh,
      v_plant_record.monthly_energy_mwh,
      v_plant_record.yearly_energy_mwh,
      v_plant_record.total_energy_mwh,
      v_plant_record.last_update_time,
      v_plant_record.last_refreshed_at,
      v_plant_record.network_status,
      v_plant_record.vendor_created_date,
      v_plant_record.start_operating_time,
      v_days_since_refresh,
      NOW()
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicate entries if function is run multiple times

    -- Mark plant as inactive
    UPDATE plants
    SET is_active = false
    WHERE id = v_plant_record.id;

    -- Track disabled plant
    v_disabled_count := v_disabled_count + 1;
    v_disabled_plant_ids := array_append(v_disabled_plant_ids, v_plant_record.id);
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT v_disabled_count, v_disabled_plant_ids;
END;
$$;

-- Add comment for the function
COMMENT ON FUNCTION disable_inactive_plants() IS 'Checks for plants that haven''t been refreshed in 15+ days, marks them as inactive (is_active = false), and copies their data to disabled_plants table. Returns count and IDs of disabled plants.';

-- Create a helper function to check if a plant should be disabled (for use in queries)
CREATE OR REPLACE FUNCTION should_disable_plant(plant_last_refreshed_at TIMESTAMPTZ, plant_created_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN (
    -- Plant hasn't been refreshed in 15+ days
    (plant_last_refreshed_at IS NOT NULL AND plant_last_refreshed_at < NOW() - INTERVAL '15 days')
    OR
    -- Plant has never been refreshed and was created more than 15 days ago
    (plant_last_refreshed_at IS NULL AND plant_created_at < NOW() - INTERVAL '15 days')
  );
END;
$$;

COMMENT ON FUNCTION should_disable_plant(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Helper function to check if a plant should be disabled based on last_refreshed_at and created_at timestamps. Returns true if plant should be disabled (15+ days since last refresh).';

