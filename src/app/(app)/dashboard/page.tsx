// v4 — Fable redesign
'use client'
// src/app/(app)/dashboard/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/ui'
import { fetchAllMeetings } from '@/lib/meetings-client'
import { createClient } from '@/lib/supabase'
import type { Meeting, ActionItem } from '@/types'

function getCurrentMonthYear(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' })
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

// ── Fable design tokens (additive — semantic colors only) ────────────
const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums lining-nums' }

// ── Sparkline (decorative trend hint) ────────────────────────────────
function Spark({ d, hot }: { d: string; hot?: boolean }) {
  return (
    <svg width="84" height="22" viewBox="0 0 84 22" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={hot ? 'var(--fable-red)' : 'var(--border2)'} strokeWidth="1.5" />
    </svg>
  )
}

// ── Stat cell — joined grid with hairline dividers ───────────────────
function StatBox({
  label,
  value,
  delta,
  deltaTone = 'flat',
  note,
  sparkPath,
  flag = false,
}: {
  label: string
  value: string | number
  delta: string
  deltaTone?: 'up' | 'flat' | 'bad'
  note: string
  sparkPath: string
  flag?: boolean
}) {
  const deltaColor =
    deltaTone === 'up' ? 'var(--fable-ok)' : deltaTone === 'bad' ? 'var(--fable-red)' : 'var(--text3)'
  return (
    <div style={{ background: 'var(--surface)', padding: '16px 18px 14px' }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 8, ...NUM }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 650,
            letterSpacing: '-0.5px',
            lineHeight: 1,
            color: flag ? 'var(--fable-red)' : 'var(--text)',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 550, color: deltaColor }}>{delta}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{note}</span>
        <Spark d={sparkPath} hot={flag} />
      </div>
    </div>
  )
}

// ── Floating CASK Intelligence — palette + chat config ───────────────
const AI_ACCENT = '#B5121B' // fable red (hex needed for alpha suffix tricks)

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
  "CASK Intelligence online. I have context on your day — today's meetings, upcoming events, and open action items. Ask about your day, meetings, or actions."

