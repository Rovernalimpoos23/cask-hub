// v3
'use client'
// src/app/(app)/dashboard/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  TopBar,
  PillGreen,
  PillRed,
  StatCard,
  MeetingCard,
  ActionItemRow,
  SectionLabel,
} from '@/components/ui'
import { fetchAllMeetings } from '@/lib/meetings-client'
import { createClient } from '@/lib/supabase'
import type { Meeting, ActionItem } from '@/types'

function getCurrentMonthYear(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' })
}

function IconSessions() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="11" width="3.5" height="5" rx="1" fill="currentColor"/>
      <rect x="7.25" y="7" width="3.5" height="9" rx="1" fill="currentColor"/>
      <rect x="12.5" y="3" width="3.5" height="13" rx="1" fill="currentColor"/>
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="6" y1="2" x2="6" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="6" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="6" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="6" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="3" cy="5" r="1.2" fill="currentColor"/>
      <circle cx="3" cy="9" r="1.2" fill="currentColor"/>
      <circle cx="3" cy="13" r="1.2" fill="currentColor"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface TodayEvent {
  id: string
  title: string
  start_time: string
  end_time: string | null
  organizer: string | null
  attendees: unknown
  meeting_link: string | null
  web_link: string | null
  is_all_day: boolean | null
}

