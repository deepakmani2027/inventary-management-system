import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Helper function to fetch Supabase data for context
async function fetchSupabaseContext(query: string): Promise<string> {
  if (!supabase) {
    return 'Database context unavailable (Supabase not configured).'
  }

  try {
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

    // Select model based on user choice
    const selectedModel = model === 'openai' ? 'openai/gpt-4-turbo' : 'google/gemini-2.0-flash'

    try {
      // Use Vercel AI SDK with the selected model
      const { text } = await generateText({
        model: selectedModel,
        system: systemPrompt,
        messages: formattedMessages,
        temperature: 0.7,
        maxTokens: 1024,
      })

      return new Response(
        JSON.stringify({
          content: text,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (aiError) {
      console.error('AI generation error:', aiError)
      // Fallback to a simple response if API fails
      return new Response(
        JSON.stringify({
          content: 'I apologize, but I encountered an issue processing your request. Please ensure your API keys are properly configured.',
        }),
        {
          status: 500,
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
