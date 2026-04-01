import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'

function generateOTP(length = 6) {
  const digits = '0123456789'
  let otp = ''
  for (let i = 0; i < length; i++) otp += digits[Math.floor(Math.random() * digits.length)]
  return otp
}

async function sendOtpEmail(to: string, otp: string) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS environment variables are required to send email')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const from = process.env.SMTP_FROM || user

  await transporter.sendMail({
    from,
    to,
    subject: 'Your verification code',
    text: `Your verification code is ${otp}. It expires in 15 minutes.`,
    html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>This code expires in 15 minutes.</p>`,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // find pending signup
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from('pending_signups')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (pendingError || !pending) {
    return NextResponse.json({ error: 'Pending signup not found', code: 'PENDING_NOT_FOUND' }, { status: 404 })
  }

  // generate new OTP and store
  const otp = generateOTP(6)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString()

  const { error: otpError } = await supabaseAdmin.from('pending_otps').insert({
    pending_signup_id: pending.id,
    otp_code: otp,
    expires_at: expiresAt,
    used: false,
  })

  if (otpError) {
    console.warn('resend-otp: failed to insert otp', { otpError })
    return NextResponse.json({ error: 'Failed to store OTP', code: 'OTP_STORE_FAILED' }, { status: 500 })
  }

  // Mirror the OTP into email_otps for audit/history
  const { error: mirrorError } = await supabaseAdmin.from('email_otps').insert({
    user_id: null,
    otp_code: otp,
    expires_at: expiresAt,
    used: false,
  })

  if (mirrorError) {
    console.warn('resend-otp: failed to mirror otp to email_otps', { mirrorError })
    // delete the pending otp we just inserted
    await supabaseAdmin.from('pending_otps').delete().eq('pending_signup_id', pending.id).eq('otp_code', otp)
    return NextResponse.json({ error: 'Failed to store OTP audit', code: 'OTP_AUDIT_FAILED' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch (e: any) {
    console.warn('resend-otp: failed to send email', e)
    await supabaseAdmin.from('pending_otps').delete().eq('pending_signup_id', pending.id)
    return NextResponse.json({ error: `Failed to send verification email: ${e.message || e}`, code: 'EMAIL_SEND_FAILED' }, { status: 500 })
  }
  // In development, log the OTP server-side for debugging (do not expose to client)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dev] resend-otp for ${email}: ${otp}`)
  }

  return NextResponse.json({ message: 'OTP resent' })
}
