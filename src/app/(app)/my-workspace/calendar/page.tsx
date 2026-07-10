'use client'

// My Calendar — the signed-in user's own Outlook calendar, powered by Microsoft
// Graph via /api/calendar/my-events. Distinct from the President's Calendar
// (which reads the shared calendar_events Supabase table); this page is scoped to
// whoever is logged in and their connected Microsoft account.
//
// Theming: uses ONLY the existing CSS variables (--bg, --surface, --surface2,
// --text/2/3, --border, --red, --sidebar) via Tailwind arbitrary-value classes so
// the app's .dark theme overrides apply automatically. No inline styles.
//
// Data scope: the API returns today's events, this week's events, and a 90-day
// upcoming COUNT (not a full list). The calendar grid can therefore only plot the
// events it actually has (this week); browsing to other months shows empty cells.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const ET = 'America/New_York'

// ── Graph event shape ────────────────────────────────────────────────
interface GraphDateTime {
  dateTime: string
  timeZone: string
}
interface GraphEvent {
  id: string
  subject: string
  start: GraphDateTime
  end: GraphDateTime
  location?: { displayName?: string } | null
  onlineMeeting?: { joinUrl?: string } | null
  recurrence?: unknown | null
  organizer?: { emailAddress?: { name?: string; address?: string } } | null
  isAllDay?: boolean
  isCancelled?: boolean
}
interface MyEventsResponse {
  todayEvents?: GraphEvent[]
  weekEvents?: GraphEvent[]
  monthEvents?: GraphEvent[]
  upcomingCount?: number
  nextMeeting?: GraphEvent | null
  error?: string
}

// ── Time helpers (all Eastern Time) ──────────────────────────────────
// calendarView (no Prefer:outlook.timezone header) returns UTC datetimes with up
// to 7 fractional-second digits. Normalize to ms precision and treat as UTC when
// no offset is present, then format/compare in ET.
function parseGraphDate(dt: string): Date {
  const trimmed = dt.replace(/(\.\d{3})\d+/, '$1')
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(trimmed)
  return new Date(hasTz ? trimmed : `${trimmed}Z`)
}

