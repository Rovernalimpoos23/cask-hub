'use client'
// src/app/(app)/command-center/sales/page.tsx
// CASK Operating System — Sales & Marketing department landing page.
// Summary view: dark hero banner, 4 live stat cards (backed by Supabase
// sales_kpi_data / sales_hot_list / sales_conversions, with seeded fallbacks) and the
// REPORTS grid. The full live KPI dashboard now lives at its own page
// (/command-center/sales/kpi-dashboard), linked from the "Sales KPI Dashboard" card.

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

const ACCENT = '#3B82F6' // brand blue (Sales & Marketing)
const GREEN = '#16A34A' // on / above target

// ── Floating Sales AI — palette + chat config ────────────────────────
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
  "Sales AI online. I have context on the Sales & Marketing pipeline, forecasts, lead sources, and the 9 reports. Ask about pipeline, forecasts, win rates, or what to connect next."

const QUICK_PROMPTS = ['Pipeline overview', 'Revenue forecast', 'What to connect?']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// Fractal-noise grain + faint engineering grid — same texture as Command Center.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")"
const GRID_BG =
  'linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)'

// REPORTS — 9 locked report cards (Coming Soon until a CRM is connected).
const REPORTS: { name: string; description: string }[] = [
  { name: 'Pipeline Report', description: 'Track all active deals by stage, value and close date' },
  { name: 'Revenue Forecast', description: 'Project monthly and quarterly revenue based on pipeline' },
  { name: 'Lead Source Report', description: 'See where your leads are coming from — referrals, ads, organic' },
  { name: 'Conversion Metrics', description: 'Track lead to close conversion rates across all stages' },
  { name: 'Proposal Aging', description: 'Monitor proposals that have been outstanding too long' },
  { name: 'Win / Loss Report', description: 'Analyze won and lost deals to improve close rates' },
  { name: 'Marketing ROI', description: 'Measure all marketing activities return on investment' },
  { name: 'Capacity Alignment', description: 'Align sales operations and capacity' },
  { name: 'Budget vs Actual', description: 'Compare actual performance against budget targets' },
]

// ── Shared icons ─────────────────────────────────────────────────────

function HeroIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function LockIcon({ size = 11, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function IconBadge({ size = 52, children }: { size?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        background: `linear-gradient(150deg, ${ACCENT}, ${ACCENT}cc)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 6px 18px ${ACCENT}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}
    >
      {children}
    </div>
  )
}

function StatusBadge({ color, label, locked = false }: { color: string; label: string; locked?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        padding: '5px 11px',
        borderRadius: 20,
        color,
        background: `${color}1f`,
        border: `1px solid ${color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}
    >
      {locked ? <LockIcon size={11} color={color} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
      {label}
    </span>
  )
}

// Section label with a short red accent line + subtitle below — CASK Hub style.
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 30, height: 3, borderRadius: 2, background: 'var(--red)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--text)' }}>
          {title}
        </span>
      </div>
      {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 7, marginLeft: 42 }}>{subtitle}</div>}
    </div>
  )
}

// Shared card chrome for both the locked report cards and the live KPI dashboard card.
function reportCardStyle(hovered: boolean): React.CSSProperties {
  return {
    position: 'relative',
    background: 'var(--surface)',
    backgroundImage: GRID_BG,
    backgroundSize: '22px 22px',
    borderTop: `1px solid ${hovered ? `${ACCENT}44` : 'var(--border)'}`,
    borderRight: `1px solid ${hovered ? `${ACCENT}44` : 'var(--border)'}`,
    borderBottom: `1px solid ${hovered ? `${ACCENT}44` : 'var(--border)'}`,
    borderLeft: `6px solid ${ACCENT}`,
    borderRadius: 14,
    padding: '18px 20px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease',
    boxShadow: hovered ? `0 14px 30px -10px ${ACCENT}55, 0 0 0 1px ${ACCENT}22` : '0 1px 3px rgba(0,0,0,0.07)',
    transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
  }
}

function CardAvatar({ letter }: { letter: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: ACCENT,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.5px',
        flexShrink: 0,
        boxShadow: `0 2px 8px ${ACCENT}55`,
      }}
    >
      {letter}
    </div>
  )
}

