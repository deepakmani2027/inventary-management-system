import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { getSupabaseClient } from '@/lib/supabase/client'

export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '')
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper function to fetch Supabase data for context
async function fetchSupabaseContext(query: string): Promise<string> {
  try {
    const supabase = getSupabaseClient()
    
    // Fetch inventory items
    const { data: items } = await supabase.from('items').select('*').limit(10)
    
    // Fetch users
    const { data: users } = await supabase.from('users').select('id, email, name').limit(5)
    
    // Fetch sales
    const { data: sales } = await supabase.from('sales').select('*').limit(10)
    
    // Fetch categories
    const { data: categories } = await supabase.from('categories').select('*')
    
    let context = 'Database Context:\n'
    
    if (items && items.length > 0) {
      context += '\nInventory Items:\n'
      context += JSON.stringify(items.slice(0, 5), null, 2)
    }
    
    if (users && users.length > 0) {
      context += '\nUsers:\n'
      context += JSON.stringify(users, null, 2)
    }
    
    if (sales && sales.length > 0) {
      context += '\nSales History:\n'
      context += JSON.stringify(sales.slice(0, 5), null, 2)
    }
    
    if (categories && categories.length > 0) {
      context += '\nCategories:\n'
      context += JSON.stringify(categories, null, 2)
    }
    
    return context
  } catch (error) {
    console.error('Error fetching Supabase context:', error)
    return 'Database context unavailable.'
  }
}

export async function POST(request: Request) {
  try {
    const { messages, model = 'gemini' } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const lastMessage = messages[messages.length - 1]?.content
    if (!lastMessage) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch context from Supabase
    const dbContext = await fetchSupabaseContext(lastMessage)
    
    // Build system prompt
    const systemPrompt = `You are a helpful inventory management assistant. You have access to the following database information:

${dbContext}

You help users with:
1. Inventory Management: Stock levels, item availability, product information
2. User Information: Staff and customer details
3. Sales Analytics: Historical sales data, trends, and insights
4. Category Management: Product classifications and organization

Always provide clear, concise answers. When relevant, provide data-driven insights from the database context provided above.`

    // Format messages for API
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Route to selected model
    if (model === 'openai') {
      // Use OpenAI
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedMessages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      })

      return new Response(
        JSON.stringify({
          content: response.choices[0]?.message?.content || 'No response generated',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else {
      // Use Gemini (default)
      const model_instance = genAI.getGenerativeModel({ model: 'gemini-pro' })
      
      const conversationHistory = formattedMessages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }))

      const chat = model_instance.startChat({
        history: conversationHistory.slice(0, -1), // Exclude the last user message
      })

      const result = await chat.sendMessage(
        `${systemPrompt}\n\nUser: ${lastMessage}`
      )
      const response = await result.response
      const text = response.text()

      return new Response(
        JSON.stringify({
          content: text,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    console.error('Chat API error:', error)
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
