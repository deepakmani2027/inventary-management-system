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
  const fullName = String(body.full_name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const role = String(body.role || '').trim()
  const password = String(body.password || '')

  if (!fullName || !email || !role || !password) {
    return NextResponse.json({ error: 'Please fill in all fields' }, { status: 400 })
  }

  // Create a pending signup record (we will create real auth user after OTP verification)
  let pending: any = null
  try {
    const resp = await supabaseAdmin
      .from('pending_signups')
      .insert({ full_name: fullName, email, role, password })
      .select('id')
      .maybeSingle()
    pending = resp.data
    if (resp.error || !pending) {
      console.warn('signup: failed to create pending signup', { error: resp.error })
      return NextResponse.json({ error: 'Failed to create pending signup', code: 'PENDING_CREATE_FAILED' }, { status: 500 })
    }
  } catch (e) {
    console.warn('signup: exception when creating pending signup', e)
    return NextResponse.json({ error: 'Failed to create pending signup', code: 'PENDING_CREATE_FAILED' }, { status: 500 })
  }

  // generate OTP and store in pending_otps
  const otp = generateOTP(6)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString()

  const { error: otpError } = await supabaseAdmin.from('pending_otps').insert({
    pending_signup_id: pending.id,
    otp_code: otp,
    expires_at: expiresAt,
    used: false,
  })

  if (otpError) {
    console.warn('signup: failed to insert otp', { otpError })
    await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)
    return NextResponse.json({ error: 'Failed to store OTP', code: 'OTP_STORE_FAILED' }, { status: 500 })
  }

  // Mirror OTP into email_otps for audit/history (user_id is null until verification)
  const { error: mirrorError } = await supabaseAdmin.from('email_otps').insert({
    user_id: null,
    otp_code: otp,
    expires_at: expiresAt,
    used: false,
  })

  if (mirrorError) {
    console.warn('signup: failed to mirror otp to email_otps', { mirrorError })
    // cleanup pending entries
    await supabaseAdmin.from('pending_otps').delete().eq('pending_signup_id', pending.id)
    await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)
    return NextResponse.json({ error: 'Failed to store OTP audit', code: 'OTP_AUDIT_FAILED' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch (e: any) {
    console.warn('signup: failed to send email', { err: e })
    await supabaseAdmin.from('pending_otps').delete().eq('pending_signup_id', pending.id)
    await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)
    return NextResponse.json({ error: `Failed to send verification email: ${e.message || e}`, code: 'EMAIL_SEND_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Pending signup created. OTP sent to email' })
}