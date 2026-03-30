import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function resolveUserProfile(id: string, fallback: { email?: string; full_name?: string; role?: string } = {}) {
  const { data: existingUser, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', id)
    .maybeSingle()

  if (lookupError) {
    return { error: lookupError.message }
  }

  if (existingUser) {
    return { user: existingUser }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(id)
  if (authError || !authData.user) {
    return { error: authError?.message || 'Unable to resolve user profile' }
  }

  const authUser = authData.user
  const resolvedEmail = fallback.email || authUser.email || `${id}@unknown.local`
  const resolvedName = fallback.full_name || String(authUser.user_metadata?.full_name || authUser.email || 'Admin User')
  const resolvedRole = fallback.role || String(authUser.user_metadata?.role || 'admin')

  const { error: upsertError } = await supabaseAdmin.from('users').upsert({
    id,
    email: resolvedEmail,
    full_name: resolvedName,
    role: resolvedRole,
    password_hash: 'managed-by-auth',
    is_active: true,
  })

  if (upsertError) {
    return { error: upsertError.message }
  }

  return {
    user: {
      id,
      email: resolvedEmail,
      full_name: resolvedName,
      role: resolvedRole,
      is_active: true,
    },
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json()
  const { id } = await params
  const updates: Record<string, any> = {}

  if (body.full_name !== undefined) updates.full_name = String(body.full_name)
  if (body.email !== undefined) updates.email = String(body.email).toLowerCase()
  if (body.role !== undefined) updates.role = String(body.role)
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)

  const profile = await resolveUserProfile(id, updates)

  if ('error' in profile) {
    return NextResponse.json({ error: profile.error }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.email !== undefined || body.full_name !== undefined || body.role !== undefined) {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email: body.email,
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
      },
    })

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, user: profile.user })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
