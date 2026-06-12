'use client'
// src/app/(app)/daily-meetings/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  TopBar,
  PillGreen,
  PillRed,
  MeetingCard,
} from '@/components/ui'
import { fetchAllMeetings } from '@/lib/meetings-client'
import type { Meeting } from '@/types'

// Filter tabs — matched case-insensitively against the meeting title.
const FILTERS: { value: string; label: string; match: (title: string) => boolean }[] = [
  { value: 'all',         label: 'All',         match: () => true },
  { value: 'kai',         label: 'Kai',         match: t => t.includes('kai') },
  { value: 'joseph',      label: 'Joseph',      match: t => t.includes('joseph') },
  { value: 'leadership',  label: 'Leadership',  match: t => t.includes('leadership') },
  { value: 'department',  label: 'Department',  match: t => t.includes('department') || t.includes('alignment') },
  { value: 'pit',         label: 'PIT',         match: t => t.includes('pit') },
  { value: 'actioncoach', label: 'ActionCoach', match: t => t.includes('actioncoach') || t.includes('coach') },
  { value: 'operations',  label: 'Operations',  match: t => t.includes('pre-con') || t.includes('construction') || t.includes('operations') || t.includes('preconstruction') },
  { value: 'sales',       label: 'Sales',       match: t => t.includes('sales') || t.includes('huddle') },
]

// ── Floating Daily Meetings AI — palette + chat config ───────────────
const AI_ACCENT = '#c8311a' // CASK red

// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const AI_D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: AI_ACCENT,
}

const AI_GREETING =
  "Daily Meetings AI online. I have context on all daily huddles, team meetings, recaps, and summaries — Kai, Joseph, leadership, department, PIT, and operations meetings. Ask about team meetings, recaps, or summaries."

const AI_QUICK_PROMPTS = ['Latest huddle recap', "Today's meetings", 'Summarize this week']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Daily Meetings AI button + chat drawer ──────────────────

function FloatingDailyMeetingsAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/daily-meetings',
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.content || 'No response.' }])
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
        @keyframes dailyMeetingsSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Daily Meetings */}
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
        Daily Meetings AI
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
            background: AI_D.bg,
            color: AI_D.text,
            border: `1px solid ${AI_D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'dailyMeetingsSlideUp 220ms ease',
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
                  background: AI_D.accent,
                  boxShadow: `0 0 8px ${AI_D.accent}`,
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
                Daily Meetings AI
              </span>
            </span>
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
          </div>

          {/* Feed */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? `1px solid ${AI_D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? AI_D.text3 : AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'Daily Meetings AI'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? AI_D.text2 : AI_D.text,
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
                    color: AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  Daily Meetings AI
                </div>
                <div style={{ fontSize: 12.5, color: AI_D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {AI_QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: AI_D.surface,
                    border: `1px solid ${AI_D.border}`,
                    color: AI_D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${AI_D.accent}66`
                    e.currentTarget.style.color = AI_D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = AI_D.border
                    e.currentTarget.style.color = AI_D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${AI_D.border}`, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${AI_D.border}`,
                background: AI_D.surface,
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about team meetings, recaps, summaries..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: AI_D.text,
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
                  background: input.trim() && !thinking ? AI_D.accent : AI_D.surface,
                  color: input.trim() && !thinking ? '#fff' : AI_D.text3,
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

export default function DailyMeetingsPage() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const loadMeetings = useCallback(() => {
    setLoading(true)
    fetchAllMeetings().then(data => {
      setMeetings(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadMeetings()
    const handler = () => { loadMeetings(); router.refresh() }
    window.addEventListener('cask-meeting-saved', handler)
    return () => window.removeEventListener('cask-meeting-saved', handler)
  }, [loadMeetings, router])

  const activeFilter = FILTERS.find(f => f.value === filter) ?? FILTERS[0]
  const filtered = meetings.filter(m => activeFilter.match(m.title.toLowerCase()))

  return (
    <>
      <TopBar title="Daily Meetings Recap" subtitle="President's Workflow">
        <PillGreen>Claude AI Active</PillGreen>
        <PillRed>{meetings.length} meetings recorded</PillRed>
        <button
          onClick={() => window.dispatchEvent(new Event('cask-open-add-modal'))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--charcoal)',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.82' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
          Add Meeting
        </button>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            Daily Meetings Recap
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            {loading
              ? 'Loading…'
              : `All CASK Construction recorded meetings · ${meetings.length} meetings recorded`}
          </p>
        </div>

        {/* Filter tabs — replicates the app FilterBar style (charcoal-filled active),
            with per-tab count badges, an outline on inactive tabs, and wrapping. */}
        <div
          className="flex flex-wrap gap-1.5 mb-4 pb-3 items-center"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.value
            const n = f.value === 'all'
              ? meetings.length
              : meetings.filter(m => f.match(m.title.toLowerCase())).length
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="text-[12px] font-medium px-3 py-[5px] rounded-[5px] transition-all duration-150"
                style={{
                  background: isActive ? 'var(--charcoal)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text3)',
                  border: isActive ? '1px solid var(--charcoal)' : '1px solid var(--border)',
                  fontFamily: 'var(--font-geist), sans-serif',
                  cursor: 'pointer',
                }}
              >
                {f.label} ({n})
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="rounded-[10px] h-[82px] shimmer"
                style={{ border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(m => (
              <MeetingCard key={m.id} meeting={m} recapBadge />
            ))}
            {filtered.length === 0 && (
              <div
                className="text-center py-12 text-[13px]"
                style={{ color: 'var(--text3)' }}
              >
                No meetings found for this filter.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Daily Meetings AI button + chat drawer — bottom-right, this page only */}
      <FloatingDailyMeetingsAI />
    </>
  )
}
