'use client'
// src/app/(app)/sessions/[id]/page.tsx

import Link from 'next/link'
import { MeetingTypeTag, ActionItemRow, TopBar } from '@/components/ui'
import { useState, useEffect, useRef } from 'react'
import { fetchMeetingById } from '@/lib/meetings-client'
import { createClient } from '@/lib/supabase'
import type { Meeting, ActionItem } from '@/types'
import { ArtifactContent } from '@/components/ai-panel/artifacts'
import { isRestrictedRole, meetingHasAttendee } from '@/lib/role-filter'

// Local display-only extension of ActionItem. `completed_at` is persisted into
// the meetings.action_items JSON (not a schema change — it's a JSONB column).
// Kept local because src/types is out of scope for this change.
type ActionItemX = ActionItem & { completed_at?: string }

// Small gray meta shown beneath each action item: the source meeting (title +
// date, so same-titled meetings stay distinguishable) and, once completed, the
// completion timestamp converted to Eastern Time.
function ActionItemMeta({
  item,
  meetingTitle,
  meetingDate,
}: {
  item: ActionItemX
  meetingTitle: string
  meetingDate: string
}) {
  const fromDate = meetingDate
    ? new Date(meetingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  let completed: string | null = null
  if (item.done && item.completed_at) {
    const d = new Date(item.completed_at)
    const cd = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' })
    const ct = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })
    completed = `Completed ${cd} ${ct} ET`
  }

  return (
    <div className="pl-5 pr-3.5 mt-1 flex flex-col gap-0.5 text-[10px]" style={{ color: 'var(--text3)' }}>
      <span>From: {meetingTitle}{fromDate ? ` · ${fromDate}` : ''}</span>
      {completed && <span>{completed}</span>}
    </div>
  )
}

// ── Floating Sessions AI — palette + chat config ─────────────────────
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
  "Sessions AI online. I have context on this meeting — its recap, key decisions, action items, and transcript. Ask me anything about what was discussed or decided."

const QUICK_PROMPTS = ['Summarize this meeting', 'List action items', 'Key decisions']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Sessions AI button + chat drawer ────────────────────────

