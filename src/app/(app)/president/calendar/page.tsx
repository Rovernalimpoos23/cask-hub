'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { TopBar, PillRed } from '@/components/ui'
import { ArtifactContent } from '@/components/ai-panel/artifacts'

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string | null
  organizer: string | null
  attendees: unknown
  location: string | null
  meeting_link: string | null
  web_link: string | null
  is_all_day: boolean | null
  is_recurring?: boolean | null
  recurring_id?: string | null
  recurring_days?: string[] | null
  recurring_indefinite?: boolean | null
  is_exception?: boolean | null
  // True when the underlying Graph event is cancelled (see isCancelledEvent).
  is_cancelled?: boolean | null
}

// ── Helpers ─────────────────────────────────────────────────────────

function toDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTimeRange(start: string, end: string | null): string {
  const s = formatTime(start)
  if (!end) return s
  return `${s} – ${formatTime(end)}`
}

function getDuration(start: string, end: string | null): string | null {
  if (!end) return null
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (mins <= 0) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getEventBorderColor(event: CalendarEvent): string {
  if (event.is_all_day) return '#059669'
  if (event.meeting_link) return '#7c3aed'
  return '#2563eb'
}

// A cancelled event is one Graph flagged isCancelled, or whose title (the Graph
// subject) is prefixed "Cancelled:" / "Canceled:" (Microsoft uses both spellings).
// Cancelled events are shown but visually de-emphasized — same treatment as the
// My Calendar page. In practice detection is title-prefix based, since the
// president-events API's $select does not include isCancelled.
function isCancelledEvent(event: CalendarEvent): boolean {
  if (event.is_cancelled === true) return true
  const s = (event.title ?? '').trimStart().toLowerCase()
  return s.startsWith('cancelled:') || s.startsWith('canceled:')
}

// Step a YYYY-MM-DD date string forward by the given recurrence frequency.
// Anchored at UTC noon to avoid DST off-by-one when reformatting.
function stepDate(dateStr: string, frequency: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  if (frequency === 'Daily') dt.setUTCDate(dt.getUTCDate() + 1)
  else if (frequency === 'Monthly') dt.setUTCMonth(dt.getUTCMonth() + 1)
  else dt.setUTCDate(dt.getUTCDate() + 7) // Weekly (default)
  return dt.toISOString().split('T')[0]
}

// Day-of-week selector model. dow matches JS getUTCDay(): 0=Sun … 6=Sat.
const WEEKDAYS: { label: string; dow: number }[] = [
  { label: 'Mon', dow: 1 },
  { label: 'Tue', dow: 2 },
  { label: 'Wed', dow: 3 },
  { label: 'Thu', dow: 4 },
  { label: 'Fri', dow: 5 },
  { label: 'Sat', dow: 6 },
  { label: 'Sun', dow: 0 },
]

// Weekday (0=Sun..6=Sat) for a YYYY-MM-DD string, anchored at UTC noon to dodge DST.
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
}

// Step a YYYY-MM-DD date string forward by exactly one day.
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().split('T')[0]
}

// Step a YYYY-MM-DD date string by n days, anchored at UTC noon to dodge DST.
function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

// Mon–Sun ET week range label ("Jul 13 – Jul 19") for a given offset from the
// current week — matches the Mon–Sun window the president-events API uses for
// weekEvents (?weekOffset=N).
function weekRangeLabel(now: Date, weekOffset: number): string {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const etWeekday = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay() // 0=Sun … 6=Sat
  const daysFromMonday = (etWeekday + 6) % 7
  const monday = addDaysStr(todayStr, -daysFromMonday + weekOffset * 7)
  const sunday = addDaysStr(monday, 6)
  const fmt = (ds: string) =>
    new Date(ds + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

// Extract HH:MM (24h, Eastern Time) from an ISO timestamp — for pre-filling <input type="time">.
function isoToETTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const h = parts.find(p => p.type === 'hour')!.value
  const m = parts.find(p => p.type === 'minute')!.value
  return `${h}:${m}`
}

// Build the list of occurrence dates for an event (single, frequency-stepped, or day-of-week based).
function buildOccurrenceDates(
  startDate: string,
  isRecurring: boolean,
  repeatUntil: string,
  frequency: string,
  days: string[],
): string[] {
  if (!isRecurring || !repeatUntil || repeatUntil < startDate) return [startDate]

  // Day-of-week mode: walk the range day by day, keep only selected weekdays.
  if (days.length > 0) {
    const wanted = new Set(WEEKDAYS.filter(w => days.includes(w.label)).map(w => w.dow))
    const out: string[] = []
    let cur = startDate
    let guard = 0
    while (cur <= repeatUntil && guard < 800) {
      if (wanted.has(weekdayOf(cur))) out.push(cur)
      cur = nextDay(cur)
      guard++
    }
    return out.length > 0 ? out : [startDate]
  }

  // Frequency mode: step Daily / Weekly / Monthly from the start date.
  const out: string[] = [startDate]
  let cur = startDate
  let guard = 0
  while (guard < 365) {
    cur = stepDate(cur, frequency)
    if (cur > repeatUntil) break
    out.push(cur)
    guard++
  }
  return out
}

function getCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `in ${hours}h ${rem}m` : `in ${hours}h`
}

function normalizeAttendees(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((a: unknown) => {
    if (typeof a === 'string') return a
    if (a && typeof a === 'object') {
      const obj = a as Record<string, unknown>
      return String(obj.name ?? obj.displayName ?? obj.email ?? '')
    }
    return ''
  }).filter(Boolean)
}

function getAttendeesDisplay(raw: unknown): { shown: string[]; extra: number } {
  const names = normalizeAttendees(raw)
  const shown = names.slice(0, 3)
  return { shown, extra: names.length - shown.length }
}

// ── Sub-components ───────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function PencilIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  )
}

function TrashIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '28px 0', gap: 8,
      color: 'var(--text3)',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span style={{ fontSize: 13 }}>No meetings scheduled</span>
    </div>
  )
}

function StatTile({
  value, label, sublabel, accent,
}: { value: number; label: string; sublabel: string; accent: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1, marginBottom: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sublabel}</div>
    </div>
  )
}

function NextMeetingTile({ event }: { event: CalendarEvent | undefined }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
      }}>
        Next Meeting
      </div>
      {event ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 5 }}>
            {getCountdown(event.start_time)}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text3)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {event.title}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>No upcoming meetings</div>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '1.2px',
        color: 'var(--text2)', textTransform: 'uppercase',
      }}>
        {title}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
    </div>
  )
}

