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

function normalizeDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function GET(request: Request) {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('categoryId')?.trim() || ''
  const from = normalizeDate(searchParams.get('from'))
  const to = normalizeDate(searchParams.get('to'))

  const [
    { data: categories, error: categoriesError },
    { data: items, error: itemsError },
    { data: inventory, error: inventoryError },
    { data: logs, error: logsError },
  ] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').order('name', { ascending: true }),
    supabaseAdmin.from('items').select('id, name, category_id, unit_price, reorder_level').order('name', { ascending: true }),
    supabaseAdmin.from('inventory').select('item_id, quantity'),
    supabaseAdmin.from('inventory_logs').select('id, item_id, action, quantity_changed, created_at'),
  ])

  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (inventoryError) return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 })

  const categoryById = new Map((categories || []).map(category => [category.id, category.name]))
  const inventoryByItem = new Map((inventory || []).map(row => [row.item_id, Number(row.quantity || 0)]))

  const filteredItems = (items || []).filter(item => !categoryId || item.category_id === categoryId)

  const categoryReportMap = new Map<string, { category: string; total_items: number; total_stock: number; total_value: number }>()
  const priceReportMap = new Map<string, { price_range: string; item_count: number; total_stock: number; total_value: number }>()

  for (const item of filteredItems) {
    const category = categoryById.get(item.category_id) || 'Unassigned'
    const quantity = Number(inventoryByItem.get(item.id) || 0)
    const value = quantity * Number(item.unit_price || 0)

    const categoryEntry = categoryReportMap.get(category) || { category, total_items: 0, total_stock: 0, total_value: 0 }
    categoryEntry.total_items += 1
    categoryEntry.total_stock += quantity
    categoryEntry.total_value += value
    categoryReportMap.set(category, categoryEntry)

    let price_range = 'High'
    if (Number(item.unit_price) < 100) {
      price_range = 'Low'
    } else if (Number(item.unit_price) <= 1000) {
      price_range = 'Medium'
    }

    const priceEntry = priceReportMap.get(price_range) || { price_range, item_count: 0, total_stock: 0, total_value: 0 }
    priceEntry.item_count += 1
    priceEntry.total_stock += quantity
    priceEntry.total_value += value
    priceReportMap.set(price_range, priceEntry)
  }

  const inventoryValues = filteredItems.map(item => Number(inventoryByItem.get(item.id) || 0) * Number(item.unit_price || 0))
  const totalInventoryValue = inventoryValues.reduce((sum, value) => sum + value, 0)
  const totalItems = filteredItems.length
  const lowStockItems = filteredItems.filter(item => Number(inventoryByItem.get(item.id) || 0) <= Number(item.reorder_level || 0)).length

  const activityLogs = (logs || []).filter(log => {
    if (categoryId) {
      const item = filteredItems.find(candidate => candidate.id === log.item_id)
      if (!item) return false
    }

    const logDate = new Date(log.created_at).toISOString()
    if (from && logDate < from) return false
    if (to && logDate > to) return false
    return ['restock', 'sale', 'return', 'cancel', 'adjustment'].includes(log.action)
  })

  const activitySummary = {
    restockCount: activityLogs.filter(log => log.action === 'restock').length,
    saleCount: activityLogs.filter(log => log.action === 'sale').length,
    returnCount: activityLogs.filter(log => log.action === 'return').length,
    cancelCount: activityLogs.filter(log => log.action === 'cancel').length,
    adjustmentCount: activityLogs.filter(log => log.action === 'adjustment').length,
    movementCount: activityLogs.length,
  }

  return NextResponse.json({
    categories,
    categoryReport: Array.from(categoryReportMap.values()).sort((a, b) => b.total_value - a.total_value),
    priceReport: Array.from(priceReportMap.values()).sort((a, b) => {
      const order: Record<string, number> = { Low: 0, Medium: 1, High: 2 }
      return order[a.price_range] - order[b.price_range]
    }),
    summary: {
      totalInventoryValue,
      totalItems,
      lowStockItems,
      generatedAt: new Date().toISOString(),
    },
    activitySummary,
    filters: {
      categoryId,
      from,
      to,
    },
  })
}