// Locked report card — matches the original Command Center department report cards.
function ReportCard({ name, description }: { name: string; description: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={reportCardStyle(hovered)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <CardAvatar letter={name.charAt(0).toUpperCase()} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
          {name}
        </span>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', margin: 0, marginBottom: 16 }}>
        {description}
      </p>

      <div style={{ marginTop: 'auto' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            padding: '5px 11px',
            borderRadius: 20,
            color: 'rgba(255,255,255,0.92)',
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <LockIcon size={10} color="rgba(255,255,255,0.92)" /> Coming Soon
        </span>
      </div>
    </div>
  )
}

// Live report card — the only unlocked card. Links to the dedicated KPI dashboard.
function LiveReportCard({ name, description, href }: { name: string; description: string; href: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ ...reportCardStyle(hovered), cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
          <CardAvatar letter="K" />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
            {name}
          </span>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', margin: 0, marginBottom: 16 }}>
          {description}
        </p>

        <div style={{ marginTop: 'auto' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '5px 11px',
              borderRadius: 20,
              color: GREEN,
              background: `${GREEN}1f`,
              border: `1px solid ${GREEN}40`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
            Live
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Floating Sales AI button + chat drawer ───────────────────────────

function FloatingSalesAI() {
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
        .eq('page_context', '/command-center/sales')
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
      .insert({ user_email: userEmailRef.current, page_context: '/command-center/sales', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/command-center/sales')
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
          pageContext: '/command-center/sales',
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
        @keyframes salesSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Sales & Marketing */}
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
        Sales AI
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
            animation: 'salesSlideUp 220ms ease',
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
                Sales AI
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
                  {m.role === 'user' ? 'You' : 'Sales AI'}
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
                  Sales AI
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
                placeholder="Ask about pipeline, forecasts..."
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

// ── Page ─────────────────────────────────────────────────────────────

export default function SalesDepartmentPage() {
  return (
    <>
      <TopBar title="Sales & Marketing" subtitle="Sales Manager · Weekly / Monthly">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            padding: '5px 11px',
            borderRadius: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: GREEN,
            background: `${GREEN}1f`,
            border: `1px solid ${GREEN}40`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
          Live
        </span>
      </TopBar>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-7 animate-page-in" style={{ background: 'var(--bg)' }}>

        {/* Back link */}
        <Link
          href="/command-center"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text3)',
            textDecoration: 'none',
            marginBottom: 18,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = ACCENT }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          ← Command Center
        </Link>

        {/* Hero banner — premium dark */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1c1c20 0%, #121215 100%)',
            borderLeft: `6px solid ${ACCENT}`,
            borderRadius: 14,
            padding: '24px 26px',
            marginBottom: 28,
            boxShadow: '0 10px 34px -14px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ position: 'absolute', top: -100, left: '18%', width: 380, height: 260, background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.4, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
              <IconBadge><HeroIcon /></IconBadge>
              <div style={{ minWidth: 0 }}>
                <h1 className="font-serif" style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 30, fontWeight: 400, letterSpacing: '-0.5px', color: '#fafaf9', lineHeight: 1.05, margin: 0 }}>
                  Sales &amp; Marketing
                </h1>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginTop: 7 }}>
                  Sales Manager · Weekly / Monthly
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <StatusBadge color={GREEN} label="Live" />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Data Source: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Sales KPI Tracker · Q2 2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reports */}
        <section style={{ marginTop: 38 }}>
          <SectionHeader title="Reports" subtitle="10 reports · Connect your CRM to unlock full automation" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {REPORTS.map((r) => (
              <ReportCard key={r.name} name={r.name} description={r.description} />
            ))}
            <LiveReportCard
              name="Sales KPI Dashboard"
              description="Live sales performance · Jeff's KPI Tracker · Q2 2026"
              href="/command-center/sales/kpi-dashboard"
            />
          </div>
        </section>
      </div>

      {/* Floating Sales AI button + chat drawer — bottom-right, this page only */}
      <FloatingSalesAI />
    </>
  )
}
