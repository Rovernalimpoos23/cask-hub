'use client'
// src/components/ai-panel/AIPanel.tsx

import { useState, useRef, useEffect } from 'react'
import type { AIMessage } from '@/types'

const SUGGESTED_QUESTIONS = [
  'Last meeting summary',
  'Open action items',
  'May 28th agenda',
  'Design Center update',
]

const INITIAL_MESSAGE: AIMessage = {
  role: 'assistant',
  content: 'Good morning. I have full context on all 6 ActionCOACH sessions — Feb through April 2026. What would you like to know?',
}

export default function AIPanel() {
  const [messages, setMessages] = useState<AIMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')

    const userMsg: AIMessage = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setIsThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I have full access to all 6 ActionCOACH sessions. Ask me about specific meetings, action items, coaching themes, or the May 28th agenda.',
      }])
    } finally {
      setIsThinking(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <aside
      className="flex flex-col overflow-hidden"
      style={{ background: 'var(--white)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-[18px] py-3.5 flex items-center gap-2.5"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, var(--white), var(--bg))',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-semibold tracking-[-0.2px]"
              style={{ color: 'var(--text)' }}
            >
              CASK Intelligence
            </span>
            <span
              className="text-[9px] font-semibold tracking-[0.5px] uppercase px-1.5 py-[2px] rounded-[3px]"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'var(--charcoal)',
              }}
            >
              Claude AI
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className="w-[7px] h-[7px] rounded-full status-blink"
              style={{
                background: '#10b981',
                boxShadow: '0 0 6px rgba(16,185,129,0.4)',
              }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
              6 sessions loaded
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-[12px] leading-relaxed rounded-lg px-3 py-2.5 max-w-[88%] ${
              msg.role === 'user'
                ? 'self-end'
                : 'self-start'
            }`}
            style={
              msg.role === 'user'
                ? {
                    background: 'var(--charcoal)',
                    color: 'rgba(255,255,255,0.9)',
                    borderRadius: '10px 10px 2px 10px',
                  }
                : {
                    background: 'var(--surface2)',
                    color: 'var(--text2)',
                    border: '1px solid var(--border)',
                    borderRadius: '2px 10px 10px 10px',
                    whiteSpace: 'pre-wrap',
                  }
            }
          >
            {msg.content}
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <div
            className="self-start flex items-center gap-1.5 px-3 py-2.5 rounded-lg"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '2px 10px 10px 10px',
            }}
          >
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-all duration-150 hover:border-[var(--border2)]"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="flex items-end gap-2 rounded-lg p-1"
          style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about sessions, actions, agenda..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-[12px] px-2 py-1.5 outline-none leading-relaxed"
            style={{
              color: 'var(--text)',
              fontFamily: 'var(--font-geist), sans-serif',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isThinking}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 mb-0.5"
            style={{
              background: input.trim() && !isThinking ? 'var(--charcoal)' : 'var(--border)',
              color: input.trim() && !isThinking ? 'white' : 'var(--text3)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1L11 6L6 11M11 6H1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--text3)' }}>
          Powered by Claude · CASK Hub AI
        </p>
      </div>
    </aside>
  )
}
