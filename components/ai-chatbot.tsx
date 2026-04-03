'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, X, MessageCircle, Settings, Zap, TrendingUp, BarChart3, RefreshCw } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your advanced AI inventory assistant. I can help with inventory management, sales analytics, real-time queries, and more. How can I assist you today?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleQuickAction = (action: string) => {
    const quickPrompts: Record<string, string> = {
      stock: 'Show me all items with low stock levels (less than 10 units)',
      sales: 'What are the recent sales trends and analytics?',
      report: 'Generate a comprehensive inventory status report',
      users: 'List all users and their roles in the system',
    }

    const prompt = quickPrompts[action] || action
    setInput(prompt)
    
    // Use setTimeout to ensure state is updated before submission
    setTimeout(() => {
      const form = document.querySelector('form') as HTMLFormElement
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      }
    }, 0)
  }

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      // Handle streaming response
      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let buffer = ''

        // Create assistant message placeholder
        const assistantId = (Date.now() + 1).toString()
        const assistantMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('data:')) {
                const data = trimmed.slice(5).trim()
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)
                  
                  // Extract text from the chunk
                  if (parsed.type === 'text-delta' && parsed.delta) {
                    fullContent += parsed.delta
                    
                    // Update the assistant message in real-time
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantId
                          ? { ...msg, content: fullContent }
                          : msg
                      )
                    )
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (streamError) {
          console.error('[v0] Stream error:', streamError)
        }
      } else {
        // Fallback for non-streaming response
        const data = await response.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || 'No response generated',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('[v0] Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I am your advanced AI inventory assistant. I can help with inventory management, sales analytics, real-time queries, and more. How can I assist you today?',
        timestamp: new Date(),
      },
    ])
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-full shadow-2xl hover:shadow-blue-600/50 transition-all duration-300 hover:scale-110 hover:from-blue-700 hover:to-blue-900"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[650px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap size={18} />
                Advanced AI Assistant
              </h2>
              <p className="text-xs text-blue-100 mt-1">Real-time inventory insights</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-blue-50 dark:bg-slate-800 border-b border-blue-200 dark:border-slate-700 px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Quick Actions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleQuickAction('stock')}
                      className="px-3 py-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition flex items-center justify-center gap-1"
                    >
                      <Zap size={14} /> Low Stock
                    </button>
                    <button
                      onClick={() => handleQuickAction('sales')}
                      className="px-3 py-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition flex items-center justify-center gap-1"
                    >
                      <TrendingUp size={14} /> Sales
                    </button>
                    <button
                      onClick={() => handleQuickAction('report')}
                      className="px-3 py-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition flex items-center justify-center gap-1"
                    >
                      <BarChart3 size={14} /> Report
                    </button>
                    <button
                      onClick={() => handleQuickAction('users')}
                      className="px-3 py-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition flex items-center justify-center gap-1"
                    >
                      <RefreshCw size={14} /> Users
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleClearChat}
                  className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition font-medium"
                >
                  Clear Chat History
                </button>
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 px-6 py-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-none shadow-sm'
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1.5 ${
                      message.role === 'user'
                        ? 'text-blue-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-lg rounded-bl-none shadow-sm">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white disabled:opacity-50 text-sm"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={() => setIsLoading(false)}
                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                aria-label="Stop response"
              >
                <X size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  )
}
