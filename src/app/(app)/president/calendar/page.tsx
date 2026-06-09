'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { TopBar, PillRed } from '@/components/ui'

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string | null
  organizer: string | null
  attendees: unknown
  location: string | null
  meeting_link: string | null
  teams_link: string | null
  web_link: string | null
  is_all_day: boolean | null
  is_recurring?: boolean | null
  recurring_id?: string | null
  recurring_days?: string[] | null
  recurring_indefinite?: boolean | null
  is_exception?: boolean | null
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
  if (event.meeting_link || event.teams_link) return '#7c3aed'
  return '#2563eb'
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
  const duration = getDuration(event.start_time, event.end_time)
  const { shown, extra } = getAttendeesDisplay(event.attendees)

  const teamsLink = event.teams_link ?? null

  async function saveTeamsLink() {
    if (!linkInput.trim()) return
    setSavingLink(true)
    const supabase = createClient()
    await supabase
      .from('calendar_events')
      .update({ teams_link: linkInput.trim() })
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
          }}>
            {event.title}
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

        {/* Action buttons */}
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

// ── Page ─────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({
    title: '', date: '', startTime: '', endTime: '',
    organizer: '', location: '', teamsLink: '', isAllDay: false,
    isRecurring: false, frequency: 'Weekly' as 'Daily' | 'Weekly' | 'Monthly' | 'Custom',
    repeatUntilMode: 'date' as 'date' | 'indefinitely',
    repeatUntil: '', recurringDays: [] as string[],
  })
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

  // Tick every minute to refresh countdowns
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const todayStr = new Date().toISOString().split('T')[0]

    async function load() {
      console.log('[calendar] supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
      console.log('[calendar] fetched events:', data)
      console.log('[calendar] error:', error)
      setEvents((data as CalendarEvent[]) ?? [])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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

  // Group this week by day
  const thisWeekByDay: Record<string, CalendarEvent[]> = {}
  for (const ev of thisWeekEvents) {
    const d = toDateStr(ev.start_time)
    if (!thisWeekByDay[d]) thisWeekByDay[d] = []
    thisWeekByDay[d].push(ev)
  }

  // Stats — count events from now through end of this week's Sunday (ET)
  const etNowApprox = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const etDayOfWeek = etNowApprox.getDay() // 0=Sun … 6=Sat
  const daysUntilSunday = etDayOfWeek === 0 ? 0 : 7 - etDayOfWeek
  const etSundayDateStr = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const weekTotal = events.filter(e =>
    new Date(e.start_time) >= now && toDateStr(e.start_time) <= etSundayDateStr
  ).length
  const nextMeeting = events.find(e => new Date(e.start_time) > now)

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

  async function handleSave() {
    if (!form.title || !form.date || (!form.isAllDay && !form.startTime)) return
    setSaving(true)
    console.log('[add-event] handleSave triggered', form)

    const supabase = createClient()

    // Build the list of occurrence dates (single, frequency-stepped, or day-of-week based)
    const isIndefinite = form.isRecurring && form.repeatUntilMode === 'indefinitely'
    const effectiveFrequency = (isIndefinite || form.frequency === 'Custom') ? 'Weekly' : form.frequency
    let effectiveRepeatUntil = form.repeatUntil
    if (isIndefinite && form.date) {
      const [iy, im, id2] = form.date.split('-').map(Number)
      const endDt = new Date(Date.UTC(iy, im - 1 + 12, id2, 12, 0, 0))
      effectiveRepeatUntil = endDt.toISOString().split('T')[0]
    }
    const dates = buildOccurrenceDates(form.date, form.isRecurring, effectiveRepeatUntil, effectiveFrequency, form.recurringDays)
    const isRecurring = form.isRecurring && dates.length > 1
    const recurringId = isRecurring && typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : null
    const recurringDays = isRecurring && form.recurringDays.length > 0 ? form.recurringDays : null

    const payloads = dates.map(d => {
      const startISO = form.isAllDay
        ? new Date(`${d}T00:00:00`).toISOString()
        : etToISO(d, form.startTime)
      const endISO = form.endTime ? etToISO(d, form.endTime) : null
      return {
        event_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: form.title,
        start_time: startISO,
        end_time: endISO,
        organizer: form.organizer || null,
        location: form.location || null,
        meeting_link: form.teamsLink || null,
        teams_link: form.teamsLink || null,
        is_all_day: form.isAllDay,
        user_email: 'c.noonan@caskconstruction.com',
        attendees: [],
        recurring_id: recurringId,
        is_recurring: isRecurring,
        recurring_days: recurringDays,
        recurring_indefinite: isIndefinite && isRecurring ? true : null,
      }
    })
    console.log('[add-event] inserting into calendar_events:', payloads)

    let { data, error } = await supabase.from('calendar_events').insert(payloads).select()

    // Graceful fallback if the recurring columns haven't been added to the table yet.
    if (error && /recurring_id|is_recurring|recurring_days|recurring_indefinite|schema cache|column/i.test(error.message)) {
      console.warn('[add-event] recurring columns missing — retrying without them. Run the migration to enable grouping.')
      const stripped = payloads.map(p => {
        const clone: Record<string, unknown> = { ...p }
        delete clone.recurring_id
        delete clone.is_recurring
        delete clone.recurring_days
        delete clone.recurring_indefinite
        return clone
      })
      const res = await supabase.from('calendar_events').insert(stripped).select()
      data = res.data
      error = res.error
    }
    console.log('[add-event] insert result — data:', data, ' error:', error)

    setSaving(false)

    if (error) {
      console.error('[add-event] Supabase insert failed:', error.message, error.details, error.hint)
      setSaveToast({ message: `Failed to save: ${error.message}`, type: 'error' })
      setTimeout(() => setSaveToast(null), 5000)
      return
    }

    setShowAddModal(false)
    setForm({ title: '', date: '', startTime: '', endTime: '', organizer: '', location: '', teamsLink: '', isAllDay: false, isRecurring: false, frequency: 'Weekly', repeatUntilMode: 'date', repeatUntil: '', recurringDays: [] })
    setSaveToast({
      message: payloads.length > 1 ? `Added ${payloads.length} events to calendar` : 'Event added to calendar',
      type: 'success',
    })
    setTimeout(() => setSaveToast(null), 3500)
  }

  function openEdit(event: CalendarEvent) {
    setEditForm({
      title: event.title ?? '',
      date: toDateStr(event.start_time),
      startTime: event.is_all_day ? '' : isoToETTime(event.start_time),
      endTime: event.end_time ? isoToETTime(event.end_time) : '',
      organizer: event.organizer ?? '',
      location: event.location ?? '',
      teamsLink: event.teams_link ?? event.meeting_link ?? '',
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

  async function handleEditSave(scope: 'one' | 'future') {
    if (!editEvent || !editForm.title || !editForm.date || (!editForm.isAllDay && !editForm.startTime)) return
    setEditSaving(true)
    const supabase = createClient()

    const baseUpdate = {
      title: editForm.title,
      organizer: editForm.organizer || null,
      location: editForm.location || null,
      meeting_link: editForm.teamsLink || null,
      teams_link: editForm.teamsLink || null,
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
        <button
          onClick={() => setShowAddModal(true)}
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

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          <StatTile value={todayEvents.length} label="Today" sublabel="meetings" accent="var(--red)" />
          <StatTile value={weekTotal} label="This Week" sublabel="total" accent="#2563eb" />
          <StatTile value={events.length} label="Upcoming" sublabel="on calendar" accent="#059669" />
          <NextMeetingTile event={nextMeeting} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Shimmer h={20} radius={4} />
            <Shimmer h={76} />
            <Shimmer h={76} />
          </div>
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
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
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
                onClick={() => setShowAddModal(false)}
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

              {/* Start / End Time */}
              {!form.isAllDay && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
            }}>
              <button
                onClick={() => setShowAddModal(false)}
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
                onClick={handleSave}
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
      )}

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
    </>
  )
}
