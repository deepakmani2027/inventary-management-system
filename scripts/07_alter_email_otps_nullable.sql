-- Make email_otps.user_id nullable safely
ALTER TABLE IF EXISTS email_otps
  ALTER COLUMN user_id DROP NOT NULL;

-- Create index if missing (idempotent)
CREATE INDEX IF NOT EXISTS idx_email_otps_user ON email_otps(user_id);
