# InventoryPro AI Chatbot - Quick Reference Card

## 🚀 Quick Start (5 Minutes)

### Prerequisites Checklist
- [ ] Node.js 16+ installed
- [ ] Python 3.9+ installed
- [ ] MongoDB account (local or Atlas)
- [ ] Supabase account with database
- [ ] Emergent AI API key

### One-Time Setup
```bash
# Frontend
npm install
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env.local

# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
```

### Daily Development
```bash
# Terminal 1: Backend
source venv/bin/activate
uvicorn server:app --reload --port 8000

# Terminal 2: Frontend
npm start
```

Visit: http://localhost:3000

---

## 📁 File Locations & What They Do

| File | Purpose | Modify For |
|------|---------|-----------|
| `src/components/ChatWidget.jsx` | Chat interface | UI changes, animations, quick actions |
| `src/components/LandingPage.jsx` | Landing page | Features, benefits, messaging |
| `server.py` | Backend API | New endpoints, system prompt, data |
| `src/index.css` | Theme colors | Brand colors, fonts, design tokens |
| `.env.local` | Frontend config | Backend URL (local dev only) |
| `.env` | Backend config | API keys, database URLs |

---

## 🔧 Common Customizations

### Change Chat Assistant Personality
**File**: `server.py` (Line ~150)
```python
SYSTEM_PROMPT = """You are MyCustomAssistant...
"""
```

### Change Chat Theme Color
**File**: `src/index.css` (Line ~11)
```css
--primary: 221.2 83.2% 53.3%;  /* Change this */
```

### Add Quick Action Buttons
**File**: `src/components/ChatWidget.jsx` (Line ~13)
```javascript
const QUICK_ACTIONS = [
  "Your question 1",
  "Your question 2",
];
```

### Change Default LLM Model
**File**: `server.py` (Line ~275)
```python
if request.model == "gemini":
    chat_instance.with_model("gemini", "gemini-2.5-flash")
else:
    chat_instance.with_model("openai", "gpt-4.1-mini")
```

### Add More Data to Context
**File**: `server.py` - `get_inventory_context()` (Line ~100)
```python
# Add your custom queries
context["new_field"] = await query_supabase("your_table")
```

---

## 📡 API Endpoints Reference

### POST /api/chat
Send message and get response
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is total revenue?",
    "session_id": "sess_123",
    "model": "openai"
  }'
```

### GET /api/chat/history/{session_id}
Get conversation history
```bash
curl http://localhost:8000/api/chat/history/sess_123
```

### GET /api/data/summary
Get inventory summary
```bash
curl http://localhost:8000/api/data/summary
```

### GET /api/data/items
Get items list
```bash
curl http://localhost:8000/api/data/items
```

---

## 🗂️ Project Structure (Visual)

```
inventory-pro-chatbot/
├── src/
│   ├── components/
│   │   ├── ChatWidget.jsx       ← Chat UI
│   │   └── LandingPage.jsx      ← Landing page
│   ├── App.js                   ← Routes
│   ├── App.css                  ← Global styles
│   ├── index.js                 ← Entry point
│   └── index.css                ← Theme colors
├── public/
│   └── index.html               ← HTML template
├── server.py                    ← Backend API
├── package.json                 ← Frontend deps
├── requirements.txt             ← Python deps
├── .env.local                   ← Frontend env
├── .env                         ← Backend env
└── tailwind.config.js           ← Tailwind setup
```

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot reach backend" | Check .env.local has correct URL, backend running on :8000 |
| "API key invalid" | Verify EMERGENT_LLM_KEY in .env, no trailing spaces |
| "MongoDB connection error" | Check MONGO_URL in .env, MongoDB is running |
| "Supabase query fails" | Verify SUPABASE_URL, SUPABASE_KEY, tables exist |
| "Chat widget not visible" | Ensure backend is running, browser cache cleared |
| "Styling looks wrong" | Restart dev server, clear browser cache |

---

## 💾 Environment Variables

### Frontend (.env.local)
```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

### Backend (.env)
```env
# Database
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net
DB_NAME=inventory_pro

# API Integration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key

# LLM
EMERGENT_LLM_KEY=your-key

# Network
CORS_ORIGINS=http://localhost:3000
```

---

## 📊 Data Context Available to LLM

The chatbot automatically includes:
```
├── Summary Stats
│   ├── Total items, categories
│   ├── Stock units, low stock count
│   ├── Sales metrics, revenue
│   └── Active users
├── Categories
├── Items (with prices & stock)
├── Recent Sales
├── Low Stock Alerts
├── Notifications
└── Team Members
```