function fmtET(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function fmtDuration(start: string, end: string | null): string | null {
  if (!end) return null
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (mins <= 0) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function getFirstNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map(a => {
    const s = typeof a === 'string' ? a : String((a as Record<string, unknown>)?.name ?? (a as Record<string, unknown>)?.displayName ?? '')
    return s.split(' ')[0]
  }).filter(Boolean).slice(0, 2)
}

// ── Floating Dashboard AI — palette + chat config ────────────────────
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
  "Dashboard AI online. I have context on your day — today's meetings, upcoming events, and open action items. Ask about your day, meetings, or actions."

const AI_QUICK_PROMPTS = ["What's on today?", 'My open actions', 'Next meeting']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Dashboard AI button + chat drawer ───────────────────────

function FloatingDashboardAI() {
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
          pageContext: '/dashboard',
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
        @keyframes dashboardSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Dashboard */}
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
        Dashboard AI
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
            animation: 'dashboardSlideUp 220ms ease',
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
                Dashboard AI
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
                  {m.role === 'user' ? 'You' : 'Dashboard AI'}
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
                  Dashboard AI
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
                placeholder="Ask about your day, meetings, actions..."
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

export default function DashboardPage() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [greeting, setGreeting] = useState('Good morning')
  const [calendarEvents, setCalendarEvents] = useState<TodayEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null)
  const [nextEventHint, setNextEventHint] = useState<string>('Loading…')
  const [clockStr, setClockStr] = useState('')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [actionItemsLoading, setActionItemsLoading] = useState(true)
  const [bottomActionItems, setBottomActionItems] = useState<ActionItem[]>([])
  const [bottomLoading, setBottomLoading] = useState(true)

  useEffect(() => {
    const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours()
    if (hour >= 5 && hour < 12) setGreeting('Good morning')
    else if (hour >= 12 && hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    function tick() {
      const now = new Date()
      const date = now.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
      const time = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
      setClockStr(`${date} · ${time} ET`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const loadMeetings = useCallback(() => {
    fetchAllMeetings().then(data => {
      setMeetings(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadMeetings()
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('email', user.email)
        .single()
      const name = userData?.name?.split(' ')[0] || ''
      setFirstName(name)
    })
    const handler = () => { loadMeetings(); router.refresh() }
    window.addEventListener('cask-meeting-saved', handler)
    return () => window.removeEventListener('cask-meeting-saved', handler)
  }, [loadMeetings, router])

  useEffect(() => {
    const supabase = createClient()
    const now = new Date()
    const etTodayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // Compute the exact UTC bounds of today in Eastern Time.
    // ET is UTC-4 (EDT) or UTC-5 (EST). We detect the actual offset so DST is handled correctly.
    const etNowApprox = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const offsetMs = now.getTime() - etNowApprox.getTime() // positive = ET behind UTC

    const [y, mo, d] = etTodayStr.split('-').map(Number)
    const etDayStartUTC = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0)).getTime() + offsetMs
    const etDayEndUTC = etDayStartUTC + 24 * 60 * 60 * 1000

    // Today's Schedule: all events that START during ET today
    supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', new Date(etDayStartUTC).toISOString())
      .lt('start_time', new Date(etDayEndUTC).toISOString())
      .order('start_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[dashboard] calendar_events error:', error)
        setCalendarEvents((data ?? []) as TodayEvent[])
        setCalendarLoading(false)
      })

    // This-week stat card: count events from start of today through end of Sunday (ET)
    // etDayStartUTC is already computed above as the UTC ms for ET midnight today
    const etDayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay() // 0=Sun … 6=Sat
    const daysUntilSunday = etDayOfWeek === 0 ? 0 : 7 - etDayOfWeek
    const etWeekEndUTC = etDayStartUTC + (daysUntilSunday + 1) * 24 * 60 * 60 * 1000 // exclusive end = start of next Monday ET

    const fmtShort = (ms: number) => new Date(ms).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
    })
    const weekRange = `${fmtShort(etDayStartUTC)} – ${fmtShort(etWeekEndUTC - 1)}`
    setNextEventHint(weekRange)

    supabase
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .gte('start_time', new Date(etDayStartUTC).toISOString())
      .lt('start_time', new Date(etWeekEndUTC).toISOString())
      .then(({ count }) => {
        setUpcomingCount(count ?? 0)
      })

  }, [])

  const loadAllActionItems = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('action_items')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setActionItems((data ?? []) as ActionItem[])
        setActionItemsLoading(false)
      })
  }, [])

  const loadBottomActionItems = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('action_items')
      .select('*')
      .eq('done', false)
      .in('owner', ['Calin', 'Kai', 'Rovern', 'Calin Noonan', 'Kai Mapoy', 'Rovern Alimpoos'])
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setBottomActionItems((data ?? []) as ActionItem[])
        setBottomLoading(false)
      })
  }, [])

  useEffect(() => {
    loadAllActionItems()
    loadBottomActionItems()
  }, [loadAllActionItems, loadBottomActionItems])

  async function handleBottomToggle(id: string, done: boolean) {
    const supabase = createClient()
    await supabase.from('action_items').update({ done }).eq('id', id)
    loadBottomActionItems()
    loadAllActionItems()
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  function isCoreOwner(owner: string) {
    const o = owner.toLowerCase().trim()
    return (
      o === 'calin' || o.startsWith('calin ') ||
      o === 'kai' || o.startsWith('kai ') ||
      o === 'rovern' || o.startsWith('rovern ')
    )
  }
  const coreActions = actionItems.filter(a => isCoreOwner(a.owner))
  const openActions = coreActions.filter(a => !a.done)
  const completedActions = coreActions.filter(a => a.done)
  const recentMeetings = meetings.slice(0, 3)

  return (
    <>
      <TopBar title="Dashboard" subtitle="CASK Construction Command Center">
        <PillGreen>Claude AI Active</PillGreen>
        <PillRed>{loading ? '…' : `${meetings.length} Sessions`}</PillRed>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in" style={{ background: 'transparent' }}>
        {/* Page Header */}
        <div className="mb-7">
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="font-serif text-[32px] font-normal tracking-[-0.5px] leading-[1.1]"
                style={{ color: 'var(--text)' }}
              >
                {greeting}{firstName ? `, ${firstName}.` : '.'}
              </h1>
              <p className="text-[13px] mt-1.5" style={{ color: 'var(--text3)' }}>
                Here&apos;s your CASK Construction intelligence overview — {getCurrentMonthYear()}.
              </p>
            </div>
            <div className="text-[12px] font-medium shrink-0 mt-1" style={{ color: 'var(--text3)' }}>
              {clockStr}
            </div>
          </div>
          <div className="h-px mt-5" style={{ background: 'var(--border)' }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <StatCard
            value={loading ? '…' : meetings.length}
            label="Total Sessions"
            hint="All time"
            variant="default"
            index={0}
            icon={<IconSessions />}
          />
          <StatCard
            value={upcomingCount ?? '…'}
            label="Events This Week"
            hint={nextEventHint}
            variant="alert"
            index={1}
            icon={<IconCalendar />}
          />
          <StatCard
            value={actionItemsLoading ? '…' : openActions.length}
            label="Open Action Items"
            hint="Across all sessions"
            variant="default"
            index={2}
            icon={<IconList />}
          />
          <StatCard
            value={actionItemsLoading ? '…' : completedActions.length}
            label="Completed"
            hint="All time"
            variant="success"
            index={3}
            icon={<IconCheck />}
          />
        </div>

        {/* Morning Briefing */}
        <div className="mb-8">
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>

            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(to bottom, var(--surface), var(--surface2))',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Morning Briefing</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{todayLabel}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  color: 'var(--green)', background: 'var(--green-bg)',
                  border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 20,
                }}>
                  Daily Briefing
                </span>
                <a
                  href="/president/calendar"
                  style={{
                    fontSize: 12, fontWeight: 500, color: 'var(--text2)',
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border2)',
                    textDecoration: 'none', transition: 'background 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  View Calendar →
                </a>
              </div>
            </div>

            {/* Section 1 — Today's Schedule */}
            <div style={{ padding: '0 18px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 0 9px',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  Today&apos;s Schedule
                </span>
                {!calendarLoading && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'white',
                    background: '#2563eb', borderRadius: 20, padding: '1px 7px',
                  }}>
                    {calendarEvents.length}
                  </span>
                )}
              </div>
              <div style={{ paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {calendarLoading ? (
                  <>
                    <div className="shimmer" style={{ height: 46, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <div className="shimmer" style={{ height: 46, borderRadius: 8, border: '1px solid var(--border)', opacity: 0.6 }} />
                  </>
                ) : calendarEvents.length === 0 ? (
                  <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 13 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ opacity: 0.45 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    No meetings scheduled today
                  </div>
                ) : (
                  (() => {
                    const nowMs = Date.now()
                    const allDone = calendarEvents.every(ev =>
                      ev.is_all_day || (ev.end_time ? new Date(ev.end_time).getTime() < nowMs : false)
                    )
                    if (allDone) return (
                      <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                        All meetings completed for today ✓
                      </div>
                    )
                    return calendarEvents.map(ev => {
                      const startMs = new Date(ev.start_time).getTime()
                      const endMs = ev.end_time ? new Date(ev.end_time).getTime() : null
                      const isDone = !ev.is_all_day && endMs !== null && endMs < nowMs
                      const isNow = !ev.is_all_day && startMs <= nowMs && endMs !== null && endMs >= nowMs
                      const isUpcoming = !ev.is_all_day && startMs > nowMs
                      const duration = fmtDuration(ev.start_time, ev.end_time)
                      const minsUntil = isUpcoming ? Math.round((startMs - nowMs) / 60000) : 0
                      const timeUntil = minsUntil < 60
                        ? `in ${minsUntil}m`
                        : `in ${Math.floor(minsUntil / 60)}h${minsUntil % 60 ? ` ${minsUntil % 60}m` : ''}`
                      const borderLeft = isDone ? '3px solid var(--border)' : isNow ? '3px solid #10b981' : '3px solid #2563eb'
                      return (
                        <div
                          key={ev.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px 9px 10px',
                            borderRadius: 8,
                            border: `1px solid ${isNow ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                            borderLeft,
                            background: isNow ? 'rgba(16,185,129,0.04)' : 'transparent',
                            opacity: isDone ? 0.5 : 1,
                            transition: 'border-color 150ms ease',
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, minWidth: 66, flexShrink: 0, lineHeight: 1.2 }}>
                            {ev.is_all_day ? 'All Day' : fmtET(ev.start_time)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                              {ev.title}
                            </div>
                            {ev.organizer && (
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{ev.organizer}</div>
                            )}
                          </div>

                          {/* Status badge */}
                          {isDone ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)',
                              borderRadius: 20, padding: '2px 8px', flexShrink: 0,
                            }}>
                              ✓ Done
                            </span>
                          ) : isNow ? (
                            <span style={{
                              fontSize: 9, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
                              color: 'white', background: '#10b981',
                              borderRadius: 20, padding: '2px 7px', flexShrink: 0,
                            }}>
                              🔴 Live Now
                            </span>
                          ) : isUpcoming ? (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: '#2563eb', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
                              borderRadius: 20, padding: '2px 8px', flexShrink: 0,
                            }}>
                              {timeUntil}
                            </span>
                          ) : duration ? (
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: 'var(--text3)',
                              background: 'var(--surface2)', border: '1px solid var(--border)',
                              borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                            }}>
                              {duration}
                            </span>
                          ) : null}

                          {ev.web_link && (
                            <a
                              href={ev.web_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 11, fontWeight: 600, color: 'white',
                                background: '#7c3aed', padding: '4px 11px', borderRadius: 6,
                                textDecoration: 'none', flexShrink: 0,
                                transition: 'opacity 150ms ease',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.82' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                            >
                              View Event
                            </a>
                          )}
                        </div>
                      )
                    })
                  })()
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Recent Sessions */}
        <div className="mb-8">
          <div
            className="text-[11px] font-semibold tracking-[1px] uppercase flex items-center justify-between mb-3"
            style={{
              color: 'var(--text2)',
              borderLeft: '3px solid var(--red)',
              paddingLeft: '10px',
            }}
          >
            Recent Sessions
            <div className="flex items-center gap-2">
              <a
                href="/sessions"
                className="text-[12px] font-medium normal-case tracking-normal no-underline"
                style={{
                  color: 'var(--text2)',
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: '1px solid var(--border2)',
                  lineHeight: '1.4',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >
                View all
              </a>
              <button
                onClick={() => window.dispatchEvent(new Event('cask-open-add-modal'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: 'var(--red)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  letterSpacing: 'normal',
                  textTransform: 'none',
                  lineHeight: '1.4',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                + New Session
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-[10px] h-[82px] shimmer" style={{ border: '1px solid var(--border)' }} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentMeetings.map(m => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </div>
          )}
        </div>

        {/* Open Action Items */}
        <div>
          <SectionLabel action="View all →" href="/actions">
            Open Action Items — Calin, Kai &amp; Rovern
          </SectionLabel>
          {bottomLoading ? (
            <div className="flex flex-col gap-[5px]">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-[6px] h-[56px] shimmer" style={{ border: '1px solid var(--border)' }} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-[5px]">
              {bottomActionItems.map(item => (
                <ActionItemRow key={item.id} item={item} onToggle={handleBottomToggle} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Dashboard AI button + chat drawer — bottom-right, this page only */}
      <FloatingDashboardAI />
    </>
  )
}
