'use client'
// src/app/(app)/customers/[id]/meetings/[meetingId]/page.tsx

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionItemEntry {
  task: string
  owner: string
  due_date: string | null
}

interface RecapNotes {
  summary: string[]
  key_decisions: string[]
  action_items: ActionItemEntry[]
  transcript?: string
}

interface ClientMeetingData {
  id: string
  meeting_id: string
  title: string
  date: string | null
  recap: string | null
  notes: string | null
}

// ── Action-item completion state (client_meeting_action_items) ────────────────
// Completion lives in its own table, keyed by (client_meeting_id,
// task_text_normalized), because the Fireflies webhook rewrites
// client_meetings.notes wholesale on reprocessing — anything stored inside that
// JSON blob would be destroyed. The `done` flag the webhook writes inside
// notes.action_items is NOT the source of truth and is deliberately left alone.
//
// IMPORTANT: this normalization must stay byte-identical to the copy in
// customers/[id]/page.tsx (Client Profile → Meeting Action Items). Both views
// key the same table by it, so any drift means a toggle in one view stops being
// visible in the other. Worth extracting to a shared module — see the note in
// the task write-up; kept duplicated here to stay inside the agreed file scope.
function normalizeTaskText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

// One completion row's worth of state. The display name is denormalized into
// completed_by_name at write time — mirroring agenda_audit_log's changed_by /
// changed_by_name pair — because users_select_own RLS stops a browser client from
// reading anyone else's users row after the fact. completed_by is still stored for
// referential integrity; nothing reads it for display.
interface ActionCompletion {
  completed: boolean
  completed_at: string | null
  completed_by_name: string | null
}

