'use client'
// src/app/(app)/generate/page.tsx

import { useState, useEffect, useRef } from 'react'
import { TopBar, PillGreen } from '@/components/ui'
import { createClient } from '@/lib/supabase'

// ── Floating Agenda AI — palette + chat config ───────────────────────
const ACCENT = '#c8311a' // CASK red

// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: ACCENT,
}

const AI_GREETING =
  "Agenda AI online. I can help you build, refine, and prepare meeting agendas using context from your past sessions and coaching program. Ask about agendas, meeting prep, or what to include."

const QUICK_PROMPTS = ['Suggest agenda topics', 'Prep checklist', 'Time the segments']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

const FALLBACK_AGENDA = `CASK Leadership Meeting — May 28, 2026
Date: Wednesday, May 28  ·  Time: 11:00 AM – 3:00 PM
Attendees: Calin, Chad, Lamont, Jeff, Matteo, Kait, Juliet

────────────────────────────────

11:00 – 11:05  |  WIFLE  (5 min)
• What I Feel Like Expressing — one word check-in

11:05 – 11:35  |  Education: Team Alignment — $20M Goal  (30 min)
• Where we stand vs. our $20M milestone
• What each department must own to get there
• Key alignment gaps to close this quarter

11:35 – 12:35  |  Q2 KPI Review by Department  (60 min)
• Each leader: biggest win + biggest gap
• Design Center update — Calin
• Operations · Sales/Marketing · Finance · People

12:35 – 1:05  |  Lunch Break  (30 min)

1:05 – 2:15  |  Individual Deep Dives  (20 min each)
• Q2 PIT Goal progress vs. commitment
• One challenge for group brainstorm
• Matteo → Lamont → Jeff → Kait → Chad

2:15 – 2:45  |  Leadership Whiteboard Discussion  (30 min)
• Top 3 priorities for June
• Cross-department decisions + ownership
• Design Center next steps

2:45 – 3:00  |  Wrap-Up & Commitments  (15 min)
• Recap decisions and BFOs (Blinding Flashes of the Obvious)
• Confirm ownership and deadlines
• Submit feedback forms`

// ── Floating Agenda AI button + chat drawer ──────────────────────────

function FloatingAgendaAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      userEmailRef.current = user.email
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', user.email)
        .eq('page_context', '/generate')
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setMessages(history as PanelMsg[])
      }
    }
    loadHistory()
  }, [])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: '/generate', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/generate')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/generate',
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <style>{`
        @keyframes agendaSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Generate Agenda */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          background: 'var(--charcoal)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? '0 12px 30px -6px rgba(0,0,0,0.45)'
            : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>💬</span>
        Agenda AI
      </button>

      {/* Chat drawer — slides up from bottom-right */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 61,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            height: 500,
            maxHeight: 'calc(100vh - 48px)',
            background: D.bg,
            color: D.text,
            border: `1px solid ${D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'agendaSlideUp 220ms ease',
          }}
        >
          {/* Dark header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: 'var(--charcoal)',
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: D.accent,
                  boxShadow: `0 0 8px ${D.accent}`,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: '#fff',
                }}
              >
                Agenda AI
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={clearHistory}
              title="Clear chat history"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            </span>
          </div>

          {/* Feed */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? `1px solid ${D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? D.text3 : D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'Agenda AI'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? D.text2 : D.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ padding: '11px 0' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: D.accent,
                    marginBottom: 5,
                  }}
                >
                  Agenda AI
                </div>
                <div style={{ fontSize: 12.5, color: D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: D.surface,
                    border: `1px solid ${D.border}`,
                    color: D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${D.accent}66`
                    e.currentTarget.style.color = D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = D.border
                    e.currentTarget.style.color = D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${D.border}`,
                background: D.surface,
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about agendas, meetings, preparation..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: D.text,
                  fontFamily: 'inherit',
                  maxHeight: 96,
                  overflowY: 'auto',
                  border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || thinking}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: input.trim() && !thinking ? D.accent : D.surface,
                  color: input.trim() && !thinking ? '#fff' : D.text3,
                  border: 'none',
                  cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms ease',
                }}
                title="Send"
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 1L11 6L6 11M11 6H1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function GeneratePage() {
  const [meetingType, setMeetingType] = useState('Leadership Meeting')
  const [duration, setDuration] = useState('4 hours')
  const [time, setTime] = useState('')
  const [education, setEducation] = useState('')
  const [topics, setTopics] = useState('')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  async function generate() {
    setLoading(true)
    setOutput('')

    try {
      const res = await fetch('/api/generate-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingType, duration, time, education, topics, date: today }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setOutput(data.agenda)
    } catch {
      setOutput(FALLBACK_AGENDA)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(output)
  }

  return (
    <>
      <TopBar title="Generate Agenda" subtitle="General Meetings">
        <PillGreen>Claude AI Active</PillGreen>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            Generate Meeting Agenda
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            Claude AI will create a tailored agenda based on your past sessions and coaching context.
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-[10px] p-6 mb-3.5"
          style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
        >
          <h2
            className="font-serif text-[20px] font-normal tracking-[-0.3px] mb-1"
            style={{ color: 'var(--text)' }}
          >
            Meeting Details
          </h2>
          <p className="text-[13px] mb-5 leading-relaxed" style={{ color: 'var(--text3)' }}>
            Fill in the details below. Claude will read your past sessions from the database as context.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-[5px]">
              <label
                className="text-[11px] font-semibold tracking-[0.5px]"
                style={{ color: 'var(--text2)' }}
              >
                Meeting Type
              </label>
              <select
                value={meetingType}
                onChange={e => setMeetingType(e.target.value)}
                className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-geist), sans-serif',
                }}
              >
                <option>Leadership Meeting</option>
                <option>Planning Session</option>
                <option>Coaching Session</option>
                <option>Education Session</option>
                <option>Owner Session</option>
              </select>
            </div>

            <div className="flex flex-col gap-[5px]">
              <label
                className="text-[11px] font-semibold tracking-[0.5px]"
                style={{ color: 'var(--text2)' }}
              >
                Duration
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-geist), sans-serif',
                }}
              >
                <option>1 hour</option>
                <option>1.5 hours</option>
                <option>2 hours</option>
                <option>3 hours</option>
                <option>4 hours</option>
                <option>6 hours</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-[5px] mb-3">
            <label
              className="text-[11px] font-semibold tracking-[0.5px]"
              style={{ color: 'var(--text2)' }}
            >
              Start Time <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={time}
              onChange={e => setTime(e.target.value)}
              placeholder="e.g. 11:00 AM"
              className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            />
          </div>

          <div className="flex flex-col gap-[5px] mb-3">
            <label
              className="text-[11px] font-semibold tracking-[0.5px]"
              style={{ color: 'var(--text2)' }}
            >
              Education Topic <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={education}
              onChange={e => setEducation(e.target.value)}
              placeholder="e.g. Team Alignment — Hitting Our $20M Goal"
              className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            />
          </div>

          <div className="flex flex-col gap-[5px] mb-5">
            <label
              className="text-[11px] font-semibold tracking-[0.5px]"
              style={{ color: 'var(--text2)' }}
            >
              Key Topics <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={topics}
              onChange={e => setTopics(e.target.value)}
              placeholder="e.g. Q2 KPI review, Design Center update, Department wins and bottlenecks..."
              rows={3}
              className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150 resize-y leading-relaxed"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-geist), sans-serif',
                minHeight: '70px',
              }}
            />
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-[22px] py-2.5 rounded-[6px] text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-50 disabled:translate-y-0"
              style={{
                background: 'var(--charcoal)',
                border: 'none',
                fontFamily: 'var(--font-geist), sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : undefined,
              }}
            >
              {loading ? (
                <>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1 h-1 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Generating...
                </>
              ) : (
                <>✦ Generate with Claude</>
              )}
            </button>
            {output && (
              <button
                onClick={copyToClipboard}
                className="text-[12px] font-medium px-[18px] py-2.5 rounded-[6px] transition-all duration-150 hover:border-[var(--border2)]"
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  fontFamily: 'var(--font-geist), sans-serif',
                  cursor: 'pointer',
                }}
              >
                Copy to Clipboard
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        {output && (
          <div
            className="rounded-[10px] p-6 relative overflow-hidden"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, var(--charcoal), var(--text2))' }}
            />
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5"
              style={{ color: 'var(--text3)' }}
            >
              Generated Agenda
            </div>
            <pre
              className="text-[13px] leading-[1.9] font-mono whitespace-pre-wrap"
              style={{ color: 'var(--text2)' }}
            >
              {output}
            </pre>
          </div>
        )}
      </div>

      {/* Floating Agenda AI button + chat drawer — bottom-right, this page only */}
      <FloatingAgendaAI />
    </>
  )
}
