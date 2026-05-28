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
  web_link: string | null
  is_all_day: boolean | null
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

function EventCard({ event }: { event: CalendarEvent }) {
  const [hovered, setHovered] = useState(false)
  const borderColor = getEventBorderColor(event)
  const duration = getDuration(event.start_time, event.end_time)
  const { shown, extra } = getAttendeesDisplay(event.attendees)

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
        alignItems: 'flex-start',
        gap: 14,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.055)' : 'none',
      }}
    >
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
        {event.location && !event.meeting_link && (
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

      {/* View Event button */}
      {event.meeting_link && (
        <div style={{ flexShrink: 0, alignSelf: 'center' }}>
          <a
            href={event.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: 'white',
              background: '#7c3aed',
              padding: '7px 13px', borderRadius: 7,
              textDecoration: 'none',
              transition: 'opacity 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.82' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            View Event
          </a>
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
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

  // Stats
  const weekTotal = events.filter(e => toDateStr(e.start_time) <= weekEndStr).length
  const nextMeeting = events.find(e => new Date(e.start_time) > now)

  const todayLabel = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })
  const tomorrowLabel = tmrw.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <TopBar title="Calendar" subtitle="Microsoft 365">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text3)' }}>
          <CalendarIcon />
        </div>
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
                  : todayEvents.map(e => <EventCard key={e.id} event={e} />)
                }
              </div>
            </div>

            {/* TOMORROW */}
            <div style={{ marginBottom: 28 }}>
              <SectionHeader title="TOMORROW" subtitle={tomorrowLabel} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tomorrowEvents.length === 0
                  ? <EmptyState />
                  : tomorrowEvents.map(e => <EventCard key={e.id} event={e} />)
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
                        {dayEvents.map(e => <EventCard key={e.id} event={e} />)}
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
                      <EventRow event={e} />
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
      `}</style>
    </>
  )
}