// Company timezone is Eastern (St. Petersburg, FL). America/New_York handles the
// EST/EDT switch; the trailing label is the literal "ET" per the agreed format.
function formatCompletedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time} ET`
}

// "✓ Jeff · Aug 10, 2026 · 3:45 PM ET". The name is read straight off the row, so
// no id → name lookup is involved. Degrades gracefully:
//  · completed_by_name null (legacy row predating the column, or the id couldn't
//    be resolved at write time) → timestamp only
//  · neither available → null, so the caller renders nothing at all
function completionLabel(c: ActionCompletion | undefined): string | null {
  if (!c || !c.completed) return null
  const when = formatCompletedAt(c.completed_at)
  const who  = c.completed_by_name?.trim() || undefined
  if (who && when) return `✓ ${who} · ${when}`
  if (who)         return `✓ ${who}`
  if (when)        return `✓ ${when}`
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingRecapPage({ params }: { params: { id: string; meetingId: string } }) {
  const [meeting, setMeeting]       = useState<ClientMeetingData | null | 'loading'>('loading')
  const [clientName, setClientName] = useState<string>('')
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  // Completion state keyed by normalized task text (one meeting per page, so the
  // client_meeting_id is implicit). Absent key = never toggled = unchecked.
  const [completions, setCompletions] = useState<Map<string, ActionCompletion>>(new Map())
  const [togglingTasks, setTogglingTasks] = useState<Set<string>>(new Set())
  // Fail-loud surface for read/write failures — never a silent console.warn.
  const [actionError, setActionError] = useState<string | null>(null)
  // The acting user's own public.users id + display name, resolved once on mount.
  // Both are stamped onto every toggle; the name is what gets displayed.
  const userIdRef = useRef<string | null>(null)
  const userNameRef = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: row }, { data: client }] = await Promise.all([
        supabase
          .from('client_meetings')
          .select('*')
          .eq('client_id', params.id)
          .eq('meeting_id', params.meetingId)
          .single(),
        supabase
          .from('clients')
          .select('name')
          .eq('id', params.id)
          .single(),
      ])

      setClientName(client?.name ?? '')
      setMeeting(row ? (row as ClientMeetingData) : null)

      if (!row) return
      const meetingRow = row as ClientMeetingData

      // completed_by must be a public.users id. supabase.auth.getUser() returns the
      // auth.users id, which is a *different* namespace (see CLAUDE.md), so resolve
      // by email — % and _ escaped so ILIKE wildcards can't match the wrong user.
      // Left null if it can't be resolved: a wrong id would fail the FK and take
      // the whole toggle down with it.
      // Also grabs `name` in the same round-trip — it gets denormalized into
      // completed_by_name on every toggle, which is what the UI displays.
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const { data: userRow } = await supabase
          .from('users')
          .select('id, name')
          .ilike('email', user.email.replace(/[%_]/g, '\\$&'))
          .maybeSingle()
        const self = userRow as { id: string; name: string | null } | null
        userIdRef.current   = self?.id ?? null
        userNameRef.current = self?.name ?? null
      }

      // Completion state for this meeting. Zero rows is the normal first-visit
      // case — every item then renders unchecked rather than erroring. The display
      // name comes down with the row, so no follow-up users query is needed.
      const { data: doneRows, error: doneErr } = await supabase
        .from('client_meeting_action_items')
        .select('task_text_normalized, completed, completed_at, completed_by_name')
        .eq('client_meeting_id', meetingRow.id)

      if (doneErr) {
        console.error('[action-items] completion load failed:', doneErr.message)
        setActionError('Could not load action-item progress — boxes may show as unchecked.')
        return
      }

      const rows = (doneRows ?? []) as {
        task_text_normalized: string
        completed: boolean
        completed_at: string | null
        completed_by_name: string | null
      }[]
      const loaded = new Map<string, ActionCompletion>()
      for (const r of rows) {
        loaded.set(r.task_text_normalized, {
          completed:         r.completed === true,
          completed_at:      r.completed_at ?? null,
          completed_by_name: r.completed_by_name ?? null,
        })
      }
      setCompletions(loaded)
    }
    load()
  }, [params.id, params.meetingId])

  // Toggle one action item. Optimistic like the transcript toggle above, but with
  // a revert + visible message if the write fails — a silent failure would leave
  // the box looking checked while nothing was saved.
  async function toggleActionItem(taskDisplay: string, next: boolean) {
    if (meeting === 'loading' || !meeting) return
    const key = normalizeTaskText(taskDisplay)
    if (togglingTasks.has(key)) return

    setTogglingTasks(prev => new Set(prev).add(key))
    setActionError(null)

    // Stamp the same values we're about to write, so the current user's own name
    // and timestamp appear immediately — the name is already in hand from the
    // mount-time self-lookup, so nothing needs resolving.
    const completedBy   = next ? userIdRef.current : null
    const completedName = next ? userNameRef.current : null
    const completedAt   = next ? new Date().toISOString() : null

    const prevValue = completions.get(key)
    setCompletions(prev => new Map(prev).set(key, {
      completed:         next,
      completed_at:      completedAt,
      completed_by_name: completedName,
    }))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('client_meeting_action_items')
        .upsert(
          {
            client_meeting_id:    meeting.id,
            task_text_normalized: key,
            task_text_display:    taskDisplay,
            completed:            next,
            completed_by:         completedBy,
            completed_by_name:    completedName,
            completed_at:         completedAt,
          },
          { onConflict: 'client_meeting_id,task_text_normalized' },
        )
      if (error) throw error
    } catch (err) {
      console.error('[action-items] toggle failed:', err)
      setCompletions(prev => {
        const m = new Map(prev)
        if (prevValue === undefined) m.delete(key)
        else m.set(key, prevValue)
        return m
      })
      setActionError('Could not save that change. Please try again.')
    } finally {
      setTogglingTasks(prev => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  if (meeting === 'loading') {
    return (
      <>
        <TopBar title="Loading…" subtitle="Customer Journey" />
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
        <TopBar title="Not Found" subtitle="Customer Journey" />
        <div className="flex-1 overflow-y-auto p-7">
          <Link
            href={`/customers/${params.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
            style={{ color: 'var(--text3)' }}
          >
            ← {clientName ? `Back to ${clientName}` : 'Back to Client'}
          </Link>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Meeting recap not found.</p>
        </div>
      </>
    )
  }

  // Parse notes JSON, fall back to recap text
  let parsed: RecapNotes | null = null
  try {
    if (meeting.notes) parsed = JSON.parse(meeting.notes) as RecapNotes
  } catch { /* ignore malformed JSON */ }

  const summary      = parsed?.summary       ?? (meeting.recap ? [meeting.recap] : [])
  const keyDecisions = parsed?.key_decisions ?? []
  const actionItems  = parsed?.action_items  ?? []
  const fullTranscript = parsed?.transcript  ?? null

  const formattedDate = meeting.date
    ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <>
      <TopBar title={meeting.title} subtitle="Customer Journey" />

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">

        {/* Back link */}
        <Link
          href={`/customers/${params.id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
          style={{ color: 'var(--text3)' }}
        >
          ← {clientName ? `Back to ${clientName}` : 'Back to Client'}
        </Link>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div
          className="rounded-[10px] p-7 mb-3.5 relative overflow-hidden"
          style={{ background: 'var(--hero-bg, var(--charcoal))' }}
        >
          <div
            className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          />

          <div
            className="text-[10px] font-semibold tracking-[2px] uppercase mb-2.5"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Customer Journey · CASK Construction
          </div>

          <h1 className="font-serif text-[24px] text-white mb-3 leading-[1.2] tracking-[-0.3px]">
            {meeting.title}
          </h1>

          <div className="flex gap-2 flex-wrap">
            {/* Meeting code badge */}
            <span
              className="text-[11px] font-mono font-bold px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {params.meetingId}
            </span>

            {/* Date */}
            {formattedDate && (
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {formattedDate}
              </span>
            )}
          </div>
        </div>

        {/* ── Summary + Key Decisions ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-3">

          {/* Summary */}
          <div className="rounded-lg p-5" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Session Summary
            </div>
            {summary.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {summary.map((point, i) => (
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
            {keyDecisions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {keyDecisions.map((d, i) => (
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

        {/* ── Action Items ──────────────────────────────────────────────── */}
        <div className="rounded-lg p-5 mb-3" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
          <div
            className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5 flex items-center justify-between"
            style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
          >
            Action Items
            <span
              className="text-[11px] font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full"
              style={{
                background: actionItems.length > 0 ? 'var(--red-soft)' : 'var(--green-bg)',
                color: actionItems.length > 0 ? 'var(--red)' : 'var(--green)',
                border: `1px solid ${actionItems.length > 0 ? 'var(--red-border)' : '#bbf7d0'}`,
              }}
            >
              {actionItems.length} item{actionItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Fail-loud surface: read or write failures say so instead of leaving a
              checkbox silently out of sync with the database. */}
          {actionError && (
            <p
              className="text-[12px] mb-2.5 px-3 py-2 rounded-[6px]"
              style={{ color: 'var(--red)', background: 'var(--red-soft)', border: '1px solid var(--red-border)' }}
              role="alert"
            >
              {actionError}
            </p>
          )}

          {actionItems.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No action items recorded.</p>
          ) : (
            <div className="flex flex-col gap-[5px]">
              {actionItems.map((item, i) => {
                const taskText = typeof item.task === 'string' ? item.task : ''
                const key      = normalizeTaskText(taskText)
                const record   = completions.get(key)
                const checked  = record?.completed ?? false
                const credit   = completionLabel(record)
                const busy     = togglingTasks.has(key)
                return (
                <div
                  key={i}
                  className="rounded-[6px] px-4 py-3 flex items-start gap-3"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
                >
                  {/* Checked-state colours reuse the same tokens as the Journey tab
                      checkboxes; the 18px round geometry is this page's existing
                      shape and is deliberately unchanged. */}
                  <button
                    type="button"
                    onClick={() => { if (!busy && taskText) toggleActionItem(taskText, !checked) }}
                    disabled={busy || !taskText}
                    aria-pressed={checked}
                    aria-label={checked ? `Mark "${taskText}" not done` : `Mark "${taskText}" done`}
                    className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: checked ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'var(--border2)',
                      background:  checked ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'var(--surface)',
                      cursor:      busy ? 'wait' : taskText ? 'pointer' : 'not-allowed',
                      padding:     0,
                      opacity:     busy ? 0.6 : 1,
                      transition:  'background 120ms ease, border-color 120ms ease',
                    }}
                  >
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-medium m-0"
                      style={{
                        color: 'var(--text)',
                        opacity: checked ? 0.5 : 1,
                        textDecoration: checked ? 'line-through' : 'none',
                      }}
                    >
                      {item.task}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                        {item.owner}
                      </span>
                      {item.due_date && (
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: 'var(--amber, #92400e)' }}
                        >
                          Due {item.due_date}
                        </span>
                      )}
                      {/* Who checked it + when, in ET. Omitted entirely when neither
                          a name nor a timestamp is available. */}
                      {credit && (
                        <span className="text-[11px]" style={{ color: 'var(--green)' }}>
                          {credit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Full Transcript (collapsible) ─────────────────────────────── */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setTranscriptExpanded(!transcriptExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--surface2)]"
            style={{
              borderBottom: transcriptExpanded ? '1px solid var(--border)' : 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span className="text-[10px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--text3)' }}>
              Full Transcript
            </span>
            <span
              className="text-[11px] font-medium transition-transform duration-200"
              style={{
                color: 'var(--text3)',
                transform: transcriptExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'inline-block',
              }}
            >
              ▾
            </span>
          </button>
          {transcriptExpanded && (
            <div className="p-5">
              {fullTranscript ? (
                <pre className="text-[12px] leading-[1.9] font-mono whitespace-pre-wrap" style={{ color: 'var(--text2)' }}>
                  {fullTranscript}
                </pre>
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No transcript available.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
