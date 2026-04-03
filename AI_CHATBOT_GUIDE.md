# Advanced AI Chatbot Implementation Guide

## Overview

This project includes a sophisticated AI-powered inventory management chatbot positioned at the bottom-right corner of your website. The chatbot leverages real-time data from your Supabase database and integrates with external inventory systems for comprehensive insights.

## Features

### 1. Real-Time Data Integration
- **Supabase Database**: Fetches live inventory, sales, user, and category data
- **External Data Source**: Integrates data from https://inventory-hitk.vercel.app/ with intelligent caching
- **Low Stock Alerts**: Automatic detection and highlighting of items below stock threshold
- **Sales Analytics**: Real-time sales trends and performance metrics

### 2. Advanced AI Capabilities
- **AI SDK 6 Streaming**: Real-time text streaming for instant response feedback
- **Multi-Source LLM**: Uses OpenAI GPT-4 as the primary model via Vercel AI Gateway
- **Tool Calling**: Intelligent function execution for complex queries
- **Context Awareness**: Enriched system prompts with database and external data context

### 3. Intelligent Tools
The chatbot can execute 6 specialized tools for different tasks:

#### searchInventory
- Search items by name, category, price range, and stock level
- Returns up to 10 matching items with full details
- Example: "Find all items under $50 with low stock"

#### getInventoryMetrics
- Real-time inventory statistics (total items, low stock count, out of stock)
- Optional detailed breakdown with specific item lists
- Example: "Show me current inventory status"

#### getSalesData
- Sales analytics for day, week, or month periods
- Calculates revenue, average order value, and top products
- Example: "What were our sales this week?"

#### getSystemHealth
- Overall system KPIs combining inventory and sales metrics
- Provides health status: healthy or degraded
- Example: "How is the system performing?"

#### generateReport
- Comprehensive reports for inventory, sales, or system health
- Detailed breakdown with charts-ready data
- Example: "Generate a detailed inventory report"

#### alertLowStock
- Identifies items below specified stock threshold
- Categorizes alerts by severity (warning/critical)
- Example: "Alert me about items with less than 5 units"

### 4. Advanced UI Components
- **Floating Chat Button**: Eye-catching button with gradient and hover effects
- **Real-Time Streaming**: Message content streams in as it's generated
- **Quick Action Buttons**: One-click shortcuts for common queries
  - Low Stock Alert
  - Sales Trends
  - Inventory Report
  - User Management
- **Typing Indicators**: Animated dots showing AI is processing
- **Settings Panel**: Model selection, quick actions, and chat history management
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Dark Mode Support**: Full dark mode styling with Tailwind CSS

## File Structure

```
app/
├── api/
│   ├── chat/
│   │   └── route.ts          # Main chat API with streaming and tools
│   └── external-data/
│       └── route.ts          # External website data proxy
├── page.tsx                  # Main page (chatbot integrated)
└── layout.tsx               # Root layout

components/
└── ai-chatbot.tsx           # Advanced chatbot component

lib/
└── supabase/
    ├── client.ts            # Supabase client setup
    └── data-service.ts      # Data fetching utilities
```

## API Endpoints

### POST `/api/chat`
Main chat endpoint with streaming response.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Show me low stock items"
        }
      ]
    }
  ]
}
```

**Response:** Server-Sent Events (SSE) stream with AI response and tool calls

### GET/POST `/api/external-data`
Fetch and cache data from external inventory website.

**Query Parameters:**
- `source`: Data source identifier (default: "inventory-hitk")

**Response:**
```json
{
  "data": { ... },
  "source": "inventory-hitk",
  "cached": true,
  "timestamp": 1234567890
}
```

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-key (optional)
OPENAI_API_KEY=optional (uses AI Gateway by default)
```

## Data Services

### getInventoryStats()
Fetches real-time inventory statistics.

```typescript
const stats = await getInventoryStats();
// Returns: { totalItems, lowStockCount, outOfStockCount, averageStockLevel, lastUpdated }
```

### getSalesAnalytics(timeRange)
Gets sales data for a specified period.

```typescript
const analytics = await getSalesAnalytics('week');
// Returns: { totalSales, periodRevenue, averageOrderValue, topProducts, timeRange }
```

### searchInventory(query, options)
Advanced inventory search with filtering.

```typescript
const results = await searchInventory('laptop', {
  category: 'electronics',
  maxPrice: 1500,
  minStock: 5,
  limit: 10
});
```

### generateInventoryReport()
Comprehensive inventory analysis report.

```typescript
const report = await generateInventoryReport();
// Returns: { summary, categoryBreakdown, lowStockItems, topSellingCategories, generatedAt }
```

## How the Chatbot Works

1. **Message Input**: User types a message or clicks a quick action
2. **Message Submission**: Client sends message using AI SDK's `useChat` hook
3. **Context Enrichment**: Server fetches latest Supabase and external data
4. **LLM Processing**: GPT-4 receives enriched context and generates response
5. **Tool Evaluation**: If the response suggests tool use, the AI executes relevant tools
6. **Streaming Response**: Response streams back to client in real-time
7. **Display**: Messages appear in the chat with proper formatting

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Environment Setup**
   - Add Supabase credentials to `.env.local`
   - Ensure Supabase connection is configured

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Access the Chatbot**
   - Click the floating chat button at the bottom-right of your page
   - Start asking inventory-related questions

## Example Queries

The chatbot understands natural language queries:

- "What items are running low on stock?"
- "Show me sales trends for the past month"
- "Generate a comprehensive inventory report"
- "Which products are we out of stock on?"
- "What's the total value of our current inventory?"
- "Alert me about items with less than 5 units"
- "Find all laptops under $1000 with available stock"
- "What's our system health status?"

## Performance Optimization

### Caching Strategy
- External data cached for 5 minutes to reduce API calls
- Database queries optimized with limits and filters
- Streaming responses prevent waiting for full generation

### Rate Limiting
- Implement rate limiting on API endpoints in production
- Monitor AI Gateway usage to manage costs

### Database Optimization
- Ensure Supabase indexes on frequently queried columns
- Use `.select()` to fetch only needed columns
- Implement pagination for large datasets

## Troubleshooting

### Chatbot Not Appearing
- Check if component is imported in `layout.tsx`
- Verify z-index is not blocked by other elements
- Check browser console for JavaScript errors

### No AI Response
- Verify Supabase connection and credentials
- Check API keys in environment variables
- Review server logs for error details
- Ensure external website is accessible

### Slow Responses
- Check Supabase query performance
- Verify external data source availability
- Monitor AI Gateway quota and rate limits
- Consider increasing cache TTL

## Security Considerations

1. **API Key Safety**
   - Use `NEXT_PUBLIC_*` only for client-safe keys (Supabase anon key)
   - Keep service role keys in server-only environment variables
   - Never expose OpenAI/Gemini keys to client

2. **Data Privacy**
   - Consider implementing row-level security (RLS) in Supabase
   - Filter sensitive information from AI responses
   - Log all AI interactions for compliance

3. **Rate Limiting**
   - Implement rate limiting on chat endpoint
   - Limit tool execution frequency
   - Monitor for abuse patterns

## Future Enhancements

- [ ] Message persistence to database
- [ ] Conversation history per user
- [ ] Custom training on inventory data
- [ ] Webhook integrations for real-time alerts
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Voice input/output capabilities
- [ ] Scheduled report generation

## Support

For issues or questions about the AI chatbot implementation, refer to:
- [AI SDK 6 Documentation](https://sdk.vercel.ai)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
