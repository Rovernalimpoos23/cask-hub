'use client'
// src/app/(app)/command-center/executive/page.tsx
// CASK Operating System — Executive Command Center
// Framework / placeholder only. All data hardcoded — no Supabase, no real connections yet.
// Premium design matched to the Command Center page. Theme-adaptive (light + dark).

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/ui'

const ACCENT = '#F59E0B'
const GREEN = '#10B981'
const RED = '#EF4444'

// ── Floating Executive AI — palette + chat config ────────────────────
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
  "Executive AI online. I have context across all 5 departments — company performance, scorecards, cash position, backlog, and strategic initiatives. Ask about company performance, any department, or what to prioritize next."

const QUICK_PROMPTS = ['Company scorecard', 'Department status', 'What to prioritize?']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")"
const GRID_BG =
  'linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)'

// ── Data (hardcoded) ─────────────────────────────────────────────────

const STATS: { label: string; value: string; badge?: boolean }[] = [
  { label: 'Departments Connected', value: '0/5' },
  { label: 'Total Reports Live', value: '1/49' },
  { label: 'Active Alerts', value: '0' },
  { label: 'Weekly Briefing', value: 'Ready', badge: true },
]

const DEPARTMENT_STATUS: { name: string; connected: boolean; href?: string }[] = [
  { name: 'Customer Journey', connected: true, href: '/customers' },
  { name: 'Sales & Marketing', connected: false, href: '/command-center/sales' },
  { name: 'Operations', connected: false, href: '/command-center/operations' },
  { name: 'Finance', connected: false, href: '/command-center/finance' },
  { name: 'Human Resources', connected: false, href: '/command-center/hr' },
]

interface ExecReport {
  icon: string
  name: string
  description: string
  live: boolean
  href?: string
  cta?: string
}

const REPORTS: ExecReport[] = [
  { icon: '📊', name: 'Executive Dashboard', description: 'Real-time company overview — already live in CASK Hub', live: true, href: '/dashboard', cta: 'Open Dashboard →' },
  { icon: '📰', name: 'Weekly Leadership Report', description: 'Auto-generated weekly summary for the leadership team', live: false },
  { icon: '🏅', name: 'Company Scorecard', description: 'Overall company performance against strategic goals', live: false },
  { icon: '📈', name: 'KPI Overview', description: 'Key performance indicators across all departments', live: false },
  { icon: '📋', name: 'Backlog Report', description: 'Pipeline of upcoming projects and work backlog', live: false },
  { icon: '💵', name: 'Cash Position', description: 'Real-time cash position and liquidity overview', live: false },
  { icon: '💹', name: 'Profitability Overview', description: 'Company-wide profitability and margin analysis', live: false },
  { icon: '🗂️', name: 'Department Scorecards', description: 'Individual department performance scorecards', live: false },
  { icon: '🎯', name: 'Strategic Initiatives', description: 'Track progress on key strategic company initiatives', live: false },
  { icon: '⚠️', name: 'Risk & Opportunity Log', description: 'Monitor risks and opportunities across the business', live: false },
  { icon: '💰', name: 'Budget vs Actual', description: 'Company-wide budget vs actual performance', live: false },
]

// ── Shared icons ─────────────────────────────────────────────────────

function HeroIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /><path d="M3 15h6" /><path d="M15 7h2" /><path d="M15 11h2" /><path d="M15 15h2" />
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

function StatusBadge({ color, label, locked = false, glow = false }: { color: string; label: string; locked?: boolean; glow?: boolean }) {
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
      {locked
        ? <LockIcon size={11} color={color} />
        : <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: glow ? 'caskPulse 2.2s ease-in-out infinite' : undefined }} />}
      {label}
    </span>
  )
}

function StatSegment({ value, label, index, badge }: { value: string; label: string; index: number; badge?: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '22px 24px',
        borderLeft: index > 0 ? '1px solid var(--border)' : 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 120% at 85% 0%, ${(badge ? GREEN : ACCENT)}10, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      {badge ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 16,
            fontWeight: 700,
            padding: '7px 14px',
            borderRadius: 20,
            color: GREEN,
            background: `${GREEN}14`,
            border: `1px solid ${GREEN}33`,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, boxShadow: `0 0 6px ${GREEN}`, animation: 'caskPulse 2.2s ease-in-out infinite' }} />
          {value}
        </span>
      ) : (
        <div
          style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-1.5px',
            color: 'var(--text)',
            textShadow: `0 0 28px ${ACCENT}22`,
          }}
        >
          {value}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '1.2px',
          marginTop: badge ? 10 : 12,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--text2)', textTransform: 'uppercase' }}>
        {title}
      </span>
      {subtitle && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</span>}
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border), transparent)' }} />
    </div>
  )
}

