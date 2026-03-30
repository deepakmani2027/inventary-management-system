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

function getBucketKey(date: Date, granularity: 'day' | 'week') {
  if (granularity === 'week') {
    const day = date.getUTCDay()
    const mondayOffset = (day + 6) % 7
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    monday.setUTCDate(monday.getUTCDate() - mondayOffset)
    return monday.toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function getBucketLabel(key: string, granularity: 'day' | 'week') {
  if (granularity === 'week') {
    const start = new Date(`${key}T00:00:00.000Z`)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    return `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`
  }

  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString('en-GB')
}

export async function GET(request: Request) {
  const auth = await getAuthorizedUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const from = normalizeDate(searchParams.get('from'))
  const to = normalizeDate(searchParams.get('to'))
  const categoryId = searchParams.get('categoryId')?.trim() || ''
  const itemId = searchParams.get('itemId')?.trim() || ''
  const granularity = searchParams.get('granularity') === 'week' ? 'week' : 'day'

  const [
    { data: categories, error: categoriesError },
    { data: items, error: itemsError },
    { data: inventory, error: inventoryError },
    { data: logs, error: logsError },
  ] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').order('name', { ascending: true }),
    supabaseAdmin.from('items').select('id, name, category_id').order('name', { ascending: true }),
    supabaseAdmin.from('inventory').select('item_id, quantity'),
    supabaseAdmin.from('inventory_logs').select('id, item_id, action, quantity_changed, created_at').order('created_at', { ascending: true }),
  ])

  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (inventoryError) return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 })

  const categoryById = new Map((categories || []).map(category => [category.id, category.name]))
  const itemById = new Map((items || []).map(item => [item.id, item]))
  const itemNameById = new Map((items || []).map(item => [item.id, item.name]))
  const inventoryByItem = new Map((inventory || []).map(row => [row.item_id, Number(row.quantity || 0)]))

  const availableItemIds = new Set((items || []).map(item => item.id))
  const filteredItems = (items || []).filter(item => {
    if (categoryId && item.category_id !== categoryId) return false
    if (itemId && item.id !== itemId) return false
    return true
  })
  const filteredItemIds = new Set(filteredItems.map(item => item.id))

  const normalizedLogs = (logs || [])
    .filter(log => availableItemIds.has(log.item_id))
    .filter(log => {
      const item = itemById.get(log.item_id)
      if (!item) return false
      if (categoryId && item.category_id !== categoryId) return false
      if (itemId && log.item_id !== itemId) return false

      const logDate = new Date(log.created_at).toISOString()
      if (from && logDate < from) return false
      if (to && logDate > to) return false
      return ['restock', 'sale', 'return', 'cancel'].includes(log.action)
    })

  const movementMap = new Map<string, { date: string; sales: number; restock: number; returns: number; cancels: number; net: number }>()
  const dailyItemMap = new Map<string, Map<string, number>>()

  for (const log of normalizedLogs) {
    const date = getBucketKey(new Date(log.created_at), granularity)
    const current = movementMap.get(date) || { date, sales: 0, restock: 0, returns: 0, cancels: 0, net: 0 }
    const change = Number(log.quantity_changed || 0)

    if (log.action === 'sale') {
      current.sales += Math.abs(change)
      current.net -= Math.abs(change)
    } else if (log.action === 'restock') {
      current.restock += change
      current.net += change
    } else if (log.action === 'return') {
      current.returns += change
      current.net += change
    } else if (log.action === 'cancel') {
      current.cancels += change
      current.net += change
    }

    movementMap.set(date, current)

    const perItem = dailyItemMap.get(log.item_id) || new Map<string, number>()
    perItem.set(date, (perItem.get(date) || 0) + (log.action === 'sale' ? -Math.abs(change) : Math.abs(change)))
    dailyItemMap.set(log.item_id, perItem)
  }

  const sortedMovement = Array.from(movementMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))

  let runningStock = 0
  const movementSeries = sortedMovement.map(point => {
    runningStock += point.net
    return {
      date: getBucketLabel(point.date, granularity),
      sales: point.sales,
      restock: point.restock,
      returns: point.returns,
      cancels: point.cancels,
      net: point.net,
      stockLevel: runningStock,
      rawDate: point.date,
    }
  })

  const totalSales = normalizedLogs.filter(log => log.action === 'sale').reduce((sum, log) => sum + Math.abs(Number(log.quantity_changed || 0)), 0)
  const totalRestocked = normalizedLogs.filter(log => log.action === 'restock').reduce((sum, log) => sum + Number(log.quantity_changed || 0), 0)
  const totalReturns = normalizedLogs.filter(log => log.action === 'return').reduce((sum, log) => sum + Number(log.quantity_changed || 0), 0)
  const totalCancels = normalizedLogs.filter(log => log.action === 'cancel').reduce((sum, log) => sum + Number(log.quantity_changed || 0), 0)
  const netGrowth = totalRestocked + totalReturns + totalCancels - totalSales

  const itemActivity = filteredItems.map(item => {
    const itemLogs = normalizedLogs.filter(log => log.item_id === item.id)
    const sales = itemLogs.filter(log => log.action === 'sale').reduce((sum, log) => sum + Math.abs(Number(log.quantity_changed || 0)), 0)
    const restock = itemLogs.filter(log => log.action === 'restock').reduce((sum, log) => sum + Number(log.quantity_changed || 0), 0)
    const returns = itemLogs.filter(log => log.action === 'return').reduce((sum, log) => sum + Number(log.quantity_changed || 0), 0)
    const cancels = itemLogs.filter(log => log.action === 'cancel').reduce((sum, log) => sum + Number(log.quantity_changed || 0), 0)
    const currentStock = Number(inventoryByItem.get(item.id) || 0)
    const net = restock + returns + cancels - sales
    const score = sales + restock + returns + cancels

    return {
      item_id: item.id,
      item_name: item.name,
      category: categoryById.get(item.category_id) || 'Unassigned',
      sales,
      restock,
      returns,
      cancels,
      net,
      current_stock: currentStock,
      sales_frequency: sales,
      activity_score: score,
    }
  })

  const fastMoving = [...itemActivity].sort((a, b) => b.sales_frequency - a.sales_frequency || b.activity_score - a.activity_score).slice(0, 5)
  const slowMoving = [...itemActivity].sort((a, b) => a.sales_frequency - b.sales_frequency || a.activity_score - b.activity_score).slice(0, 5)

  const lastSeven = movementSeries.slice(-7)
  const negativeDays = lastSeven.filter(day => day.sales > day.restock).length
  const positiveDays = lastSeven.filter(day => day.restock > day.sales).length

  const alerts = [] as Array<{ type: 'negative' | 'positive'; title: string; message: string }>
  if (negativeDays >= 3) {
    alerts.push({
      type: 'negative',
      title: 'Stock decreasing rapidly',
      message: 'Sales are outpacing restocks on multiple recent days. Review replenishment immediately.',
    })
  }
  if (positiveDays >= 4) {
    alerts.push({
      type: 'positive',
      title: 'Overstock warning',
      message: 'Restocks are consistently higher than sales. Consider reducing incoming stock or promoting slow movers.',
    })
  }

  const summary = {
    totalSales,
    totalRestocked,
    totalReturns,
    totalCancels,
    netGrowth,
  }

  return NextResponse.json({
    categories,
    items: filteredItems,
    movementSeries,
    itemActivity,
    fastMoving,
    slowMoving,
    alerts,
    summary,
    filters: {
      from,
      to,
      categoryId,
      itemId,
      granularity,
    },
  })
}