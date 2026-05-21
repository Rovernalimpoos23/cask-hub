'use client'
// src/app/(app)/sessions/page.tsx

import { useState, useEffect } from 'react'
import Loading from '../loading'
import { MEETINGS } from '@/lib/seed-data'
import {
  TopBar,
  PillGreen,
  PillRed,
  MeetingCard,
  FilterBar,
} from '@/components/ui'
import type { MeetingType } from '@/types'

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'planning', label: 'Planning' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'education', label: 'Education' },
]

export default function SessionsPage() {
  const [mounted, setMounted] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <Loading />

  const meetings = [...MEETINGS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const filtered = filter === 'all'
    ? meetings
    : meetings.filter(m => m.meeting_type === filter)

  return (
    <>
      <TopBar title="Sessions" subtitle="ActionCOACH">
        <PillGreen>Claude AI Active</PillGreen>
        <PillRed>6 Sessions</PillRed>
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
            {meetings.length} ActionCOACH coaching sessions recorded
          </p>
        </div>

        <FilterBar
          tabs={FILTER_TABS}
          active={filter}
          onSelect={setFilter}
          count={filtered.length}
        />

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
      </div>
    </>
  )
}
