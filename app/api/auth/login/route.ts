import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim()
  const password = String(body.password || '')

  if (!email || !password) {
    return NextResponse.json({ error: 'Please fill in all fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 401 })
  }

  const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(data.user.id)
  const role = authUserData.user?.user_metadata?.role || data.user.user_metadata?.role || 'user'

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role,
    },
  })
}