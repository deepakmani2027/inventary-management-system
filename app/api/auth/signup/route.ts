import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const fullName = String(body.full_name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const role = String(body.role || '').trim()
  const password = String(body.password || '')

  if (!fullName || !email || !role || !password) {
    return NextResponse.json({ error: 'Please fill in all fields' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
    },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 500 })
  }

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role,
    password_hash: 'managed-by-supabase-auth',
    is_active: true,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id: authData.user.id,
      email: authData.user.email,
      role,
      full_name: fullName,
    },
  })
}