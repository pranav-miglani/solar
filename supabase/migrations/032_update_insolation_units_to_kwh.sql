-- ============================================
-- UPDATE INSOLATION UNITS FROM W/m² TO kWh/m²
-- ============================================
-- This migration updates the column comments to reflect that insolation_value
-- is now stored in kWh/m² (energy) instead of W/m² (power).
-- The calculation method changed from simple average to area under curve (integral).

-- Update column comment for insolation_value
COMMENT ON COLUMN insolation_readings.insolation_value IS 'Daily insolation (energy) in kWh/m², calculated as area under IRR vs time curve using left endpoint method: Σ [IRR_i × Δt_i] / 1000';

-- Update column comment for reading_count
COMMENT ON COLUMN insolation_readings.reading_count IS 'Number of time-series readings used to calculate the daily insolation (integral)';

-- Update table comment if needed
COMMENT ON TABLE insolation_readings IS 'Daily insolation readings for WMS devices. Stores last 100 days in rollover fashion. Insolation is calculated as area under IRR vs time curve (integral) in kWh/m².';

