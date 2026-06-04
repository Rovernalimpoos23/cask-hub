'use client'
// src/app/(app)/customers/[id]/meetings/[meetingId]/page.tsx

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionItemEntry {
  task: string
  owner: string
  due_date: string | null
}

interface RecapNotes {
  summary: string[]
  key_decisions: string[]
  action_items: ActionItemEntry[]
}

interface ClientMeetingData {
  id: string
  meeting_id: string
  title: string
  date: string | null
  recap: string | null
  notes: string | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingRecapPage({ params }: { params: { id: string; meetingId: string } }) {
  const [meeting, setMeeting]       = useState<ClientMeetingData | null | 'loading'>('loading')
  const [clientName, setClientName] = useState<string>('')
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: row }, { data: client }] = await Promise.all([
        supabase
          .from('client_meetings')
          .select('*')
          .eq('client_id', params.id)
          .eq('meeting_id', params.meetingId)
          .single(),
        supabase
          .from('clients')
          .select('name')
          .eq('id', params.id)
          .single(),
      ])

      setClientName(client?.name ?? '')
      setMeeting(row ? (row as ClientMeetingData) : null)
    }
    load()
  }, [params.id, params.meetingId])

  if (meeting === 'loading') {
    return (
      <>
        <TopBar title="Loading…" subtitle="Customer Journey" />
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
        <TopBar title="Not Found" subtitle="Customer Journey" />
        <div className="flex-1 overflow-y-auto p-7">
          <Link
            href={`/customers/${params.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
            style={{ color: 'var(--text3)' }}
          >
            ← {clientName ? `Back to ${clientName}` : 'Back to Client'}
          </Link>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Meeting recap not found.</p>
        </div>
      </>
    )
  }

  // Parse notes JSON, fall back to recap text
  let parsed: RecapNotes | null = null
  try {
    if (meeting.notes) parsed = JSON.parse(meeting.notes) as RecapNotes
  } catch { /* ignore malformed JSON */ }

  const summary      = parsed?.summary       ?? (meeting.recap ? [meeting.recap] : [])
  const keyDecisions = parsed?.key_decisions ?? []
  const actionItems  = parsed?.action_items  ?? []

  const formattedDate = meeting.date
    ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <>
      <TopBar title={meeting.title} subtitle="Customer Journey" />

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">

        {/* Back link */}
        <Link
          href={`/customers/${params.id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
          style={{ color: 'var(--text3)' }}
        >
          ← {clientName ? `Back to ${clientName}` : 'Back to Client'}
        </Link>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
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
            Customer Journey · CASK Construction
          </div>

          <h1 className="font-serif text-[24px] text-white mb-3 leading-[1.2] tracking-[-0.3px]">
            {meeting.title}
          </h1>

          <div className="flex gap-2 flex-wrap">
            {/* Meeting code badge */}
            <span
              className="text-[11px] font-mono font-bold px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {params.meetingId}
            </span>

            {/* Date */}
            {formattedDate && (
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
            )}
          </div>
        </div>

        {/* ── Summary + Key Decisions ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-3">

          {/* Summary */}
          <div className="rounded-lg p-5" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Session Summary
            </div>
            {summary.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {summary.map((point, i) => (
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
            {keyDecisions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {keyDecisions.map((d, i) => (
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

        {/* ── Action Items ──────────────────────────────────────────────── */}
        <div className="rounded-lg p-5 mb-3" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
          <div
            className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5 pb-2.5 flex items-center justify-between"
            style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
          >
            Action Items
            <span
              className="text-[11px] font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full"
              style={{
                background: actionItems.length > 0 ? 'var(--red-soft)' : 'var(--green-bg)',
                color: actionItems.length > 0 ? 'var(--red)' : 'var(--green)',
                border: `1px solid ${actionItems.length > 0 ? 'var(--red-border)' : '#bbf7d0'}`,
              }}
            >
              {actionItems.length} item{actionItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          {actionItems.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text3)' }}>No action items recorded.</p>
          ) : (
            <div className="flex flex-col gap-[5px]">
              {actionItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-[6px] px-4 py-3 flex items-start gap-3"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
                >
                  <div
                    className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: 'var(--border2)', background: 'var(--surface)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium m-0" style={{ color: 'var(--text)' }}>
                      {item.task}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                        {item.owner}
                      </span>
                      {item.due_date && (
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: 'var(--amber, #92400e)' }}
                        >
                          Due {item.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Full Transcript (collapsible) ─────────────────────────────── */}
        {meeting.recap && (
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
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
              <span className="text-[10px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--text3)' }}>
                Full Recap
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
                <pre className="text-[12px] leading-[1.9] font-mono whitespace-pre-wrap" style={{ color: 'var(--text2)' }}>
                  {meeting.recap}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}
