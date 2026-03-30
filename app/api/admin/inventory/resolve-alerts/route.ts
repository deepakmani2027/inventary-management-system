import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function getAuthorizedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', status: 401 as const }
  }

  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { error: error.message, status: 500 as const }
  }

  if (!profile || !['admin', 'inventory_manager'].includes(profile.role)) {
    return { error: 'Access denied', status: 403 as const }
  }

  return { user }
}

export async function POST(request: Request) {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const itemId = String(body.itemId || '').trim()
  const itemName = String(body.itemName || '').trim()

  if (!itemId && !itemName) {
    return NextResponse.json({ error: 'Item context is required' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('notifications')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('type', 'low_stock')
    .eq('resolved', false)

  if (itemName) {
    query = query.ilike('message', `%${itemName}%`)
  }

  const { data, error } = await query.select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resolvedCount: data?.length || 0 })
}