---

## 🎨 Design System

### Colors (src/index.css)
```css
--primary: 221.2 83.2% 53.3%;      /* Main brand */
--background: 0 0% 100%;            /* Background */
--foreground: 222.2 84% 4.9%;       /* Text */
--accent: 210 40% 96%;              /* Accents */
--destructive: 0 84.2% 60.2%;       /* Errors */
```

### Fonts
```css
--font-manrope: Headings (bold, modern)
--font-ibm-plex: Body text (readable, professional)
--font-inter: Special use (clean, minimal)
```

### Spacing
Uses Tailwind scale: 4px, 8px, 12px, 16px, 24px, 32px...

### Breakpoints
```
sm: 640px  (tablets)
md: 768px  (small laptops)
lg: 1024px (desktops)
```

---

## 🔐 Security Checklist

- [ ] `.env` not in git (check .gitignore)
- [ ] API keys rotated regularly
- [ ] CORS_ORIGINS set correctly
- [ ] MongoDB password-protected
- [ ] Supabase RLS policies configured
- [ ] Input validation in backend
- [ ] Error messages don't expose secrets

---

## 📈 Performance Tips

### Frontend
- Clear browser cache if styles change
- Use React DevTools to profile components
- Check Network tab for slow API calls

### Backend
- Monitor MongoDB query performance
- Check Supabase API rate limits
- Use logging to identify bottlenecks

### Optimize Intent Detection
Edit `detect_query_intent()` to reduce unnecessary data fetches

---

## 🚢 Deployment Checklist

### Before Deploy
- [ ] All env vars set in deployment platform
- [ ] Frontend build succeeds: `npm run build`
- [ ] Backend tested locally
- [ ] Database backups created
- [ ] API keys rotated
- [ ] CORS origins updated

### Frontend Deploy (Vercel)
```bash
npm run build
vercel deploy --prod
```

### Backend Deploy (Railway)
1. Connect GitHub repo
2. Add env vars in Railway dashboard
3. Deploy main branch

---

## 💡 Development Tips

### Debug Frontend
Add to ChatWidget.jsx:
```javascript
console.log("[v0] Message sent:", input);
console.log("[v0] Response:", res.data);
```

### Debug Backend
Add to server.py:
```python
logger.info(f"[v0] Processing: {request.message}")
logger.info(f"[v0] Context: {context_data}")
```

### Test API Directly
```bash
# Use curl, Postman, or Thunder Client
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","session_id":"s1","model":"openai"}'
```

---

## 📚 Documentation Map

- **PROJECT_SUMMARY.md** ← Start here for overview
- **SETUP_GUIDE.md** ← Complete setup instructions
- **IMPLEMENTATION.md** ← Technical deep dive
- **README.md** ← Quick reference for features
- **QUICK_REFERENCE.md** ← This file!

---

## 🎯 Common Tasks

### Change Chat Model Behavior
→ Modify `SYSTEM_PROMPT` in server.py

### Add New Data Source
→ Add query in `get_inventory_context()` in server.py

### Customize UI Colors
→ Edit CSS variables in src/index.css

### Change Quick Suggestions
→ Edit `QUICK_ACTIONS` in ChatWidget.jsx

### Deploy to Production
→ See "Deployment Checklist" above

### Debug Issues
→ Check troubleshooting section

---

## ⚡ Commands Cheat Sheet

```bash
# Frontend
npm install              # Install deps
npm start                # Dev server (port 3000)
npm run build            # Production build

# Backend
python -m venv venv      # Create venv
source venv/bin/activate # Activate (macOS/Linux)
pip install -r requirements.txt  # Install deps
uvicorn server:app --reload      # Dev server (port 8000)

# Database
mongosh "mongodb+srv://..."      # Connect MongoDB
```

---

## 🔗 Quick Links

- **Supabase**: https://supabase.com
- **MongoDB Atlas**: https://mongodb.com/cloud/atlas
- **Emergent AI**: https://emergent.sh
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com

---

## 📞 When You Get Stuck

1. Check the **Troubleshooting** section above
2. Read **SETUP_GUIDE.md** for detailed help
3. Check **IMPLEMENTATION.md** for architecture
4. Look at browser console (F12) for errors
5. Check backend logs for server errors
6. Verify all .env variables are set

---

**Keep this handy while developing!** 📌

Last updated: 2024 | Ready for production use ✅
