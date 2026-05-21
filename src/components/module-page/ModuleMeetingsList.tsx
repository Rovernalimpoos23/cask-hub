'use client'
// Shared layout for module-filtered meeting pages

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { TopBar, MeetingCard } from '@/components/ui'
import { fetchMeetingsByModule } from '@/lib/meetings-client'
import type { Meeting } from '@/types'

interface Props {
  topBarTitle: string
  topBarSubtitle: string
  heading: string
  module: string
}

export default function ModuleMeetingsList({ topBarTitle, topBarSubtitle, heading, module }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMeetingsByModule(module).then(data => {
      setMeetings(data)
      setLoading(false)
    })
  }, [module])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={topBarTitle} subtitle={topBarSubtitle}>
        <Link
          href="/sessions/new"
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
            textDecoration: 'none',
            fontFamily: 'inherit',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.82' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
          Add Meeting
        </Link>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            {heading}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            {loading ? 'Loading…' : `${meetings.length} session${meetings.length !== 1 ? 's' : ''} recorded`}
          </p>
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
        ) : meetings.length === 0 ? (
          <div
            className="rounded-[10px] p-10 flex flex-col items-center gap-4 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text3)' }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="4" x2="9" y2="9"/>
                <line x1="15" y1="4" x2="15" y2="9"/>
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text)' }}>
                No meetings yet
              </p>
              <p className="text-[13px]" style={{ color: 'var(--text3)' }}>
                Click <strong>Add Meeting</strong> to get started.
              </p>
            </div>
            <Link
              href="/sessions/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'var(--charcoal)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontFamily: 'inherit',
                marginTop: '4px',
              }}
            >
              <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
              Add Meeting
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {meetings.map(m => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