function ConnectionPill({ name, connected }: { name: string; connected: boolean }) {
  const color = connected ? GREEN : RED
  return (
    <div
      style={{
        flex: '1 1 160px',
        minWidth: 0,
        background: 'var(--surface)',
        backgroundImage: GRID_BG,
        backgroundSize: '22px 22px',
        border: '1px solid var(--border)',
        borderLeft: `5px solid ${color}`,
        borderRadius: 12,
        padding: '13px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: connected ? 'caskPulse 2.2s ease-in-out infinite' : undefined }} />
        {connected ? 'Connected' : 'Not Connected'}
      </span>
    </div>
  )
}

function ReportCard({ report }: { report: ExecReport }) {
  const [hovered, setHovered] = useState(false)
  const isLive = report.live
  const color = isLive ? GREEN : ACCENT

  const card = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        backgroundImage: GRID_BG,
        backgroundSize: '22px 22px',
        borderTop: `1px solid ${hovered ? `${color}44` : 'var(--border)'}`,
        borderRight: `1px solid ${hovered ? `${color}44` : 'var(--border)'}`,
        borderBottom: `1px solid ${hovered ? `${color}44` : 'var(--border)'}`,
        borderLeft: `6px solid ${color}`,
        borderRadius: 14,
        padding: '18px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: isLive ? 'pointer' : 'default',
        transition: 'border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease',
        boxShadow: hovered ? `0 14px 30px -10px ${color}55, 0 0 0 1px ${color}22` : '0 1px 3px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.5px',
            flexShrink: 0,
            boxShadow: `0 2px 8px ${color}55`,
          }}
        >
          {report.name.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.2px', flex: 1, minWidth: 0 }}>
          {report.name}
        </span>
        {isLive && <StatusBadge color={GREEN} label="Live" glow />}
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', margin: 0, marginBottom: 16 }}>
        {report.description}
      </p>

      <div style={{ marginTop: 'auto' }}>
        {isLive ? (
          <span
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.3px',
              padding: '11px 14px',
              borderRadius: 10,
              color: '#fff',
              background: GREEN,
              boxShadow: hovered ? `0 8px 22px ${GREEN}66` : `0 2px 10px ${GREEN}33`,
              transition: 'box-shadow 200ms ease',
            }}
          >
            {report.cta ?? 'Open →'}
          </span>
        ) : (
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
        )}
      </div>
    </div>
  )

  if (isLive && report.href) {
    return (
      <Link href={report.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        {card}
      </Link>
    )
  }
  return card
}

function ConnectRow({ name, connected }: { name: string; connected: boolean }) {
  const color = connected ? GREEN : RED
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '12px 15px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
        {name}
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {connected ? 'Connected' : 'Not Connected'}
        </span>
      </span>
      {!connected && (
        <button
          disabled
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 9,
            background: `${ACCENT}14`,
            border: `1px solid ${ACCENT}33`,
            color: ACCENT,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'not-allowed',
          }}
        >
          Connect
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              padding: '2px 5px',
              borderRadius: 4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text3)',
            }}
          >
            Coming Soon
          </span>
        </button>
      )}
    </div>
  )
}

// ── Floating Executive AI button + chat drawer ───────────────────────
// Slightly more prominent than the department buttons — gold (Calin's page).

function FloatingExecutiveAI() {
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
          pageContext: '/command-center/executive',
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
        @keyframes execSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — gold, more prominent (Executive) */}
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
          gap: 9,
          padding: '14px 22px',
          borderRadius: 999,
          background: ACCENT,
          color: '#1a1917',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? `0 14px 34px -6px ${ACCENT}aa, 0 0 0 1px ${ACCENT}55`
            : `0 8px 22px -4px ${ACCENT}88`,
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>💬</span>
        Executive AI
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
            boxShadow: `0 24px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px ${ACCENT}22`,
            animation: 'execSlideUp 220ms ease',
          }}
        >
          {/* Dark header with gold accent */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: 'var(--charcoal)',
              borderTop: `2px solid ${ACCENT}`,
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
                  color: ACCENT,
                }}
              >
                Executive AI
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
                  {m.role === 'user' ? 'You' : 'Executive AI'}
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
                  Executive AI
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
                placeholder="Ask about company performance, departments..."
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
                  color: input.trim() && !thinking ? '#1a1917' : D.text3,
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

export default function ExecutiveDepartmentPage() {
  return (
    <>
      <style>{`
        @keyframes caskPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          50% { box-shadow: 0 0 0 5px rgba(16,185,129,0); }
        }
      `}</style>

      <TopBar title="Executive Command Center" subtitle="Executive Team · Weekly">
        <StatusBadge color={ACCENT} label="In Progress" />
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
                  Executive Command Center
                </h1>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginTop: 7 }}>
                  Executive Team · Weekly
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <StatusBadge color={ACCENT} label="In Progress" />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Data Source: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>All Departments</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 32,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}
          className="md:!grid-cols-4"
        >
          {STATS.map((s, i) => (
            <StatSegment key={s.label} value={s.value} label={s.label} index={i} badge={s.badge} />
          ))}
        </div>

        {/* Department connections */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Department Connections" subtitle="Connect all departments to unlock the full Executive view" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {DEPARTMENT_STATUS.map((d) => (
              <ConnectionPill key={d.name} name={d.name} connected={d.connected} />
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Reports" subtitle="11 reports · 1 live, 10 unlock as departments connect" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {REPORTS.map((r) => (
              <ReportCard key={r.name} report={r} />
            ))}
          </div>
        </div>

        {/* Connect section */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 16,
            padding: '28px 30px',
            background: `linear-gradient(135deg, ${ACCENT}16, ${ACCENT}06)`,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>
            Unlock the Full Executive View
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
            Connect all 5 departments to power the Executive Command Center
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {DEPARTMENT_STATUS.map((d) => (
              <ConnectRow key={d.name} name={d.name} connected={d.connected} />
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Each department you connect adds more intelligence to the Executive Command Center
          </div>
        </div>
      </div>

      {/* Floating Executive AI button + chat drawer — bottom-right, this page only */}
      <FloatingExecutiveAI />
    </>
  )
}
