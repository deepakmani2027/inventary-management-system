import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type CartItem = {
  item_id: string
  quantity: number
}

async function getAuthenticatedSalesman() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

export async function GET() {
  const auth = await getAuthenticatedSalesman()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [{ data: items, error: itemsError }, { data: categories, error: categoriesError }, { data: inventory, error: inventoryError }] = await Promise.all([
    supabaseAdmin
      .from('items')
      .select('id, name, category_id, unit_price, reorder_level')
      .order('name', { ascending: true }),
    supabaseAdmin.from('categories').select('id, name').order('name', { ascending: true }),
    supabaseAdmin.from('inventory').select('item_id, quantity'),
  ])

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  if (inventoryError) return NextResponse.json({ error: inventoryError.message }, { status: 500 })

  const inventoryByItem = new Map((inventory || []).map(row => [row.item_id, row.quantity]))
  const categoryNameById = new Map((categories || []).map(category => [category.id, category.name]))

  return NextResponse.json({
    user: auth.user,
    items: (items || []).map(item => ({
      id: item.id,
      name: item.name,
      category_id: item.category_id,
      category_name: categoryNameById.get(item.category_id) || 'Unassigned',
      unit_price: item.unit_price,
      reorder_level: item.reorder_level,
      stock: inventoryByItem.get(item.id) || 0,
    })),
    categories: categories || [],
  })
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSalesman()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const customerName = String(body.customerName || '').trim() || 'Walk-in'
  const rawItems = Array.isArray(body.items) ? body.items : []
  const cartItems = rawItems
    .map((item: CartItem) => ({ item_id: String(item.item_id || '').trim(), quantity: Number(item.quantity) }))
    .filter(item => item.item_id && Number.isFinite(item.quantity) && item.quantity > 0)

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
  }

  const uniqueItemIds = [...new Set(cartItems.map(item => item.item_id))]
  const { data: stockRows, error: stockError } = await supabaseAdmin
    .from('inventory')
    .select('item_id, quantity')
    .in('item_id', uniqueItemIds)

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 })
  }

  const stockByItem = new Map((stockRows || []).map(row => [row.item_id, row.quantity]))
  for (const item of cartItems) {
    const available = stockByItem.get(item.item_id) || 0
    if (available < item.quantity) {
      return NextResponse.json({ error: `Insufficient stock for item ${item.item_id}` }, { status: 409 })
    }
  }

  const { data: saleId, error: saleError } = await supabaseAdmin.rpc('process_sale', {
    p_salesman_id: auth.user.id,
    p_customer_name: customerName,
    p_items: cartItems,
  })

  if (saleError) {
    return NextResponse.json({ error: saleError.message }, { status: 500 })
  }

  const { data: sale, error: saleFetchError } = await supabaseAdmin
    .from('sales')
    .select('id, bill_number, customer_name, sale_date, total_amount')
    .eq('id', saleId)
    .maybeSingle()

  if (saleFetchError) {
    return NextResponse.json({ error: saleFetchError.message }, { status: 500 })
  }

  return NextResponse.json({
    sale: {
      id: sale?.id || saleId,
      bill_number: sale?.bill_number || `BILL-${String(saleId).slice(0, 8).toUpperCase()}`,
      customer_name: sale?.customer_name || customerName,
      sale_date: sale?.sale_date || new Date().toISOString(),
      total_amount: sale?.total_amount || 0,
    },
  })
}