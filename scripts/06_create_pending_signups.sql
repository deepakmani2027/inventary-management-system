-- Table for pending signups (temporary until email OTP verification completes)
CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);

-- OTPs for pending signups
CREATE TABLE IF NOT EXISTS pending_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pending_signup_id UUID NOT NULL REFERENCES pending_signups(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_otps_pending ON pending_otps(pending_signup_id);
