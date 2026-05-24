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
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

export default function DashboardPage() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [greeting, setGreeting] = useState('Good morning')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) setGreeting('Good morning')
    else if (hour >= 12 && hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
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

  const allActions = meetings.flatMap(m => m.action_items)
  const openActions = allActions.filter(a => !a.done)
  const completedActions = allActions.filter(a => a.done)
  const recentMeetings = meetings.slice(0, 3)
  const recentOpenActions = openActions.slice(0, 3)
  const recentCompletedActions = completedActions.slice(0, 2)

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

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
              {todayLabel}
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
            value={1}
            label="Upcoming Meeting"
            hint="May 28, 2026"
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
            Open Action Items
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
