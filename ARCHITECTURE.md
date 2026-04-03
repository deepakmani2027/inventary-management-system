# InventoryPro AI Chatbot - Architecture Diagrams & Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE LAYER                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  WEB BROWSER                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  React Application (http://localhost:3000)             │  │  │
│  │  │  ├── LandingPage Component                             │  │  │
│  │  │  │   ├── Navigation                                    │  │  │
│  │  │  │   ├── Hero Section                                  │  │  │
│  │  │  │   ├── Features Grid                                 │  │  │
│  │  │  │   ├── Benefits Section                              │  │  │
│  │  │  │   ├── CTA Section                                   │  │  │
│  │  │  │   └── Footer                                        │  │  │
│  │  │  │                                                      │  │  │
│  │  │  └── ChatWidget Component (Always Mounted)             │  │  │
│  │  │      ├── Launcher Button (bottom-right)                │  │  │
│  │  │      └── Chat Window (when open)                       │  │  │
│  │  │          ├── Header                                    │  │  │
│  │  │          ├── Model Toggle                              │  │  │
│  │  │          ├── Message Display Area                      │  │  │
│  │  │          ├── Quick Actions                             │  │  │
│  │  │          └── Input Field                               │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│                        ↓ HTTP Requests (Axios)                          │
│                    (All CORS-enabled)                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY                                    │
│                                                                          │
│  FastAPI Server (http://localhost:8000)                               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  /api/chat (POST)            ← User messages                    │ │
│  │  /api/chat/history (GET)     ← Load history                     │ │
│  │  /api/data/summary (GET)     ← Quick stats                      │ │
│  │  /api/data/items (GET)       ← Items list                       │ │
│  │  / (GET)                     ← Health check                     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Core Processing Engine                                               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  1. Request Handler                                              │ │
│  │     ├── Validate input (Pydantic)                               │ │
│  │     └── Extract session_id                                      │ │
│  │                                                                  │ │
│  │  2. Session Manager                                             │ │
│  │     ├── Load chat history from MongoDB                          │ │
│  │     ├── Maintain conversation context                           │ │
│  │     └── Store new messages                                      │ │
│  │                                                                  │ │
│  │  3. Intent Detector                                             │ │
│  │     ├── Analyze user message                                    │ │
│  │     ├── Determine: stock/sales/items/users/alerts               │ │
│  │     └── Optimize data fetching                                  │ │
│  │                                                                  │ │
│  │  4. Data Context Builder                                        │ │
│  │     ├── Fetch relevant Supabase data                            │ │
│  │     ├── Enrich with calculations                                │ │
│  │     ├── Format for LLM consumption                              │ │
│  │     └── Include low stock alerts                                │ │
│  │                                                                  │ │
│  │  5. LLM Processor                                               │ │
│  │     ├── Combine system prompt + context + message               │ │
│  │     ├── Route to selected model                                 │ │
│  │     └── Stream/process response                                 │ │
│  │                                                                  │ │
│  │  6. Response Formatter                                          │ │
│  │     ├── Format text with markdown                               │ │
│  │     ├── Include model metadata                                  │ │
│  │     └── Return JSON response                                    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
        ↓                    ↓                    ↓                ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   DATABASE   │    │   DATA       │    │   LLM        │    │   STORAGE    │
│              │    │   SOURCE     │    │   ENGINE     │    │              │
│  MONGODB     │    │              │    │              │    │  SUPABASE    │
│              │    │  SUPABASE    │    │  EMERGENT    │    │              │
│  Collections:│    │   REST API   │    │   AI GATEWAY │    │  Tables:     │
│  - Sessions  │    │              │    │              │    │  - items     │
│  - Messages  │    │  Endpoints:  │    │  Models:     │    │  - categories│
│              │    │  - items     │    │  - OpenAI    │    │  - inventory │
│  Stores:     │    │  - categories│    │  - Gemini    │    │  - sales     │
│  - User msgs │    │  - inventory │    │              │    │  - users     │
│  - AI msgs   │    │  - sales     │    │  Features:   │    │  - notif.    │
│  - Metadata  │    │  - users     │    │  - Streaming │    │              │
│              │    │  - notif.    │    │  - Context   │    │  Features:   │
│              │    │              │    │  - Templates │    │  - RLS ready │
│              │    │  Features:   │    │              │    │  - JSON      │
│              │    │  - Real-time │    │ API Keys:    │    │  - Full SQL  │
│              │    │  - Auth      │    │  - Managed   │    │              │
│              │    │  - RLS       │    │  - Rotated   │    │ Authentication:
│              │    │              │    │              │    │  - API Key   │
│              │    │ Connection:  │    │ Connection:  │    │  - JWT Ready │
│              │    │  - HTTP REST │    │  - HTTP API  │    │              │
│              │    │  - CORS-safe │    │  - CORS-safe │    │ Connection:  │
│              │    │              │    │              │    │  - HTTP REST │
│              │    │ Security:    │    │ Security:    │    │  - CORS-safe │
│              │    │  - API Key   │    │  - Verified  │    │              │
│              │    │  - Headers   │    │  - Encrypted │    │ Security:    │
│              │    │              │    │              │    │  - API Key   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

## Data Flow Sequence

### Complete Message Flow
```
1. USER ACTION
   └─→ Types message in ChatWidget

2. FRONTEND
   └─→ Captures text input
       └─→ Validates non-empty
           └─→ Adds to local messages array
               └─→ Makes POST request to /api/chat
                   └─→ Payload: {message, session_id, model}

3. BACKEND RECEIVES
   └─→ Request validation (Pydantic)
       └─→ Extract parameters
           └─→ Log request

4. SESSION MANAGEMENT
   └─→ Query MongoDB for session history
       └─→ If new: Create session doc
           └─→ If existing: Load message array

5. INTENT DETECTION
   └─→ Analyze message for keywords
       └─→ Determine query type: inventory/sales/items/users/alerts
           └─→ Flag: which data is needed

6. DATA FETCHING (from Supabase)
   └─→ Query /rest/v1/items
       └─→ Query /rest/v1/categories
           └─→ Query /rest/v1/inventory
               └─→ Query /rest/v1/sales
                   └─→ Query /rest/v1/users
                       └─→ Query /rest/v1/notifications

7. DATA ENRICHMENT
   └─→ Process raw data
       └─→ Join tables (items + categories + inventory)
           └─→ Calculate stats
               └─→ Build context string
                   └─→ Format for LLM consumption

8. LLM PROCESSING
   └─→ Combine:
       ├─→ System Prompt (assistant personality)
       ├─→ Data Context (live business data)
       └─→ User Message (the question)
   └─→ Route to selected model:
       ├─→ If OpenAI: Use GPT-4.1 Mini
       └─→ If Gemini: Use Gemini 2.5 Flash
   └─→ Get response

9. STORAGE
   └─→ Create message documents
       ├─→ {role: "user", content, timestamp}
       └─→ {role: "assistant", content, timestamp}
   └─→ Store in MongoDB
       └─→ Update session document
           └─→ Push to messages array

10. RESPONSE FORMATTING
    └─→ Create ChatResponse object
        ├─→ response: AI's message
        ├─→ session_id: for future requests
        ├─→ model_used: which model processed
        └─→ data_context: summary stats

11. SEND TO FRONTEND
    └─→ HTTP 200 JSON response

12. FRONTEND DISPLAY
    └─→ Receive response
        └─→ Parse JSON
            └─→ Remove loading indicator
                └─→ Add assistant message to array
                    └─→ Format with markdown
                        └─→ Render in chat window
                            └─→ Scroll to latest message
                                └─→ Store in localStorage
                                    └─→ Show to user ✓
```

## Component Hierarchy

```
App (React Router)
│
├─→ Route /
│   └─→ LandingPage
│       ├─→ Navigation Header
│       │   ├─→ Logo
│       │   ├─→ Nav Links
│       │   └─→ CTA Button
│       │
│       ├─→ Hero Section
│       │   ├─→ Title
│       │   ├─→ Subtitle
│       │   └─→ Action Buttons
│       │
│       ├─→ Features Grid (4 columns)
│       │   ├─→ Feature Card 1
│       │   ├─→ Feature Card 2
│       │   ├─→ Feature Card 3
│       │   └─→ Feature Card 4
│       │
│       ├─→ Benefits Section
│       │   ├─→ Benefit 1
│       │   ├─→ Benefit 2
│       │   ├─→ Benefit 3
│       │   └─→ Benefit 4
│       │
│       ├─→ CTA Section
│       │   ├─→ Heading
│       │   ├─→ Description
│       │   └─→ Action Button
│       │
│       └─→ Footer
│           └─→ Copyright & Credits
│
└─→ ChatWidget (Global, Always Mounted)
    │
    ├─→ Launcher Button (when closed)
    │   └─→ Chat Icon
    │
    └─→ Chat Window (when open)
        ├─→ Header
        │   ├─→ Logo & Title
        │   ├─→ Clear Button
        │   └─→ Close Button
        │
        ├─→ Model Toggle
        │   ├─→ OpenAI Button
        │   └─→ Gemini Button
        │
        ├─→ Messages Container
        │   ├─→ Welcome Message
        │   ├─→ MessageBubble (User)
        │   ├─→ MessageBubble (Assistant)
        │   ├─→ MessageBubble (...)
        │   ├─→ TypingIndicator (while loading)
        │   └─→ Scroll Anchor
        │
        ├─→ Quick Actions (if empty)
        │   ├─→ Action Button 1
        │   ├─→ Action Button 2
        │   └─→ Action Button (...)
        │
        └─→ Input Area
            ├─→ Text Input
            └─→ Send Button
```

## State Management Flow (Frontend)

```
ChatWidget Component State:

┌─ isOpen ─────────────────────────────┐
│  Boolean - Chat window visibility    │
│  Controls: Launcher button, window   │
└──────────────────────────────────────┘

┌─ messages ────────────────────────────────────────┐
│  Array of message objects                        │
│  [{role: "user"|"assistant", content, time}, ...] │
│  Updates: User sends, AI responds                │
└───────────────────────────────────────────────────┘

┌─ input ───────────────────────────────┐
│  String - Current input field text    │
│  Updates: User types, clears after    │
│  send                                 │
└───────────────────────────────────────┘

┌─ isLoading ───────────────────────────────────┐
│  Boolean - API call in progress               │
│  Shows: Typing indicator, disables input      │
│  Updates: On request start/completion         │
└───────────────────────────────────────────────┘

┌─ model ──────────────────────────────────┐
│  String - "openai" or "gemini"          │
│  Sent: With each API request            │
│  Updates: Model toggle buttons           │
└──────────────────────────────────────────┘

┌─ sessionId ───────────────────────────────────┐
│  String - Persistent session identifier      │
│  Stored: localStorage (browser)              │
│  Sent: With each API request                 │
│  Updates: On mount (if new user)             │
└───────────────────────────────────────────────┘
```

## Database Schema (MongoDB)

```
Collection: chat_sessions

Document Structure:
{
  _id: ObjectId,
  session_id: "sess_abc123xyz...",  // Unique session identifier
  messages: [
    {
      role: "user" | "assistant",
      content: "Message text here",
      timestamp: "2024-01-15T10:30:45.123Z",
      model_used: "GPT 4.1 Mini"  // Only for assistant messages
    },
    // ... more messages
  ],
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-15T10:35:30Z"
}

Indexes (Recommended):
- session_id (unique)
- updated_at (descending, for cleanup)

TTL Index (Optional):
- Set 30-day TTL on created_at for auto-cleanup
```

## Supabase Tables Schema

```
Table: items
├─ id: bigint (primary key)
├─ name: text
├─ category_id: bigint (foreign key)
├─ unit_price: decimal
├─ reorder_level: bigint
└─ created_at: timestamp

Table: categories
├─ id: bigint (primary key)
├─ name: text
├─ description: text
└─ created_at: timestamp

Table: inventory
├─ id: bigint (primary key)
├─ item_id: bigint (foreign key)
├─ quantity: bigint
├─ warehouse_location: text
└─ updated_at: timestamp

Table: sales
├─ id: bigint (primary key)
├─ bill_number: text
├─ customer_name: text
├─ total_amount: decimal
├─ status: text (completed/cancelled/pending)
├─ sale_date: date
└─ created_at: timestamp

Table: users
├─ id: bigint (primary key)
├─ full_name: text
├─ role: text (admin/salesman/manager)
├─ is_active: boolean
└─ created_at: timestamp

Table: notifications
├─ id: bigint (primary key)
├─ title: text
├─ message: text
├─ type: text (alert/info/warning)
└─ created_at: timestamp
```

## API Endpoint Specifications

```
POST /api/chat
├─ Request Headers:
│  └─ Content-Type: application/json
├─ Request Body:
│  ├─ message: string (required)
│  ├─ session_id: string (required)
│  └─ model: string (optional, default: "openai")
├─ Response:
│  ├─ response: string (AI message)
│  ├─ session_id: string (same as request)
│  ├─ model_used: string (which model processed)
│  └─ data_context: object (summary stats)
└─ Status Codes:
   ├─ 200: Success
   ├─ 400: Invalid request
   ├─ 500: Processing error

GET /api/chat/history/{session_id}
├─ Response:
│  ├─ session_id: string
│  └─ messages: array of message objects
└─ Status Codes:
   ├─ 200: Success
   └─ 404: Session not found

GET /api/data/summary
├─ Response:
│  ├─ total_items: number
│  ├─ total_stock_units: number
│  ├─ low_stock_count: number
│  ├─ total_sales: number
│  ├─ total_revenue: number
│  └─ ... (more stats)
└─ Status Codes:
   └─ 200: Success

GET /api/data/items
├─ Response:
│  └─ items: array of enriched items
│     ├─ name: string
│     ├─ category: string
│     ├─ price: number
│     ├─ stock_quantity: number
│     └─ low_stock: boolean
└─ Status Codes:
   └─ 200: Success
```

## Environment Configuration Layers

```
┌─────────────────────────────────────────────────┐
│  DEPLOYMENT ENVIRONMENT                         │
│  (Production Hosting Platform)                  │
│  ├─ Environment Variables                       │
│  │  ├─ MONGO_URL                               │
│  │  ├─ SUPABASE_URL                            │
│  │  ├─ SUPABASE_KEY                            │
│  │  ├─ EMERGENT_LLM_KEY                        │
│  │  └─ CORS_ORIGINS                            │
│  └─ Applied at: Runtime                        │
└─────────────────────────────────────────────────┘
           ↑
           │
┌─────────────────────────────────────────────────┐
│  DEVELOPMENT ENVIRONMENT                        │
│  (.env file for backend)                        │
│  ├─ Local MongoDB URL                           │
│  ├─ Supabase credentials                        │
│  ├─ API keys                                    │
│  └─ Local CORS settings                         │
└─────────────────────────────────────────────────┘
           ↑
           │
┌─────────────────────────────────────────────────┐
│  FRONTEND ENVIRONMENT                           │
│  (.env.local file)                              │
│  └─ REACT_APP_BACKEND_URL                       │
└─────────────────────────────────────────────────┘
           ↑
           │
┌─────────────────────────────────────────────────┐
│  DEFAULT/FALLBACK                               │
│  (Hardcoded in code)                            │
│  ├─ http://localhost:8000 (backend)             │
│  ├─ http://localhost:3000 (frontend)            │
│  └─ Production domains                          │
└─────────────────────────────────────────────────┘
```

## Security Architecture

```
┌──────────────────────────────────────────────┐
│  FRONTEND SECURITY                           │
├──────────────────────────────────────────────┤
│  • No API keys in code                       │
│  • Environment variables via .env.local      │
│  • Sanitized message input                   │
│  • XSS protection via React escaping         │
│  • CORS-safe requests only                   │
│  • Secure session ID storage                 │
└──────────────────────────────────────────────┘

         ↓ HTTPS/TLS ↓

┌──────────────────────────────────────────────┐
│  BACKEND SECURITY                            │
├──────────────────────────────────────────────┤
│  • API Key validation (env vars)             │
│  • Pydantic input validation                 │
│  • CORS headers configured                   │
│  • Error message filtering                   │
│  • Logging for audit trail                   │
│  • Rate limiting ready                       │
└──────────────────────────────────────────────┘

         ↓ ↓ ↓

┌──────────────────────────────────────────────┐
│  DATABASE SECURITY                           │
├──────────────────────────────────────────────┤
│  • MongoDB: Password-protected connection   │
│  • Supabase: API key with restricted scope  │
│  • Both: HTTPS only                          │
│  • Supabase: RLS policies configurable      │
│  • MongoDB: Backup enabled                  │
└──────────────────────────────────────────────┘
```

## Performance Optimization Layers

```
┌─ FRONTEND ────────────────────────────┐
│  • Message virtualization              │
│  • Lazy loading with Framer Motion     │
│  • CSS-in-JS optimization              │
│  • Local state caching                 │
│  • Debounced inputs (if needed)        │
│  • Responsive images                   │
└───────────────────────────────────────┘
           ↓
┌─ API LAYER ───────────────────────────┐
│  • Intent-based data fetching          │
│  • Only fetch needed tables            │
│  • Batch similar queries               │
│  • Cache strategy                      │
│  • Async/await for concurrency        │
└───────────────────────────────────────┘
           ↓
┌─ DATABASE ────────────────────────────┐
│  • MongoDB indexing on session_id      │
│  • Supabase query optimization         │
│  • Connection pooling                  │
│  • Query timeout limits                │
│  • Caching policies                    │
└───────────────────────────────────────┘
```

---

This architecture provides a robust, scalable, secure foundation for the InventoryPro AI Chatbot system.
