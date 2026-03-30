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

async function resolvePerformerUserId(performedBy: string) {
  const { data: existingUser, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', performedBy)
    .maybeSingle()

  if (lookupError) {
    return { error: lookupError.message }
  }

  if (existingUser) {
    return { userId: existingUser.id }
  }

  const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.getUserById(performedBy)

  if (authError || !authUserData.user) {
    return { error: authError?.message || 'Unable to resolve performed by user' }
  }

  const authUser = authUserData.user
  const resolvedEmail = authUser.email || `${performedBy}@unknown.local`
  const resolvedName = String(authUser.user_metadata?.full_name || authUser.email || 'Inventory Manager')
  const resolvedRole = String(authUser.user_metadata?.role || 'inventory_manager')

  const { error: insertError } = await supabaseAdmin.from('users').upsert({
    id: performedBy,
    email: resolvedEmail,
    full_name: resolvedName,
    role: resolvedRole,
    password_hash: 'managed-by-auth',
    is_active: true,
  })

  if (insertError) {
    return { error: insertError.message }
  }

  return { userId: performedBy }
}

type ValidationLogRow = {
  id: string
  item_id: string
  action: string
  quantity_changed: number
  old_quantity: number | null
  new_quantity: number | null
  performed_by: string
  notes: string | null
  created_at: string
}

type SaleItemRow = {
  item_id: string
  quantity: number
}

function formatAction(action: string) {
  switch (action) {
    case 'restock':
      return 'Restock'
    case 'sale':
      return 'Sale'
    case 'return':
      return 'Return'
    case 'cancel':
      return 'Cancel'
    case 'adjustment':
      return 'Adjustment'
    default:
      return action || 'Movement'
  }
}

export async function GET() {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [
    { data: items, error: itemsError },
    { data: categories, error: categoriesError },
    { data: inventory, error: inventoryError },
    { data: saleItems, error: saleItemsError },
    { data: logs, error: logsError },
  ] = await Promise.all([
    supabaseAdmin.from('items').select('id, name, category_id, reorder_level, created_at').order('name', { ascending: true }),
    supabaseAdmin.from('categories').select('id, name').order('name', { ascending: true }),
    supabaseAdmin.from('inventory').select('item_id, quantity, updated_at, last_restocked, created_at'),
    supabaseAdmin.from('sale_items').select('item_id, quantity, created_at'),
    supabaseAdmin
      .from('inventory_logs')
      .select('id, item_id, action, quantity_changed, old_quantity, new_quantity, performed_by, notes, created_at')
      .order('created_at', { ascending: true }),
  ])

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  if (inventoryError) return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  if (saleItemsError) return NextResponse.json({ error: saleItemsError.message }, { status: 500 })
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 })

  const categoryNameById = new Map((categories || []).map(category => [category.id, category.name]))
  const inventoryByItem = new Map((inventory || []).map(row => [row.item_id, row]))

  const soldByItem = new Map<string, number>()
  for (const row of (saleItems || []) as SaleItemRow[]) {
    soldByItem.set(row.item_id, (soldByItem.get(row.item_id) || 0) + Number(row.quantity || 0))
  }

  type MovementSummary = {
    restocked: number
    returned: number
    cancelled: number
    adjustments: number
    saleLogQuantity: number
    logCount: number
    firstOldQuantity: number | null
    lastActivityAt: string | null
  }

  const movementByItem = new Map<string, MovementSummary>()
  for (const row of logs as ValidationLogRow[]) {
    const current = movementByItem.get(row.item_id) || {
      restocked: 0,
      returned: 0,
      cancelled: 0,
      adjustments: 0,
      saleLogQuantity: 0,
      logCount: 0,
      firstOldQuantity: row.old_quantity,
      lastActivityAt: row.created_at,
    }

    current.logCount += 1
    current.lastActivityAt = row.created_at
    if (current.firstOldQuantity === null && row.old_quantity !== null) {
      current.firstOldQuantity = row.old_quantity
    }

    const quantityChanged = Number(row.quantity_changed || 0)

    switch (row.action) {
      case 'restock':
        current.restocked += quantityChanged
        break
      case 'return':
        current.returned += quantityChanged
        break
      case 'cancel':
        current.cancelled += quantityChanged
        break
      case 'adjustment':
        current.adjustments += quantityChanged
        break
      case 'sale':
        current.saleLogQuantity += Math.abs(quantityChanged)
        break
      default:
        break
    }

    movementByItem.set(row.item_id, current)
  }

  const recentLogs = [...(logs as ValidationLogRow[])]
    .slice()
    .reverse()
    .slice(0, 10)
    .map(row => ({
      ...row,
      action_label: formatAction(row.action),
    }))

  const performerIds = Array.from(new Set(recentLogs.map(row => row.performed_by)))
  const recentItemIds = Array.from(new Set(recentLogs.map(row => row.item_id)))

  const [{ data: performers }, { data: recentItems }] = await Promise.all([
    performerIds.length > 0
      ? supabaseAdmin.from('users').select('id, full_name').in('id', performerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }>, error: null }),
    recentItemIds.length > 0
      ? supabaseAdmin.from('items').select('id, name').in('id', recentItemIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ])

  const performerNameById = new Map((performers || []).map(user => [user.id, user.full_name]))
  const itemNameById = new Map((recentItems || []).map(item => [item.id, item.name]))

  const enrichedRecentLogs = recentLogs.map(row => ({
    ...row,
    item_name: itemNameById.get(row.item_id) || 'Unknown item',
    performed_by_name: performerNameById.get(row.performed_by) || 'Inventory Manager',
  }))

  const rows = (items || []).map(item => {
    const inventoryRow = inventoryByItem.get(item.id)
    const actualStock = Number(inventoryRow?.quantity || 0)
    const sold = Number(soldByItem.get(item.id) || 0)
    const movement = movementByItem.get(item.id)
    const category_name = categoryNameById.get(item.category_id) || 'Unassigned'
    const hasAuditTrail = Boolean(movement && movement.logCount > 0 && movement.firstOldQuantity !== null)
    const baseline = hasAuditTrail ? Number(movement?.firstOldQuantity || 0) : actualStock
    const expectedStock = hasAuditTrail
      ? baseline
        + Number(movement?.restocked || 0)
        + Number(movement?.returned || 0)
        + Number(movement?.cancelled || 0)
        + Number(movement?.adjustments || 0)
        - sold
      : actualStock
    const difference = actualStock - expectedStock
    const saleLogQuantity = Number(movement?.saleLogQuantity || 0)
    const logCount = Number(movement?.logCount || 0)

    const issues = [] as string[]

    if (!hasAuditTrail) {
      issues.push('Missing inventory logs')
    }

    if (saleLogQuantity !== sold) {
      issues.push('Sale log mismatch')
    }

    if (actualStock < 0 || expectedStock < 0) {
      issues.push('Negative stock')
    }

    let status: 'valid' | 'mismatch' | 'critical' | 'missing-history' = 'valid'
    if (actualStock < 0 || expectedStock < 0) {
      status = 'critical'
    } else if (!hasAuditTrail) {
      status = 'missing-history'
    } else if (difference !== 0 || saleLogQuantity !== sold) {
      status = 'mismatch'
    }

    return {
      id: item.id,
      name: item.name,
      category_name,
      reorder_level: Number(item.reorder_level || 0),
      actual_stock: actualStock,
      expected_stock: expectedStock,
      difference,
      sold,
      sold_from_logs: saleLogQuantity,
      restocked: Number(movement?.restocked || 0),
      returned: Number(movement?.returned || 0),
      cancelled: Number(movement?.cancelled || 0),
      adjustments: Number(movement?.adjustments || 0),
      log_count: logCount,
      last_activity_at: movement?.lastActivityAt || inventoryRow?.updated_at || inventoryRow?.last_restocked || null,
      has_audit_trail: hasAuditTrail,
      issues,
      status,
      category_id: item.category_id,
    }
  })

  const summary = {
    totalItems: rows.length,
    validCount: rows.filter(row => row.status === 'valid').length,
    mismatchCount: rows.filter(row => row.status === 'mismatch').length,
    criticalCount: rows.filter(row => row.status === 'critical').length,
    missingHistoryCount: rows.filter(row => row.status === 'missing-history').length,
    validationIssuesCount: rows.filter(row => row.status !== 'valid').length,
    totalSold: rows.reduce((sum, row) => sum + row.sold, 0),
    totalRestocked: rows.reduce((sum, row) => sum + row.restocked, 0),
    totalReturned: rows.reduce((sum, row) => sum + row.returned, 0),
    totalCancelled: rows.reduce((sum, row) => sum + row.cancelled, 0),
    totalAdjustments: rows.reduce((sum, row) => sum + row.adjustments, 0),
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json({
    summary,
    items: rows,
    recentLogs: enrichedRecentLogs,
  })
}