const AI_QUICK_PROMPTS = ["What's on today?", 'My open actions', 'Next meeting']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating CASK Intelligence button + chat drawer ──────────────────

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
        @keyframes caskPulse {
          0% { box-shadow: 0 0 0 0 rgba(181,18,27,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(181,18,27,0); }
          100% { box-shadow: 0 0 0 0 rgba(181,18,27,0); }
        }
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
          gap: 9,
          padding: '12px 19px 12px 15px',
          borderRadius: 999,
          background: 'var(--charcoal)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? '0 12px 30px -6px rgba(0,0,0,0.45)'
            : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--fable-red)',
            flexShrink: 0,
            animation: 'caskPulse 2.2s ease-out infinite',
          }}
        />
        CASK Intelligence
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
                CASK Intelligence
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
                  {m.role === 'user' ? 'You' : 'CASK Intelligence'}
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
                  CASK Intelligence
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
  const [syncMins, setSyncMins] = useState(0)
  const [expandedOwners, setExpandedOwners] = useState<Record<string, boolean>>({})

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

  useEffect(() => {
    const id = setInterval(() => setSyncMins(m => m + 1), 60000)
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

  // ── Derived display values (presentation only — no new fetching) ────
  const etTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  function isOverdue(a: ActionItem): boolean {
    return !!a.due_date && a.due_date < etTodayStr
  }
  function overdueDays(a: ActionItem): number {
    return Math.max(0, Math.floor((Date.parse(etTodayStr) - Date.parse(a.due_date)) / 86400000))
  }
  function fmtDue(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const overdueActions = openActions.filter(isOverdue)
  const oldestOverdue = overdueActions.reduce<ActionItem | null>(
    (oldest, a) => (!oldest || a.due_date < oldest.due_date ? a : oldest),
    null
  )
  const oldestDays = oldestOverdue ? overdueDays(oldestOverdue) : 0

  const thisMonthPrefix = etTodayStr.slice(0, 7)
  const sessionsThisMonth = meetings.filter(m => m.date?.startsWith(thisMonthPrefix)).length

  const completionRate = coreActions.length > 0
    ? Math.round((completedActions.length / coreActions.length) * 100)
    : 0

  const nowMs = Date.now()
  const nextEventToday = calendarEvents.find(
    ev => !ev.is_all_day && new Date(ev.start_time).getTime() > nowMs
  )
  const allEventsDone =
    calendarEvents.length > 0 &&
    calendarEvents.every(ev => ev.is_all_day || (ev.end_time ? new Date(ev.end_time).getTime() < nowMs : false))

  // Owner groups for the action items column — overdue-heavy owners first
  const ownerGroups = (() => {
    const map = new Map<string, ActionItem[]>()
    for (const a of openActions) {
      const first = a.owner.trim().split(' ')[0]
      const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
      const list = map.get(name) ?? []
      list.push(a)
      map.set(name, list)
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items: [...items].sort((x, y) => {
          const xo = isOverdue(x) ? 0 : 1
          const yo = isOverdue(y) ? 0 : 1
          if (xo !== yo) return xo - yo
          return (x.due_date || '9999').localeCompare(y.due_date || '9999')
        }),
        overdue: items.filter(isOverdue).length,
      }))
      .sort((a, b) => b.overdue - a.overdue || b.items.length - a.items.length)
  })()

  const briefingLabel =
    greeting === 'Good morning' ? 'Morning Briefing'
    : greeting === 'Good afternoon' ? 'Afternoon Briefing'
    : 'Evening Briefing'

  const greetSub =
    greeting === 'Good evening'
      ? 'Here’s where CASK Construction stands tonight.'
      : `Here’s where CASK Construction stands — ${getCurrentMonthYear()}.`

  const syncText = syncMins === 0 ? 'Synced just now' : `Synced ${syncMins} min ago`

  return (
    <>
      <style>{`
        .fb-sess-item:hover { background: var(--surface2); }
        .fb-task:hover { background: var(--surface2); }
        .fb-task:last-child { border-bottom: none !important; }
        .fb-show-more:hover { color: var(--text); }
        .fb-btn:hover { border-color: var(--border2); }
        .fb-btn-primary:hover { opacity: 0.88; }
        .fb-all:hover { color: var(--text); }
        .fb-cb:hover { border-color: var(--text2) !important; }
        @media (prefers-reduced-motion: no-preference) {
          .fb-rise { animation: fbRise .35s ease both; }
          @keyframes fbRise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        }
      `}</style>

      <TopBar title="Dashboard" subtitle="CASK Construction Command Center">
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text3)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fable-ok)', flexShrink: 0 }} />
          {syncText}
        </span>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in" style={{ background: 'transparent' }}>
        {/* Greeting */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 26 }}>
          <div>
            <h1
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 30,
                letterSpacing: '-0.45px',
                lineHeight: 1.15,
                color: 'var(--text)',
              }}
            >
              {greeting}{firstName ? `, ${firstName}.` : '.'}
            </h1>
            <div style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>{greetSub}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, flexShrink: 0, ...NUM }}>
            {clockStr}
          </div>
        </div>

        {/* Stats — joined hairline grid */}
        <div
          className="fb-rise"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: 'var(--fable-line, var(--border))',
            border: '1px solid var(--fable-line, var(--border))',
            borderRadius: 'var(--fable-radius)',
            overflow: 'hidden',
            marginBottom: 26,
          }}
        >
          <StatBox
            label="Sessions"
            value={loading ? '…' : meetings.length}
            delta={loading ? '' : sessionsThisMonth > 0 ? `▲ ${sessionsThisMonth} this month` : 'None this month'}
            deltaTone={sessionsThisMonth > 0 ? 'up' : 'flat'}
            note="All time"
            sparkPath="M0 17 L12 15 L24 16 L36 12 L48 13 L60 9 L72 7 L84 4"
          />
          <StatBox
            label="Events this week"
            value={upcomingCount ?? '…'}
            delta={nextEventHint}
            deltaTone="flat"
            note={
              calendarLoading ? '…'
              : nextEventToday ? `Next: ${fmtET(nextEventToday.start_time)}`
              : allEventsDone ? 'All done today'
              : 'No more events today'
            }
            sparkPath="M0 12 L12 14 L24 10 L36 13 L48 8 L60 12 L72 10 L84 11"
          />
          <StatBox
            label="Open action items"
            value={actionItemsLoading ? '…' : openActions.length}
            delta={actionItemsLoading ? '' : overdueActions.length > 0 ? `${overdueActions.length} overdue` : 'On track'}
            deltaTone={overdueActions.length > 0 ? 'bad' : 'flat'}
            note={overdueActions.length > 0 ? `Oldest: ${oldestDays} days` : 'Nothing overdue'}
            sparkPath="M0 16 L12 14 L24 14 L36 11 L48 9 L60 9 L72 6 L84 5"
            flag={!actionItemsLoading && overdueActions.length > 0}
          />
          <StatBox
            label="Completed"
            value={actionItemsLoading ? '…' : completedActions.length}
            delta={actionItemsLoading ? '' : `▲ ${completionRate}%`}
            deltaTone={completionRate > 0 ? 'up' : 'flat'}
            note="Completion rate · all time"
            sparkPath="M0 18 L12 17 L24 15 L36 14 L48 11 L60 10 L72 7 L84 5"
          />
        </div>

        {/* Briefing — the signature element */}
        <section
          aria-label="Daily briefing"
          className="fb-rise"
          style={{
            border: '1px solid var(--fable-line, var(--border))',
            borderRadius: 'var(--fable-radius)',
            background: 'var(--surface)',
            marginBottom: 30,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid var(--fable-line-soft, var(--border))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 18, height: 2, background: 'var(--fable-red)', flexShrink: 0 }} />
              <h2
                style={{
                  fontSize: 11.5,
                  letterSpacing: '1.4px',
                  textTransform: 'uppercase',
                  fontWeight: 650,
                  color: 'var(--text)',
                }}
              >
                {briefingLabel}
              </h2>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{todayLabel}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr' }}>
            {/* Main briefing text */}
            <div style={{ padding: '18px 20px', borderRight: '1px solid var(--fable-line-soft, var(--border))' }}>
              <p
                style={{
                  fontFamily: SERIF,
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                {calendarLoading ? (
                  'Pulling today’s schedule…'
                ) : calendarEvents.length === 0 ? (
                  'Nothing on the calendar today.'
                ) : allEventsDone ? (
                  'All of today’s meetings are wrapped.'
                ) : nextEventToday ? (
                  <>
                    Next up:{' '}
                    <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                      {nextEventToday.title} at {fmtET(nextEventToday.start_time)}
                    </em>
                    .
                  </>
                ) : (
                  `${calendarEvents.length} event${calendarEvents.length === 1 ? '' : 's'} on today’s calendar.`
                )}{' '}
                {actionItemsLoading ? null : overdueActions.length > 0 ? (
                  <>
                    <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                      {overdueActions.length} action item{overdueActions.length === 1 ? ' is' : 's are'} past due
                    </em>
                    {ownerGroups[0] && ownerGroups[0].overdue > 1
                      ? `, ${ownerGroups[0].overdue} of them ${ownerGroups[0].name}’s.`
                      : '.'}
                  </>
                ) : (
                  'No action items are overdue — the board is clean.'
                )}
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <Link
                  href="/actions"
                  className="fb-btn-primary"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 550,
                    borderRadius: 7,
                    padding: '8px 13px',
                    lineHeight: 1,
                    background: 'var(--charcoal)',
                    border: '1px solid var(--charcoal)',
                    color: '#fff',
                    textDecoration: 'none',
                    transition: 'opacity 150ms ease',
                  }}
                >
                  Review overdue items
                </Link>
                <Link
                  href="/president/calendar"
                  className="fb-btn"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 550,
                    borderRadius: 7,
                    padding: '8px 13px',
                    lineHeight: 1,
                    background: 'var(--surface)',
                    border: '1px solid var(--fable-line, var(--border))',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    transition: 'border-color 150ms ease',
                  }}
                >
                  Open calendar
                </Link>
              </div>
            </div>

            {/* Today's schedule */}
            <div style={{ padding: '18px 20px' }}>
              <h3
                style={{
                  fontSize: 10,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text3)',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Today&apos;s schedule
              </h3>
              {calendarLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="shimmer" style={{ height: 18, borderRadius: 5 }} />
                  <div className="shimmer" style={{ height: 18, borderRadius: 5, opacity: 0.6 }} />
                </div>
              ) : calendarEvents.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>No meetings scheduled today.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {calendarEvents.map(ev => {
                    const startMs = new Date(ev.start_time).getTime()
                    const endMs = ev.end_time ? new Date(ev.end_time).getTime() : null
                    const isDone = !ev.is_all_day && endMs !== null && endMs < nowMs
                    const isNow = !ev.is_all_day && startMs <= nowMs && endMs !== null && endMs >= nowMs
                    const title = ev.web_link ? (
                      <a
                        href={ev.web_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {ev.title}
                      </a>
                    ) : (
                      ev.title
                    )
                    return (
                      <li
                        key={ev.id}
                        style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0', color: 'var(--text2)' }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text)',
                            width: 62,
                            flexShrink: 0,
                            ...NUM,
                          }}
                        >
                          {ev.is_all_day ? 'All day' : fmtET(ev.start_time)}
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            ...(isDone
                              ? {
                                  color: 'var(--text3)',
                                  textDecoration: 'line-through',
                                  textDecorationColor: 'var(--border2)',
                                }
                              : {}),
                          }}
                        >
                          {title}
                        </span>
                        {isDone && <span style={{ color: 'var(--fable-ok)', fontWeight: 600, flexShrink: 0 }}>✓</span>}
                        {isNow && (
                          <span
                            style={{
                              color: 'var(--fable-ok)',
                              fontWeight: 650,
                              fontSize: 10.5,
                              flexShrink: 0,
                              alignSelf: 'center',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            ● Now
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Work area — sessions left, actions right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 26, alignItems: 'start' }}>
          {/* Recent sessions */}
          <section aria-label="Recent sessions">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 11.5, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 650, color: 'var(--text)' }}>
                Recent Sessions
              </h2>
              <Link
                href="/sessions"
                className="fb-all"
                style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms ease' }}
              >
                View all →
              </Link>
            </div>
            <div
              className="fb-rise"
              style={{
                border: '1px solid var(--fable-line, var(--border))',
                borderRadius: 'var(--fable-radius)',
                background: 'var(--surface)',
                overflow: 'hidden',
              }}
            >
              {loading ? (
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="shimmer" style={{ height: 54, borderRadius: 8 }} />
                  ))}
                </div>
              ) : (
                recentMeetings.map((m, i) => {
                  const date = new Date(m.date + 'T00:00:00')
                  const recapReady = (m.summary?.length ?? 0) > 0
                  const shown = m.attendees.slice(0, 4)
                  const extra = m.attendees.length - shown.length
                  return (
                    <Link
                      key={m.id}
                      href={`/sessions/${m.id}`}
                      className="fb-sess-item"
                      style={{
                        display: 'flex',
                        gap: 14,
                        padding: '14px 16px',
                        borderBottom:
                          i < recentMeetings.length - 1 ? '1px solid var(--fable-line-soft, var(--border))' : 'none',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'background 150ms ease',
                      }}
                    >
                      <div style={{ width: 40, flexShrink: 0, textAlign: 'center', paddingTop: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 650, lineHeight: 1, color: 'var(--text)', ...NUM }}>
                          {date.getDate()}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            color: 'var(--text3)',
                            marginTop: 3,
                          }}
                        >
                          {date.toLocaleString('en-US', { month: 'short' })}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text)', letterSpacing: '-0.1px' }}>
                          {m.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text3)',
                            marginTop: 3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {shown.join(', ')}
                          {extra > 0 ? ` +${extra}` : ''}
                        </div>
                      </div>
                      <div
                        style={{
                          marginLeft: 'auto',
                          flexShrink: 0,
                          alignSelf: 'center',
                          fontSize: 11,
                          fontWeight: 550,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: recapReady ? 'var(--fable-ok)' : 'var(--fable-warn)',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: recapReady ? 'var(--fable-ok)' : 'var(--fable-warn)',
                          }}
                        />
                        {recapReady ? 'Recap ready' : 'Awaiting recap'}
                      </div>
                    </Link>
                  )
                })
              )}
              <button
                onClick={() => window.dispatchEvent(new Event('cask-open-add-modal'))}
                className="fb-show-more"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                  padding: 11,
                  fontSize: 12.5,
                  fontWeight: 550,
                  color: 'var(--text2)',
                  background: 'var(--surface2)',
                  border: 'none',
                  borderTop: '1px solid var(--fable-line-soft, var(--border))',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'color 150ms ease',
                }}
              >
                + New session
              </button>
            </div>
          </section>

          {/* Open action items */}
          <section aria-label="Open action items">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 11.5, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 650, color: 'var(--text)' }}>
                Open Action Items
              </h2>
              <Link
                href="/actions"
                className="fb-all"
                style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms ease' }}
              >
                View all {actionItemsLoading ? '' : openActions.length} →
              </Link>
            </div>

            {/* Overdue alert strip */}
            {!actionItemsLoading && overdueActions.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  marginBottom: 12,
                  background: 'var(--fable-red-soft)',
                  border: '1px solid #F2D4D6',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: '#7E1018',
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
                <span>
                  <b style={{ fontWeight: 650 }}>
                    {overdueActions.length} item{overdueActions.length === 1 ? '' : 's'} overdue
                  </b>
                  {oldestOverdue ? ` — oldest open since ${fmtDue(oldestOverdue.due_date)}` : ''}
                </span>
              </div>
            )}

            {bottomLoading && actionItemsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="shimmer" style={{ height: 54, borderRadius: 8, border: '1px solid var(--border)' }} />
                ))}
              </div>
            ) : ownerGroups.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 0' }}>
                No open action items. 🎉
              </div>
            ) : (
              ownerGroups.map(group => {
                const expanded = !!expandedOwners[group.name]
                const visible = expanded ? group.items : group.items.slice(0, 3)
                const hidden = group.items.length - visible.length
                return (
                  <div
                    key={group.name}
                    className="fb-rise"
                    style={{
                      border: '1px solid var(--fable-line, var(--border))',
                      borderRadius: 'var(--fable-radius)',
                      background: 'var(--surface)',
                      overflow: 'hidden',
                      marginBottom: 14,
                    }}
                  >
                    {/* Owner header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '10px 14px',
                        background: 'var(--surface2)',
                        borderBottom: '1px solid var(--fable-line-soft, var(--border))',
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--charcoal)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 9.5,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {group.name.charAt(0)}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{group.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)', ...NUM }}>
                        {group.overdue > 0 && (
                          <>
                            <b style={{ color: 'var(--fable-red)', fontWeight: 650 }}>{group.overdue} overdue</b>
                            {' · '}
                          </>
                        )}
                        {group.items.length} open
                      </span>
                    </div>

                    {/* Tasks */}
                    {visible.map(item => {
                      const over = isOverdue(item)
                      return (
                        <div
                          key={item.id}
                          className="fb-task"
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 11,
                            padding: '11px 14px',
                            borderBottom: '1px solid var(--fable-line-soft, var(--border))',
                            transition: 'background 150ms ease',
                          }}
                        >
                          <button
                            className="fb-cb"
                            role="checkbox"
                            aria-checked="false"
                            title="Mark complete"
                            onClick={() => handleBottomToggle(item.id, true)}
                            style={{
                              width: 15,
                              height: 15,
                              border: '1.5px solid var(--border2)',
                              borderRadius: 4,
                              flexShrink: 0,
                              marginTop: 2,
                              cursor: 'pointer',
                              background: 'transparent',
                              padding: 0,
                              transition: 'border-color 150ms ease',
                            }}
                          />
                          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text)' }}>{item.task}</span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              flexShrink: 0,
                              fontSize: 11,
                              fontWeight: 550,
                              paddingTop: 2,
                              whiteSpace: 'nowrap',
                              color: over ? 'var(--fable-red)' : 'var(--text3)',
                              ...NUM,
                            }}
                          >
                            {item.due_date ? fmtDue(item.due_date) : 'No due date'}
                            {over && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginLeft: 6,
                                  background: 'var(--fable-red-soft)',
                                  padding: '1px 6px',
                                  borderRadius: 5,
                                  fontWeight: 600,
                                }}
                              >
                                {overdueDays(item)}d
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}

                    {/* Show more / less */}
                    {(hidden > 0 || expanded) && (
                      <button
                        className="fb-show-more"
                        onClick={() => setExpandedOwners(prev => ({ ...prev, [group.name]: !expanded }))}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'center',
                          padding: 9,
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: 'var(--text3)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'color 150ms ease',
                        }}
                      >
                        {expanded ? 'Show less' : `Show ${hidden} more from ${group.name}`}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </section>
        </div>
      </div>

      {/* Floating CASK Intelligence button + chat drawer — bottom-right, this page only */}
      <FloatingDashboardAI />
    </>
  )
}