function formatTime(dt: string): string {
  return parseGraphDate(dt).toLocaleTimeString('en-US', {
    timeZone: ET, hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function formatTimeRange(ev: GraphEvent): string {
  if (ev.isAllDay) return 'All Day'
  const s = formatTime(ev.start.dateTime)
  const e = ev.end?.dateTime ? formatTime(ev.end.dateTime) : ''
  return e ? `${s} – ${e}` : s
}

function durationLabel(ev: GraphEvent): string | null {
  if (ev.isAllDay || !ev.end?.dateTime) return null
  const mins = Math.round(
    (parseGraphDate(ev.end.dateTime).getTime() - parseGraphDate(ev.start.dateTime).getTime()) / 60000
  )
  if (mins <= 0) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ET calendar-date string (YYYY-MM-DD) for a Graph datetime.
function etDateStr(dt: string): string {
  return parseGraphDate(dt).toLocaleDateString('en-CA', { timeZone: ET })
}

// Step a YYYY-MM-DD string by n days, anchored at UTC noon to dodge DST.
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

function countdownLabel(startDt: string, now: Date): string {
  const diff = parseGraphDate(startDt).getTime() - now.getTime()
  if (diff <= 0) return 'Now'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`
}

// "MON JUL 13" style header from a YYYY-MM-DD string (anchored at UTC noon).
function dayHeaderLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const wd = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const mo = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
  return `${wd} ${mo} ${day}`.toUpperCase()
}

function dedupeById(events: GraphEvent[]): GraphEvent[] {
  return Array.from(new Map(events.map(e => [e.id, e])).values())
}

// Mon–Sun ET week range label ("Jul 6 – Jul 12") for a given offset from the
// current week (matches the Mon–Sun window the API uses for weekEvents).
function weekRangeLabel(now: Date, weekOffset: number): string {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: ET })
  const etWeekday = new Date(now.toLocaleString('en-US', { timeZone: ET })).getDay() // 0=Sun … 6=Sat
  const daysFromMonday = (etWeekday + 6) % 7
  const monday = addDays(todayStr, -daysFromMonday + weekOffset * 7)
  const sunday = addDays(monday, 6)
  const fmt = (ds: string) =>
    new Date(ds + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

// A Graph event is cancelled when isCancelled is true, or its subject is prefixed
// with "Cancelled:" / "Canceled:" (Microsoft uses both spellings). Cancelled
// events are marked visually rather than hidden.
function isCancelledEvent(ev: GraphEvent): boolean {
  if (ev.isCancelled === true) return true
  const s = (ev.subject ?? '').trimStart().toLowerCase()
  return s.startsWith('cancelled:') || s.startsWith('canceled:')
}

// ── Small presentational pieces ──────────────────────────────────────
function CalendarGlyph({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function TeamsButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 whitespace-nowrap"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      Join Teams
    </a>
  )
}

// ── Loading skeleton ─────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
          <div className="shimmer h-4 w-32 rounded" />
          <div className="shimmer mt-3 h-5 w-2/3 rounded" />
          <div className="shimmer mt-2 h-3 w-1/3 rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Not-connected / expired empty states ─────────────────────────────
function ConnectState({ title, cta }: { title: string; cta: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
        <div className="text-[var(--text3)]"><CalendarGlyph /></div>
        <div className="text-sm text-[var(--text2)]">{title}</div>
        <a
          href="/api/auth/microsoft"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          {cta}
        </a>
      </div>
    </div>
  )
}

// ── Stat cards ───────────────────────────────────────────────────────
function StatCard({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text3)]">{label}</div>
      <div className="text-3xl font-bold leading-none text-[var(--text)]">{value}</div>
      <div className="mt-1.5 text-xs text-[var(--text3)]">{sublabel}</div>
    </div>
  )
}

function NextMeetingCard({ nextMeeting, now }: { nextMeeting: GraphEvent | null | undefined; now: Date }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text3)]">Next Meeting</div>
      {nextMeeting ? (
        <>
          <div className="text-2xl font-bold leading-none text-[var(--red)]">
            {countdownLabel(nextMeeting.start.dateTime, now)}
          </div>
          <div className="mt-1.5 truncate text-xs text-[var(--text2)]">{nextMeeting.subject}</div>
        </>
      ) : (
        <div className="text-sm text-[var(--text3)]">No more meetings today</div>
      )}
    </div>
  )
}

// ── List view ────────────────────────────────────────────────────────
function EventCard({ event, onGenerateAgenda }: { event: GraphEvent; onGenerateAgenda: (e: GraphEvent) => void }) {
  const duration = durationLabel(event)
  const location = event.location?.displayName
  const organizer = event.organizer?.emailAddress?.name
  const joinUrl = event.onlineMeeting?.joinUrl
  const cancelled = isCancelledEvent(event)

  return (
    // Cancelled events: whole card dimmed (opacity-40) so time / duration /
    // location stay visible but greyed; subject also gets a strikethrough below.
    <div className={`flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4 ${cancelled ? 'opacity-40' : ''}`}>
      {/* Left: time + badges */}
      <div className="flex w-36 shrink-0 flex-col gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{formatTimeRange(event)}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {duration && (
            <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text2)]">
              {duration}
            </span>
          )}
          {event.recurrence != null && (
            <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text2)]">
              ↻ Repeats
            </span>
          )}
        </div>
      </div>

      {/* Center: subject + location/organizer */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold text-[var(--text)] ${cancelled ? 'line-through' : ''}`}>
            {event.subject || '(No subject)'}
          </span>
          {cancelled && (
            // Spec: var(--surface2) bg + var(--text3) text, small rounded pill. A
            // hairline border is added so the pill stays legible on the surface2 card.
            <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text3)]">
              Cancelled
            </span>
          )}
        </div>
        {location ? (
          <div className="mt-1 truncate text-xs text-[var(--text2)]">📍 {location}</div>
        ) : organizer ? (
          <div className="mt-1 truncate text-xs text-[var(--text2)]">{organizer}</div>
        ) : null}
      </div>

      {/* Right: actions — hidden entirely for cancelled events (no Join Teams /
          Generate Agenda). */}
      {!cancelled && (
        <div className="flex shrink-0 flex-col items-end gap-2">
          {joinUrl && <TeamsButton url={joinUrl} />}
          <button
            onClick={() => onGenerateAgenda(event)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--red)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 whitespace-nowrap"
          >
            ✦ Generate Agenda
          </button>
        </div>
      )}
    </div>
  )
}

