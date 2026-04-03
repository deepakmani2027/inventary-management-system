# InventoryPro AI Chatbot - Complete Setup Guide

## Project Structure

```
inventory-pro-chatbot/
├── src/
│   ├── components/
│   │   ├── ChatWidget.jsx          # Main chat widget (380px wide floating interface)
│   │   └── LandingPage.jsx         # Landing page with features & benefits
│   ├── App.js                      # Main app component with routing
│   ├── App.css                     # Global styles & animations
│   ├── index.js                    # React entry point
│   └── index.css                   # Tailwind configuration & design tokens
├── public/
│   └── index.html                  # HTML template with fonts & scripts
├── server.py                       # FastAPI backend server
├── package.json                    # Frontend dependencies
├── requirements.txt                # Python dependencies
├── jsconfig.json                   # JavaScript path aliases
├── tailwind.config.js              # Tailwind CSS configuration
├── postcss.config.js               # PostCSS configuration
├── craco.config.js                 # Create React App configuration override
├── .env.example                    # Environment variables template
├── .env.local                      # Local development environment
├── .gitignore                      # Git ignore file
├── README.md                       # Project documentation
├── IMPLEMENTATION.md               # Detailed implementation guide
└── SETUP_GUIDE.md                  # This file
```

## Prerequisites

### Required Software
- **Node.js**: 16.x or higher (LTS recommended)
- **npm** or **yarn**: Latest version
- **Python**: 3.9 or higher
- **MongoDB**: Local or cloud instance
- **Git**: For version control

### Required Accounts
- **Supabase**: Free account with inventory database
- **Emergent AI**: API access for LLM models
- **MongoDB Atlas**: Free cloud database (or local MongoDB)

## Step 1: Clone/Download Project

```bash
# If cloning from GitHub
git clone <repository-url>
cd inventory-pro-chatbot

# If downloaded as ZIP
unzip inventory-pro-chatbot.zip
cd inventory-pro-chatbot
```

## Step 2: Frontend Setup

### Install Dependencies

```bash
npm install
# or
yarn install
```

This installs all packages listed in `package.json`:
- React 19.0 with hooks
- Framer Motion for animations
- Tailwind CSS for styling
- Lucide React for icons
- Axios for HTTP requests
- React Router for navigation
- And many UI components

### Create Environment Configuration

```bash
# Copy template
cp .env.example .env.local

# Edit .env.local
nano .env.local
# or use your preferred editor
```

**Content:**
```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

### Start Frontend Development Server

```bash
npm start
# or
yarn start
```

Frontend will be available at: **http://localhost:3000**

You should see:
- Landing page with hero section
- Features showcase
- Chat widget in bottom-right corner (disabled until backend is running)

## Step 3: Backend Setup

### Create Virtual Environment

```bash
# On macOS/Linux
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
venv\Scripts\activate
```

### Install Python Dependencies

```bash
pip install -r requirements.txt
```

Key packages:
- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **motor**: Async MongoDB driver
- **pydantic**: Data validation
- **httpx**: Async HTTP client
- **google-generativeai**: Gemini API
- **openai**: OpenAI API
- **emergentintegrations**: Emergent AI integration

### Configure Environment Variables

```bash
# Copy template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Variables:**

```env
# MongoDB
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=inventory_pro

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Emergent LLM
EMERGENT_LLM_KEY=your-emergent-api-key

# CORS (add your frontend URL)
CORS_ORIGINS=http://localhost:3000

# Environment
NODE_ENV=development
```

### Setting Up MongoDB

**Option A: MongoDB Atlas (Cloud)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster
4. Add a database user
5. Get connection string (looks like: `mongodb+srv://...`)
6. Update `MONGO_URL` in `.env`

**Option B: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Then run:
mongod

# Connection string:
MONGO_URL=mongodb://localhost:27017
```

### Setting Up Supabase

1. Go to https://supabase.com
2. Create free account
3. Create new project
4. In Project Settings → API, copy:
   - Project URL → `SUPABASE_URL`
   - Anon Key → `SUPABASE_KEY`
5. Ensure these tables exist with proper columns:
   - `items` (id, name, category_id, unit_price, reorder_level)
   - `categories` (id, name, description)
   - `inventory` (id, item_id, quantity, warehouse_location)
   - `sales` (id, bill_number, customer_name, total_amount, status, sale_date)
   - `users` (id, full_name, role, is_active)
   - `notifications` (id, title, message, type)

### Getting Emergent API Key

1. Visit https://emergent.sh
2. Sign up for developer account
3. Navigate to API Keys section
4. Create new API key
5. Update `EMERGENT_LLM_KEY` in `.env`

### Start Backend Server

```bash
# Make sure virtual environment is activated
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run server
uvicorn server:app --reload --port 8000
```

Backend will be available at: **http://localhost:8000**

You should see:
- Server starting message
- "Uvicorn running on http://127.0.0.1:8000"
- Ready for API requests

## Step 4: Verify Integration

### Test Frontend-Backend Connection

1. Open http://localhost:3000 in browser
2. Click chat widget (bottom-right)
3. Try sending message: "What items are low on stock?"
4. Should see typing indicator
5. AI response should appear with inventory data

### Test API Endpoints Directly

```bash
# Get chat history (should return empty initially)
curl http://localhost:8000/api/chat/history/test-session

# Get data summary
curl http://localhost:8000/api/data/summary

# Get items list
curl http://localhost:8000/api/data/items

