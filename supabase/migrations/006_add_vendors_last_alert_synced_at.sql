-- Add last_alert_synced_at to vendors to track alert sync cron/manual runs per vendor

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS last_alert_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN vendors.last_alert_synced_at IS 'Last time alerts were synced for this vendor (cron or manual).';

CREATE INDEX IF NOT EXISTS idx_vendors_last_alert_synced_at
  ON vendors (last_alert_synced_at DESC);


