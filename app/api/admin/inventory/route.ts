import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
  const resolvedName = String(authUser.user_metadata?.full_name || authUser.email || 'Admin User')
  const resolvedRole = String(authUser.user_metadata?.role || 'admin')

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const categoryId = searchParams.get('categoryId')?.trim() || ''
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true'
  const sort = searchParams.get('sort') || 'low-stock-asc'
  const includeLogs = searchParams.get('includeLogs') === 'true'

  const [{ data: items, error: itemsError }, { data: categories, error: categoriesError }, { data: inventory, error: inventoryError }] = await Promise.all([
    supabaseAdmin
      .from('items')
      .select('id, name, category_id, unit_price, reorder_level, created_at')
      .order('name', { ascending: true }),
    supabaseAdmin.from('categories').select('id, name').order('name', { ascending: true }),
    supabaseAdmin.from('inventory').select('item_id, quantity, updated_at, last_restocked, warehouse_location'),
  ])

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  if (inventoryError) return NextResponse.json({ error: inventoryError.message }, { status: 500 })

  const categoryNameById = new Map((categories || []).map(category => [category.id, category.name]))
  const inventoryByItem = new Map(
    (inventory || []).map(row => [row.item_id, row]),
  )
  let logs: Array<{
    id: string
    item_id: string
    item_name: string
    action: string
    quantity_changed: number
    old_quantity: number | null
    new_quantity: number | null
    performed_by: string
    performed_by_name: string
    notes: string | null
    created_at: string
  }> = []

  if (includeLogs) {
    const { data: logRows, error: logError } = await supabaseAdmin
      .from('inventory_logs')
      .select('id, item_id, action, quantity_changed, old_quantity, new_quantity, performed_by, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(12)

    if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

    const performerIds = Array.from(new Set((logRows || []).map(row => row.performed_by)))
    const itemIds = Array.from(new Set((logRows || []).map(row => row.item_id)))

    const [{ data: performers, error: performerError }, { data: logItems, error: logItemsError }] = await Promise.all([
      performerIds.length > 0
        ? supabaseAdmin.from('users').select('id, full_name').in('id', performerIds)
        : Promise.resolve({ data: [], error: null as null }),
      itemIds.length > 0
        ? supabaseAdmin.from('items').select('id, name').in('id', itemIds)
        : Promise.resolve({ data: [], error: null as null }),
    ])

    if (performerError) return NextResponse.json({ error: performerError.message }, { status: 500 })
    if (logItemsError) return NextResponse.json({ error: logItemsError.message }, { status: 500 })

    const performerNameById = new Map((performers || []).map(user => [user.id, user.full_name]))
    const itemNameById = new Map((logItems || []).map(item => [item.id, item.name]))

    logs = (logRows || []).map(row => ({
      ...row,
      item_name: itemNameById.get(row.item_id) || 'Unknown item',
      performed_by_name: performerNameById.get(row.performed_by) || 'Manager',
    }))
  }

  let normalizedItems = (items || []).map(item => {
    const inventoryRow = inventoryByItem.get(item.id)
    const quantity = inventoryRow?.quantity ?? 0

    return {
      ...item,
      category_name: categoryNameById.get(item.category_id) || 'Unassigned',
      quantity,
      updated_at: inventoryRow?.updated_at || item.created_at,
      last_restocked: inventoryRow?.last_restocked || null,
      warehouse_location: inventoryRow?.warehouse_location || null,
      stock_status:
        quantity === 0 ? 'out' : quantity <= item.reorder_level ? 'low' : 'healthy',
    }
  })

  if (search) {
    const normalizedSearch = search.toLowerCase()
    normalizedItems = normalizedItems.filter(item => {
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        String(item.category_name || '').toLowerCase().includes(normalizedSearch)
      )
    })
  }

  if (categoryId) {
    normalizedItems = normalizedItems.filter(item => item.category_id === categoryId)
  }

  if (lowStockOnly) {
    normalizedItems = normalizedItems.filter(item => item.quantity <= item.reorder_level)
  }

  normalizedItems.sort((a, b) => {
    switch (sort) {
      case 'stock-asc':
        return a.quantity - b.quantity
      case 'stock-desc':
        return b.quantity - a.quantity
      case 'name-asc':
        return a.name.localeCompare(b.name)
      case 'restocked-desc':
      case 'updated-desc':
        return new Date(b.last_restocked || b.updated_at || 0).getTime() - new Date(a.last_restocked || a.updated_at || 0).getTime()
      case 'low-stock-asc':
      default:
        return a.quantity - b.quantity
    }
  })

  return NextResponse.json({ items: normalizedItems, categories, logs })
}

export async function POST(request: Request) {
  const body = await request.json()
  const itemId = String(body.item_id || '').trim()
  const quantity = Number(body.quantity || 0)
  const performedBy = String(body.performed_by || '').trim()
  const location = body.location ? String(body.location).trim() : null
  const notes = body.notes ? String(body.notes).trim() : null

  if (!itemId) {
    return NextResponse.json({ error: 'Item is required' }, { status: 400 })
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 })
  }

  if (!performedBy) {
    return NextResponse.json({ error: 'Performed by user is required' }, { status: 400 })
  }

  const performer = await resolvePerformerUserId(performedBy)
  if ('error' in performer) {
    return NextResponse.json({ error: performer.error }, { status: 500 })
  }

  const { error } = await supabaseAdmin.rpc('restock_item', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_performed_by: performer.userId,
    p_location: location,
    p_notes: notes,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}