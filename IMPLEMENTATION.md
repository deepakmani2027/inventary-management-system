# InventoryPro AI Chatbot - Implementation Guide

## Overview

This document outlines the complete implementation architecture, flow, and integration points for the InventoryPro AI Chatbot system.

## System Architecture

### High-Level Flow

```
User → Frontend (React) → Chat Widget
         ↓
     API Request (Axios)
         ↓
Backend (FastAPI) → Intent Detection → Data Fetching
                         ↓
                    Supabase Query
                         ↓
                    MongoDB Store
                         ↓
                    LLM Processing
         ↓
Response → Frontend → Display in Chat
```

## Frontend Architecture

### ChatWidget Component (src/components/ChatWidget.jsx)

**Responsibilities:**
- Display floating chat interface
- Manage conversation state and history
- Send/receive messages via API
- Handle model selection (OpenAI/Gemini)
- Display typing indicators and animations
- Store session IDs in localStorage

**Key Features:**
- Session-based conversations
- Message history persistence
- Real-time typing indicators
- Model toggle buttons
- Quick action suggestions
- Clear conversation button
- Smooth animations with Framer Motion

**State Management:**
```javascript
- isOpen: Boolean (widget visibility)
- messages: Array (chat messages)
- input: String (current input text)
- isLoading: Boolean (API call status)
- model: String ("openai" | "gemini")
- sessionId: String (persistent session)
```

**API Integration:**
- `POST /api/chat` - Send message
- `GET /api/chat/history/{session_id}` - Load history
- Session persistence in localStorage

### LandingPage Component (src/components/LandingPage.jsx)

**Responsibilities:**
- Display product landing page
- Showcase features and benefits
- Navigation and CTAs
- Responsive design

**Structure:**
- Navigation bar with branding
- Hero section with main messaging
- Features section (4 columns)
- Benefits section (detailed list)
- Call-to-action section
- Footer

### App Component (src/App.js)

**Responsibilities:**
- Main router setup
- Route configuration
- Widget mounting

**Routes:**
- `/` → LandingPage
- ChatWidget mounted globally

## Backend Architecture

### FastAPI Server (server.py)

**Core Endpoints:**

#### POST /api/chat
Sends user message to AI and returns response.

**Request:**
```json
{
  "message": "What items are low on stock?",
  "session_id": "sess_abc123",
  "model": "openai"
}
```

**Response:**
```json
{
  "response": "Based on your inventory...",
  "session_id": "sess_abc123",
  "model_used": "GPT 4.1 Mini",
  "data_context": {
    "summary": { ... }
  }
}
```

**Process:**
1. Load session history from MongoDB
2. Fetch inventory context from Supabase
3. Initialize LLM with system prompt + context
4. Send user message to LLM
5. Store messages in MongoDB
6. Return response

#### GET /api/chat/history/{session_id}
Retrieves conversation history for a session.

**Response:**
```json
{
  "session_id": "sess_abc123",
  "messages": [
    {
      "role": "user",
      "content": "What is total revenue?",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "Your total revenue is...",
      "timestamp": "2024-01-15T10:30:05Z",
      "model_used": "GPT 4.1 Mini"
    }
  ]
}
```

#### GET /api/data/summary
Quick summary of inventory statistics.

#### GET /api/data/items
All items with stock information.

### Data Fetching

**get_inventory_context()** - Comprehensive data aggregation

Fetches and processes:
1. Items from Supabase
2. Categories mapping
3. Inventory/stock levels
4. Recent sales data
5. Notifications
6. Team member information

Creates enriched context with:
- Stock quantity and reorder levels
- Low stock alerts
- Sales summary statistics
- Category information

### Intent Detection

**detect_query_intent()** - Intelligent data optimization

Detects keywords in user message:
- "stock", "inventory" → Fetch inventory data
- "sale", "revenue" → Fetch sales data
- "item", "product" → Fetch items/categories
- "user", "team" → Fetch team data
- "alert", "notification" → Fetch notifications

Optimizes data fetching to reduce API calls.

### LLM Integration

**System Prompt**: Defines assistant personality and behavior

The assistant is positioned as "InventoryPro Assistant" with capabilities:
- Stock level checking
- Sales data analysis
- Category understanding
- Team workflow guidance
- Platform usage help

**Model Support:**
- **OpenAI**: GPT-4.1 Mini (fast, reliable)
- **Gemini**: Gemini 2.5 Flash (powerful, creative)

**LLM Chat Integration:**
```python
from emergentintegrations.llm.chat import LlmChat, UserMessage

chat_instance = LlmChat(
    api_key=EMERGENT_LLM_KEY,
    session_id=session_id,
    system_message=full_system
)

if model == "gemini":
    chat_instance.with_model("gemini", "gemini-2.5-flash")
else:
    chat_instance.with_model("openai", "gpt-4.1-mini")

user_msg = UserMessage(text=request.message)
ai_response = await chat_instance.send_message(user_msg)
```

