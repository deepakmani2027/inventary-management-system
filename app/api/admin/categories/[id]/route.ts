import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json()
  const { id } = await params
  const name = String(body.name || '').trim()

  if (name.length < 2) {
    return NextResponse.json({ error: 'Category name must be at least 2 characters' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select('id, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('items')
    .select('id')
    .eq('category_id', id)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const itemIds = (items || []).map(item => item.id)

  if (itemIds.length > 0) {
    const [saleItemsResult, logsResult, inventoryResult] = await Promise.all([
      supabaseAdmin.from('sale_items').delete().in('item_id', itemIds),
      supabaseAdmin.from('inventory_logs').delete().in('item_id', itemIds),
      supabaseAdmin.from('inventory').delete().in('item_id', itemIds),
    ])

    const cascadeError = saleItemsResult.error || logsResult.error || inventoryResult.error

    if (cascadeError) {
      return NextResponse.json({ error: cascadeError.message }, { status: 500 })
    }

    const { error: itemDeleteError } = await supabaseAdmin.from('items').delete().in('id', itemIds)

    if (itemDeleteError) {
      return NextResponse.json({ error: itemDeleteError.message }, { status: 500 })
    }
  }

  const { error: categoryDeleteError } = await supabaseAdmin.from('categories').delete().eq('id', id)

  if (categoryDeleteError) {
    return NextResponse.json({ error: categoryDeleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}