function ListView({
  todayEvents, weekEvents, now, onGenerateAgenda,
}: {
  todayEvents: GraphEvent[]
  weekEvents: GraphEvent[]
  now: Date
  onGenerateAgenda: (e: GraphEvent) => void
}) {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: ET })
  const tomorrowStr = addDays(todayStr, 1)

  // Remaining week events = week minus anything already in the Today section, and
  // only dates AFTER today (past days earlier in the Mon–Sun window are omitted —
  // this is an upcoming view). Grouped by ET date, ascending.
  const todayIds = new Set(todayEvents.map(e => e.id))
  const groups = useMemo(() => {
    const byDate: Record<string, GraphEvent[]> = {}
    for (const e of weekEvents) {
      if (todayIds.has(e.id)) continue
      const d = etDateStr(e.start.dateTime)
      if (d <= todayStr) continue
      ;(byDate[d] ??= []).push(e)
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evs]) => ({
        date,
        events: evs.slice().sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime)),
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekEvents, todayStr])

  const sortedToday = todayEvents.slice().sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime))

  return (
    <div className="flex flex-col gap-8">
      {/* TODAY */}
      <section>
        <SectionHeader label="TODAY" />
        <div className="flex flex-col gap-2">
          {sortedToday.length > 0
            ? sortedToday.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={onGenerateAgenda} />)
            : <div className="py-4 text-sm text-[var(--text3)]">No meetings scheduled</div>}
        </div>
      </section>

      {/* TOMORROW + future days */}
      {groups.map(g => (
        <section key={g.date}>
          <SectionHeader label={g.date === tomorrowStr ? 'TOMORROW' : dayHeaderLabel(g.date)} />
          <div className="flex flex-col gap-2">
            {g.events.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={onGenerateAgenda} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">{label}</span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  )
}

// ── Calendar grid view ───────────────────────────────────────────────
interface DayCell {
  dateStr: string
  day: number
  inMonth: boolean
  isToday: boolean
  events: GraphEvent[]
}

function buildMonthGrid(year: number, month: number, events: GraphEvent[], todayStr: string): DayCell[] {
  const firstUTC = new Date(Date.UTC(year, month, 1, 12, 0, 0))
  const startDow = firstUTC.getUTCDay()
  const gridStart = new Date(firstUTC)
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow)

  const byDate: Record<string, GraphEvent[]> = {}
  for (const e of events) {
    ;(byDate[etDateStr(e.start.dateTime)] ??= []).push(e)
  }

  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart)
    cur.setUTCDate(cur.getUTCDate() + i)
    const dateStr = cur.toISOString().split('T')[0]
    const evs = (byDate[dateStr] ?? []).slice().sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime))
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

