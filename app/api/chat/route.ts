import { streamText, tool, convertToModelMessages } from 'ai'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  getInventoryStats,
  getSalesAnalytics,
  getSystemHealth,
  searchInventory,
  generateInventoryReport,
} from '@/lib/supabase/data-service'
import { z } from 'zod'

export const maxDuration = 30

// Cache for external data with 5-minute TTL
const dataCache = new Map<string, { data: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

// Helper function to fetch Supabase data for context
async function fetchSupabaseContext(): Promise<string> {
  try {
    const supabase = getSupabaseClient()
    
    // Fetch inventory items with low stock filtering
    const { data: items } = await supabase.from('items').select('*').limit(20)
    
    // Fetch users
    const { data: users } = await supabase.from('users').select('id, email, name, role').limit(10)
    
    // Fetch sales
    const { data: sales } = await supabase.from('sales').select('*').limit(15)
    
    // Fetch categories
    const { data: categories } = await supabase.from('categories').select('*')
    
    let context = 'Database Context:\n'
    
    if (items && items.length > 0) {
      context += '\nInventory Items (Sample):\n'
      context += JSON.stringify(items.slice(0, 8), null, 2)
      
      // Add low stock alerts
      const lowStockItems = items.filter((item: any) => item.stock_quantity && item.stock_quantity < 10)
      if (lowStockItems.length > 0) {
        context += '\n⚠️ LOW STOCK ALERTS:\n'
        context += JSON.stringify(lowStockItems, null, 2)
      }
    }
    
    if (users && users.length > 0) {
      context += '\nUsers (Sample):\n'
      context += JSON.stringify(users.slice(0, 5), null, 2)
    }
    
    if (sales && sales.length > 0) {
      context += '\nSales History (Sample):\n'
      context += JSON.stringify(sales.slice(0, 5), null, 2)
    }
    
    if (categories && categories.length > 0) {
      context += '\nCategories:\n'
      context += JSON.stringify(categories, null, 2)
    }
    
    return context
  } catch (error) {
    console.error('[v0] Error fetching Supabase context:', error)
    return 'Database context unavailable.'
  }
}

// Fetch data from external inventory website
async function fetchExternalInventoryData(): Promise<string> {
  try {
    // Check cache first
    const cached = dataCache.get('external-inventory')
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Fetch from external website
    const response = await fetch('https://inventory-hitk.vercel.app/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`)
    }

    const html = await response.text()
    
    // Extract JSON data from the HTML (looking for script tags with data)
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/)
    if (!jsonMatch) {
      return 'External inventory data format not recognized.'
    }

    const externalData = JSON.stringify(jsonMatch[1]).slice(0, 500)
    
    // Cache the result
    dataCache.set('external-inventory', {
      data: externalData,
      timestamp: Date.now()
    })

    return externalData
  } catch (error) {
    console.error('[v0] Error fetching external data:', error)
    return 'External inventory data unavailable.'
  }
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Convert client messages to model format if needed
    const modelMessages = await convertToModelMessages(messages)

    // Fetch enriched context from multiple sources
    const [dbContext, externalData] = await Promise.all([
      fetchSupabaseContext(),
      fetchExternalInventoryData()
    ])

    const systemPrompt = `You are an advanced AI inventory management assistant with real-time access to database and external inventory systems.

DATABASE CONTEXT:
${dbContext}

EXTERNAL INVENTORY DATA:
${externalData}

CAPABILITIES:
1. Real-time inventory tracking and low stock alerts
2. Sales analytics and trend analysis
3. User/staff management and role-based information
4. Multi-source data integration (local DB + external systems)
5. Predictive insights for stock management

RESPONSE GUIDELINES:
- Always provide data-driven insights when possible
- Highlight critical information (low stock, urgent issues)
- For inventory queries, check both internal DB and external data
- Provide actionable recommendations
- Be concise but informative
- Use formatting for clarity (bullet points, emphasis on key metrics)`

    // Define tools for advanced queries with proper error handling
    const tools = {
      searchInventory: tool({
        description: 'Search inventory items with advanced filtering',
        parameters: z.object({
          query: z.string().describe('Search term for item name'),
          category: z.string().optional().describe('Filter by category ID'),
          maxPrice: z.number().optional().describe('Maximum price filter'),
          minStock: z.number().optional().describe('Minimum stock quantity'),
        }),
        execute: async ({ query, category, maxPrice, minStock }) => {
          try {
            const results = await searchInventory(query, { category, maxPrice, minStock, limit: 10 })
            return {
              success: true,
              results,
              count: results.length,
              timestamp: new Date().toISOString(),
            }
          } catch (error) {
            console.error('[v0] Search error:', error)
            return {
              success: false,
              error: 'Failed to search inventory',
              results: [],
            }
          }
        },
      }),

      getInventoryMetrics: tool({
        description: 'Get real-time inventory statistics and metrics',
        parameters: z.object({
          includeDetails: z
            .boolean()
            .optional()
            .describe('Include detailed breakdown of inventory status'),
        }),
        execute: async ({ includeDetails }) => {
          try {
            const stats = await getInventoryStats()
            if (!stats) {
              return {
                success: false,
                error: 'Unable to fetch inventory statistics',
              }
            }

            const result: any = {
              success: true,
              stats,
              timestamp: new Date().toISOString(),
            }

            if (includeDetails) {
              const supabase = getSupabaseClient()
              const { data: items } = await supabase.from('items').select('*')
              result.lowStockItems = items
                ?.filter((i: any) => i.stock_quantity && i.stock_quantity < 10)
                .slice(0, 5)
              result.outOfStockItems = items
                ?.filter((i: any) => !i.stock_quantity || i.stock_quantity === 0)
                .slice(0, 5)
            }

            return result
          } catch (error) {
            console.error('[v0] Metrics error:', error)
            return {
              success: false,
              error: 'Failed to fetch inventory metrics',
            }
          }
        },
      }),

      getSalesData: tool({
        description: 'Get sales analytics and performance data',
        parameters: z.object({
          period: z
            .enum(['day', 'week', 'month'])
            .optional()
            .describe('Time period for analysis'),
        }),
        execute: async ({ period = 'week' }) => {
          try {
            const analytics = await getSalesAnalytics(period as 'day' | 'week' | 'month')
            if (!analytics) {
              return {
                success: false,
                error: 'No sales data available',
              }
            }

            return {
              success: true,
              analytics,
              timestamp: new Date().toISOString(),
            }
          } catch (error) {
            console.error('[v0] Sales data error:', error)
            return {
              success: false,
              error: 'Failed to fetch sales data',
            }
          }
        },
      }),

      getSystemHealth: tool({
        description: 'Get overall system health and key performance indicators',
        parameters: z.object({}),
        execute: async () => {
          try {
            const health = await getSystemHealth()
            return {
              success: !!health,
              health,
              timestamp: new Date().toISOString(),
            }
          } catch (error) {
            console.error('[v0] Health check error:', error)
            return {
              success: false,
              error: 'Failed to check system health',
            }
          }
        },
      }),

      generateReport: tool({
        description: 'Generate a detailed comprehensive inventory report',
        parameters: z.object({
          reportType: z
            .enum(['inventory', 'sales', 'health', 'detailed'])
            .describe('Type of report to generate'),
        }),
        execute: async ({ reportType }) => {
          try {
            if (reportType === 'inventory' || reportType === 'detailed') {
              const report = await generateInventoryReport()
              return {
                success: !!report,
                report,
                type: reportType,
                timestamp: new Date().toISOString(),
              }
            } else if (reportType === 'sales') {
              const analytics = await getSalesAnalytics('month')
              return {
                success: !!analytics,
                analytics,
                type: reportType,
                timestamp: new Date().toISOString(),
              }
            } else if (reportType === 'health') {
              const health = await getSystemHealth()
              return {
                success: !!health,
                health,
                type: reportType,
                timestamp: new Date().toISOString(),
              }
            }

            return {
              success: false,
              error: 'Unknown report type',
            }
          } catch (error) {
            console.error('[v0] Report generation error:', error)
            return {
              success: false,
              error: 'Failed to generate report',
            }
          }
        },
      }),

      alertLowStock: tool({
        description: 'Check for low stock items and create alerts',
        parameters: z.object({
          threshold: z.number().optional().describe('Stock level threshold (default: 10)'),
        }),
        execute: async ({ threshold = 10 }) => {
          try {
            const supabase = getSupabaseClient()
            const { data: items } = await supabase
              .from('items')
              .select('*')
              .lt('stock_quantity', threshold)

            const alerts = items
              ?.map((item: any) => ({
                itemId: item.id,
                itemName: item.name,
                currentStock: item.stock_quantity,
                threshold,
                severity: item.stock_quantity === 0 ? 'critical' : 'warning',
              }))
              .sort((a: any, b: any) => a.currentStock - b.currentStock)

            return {
              success: true,
              alerts: alerts || [],
              alertCount: alerts?.length || 0,
              timestamp: new Date().toISOString(),
            }
          } catch (error) {
            console.error('[v0] Alert check error:', error)
            return {
              success: false,
              error: 'Failed to check for low stock items',
              alerts: [],
            }
          }
        },
      }),
    }

    // Stream text response with tools
    const result = streamText({
      model: 'openai/gpt-4-turbo-preview',
      system: systemPrompt,
      messages: modelMessages,
      tools: tools,
      temperature: 0.7,
      maxTokens: 2048,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[v0] Chat API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