function EventCard({ event, onGenerateAgenda, onEdit, onDelete }: { event: CalendarEvent; onGenerateAgenda: (event: CalendarEvent) => void; onEdit: (event: CalendarEvent) => void; onDelete: (event: CalendarEvent) => void }) {
  const [hovered, setHovered] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [savingLink, setSavingLink] = useState(false)
  const borderColor = getEventBorderColor(event)
  const cancelled = isCancelledEvent(event)
  // A past/finished event ended before now and is NOT cancelled (cancelled has its
  // own styling). Greys the whole card + adds a ✓ after the subject.
  const past = !cancelled && event.end_time != null && new Date(event.end_time) < new Date()
  const duration = getDuration(event.start_time, event.end_time)
  const { shown, extra } = getAttendeesDisplay(event.attendees)

  const teamsLink = event.meeting_link ?? null

  async function saveTeamsLink() {
    if (!linkInput.trim()) return
    setSavingLink(true)
    const supabase = createClient()
    await supabase
      .from('calendar_events')
      .update({ meeting_link: linkInput.trim() })
      .eq('id', event.id)
    setSavingLink(false)
    setPasteOpen(false)
    setLinkInput('')
    // Realtime subscription will reload events and refresh this card
  }

  const teamsIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        // Cancelled OR past/finished events: whole card dimmed so time / duration /
        // location stay visible but greyed. Cancelled also gets a strikethrough +
        // pill; past gets a ✓ after the subject (see below).
        opacity: cancelled || past ? 0.5 : 1,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.055)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Time row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
              {event.is_all_day ? 'All Day' : formatTimeRange(event.start_time, event.end_time)}
            </span>
            {duration && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '1px 6px',
              }}>
                {duration}
              </span>
            )}
            {event.is_recurring && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 600, color: '#7c3aed',
                background: 'var(--purple-bg)', border: '1px solid var(--purple-border)',
                borderRadius: 4, padding: '1px 6px',
              }}>
                ↻ {event.recurring_indefinite ? 'Repeats forever' : 'Recurring'}
              </span>
            )}
            <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, opacity: hovered ? 1 : 0, transition: 'opacity 150ms ease' }}>
              <button
                onClick={() => onEdit(event)}
                title="Edit event"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 6,
                  background: 'transparent', border: '1px solid transparent',
                  color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 150ms ease, color 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
              >
                <PencilIcon />
              </button>
              <button
                onClick={ev => { ev.stopPropagation(); onDelete(event) }}
                title="Delete event"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 6,
                  background: 'transparent', border: '1px solid transparent',
                  color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 150ms ease, color 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          {/* Title */}
          <div style={{
            fontSize: 14, fontWeight: 650, color: 'var(--text)',
            marginBottom: 5, lineHeight: 1.35,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span style={{ textDecoration: cancelled ? 'line-through' : 'none' }}>{event.title}</span>
            {past && (
              // Finished-event checkmark: subtle, text-xs (12px), ml-1 (4px).
              <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 4 }}>✓</span>
            )}
            {cancelled && (
              // Spec: var(--surface) bg + var(--text3) text, text-xs, rounded-full,
              // px-2 py-0.5. A hairline border keeps it legible on the surface card.
              <span style={{
                flexShrink: 0,
                background: 'var(--surface)', color: 'var(--text3)',
                border: '1px solid var(--border)',
                fontSize: 12, fontWeight: 600,
                borderRadius: 999, padding: '2px 8px',
              }}>
                Cancelled
              </span>
            )}
          </div>

          {/* Organizer + Attendees */}
          {(event.organizer || shown.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: event.location ? 4 : 0 }}>
              {event.organizer && (
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                  {event.organizer}
                </span>
              )}
              {event.organizer && shown.length > 0 && (
                <span style={{ color: 'var(--border2)', fontSize: 12 }}>·</span>
              )}
              {shown.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {shown.join(', ')}
                  {extra > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600 }}>
                      +{extra} more
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{event.location}</span>
            </div>
          )}
        </div>

        {/* Action buttons — hidden entirely for cancelled events (no Join Teams /
            Generate Agenda), matching the My Calendar page. */}
        {!cancelled && (
        <div style={{ flexShrink: 0, alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teamsLink ? (
            <a
              href={teamsLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, color: 'white',
                background: '#7c3aed',
                padding: '7px 13px', borderRadius: 7,
                textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.82' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              {teamsIcon}
              Join Teams
            </a>
          ) : (
            <button
              onClick={() => setPasteOpen(o => !o)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                padding: '7px 13px', borderRadius: 7,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                transition: 'border-color 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
            >
              {teamsIcon}
              Join Teams
            </button>
          )}

          <button
            onClick={() => onGenerateAgenda(event)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: 'var(--text2)',
              background: 'transparent', border: '1px solid var(--border2)',
              padding: '7px 13px', borderRadius: 7,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            ✦ Generate Agenda
          </button>
        </div>
        )}
      </div>

      {/* Inline paste Teams link */}
      {pasteOpen && !teamsLink && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
          <input
            type="url"
            autoFocus
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTeamsLink() }}
            placeholder="Paste Teams meeting link"
            style={{
              flex: 1, minWidth: 0, padding: '7px 11px', borderRadius: 7,
              border: '1px solid var(--border2)', background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={saveTeamsLink}
            disabled={savingLink || !linkInput.trim()}
            style={{
              fontSize: 12, fontWeight: 600, color: 'white',
              background: '#7c3aed', border: 'none',
              padding: '7px 14px', borderRadius: 7,
              cursor: (savingLink || !linkInput.trim()) ? 'not-allowed' : 'pointer',
              opacity: (savingLink || !linkInput.trim()) ? 0.5 : 1,
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            {savingLink ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setPasteOpen(false); setLinkInput('') }}
            style={{
              fontSize: 12, fontWeight: 500, color: 'var(--text3)',
              background: 'none', border: '1px solid var(--border2)',
              padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function EventRow({ event, onEdit, onDelete }: { event: CalendarEvent; onEdit: (event: CalendarEvent) => void; onDelete: (event: CalendarEvent) => void }) {
  const [hovered, setHovered] = useState(false)
  const borderColor = getEventBorderColor(event)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      <div style={{ width: 3, height: 30, borderRadius: 2, background: borderColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {new Date(event.start_time).toLocaleDateString('en-US', {
            timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
          })}
          {!event.is_all_day && ` · ${formatTimeRange(event.start_time, event.end_time)}`}
          {event.organizer && ` · ${event.organizer}`}
        </div>
      </div>
      {event.is_recurring && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: '#7c3aed',
          flexShrink: 0,
        }} title="Recurring event">
          ↻
        </span>
      )}
      {event.meeting_link && (
        <a
          href={event.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, fontWeight: 600, color: '#7c3aed',
            background: 'var(--purple-bg)', border: '1px solid var(--purple-border)',
            padding: '4px 9px', borderRadius: 5,
            textDecoration: 'none', flexShrink: 0,
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          View Event
        </a>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hovered ? 1 : 0, transition: 'opacity 150ms ease', flexShrink: 0 }}>
        <button
          onClick={() => onEdit(event)}
          title="Edit event"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 6,
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'border-color 150ms ease, color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
        >
          <PencilIcon size={12} />
        </button>
        <button
          onClick={ev => { ev.stopPropagation(); onDelete(event) }}
          title="Delete event"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 6,
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'border-color 150ms ease, color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
        >
          <TrashIcon size={12} />
        </button>
      </div>
    </div>
  )
}

// Flat, fully-clickable result row used by the search view.
function SearchResultRow({ event, onEdit }: { event: CalendarEvent; onEdit: (event: CalendarEvent) => void }) {
  const [hovered, setHovered] = useState(false)
  const borderColor = getEventBorderColor(event)

  return (
    <div
      onClick={() => onEdit(event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', cursor: 'pointer',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      <div style={{ width: 3, height: 34, borderRadius: 2, background: borderColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {new Date(event.start_time).toLocaleDateString('en-US', {
            timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
          })}
          {!event.is_all_day && ` · ${formatTimeRange(event.start_time, event.end_time)}`}
          {event.organizer && ` · ${event.organizer}`}
        </div>
      </div>
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, opacity: hovered ? 1 : 0.35, transition: 'opacity 150ms ease' }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  )
}

// ── Shimmer Skeleton ─────────────────────────────────────────────────

function Shimmer({ h, radius = 8 }: { h: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Week navigation bar (list view only) ─────────────────────────────
// Left arrow disabled at the current week (weekOffset 0 — can't go earlier);
// right arrow disabled 8 weeks out. Center shows the Mon–Sun ET range label.
function WeekNav({ weekOffset, rangeLabel, onPrev, onNext }: {
  weekOffset: number
  rangeLabel: string
  onPrev: () => void
  onNext: () => void
}) {
  const atStart = weekOffset === 0
  const atEnd = weekOffset >= 8
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', background: 'var(--surface2)', borderRadius: 8,
      border: '0.5px solid var(--border)', marginBottom: 16,
    }}>
      <button
        onClick={onPrev}
        disabled={atStart}
        aria-label="Previous week"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--text2)', fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
          cursor: atStart ? 'not-allowed' : 'pointer',
          opacity: atStart ? 0.3 : 1,
        }}
      >
        ←
      </button>
      <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{rangeLabel}</span>
      <button
        onClick={onNext}
        disabled={atEnd}
        aria-label="Next week"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--text2)', fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
          cursor: atEnd ? 'not-allowed' : 'pointer',
          opacity: atEnd ? 0.3 : 1,
        }}
      >
        →
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

// ── Floating Calendar AI — palette + chat config ─────────────────────
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
  "Calendar AI online. I have context on Calin's schedule — meetings, recurring events, huddles, and coaching sessions. Ask about your schedule, upcoming meetings, or events."

const AI_QUICK_PROMPTS = ["What's on today?", 'This week', 'Recurring meetings']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Calendar AI button + chat drawer ────────────────────────

