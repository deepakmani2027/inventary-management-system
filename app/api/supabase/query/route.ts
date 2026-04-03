import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { table, filters = {}, limit = 50 } = await request.json()

    if (!table) {
      return new Response(
        JSON.stringify({ error: 'Table name required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build query
    let query = supabase.from(table).select('*')

    // Apply filters if provided
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        query = query.eq(key, value)
      }
    }

    // Apply limit
    const { data, error } = await query.limit(Math.min(limit, 100))

    if (error) {
      throw new Error(error.message)
    }

    return new Response(
      JSON.stringify({ data }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Query API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to query data',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
