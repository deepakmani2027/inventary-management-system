import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const otp = String(body.otp || '').trim()

  if (!email || !otp) {
    return NextResponse.json({ error: 'Please provide email and otp' }, { status: 400 })
  }

  // find pending signup
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from('pending_signups')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (pendingError || !pending) {
    console.warn('verify-otp: pending signup lookup failed', { pendingError, email })

    // If there's already a real user with this email, return a clearer code
    try {
      const { data: existingUser } = await supabaseAdmin.from('users').select('id, is_active').eq('email', email).maybeSingle()
      if (existingUser) {
        return NextResponse.json({ error: 'Email already registered', code: 'EMAIL_EXISTS' }, { status: 409 })
      }
    } catch (e) {
      console.warn('verify-otp: users lookup failed', e)
    }

    return NextResponse.json({ error: 'Pending signup not found', code: 'PENDING_NOT_FOUND' }, { status: 404 })
  }

  // find matching pending OTP
  const { data: otpRow, error: otpError } = await supabaseAdmin
    .from('pending_otps')
    .select('*')
    .eq('pending_signup_id', pending.id)
    .eq('otp_code', otp)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (otpError || !otpRow) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }

  const expiresAt = new Date(otpRow.expires_at)
  if (expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 400 })
  }

  // create actual supabase auth user now
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: pending.email,
    password: pending.password,
    email_confirm: true,
    user_metadata: { full_name: pending.full_name, role: pending.role },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 500 })
  }

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email: authData.user.email,
    full_name: pending.full_name,
    role: pending.role,
    password_hash: 'managed-by-supabase-auth',
    is_active: true,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Associate the mirrored email_otps row (if present) with the newly created user.
  try {
    const { data: preInserted, error: findError } = await supabaseAdmin
      .from('email_otps')
      .select('*')
      .eq('otp_code', otp)
      .eq('used', false)
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!findError && preInserted) {
      await supabaseAdmin.from('email_otps').update({ user_id: authData.user.id, used: true }).eq('id', preInserted.id)
    } else {
      // Fallback: insert a used row for auditing
      await supabaseAdmin.from('email_otps').insert({
        user_id: authData.user.id,
        otp_code: otp,
        expires_at: otpRow.expires_at,
        used: true,
      })
    }
  } catch (e) {
    console.warn('verify-otp: failed to associate email_otps row', e)
  }

  // mark OTP used and cleanup pending records
  await supabaseAdmin.from('pending_otps').update({ used: true }).eq('id', otpRow.id)
  await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)

  return NextResponse.json({ message: 'Verification successful, account created' })
}
