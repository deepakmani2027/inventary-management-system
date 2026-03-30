import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ExceptionAction = 'mark-in-progress' | 'resolve' | 'reopen'

const exceptionTypes = ['exception', 'return_issue', 'payment_issue', 'system_issue']

async function getAuthorizedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', status: 401 as const }
  }

  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { error: error.message, status: 500 as const }
  }

  if (!profile || !['admin', 'sales_manager'].includes(profile.role)) {
    return { error: 'Access denied', status: 403 as const }
  }

  return { user: profile }
}

export async function GET() {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const baseQuery = supabaseAdmin
    .from('notifications')
    .select('id, user_id, title, message, type, is_read, resolved, resolved_at, created_at')
    .in('type', exceptionTypes)
    .order('created_at', { ascending: false })

  const notificationQuery = auth.user.role === 'admin' ? baseQuery : baseQuery.eq('user_id', auth.user.id)

  const recipientsQuery =
    auth.user.role === 'admin'
      ? supabaseAdmin.from('users').select('id, full_name, role').eq('role', 'sales_manager')
      : supabaseAdmin.from('users').select('id, full_name, role').eq('id', auth.user.id)

  const [{ data: notifications, error: notificationsError }, { data: recipients, error: recipientsError }] =
    await Promise.all([notificationQuery, recipientsQuery])

  if (notificationsError) {
    return NextResponse.json({ error: notificationsError.message }, { status: 500 })
  }

  if (recipientsError) {
    return NextResponse.json({ error: recipientsError.message }, { status: 500 })
  }

  const recipientById = new Map((recipients || []).map(recipient => [recipient.id, recipient]))

  const payload = (notifications || []).map(notification => ({
    ...notification,
    recipient_name: recipientById.get(notification.user_id)?.full_name || 'Sales Manager',
    recipient_role: recipientById.get(notification.user_id)?.role || 'sales_manager',
  }))

  return NextResponse.json({ notifications: payload })
}

export async function PATCH(request: Request) {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '').trim()
  const action = String(body.action || '').trim() as ExceptionAction

  if (!id) {
    return NextResponse.json({ error: 'Notification id is required' }, { status: 400 })
  }

  if (!['mark-in-progress', 'resolve', 'reopen'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  let updates: Record<string, string | boolean | null> = {}

  if (action === 'mark-in-progress') {
    updates = { is_read: true, resolved: false, resolved_at: null }
  }

  if (action === 'resolve') {
    updates = { is_read: true, resolved: true, resolved_at: new Date().toISOString() }
  }

  if (action === 'reopen') {
    updates = { is_read: false, resolved: false, resolved_at: null }
  }

  let query = supabaseAdmin.from('notifications').update(updates).eq('id', id)

  if (auth.user.role !== 'admin') {
    query = query.eq('user_id', auth.user.id)
  }

  const { data, error } = await query.select('id, is_read, resolved, resolved_at').maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  return NextResponse.json({ notification: data })
}