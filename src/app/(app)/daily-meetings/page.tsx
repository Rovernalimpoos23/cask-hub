'use client'
// src/app/(app)/daily-meetings/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TopBar,
  PillGreen,
  PillRed,
  MeetingCard,
} from '@/components/ui'
import { fetchAllMeetings } from '@/lib/meetings-client'
import type { Meeting } from '@/types'

// Filter tabs — matched case-insensitively against the meeting title.
const FILTERS: { value: string; label: string; match: (title: string) => boolean }[] = [
  { value: 'all',         label: 'All',         match: () => true },
  { value: 'kai',         label: 'Kai',         match: t => t.includes('kai') },
  { value: 'joseph',      label: 'Joseph',      match: t => t.includes('joseph') },
  { value: 'leadership',  label: 'Leadership',  match: t => t.includes('leadership') },
  { value: 'department',  label: 'Department',  match: t => t.includes('department') || t.includes('alignment') },
  { value: 'pit',         label: 'PIT',         match: t => t.includes('pit') },
  { value: 'actioncoach', label: 'ActionCoach', match: t => t.includes('actioncoach') || t.includes('coach') },
  { value: 'operations',  label: 'Operations',  match: t => t.includes('pre-con') || t.includes('construction') || t.includes('operations') || t.includes('preconstruction') },
  { value: 'sales',       label: 'Sales',       match: t => t.includes('sales') || t.includes('huddle') },
]

export default function DailyMeetingsPage() {
  const router = useRouter()
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
    const handler = () => { loadMeetings(); router.refresh() }
    window.addEventListener('cask-meeting-saved', handler)
    return () => window.removeEventListener('cask-meeting-saved', handler)
  }, [loadMeetings, router])

  const activeFilter = FILTERS.find(f => f.value === filter) ?? FILTERS[0]
  const filtered = meetings.filter(m => activeFilter.match(m.title.toLowerCase()))

  return (
    <>
      <TopBar title="Daily Meetings" subtitle="President's Workflow">
        <PillGreen>Claude AI Active</PillGreen>
        <PillRed>{meetings.length} meetings recorded</PillRed>
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
            Daily Meetings
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            {loading
              ? 'Loading…'
              : `All CASK Construction recorded meetings · ${meetings.length} meetings recorded`}
          </p>
        </div>

        {/* Filter tabs — replicates the app FilterBar style (charcoal-filled active),
            with per-tab count badges, an outline on inactive tabs, and wrapping. */}
        <div
          className="flex flex-wrap gap-1.5 mb-4 pb-3 items-center"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.value
            const n = f.value === 'all'
              ? meetings.length
              : meetings.filter(m => f.match(m.title.toLowerCase())).length
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="text-[12px] font-medium px-3 py-[5px] rounded-[5px] transition-all duration-150"
                style={{
                  background: isActive ? 'var(--charcoal)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text3)',
                  border: isActive ? '1px solid var(--charcoal)' : '1px solid var(--border)',
                  fontFamily: 'var(--font-geist), sans-serif',
                  cursor: 'pointer',
                }}
              >
                {f.label} ({n})
              </button>
            )
          })}
        </div>

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
                No meetings found for this filter.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
