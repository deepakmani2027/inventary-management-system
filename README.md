# InventoryPro AI Chatbot

A comprehensive AI-powered chatbot system for inventory management, built with React, FastAPI, and integrated with Emergent AI for intelligent responses.

## Architecture Overview

### Frontend (React)
- **ChatWidget**: Floating chat interface with smooth animations
- **LandingPage**: Engaging product landing page
- **Framework**: React 19.0 with Framer Motion for animations
- **Styling**: Tailwind CSS with custom theme
- **State Management**: Local state with axios for API calls

### Backend (FastAPI)
- **Framework**: FastAPI with async support
- **Database**: MongoDB for chat history via Motor ORM
- **Data Integration**: Supabase REST API for inventory data
- **LLM Integration**: Emergent AI Gateway supporting OpenAI and Gemini
- **Features**: Intent detection, context-aware responses, session management

## Key Features

✨ **Multi-Model Support**: Switch between OpenAI GPT-4.1 Mini and Gemini 2.5 Flash
📊 **Real-time Data**: Live inventory, sales, and revenue insights
👥 **Team Management**: Access team members and roles
⚡ **Smart Intent Detection**: Automatically fetches relevant data based on queries
💾 **Session Persistence**: Conversation history saved in MongoDB
🎨 **Beautiful UI**: Modern, responsive design with animations

## Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- Python 3.9+
- MongoDB instance
- Supabase account with inventory database
- Emergent AI API key

### Frontend Setup

```bash
# Install dependencies
npm install
# or
yarn install

# Start development server
npm start
# or
yarn start
```

The frontend runs on `http://localhost:3000`

### Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with configuration
cp .env.example .env
# Edit .env with your credentials

# Run server
uvicorn server:app --reload --port 8000
```

The backend runs on `http://localhost:8000`

## Environment Variables

### Frontend
- `REACT_APP_BACKEND_URL`: Backend server URL (default: http://localhost:8000)

### Backend
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Database name (default: inventory_pro)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase API key
- `EMERGENT_LLM_KEY`: Emergent AI API key
- `CORS_ORIGINS`: Allowed CORS origins (comma-separated)

## API Endpoints

### Chat
- `POST /api/chat` - Send message and get AI response
  - Body: `{ message, session_id, model }`
  - Returns: `{ response, session_id, model_used, data_context }`

### History
- `GET /api/chat/history/{session_id}` - Get conversation history
  - Returns: `{ session_id, messages: [{ role, content, timestamp }] }`

### Data
- `GET /api/data/summary` - Get inventory summary statistics
- `GET /api/data/items` - Get all items with stock information

## Component Structure

```
src/
├── App.js                 # Main app routing
├── App.css                # Global styles
├── index.js               # Entry point
├── components/
│   ├── ChatWidget.jsx     # Chat widget component
│   └── LandingPage.jsx    # Landing page
└── index.css              # Tailwind & CSS variables
```

## Data Context

The chatbot has access to comprehensive inventory data:
- **Summary**: Total items, stock units, sales, revenue, active users
- **Categories**: Product categories
- **Items**: Products with pricing and stock levels
- **Sales**: Recent transactions and sales data
- **Inventory**: Warehouse locations and stock quantities
- **Alerts**: Low stock warnings
- **Team**: User information and roles

## Customization

### Styling
Edit `src/index.css` to customize Tailwind CSS design tokens and colors.

### Quick Actions
Edit the `QUICK_ACTIONS` array in `ChatWidget.jsx` to customize suggested queries.

### System Prompt
Modify the `SYSTEM_PROMPT` in `server.py` to change the assistant's personality and behavior.

### Models
Change default models in the backend config or toggle via UI.

## Deployment

### Frontend
```bash
npm run build
# Deploy build/ folder to Vercel, Netlify, or similar
```

### Backend
```bash
# Deploy to Heroku, Railway, or similar with Python support
# Ensure environment variables are set in deployment platform
```

## Troubleshooting

### Chat Widget doesn't appear
- Check that backend URL is correct in `.env.local`
- Verify backend server is running
- Check browser console for errors

### No responses from AI
- Verify Emergent API key is set correctly
- Check MongoDB connection
- Ensure Supabase credentials are valid

### Data not showing
- Verify Supabase tables exist (items, categories, inventory, sales, users)
- Check Supabase API key permissions
- Review backend logs for data fetching errors

## Technologies Used

- **Frontend**: React 19, Framer Motion, Tailwind CSS, Lucide Icons, Axios
- **Backend**: FastAPI, Motor (MongoDB), Pydantic, Starlette
- **AI**: Emergent AI Gateway, OpenAI, Google Gemini
- **Database**: MongoDB, Supabase

## License

Built with ❤️ by the Emergent team. Part of the InventoryPro platform.
