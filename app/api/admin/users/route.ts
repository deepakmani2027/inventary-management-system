import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const fullName = String(body.full_name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const role = String(body.role || 'salesman')
  const password = String(body.password || 'password123')

  if (!fullName || !email || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 500 })
  }

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role,
    password_hash: password,
    is_active: true,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user: authData.user })
}
