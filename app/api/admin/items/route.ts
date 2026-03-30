import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function parseNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : Number.NaN
}

async function deleteItemDependencies(itemIds: string[]) {
  if (itemIds.length === 0) {
    return null
  }

  const [saleItemsResult, logsResult, inventoryResult] = await Promise.all([
    supabaseAdmin.from('sale_items').delete().in('item_id', itemIds),
    supabaseAdmin.from('inventory_logs').delete().in('item_id', itemIds),
    supabaseAdmin.from('inventory').delete().in('item_id', itemIds),
  ])

  return saleItemsResult.error || logsResult.error || inventoryResult.error || null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const categoryId = searchParams.get('categoryId')?.trim() || ''

  const [{ data: items, error: itemsError }, { data: categories, error: categoriesError }, { data: inventory, error: inventoryError }] = await Promise.all([
    supabaseAdmin
      .from('items')
      .select('id, name, category_id, unit_price, reorder_level, created_at')
      .order('name', { ascending: true }),
    supabaseAdmin.from('categories').select('id, name').order('name', { ascending: true }),
    supabaseAdmin.from('inventory').select('item_id, quantity'),
  ])

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  if (categoriesError) {
    return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  }

  if (inventoryError) {
    return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  }

  const inventoryByItem = new Map<string, number>()
  for (const row of inventory || []) {
    inventoryByItem.set(row.item_id, row.quantity)
  }

  const categoryNameById = new Map((categories || []).map(category => [category.id, category.name]))

  const filteredItems = (items || []).filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryId || item.category_id === categoryId
    return matchesSearch && matchesCategory
  }).map(item => ({
    ...item,
    category_name: categoryNameById.get(item.category_id) || 'Unassigned',
    stock: inventoryByItem.get(item.id) || 0,
  }))

  return NextResponse.json({
    items: filteredItems,
    categories,
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const name = String(body.name || '').trim()
  const categoryId = String(body.category_id || '').trim()
  const unitPrice = parseNumber(body.unit_price)
  const stock = parseNumber(body.stock)
  const reorderLevel = parseNumber(body.reorder_level)

  if (name.length < 2) {
    return NextResponse.json({ error: 'Item name must be at least 2 characters' }, { status: 400 })
  }

  if (!categoryId) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 })
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 })
  }

  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: 'Stock must be 0 or more' }, { status: 400 })
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('items')
    .insert({
      name,
      category_id: categoryId,
      unit_price: unitPrice,
      reorder_level: Number.isFinite(reorderLevel) && reorderLevel >= 0 ? reorderLevel : 10,
    })
    .select('id, name, category_id, unit_price, reorder_level, created_at')
    .single()

  if (itemError) {
    if (itemError.code === '23505') {
      return NextResponse.json({ error: 'Item name already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: itemError.message }, { status: 500 })
  }

  const { error: inventoryError } = await supabaseAdmin
    .from('inventory')
    .upsert({ item_id: item.id, quantity: stock }, { onConflict: 'item_id' })

  if (inventoryError) {
    return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  }

  return NextResponse.json({ item: { ...item, stock } }, { status: 201 })
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.map((value: unknown) => String(value)).filter(Boolean) : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No items selected' }, { status: 400 })
  }

  const dependencyError = await deleteItemDependencies(ids)
  if (dependencyError) {
    return NextResponse.json({ error: dependencyError.message }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('items').delete().in('id', ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}