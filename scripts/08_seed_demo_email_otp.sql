-- Seed a demo OTP for quick testing (user_id null)
-- Change otp_code or email as needed for your demo account

INSERT INTO email_otps (user_id, otp_code, expires_at, used)
VALUES (
  NULL,
  '123456',
  NOW() + INTERVAL '15 minutes',
  FALSE
)
ON CONFLICT DO NOTHING;

-- Optionally inspect the newest rows:
-- SELECT * FROM email_otps ORDER BY created_at DESC LIMIT 20;
