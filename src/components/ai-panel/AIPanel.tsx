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

// Animated sound wave icon (3 bars)
function SoundWave() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 12,
        marginLeft: 5,
        verticalAlign: 'middle',
      }}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'block',
            width: 2,
            borderRadius: 2,
            background: '#10b981',
            animation: `soundBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes soundBar {
          from { height: 3px; opacity: 0.5; }
          to   { height: 11px; opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export default function AIPanel() {
  const [messages, setMessages] = useState<AIMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Restore voice preference
  useEffect(() => {
    if (localStorage.getItem('cask-voice-enabled') === 'true') setVoiceEnabled(true)
  }, [])

  // Persist voice preference
  useEffect(() => {
    localStorage.setItem('cask-voice-enabled', voiceEnabled.toString())
  }, [voiceEnabled])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  function stopSpeech() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
    setSpeakingIndex(null)
  }

  async function speakText(text: string, msgIndex: number) {
    if (!voiceEnabled) return
    stopSpeech()
    try {
      setIsSpeaking(true)
      setSpeakingIndex(msgIndex)
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Speech failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setIsSpeaking(false)
        setSpeakingIndex(null)
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch {
      setIsSpeaking(false)
      setSpeakingIndex(null)
    }
  }

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')

    const userMsg: AIMessage = { role: 'user', content: msg }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setIsThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const aiMsg: AIMessage = { role: 'assistant', content: data.content }
      setMessages(prev => {
        const updated = [...prev, aiMsg]
        // speak using the new index after state update
        const newIndex = updated.length - 1
        speakText(data.content, newIndex)
        return updated
      })
    } catch {
      const fallback = 'I have full access to all 6 ActionCOACH sessions. Ask me about specific meetings, action items, coaching themes, or the May 28th agenda.'
      setMessages(prev => {
        const updated = [...prev, { role: 'assistant' as const, content: fallback }]
        speakText(fallback, updated.length - 1)
        return updated
      })
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
              style={{ color: 'rgba(255,255,255,0.7)', background: 'var(--charcoal)' }}
            >
              Groq AI
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className="w-[7px] h-[7px] rounded-full status-blink"
              style={{ background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.4)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
              6 sessions loaded
            </span>
          </div>
        </div>

        {/* Voice controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Stop button — only when speaking */}
          {isSpeaking && (
            <button
              onClick={stopSpeech}
              title="Stop speaking"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: '1px solid #10b981',
                background: 'rgba(16,185,129,0.08)',
                color: '#10b981',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease',
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="1" width="8" height="8" rx="1" />
              </svg>
            </button>
          )}

          {/* Speaker toggle */}
          <button
            onClick={() => { setVoiceEnabled(v => !v); if (isSpeaking) stopSpeech() }}
            title={voiceEnabled ? 'Voice on — click to mute' : 'Voice off — click to enable'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px 3px 6px',
              borderRadius: 20,
              border: voiceEnabled
                ? '1px solid #10b981'
                : '1px solid var(--border)',
              background: voiceEnabled
                ? 'rgba(16,185,129,0.08)'
                : 'var(--surface2)',
              color: voiceEnabled ? '#10b981' : 'var(--text3)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: voiceEnabled ? '0 0 0 2px rgba(16,185,129,0.15)' : 'none',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            {voiceEnabled ? (
              /* Speaker ON */
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              /* Speaker OFF / muted */
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
            <span>{voiceEnabled ? 'Voice' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, i) => {
          const isCurrentlySpeaking = speakingIndex === i
          return (
            <div
              key={i}
              className={`text-[12px] leading-relaxed rounded-lg px-3 py-2.5 max-w-[88%] ${
                msg.role === 'user' ? 'self-end' : 'self-start'
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
                      border: `1px solid ${isCurrentlySpeaking ? '#10b981' : 'var(--border)'}`,
                      borderLeft: isCurrentlySpeaking ? '3px solid #10b981' : '1px solid var(--border)',
                      borderRadius: '2px 10px 10px 10px',
                      whiteSpace: 'pre-wrap',
                      transition: 'border-color 200ms ease',
                    }
              }
            >
              {msg.content}
              {isCurrentlySpeaking && <SoundWave />}
            </div>
          )
        })}

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
          Powered by Groq · CASK Hub AI
        </p>
      </div>
    </aside>
  )
}
