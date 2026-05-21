'use client'
// src/app/(app)/sessions/[id]/page.tsx

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MEETINGS } from '@/lib/seed-data'
import { MeetingTypeTag, ActionItemRow, TopBar } from '@/components/ui'
import { useState } from 'react'

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
  const meeting = MEETINGS.find(m => m.id === params.id)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)

  if (!meeting) notFound()

  const date = new Date(meeting.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const openActions = meeting.action_items.filter(a => !a.done)
  const completedActions = meeting.action_items.filter(a => a.done)

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
          {/* Decorative circle */}
          <div
            className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          />

          <div
            className="text-[10px] font-semibold tracking-[2px] uppercase mb-2.5"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            ActionCOACH · CASK Construction
          </div>

          <h1
            className="font-serif text-[24px] text-white mb-3 leading-[1.2] tracking-[-0.3px]"
          >
            {meeting.title}
          </h1>

          <div className="flex gap-2 flex-wrap">
            <MeetingTypeTag type={meeting.meeting_type} />
            <span
              className="text-[11px] px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {formattedDate}
            </span>
            {meeting.time_start && (
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {meeting.time_start} – {meeting.time_end}
              </span>
            )}
            <span
              className="text-[11px] px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {meeting.attendees.join(', ')}
            </span>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Summary */}
          <div
            className="rounded-lg p-5"
            style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{
                color: 'var(--text3)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              Session Summary
            </div>
            <ul className="flex flex-col gap-3">
              {meeting.summary.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                  <span className="shrink-0 mt-1 text-[8px]" style={{ color: 'var(--text3)' }}>●</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Decisions */}
          <div
            className="rounded-lg p-5"
            style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{
                color: 'var(--text3)',
                borderBottom: '1px solid var(--border)',
              }}
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
        <div
          className="rounded-lg p-5 mb-3"
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5 flex items-center justify-between"
            style={{
              color: 'var(--text3)',
              borderBottom: '1px solid var(--border)',
            }}
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
            {meeting.action_items.map(item => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Transcript (expandable) */}
        {meeting.full_transcript && (
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--surface2)]"
              style={{
                borderBottom: transcriptExpanded ? '1px solid var(--border)' : 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span
                className="text-[10px] font-semibold tracking-[1.5px] uppercase"
                style={{ color: 'var(--text3)' }}
              >
                Full Transcript
              </span>
              <span
                className="text-[11px] font-medium transition-transform duration-200"
                style={{
                  color: 'var(--text3)',
                  transform: transcriptExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}
              >
                ▾
              </span>
            </button>
            {transcriptExpanded && (
              <div className="p-5">
                <pre
                  className="text-[12px] leading-[1.9] font-mono whitespace-pre-wrap"
                  style={{ color: 'var(--text2)' }}
                >
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