export async function POST(request: Request) {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const itemId = String(body.itemId || '').trim()
  const targetQuantity = Number(body.targetQuantity)
  const performedBy = String(body.performedBy || '').trim()
  const notes = body.notes ? String(body.notes).trim() : null

  if (!itemId) {
    return NextResponse.json({ error: 'Item is required' }, { status: 400 })
  }

  if (!Number.isFinite(targetQuantity) || targetQuantity < 0 || !Number.isInteger(targetQuantity)) {
    return NextResponse.json({ error: 'Target quantity must be a whole number of 0 or more' }, { status: 400 })
  }

  if (!performedBy) {
    return NextResponse.json({ error: 'Performed by user is required' }, { status: 400 })
  }

  const performer = await resolvePerformerUserId(performedBy)
  if ('error' in performer) {
    return NextResponse.json({ error: performer.error }, { status: 500 })
  }

  const { data: inventoryRow, error: inventoryReadError } = await supabaseAdmin
    .from('inventory')
    .select('quantity')
    .eq('item_id', itemId)
    .maybeSingle()

  if (inventoryReadError) {
    return NextResponse.json({ error: inventoryReadError.message }, { status: 500 })
  }

  const currentQuantity = Number(inventoryRow?.quantity ?? 0)
  const delta = targetQuantity - currentQuantity

  if (delta === 0) {
    return NextResponse.json({ ok: true, unchanged: true, currentQuantity, targetQuantity, delta: 0 })
  }

  const timestamp = new Date().toISOString()
  const inventoryMutation = inventoryRow
    ? await supabaseAdmin
        .from('inventory')
        .update({ quantity: targetQuantity, updated_at: timestamp })
        .eq('item_id', itemId)
    : await supabaseAdmin
        .from('inventory')
        .insert({ item_id: itemId, quantity: targetQuantity, updated_at: timestamp })

  if (inventoryMutation.error) {
    return NextResponse.json({ error: inventoryMutation.error.message }, { status: 500 })
  }

  const { error: logError } = await supabaseAdmin.from('inventory_logs').insert({
    item_id: itemId,
    action: 'adjustment',
    quantity_changed: delta,
    old_quantity: currentQuantity,
    new_quantity: targetQuantity,
    performed_by: performer.userId,
    notes: notes || 'Validation adjustment',
  })

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, currentQuantity, targetQuantity, delta })
}