function FloatingSessionsAI() {
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
        .eq('page_context', '/sessions')
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
      .insert({ user_email: userEmailRef.current, page_context: '/sessions', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/sessions')
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
          pageContext: '/sessions',
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
        @keyframes sessionsSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Session Detail */}
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
          background: 'var(--fable-red)',
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
        Sessions AI
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
            animation: 'sessionsSlideUp 220ms ease',
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
                Sessions AI
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
                  {m.role === 'user' ? 'You' : 'Sessions AI'}
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
                  <ArtifactContent content={m.content} />
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
                  Sessions AI
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
                placeholder="Ask about this meeting..."
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

function BackLink() {
  return (
    <Link
      href="/sessions"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
      style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
    >
      ← Back to Sessions
    </Link>
  )
}

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [actionItems, setActionItems] = useState<ActionItemX[]>([])
  const [actionItemsLoading, setActionItemsLoading] = useState(true)
  // Current user's first name + role, used ONLY to decide which action items are
  // visible. Admin roles (Calin/president, Kai/ea, Rovern/ai_specialist) see every
  // item exactly as before; restricted roles see only items owned by them.
  const [firstName, setFirstName] = useState('')
  const [userRole, setUserRole] = useState('')
  // Gates the action items list until the role resolves, so a restricted user
  // never flashes other people's items before filtering kicks in.
  const [roleResolved, setRoleResolved] = useState(false)

  useEffect(() => {
    fetchMeetingById(params.id).then(data => {
      setMeeting(data)
      setLoading(false)
    })
  }, [params.id])

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: publicUser } = await supabase
        .from('users')
        .select('name, role')
        .eq('email', user?.email ?? '')
        .maybeSingle()
      setFirstName(publicUser?.name?.split(' ')[0] ?? '')
      setUserRole(publicUser?.role ?? '')
      setRoleResolved(true)
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!meeting) return
    setActionItems(meeting.action_items ?? [])
    setActionItemsLoading(false)
  }, [meeting])

  async function handleToggle(index: number, done: boolean) {
    if (!meeting) return

    // Action items live in the meetings.action_items JSON column — not the
    // separate action_items table. Fireflies-webhook items have no id field,
    // so finding by id silently fails. Identify the clicked item by its
    // position in the array instead, then match by task + owner.
    const clicked = actionItems[index]
    if (!clicked) return
    const matches = (a: ActionItem) => a.task === clicked.task && a.owner === clicked.owner

    // Stamp the completion time when checking; clear it when unchecking.
    const completedAt = done ? new Date().toISOString() : undefined

    // Optimistic UI — flip only the matched item and set/clear its completed_at.
    const updated = actionItems.map(a => {
      if (!matches(a)) return a
      const next = { ...a, done }
      if (done) next.completed_at = completedAt
      else delete next.completed_at
      return next
    })
    setActionItems(updated)

    const supabase = createClient()

    // Persist the optimistic state directly. Re-reading from Supabase here
    // would race when several items are toggled quickly — a later toggle would
    // read a stale array (before the previous write landed) and overwrite it.
    const persisted = updated

    // Write the whole updated array back to meetings.action_items.
    const { error } = await supabase
      .from('meetings')
      .update({ action_items: persisted })
      .eq('id', meeting.id)
    if (error) console.error('[session] toggle persist failed:', error)
  }

  if (loading) {
    return (
      <>
        <TopBar title="Session Detail" subtitle="Loading…" />
        <div className="flex-1 overflow-y-auto p-7">
          <div className="rounded-[10px] h-[120px] shimmer mb-3" style={{ border: '1px solid var(--border)' }} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
            <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
          </div>
        </div>
      </>
    )
  }

  if (!meeting) {
    return (
      <>
        <TopBar title="Not Found" subtitle="Session Detail" />
        <div className="flex-1 overflow-y-auto p-7">
          <BackLink />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Session not found.</p>
        </div>
      </>
    )
  }

  // ── Restricted-user attendee gate (additive) ────────────────────────────────
  // Restricted roles (vp_sales, ops_manager, vp_ops, vp_finance, member) may only
  // view a session they actually attended — their first name must appear in the
  // meeting's attendees array. We reuse the shared meetingHasAttendee helper (the
  // same case-insensitive substring match filterMeetingsForRole uses for the All
  // Sessions list), so a meeting hidden from the list is also blocked here by URL.
  // Admin/unknown roles are unaffected and continue to see every meeting. This
  // does NOT alter the action-items filtering below — that stays exactly as is.

  // Wait for the role to resolve before deciding access, so a legitimately
  // attending restricted user never flashes the denial screen, and a restricted
  // non-attendee never flashes the meeting content, before their role loads.
  if (!roleResolved) {
    return (
      <>
        <TopBar title={meeting.title} subtitle="Session Detail" />
        <div className="flex-1 overflow-y-auto p-7">
          <div className="rounded-[10px] h-[120px] shimmer mb-3" style={{ border: '1px solid var(--border)' }} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
            <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
          </div>
        </div>
      </>
    )
  }

  // Restricted users who did not attend this meeting get an access-denied view
  // instead of the meeting content (blocks direct-URL access to sessions they
  // were not part of).
  if (isRestrictedRole(userRole) && !meetingHasAttendee(meeting, firstName)) {
    return (
      <>
        <TopBar title="Access Restricted" subtitle="Session Detail" />
        <div className="flex-1 overflow-y-auto p-7">
          <BackLink />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>
            You don&apos;t have access to this meeting.
          </p>
        </div>
      </>
    )
  }

  const date = new Date(meeting.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Owner-based visibility. Restricted roles see only action items whose owner
  // matches their first name (case-insensitive, substring — same match as the
  // dashboard "My Items" view). Admin/unknown roles get the full list unchanged.
  const isRestricted = isRestrictedRole(userRole)
  const fn = firstName.trim().toLowerCase()
  const visibleActionItems = isRestricted
    ? (fn ? actionItems.filter(a => (a.owner ?? '').toLowerCase().includes(fn)) : [])
    : actionItems

  const openActions = visibleActionItems.filter(a => !a.done)

  return (
    <>
      <TopBar title={meeting.title} subtitle="Session Detail" />

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <BackLink />

        {/* Hero */}
        {/* Hero card — themed to var(--surface) so it reads correctly in both light
            and dark modes. The eyebrow, title, and pills below use theme-aware text
            colors. The h1 gets an inline color override because its color came from the
            `text-white` className, which is out of scope to edit. */}
        <div
          className="rounded-[10px] p-7 mb-3.5 relative overflow-hidden"
          style={{ background: '#111111' }}
        >
          <div
            className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          />
          <div
            className="text-[10px] font-semibold tracking-[2px] uppercase mb-2.5"
            style={{ color: 'rgba(255, 255, 255, 0.6)' }}
          >
            General Meetings · CASK Construction
          </div>
          <h1 className="font-serif text-[24px] text-white mb-3 leading-[1.2] tracking-[-0.3px]" style={{ color: '#ffffff' }}>
            {meeting.title}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <MeetingTypeTag type={meeting.meeting_type} />
            <span
              className="text-[11px] px-3 py-1 rounded-full"
              style={{ color: 'rgba(255, 255, 255, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
            >
              {formattedDate}
            </span>
            {meeting.time_start && (
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{ color: 'rgba(255, 255, 255, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
              >
                {meeting.time_start} – {meeting.time_end}
              </span>
            )}
            {meeting.attendees.length > 0 && (
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{ color: 'rgba(255, 255, 255, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
              >
                {meeting.attendees.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Summary */}
          <div className="rounded-lg p-5" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Session Summary
            </div>
            {meeting.summary.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {meeting.summary.map((point, i) => (
                  <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                    <span className="shrink-0 mt-1 text-[8px]" style={{ color: 'var(--text3)' }}>●</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No summary recorded.</p>
            )}
          </div>

          {/* Key Decisions */}
          <div className="rounded-lg p-5" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Key Decisions
            </div>
            {meeting.key_decisions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {meeting.key_decisions.map((d, i) => (
                  <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--red)' }}>✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No key decisions recorded.</p>
            )}
          </div>
        </div>

        {/* Action Items */}
        <div className="rounded-lg p-5 mb-3" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
          <div
            className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5 flex items-center justify-between"
            style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
          >
            Action Items
            <span
              className="text-[11px] font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full"
              style={{
                background: openActions.length > 0 ? 'var(--red-soft)' : 'var(--green-bg)',
                color: openActions.length > 0 ? 'var(--red)' : 'var(--green)',
                border: `1px solid ${openActions.length > 0 ? 'var(--red-border)' : 'var(--pill-green-border)'}`,
              }}
            >
              {openActions.length} open
            </span>
          </div>
          <div className="flex flex-col gap-[5px]">
            {actionItemsLoading || !roleResolved ? (
              [0, 1, 2].map(i => (
                <div key={i} className="rounded-[6px] h-[56px] shimmer" style={{ border: '1px solid var(--border)' }} />
              ))
            ) : visibleActionItems.length === 0 ? (
              // Restricted users get a personal empty state; admins keep the
              // original "nothing recorded" copy.
              <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
                {isRestricted ? 'No action items assigned to you in this meeting.' : 'No action items recorded.'}
              </p>
            ) : (
              visibleActionItems.map(item => {
                // handleToggle indexes into the full actionItems array, so pass
                // the item's ORIGINAL index (not the filtered position) — the
                // done toggle keeps writing back the correct item.
                const index = actionItems.indexOf(item)
                return (
                  // ActionItemRow passes item.id to onToggle, but webhook items
                  // have no id — inject the array index via this closure instead.
                  <div key={item.id ?? index}>
                    <ActionItemRow item={item} onToggle={(_id, done) => handleToggle(index, done)} />
                    <ActionItemMeta item={item} meetingTitle={meeting.title} meetingDate={meeting.date} />
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Transcript */}
        {meeting.full_transcript && (
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--surface2)]"
              style={{ borderBottom: transcriptExpanded ? '1px solid var(--border)' : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span className="text-[10px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--text3)' }}>
                Full Transcript
              </span>
              <span
                className="text-[11px] font-medium transition-transform duration-200"
                style={{ color: 'var(--text3)', transform: transcriptExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
              >
                ▾
              </span>
            </button>
            {transcriptExpanded && (
              <div className="p-5">
                <pre className="text-[12px] leading-[1.9] font-mono whitespace-pre-wrap" style={{ color: 'var(--text2)' }}>
                  {meeting.full_transcript}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Sessions AI button + chat drawer — bottom-right, this page only */}
      <FloatingSessionsAI />
    </>
  )
}