# Send chat message
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me recent sales",
    "session_id": "test-session",
    "model": "openai"
  }'
```

## Step 5: Customization

### Change Assistant Personality

Edit `server.py` - Modify `SYSTEM_PROMPT`:

```python
SYSTEM_PROMPT = """You are MyCompanyAssistant...
  [Customize as needed]
"""
```

### Add/Remove Quick Actions

Edit `src/components/ChatWidget.jsx` - Modify `QUICK_ACTIONS`:

```javascript
const QUICK_ACTIONS = [
  "Your custom question 1",
  "Your custom question 2",
  "Your custom question 3",
];
```

### Change Colors

Edit `src/index.css` - Modify CSS variables:

```css
:root {
  --primary: 221.2 83.2% 53.3%;  /* Main brand color */
  --background: 0 0% 100%;       /* Background color */
  --foreground: 222.2 84% 4.9%;  /* Text color */
}
```

### Add Custom Data Fields

Edit `server.py` - Modify `get_inventory_context()`:

```python
async def get_inventory_context():
    # Add your custom queries
    custom_data = await query_supabase("your_table")
    # Add to context
    context["custom_field"] = custom_data
    return context
```

## Production Deployment

### Frontend Deployment (Vercel)

```bash
# Build for production
npm run build

# Deploy to Vercel
npm install -g vercel
vercel
```

Or connect GitHub repo to Vercel for auto-deploy.

### Frontend Deployment (Netlify)

```bash
# Build
npm run build

# Deploy
netlify deploy --prod --dir=build
```

### Backend Deployment (Railway)

1. Sign up at https://railway.app
2. Connect GitHub repository
3. Set environment variables in Railway dashboard
4. Deploy

### Backend Deployment (Heroku)

```bash
# Create app
heroku create your-app-name

# Set environment variables
heroku config:set MONGO_URL=<your-url>
heroku config:set SUPABASE_URL=<your-url>
heroku config:set SUPABASE_KEY=<your-key>
heroku config:set EMERGENT_LLM_KEY=<your-key>

# Deploy
git push heroku main
```

## Troubleshooting

### Frontend Issues

**Widget doesn't appear:**
- Check browser console (F12) for errors
- Verify backend URL in `.env.local`
- Ensure backend server is running on port 8000

**Messages not sending:**
- Check network tab (F12) for API errors
- Verify CORS settings match your frontend URL
- Check backend logs for error messages

**Styling looks broken:**
- Clear browser cache (Ctrl+Shift+Delete)
- Restart dev server
- Check Tailwind CSS is compiling

### Backend Issues

**"Connection refused" when accessing Supabase:**
- Verify SUPABASE_URL and SUPABASE_KEY are correct
- Check internet connection
- Verify Supabase tables exist with correct schema

**MongoDB connection error:**
- Verify MONGO_URL is correct
- Check MongoDB server is running (if local)
- Verify IP whitelist in MongoDB Atlas (if cloud)

**"API key invalid" error:**
- Regenerate Emergent API key
- Check .env file has correct key
- Verify there are no trailing spaces

**502 Bad Gateway:**
- Check all required environment variables are set
- Verify Supabase and MongoDB connectivity
- Check server logs for errors: `python server.py`

## Development Workflow

### Making Changes

1. **Frontend changes:**
   - Edit files in `src/`
   - Changes auto-reload at http://localhost:3000
   - Test in browser

2. **Backend changes:**
   - Edit `server.py`
   - Server auto-reloads with `--reload` flag
   - Test API endpoints or chat widget

3. **Database changes:**
   - Update Supabase schema
   - Modify `get_inventory_context()` if needed

### Debugging

**Frontend debugging:**
```javascript
// Add in ChatWidget.jsx
console.log("[v0] Message sent:", input);
console.log("[v0] Response received:", res.data);
```

**Backend debugging:**
```python
# Add in server.py
logger.info(f"[v0] Processing message: {request.message}")
logger.info(f"[v0] Context data: {context_data}")
```

## Next Steps

1. **Customize System Prompt** - Make assistant match your brand voice
2. **Add More Features** - Extend with:
   - Image generation
   - File uploads
   - Advanced analytics
   - Multi-language support
3. **Optimize Performance** - Implement:
   - Response caching
   - Database indexing
   - Frontend code splitting
4. **Enhance Security** - Add:
   - User authentication
   - Rate limiting
   - Input validation
   - Audit logging

## Support

For issues or questions:
1. Check README.md and IMPLEMENTATION.md
2. Review error messages in browser/server logs
3. Check environment variable configuration
4. Verify database connectivity
5. Test API endpoints directly with curl

## Quick Reference

| Component | URL | Purpose |
|-----------|-----|---------|
| Frontend | http://localhost:3000 | React app with chat widget |
| Backend | http://localhost:8000 | FastAPI server |
| API Docs | http://localhost:8000/docs | FastAPI auto-generated docs |
| MongoDB | Local or Atlas | Session history storage |
| Supabase | Hosted | Inventory data source |

## Commands Cheat Sheet

```bash
# Frontend
npm start                 # Start dev server
npm run build            # Build for production
npm run test             # Run tests

# Backend
source venv/bin/activate # Activate venv (macOS/Linux)
venv\Scripts\activate    # Activate venv (Windows)
uvicorn server:app --reload  # Start dev server
pip install -r requirements.txt  # Install dependencies

# Git
git add .               # Stage changes
git commit -m "message" # Commit changes
git push               # Push to remote
```

---

**Happy building! 🚀**
