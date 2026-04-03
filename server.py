from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Supabase config
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Pydantic Models ---

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChatRequest(BaseModel):
    message: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    model: str = "openai"  # "openai" or "gemini"

class ChatResponse(BaseModel):
    response: str
    session_id: str
    model_used: str
    data_context: Optional[dict] = None

class ChatHistory(BaseModel):
    session_id: str
    messages: List[ChatMessage]

# --- Supabase Helper ---

async def query_supabase(table: str, params: dict = None):
    """Query Supabase REST API"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        resp = await http_client.get(url, headers=headers, params=params or {})
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Supabase query error: {resp.status_code} - {resp.text}")
        return []

async def get_inventory_context():
    """Fetch a comprehensive snapshot of inventory data for LLM context"""
    items = await query_supabase("items", {"select": "*", "limit": "50"})
    categories = await query_supabase("categories", {"select": "*"})
    inventory = await query_supabase("inventory", {"select": "*", "limit": "50"})
    sales = await query_supabase("sales", {"select": "*", "order": "created_at.desc", "limit": "20"})
    notifications = await query_supabase("notifications", {"select": "*", "limit": "20"})
    users = await query_supabase("users", {"select": "id,full_name,role,is_active"})

    # Build category lookup
    cat_map = {c["id"]: c["name"] for c in categories}
    # Build inventory lookup
    inv_map = {i["item_id"]: i for i in inventory}

    # Enrich items with category name and stock info
    enriched_items = []
    for item in items:
        cat_name = cat_map.get(item.get("category_id"), "Unknown")
        stock_info = inv_map.get(item["id"], {})
        enriched_items.append({
            "name": item["name"],
            "category": cat_name,
            "unit_price": item["unit_price"],
            "stock_quantity": stock_info.get("quantity", 0),
            "warehouse": stock_info.get("warehouse_location", "N/A"),
            "reorder_level": item.get("reorder_level", 0),
            "low_stock": stock_info.get("quantity", 0) <= item.get("reorder_level", 0)
        })

    # Calculate summary stats
    total_items = len(items)
    total_stock = sum(i.get("quantity", 0) for i in inventory)
    low_stock_items = [i for i in enriched_items if i["low_stock"]]
    total_sales = len(sales)
    completed_sales = [s for s in sales if s.get("status") == "completed"]
    cancelled_sales = [s for s in sales if s.get("status") == "cancelled"]
    total_revenue = sum(s.get("total_amount", 0) for s in completed_sales)

    context = {
        "summary": {
            "total_items": total_items,
            "total_categories": len(categories),
            "total_stock_units": total_stock,
            "low_stock_count": len(low_stock_items),
            "total_sales": total_sales,
            "completed_sales": len(completed_sales),
            "cancelled_sales": len(cancelled_sales),
            "total_revenue": total_revenue,
            "active_users": len([u for u in users if u.get("is_active")])
        },
        "categories": [{"name": c["name"], "description": c.get("description", "")} for c in categories],
        "items": enriched_items,
        "recent_sales": [{
            "bill_number": s["bill_number"],
            "customer": s["customer_name"],
            "amount": s["total_amount"],
            "status": s["status"],
            "date": s.get("sale_date", "")
        } for s in sales[:10]],
        "low_stock_alerts": low_stock_items,
        "notifications": [{"title": n["title"], "message": n["message"], "type": n["type"]} for n in notifications[:10]],
        "team": [{"name": u["full_name"], "role": u["role"]} for u in users]
    }
    return context

def detect_query_intent(message: str):
    """Simple intent detection to optimize data fetching"""
    msg = message.lower()
    intents = []
    if any(w in msg for w in ["stock", "inventory", "quantity", "warehouse", "restock", "low stock"]):
        intents.append("inventory")
    if any(w in msg for w in ["sale", "bill", "revenue", "customer", "transaction", "sell"]):
        intents.append("sales")
    if any(w in msg for w in ["item", "product", "price", "category"]):
        intents.append("items")
    if any(w in msg for w in ["user", "team", "role", "admin", "salesman", "manager"]):
        intents.append("users")
    if any(w in msg for w in ["alert", "notification", "warning"]):
        intents.append("notifications")
    if not intents:
        intents = ["general"]
    return intents

SYSTEM_PROMPT = """You are InventoryPro Assistant, an AI-powered chatbot for the InventoryPro inventory management platform.

You help users with:
- Checking stock levels and inventory status
- Viewing sales data and revenue information
- Understanding categories and items
- Providing platform usage guidance
- Answering questions about team roles and workflows

