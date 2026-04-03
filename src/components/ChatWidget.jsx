import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, RotateCcw } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QUICK_ACTIONS = [
  "What items are low on stock?",
  "Show me recent sales",
  "Total revenue overview",
  "List all items with prices",
  "Team members and roles",
  "Inventory summary"
];

function generateSessionId() {
  return "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-[#002FA7]/10 flex items-center justify-center text-[#002FA7] shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="typing-dot h-2 w-2 rounded-full bg-gray-400" />
          <div className="typing-dot h-2 w-2 rounded-full bg-gray-400" />
          <div className="typing-dot h-2 w-2 rounded-full bg-gray-400" />
        </div>
      </div>
    </div>
  );
}

function formatMessage(text) {
  if (!text) return "";
  // Simple markdown-like formatting
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
  return formatted;
}

function MessageBubble({ message, index }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={isUser ? "flex items-end justify-end gap-3" : "flex items-start gap-3"}
      data-testid={`chat-message-${message.role}-${index}`}
    >
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-[#002FA7]/10 flex items-center justify-center text-[#002FA7] shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div
        className={
          isUser
            ? "bg-[#002FA7] text-white rounded-2xl rounded-tr-sm p-4 shadow-md max-w-[85%]"
            : "bot-message bg-white border border-gray-100 rounded-2xl rounded-tl-sm p-4 shadow-sm text-gray-800 max-w-[85%]"
        }
      >
        {isUser ? (
          <p className="text-sm font-ibm-plex leading-relaxed">{message.content}</p>
        ) : (
          <div
            className="text-sm font-ibm-plex leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
          />
        )}
      </div>
    </motion.div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("openai");
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem("chatbot_session_id");
    if (stored) return stored;
    const newId = generateSessionId();
    localStorage.setItem("chatbot_session_id", newId);
    return newId;
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await axios.get(`${API}/chat/history/${sessionId}`);
        if (res.data?.messages?.length > 0) {
          setMessages(res.data.messages);
        }
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    };
    loadHistory();
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: "user", content: text.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post(`${API}/chat`, {
        message: text.trim(),
        session_id: sessionId,
        model: model,
      });

      const aiMsg = {
        role: "assistant",
        content: res.data.response,
        timestamp: new Date().toISOString(),
        model_used: res.data.model_used,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
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
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = async () => {
    setMessages([]);
    const newId = generateSessionId();
    localStorage.setItem("chatbot_session_id", newId);
    window.location.reload();
  };

  const showQuickActions = messages.length === 0;

  return (
    <>
      {/* Launcher Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            data-testid="chat-launcher-button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#002FA7] flex items-center justify-center text-white shadow-[0_8px_32px_rgba(0,47,167,0.3)] hover:scale-105 transition-transform cursor-pointer"
          >
            <MessageSquare className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-testid="chat-widget-window"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] max-w-[calc(100vw-3rem)] flex flex-col overflow-hidden bg-white rounded-2xl shadow-2xl border border-gray-200/50 origin-bottom-right"
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between backdrop-blur-xl bg-white/80 border-b border-gray-100 z-10 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#002FA7]/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-[#002FA7]" />
                </div>
                <div>
                  <h3 className="text-sm font-manrope font-bold text-gray-900 tracking-tight">InventoryPro AI</h3>
                  <p className="text-[11px] text-gray-400 font-ibm-plex">Ask about your inventory data</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="New conversation"
                  data-testid="chat-clear-button"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  data-testid="chat-close-button"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Model Toggle */}
            <div className="px-4 py-2 flex items-center justify-between bg-white border-b border-gray-50">
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  data-testid="model-toggle-openai"
                  onClick={() => setModel("openai")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    model === "openai"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  OpenAI
                </button>
                <button
                  data-testid="model-toggle-gemini"
                  onClick={() => setModel("gemini")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    model === "gemini"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Gemini
                </button>
              </div>
              <span className="text-[10px] text-gray-300 font-ibm-plex">
                {model === "openai" ? "GPT 4.1 Mini" : "Gemini 2.5 Flash"}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 chat-scrollbar" data-testid="chat-messages-area">
              {/* Welcome message if no messages */}
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-[#002FA7]/10 flex items-center justify-center text-[#002FA7] shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm p-4 shadow-sm">
                    <p className="text-sm font-ibm-plex text-gray-800 leading-relaxed">
                      Hi! I'm your <strong>InventoryPro Assistant</strong>. I can help you with stock levels, sales data, team info, and more. What would you like to know?
                    </p>
                  </div>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} index={i} />
              ))}

              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {showQuickActions && (
              <div className="px-4 py-3 border-t border-gray-50 bg-white">
                <p className="text-[10px] text-gray-400 font-ibm-plex uppercase tracking-wider mb-2">Suggestions</p>
                <div className="flex gap-2 overflow-x-auto quick-actions-scroll pb-1">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      data-testid="quick-action-button"
                      onClick={() => sendMessage(action)}
                      className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[11px] font-ibm-plex text-gray-600 hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-[#002FA7]/5 transition-colors whitespace-nowrap cursor-pointer shadow-sm shrink-0"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full pl-4 pr-1 py-1 focus-within:ring-2 focus-within:ring-[#002FA7]/20 focus-within:border-[#002FA7] transition-all">
                <input
                  ref={inputRef}
                  data-testid="chat-input-field"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about inventory, sales, stock..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-ibm-plex text-gray-900 placeholder:text-gray-400 py-2 outline-none"
                  disabled={isLoading}
                />
                <button
                  data-testid="chat-send-button"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="h-8 w-8 rounded-full bg-[#002FA7] flex items-center justify-center text-white hover:bg-[#002FA7]/90 shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
