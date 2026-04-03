import { getSupabaseClient } from '@/lib/supabase/client'
import {
  getInventoryStats,
  getSalesAnalytics,
  getSystemHealth,
  searchInventory,
  generateInventoryReport,
} from '@/lib/supabase/data-service'

export const maxDuration = 30

// Smart chatbot responses based on keyword detection
async function generateSmartResponse(userMessage: string): Promise<string> {
  const lowerMessage = userMessage.toLowerCase()
  const supabase = getSupabaseClient()

  try {
    // Low stock / Stock alerts
    if (lowerMessage.includes('low stock') || lowerMessage.includes('stock level') || lowerMessage.includes('out of stock')) {
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .lt('stock_quantity', 10)
        .limit(10)

      if (!items || items.length === 0) {
        return '✅ Great news! All items have healthy stock levels (10+ units).'
      }

      let response = `⚠️ **Low Stock Alert** - ${items.length} items need attention:\n\n`
      items.slice(0, 5).forEach((item: any) => {
        response += `• **${item.name}**: ${item.stock_quantity} units (ID: ${item.id})\n`
      })
      return response
    }

    // Sales data / Analytics
    if (lowerMessage.includes('sales') || lowerMessage.includes('revenue') || lowerMessage.includes('analytics') || lowerMessage.includes('trend')) {
      const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!sales || sales.length === 0) {
        return 'No sales data available yet. Create your first sale to see analytics.'
      }

      const totalSales = sales.length
      const totalRevenue = sales.reduce((sum: number, sale: any) => sum + (sale.amount || 0), 0)
      const avgSale = (totalRevenue / totalSales).toFixed(2)

      let response = `📊 **Sales Analytics**\n\n`
      response += `• Total Sales: ${totalSales}\n`
      response += `• Total Revenue: $${totalRevenue.toFixed(2)}\n`
      response += `• Average Sale: $${avgSale}\n`
      response += `• Recent Transactions:\n`

      sales.slice(0, 3).forEach((sale: any) => {
        const date = new Date(sale.created_at).toLocaleDateString()
        response += `  - $${(sale.amount || 0).toFixed(2)} on ${date}\n`
      })

      return response
    }

    // Inventory report / Summary
    if (
      lowerMessage.includes('inventory') ||
      lowerMessage.includes('stock') ||
      lowerMessage.includes('report') ||
      lowerMessage.includes('summary')
    ) {
      const { data: items } = await supabase.from('items').select('*')
      const { data: categories } = await supabase.from('categories').select('*')

      if (!items || items.length === 0) {
        return 'No inventory items found. Start by adding items to your inventory.'
      }

      const totalItems = items.length
      const totalUnits = items.reduce((sum: number, item: any) => sum + (item.stock_quantity || 0), 0)
      const lowStockCount = items.filter((item: any) => item.stock_quantity && item.stock_quantity < 10).length
      const outOfStock = items.filter((item: any) => !item.stock_quantity || item.stock_quantity === 0).length

      let response = `📦 **Inventory Report**\n\n`
      response += `• Total Item Types: ${totalItems}\n`
      response += `• Total Units: ${totalUnits}\n`
      response += `• Low Stock Items: ${lowStockCount}\n`
      response += `• Out of Stock: ${outOfStock}\n`

      if (categories && categories.length > 0) {
        response += `• Categories: ${categories.length}\n`
      }

      return response
    }

    // Search for specific items
    if (lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('show me')) {
      // Extract search term from message
      const searchTerms = lowerMessage
        .replace(/find|search|show me|get|list|what|items?/g, '')
        .trim()
        .split(' ')
        .filter((t) => t.length > 2)

      if (searchTerms.length > 0) {
        const searchTerm = searchTerms[0]
        const { data: items } = await supabase
          .from('items')
          .select('*')
          .ilike('name', `%${searchTerm}%`)
          .limit(5)

        if (items && items.length > 0) {
          let response = `🔍 **Search Results for "${searchTerm}"**\n\n`
          items.forEach((item: any) => {
            response += `• **${item.name}** (ID: ${item.id})\n`
            response += `  Stock: ${item.stock_quantity} units\n`
            if (item.price) {
              response += `  Price: $${item.price}\n`
            }
          })
          return response
        } else {
          return `No items found matching "${searchTerm}". Try a different search term.`
        }
      }
    }

    // Users / Team members
    if (lowerMessage.includes('user') || lowerMessage.includes('staff') || lowerMessage.includes('team') || lowerMessage.includes('member')) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name, role')
        .limit(10)

      if (!users || users.length === 0) {
        return 'No users found in the system yet.'
      }

      let response = `👥 **System Users**\n\n`
      users.forEach((user: any) => {
        response += `• **${user.name || 'Unknown'}** (${user.role || 'Member'})\n`
        response += `  Email: ${user.email}\n`
      })

      return response
    }

    // Categories
    if (lowerMessage.includes('categor') || lowerMessage.includes('type')) {
      const { data: categories } = await supabase.from('categories').select('*')

      if (!categories || categories.length === 0) {
        return 'No categories configured yet. Create categories to organize your inventory.'
      }

      let response = `📁 **Inventory Categories**\n\n`
      categories.forEach((cat: any) => {
        response += `• ${cat.name}\n`
      })

      return response
    }

    // Help / Default response
    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('what can') ||
      lowerMessage.includes('what do') ||
      lowerMessage.includes('capabilities') ||
      lowerMessage.includes('features')
    ) {
      return `🤖 **Available Commands**\n\n
I can help you with:
• **Stock Alerts** - Say "low stock" or "out of stock"
• **Sales Analytics** - Say "sales", "revenue", or "trends"
• **Inventory Report** - Say "inventory", "report", or "summary"
• **Search Items** - Say "find [item name]" or "search for [name]"
• **Users/Team** - Say "users", "team", or "staff"
• **Categories** - Say "categories" or "types"

Just ask me anything about your inventory!`
    }

    // Default helpful response
    return `👋 I'm your inventory assistant. I can help with:
- Stock levels and low stock alerts
- Sales analytics and trends
- Inventory reports
- Searching for items
- Team member information
- Category management

What would you like to know about your inventory?`
  } catch (error) {
    console.error('[v0] Error generating response:', error)
    return '❌ Error processing your request. Please try again or ask about inventory, sales, or users.'
  }
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response(JSON.stringify({ error: 'Last message must be from user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userMessage = lastMessage.content

    // Generate smart response based on database
    const response = await generateSmartResponse(userMessage)

    // Return streaming response compatible with the chatbot UI
    const sseResponse = `data: ${JSON.stringify({
      type: 'text-delta',
      delta: response,
    })}\n\ndata: ${JSON.stringify({
      type: 'text-finished',
    })}\n\ndata: [DONE]\n`

    return new Response(sseResponse, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[v0] Chat API error:', error)
    const errorSse = `data: ${JSON.stringify({
      type: 'text-delta',
      delta: '❌ An error occurred processing your message. Please try again.',
    })}\n\ndata: [DONE]\n`
    
    return new Response(errorSse, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    })
  }
}
