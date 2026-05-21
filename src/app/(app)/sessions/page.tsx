'use client'
// src/app/(app)/sessions/page.tsx

import { useState, useEffect, useCallback } from 'react'
import {
  TopBar,
  PillGreen,
  PillRed,
  MeetingCard,
  FilterBar,
} from '@/components/ui'
import { fetchAllMeetings } from '@/lib/meetings-client'
import type { Meeting } from '@/types'

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'planning', label: 'Planning' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'education', label: 'Education' },
]

export default function SessionsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const loadMeetings = useCallback(() => {
    setLoading(true)
    fetchAllMeetings().then(data => {
      setMeetings(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadMeetings()
    window.addEventListener('cask-meeting-saved', loadMeetings)
    return () => window.removeEventListener('cask-meeting-saved', loadMeetings)
  }, [loadMeetings])

  const filtered = filter === 'all'
    ? meetings
    : meetings.filter(m => m.meeting_type === filter)

  return (
    <>
      <TopBar title="Sessions" subtitle="ActionCOACH">
        <PillGreen>Claude AI Active</PillGreen>
        <PillRed>{meetings.length} Sessions</PillRed>
        <button
          onClick={() => window.dispatchEvent(new Event('cask-open-add-modal'))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--charcoal)',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.82' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
          Add Meeting
        </button>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            All Sessions
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            {loading ? 'Loading…' : `${meetings.length} ActionCOACH coaching sessions recorded`}
          </p>
        </div>

        <FilterBar
          tabs={FILTER_TABS}
          active={filter}
          onSelect={setFilter}
          count={filtered.length}
        />

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="rounded-[10px] h-[82px] shimmer"
                style={{ border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(m => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
            {filtered.length === 0 && (
              <div
                className="text-center py-12 text-[13px]"
                style={{ color: 'var(--text3)' }}
              >
                No sessions found for this filter.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
