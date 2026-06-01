// v3
'use client'
// src/app/(app)/dashboard/page.tsx

import { useState, useEffect, useCallback } from 'react'
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
import type { Meeting } from '@/types'

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

    // Upcoming stat card: count all future events and get the next one's date
    supabase
      .from('calendar_events')
      .select('id, title, start_time')
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        const rows = data ?? []
        setUpcomingCount(rows.length)
        if (rows.length > 0) {
          const nextDate = new Date(rows[0].start_time).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'long', day: 'numeric', year: 'numeric',
          })
          setNextEventHint(nextDate)
        } else {
          setNextEventHint('No upcoming events')
        }
      })

  }, [])

  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const CORE_OWNERS = ['calin', 'kai', 'rovern']
  function isCoreOwner(owner: string) {
    const o = owner.toLowerCase().trim()
    return (
      o === 'calin' || o.startsWith('calin ') ||
      o === 'kai' || o.startsWith('kai ') ||
      o === 'rovern' || o.startsWith('rovern ')
    )
  }
  const allActions = meetings.flatMap(m => m.action_items)
  const coreActions = allActions.filter(a => isCoreOwner(a.owner))
  const openActions = coreActions.filter(a => !a.done)
  const completedActions = coreActions.filter(a => a.done)
  const recentMeetings = meetings.slice(0, 3)
  const recentOpenActions = openActions.slice(0, 3)
  const recentCompletedActions = completedActions.slice(0, 2)

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
            label="Upcoming Meetings"
            hint={nextEventHint}
            variant="alert"
            index={1}
            icon={<IconCalendar />}
          />
          <StatCard
            value={loading ? '…' : openActions.length}
            label="Open Action Items"
            hint="Across all sessions"
            variant="default"
            index={2}
            icon={<IconList />}
          />
          <StatCard
            value={loading ? '…' : completedActions.length}
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
          {loading ? (
            <div className="flex flex-col gap-[5px]">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-[6px] h-[56px] shimmer" style={{ border: '1px solid var(--border)' }} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-[5px]">
              {recentOpenActions.map(item => (
                <ActionItemRow key={item.id} item={item} />
              ))}
              {recentCompletedActions.map(item => (
                <ActionItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
