import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function getAuthenticatedSalesman() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', status: 401 as const }
  }

  const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.id)

  if (authError || !authUserData.user) {
    return { error: authError?.message || 'Unable to verify account', status: 500 as const }
  }

  const role = String(authUserData.user.user_metadata?.role || user.user_metadata?.role || '')

  if (role !== 'salesman') {
    return { error: 'Access denied', status: 403 as const }
  }

  return {
    user: {
      id: user.id,
      role: 'salesman',
      full_name: String(authUserData.user.user_metadata?.full_name || user.user_metadata?.full_name || 'Salesman'),
      email: authUserData.user.email || user.email || '',
    },
  }
}

type NotificationType = 'low_stock' | 'exception'

export async function POST(request: Request) {
  const auth = await getAuthenticatedSalesman()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const type = String(body.type || '') as NotificationType
  const message = String(body.message || '').trim()

  if (!['low_stock', 'exception'].includes(type)) {
    return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
  }

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (message.length > 200) {
    return NextResponse.json({ error: 'Message must be 200 characters or less' }, { status: 400 })
  }

  const receiverRole = type === 'low_stock' ? 'inventory_manager' : 'sales_manager'
  const title = type === 'low_stock' ? 'Low Stock Alert' : 'Exception Alert'

  const { data: recipients, error: recipientError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', receiverRole)

  if (recipientError) {
    return NextResponse.json({ error: recipientError.message }, { status: 500 })
  }

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'No recipient found' }, { status: 404 })
  }

  const { error: insertError } = await supabaseAdmin.from('notifications').insert(
    recipients.map(recipient => ({
      user_id: recipient.id,
      title,
      message,
      type,
    })),
  )

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, recipientCount: recipients.length, title })
}