### MongoDB Integration

**Collections:**
- `chat_sessions` - Conversation history

**Schema:**
```javascript
{
  "_id": ObjectId,
  "session_id": "sess_...",
  "messages": [
    {
      "role": "user|assistant",
      "content": "...",
      "timestamp": "ISO string"
    }
  ],
  "created_at": "ISO string",
  "updated_at": "ISO string"
}
```

**Operations:**
- `find_one()` - Load session history
- `update_one()` - Store new messages (upsert)

### Supabase Integration

**Tables:**
- `items` - Product catalog
- `categories` - Product categories
- `inventory` - Stock levels & warehouse locations
- `sales` - Transaction records
- `notifications` - System alerts
- `users` - Team members

**Query Pattern:**
```python
async def query_supabase(table: str, params: dict = None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers, params=params or {})
        return resp.json() if resp.status_code == 200 else []
```

## Data Flow Details

### Message Processing Flow

1. **User Input**
   - User types message in ChatWidget
   - Enter key or send button triggers sendMessage()

2. **Frontend Processing**
   - Message added to local state
   - Optimistic UI update
   - API request initiated with axios

3. **Backend Processing**
   ```
   Request arrives → Load session history
                  → Detect intent from message
                  → Fetch relevant Supabase data
                  → Build context string
                  → Initialize LLM with system prompt + context
                  → Send user message to LLM
                  → Receive AI response
                  → Store messages in MongoDB
                  → Return response to frontend
   ```

4. **Frontend Display**
   - Response received from API
   - Message added to chat history
   - Scroll to latest message
   - Update isLoading state

### Session Management

**Session ID Generation:**
```javascript
function generateSessionId() {
  return "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
```

**Persistence:**
- First visit: Generate new session ID
- Store in localStorage: `chatbot_session_id`
- Retrieve on widget open
- Load history from MongoDB

**History Recovery:**
- User closes widget
- Returns to widget later
- Session ID retrieved from localStorage
- History loaded via GET /api/chat/history/{session_id}
- Conversation continues seamlessly

## Error Handling

### Frontend Error Handling
```javascript
catch (e) {
  console.error("Chat error:", e);
  const errorMsg = {
    role: "assistant",
    content: "Sorry, I encountered an error processing your request. Please try again.",
    timestamp: new Date().toISOString(),
  };
  setMessages((prev) => [...prev, errorMsg]);
} finally {
  setIsLoading(false);
}
```

### Backend Error Handling
```python
except Exception as e:
    logger.error(f"Chat error: {str(e)}", exc_info=True)
    raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")
```

**Common Issues:**
- Missing API keys → Check .env configuration
- MongoDB connection → Verify MONGO_URL
- Supabase auth → Verify SUPABASE_KEY permissions
- LLM API → Check EMERGENT_LLM_KEY validity

## Performance Optimizations

1. **Intent Detection**
   - Reduces unnecessary API calls
   - Fetches only relevant data

2. **Data Caching**
   - MongoDB stores full session history
   - Avoid re-fetching old messages

3. **Async Processing**
   - FastAPI async/await for non-blocking I/O
   - Concurrent API requests to Supabase

4. **Frontend Optimization**
   - Message virtualization (items rendered on-scroll)
   - Debounced input (if needed)
   - Optimistic UI updates

## Security Considerations

1. **API Key Management**
   - Store in environment variables
   - Never expose in frontend code
   - Rotate keys regularly

2. **CORS Configuration**
   - Whitelist allowed origins
   - Prevent unauthorized API calls

3. **Input Validation**
   - Pydantic models for request validation
   - Sanitize user input before storing

4. **Database Security**
   - Use MongoDB connection string with auth
   - Implement Supabase RLS policies
   - Never expose sensitive data in context

5. **Session Management**
   - Session IDs are random and unique
   - Consider TTL for inactive sessions

## Customization Points

### System Prompt
Modify assistant personality and capabilities in server.py

### Quick Actions
Update QUICK_ACTIONS array in ChatWidget.jsx

### Styling
Customize colors and fonts in src/index.css

### Models
Toggle model in UI or set defaults in backend

### Data Context
Modify get_inventory_context() to include additional fields

## Deployment Checklist

- [ ] Set all environment variables
- [ ] Test MongoDB connection
- [ ] Verify Supabase credentials
- [ ] Validate Emergent API key
- [ ] Configure CORS origins
- [ ] Run frontend build
- [ ] Test API endpoints
- [ ] Verify chat functionality
- [ ] Check session persistence
- [ ] Monitor logs

## Support & Troubleshooting

See README.md for common issues and solutions.
