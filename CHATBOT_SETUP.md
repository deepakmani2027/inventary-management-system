# AI Inventory Chatbot Setup Guide

## Overview
This document provides instructions for setting up and using the AI-powered inventory chatbot integrated into your inventory management system.

## Features
- **Dual AI Model Support**: Choose between Google Gemini and OpenAI GPT-4
- **Real-time Data Integration**: Seamlessly connects to your Supabase database
- **Smart Context Awareness**: Analyzes inventory, sales, user, and category data
- **Support & Analytics**: Helps with inventory management and provides data-driven insights
- **Mobile Responsive**: Works on all devices with a floating widget interface

## Environment Variables Required

Before the chatbot can function, you need to configure these environment variables in your Vercel project:

### 1. Gemini API Key (Google)
- **Variable Name**: `NEXT_PUBLIC_GEMINI_API_KEY`
- **Get it from**: https://aistudio.google.com/app/apikey
- **Steps**:
  1. Visit the Google AI Studio
  2. Click "Get API Key" button
  3. Create a new API key in Google Cloud
  4. Copy and paste the key into your environment variables

### 2. OpenAI API Key
- **Variable Name**: `OPENAI_API_KEY`
- **Get it from**: https://platform.openai.com/api-keys
- **Steps**:
  1. Log in to your OpenAI account
  2. Navigate to API keys section
  3. Create a new secret key
  4. Copy and paste the key into your environment variables

### 3. Supabase Credentials (Already Configured)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for secure operations)

## How to Add Environment Variables

### In Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable with its corresponding value
4. Redeploy your project for changes to take effect

### Locally (.env.local):
Create a `.env.local` file in your project root:
```
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Using the Chatbot

### Accessing the Chatbot
- The chatbot appears as a blue circular button in the bottom-right corner of every page
- Click the button to open the chat window

### Features in Chat Window
1. **Model Selection**: Toggle between Gemini and OpenAI using the settings menu
2. **Chat History**: View your entire conversation history
3. **Clear Chat**: Reset conversation using the settings menu
4. **Real-time Responses**: Get instant answers powered by AI and your database

### What the Chatbot Can Do
- **Inventory Management**: Check stock levels, product availability, and inventory status
- **Sales Analytics**: Analyze sales trends, revenue insights, and customer data
- **User Information**: Look up staff and customer details
- **Category Management**: Discuss product categories and classifications
- **General Support**: Help with platform navigation and feature questions

## API Endpoints

### `/api/chat` (POST)
Processes user messages and returns AI responses.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What items are in stock?" },
    { "role": "assistant", "content": "..." }
  ],
  "model": "gemini" // or "openai"
}
```

**Response:**
```json
{
  "content": "Based on your database, here are the items in stock..."
}
```

### `/api/supabase/schema` (GET)
Fetches the database schema for available tables and columns.

**Response:**
```json
{
  "schema": {
    "items": {
      "columns": ["id", "name", "stock_level", "category_id", ...],
      "sample": { ... }
    },
    ...
  }
}
```

### `/api/supabase/query` (POST)
Executes queries on your Supabase database.

**Request:**
```json
{
  "table": "items",
  "filters": { "category_id": "123" },
  "limit": 50
}
```

**Response:**
```json
{
  "data": [ ... ]
}
```

## Troubleshooting

### Chatbot Not Responding
1. **Check API Keys**: Ensure both `NEXT_PUBLIC_GEMINI_API_KEY` and `OPENAI_API_KEY` are set in environment variables
2. **Check Network**: Verify your internet connection
3. **Check Browser Console**: Look for specific error messages

### "Failed to get response" Error
- Ensure API keys are valid and have quota remaining
- Check that the API services (Google Gemini, OpenAI) are active on your accounts
- Try switching between Gemini and OpenAI models

### Database Data Not Showing
1. Verify Supabase credentials are correct
2. Check that your tables exist in Supabase
3. Ensure the service role key has read permissions on all tables

### Slow Responses
- First request after deployment may be slower (cold start)
- Try using the other AI model for comparison
- Check your API usage quotas

## Security Considerations

1. **API Keys**: Store keys securely in environment variables, never commit them to git
2. **Public vs Secret Keys**: 
   - `NEXT_PUBLIC_*` variables are visible in browser code
   - Regular environment variables are only used server-side
3. **Supabase RLS**: Consider enabling Row Level Security for sensitive data
4. **Rate Limiting**: Monitor API usage to avoid unexpected costs

## Performance Tips

1. **Model Selection**: 
   - Gemini is typically faster for most queries
   - OpenAI is better for complex analytical questions
2. **Message Length**: Keep messages concise for faster responses
3. **Database Queries**: The chatbot caches recent data to reduce API calls

## Support

For issues with:
- **Google Gemini API**: https://support.google.com/
- **OpenAI API**: https://help.openai.com/
- **Supabase**: https://supabase.com/docs

## Components

### Main Files
- `/components/ai-chatbot.tsx` - React component for the floating chatbot UI
- `/app/api/chat/route.ts` - Main chat API endpoint
- `/app/api/supabase/schema/route.ts` - Database schema endpoint
- `/app/api/supabase/query/route.ts` - Database query endpoint

### Integration
- The chatbot is integrated into `/app/layout.tsx` and appears globally across all pages

## Future Enhancements

Potential improvements for future versions:
- Voice input/output support
- Custom knowledge base training
- Multi-language support
- Advanced analytics dashboard
- Chat export functionality
- Conversation persistence across sessions
