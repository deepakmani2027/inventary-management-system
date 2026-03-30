import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''

  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }] = await Promise.all([
    supabaseAdmin
      .from('categories')
      .select('id, name, created_at')
      .order('name', { ascending: true }),
    supabaseAdmin.from('items').select('category_id'),
  ])

  if (categoriesError) {
    return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  }

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const linkedItemCounts = new Map<string, number>()

  for (const item of items || []) {
    if (!item.category_id) continue
    linkedItemCounts.set(item.category_id, (linkedItemCounts.get(item.category_id) || 0) + 1)
  }

  const filteredCategories = (categories || []).filter(category => {
    if (!search) return true
    return category.name.toLowerCase().includes(search.toLowerCase())
  })

  return NextResponse.json({
    categories: filteredCategories.map(category => ({
      ...category,
      item_count: linkedItemCounts.get(category.id) || 0,
    })),
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const name = String(body.name || '').trim()

  if (name.length < 2) {
    return NextResponse.json({ error: 'Category name must be at least 2 characters' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ name })
    .select('id, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category: data }, { status: 201 })
}