function FloatingCalendarAI() {
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
        .eq('page_context', '/president/calendar')
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
      .insert({ user_email: userEmailRef.current, page_context: '/president/calendar', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/president/calendar')
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
          pageContext: '/president/calendar',
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
        @keyframes calendarSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on President's Calendar */}
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
        Calendar AI
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
            animation: 'calendarSlideUp 220ms ease',
          }}
        >
          {/* Header — always dark (fixed title bar), independent of theme.
              #1A1918 stays dark in both modes; var(--charcoal) would invert to a
              light colour in dark mode. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: '#1A1918',
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
                  color: '#ECEBE8',
                }}
              >
                Calendar AI
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
                  {m.role === 'user' ? 'You' : 'Calendar AI'}
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
                    color: AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  Calendar AI
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
                placeholder="Ask about schedule, meetings, events..."
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

interface Attendee {
  name: string
  email: string
}

// CASK team roster for the Add Event attendee picker.
const CASK_TEAM: Attendee[] = [
  { name: 'Calin Noonan', email: 'c.noonan@caskconstruction.com' },
  { name: 'Kai Mapoy', email: 'k.mapoy@caskconstruction.com' },
  { name: 'Chad Holman', email: 'c.holman@caskconstruction.com' },
  { name: 'Hazel Mae', email: 'h.mae@caskconstruction.com' },
  { name: 'Kaitlyn Grunenberg', email: 'k.grunenberg@caskconstruction.com' },
  { name: 'Bryan Turnquist', email: 'b.turnquist@caskconstruction.com' },
  { name: 'Cooper Hermansen', email: 'c.hermansen@caskconstruction.com' },
  { name: 'Daniel Berube', email: 'd.berube@caskconstruction.com' },
  { name: 'Doug Mertens', email: 'd.mertens@caskconstruction.com' },
  { name: 'Eric Bressler', email: 'e.bressler@caskconstruction.com' },
  { name: 'Jasmen Pangandaman', email: 'j.pangandaman@caskconstruction.com' },
  { name: 'Jasmin Salangsang', email: 'j.salangsang@caskconstruction.com' },
  { name: 'Jeff Azcona', email: 'j.azcona@caskconstruction.com' },
  { name: 'Jessica Zientarski', email: 'j.zientarski@caskconstruction.com' },
  { name: 'Joseph Estelloso', email: 'j.estelloso@caskconstruction.com' },
  { name: 'Kelly Cuffel', email: 'k.cuffel@caskconstruction.com' },
  { name: 'Kevin Balmaceda', email: 'k.balmaceda@caskconstruction.com' },
  { name: 'Lamont Gilyot', email: 'l.gilyot@caskconstruction.com' },
  { name: 'Leonilo Abbu Jr.', email: 'l.abbu@caskconstruction.com' },
  { name: 'Mark Curry', email: 'm.curry@caskconstruction.com' },
  { name: 'Matteo Carpani', email: 'm.carpani@caskconstruction.com' },
  { name: 'Peter Deutelmoser', email: 'p.deutelmoser@caskconstruction.com' },
  { name: 'Precious Mae', email: 'p.mae@caskconstruction.com' },
  { name: 'Rovern Alimpoos', email: 'r.alimpoos@caskconstruction.com' },
  { name: 'Scott Pfaff', email: 's.pfaff@caskconstruction.com' },
  { name: 'Shannon Halvorsen', email: 's.halvorsen@caskconstruction.com' },
  { name: 'Tim Ritschel', email: 't.ritschel@caskconstruction.com' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AddEventFormData {
  title: string
  date: string
  startTime: string
  endTime: string
  organizer: string
  location: string
  teamsLink: string
  isAllDay: boolean
  isRecurring: boolean
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Custom'
  repeatUntilMode: 'date' | 'indefinitely'
  repeatUntil: string
  recurringDays: string[]
}

const EMPTY_ADD_EVENT_FORM: AddEventFormData = {
  title: '', date: '', startTime: '', endTime: '',
  organizer: '', location: '', teamsLink: '', isAllDay: false,
  isRecurring: false, frequency: 'Weekly',
  repeatUntilMode: 'date', repeatUntil: '', recurringDays: [],
}

// Add Event modal — owns its own local form state so typing only re-renders this
// modal, not the whole calendar page. It just collects form data; the parent does
// the actual save (webhook + Supabase) via onSave(formData).
function AddEventModal({ isOpen, onClose, onSave, saving, initialDate }: {
  isOpen: boolean
  onClose: () => void
  onSave: (formData: AddEventFormData, attendees: Attendee[]) => void
  saving: boolean
  initialDate?: string
}) {
  const [form, setForm] = useState<AddEventFormData>(EMPTY_ADD_EVENT_FORM)
  const [addTimeError, setAddTimeError] = useState('')

  // Attendees live in their OWN local state — kept separate from the main form so
  // adding/removing pills never touches the form payload until Save.
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [teamQuery, setTeamQuery] = useState('')
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [attendeeError, setAttendeeError] = useState('')
  const attendeeBoxRef = useRef<HTMLDivElement>(null)

  // Reset local form whenever the modal closes, so the next open starts clean.
  useEffect(() => {
    if (!isOpen) {
      setForm(EMPTY_ADD_EVENT_FORM)
      setAddTimeError('')
      setAttendees([])
      setTeamQuery('')
      setTeamDropdownOpen(false)
      setEmailMode(false)
      setEmailInput('')
      setAttendeeError('')
    }
  }, [isOpen])

  // Pre-fill the date when the modal is opened from a calendar day cell.
  useEffect(() => {
    if (isOpen && initialDate) setForm(f => ({ ...f, date: initialDate }))
  }, [isOpen, initialDate])

  // Close the attendee dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!teamDropdownOpen) return
    function onDocClick(e: MouseEvent) {
      if (attendeeBoxRef.current && !attendeeBoxRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false)
        setEmailMode(false)
        setEmailInput('')
        setTeamQuery('')
        setAttendeeError('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [teamDropdownOpen])

  // Roster sorted alphabetically once; cheap filter happens per keystroke.
  const sortedTeam = useMemo(
    () => [...CASK_TEAM].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
  const filteredTeam = useMemo(() => {
    const q = teamQuery.trim().toLowerCase()
    if (!q) return sortedTeam
    return sortedTeam.filter(m => m.name.toLowerCase().includes(q))
  }, [sortedTeam, teamQuery])

  function isSelected(email: string) {
    return attendees.some(a => a.email.toLowerCase() === email.toLowerCase())
  }

  function addAttendee(att: Attendee): boolean {
    if (attendees.length >= 10) { setAttendeeError('Maximum of 10 attendees'); return false }
    if (isSelected(att.email)) { setAttendeeError('Attendee already added'); return false }
    setAttendees(list => [...list, att])
    setAttendeeError('')
    return true
  }

  function closeDropdown() {
    setTeamDropdownOpen(false)
    setEmailMode(false)
    setEmailInput('')
    setTeamQuery('')
  }

  function addTeamMember(member: Attendee) {
    if (isSelected(member.email)) return
    if (addAttendee(member)) closeDropdown()
  }

  function addExternalEmail() {
    const email = emailInput.trim()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setAttendeeError('Enter a valid email address'); return }
    if (addAttendee({ name: email, email })) closeDropdown()
  }

  function removeAttendee(email: string) {
    setAttendees(list => list.filter(a => a.email !== email))
    setAttendeeError('')
  }

  if (!isOpen) return null

  function handleSaveClick() {
    if (!form.title || !form.date || (!form.isAllDay && !form.startTime)) return
    if (!form.isAllDay && form.startTime && form.endTime && form.endTime <= form.startTime) {
      setAddTimeError('End time must be after start time')
      return
    }
    setAddTimeError('')
    onSave(form, attendees)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          width: 768,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'modalFadeIn 180ms ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Add Calendar Event</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Manually add an event to the calendar</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Form — row-based layout so everything fits without scrolling */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ROW 1 — All Day toggle (full width) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>All Day Event</label>
            <button
              onClick={() => setForm(f => ({ ...f, isAllDay: !f.isAllDay }))}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: form.isAllDay ? 'var(--red)' : 'var(--border2)',
                position: 'relative', transition: 'background 150ms ease',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.isAllDay ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left 150ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* ROW 2 — Title | Organizer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Title <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border2)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Organizer */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Organizer
              </label>
              <input
                type="text"
                value={form.organizer}
                onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))}
                placeholder="Calin Noonan"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border2)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* ROW 3 — Date | Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Date */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Date <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border2)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Location */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Conference room, address, etc."
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border2)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* ROW 4 — Start Time | End Time | Teams Link */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {!form.isAllDay && (
                <>
                  {/* Start Time */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Start Time <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* End Time */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      End Time
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              )}
              {/* Teams Link */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Teams Link
                </label>
                <input
                  type="url"
                  value={form.teamsLink}
                  onChange={e => setForm(f => ({ ...f, teamsLink: e.target.value }))}
                  placeholder="https://teams.microsoft.com/..."
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border2)', background: 'var(--surface2)',
                    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            {!form.isAllDay && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                Enter time in ET (Florida time)
              </div>
            )}
          </div>

          {/* ROW 5 — Attendees | Recurring */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>

          {/* Attendees */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Attendees <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>

            {/* Add Attendees dropdown */}
            <div ref={attendeeBoxRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setTeamDropdownOpen(o => !o)
                  setEmailMode(false)
                  setEmailInput('')
                  setTeamQuery('')
                  setAttendeeError('')
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 14px', borderRadius: 8,
                  background: 'transparent', border: '1px solid var(--border2)',
                  color: 'var(--text2)', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer',
                  transition: 'border-color 150ms ease, color 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                + Add Attendees
                <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
              </button>

              {teamDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
                  width: 280, maxWidth: 'calc(100% + 60px)',
                  background: 'var(--surface)', border: '1px solid var(--border2)',
                  borderRadius: 10, boxShadow: '0 10px 30px -8px rgba(0,0,0,0.32)',
                  overflow: 'hidden',
                }}>
                  {/* Search input */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="text"
                      autoFocus
                      value={teamQuery}
                      onChange={e => setTeamQuery(e.target.value)}
                      placeholder="Search team..."
                      style={{
                        width: '100%', padding: '4px 2px', border: 'none',
                        background: 'transparent', color: 'var(--text)',
                        fontSize: 13, fontFamily: 'inherit', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Team list */}
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {filteredTeam.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                        No matches
                      </div>
                    ) : filteredTeam.map(member => {
                      const selected = isSelected(member.email)
                      return (
                        <button
                          key={member.email}
                          type="button"
                          disabled={selected}
                          onClick={() => addTeamMember(member)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '8px 12px', border: 'none', background: 'transparent',
                            fontSize: 13, fontFamily: 'inherit',
                            color: selected ? 'var(--text3)' : 'var(--text)',
                            opacity: selected ? 0.45 : 1,
                            cursor: selected ? 'default' : 'pointer',
                            transition: 'background 120ms ease',
                          }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          {member.name}
                          {selected && <span style={{ marginLeft: 6, fontSize: 11 }}>· added</span>}
                        </button>
                      )
                    })}
                  </div>

                  {/* Divider + external email option */}
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {emailMode ? (
                      <div style={{ padding: '8px 10px' }}>
                        <input
                          type="email"
                          autoFocus
                          value={emailInput}
                          onChange={e => { setEmailInput(e.target.value); if (attendeeError) setAttendeeError('') }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExternalEmail() } }}
                          placeholder="email@example.com, then Enter"
                          style={{
                            width: '100%', padding: '7px 10px', borderRadius: 7,
                            border: '1px solid var(--border2)', background: 'var(--surface2)',
                            color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                            outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEmailMode(true); setAttendeeError('') }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 12px', border: 'none', background: 'transparent',
                          fontSize: 13, fontStyle: 'italic', color: 'var(--text3)',
                          fontFamily: 'inherit', cursor: 'pointer',
                          transition: 'background 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        ＋ Add external email
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {attendeeError && (
              <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 500, marginTop: 6 }}>
                {attendeeError}
              </div>
            )}

            {/* Selected attendee pills */}
            {attendees.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {attendees.map(att => (
                  <span
                    key={att.email}
                    title={att.email}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'var(--charcoal)', color: 'white',
                      fontSize: 12,
                      padding: '4px 6px 4px 10px', borderRadius: 14,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'white' }}>{att.name}</span>
                    {att.email !== att.name && (
                      <>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{att.email}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttendee(att.email)}
                      title="Remove attendee"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(255,255,255,0.16)', border: 'none',
                        color: 'white', cursor: 'pointer', padding: 0, lineHeight: 1,
                        transition: 'background 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.32)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)' }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recurring cell (Row 5, right) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Recurring toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Recurring Event</label>
            <button
              onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: form.isRecurring ? 'var(--red)' : 'var(--border2)',
                position: 'relative', transition: 'background 150ms ease',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.isRecurring ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left 150ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Recurring options */}
          {form.isRecurring && (
            <>
              {/* STEP 1 — FREQUENCY */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Frequency
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['Daily', 'Weekly', 'Monthly', 'Custom'] as const).map(freq => {
                    const active = form.frequency === freq
                    return (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          frequency: freq,
                          recurringDays: freq !== 'Custom' ? [] : f.recurringDays,
                        }))}
                        style={{
                          padding: '7px 14px', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                          background: active ? 'var(--charcoal)' : 'transparent',
                          color: active ? 'white' : 'var(--text2)',
                          border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border2)'}`,
                          transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                        }}
                      >
                        {freq === 'Custom' ? 'Custom Days' : freq}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Day picker — only when Custom Days selected */}
              {form.frequency === 'Custom' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Repeat On
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {WEEKDAYS.map(w => {
                      const active = form.recurringDays.includes(w.label)
                      return (
                        <button
                          key={w.label}
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            recurringDays: active
                              ? f.recurringDays.filter(d => d !== w.label)
                              : [...f.recurringDays, w.label],
                          }))}
                          style={{
                            padding: '6px 13px', borderRadius: 8,
                            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                            background: active ? 'var(--red)' : 'transparent',
                            color: active ? 'white' : 'var(--text2)',
                            border: `1px solid ${active ? 'var(--red)' : 'var(--border2)'}`,
                            transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                          }}
                        >
                          {w.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2 — REPEAT UNTIL */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Repeat Until
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(['date', 'indefinitely'] as const).map(mode => {
                    const active = form.repeatUntilMode === mode
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, repeatUntilMode: mode }))}
                        style={{
                          padding: '7px 14px', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                          background: active ? 'var(--charcoal)' : 'transparent',
                          color: active ? 'white' : 'var(--text2)',
                          border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border2)'}`,
                          transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                        }}
                      >
                        {mode === 'date' ? 'Pick a Date' : 'Indefinitely ∞'}
                      </button>
                    )
                  })}
                </div>
                {form.repeatUntilMode === 'date' ? (
                  <input
                    type="date"
                    value={form.repeatUntil}
                    onChange={e => setForm(f => ({ ...f, repeatUntil: e.target.value }))}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid var(--border2)', background: 'var(--surface2)',
                      color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <div style={{
                    padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--purple-border)', background: 'var(--surface2)',
                    fontSize: 13, fontWeight: 600, color: '#7c3aed',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    ↻ Repeats forever (generates 12 months)
                  </div>
                )}
              </div>
            </>
          )}

          {/* end Recurring cell */}
          </div>

          {/* end ROW 5 */}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          {addTimeError && (
            <span style={{ flex: 1, fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>
              {addTimeError}
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'none', border: '1px solid var(--border2)',
              color: 'var(--text2)', fontSize: 13, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={saving || !form.title || !form.date || (!form.isAllDay && !form.startTime)}
            style={{
              padding: '8px 18px', borderRadius: 8,
              background: 'var(--red)', color: 'white',
              border: 'none', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              opacity: (saving || !form.title || !form.date || (!form.isAllDay && !form.startTime)) ? 0.5 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            {saving ? 'Saving…' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Calendar Grid View ───────────────────────────────────────────────

const CASK_RED = '#c8311a'
const FRAUNCES = 'var(--font-fraunces), Georgia, "Times New Roman", serif'
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Event color by link type: Teams = purple, Outlook = blue, no link = CASK red.
function eventColor(event: CalendarEvent): string {
  const link = event.meeting_link ?? ''
  if (link.includes('teams.microsoft.com')) return '#7c3aed'
  if (link.includes('outlook.office')) return '#3B82F6'
  return CASK_RED
}

interface DayCell {
  dateStr: string
  day: number
  inMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

// Build a 6×7 month grid. Dates are anchored at UTC noon so extracting the
// Y-M-D string is DST-safe; events/today are bucketed by their Eastern-Time date.
function buildMonthGrid(year: number, month: number, events: CalendarEvent[], todayStr: string): DayCell[] {
  const firstUTC = new Date(Date.UTC(year, month, 1, 12, 0, 0))
  const startDow = firstUTC.getUTCDay() // 0=Sun … 6=Sat
  const gridStart = new Date(firstUTC)
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow)

  const byDate: Record<string, CalendarEvent[]> = {}
  for (const e of events) {
    const d = toDateStr(e.start_time)
    ;(byDate[d] ??= []).push(e)
  }

  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart)
    cur.setUTCDate(cur.getUTCDate() + i)
    const dateStr = cur.toISOString().split('T')[0]
    const evs = (byDate[dateStr] ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time))
    cells.push({
      dateStr,
      day: cur.getUTCDate(),
      inMonth: cur.getUTCMonth() === month,
      isToday: dateStr === todayStr,
      events: evs,
    })
  }
  return cells
}

function DayCellView({ cell, index, onShowDetails, onAddOnDate }: {
  cell: DayCell
  index: number
  onShowDetails: (event: CalendarEvent, anchor: DOMRect) => void
  onAddOnDate: (dateStr: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [popup, setPopup] = useState<{ top: number; left: number } | null>(null)
  const visible = cell.events.slice(0, 2)
  const extra = cell.events.length - visible.length

  return (
    <div
      onClick={() => onAddOnDate(cell.dateStr)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        minHeight: 106,
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: cell.isToday
          ? 'rgba(200,49,26,0.06)'
          : hovered ? 'var(--surface-hover)' : 'transparent',
        opacity: cell.inMonth ? 1 : 0.4,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background 150ms ease',
      }}
    >
      {/* Day number + hover add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
        <span
          style={cell.isToday ? {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999,
            background: CASK_RED, color: '#fff', fontSize: 12, fontWeight: 700,
          } : {
            fontSize: 12, fontWeight: 600, padding: '0 3px',
            color: cell.inMonth ? 'var(--text2)' : 'var(--text3)',
          }}
        >
          {cell.day}
        </span>
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onAddOnDate(cell.dateStr) }}
            title="Add event on this day"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: 'var(--surface2)', color: 'var(--text2)',
              fontFamily: 'inherit', fontSize: 14, lineHeight: 1,
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Event blocks — charcoal w/ purple dot = has Teams; CASK red = regular event */}
      {visible.map(ev => {
        // Cancelled events: dim the pill (opacity-40) and strike the subject text.
        // Past/finished events (ended before now, not cancelled): dim to opacity-40
        // as well, but no strikethrough.
        const cancelled = isCancelledEvent(ev)
        const past = !cancelled && ev.end_time != null && new Date(ev.end_time) < new Date()
        const dimmed = cancelled || past
        return (
        <button
          key={ev.id}
          onClick={e => { e.stopPropagation(); onShowDetails(ev, e.currentTarget.getBoundingClientRect()) }}
          title={ev.title}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 600, lineHeight: 1.3,
            padding: '3px 7px', borderRadius: 5,
            background: eventColor(ev),
            color: '#fff',
            opacity: dimmed ? 0.4 : 1,
            textDecoration: cancelled ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            animation: 'calEventFadeIn 240ms ease both',
            animationDelay: `${Math.min(index, 41) * 12}ms`,
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = dimmed ? '0.4' : '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = dimmed ? '0.4' : '1' }}
        >
          {ev.title}
        </button>
        )
      })}
      {extra > 0 && (
        <button
          onClick={e => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            setPopup({
              top: Math.min(r.bottom + 6, window.innerHeight - 24),
              left: Math.max(8, Math.min(r.left, window.innerWidth - 248)),
            })
          }}
          style={{
            textAlign: 'left', border: 'none', background: 'transparent',
            fontSize: 10.5, fontWeight: 700, color: 'var(--text3)',
            padding: '1px 4px', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          +{extra} more
        </button>
      )}

      {/* "+X more" popup — full day agenda, click a row to edit, click outside to close */}
      {popup && createPortal(
        <div
          onClick={() => setPopup(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10050 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: popup.top, left: popup.left,
              width: 236, maxHeight: 320, overflowY: 'auto',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 14px 36px -10px rgba(0,0,0,0.4)',
              padding: 6, fontFamily: 'inherit',
            }}
          >
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: 'var(--text3)',
              padding: '6px 8px 8px',
            }}>
              {new Date(cell.dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {cell.events.length} events
            </div>
            {cell.events.map(ev => (
              <button
                key={ev.id}
                onClick={e => { setPopup(null); onShowDetails(ev, e.currentTarget.getBoundingClientRect()) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '7px 8px', borderRadius: 6, border: 'none', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: eventColor(ev), flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', flexShrink: 0, minWidth: 56 }}>
                  {ev.is_all_day ? 'All day' : formatTime(ev.start_time)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title}
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// Build a human label for a recurring event, e.g. "Repeats every Tuesday".
const DAY_FULL: Record<string, string> = {
  mon: 'Monday', monday: 'Monday', tue: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', wednesday: 'Wednesday', thu: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday', sat: 'Saturday', saturday: 'Saturday',
  sun: 'Sunday', sunday: 'Sunday',
}
function recurrenceLabel(event: CalendarEvent): string {
  const days = (event.recurring_days ?? []) as string[]
  if (days.length > 0) {
    const names = days.map(d => DAY_FULL[d.toLowerCase()] ?? d)
    return `Repeats every ${names.join(', ')}`
  }
  return event.recurring_indefinite ? 'Repeats indefinitely' : 'Recurring event'
}

const teamsIconSvg = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

// Outlook-style event detail card. Rendered to document.body so the day cell's
// overflow + the grid's animation transform can't clip or mis-position it.
function EventDetailsPopup({ event, anchor, onClose, onEdit, onDelete }: {
  event: CalendarEvent
  anchor: DOMRect
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
  onDelete: (event: CalendarEvent) => void
}) {
  const WIDTH = 320
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const spaceBelow = vh - anchor.bottom
  const placeBelow = spaceBelow >= 300 || spaceBelow >= anchor.top
  const left = Math.max(12, Math.min(anchor.left, vw - WIDTH - 12))
  const arrowLeft = Math.max(18, Math.min(anchor.left + anchor.width / 2 - left, WIDTH - 26))

  const posStyle: React.CSSProperties = placeBelow
    ? { top: anchor.bottom + 10 }
    : { bottom: vh - anchor.top + 10 }
  const maxHeight = placeBelow ? vh - (anchor.bottom + 10) - 16 : anchor.top - 16

  const isAllDay = !!event.is_all_day
  const attendees = normalizeAttendees(event.attendees)
  const teamsLink = event.meeting_link
  const dateLabel = new Date(event.start_time).toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric',
  })
  const timeLabel = isAllDay ? 'All day' : formatTimeRange(event.start_time, event.end_time)

  const iconBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6, border: '1px solid transparent',
    background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 150ms ease, color 150ms ease',
  }
  const actionBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7,
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)',
    transition: 'border-color 150ms ease, color 150ms ease',
  }

  function DetailRow({ icon, children }: { icon: string; children: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 14, lineHeight: '20px', flexShrink: 0, width: 18, textAlign: 'center' }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.45 }}>{children}</div>
      </div>
    )
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10060 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left, width: WIDTH, ...posStyle, maxHeight,
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: `4px solid ${eventColor(event)}`,
          borderRadius: 12, boxShadow: '0 18px 48px -12px rgba(0,0,0,0.45)',
          fontFamily: 'inherit', animation: 'calPopupIn 160ms ease both',
        }}
      >
        {/* Arrow pointing at the event */}
        <div style={{
          position: 'absolute', left: arrowLeft, width: 10, height: 10,
          transform: 'rotate(45deg)', background: 'var(--surface)',
          ...(placeBelow
            ? { top: -6, borderLeft: '1px solid var(--border)', borderTop: '1px solid var(--border)' }
            : { bottom: -6, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }),
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '14px 14px 12px' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            {event.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {event.web_link && (
              <button
                onClick={() => window.open(event.web_link!, '_blank', 'noopener,noreferrer')}
                title="Open in Outlook"
                style={iconBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              title="Close"
              style={iconBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
          {/* Join Teams is hidden for cancelled events (matches the My Calendar page). */}
          {teamsLink && !isCancelledEvent(event) && (
            <a
              href={teamsLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 7,
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                background: '#7c3aed', color: '#fff', border: 'none', textDecoration: 'none',
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              {teamsIconSvg} Join Teams
            </a>
          )}
          <button
            onClick={() => { onClose(); onEdit(event) }}
            style={actionBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            Edit
          </button>
          <button
            onClick={() => { onClose(); onDelete(event) }}
            style={actionBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            Delete
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Details */}
        <div style={{ overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DetailRow icon="🕐">
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>{dateLabel} · {timeLabel}</div>
            {event.is_recurring && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 12, color: '#7c3aed' }}>
                ↻ {recurrenceLabel(event)}
              </div>
            )}
          </DetailRow>

          {event.location && (
            <DetailRow icon="📍">{event.location}</DetailRow>
          )}

          {event.organizer && (
            <DetailRow icon="👤">{event.organizer}</DetailRow>
          )}

          {attendees.length > 0 && (
            <DetailRow icon="👥">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {attendees.map((name, i) => (
                  <span key={`${name}-${i}`}>{name}</span>
                ))}
              </div>
            </DetailRow>
          )}

          {teamsLink && (
            <DetailRow icon="🔗">
              <a
                href={teamsLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: '#7c3aed', textDecoration: 'none', wordBreak: 'break-all', fontSize: 12 }}
              >
                {teamsLink}
              </a>
            </DetailRow>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CalendarGridView({ events, onEventClick, onAddOnDate, onDeleteEvent }: {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onAddOnDate: (dateStr: string) => void
  onDeleteEvent: (event: CalendarEvent) => void
}) {
  const [detail, setDetail] = useState<{ event: CalendarEvent; anchor: DOMRect } | null>(null)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const [viewYear, setViewYear] = useState(() => Number(todayStr.split('-')[0]))
  const [viewMonth, setViewMonth] = useState(() => Number(todayStr.split('-')[1]) - 1)
  const [enterFrom, setEnterFrom] = useState<'left' | 'right'>('right')
  const [animKey, setAnimKey] = useState(0)

  function shiftMonth(delta: number) {
    setEnterFrom(delta > 0 ? 'right' : 'left')
    setAnimKey(k => k + 1)
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  function goToToday() {
    setEnterFrom('right')
    setAnimKey(k => k + 1)
    setViewYear(Number(todayStr.split('-')[0]))
    setViewMonth(Number(todayStr.split('-')[1]) - 1)
  }

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, events, todayStr),
    [viewYear, viewMonth, events, todayStr],
  )

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1, 12))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const navBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 150ms ease, color 150ms ease',
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Month header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(to bottom, var(--surface), var(--surface2))',
      }}>
        <div style={{
          fontFamily: FRAUNCES, fontSize: 28, fontWeight: 600,
          color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1,
        }}>
          {monthLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => shiftMonth(-1)}
            title="Previous month"
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            Today
          </button>
          <button
            onClick={() => shiftMonth(1)}
            title="Next month"
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
      }}>
        {WEEKDAY_LABELS.map(d => (
          <div key={d} style={{
            padding: '9px 0', textAlign: 'center',
            fontSize: 10, fontWeight: 700, letterSpacing: '1.5px',
            textTransform: 'uppercase', color: 'var(--text3)',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — remounts on navigation to replay the slide animation */}
      <div
        key={animKey}
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          animation: `${enterFrom === 'right' ? 'calSlideFromRight' : 'calSlideFromLeft'} 260ms ease both`,
        }}
      >
        {cells.map((cell, i) => (
          <DayCellView
            key={cell.dateStr}
            cell={cell}
            index={i}
            onShowDetails={(event, anchor) => setDetail({ event, anchor })}
            onAddOnDate={onAddOnDate}
          />
        ))}
      </div>

      {detail && (
        <EventDetailsPopup
          event={detail.event}
          anchor={detail.anchor}
          onClose={() => setDetail(null)}
          onEdit={onEventClick}
          onDelete={onDeleteEvent}
        />
      )}
    </div>
  )
}

// ── Microsoft Graph → CalendarEvent mapping (Phase 1) ────────────────
// The President's Calendar now reads the president's Outlook calendar via
// /api/calendar/president-events (Microsoft Graph) instead of the Supabase
// calendar_events table. These helpers normalize the Graph event shape into the
// existing CalendarEvent interface the UI already renders.

interface GraphEvent {
  id: string
  subject?: string
  start?: { dateTime?: string; timeZone?: string } | null
  end?: { dateTime?: string; timeZone?: string } | null
  organizer?: { emailAddress?: { name?: string; address?: string } } | null
  attendees?: unknown
  location?: { displayName?: string } | null
  onlineMeeting?: { joinUrl?: string } | null
  webLink?: string
  isAllDay?: boolean
  isCancelled?: boolean
  recurrence?: unknown | null
}

interface MyEventsResponse {
  todayEvents?: GraphEvent[]
  weekEvents?: GraphEvent[]
  monthEvents?: GraphEvent[]
  upcomingCount?: number
  nextMeeting?: GraphEvent | null
  error?: string
}

// calendarView returns UTC datetimes (often with 7 fractional-second digits and
// no trailing Z). Trim to ms precision, treat as UTC when no offset is present,
// and return a canonical UTC ISO string the existing date helpers can parse
// (they call new Date(iso), which would otherwise misread a bare datetime as local).
function graphToISO(dt: string | null | undefined): string | null {
  if (!dt) return null
  const trimmed = dt.replace(/(\.\d{3})\d+/, '$1')
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(trimmed)
  const d = new Date(hasTz ? trimmed : `${trimmed}Z`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function dedupeGraphById(events: GraphEvent[]): GraphEvent[] {
  return Array.from(new Map(events.map(e => [e.id, e])).values())
}

function mapGraphEvent(ev: GraphEvent): CalendarEvent {
  return {
    id: ev.id,
    title: ev.subject ?? '',
    start_time: graphToISO(ev.start?.dateTime) ?? '',
    end_time: graphToISO(ev.end?.dateTime),
    organizer: ev.organizer?.emailAddress?.name ?? null,
    attendees: ev.attendees ?? null,
    location: ev.location?.displayName ?? null,
    meeting_link: ev.onlineMeeting?.joinUrl ?? null,
    web_link: ev.webLink ?? null,
    is_all_day: ev.isAllDay ?? null,
    is_recurring: ev.recurrence != null,
    is_cancelled: ev.isCancelled === true,
    recurring_id: null,         // not applicable for Graph events
    recurring_days: null,       // not applicable
    recurring_indefinite: null, // not applicable
    is_exception: null,         // not applicable
  }
}

// Connect / reconnect Outlook prompt shown when the Graph API reports the
// president's Microsoft account isn't linked ('not_connected') or the token has
// expired ('token_invalid'). Links to the same /api/auth/microsoft flow the
// My Calendar page uses.
function OutlookConnectState({ title, cta, disabled = false }: { title: string; cta: string; disabled?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '64px 0',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: 'var(--text3)', opacity: 0.4 }}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <div style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center' }}>{title}</div>
      {disabled ? (
        // TEMPORARY — enable during demo meeting
        <button
          type="button"
          disabled
          className="opacity-40 cursor-not-allowed"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 14, fontWeight: 600, color: '#fff',
            background: 'var(--red)', padding: '10px 18px', borderRadius: 8,
            border: 'none', fontFamily: 'inherit',
          }}
        >
          {cta}
        </button>
      ) : (
        <a
          href="/api/auth/microsoft"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 14, fontWeight: 600, color: '#fff',
            background: 'var(--red)', padding: '10px 18px', borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          {cta}
        </a>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  // Signed-in user's email, captured via the existing supabase.auth.getUser()
  // session pattern used elsewhere in this file.
  const [userEmail, setUserEmail] = useState('')
  // Graph connection status: null = OK, 'not_connected' / 'token_invalid' surface
  // a Connect/Reconnect Outlook prompt (see OutlookConnectState below).
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [, setTick] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addInitialDate, setAddInitialDate] = useState('')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  // Week navigation (list view). 0 = current week (already loaded by the primary
  // fetch below); >0 fetches that many Mon–Sun weeks ahead and merges the result
  // into `events`. weekLoading gates the skeleton shown while that fetch is in flight.
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekLoading, setWeekLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [agenda, setAgenda] = useState<{ title: string; content: string; loading: boolean } | null>(null)

  // Edit event state
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [editScopeAsk, setEditScopeAsk] = useState(false)
  const [editScope, setEditScope] = useState<'one' | 'future' | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Delete event state
  const [deleteEvent, setDeleteEvent] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '', date: '', startTime: '', endTime: '',
    organizer: '', location: '', teamsLink: '', isAllDay: false,
    frequency: 'Weekly' as 'Daily' | 'Weekly' | 'Monthly' | 'Custom',
    repeatUntilMode: 'date' as 'date' | 'indefinitely',
    repeatUntil: '', recurringDays: [] as string[],
  })

  // Capture the signed-in user's email (existing session pattern).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  // TEMPORARY — enable during demo meeting
  const outlookConnectDisabled = false

  // Tick every minute to refresh countdowns
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Restore + persist the last selected view (List vs Calendar)
  useEffect(() => {
    const saved = localStorage.getItem('cask-calendar-view')
    if (saved === 'calendar' || saved === 'list') setView(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem('cask-calendar-view', view)
  }, [view])

  // Phase 1: Replaced Supabase/Make.com fetch with Microsoft Graph API. Add Event
  // still uses Make.com webhook (Phase 2 will replace this).
  //
  // Fetches the president's Outlook calendar via /api/calendar/president-events
  // (Calin's stored Graph token + server-side token refresh) and maps the Graph
  // event shape onto the existing CalendarEvent interface. Auto-refreshes every 5
  // minutes. The old calendar_events Supabase read + Realtime subscription are gone.
  useEffect(() => {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    async function fetchEvents() {
      try {
        const res = await fetch(`/api/calendar/president-events?month=${month}&year=${year}`)
        const json: MyEventsResponse = await res.json()
        if (json.error) {
          // 'not_connected' / 'token_invalid' → show Connect/Reconnect Outlook.
          setConnectionError(json.error)
          setEvents([])
          setLoading(false)
          return
        }
        // Collect every event the response provides (month view is primary; merge
        // today/week if present), dedupe by id, then map Graph → CalendarEvent.
        // Past/finished events are now KEPT (previously filtered to future-only) so
        // all of today's events show; they're greyed out in the list + grid views.
        const graphEvents = dedupeGraphById([
          ...(json.monthEvents ?? []),
          ...(json.weekEvents ?? []),
          ...(json.todayEvents ?? []),
        ])
        const mapped = graphEvents
          .map(mapGraphEvent)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
        setConnectionError(null)
        setEvents(mapped)
        setLoading(false)
      } catch {
        // Network/parse failure: clear the connection error (not an auth issue)
        // and fall back to an empty calendar rather than a stuck spinner.
        setConnectionError(null)
        setEvents([])
        setLoading(false)
      }
    }

    fetchEvents()
    const id = setInterval(() => fetchEvents(), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Week navigation fetch. weekOffset 0 is the current week (already served by the
  // primary effect above), so we only fetch when navigating forward. The API
  // returns the offset Mon–Sun window as weekEvents; we map Graph → CalendarEvent
  // and merge (dedupe by id) into `events` so the offset week's cards render with
  // the same styling/stat logic. Uses the cancelled-flag cleanup pattern so a stale
  // response from a previous offset can't overwrite a newer one.
  useEffect(() => {
    if (weekOffset === 0) return
    let cancelled = false
    setWeekLoading(true)

    fetch(`/api/calendar/president-events?weekOffset=${weekOffset}`)
      .then(r => r.json())
      .then((json: MyEventsResponse) => {
        if (cancelled) return
        if (json.error) {
          setWeekLoading(false)
          return
        }
        const weekEvents = (json.weekEvents ?? []).map(mapGraphEvent)
        // Merge the offset week's events into existing data, dedupe by id, keep sorted.
        setEvents(prev => {
          const merged = new Map(prev.map(e => [e.id, e]))
          for (const e of weekEvents) merged.set(e.id, e)
          return Array.from(merged.values()).sort((a, b) => a.start_time.localeCompare(b.start_time))
        })
        setWeekLoading(false)
      })
      .catch(() => { if (!cancelled) setWeekLoading(false) })

    return () => { cancelled = true }
  }, [weekOffset])

  // Date anchors — all in Eastern Time
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1)
  const tomorrowStr = tmrw.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const dat = new Date(now); dat.setDate(dat.getDate() + 2)
  const dayAfterTomorrowStr = dat.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const wkEnd = new Date(now); wkEnd.setDate(wkEnd.getDate() + 7)
  const weekEndStr = wkEnd.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // Buckets
  const todayEvents = events.filter(e => toDateStr(e.start_time) === todayStr)
  const tomorrowEvents = events.filter(e => toDateStr(e.start_time) === tomorrowStr)
  const thisWeekEvents = events.filter(e => {
    const d = toDateStr(e.start_time)
    return d >= dayAfterTomorrowStr && d <= weekEndStr
  })
  const upcomingEvents = events.filter(e => toDateStr(e.start_time) > weekEndStr)

  // Search — filters the already-loaded events by title, organizer, location, attendees (case-insensitive)
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isSearching = trimmedQuery.length > 0
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return []
    return events.filter(e => {
      const haystack = [
        e.title ?? '',
        e.organizer ?? '',
        e.location ?? '',
        ...normalizeAttendees(e.attendees),
      ].join(' ').toLowerCase()
      return haystack.includes(trimmedQuery)
    })
  }, [events, trimmedQuery])

  // Group this week by day
  const thisWeekByDay: Record<string, CalendarEvent[]> = {}
  for (const ev of thisWeekEvents) {
    const d = toDateStr(ev.start_time)
    if (!thisWeekByDay[d]) thisWeekByDay[d] = []
    thisWeekByDay[d].push(ev)
  }

  // ── Offset-week bucket (list view week navigation) ───────────────────
  // When weekOffset > 0 the list view drops the TODAY/TOMORROW/THIS WEEK framing
  // and shows this specific Mon–Sun window, grouped by ET day. Bounds match the
  // API's Mon–Sun window (and the weekRangeLabel above).
  const etWeekdayNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()
  const curMondayStr = addDaysStr(todayStr, -((etWeekdayNow + 6) % 7))
  const offsetMondayStr = addDaysStr(curMondayStr, weekOffset * 7)
  const offsetSundayStr = addDaysStr(offsetMondayStr, 6)
  const offsetWeekEvents = events.filter(e => {
    const d = toDateStr(e.start_time)
    return d >= offsetMondayStr && d <= offsetSundayStr
  })
  const offsetWeekByDay: Record<string, CalendarEvent[]> = {}
  for (const ev of offsetWeekEvents) {
    const d = toDateStr(ev.start_time)
    if (!offsetWeekByDay[d]) offsetWeekByDay[d] = []
    offsetWeekByDay[d].push(ev)
  }

  // Stats — count events from now through end of this week's Sunday (ET)
  const etNowApprox = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const etDayOfWeek = etNowApprox.getDay() // 0=Sun … 6=Sat
  const daysUntilSunday = etDayOfWeek === 0 ? 0 : 7 - etDayOfWeek
  const etSundayDateStr = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  // weekTotal excludes cancelled events so the stat card matches the visible,
  // non-cancelled meetings for the rest of the week.
  const weekTotal = events.filter(e =>
    new Date(e.start_time) >= now && toDateStr(e.start_time) <= etSundayDateStr &&
    !isCancelledEvent(e)
  ).length
  // Next meeting skips cancelled events — the first future, non-cancelled event.
  const nextMeeting = events.find(e => new Date(e.start_time) > now && !isCancelledEvent(e))

  function etToISO(dateStr: string, timeStr: string): string {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const [h, min] = timeStr.split(':').map(Number)
    // Guess UTC at the wall-clock time, then measure how far off ET is and correct
    const guess = new Date(Date.UTC(y, mo - 1, d, h, min, 0))
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(guess)
    const etH = parseInt(parts.find(p => p.type === 'hour')!.value)
    const etMin = parseInt(parts.find(p => p.type === 'minute')!.value)
    const diffMs = ((h - etH) * 60 + (min - etMin)) * 60 * 1000
    return new Date(guess.getTime() + diffMs).toISOString()
  }

  async function handleSave(formData: AddEventFormData, attendees: Attendee[]) {
    if (!formData.title || !formData.date || (!formData.isAllDay && !formData.startTime)) return
    setSaving(true)

    // Compute start/end ISO strings (needed for webhook datetime conversion)
    const startISO = formData.isAllDay
      ? new Date(`${formData.date}T00:00:00`).toISOString()
      : etToISO(formData.date, formData.startTime)
    const endISO = formData.endTime ? etToISO(formData.date, formData.endTime) : null

    const toET = (iso: string) =>
      new Date(iso)
        .toLocaleString("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
        .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, "$3-$1-$2T$4:$5:$6")

    // STEP 1 — One recurring_id ties all generated occurrences + the Make.com event together.
    const recurringId = crypto.randomUUID()
    const isIndefinite = formData.repeatUntilMode === 'indefinitely'
    const mappedDays = (formData.recurringDays || []).map(day => {
      const map: Record<string, string> = {
        'Mon': 'monday',
        'Tue': 'tuesday',
        'Wed': 'wednesday',
        'Thu': 'thursday',
        'Fri': 'friday',
        'Sat': 'saturday',
        'Sun': 'sunday'
      }
      return map[day] || day.toLowerCase()
    })

    // STEP 2 — For recurring events, generate all occurrences via Claude first.
    if (formData.isRecurring) {
      setSaveToast({ message: 'Generating occurrences…', type: 'success' })
      await fetch('/api/generate-occurrences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          start_time: toET(startISO),
          end_time: endISO ? toET(endISO) : '',
          location: formData.location || '',
          is_recurring: formData.isRecurring,
          recurring_frequency: formData.frequency,
          recurring_days: mappedDays,
          recurring_indefinite: isIndefinite,
          recurring_until: formData.repeatUntil || null,
          recurring_id: recurringId,
          event_id: recurringId
        })
      }).catch(console.error)
    }

    // STEP 3 — Fire Make.com webhook (Outlook sync), tagged with recurring_id.
    const makeWebhookUrl = process.env.NEXT_PUBLIC_MAKE_CALENDAR_WEBHOOK_URL
    if (makeWebhookUrl) {
      if (formData.isRecurring) setSaveToast({ message: 'Syncing to Outlook…', type: 'success' })
      console.log('[Add Event] form state before webhook:', formData)
      await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          start_time: toET(startISO),
          end_time: endISO ? toET(endISO) : '',
          location: formData.location || '',
          is_recurring: formData.isRecurring || false,
          recurring_frequency: formData.frequency || null,
          recurring_days: mappedDays,
          recurring_indefinite: isIndefinite,
          recurring_until: isIndefinite ? null : (formData.repeatUntil || null),
          recurring_id: recurringId,
          attendees: attendees
        })
      }).catch(console.error)
    }

    setShowAddModal(false)
    if (!formData.isRecurring) setSaveToast({ message: 'Creating event…', type: 'success' })

    // STEP 4 — Wait for Make.com / occurrence generation to land, then refresh.
    await new Promise<void>(resolve => setTimeout(resolve, 8000))

    const supabase = createClient()
    const { data: freshData } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
    if (freshData) setEvents(freshData as CalendarEvent[])

    setSaveToast(null)
    setSaving(false)
  }

  function openEdit(event: CalendarEvent) {
    setEditForm({
      title: event.title ?? '',
      date: toDateStr(event.start_time),
      startTime: event.is_all_day ? '' : isoToETTime(event.start_time),
      endTime: event.end_time ? isoToETTime(event.end_time) : '',
      organizer: event.organizer ?? '',
      location: event.location ?? '',
      teamsLink: event.meeting_link ?? '',
      isAllDay: !!event.is_all_day,
      frequency: (event.recurring_days?.length ? 'Custom' : 'Weekly') as 'Daily' | 'Weekly' | 'Monthly' | 'Custom',
      repeatUntilMode: event.recurring_indefinite ? 'indefinitely' : 'date',
      repeatUntil: '',
      recurringDays: (event.recurring_days ?? []) as string[],
    })
    setEditEvent(event)
    if (event.is_recurring && event.recurring_id) {
      setEditScopeAsk(true)
      setEditScope(null)
    } else {
      setEditScopeAsk(false)
      setEditScope('one')
    }
  }

  // Open the Add Event modal, optionally pre-filling the date (from a calendar day cell).
  function openAdd(dateStr?: string) {
    setAddInitialDate(dateStr ?? '')
    setShowAddModal(true)
  }

  async function handleEditSave(scope: 'one' | 'future') {
    if (!editEvent || !editForm.title || !editForm.date || (!editForm.isAllDay && !editForm.startTime)) return
    setEditSaving(true)
    const supabase = createClient()

    const baseUpdate = {
      title: editForm.title,
      organizer: editForm.organizer || null,
      location: editForm.location || null,
      meeting_link: editForm.teamsLink || null,
      is_all_day: editForm.isAllDay,
    }

    // Compute start/end ISO for a given date using the edited time-of-day.
    const timesFor = (dateStr: string) => ({
      start_time: editForm.isAllDay
        ? new Date(`${dateStr}T00:00:00`).toISOString()
        : etToISO(dateStr, editForm.startTime),
      end_time: editForm.endTime ? etToISO(dateStr, editForm.endTime) : null,
    })

    let error = null
    const updatedIds: string[] = []

    if (scope === 'future' && editEvent.recurring_id) {
      // Single bulk UPDATE — one call for all future occurrences. Each row keeps its own
      // start_time/end_time; only metadata fields are overwritten.
      const todayStartISO = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
      const isEditIndefinite = editForm.repeatUntilMode === 'indefinitely'
      const futureUpdate = { ...baseUpdate, recurring_indefinite: isEditIndefinite ? true : false }
      const { data: updated, error: e } = await supabase
        .from('calendar_events')
        .update(futureUpdate)
        .eq('recurring_id', editEvent.recurring_id)
        .gte('start_time', todayStartISO)
        .select('id')
      if (e && /recurring_indefinite|column/i.test(e.message)) {
        const { data: updated2, error: e2 } = await supabase
          .from('calendar_events')
          .update(baseUpdate)
          .eq('recurring_id', editEvent.recurring_id)
          .gte('start_time', todayStartISO)
          .select('id')
        error = e2
        if (updated2?.length) updatedIds.push(...(updated2 as { id: string }[]).map(r => r.id))
      } else {
        error = e
        if (updated?.length) updatedIds.push(...(updated as { id: string }[]).map(r => r.id))
      }
    } else {
      // Just this one — mark as exception so Make.com knows it was manually overridden.
      const singleUpdate = { ...baseUpdate, ...timesFor(editForm.date), is_exception: true }
      const { data: updated, error: e } = await supabase
        .from('calendar_events')
        .update(singleUpdate)
        .eq('id', editEvent.id)
        .select('id')
      // Graceful fallback if is_exception column hasn't been migrated yet
      if (e && /is_exception|column/i.test(e.message)) {
        const { data: updated2, error: e2 } = await supabase
          .from('calendar_events')
          .update({ ...baseUpdate, ...timesFor(editForm.date) })
          .eq('id', editEvent.id)
          .select('id')
        error = e2
        if (updated2?.length) updatedIds.push(...(updated2 as { id: string }[]).map(r => r.id))
      } else {
        error = e
        if (updated?.length) updatedIds.push(...(updated as { id: string }[]).map(r => r.id))
      }
    }

    setEditSaving(false)

    if (error) {
      console.error('[edit-event] update failed:', error.message)
      setSaveToast({ message: `Failed to update: ${error.message}`, type: 'error' })
      setTimeout(() => setSaveToast(null), 5000)
      return
    }

    // .select('id') returns actually-updated rows — empty means RLS silently blocked the update
    if (updatedIds.length === 0) {
      console.error('[edit-event] update returned no rows — RLS may be blocking this operation')
      setSaveToast({ message: 'Update failed — check Supabase RLS permissions', type: 'error' })
      setTimeout(() => setSaveToast(null), 6000)
      return
    }

    // Confirmed updated — re-fetch fresh data from Supabase
    const { data: freshData } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
    if (freshData) setEvents(freshData as CalendarEvent[])

    setEditEvent(null)
    setEditScopeAsk(false)
    setEditScope(null)
    setSaveToast({
      message: updatedIds.length > 1 ? `Updated ${updatedIds.length} events successfully` : 'Event updated',
      type: 'success',
    })
    setTimeout(() => setSaveToast(null), 3500)
  }

  async function handleDelete(scope: 'one' | 'all') {
    if (!deleteEvent) return
    setDeleting(true)
    const supabase = createClient()

    let error = null
    let deletedIds: string[] = []

    if (scope === 'all' && deleteEvent.recurring_id) {
      const { data, error: e } = await supabase
        .from('calendar_events')
        .delete()
        .eq('recurring_id', deleteEvent.recurring_id)
        .select('id')
      error = e
      deletedIds = (data ?? []).map((r: { id: string }) => r.id)
    } else {
      const { data, error: e } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', deleteEvent.id)
        .select('id')
      error = e
      deletedIds = (data ?? []).map((r: { id: string }) => r.id)
    }

    setDeleting(false)

    if (error) {
      console.error('[delete-event] failed:', error.message)
      setSaveToast({ message: `Failed to delete: ${error.message}`, type: 'error' })
      setTimeout(() => setSaveToast(null), 5000)
      setDeleteEvent(null)
      return
    }

    // If no rows were actually deleted (e.g. RLS blocked it silently), bail out
    if (deletedIds.length === 0) {
      console.error('[delete-event] delete returned no rows — RLS may be blocking this operation')
      setSaveToast({ message: 'Delete failed — check Supabase RLS permissions', type: 'error' })
      setTimeout(() => setSaveToast(null), 6000)
      setDeleteEvent(null)
      return
    }

    // Supabase confirmed deletion — now update UI
    const deletedSet = new Set(deletedIds)
    setEvents(ev => ev.filter(e => !deletedSet.has(e.id)))

    setDeleteEvent(null)
    setSaveToast({ message: 'Event deleted', type: 'success' })
    setTimeout(() => setSaveToast(null), 3000)
  }

  async function handleGenerateAgenda(event: CalendarEvent) {
    const dateLabel = new Date(event.start_time).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
    })
    const timeLabel = event.is_all_day ? 'All Day' : formatTimeRange(event.start_time, event.end_time)
    setAgenda({ title: event.title, content: '', loading: true })
    try {
      const res = await fetch('/api/generate-event-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: event.title, date: dateLabel, time: timeLabel }),
      })
      const json = await res.json()
      if (res.ok && json.agenda) {
        setAgenda({ title: event.title, content: json.agenda, loading: false })
      } else {
        setAgenda({ title: event.title, content: 'Failed to generate agenda. Please try again.', loading: false })
      }
    } catch {
      setAgenda({ title: event.title, content: 'Failed to generate agenda. Please try again.', loading: false })
    }
  }

  function copyAgenda() {
    if (!agenda) return
    navigator.clipboard.writeText(agenda.content).then(() => {
      setSaveToast({ message: 'Agenda copied to clipboard', type: 'success' })
      setTimeout(() => setSaveToast(null), 2500)
    })
  }

  function printAgenda() {
    if (!agenda) return
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    w.document.write(
      `<html><head><title>${esc(agenda.title)} — Agenda</title>` +
      `<style>body{font-family:Arial,sans-serif;padding:40px;white-space:pre-wrap;line-height:1.6;font-size:14px;color:#111}h1{font-size:20px;margin:0 0 16px}</style>` +
      `</head><body><h1>${esc(agenda.title)}</h1>${esc(agenda.content)}</body></html>`
    )
    w.document.close()
    w.focus()
    w.print()
  }

  const todayLabel = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })
  const tomorrowLabel = tmrw.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <TopBar title="President's Calendar" subtitle="Microsoft 365">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text3)' }}>
          <CalendarIcon />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 2,
        }}>
          {([['list', '📋 List'], ['calendar', '📅 Calendar']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                background: view === key ? 'var(--text)' : 'transparent',
                color: view === key ? 'var(--bg)' : 'var(--text3)',
                transition: 'background 150ms ease, color 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => openAdd()}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 7,
            background: 'var(--red)', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          + Add Event
        </button>
        <PillRed>{events.length} Events</PillRed>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">

        {/* Search bar (list view only) */}
        {view === 'list' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ position: 'relative', maxWidth: 520 }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              display: 'flex', color: 'var(--text3)', pointerEvents: 'none',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 36px',
                borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 150ms ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--surface2)', border: 'none',
                  color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {/* Stat counts exclude cancelled events via isCancelledEvent. */}
          <StatTile value={todayEvents.filter(e => !isCancelledEvent(e)).length} label="Today" sublabel="meetings" accent="var(--red)" />
          <StatTile value={weekTotal} label="This Week" sublabel="total" accent="#2563eb" />
          <StatTile value={events.filter(e => new Date(e.start_time) > new Date() && !isCancelledEvent(e)).length} label="Upcoming" sublabel="on calendar" accent="#059669" />
          <NextMeetingTile event={nextMeeting} />
        </div>

        {connectionError ? (
          <OutlookConnectState
            title={connectionError === 'not_connected'
              ? 'Connect your Outlook to see the calendar'
              : 'Your Outlook session expired'}
            cta={connectionError === 'not_connected' ? 'Connect Outlook' : 'Reconnect Outlook'}
            disabled={outlookConnectDisabled}
          />
        ) : view === 'calendar' ? (
          <CalendarGridView events={events} onEventClick={openEdit} onAddOnDate={openAdd} onDeleteEvent={ev => setDeleteEvent(ev)} />
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Shimmer h={20} radius={4} />
            <Shimmer h={76} />
            <Shimmer h={76} />
          </div>
        ) : isSearching ? (
          <>
            {/* SEARCH RESULTS */}
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)', marginBottom: 14 }}>
              {searchResults.length} {searchResults.length === 1 ? 'event' : 'events'} found
            </div>
            {searchResults.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', paddingTop: 48, gap: 8, color: 'var(--text3)',
              }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>No events found</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nothing matches “{searchQuery.trim()}”</div>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                {searchResults.map((e, i) => (
                  <div key={e.id}>
                    {i > 0 && (
                      <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
                    )}
                    <SearchResultRow event={e} onEdit={openEdit} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Week navigation (list view only) — above the TODAY/date sections */}
            <WeekNav
              weekOffset={weekOffset}
              rangeLabel={weekRangeLabel(now, weekOffset)}
              onPrev={() => setWeekOffset(prev => prev - 1)}
              onNext={() => setWeekOffset(prev => prev + 1)}
            />

            {weekLoading ? (
              /* Offset week fetching — same skeleton style as the initial load state. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Shimmer h={20} radius={4} />
                <Shimmer h={76} />
                <Shimmer h={76} />
              </div>
            ) : weekOffset > 0 ? (
              /* Offset week: date-grouped events for the selected Mon–Sun window.
                 TODAY/TOMORROW framing is hidden; cancelled styling still applies
                 (handled inside EventCard). */
              Object.keys(offsetWeekByDay).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {Object.entries(offsetWeekByDay).map(([dateStr, dayEvents]) => (
                    <div key={dateStr}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text3)',
                        marginBottom: 8, paddingLeft: 1,
                        textTransform: 'uppercase', letterSpacing: '0.4px',
                      }}>
                        {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                          timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
                        })}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dayEvents.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={handleGenerateAgenda} onEdit={openEdit} onDelete={ev => setDeleteEvent(ev)} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                  No meetings this week
                </div>
              )
            ) : (
            <>
            {/* TODAY */}
            <div style={{ marginBottom: 28 }}>
              <SectionHeader title="TODAY" subtitle={todayLabel} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todayEvents.length === 0
                  ? <EmptyState />
                  : todayEvents.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={handleGenerateAgenda} onEdit={openEdit} onDelete={ev => setDeleteEvent(ev)} />)
                }
              </div>
            </div>

            {/* TOMORROW */}
            <div style={{ marginBottom: 28 }}>
              <SectionHeader title="TOMORROW" subtitle={tomorrowLabel} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tomorrowEvents.length === 0
                  ? <EmptyState />
                  : tomorrowEvents.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={handleGenerateAgenda} onEdit={openEdit} onDelete={ev => setDeleteEvent(ev)} />)
                }
              </div>
            </div>

            {/* THIS WEEK */}
            {Object.keys(thisWeekByDay).length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <SectionHeader
                  title="THIS WEEK"
                  subtitle={`${dat.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })} – ${wkEnd.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}`}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {Object.entries(thisWeekByDay).map(([dateStr, dayEvents]) => (
                    <div key={dateStr}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text3)',
                        marginBottom: 8, paddingLeft: 1,
                        textTransform: 'uppercase', letterSpacing: '0.4px',
                      }}>
                        {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                          timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
                        })}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dayEvents.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={handleGenerateAgenda} onEdit={openEdit} onDelete={ev => setDeleteEvent(ev)} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UPCOMING */}
            {upcomingEvents.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <SectionHeader title="UPCOMING" subtitle="Beyond this week" />
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  {upcomingEvents.map((e, i) => (
                    <div key={e.id}>
                      {i > 0 && (
                        <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
                      )}
                      <EventRow event={e} onEdit={openEdit} onDelete={ev => setDeleteEvent(ev)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All empty state */}
            {events.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', paddingTop: 60, gap: 12,
                color: 'var(--text3)',
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: 0.3 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>No calendar events</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Events synced from Microsoft 365 will appear here</div>
              </div>
            )}
            </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes calSlideFromRight {
          from { opacity: 0; transform: translateX(26px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes calSlideFromLeft {
          from { opacity: 0; transform: translateX(-26px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes calEventFadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes calPopupIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Save toast */}
      {saveToast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10002,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderRadius: 10,
          background: saveToast.type === 'success' ? 'var(--green-bg)' : 'var(--red-soft)',
          border: `1px solid ${saveToast.type === 'success' ? '#bbf7d0' : 'var(--red-border)'}`,
          color: saveToast.type === 'success' ? 'var(--green)' : 'var(--red)',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          animation: 'toastIn 0.25s ease forwards',
          maxWidth: 320, fontFamily: 'inherit',
        }}>
          {saveToast.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
          {saveToast.message}
        </div>
      )}

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSave}
        saving={saving}
        initialDate={addInitialDate}
      />

      {/* Edit Event Modal */}
      {editEvent && (
        <div
          onClick={() => { setEditEvent(null); setEditScopeAsk(false); setEditScope(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              width: 480,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 64px)',
              overflowY: 'auto',
              animation: 'modalFadeIn 180ms ease',
            }}
          >
            {editScopeAsk ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Edit Recurring Event</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Choose what to update</div>
                  </div>
                  <button
                    onClick={() => { setEditEvent(null); setEditScopeAsk(false); setEditScope(null) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', padding: 4, borderRadius: 6,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Event summary */}
                  <div style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '13px 15px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                      {editEvent.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {new Date(editEvent.start_time).toLocaleDateString('en-US', {
                        timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
                      })}
                      {!editEvent.is_all_day && ` · ${formatTimeRange(editEvent.start_time, editEvent.end_time)}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                    This is a recurring event. What would you like to edit?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => { setEditScopeAsk(false); setEditScope('one') }}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 9,
                        background: 'none', border: '1px solid var(--border2)',
                        color: 'var(--text2)', fontSize: 13, fontWeight: 600,
                        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color 150ms ease, color 150ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Edit Just This Event</div>
                      <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>Only changes this one occurrence</div>
                    </button>
                    <button
                      onClick={() => { setEditScopeAsk(false); setEditScope('future') }}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 9,
                        background: 'var(--charcoal)', border: '1px solid var(--charcoal)',
                        color: 'white', fontSize: 13, fontWeight: 600,
                        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                        transition: 'opacity 150ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Edit All Future Events</div>
                      <div style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.65)' }}>Updates this and all upcoming occurrences</div>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Edit Calendar Event</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {editScope === 'future' ? 'Editing all future occurrences' : editEvent.is_recurring ? 'Editing just this occurrence' : 'Update this event'}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditEvent(null); setEditScopeAsk(false); setEditScope(null) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', padding: 4, borderRadius: 6,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Form */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* All Day toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>All Day Event</label>
                    <button
                      onClick={() => setEditForm(f => ({ ...f, isAllDay: !f.isAllDay }))}
                      style={{
                        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                        background: editForm.isAllDay ? 'var(--red)' : 'var(--border2)',
                        position: 'relative', transition: 'background 150ms ease',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: editForm.isAllDay ? 21 : 3,
                        width: 16, height: 16, borderRadius: '50%', background: 'white',
                        transition: 'left 150ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>

                  {/* Title */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Title <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Event title"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Date <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    {editScope === 'one' && editEvent.is_recurring && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                        Date change applies to this occurrence only.
                      </div>
                    )}
                  </div>

                  {/* Start / End Time */}
                  {!editForm.isAllDay && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Start Time <span style={{ color: 'var(--red)' }}>*</span>
                          </label>
                          <input
                            type="time"
                            value={editForm.startTime}
                            onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8,
                              border: '1px solid var(--border2)', background: 'var(--surface2)',
                              color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            End Time
                          </label>
                          <input
                            type="time"
                            value={editForm.endTime}
                            onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8,
                              border: '1px solid var(--border2)', background: 'var(--surface2)',
                              color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                        Enter time in ET (Florida time)
                      </div>
                    </>
                  )}

                  {/* Organizer */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Organizer
                    </label>
                    <input
                      type="text"
                      value={editForm.organizer}
                      onChange={e => setEditForm(f => ({ ...f, organizer: e.target.value }))}
                      placeholder="Calin Noonan"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Location
                    </label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Conference room, address, etc."
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Teams Link */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Teams Meeting Link
                    </label>
                    <input
                      type="url"
                      value={editForm.teamsLink}
                      onChange={e => setEditForm(f => ({ ...f, teamsLink: e.target.value }))}
                      placeholder="https://teams.microsoft.com/..."
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--surface2)',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Recurring options — only shown when editing all future events */}
                  {editScope === 'future' && editEvent.is_recurring && (
                    <>
                      {/* STEP 1 — FREQUENCY */}
                      <div style={{ paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Frequency
                        </label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(['Daily', 'Weekly', 'Monthly', 'Custom'] as const).map(freq => {
                            const active = editForm.frequency === freq
                            return (
                              <button
                                key={freq}
                                type="button"
                                onClick={() => setEditForm(f => ({
                                  ...f,
                                  frequency: freq,
                                  recurringDays: freq !== 'Custom' ? [] : f.recurringDays,
                                }))}
                                style={{
                                  padding: '7px 14px', borderRadius: 8,
                                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                                  background: active ? 'var(--charcoal)' : 'transparent',
                                  color: active ? 'white' : 'var(--text2)',
                                  border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border2)'}`,
                                  transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                                }}
                              >
                                {freq === 'Custom' ? 'Custom Days' : freq}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Day picker — only when Custom Days selected */}
                      {editForm.frequency === 'Custom' && (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Repeat On
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {WEEKDAYS.map(w => {
                              const active = editForm.recurringDays.includes(w.label)
                              return (
                                <button
                                  key={w.label}
                                  type="button"
                                  onClick={() => setEditForm(f => ({
                                    ...f,
                                    recurringDays: active
                                      ? f.recurringDays.filter(d => d !== w.label)
                                      : [...f.recurringDays, w.label],
                                  }))}
                                  style={{
                                    padding: '6px 13px', borderRadius: 8,
                                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                                    background: active ? 'var(--red)' : 'transparent',
                                    color: active ? 'white' : 'var(--text2)',
                                    border: `1px solid ${active ? 'var(--red)' : 'var(--border2)'}`,
                                    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                                  }}
                                >
                                  {w.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* STEP 2 — REPEAT UNTIL */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Repeat Until
                        </label>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          {(['date', 'indefinitely'] as const).map(mode => {
                            const active = editForm.repeatUntilMode === mode
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setEditForm(f => ({ ...f, repeatUntilMode: mode }))}
                                style={{
                                  padding: '7px 14px', borderRadius: 8,
                                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                                  background: active ? 'var(--charcoal)' : 'transparent',
                                  color: active ? 'white' : 'var(--text2)',
                                  border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border2)'}`,
                                  transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                                }}
                              >
                                {mode === 'date' ? 'Pick a Date' : 'Indefinitely ∞'}
                              </button>
                            )
                          })}
                        </div>
                        {editForm.repeatUntilMode === 'date' ? (
                          <input
                            type="date"
                            value={editForm.repeatUntil}
                            onChange={e => setEditForm(f => ({ ...f, repeatUntil: e.target.value }))}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8,
                              border: '1px solid var(--border2)', background: 'var(--surface2)',
                              color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          <div style={{
                            padding: '9px 12px', borderRadius: 8,
                            border: '1px solid var(--purple-border)', background: 'var(--surface2)',
                            fontSize: 13, fontWeight: 600, color: '#7c3aed',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            ↻ Repeats forever (generates 12 months)
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
                  padding: '14px 20px', borderTop: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => { setEditEvent(null); setEditScopeAsk(false); setEditScope(null) }}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'none', border: '1px solid var(--border2)',
                      color: 'var(--text2)', fontSize: 13, fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditSave(editScope ?? 'one')}
                    disabled={editSaving || !editForm.title || !editForm.date || (!editForm.isAllDay && !editForm.startTime)}
                    style={{
                      padding: '8px 18px', borderRadius: 8,
                      background: 'var(--red)', color: 'white',
                      border: 'none', fontSize: 13, fontWeight: 600,
                      fontFamily: 'inherit', cursor: 'pointer',
                      opacity: (editSaving || !editForm.title || !editForm.date || (!editForm.isAllDay && !editForm.startTime)) ? 0.5 : 1,
                      transition: 'opacity 150ms ease',
                    }}
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteEvent && (
        <div
          onClick={() => { if (!deleting) setDeleteEvent(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              width: 420,
              maxWidth: 'calc(100vw - 32px)',
              animation: 'modalFadeIn 180ms ease',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#fee2e2', border: '1px solid #fecaca',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ef4444', flexShrink: 0,
                }}>
                  <TrashIcon size={14} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Delete this event?</div>
              </div>
              <button
                onClick={() => { if (!deleting) setDeleteEvent(null) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Event info */}
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '13px 15px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {deleteEvent.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {new Date(deleteEvent.start_time).toLocaleDateString('en-US', {
                    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  })}
                  {!deleteEvent.is_all_day && ` · ${formatTimeRange(deleteEvent.start_time, deleteEvent.end_time)}`}
                </div>
              </div>

              {/* Outlook warning */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 9,
                padding: '11px 13px', borderRadius: 8,
                background: '#fffbeb', border: '1px solid #fde68a',
                color: '#92400e',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  This will remove it from CASK Hub only.<br />
                  <strong>It will NOT delete from Outlook calendar.</strong>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--border)',
            }}>
              {deleteEvent.is_recurring && deleteEvent.recurring_id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                    Delete just this event or all recurring events?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setDeleteEvent(null)}
                      disabled={deleting}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 8,
                        background: 'none', border: '1px solid var(--border2)',
                        color: 'var(--text2)', fontSize: 13, fontWeight: 500,
                        fontFamily: 'inherit', cursor: deleting ? 'not-allowed' : 'pointer',
                        opacity: deleting ? 0.5 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete('one')}
                      disabled={deleting}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 8,
                        background: 'none', border: '1px solid var(--border2)',
                        color: 'var(--text2)', fontSize: 13, fontWeight: 600,
                        fontFamily: 'inherit', cursor: deleting ? 'not-allowed' : 'pointer',
                        opacity: deleting ? 0.5 : 1,
                      }}
                    >
                      Just This One
                    </button>
                    <button
                      onClick={() => handleDelete('all')}
                      disabled={deleting}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 8,
                        background: '#ef4444', color: 'white',
                        border: 'none', fontSize: 13, fontWeight: 600,
                        fontFamily: 'inherit', cursor: deleting ? 'not-allowed' : 'pointer',
                        opacity: deleting ? 0.5 : 1,
                        transition: 'opacity 150ms ease',
                      }}
                    >
                      {deleting ? 'Deleting…' : 'All Recurring'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => setDeleteEvent(null)}
                    disabled={deleting}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'none', border: '1px solid var(--border2)',
                      color: 'var(--text2)', fontSize: 13, fontWeight: 500,
                      fontFamily: 'inherit', cursor: deleting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete('one')}
                    disabled={deleting}
                    style={{
                      padding: '8px 18px', borderRadius: 8,
                      background: '#ef4444', color: 'white',
                      border: 'none', fontSize: 13, fontWeight: 600,
                      fontFamily: 'inherit', cursor: deleting ? 'not-allowed' : 'pointer',
                      opacity: deleting ? 0.5 : 1,
                      transition: 'opacity 150ms ease',
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Delete Event'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generated Agenda Modal */}
      {agenda && (
        <div
          onClick={() => setAgenda(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              width: 560,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 64px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              animation: 'modalFadeIn 180ms ease',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Meeting Agenda</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agenda.title}</div>
              </div>
              <button
                onClick={() => setAgenda(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {agenda.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Generating agenda…
                </div>
              ) : (
                <pre style={{
                  margin: 0, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65,
                  color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {agenda.content}
                </pre>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
              padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
            }}>
              <button
                onClick={copyAgenda}
                disabled={agenda.loading || !agenda.content}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8,
                  background: 'none', border: '1px solid var(--border2)',
                  color: 'var(--text2)', fontSize: 13, fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: (agenda.loading || !agenda.content) ? 'not-allowed' : 'pointer',
                  opacity: (agenda.loading || !agenda.content) ? 0.5 : 1,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </button>
              <button
                onClick={printAgenda}
                disabled={agenda.loading || !agenda.content}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 8,
                  background: 'var(--red)', color: 'white',
                  border: 'none', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: (agenda.loading || !agenda.content) ? 'not-allowed' : 'pointer',
                  opacity: (agenda.loading || !agenda.content) ? 0.5 : 1,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Calendar AI button + chat drawer — bottom-right, this page only */}
      <FloatingCalendarAI />
    </>
  )
}
