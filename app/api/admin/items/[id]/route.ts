import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function parseNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : Number.NaN
}

async function deleteItemDependencies(itemId: string) {
  const [saleItemsResult, logsResult, inventoryResult] = await Promise.all([
    supabaseAdmin.from('sale_items').delete().eq('item_id', itemId),
    supabaseAdmin.from('inventory_logs').delete().eq('item_id', itemId),
    supabaseAdmin.from('inventory').delete().eq('item_id', itemId),
  ])

  return saleItemsResult.error || logsResult.error || inventoryResult.error || null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const updates: Record<string, string | number> = {}

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (name.length < 2) {
      return NextResponse.json({ error: 'Item name must be at least 2 characters' }, { status: 400 })
    }
    updates.name = name
  }

  if (body.category_id !== undefined) {
    const categoryId = String(body.category_id || '').trim()
    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }
    updates.category_id = categoryId
  }

  if (body.unit_price !== undefined) {
    const unitPrice = parseNumber(body.unit_price)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 })
    }
    updates.unit_price = unitPrice
  }

  if (body.reorder_level !== undefined) {
    const reorderLevel = parseNumber(body.reorder_level)
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      return NextResponse.json({ error: 'Reorder level must be 0 or more' }, { status: 400 })
    }
    updates.reorder_level = reorderLevel
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No item updates provided' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('items')
    .update(updates)
    .eq('id', id)
    .select('id, name, category_id, unit_price, reorder_level, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Item name already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.stock !== undefined) {
    const stock = parseNumber(body.stock)
    if (!Number.isFinite(stock) || stock < 0) {
      return NextResponse.json({ error: 'Stock must be 0 or more' }, { status: 400 })
    }

    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .upsert({ item_id: id, quantity: stock }, { onConflict: 'item_id' })

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 500 })
    }

    return NextResponse.json({ item: { ...data, stock } })
  }

  const { data: inventoryData } = await supabaseAdmin
    .from('inventory')
    .select('quantity')
    .eq('item_id', id)
    .maybeSingle()

  return NextResponse.json({ item: { ...data, stock: inventoryData?.quantity || 0 } })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const dependencyError = await deleteItemDependencies(id)
  if (dependencyError) {
    return NextResponse.json({ error: dependencyError.message }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('items').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}