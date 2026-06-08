'use client'
// src/app/(app)/sessions/[id]/page.tsx

import Link from 'next/link'
import { MeetingTypeTag, ActionItemRow, TopBar } from '@/components/ui'
import { useState, useEffect } from 'react'
import { fetchMeetingById } from '@/lib/meetings-client'
import { createClient } from '@/lib/supabase'
import type { Meeting, ActionItem } from '@/types'

function BackLink() {
  return (
    <Link
      href="/sessions"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
      style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
    >
      ← Back to Sessions
    </Link>
  )
}

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [actionItemsLoading, setActionItemsLoading] = useState(true)

  useEffect(() => {
    fetchMeetingById(params.id).then(data => {
      setMeeting(data)
      setLoading(false)
    })
  }, [params.id])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', params.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setActionItems((data ?? []) as ActionItem[])
        setActionItemsLoading(false)
      })
  }, [params.id])

  async function handleToggle(id: string, done: boolean) {
    setActionItems(prev => prev.map(item => item.id === id ? { ...item, done } : item))
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update({ done })
      .eq('id', id)
    if (error) console.error('[session] toggle persist failed:', error)
  }

  if (loading) {
    return (
      <>
        <TopBar title="Session Detail" subtitle="Loading…" />
        <div className="flex-1 overflow-y-auto p-7">
          <div className="rounded-[10px] h-[120px] shimmer mb-3" style={{ border: '1px solid var(--border)' }} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
            <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
          </div>
        </div>
      </>
    )
  }

  if (!meeting) {
    return (
      <>
        <TopBar title="Not Found" subtitle="Session Detail" />
        <div className="flex-1 overflow-y-auto p-7">
          <BackLink />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Session not found.</p>
        </div>
      </>
    )
  }

  const date = new Date(meeting.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const openActions = actionItems.filter(a => !a.done)

  return (
    <>
      <TopBar title={meeting.title} subtitle="Session Detail" />

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <BackLink />

        {/* Hero */}
        <div
          className="rounded-[10px] p-7 mb-3.5 relative overflow-hidden"
          style={{ background: 'var(--charcoal)' }}
        >
          <div
            className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          />
          <div
            className="text-[10px] font-semibold tracking-[2px] uppercase mb-2.5"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            General Meetings · CASK Construction
          </div>
          <h1 className="font-serif text-[24px] text-white mb-3 leading-[1.2] tracking-[-0.3px]">
            {meeting.title}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <MeetingTypeTag type={meeting.meeting_type} />
            <span
              className="text-[11px] px-3 py-1 rounded-full"
              style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {formattedDate}
            </span>
            {meeting.time_start && (
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {meeting.time_start} – {meeting.time_end}
              </span>
            )}
            {meeting.attendees.length > 0 && (
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {meeting.attendees.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Summary */}
          <div className="rounded-lg p-5" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Session Summary
            </div>
            {meeting.summary.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {meeting.summary.map((point, i) => (
                  <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                    <span className="shrink-0 mt-1 text-[8px]" style={{ color: 'var(--text3)' }}>●</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No summary recorded.</p>
            )}
          </div>

          {/* Key Decisions */}
          <div className="rounded-lg p-5" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Key Decisions
            </div>
            {meeting.key_decisions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {meeting.key_decisions.map((d, i) => (
                  <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--red)' }}>✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No key decisions recorded.</p>
            )}
          </div>
        </div>

        {/* Action Items */}
        <div className="rounded-lg p-5 mb-3" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
          <div
            className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5 flex items-center justify-between"
            style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
          >
            Action Items
            <span
              className="text-[11px] font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full"
              style={{
                background: openActions.length > 0 ? 'var(--red-soft)' : 'var(--green-bg)',
                color: openActions.length > 0 ? 'var(--red)' : 'var(--green)',
                border: `1px solid ${openActions.length > 0 ? 'var(--red-border)' : '#bbf7d0'}`,
              }}
            >
              {openActions.length} open
            </span>
          </div>
          <div className="flex flex-col gap-[5px]">
            {actionItemsLoading ? (
              [0, 1, 2].map(i => (
                <div key={i} className="rounded-[6px] h-[56px] shimmer" style={{ border: '1px solid var(--border)' }} />
              ))
            ) : actionItems.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No action items recorded.</p>
            ) : (
              actionItems.map(item => (
                <ActionItemRow key={item.id} item={item} onToggle={handleToggle} />
              ))
            )}
          </div>
        </div>

        {/* Transcript */}
        {meeting.full_transcript && (
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--surface2)]"
              style={{ borderBottom: transcriptExpanded ? '1px solid var(--border)' : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span className="text-[10px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--text3)' }}>
                Full Transcript
              </span>
              <span
                className="text-[11px] font-medium transition-transform duration-200"
                style={{ color: 'var(--text3)', transform: transcriptExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
              >
                ▾
              </span>
            </button>
            {transcriptExpanded && (
              <div className="p-5">
                <pre className="text-[12px] leading-[1.9] font-mono whitespace-pre-wrap" style={{ color: 'var(--text2)' }}>
                  {meeting.full_transcript}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
