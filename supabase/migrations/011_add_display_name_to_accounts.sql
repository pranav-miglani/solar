-- Add display_name column to accounts for user-friendly names
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS display_name TEXT;