function CalendarGridView({
  monthEvents, monthLoading, calendarMonth, now, onSelect, onPrev, onNext, onToday,
}: {
  monthEvents: GraphEvent[]
  monthLoading: boolean
  calendarMonth: { month: number; year: number }
  now: Date
  onSelect: (e: GraphEvent) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: ET })
  // Month state is lifted to the page (drives the API fetch); calendarMonth.month
  // is 1-indexed, so convert to the 0-indexed month buildMonthGrid/Date expect.
  const viewYear = calendarMonth.year
  const viewMonth = calendarMonth.month - 1

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, monthEvents, todayStr),
    [viewYear, viewMonth, monthEvents, todayStr],
  )

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1, 12))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Month header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div className="text-xl font-bold text-[var(--text)]">{monthLabel}</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--text2)] transition-colors hover:text-[var(--text)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            onClick={onToday}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-xs font-semibold text-[var(--text2)] transition-colors hover:text-[var(--text)]"
          >
            Today
          </button>
          <button
            onClick={onNext}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--text2)] transition-colors hover:text-[var(--text)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface2)]">
        {weekdays.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-bold tracking-widest text-[var(--text3)]">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="relative">
        {/* Subtle pulsing overlay while the month's events are being fetched. */}
        {monthLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-[var(--surface)] opacity-40" aria-hidden="true" />
        )}
        <div className="grid grid-cols-7">
        {cells.map(cell => {
          const visible = cell.events.slice(0, 3)
          const extra = cell.events.length - visible.length
          return (
            <div
              key={cell.dateStr}
              className={`flex min-h-[104px] flex-col gap-1 border-b border-r border-[var(--border)] p-1.5 ${cell.inMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={
                    cell.isToday
                      ? 'inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-xs font-bold text-white'
                      : 'px-1 text-xs font-semibold text-[var(--text2)]'
                  }
                >
                  {cell.day}
                </span>
              </div>
              {visible.map(ev => {
                const isTeams = !!ev.onlineMeeting?.joinUrl
                const cancelled = isCancelledEvent(ev)
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelect(ev)}
                    title={ev.subject}
                    className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold transition-opacity hover:opacity-85 ${
                      isTeams ? 'bg-[#7C3AED] text-white' : 'bg-[var(--surface2)] text-[var(--text2)]'
                    } ${cancelled ? 'opacity-40' : ''}`}
                  >
                    {/* Cancelled: strikethrough the subject only (leave the time legible). */}
                    {ev.isAllDay ? '' : `${formatTime(ev.start.dateTime)} `}
                    <span className={cancelled ? 'line-through' : ''}>{ev.subject || '(No subject)'}</span>
                  </button>
                )
              })}
              {extra > 0 && (
                <button
                  onClick={() => onSelect(cell.events[visible.length])}
                  className="px-1 text-left text-[10.5px] font-bold text-[var(--text3)] transition-colors hover:text-[var(--text)]"
                >
                  +{extra} more
                </button>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

// ── Event detail popup ───────────────────────────────────────────────
function EventPopup({ event, onClose }: { event: GraphEvent; onClose: () => void }) {
  const location = event.location?.displayName
  const organizer = event.organizer?.emailAddress?.name
  const joinUrl = event.onlineMeeting?.joinUrl
  const dateLabel = new Date(event.start.dateTime ? parseGraphDate(event.start.dateTime) : Date.now())
    .toLocaleDateString('en-US', { timeZone: ET, weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[380px] max-w-[calc(100vw-32px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-base font-bold leading-snug text-[var(--text)]">{event.subject || '(No subject)'}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[var(--text3)] transition-colors hover:text-[var(--text)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--text2)]">
          <div>🕐 {dateLabel} · {formatTimeRange(event)}</div>
          {location && <div>📍 {location}</div>}
          {organizer && <div>👤 {organizer}</div>}
        </div>

        {joinUrl && !isCancelledEvent(event) && (
          <div className="mt-4">
            <TeamsButton url={joinUrl} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Week navigation (list view) ──────────────────────────────────────
// Left arrow is disabled at the current week (can't go before it); right arrow
// is enabled up to 8 weeks out. Full width to match the event cards below.
function WeekNav({
  weekOffset, rangeLabel, onPrev, onNext,
}: {
  weekOffset: number
  rangeLabel: string
  onPrev: () => void
  onNext: () => void
}) {
  const canPrev = weekOffset > 0
  const canNext = weekOffset < 8
  const arrowBase =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors'
  return (
    <div className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous week"
        className={`${arrowBase} ${canPrev ? 'text-[var(--text2)] hover:text-[var(--text)]' : 'cursor-not-allowed text-[var(--text3)] opacity-40'}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <span className="text-sm font-semibold text-[var(--text)]">{rangeLabel}</span>
      <button
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next week"
        className={`${arrowBase} ${canNext ? 'text-[var(--text2)] hover:text-[var(--text)]' : 'cursor-not-allowed text-[var(--text3)] opacity-40'}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  )
}

// animate-pulse skeleton shown while a non-current week is being fetched.
function WeekSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
          <div className="animate-pulse h-4 w-32 rounded bg-[var(--surface)]" />
          <div className="animate-pulse mt-3 h-5 w-2/3 rounded bg-[var(--surface)]" />
          <div className="animate-pulse mt-2 h-3 w-1/3 rounded bg-[var(--surface)]" />
        </div>
      ))}
    </div>
  )
}

// Events grouped by ET date (ascending), each date its own section. Used for
// non-current weeks, where the TODAY/TOMORROW framing of ListView doesn't apply.
function GroupedEventList({
  events, onGenerateAgenda,
}: {
  events: GraphEvent[]
  onGenerateAgenda: (e: GraphEvent) => void
}) {
  const groups = useMemo(() => {
    const byDate: Record<string, GraphEvent[]> = {}
    for (const e of events) {
      ;(byDate[etDateStr(e.start.dateTime)] ??= []).push(e)
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evs]) => ({
        date,
        events: evs.slice().sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime)),
      }))
  }, [events])

  return (
    <div className="flex flex-col gap-8">
      {groups.map(g => (
        <section key={g.date}>
          <SectionHeader label={dayHeaderLabel(g.date)} />
          <div className="flex flex-col gap-2">
            {g.events.map(e => <EventCard key={e.id} event={e} onGenerateAgenda={onGenerateAgenda} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function MyCalendarPage() {
  const router = useRouter()
  const [data, setData] = useState<MyEventsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [now, setNow] = useState(() => new Date())
  const [selected, setSelected] = useState<GraphEvent | null>(null)
  // Week navigation (list view). 0 = this week, 1 = next week, etc. weekOffset 0
  // reuses the existing `data` fetch below; >0 does a one-off fetch into weekData.
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekData, setWeekData] = useState<GraphEvent[] | null>(null)
  const [weekLoading, setWeekLoading] = useState(false)
  // Calendar grid month navigation (month is 1-indexed). Drives the month/year
  // fetch below; monthEvents is what the grid plots for the visible month.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { month: now.getMonth() + 1, year: now.getFullYear() }
  })
  const [monthEvents, setMonthEvents] = useState<GraphEvent[]>([])
  const [monthLoading, setMonthLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/my-events')
      const json: MyEventsResponse = await res.json()
      if (json.error) {
        setError(json.error)
        setData(null)
      } else {
        setData(json)
        setError(null)
      }
    } catch {
      setError('fetch_error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + auto-refresh every 5 minutes.
  useEffect(() => {
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  // Tick every minute so countdowns stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch a specific week when navigating past the current one. weekOffset 0 keeps
  // the existing behavior (served by `load` above); >0 does a one-off fetch.
  useEffect(() => {
    if (weekOffset === 0) {
      setWeekData(null)
      setWeekLoading(false)
      return
    }
    let cancelled = false
    setWeekLoading(true)
    // TODO: API route needs weekOffset query param support for weekOffset > 0 — currently returns this week only
    fetch(`/api/calendar/my-events?weekOffset=${weekOffset}`)
      .then(r => r.json())
      .then((json: MyEventsResponse) => {
        if (cancelled) return
        setWeekData(json.weekEvents ?? [])
      })
      .catch(() => { if (!cancelled) setWeekData([]) })
      .finally(() => { if (!cancelled) setWeekLoading(false) })
    return () => { cancelled = true }
  }, [weekOffset])

  // Fetch the visible month's events for the calendar grid — only while the grid
  // view is active, and whenever the navigated month changes. Uses the API's
  // month/year params; monthEvents is [] when they aren't returned.
  useEffect(() => {
    if (view !== 'calendar') return
    let cancelled = false
    setMonthLoading(true)
    fetch(`/api/calendar/my-events?month=${calendarMonth.month}&year=${calendarMonth.year}`)
      .then(r => r.json())
      .then((json: MyEventsResponse) => {
        if (cancelled) return
        setMonthEvents(Array.isArray(json.monthEvents) ? json.monthEvents : [])
      })
      .catch(() => { if (!cancelled) setMonthEvents([]) })
      .finally(() => { if (!cancelled) setMonthLoading(false) })
    return () => { cancelled = true }
  }, [view, calendarMonth])

  const todayEvents = data?.todayEvents ?? []
  const weekEvents = data?.weekEvents ?? []
  const upcomingCount = data?.upcomingCount ?? 0

  // Grid uses today + week events, deduped by id (see file header re: data scope).
  const gridEvents = useMemo(() => dedupeById([...todayEvents, ...weekEvents]), [todayEvents, weekEvents])

  // FIX 1: the API's nextMeeting can be a cancelled event. Recompute it here from
  // the events we have — skip ALL cancelled events and pick the first future one.
  const nextMeeting = useMemo(() => {
    const nowMs = now.getTime()
    return gridEvents
      .filter(ev =>
        !isCancelledEvent(ev) &&
        !!ev.start?.dateTime &&
        parseGraphDate(ev.start.dateTime).getTime() > nowMs
      )
      .sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime))[0] ?? null
  }, [gridEvents, now])

  // Shared by both the current-week ListView and other weeks' GroupedEventList.
  const handleGenerateAgenda = useCallback(
    (ev: GraphEvent) => router.push(`/generate?topic=${encodeURIComponent(ev.subject || '')}`),
    [router],
  )

  return (
    <div className="flex flex-1 flex-col overflow-y-auto animate-page-in">
      <div className="flex flex-1 flex-col gap-6 p-7">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">My Calendar</h1>
            <div className="mt-0.5 text-sm text-[var(--text3)]">Microsoft 365</div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {(['list', 'calendar'] as const).map(key => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === key ? 'bg-[var(--surface2)] text-[var(--text)]' : 'text-[var(--text3)] hover:text-[var(--text2)]'
                }`}
              >
                {key === 'list' ? '📋 List' : '📅 Calendar'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <LoadingSkeleton />
        ) : error === 'not_connected' ? (
          <ConnectState title="Connect your Outlook to see your calendar" cta="Connect Outlook" />
        ) : error === 'token_invalid' ? (
          <ConnectState title="Your Outlook session expired" cta="Reconnect Outlook" />
        ) : error ? (
          <ConnectState title="Couldn't load your calendar. Please try again." cta="Reconnect Outlook" />
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Today" value={todayEvents.length} sublabel="meetings" />
              <StatCard label="This Week" value={weekEvents.length} sublabel="total" />
              <StatCard label="Upcoming" value={upcomingCount} sublabel="on calendar" />
              <NextMeetingCard nextMeeting={nextMeeting} now={now} />
            </div>

            {/* View */}
            {view === 'list' ? (
              <div className="flex flex-col gap-4">
                {/* Week navigation (list view only) */}
                <WeekNav
                  weekOffset={weekOffset}
                  rangeLabel={weekRangeLabel(now, weekOffset)}
                  onPrev={() => setWeekOffset(o => Math.max(0, o - 1))}
                  onNext={() => setWeekOffset(o => Math.min(8, o + 1))}
                />
                {weekOffset === 0 ? (
                  <ListView
                    todayEvents={todayEvents}
                    weekEvents={weekEvents}
                    now={now}
                    onGenerateAgenda={handleGenerateAgenda}
                  />
                ) : weekLoading ? (
                  <WeekSkeleton />
                ) : (weekData?.length ?? 0) > 0 ? (
                  <GroupedEventList events={weekData ?? []} onGenerateAgenda={handleGenerateAgenda} />
                ) : (
                  <div className="py-10 text-center text-sm text-[var(--text3)]">No meetings this week</div>
                )}
              </div>
            ) : (
              <CalendarGridView
                monthEvents={monthEvents}
                monthLoading={monthLoading}
                calendarMonth={calendarMonth}
                now={now}
                onSelect={setSelected}
                onPrev={() =>
                  setCalendarMonth(prev =>
                    prev.month === 1
                      ? { month: 12, year: prev.year - 1 }
                      : { month: prev.month - 1, year: prev.year },
                  )
                }
                onNext={() =>
                  setCalendarMonth(prev =>
                    prev.month === 12
                      ? { month: 1, year: prev.year + 1 }
                      : { month: prev.month + 1, year: prev.year },
                  )
                }
                onToday={() => {
                  const d = new Date()
                  setCalendarMonth({ month: d.getMonth() + 1, year: d.getFullYear() })
                }}
              />
            )}
          </>
        )}
      </div>

      {selected && <EventPopup event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
