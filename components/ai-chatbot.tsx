'use client'

import React, { useState, useRef, useEffect } from 'react'
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
      content: 'Hello! I am your AI inventory assistant. Ask me about low stock items, sales trends, or inventory reports.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => {
      const form = document.querySelector('form') as HTMLFormElement
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }))
    }, 0)
  }

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const userInput = input
    setInput('')
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages,
            userMessage,
          ].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch')
      }

      if (!response.body) {
        setIsLoading(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.delta) {
                fullContent += parsed.delta
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: fullContent } : msg
                  )
                )
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: 'Error fetching response. Please try again.' }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-full shadow-2xl hover:shadow-blue-600/50 transition-all duration-300 hover:scale-110 flex items-center justify-center"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[650px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap size={18} />
                AI Assistant
              </h2>
              <p className="text-xs text-blue-100 mt-1">Real-time inventory insights</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition"
              >
                <Settings size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-blue-500/20 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="bg-blue-50 dark:bg-slate-800 border-b border-blue-200 dark:border-slate-700 px-6 py-4">
              <div className="space-y-2 text-sm">
                <button
                  onClick={() => handleQuickAction('Show me all items with low stock levels')}
                  className="w-full px-3 py-2 text-left bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                >
                  <Zap size={14} className="inline mr-2" /> Low Stock
                </button>
                <button
                  onClick={() => handleQuickAction('What are the recent sales trends?')}
                  className="w-full px-3 py-2 text-left bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition"
                >
                  <TrendingUp size={14} className="inline mr-2" /> Sales
                </button>
                <button
                  onClick={() => handleQuickAction('Generate an inventory report')}
                  className="w-full px-3 py-2 text-left bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
                >
                  <BarChart3 size={14} className="inline mr-2" /> Report
                </button>
                <button
                  onClick={() => handleQuickAction('List all users in the system')}
                  className="w-full px-3 py-2 text-left bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition"
                >
                  <RefreshCw size={14} className="inline mr-2" /> Users
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 px-6 py-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
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
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-slate-800 px-4 py-3 rounded-lg rounded-bl-none">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
