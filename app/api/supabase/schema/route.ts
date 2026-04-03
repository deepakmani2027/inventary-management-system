import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

    // Get list of tables from information_schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tablesError) {
      // Fallback: manually return expected tables
      const commonTables = ['items', 'users', 'sales', 'categories', 'orders', 'inventory']
      const schema: Record<string, any> = {}

      for (const tableName of commonTables) {
        try {
          const { data } = await supabase.from(tableName).select('*').limit(1)
          if (data) {
            schema[tableName] = {
              columns: Object.keys(data[0] || {})
            }
          }
        } catch {
          // Table might not exist
        }
      }

      return new Response(
        JSON.stringify({ schema }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Build schema information
    const schema: Record<string, any> = {}

    for (const table of tables || []) {
      const tableName = table.table_name
      try {
        const { data } = await supabase.from(tableName).select('*').limit(1)
        if (data && data.length > 0) {
          schema[tableName] = {
            columns: Object.keys(data[0]),
            sample: data[0],
          }
        } else {
          const { data: emptyData } = await supabase.from(tableName).select('*').limit(0)
          schema[tableName] = {
            columns: emptyData ? Object.keys(emptyData) : [],
          }
        }
      } catch (error) {
        schema[tableName] = {
          columns: [],
          error: 'Failed to fetch columns',
        }
      }
    }

    return new Response(
      JSON.stringify({ schema }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Schema API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
