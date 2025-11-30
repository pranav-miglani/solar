-- This migration adds 'FOXESSCLOUD' to the vendor_type ENUM

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_type') THEN
        CREATE TYPE vendor_type AS ENUM ('SOLARMAN', 'SUNGROW', 'OTHER', 'SOLARDM', 'PVBLINK', 'FOXESSCLOUD');
    ELSE
        -- Check if FOXESSCLOUD already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'FOXESSCLOUD' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vendor_type')
        ) THEN
            ALTER TYPE vendor_type ADD VALUE 'FOXESSCLOUD' AFTER 'PVBLINK';
        END IF;
    END IF;
END
$$;

