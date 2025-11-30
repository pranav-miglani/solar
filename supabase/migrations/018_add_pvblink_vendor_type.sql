-- This migration adds 'PVBLINK' to the vendor_type ENUM

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_type') THEN
        CREATE TYPE vendor_type AS ENUM ('SOLARMAN', 'SUNGROW', 'OTHER', 'SOLARDM', 'PVBLINK');
    ELSE
        -- Check if PVBLINK already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'PVBLINK' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vendor_type')
        ) THEN
            ALTER TYPE vendor_type ADD VALUE 'PVBLINK' AFTER 'SOLARDM';
        END IF;
    END IF;
END
$$;