You have access to LIVE data from the InventoryPro database. When answering questions about data, use the context provided below. Be precise with numbers and names. Format responses clearly with bullet points or tables when appropriate.

If someone asks about something outside the inventory/sales domain, politely redirect them to relevant features.

Important rules:
- Always reference actual data when available
- Be concise but thorough
- Use currency values without specifying currency symbol (the system uses the default currency)
- For low stock alerts, mention the reorder level
- Never expose user passwords or sensitive authentication details
- When listing items, include stock quantity and price
"""

# --- Chat Endpoints ---

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Fetch relevant data context
        context_data = await get_inventory_context()

        # Build context string for the LLM
        context_str = f"""
LIVE INVENTORY DATA:

Summary:
- Total Items: {context_data['summary']['total_items']}
- Total Categories: {context_data['summary']['total_categories']}
- Total Stock Units: {context_data['summary']['total_stock_units']}
- Low Stock Items: {context_data['summary']['low_stock_count']}
- Total Sales: {context_data['summary']['total_sales']}
- Completed Sales: {context_data['summary']['completed_sales']}
- Cancelled Sales: {context_data['summary']['cancelled_sales']}
- Total Revenue (completed): {context_data['summary']['total_revenue']}
- Active Users: {context_data['summary']['active_users']}

Categories: {', '.join(c['name'] for c in context_data['categories'])}

Items with Stock:
{chr(10).join(f"- {i['name']} | Category: {i['category']} | Price: {i['unit_price']} | Stock: {i['stock_quantity']} | Warehouse: {i['warehouse']} | Low Stock: {'YES' if i['low_stock'] else 'No'}" for i in context_data['items'])}

Recent Sales:
{chr(10).join(f"- {s['bill_number']} | Customer: {s['customer']} | Amount: {s['amount']} | Status: {s['status']} | Date: {s['date']}" for s in context_data['recent_sales'])}

Team Members:
{chr(10).join(f"- {t['name']} ({t['role']})" for t in context_data['team'])}

Low Stock Alerts:
{chr(10).join(f"- {i['name']} has {i['stock_quantity']} units (reorder level: {i['reorder_level']})" for i in context_data['low_stock_alerts']) if context_data['low_stock_alerts'] else 'No low stock alerts'}

Recent Notifications:
{chr(10).join(f"- [{n['type']}] {n['title']}: {n['message']}" for n in context_data['notifications']) if context_data['notifications'] else 'No recent notifications'}
"""

        full_system = SYSTEM_PROMPT + "\n\n" + context_str

        # Load chat history from MongoDB
        history_doc = await db.chat_sessions.find_one(
            {"session_id": request.session_id},
            {"_id": 0}
        )
        
        # Set up LLM
        chat_instance = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=request.session_id,
            system_message=full_system
        )

        if request.model == "gemini":
            chat_instance.with_model("gemini", "gemini-2.5-flash")
        else:
            chat_instance.with_model("openai", "gpt-4.1-mini")

        # Send message to LLM
        user_msg = UserMessage(text=request.message)
        ai_response = await chat_instance.send_message(user_msg)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Store messages in MongoDB
        user_chat_msg = {"role": "user", "content": request.message, "timestamp": now_iso}
        ai_chat_msg = {"role": "assistant", "content": ai_response, "timestamp": now_iso}

        await db.chat_sessions.update_one(
            {"session_id": request.session_id},
            {
                "$push": {"messages": {"$each": [user_chat_msg, ai_chat_msg]}},
                "$set": {"updated_at": now_iso},
                "$setOnInsert": {"created_at": now_iso}
            },
            upsert=True
        )

        model_used = "Gemini 2.5 Flash" if request.model == "gemini" else "GPT 4.1 Mini"

        return ChatResponse(
            response=ai_response,
            session_id=request.session_id,
            model_used=model_used,
            data_context={"summary": context_data["summary"]}
        )

    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")


@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    doc = await db.chat_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    if not doc:
        return {"session_id": session_id, "messages": []}
    return {"session_id": session_id, "messages": doc.get("messages", [])}


@api_router.get("/data/summary")
async def get_data_summary():
    """Quick data summary endpoint"""
    try:
        context = await get_inventory_context()
        return context["summary"]
    except Exception as e:
        logger.error(f"Summary error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/data/items")
async def get_items():
    """Get all items with stock info"""
    try:
        context = await get_inventory_context()
        return context["items"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/")
async def root():
    return {"message": "InventoryPro Chatbot API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
