import { getSupabaseClient } from './client'

export interface InventoryStats {
  totalItems: number
  lowStockCount: number
  outOfStockCount: number
  averageStockLevel: number
  lastUpdated: Date
}

export interface SalesAnalytics {
  totalSales: number
  periodRevenue: number
  averageOrderValue: number
  topProducts: any[]
  timeRange: string
}

/**
 * Fetch comprehensive inventory statistics
 */
export async function getInventoryStats(): Promise<InventoryStats | null> {
  try {
    const supabase = getSupabaseClient()
    const { data: items } = await supabase.from('items').select('stock_quantity, price')

    if (!items || items.length === 0) {
      return null
    }

    const totalItems = items.length
    const lowStockCount = items.filter((i: any) => i.stock_quantity && i.stock_quantity < 10).length
    const outOfStockCount = items.filter((i: any) => !i.stock_quantity || i.stock_quantity === 0)
      .length
    const averageStockLevel =
      items.reduce((sum: number, item: any) => sum + (item.stock_quantity || 0), 0) / totalItems

    return {
      totalItems,
      lowStockCount,
      outOfStockCount,
      averageStockLevel: Math.round(averageStockLevel),
      lastUpdated: new Date(),
    }
  } catch (error) {
    console.error('[v0] Error fetching inventory stats:', error)
    return null
  }
}

/**
 * Fetch sales analytics for a given time period
 */
export async function getSalesAnalytics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<
  SalesAnalytics | null
> {
  try {
    const supabase = getSupabaseClient()

    // Calculate date range
    const now = new Date()
    let startDate = new Date()

    switch (timeRange) {
      case 'day':
        startDate.setDate(now.getDate() - 1)
        break
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
    }

    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (!sales || sales.length === 0) {
      return null
    }

    // Calculate analytics
    const totalSales = sales.length
    const periodRevenue = sales.reduce((sum: number, sale: any) => sum + (sale.amount || 0), 0)
    const averageOrderValue = totalSales > 0 ? periodRevenue / totalSales : 0

    // Group by product to find top sellers
    const productMap = new Map<string, number>()
    sales.forEach((sale: any) => {
      const productId = sale.product_id || sale.item_id
      if (productId) {
        productMap.set(productId, (productMap.get(productId) || 0) + 1)
      }
    })

    const topProducts = Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productId, count]) => ({
        productId,
        count,
      }))

    return {
      totalSales,
      periodRevenue,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      topProducts,
      timeRange,
    }
  } catch (error) {
    console.error('[v0] Error fetching sales analytics:', error)
    return null
  }
}

/**
 * Get summary of system health and key metrics
 */
export async function getSystemHealth() {
  try {
    const [inventoryStats, salesAnalytics] = await Promise.all([
      getInventoryStats(),
      getSalesAnalytics('week'),
    ])

    return {
      inventory: inventoryStats,
      sales: salesAnalytics,
      timestamp: new Date(),
      status: inventoryStats && salesAnalytics ? 'healthy' : 'degraded',
    }
  } catch (error) {
    console.error('[v0] Error fetching system health:', error)
    return null
  }
}

/**
 * Search inventory items with advanced filtering
 */
export async function searchInventory(
  query: string,
  options: {
    category?: string
    maxPrice?: number
    minStock?: number
    limit?: number
  } = {}
) {
  try {
    const supabase = getSupabaseClient()
    const { category, maxPrice, minStock, limit = 10 } = options

    let queryBuilder = supabase.from('items').select('*')

    if (query) {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`)
    }

    if (category) {
      queryBuilder = queryBuilder.eq('category_id', category)
    }

    if (maxPrice) {
      queryBuilder = queryBuilder.lte('price', maxPrice)
    }

    if (typeof minStock === 'number') {
      queryBuilder = queryBuilder.gte('stock_quantity', minStock)
    }

    const { data: items } = await queryBuilder.limit(limit)

    return items || []
  } catch (error) {
    console.error('[v0] Error searching inventory:', error)
    return []
  }
}

/**
 * Get detailed report for inventory management
 */
export async function generateInventoryReport() {
  try {
    const supabase = getSupabaseClient()

    const [itemsResponse, categoriesResponse, salesResponse] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('sales').select('*').limit(100),
    ])

    const items = itemsResponse.data || []
    const categories = categoriesResponse.data || []
    const sales = salesResponse.data || []

    // Group items by category
    const itemsByCategory = new Map<string, number>()
    items.forEach((item: any) => {
      const category = item.category_id || 'Uncategorized'
      itemsByCategory.set(category, (itemsByCategory.get(category) || 0) + 1)
    })

    // Calculate metrics
    const totalItemValue = items.reduce(
      (sum: number, item: any) => sum + ((item.price || 0) * (item.stock_quantity || 0)),
      0
    )

    return {
      summary: {
        totalItems: items.length,
        totalValue: Math.round(totalItemValue * 100) / 100,
        totalCategories: categories.length,
        recentSales: sales.length,
      },
      categoryBreakdown: Object.fromEntries(itemsByCategory),
      lowStockItems: items
        .filter((i: any) => i.stock_quantity && i.stock_quantity < 10)
        .slice(0, 10),
      topSellingCategories: categories.slice(0, 5),
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[v0] Error generating report:', error)
    return null
  }
}
