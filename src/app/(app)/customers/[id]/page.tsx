'use client'
// src/app/(app)/customers/[id]/page.tsx

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import 'react-quill/dist/quill.snow.css'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { AGENDAS, NPS_QUESTIONS, type AgendaContent, type AgendaItem, type AgendaSection } from '../_agendaData'

// ReactQuill must load client-side only — Quill references `document` at import time,
// which would crash Next.js server rendering of this client component.
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

// ── Types ────────────────────────────────────────────────────────────────────

type Happiness = 'green' | 'yellow' | 'red'
type PriorityStatus = 'done' | 'in_progress' | 'unresolved'
type MeetingType = 'meeting' | 'email' | 'internal'

interface Priority {
  text: string
  status: PriorityStatus
}

interface ClientData {
  id: string
  name: string
  initials: string
  project_type: string
  project_value: number
  location: string
  start_date: string
  happiness: Happiness
  owner: string
  personality_tags: string[]
  communication_style: string
  key_interests: string
  ai_tip: string
  priorities: Priority[]
}

interface ClientMeetingRow {
  id: string
  client_id: string
  meeting_id: string
  title: string
  phase_number: number
  completed: boolean
  completed_at?: string | null
  recap?: string | null
  notes?: string | null
  date?: string | null
  teams_link?: string | null
}


interface EmailDraft {
  id: string
  client_id: string
  meeting_id: string
  email_code: string
  subject: string
  body: string
  status: 'draft' | 'sent'
  recipient_email: string | null
  recipient_name: string
  created_at: string
  sent_at?: string | null
}

interface JourneyMeetingDef {
  code: string
  title: string
  type: MeetingType
}

interface JourneyPhaseDef {
  number: number
  label: string
  color: string
  bgColor: string
  borderColor: string
  meetings: JourneyMeetingDef[]
}

// ── Journey phases (mirrors Client Templates exactly) ─────────────────────────

const JOURNEY_PHASES: JourneyPhaseDef[] = [
  {
    number: 1,
    label: 'Pre-Construction Pre-Design',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    meetings: [
      { code: 'PR1m', title: 'Internal Sales to Pre-Con Pass-Off', type: 'meeting' },
      { code: 'PR2e', title: 'Initial Alignment Scheduling to Customer', type: 'email' },
      { code: 'PR3m', title: 'Initial Alignment Meeting Agenda', type: 'meeting' },
      { code: 'PR4e', title: 'Alignment Meeting Recap to Customer', type: 'email' },
      { code: 'PR5m', title: 'On Site Flag with Customer', type: 'meeting' },
      { code: 'PR6e', title: 'Flag Meeting Recap to Customer', type: 'email' },
    ],
  },
  {
    number: 2,
    label: 'Pre-Construction Design',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    meetings: [
      { code: 'PD1m', title: '50% Floor Plan with Customer', type: 'meeting' },
      { code: 'PD2e', title: '50% Floorplan Meeting Recap to Customer', type: 'email' },
      { code: 'PD3e', title: '50% Budget Update to Customer', type: 'email' },
      { code: 'PD4m', title: '75% Floor Plan with Customer', type: 'meeting' },
      { code: 'PD5e', title: '75% Floorplan Meeting Recap to Customer', type: 'email' },
      { code: 'PD6e', title: '75% Budget Update to Customer', type: 'email' },
      { code: 'PD7e', title: '95% Drawing to Customer', type: 'email' },
      { code: 'PD8e', title: 'Permit Submission Confirmation', type: 'email' },
    ],
  },
  {
    number: 3,
    label: 'Pre-Construction Permit',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    meetings: [
      { code: 'PP1e', title: '1st RFC to Customer', type: 'email' },
      { code: 'PP2e', title: '1st RFC Resubmittal to Customer', type: 'email' },
      { code: 'PP3e', title: '2nd RFC to Customer', type: 'email' },
      { code: 'PP4e', title: '2nd RFC Resubmittal to Customer', type: 'email' },
      { code: 'PP5e', title: 'Permit Approval', type: 'email' },
    ],
  },
  {
    number: 4,
    label: 'Pre-Construction Selections',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    meetings: [
      { code: 'PS1e', title: 'Selections Kick-off to Customer', type: 'email' },
      { code: 'PS2m', title: 'In-Person 1st Selections with Customer', type: 'meeting' },
      { code: 'PS3e', title: 'Post 1st Selections Meeting to Customer', type: 'email' },
      { code: 'PS4m', title: 'In-Person 2nd Selections with Customer', type: 'meeting' },
      { code: 'PS5e', title: 'Post 2nd Selections Meeting to Customer', type: 'email' },
      { code: 'PS6m', title: 'In-Person 3rd Selections with Customer', type: 'meeting' },
      { code: 'PS7e', title: 'Post 3rd Selections Meeting to Customer', type: 'email' },
      { code: 'PS8m', title: 'In-Person 4th Selections with Customer', type: 'meeting' },
      { code: 'PS9e', title: 'Post 4th Selections Meeting to Customer', type: 'email' },
    ],
  },
  {
    number: 5,
    label: 'Pre-Construction Bid Management',
    color: '#c8311a',
    bgColor: '#fdf2f0',
    borderColor: '#f5c9c2',
    meetings: [
      { code: 'PB1e', title: 'Sewage and Water Inspection to Customer', type: 'email' },
      { code: 'PB2m', title: 'In-Person Sewage and Water Inspection', type: 'meeting' },
      { code: 'PB3e', title: 'Congratulations Project Out to Bid', type: 'email' },
      { code: 'PB4e', title: '95% Budget Update to Customer', type: 'email' },
      { code: 'PB5m', title: 'Contract Review with Customer', type: 'meeting' },
      { code: 'PB6e', title: 'Contract Approval to Customer', type: 'email' },
    ],
  },
  {
    number: 6,
    label: 'Construction Groundbreaking',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    meetings: [
      { code: 'CG1m', title: 'Kickoff with Customer', type: 'meeting' },
      { code: 'CG2.a', title: 'Demo If Needed (Internal)', type: 'internal' },
      { code: 'CG2.b', title: 'Site Survey Layout (Internal)', type: 'internal' },
      { code: 'CG2e', title: 'Kickoff Meeting Recap to Customer', type: 'email' },
      { code: 'CG3.a', title: 'Internal Sub Meeting (Internal)', type: 'internal' },
      { code: 'CG3m', title: 'Foundation and Slab On Grade with Customer', type: 'meeting' },
      { code: 'CG4e', title: 'Foundation and Slab On Grade Meeting Recap', type: 'email' },
    ],
  },
  {
    number: 7,
    label: 'Construction Structure',
    color: '#6366f1',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe',
    meetings: [
      { code: 'CS1e', title: 'Structure Stage Expectations Recap to Customer', type: 'email' },
      { code: 'CS2m', title: 'Structure Complete Celebration with Customer', type: 'meeting' },
      { code: 'CS3e', title: 'Structure Complete Celebration Meeting Recap with Customer', type: 'email' },
    ],
  },
  {
    number: 8,
    label: 'Construction Rough In',
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    meetings: [
      { code: 'CR1.a', title: 'Internal Sub Meeting (Internal)', type: 'internal' },
      { code: 'CR1m', title: 'Rough In with Customer', type: 'meeting' },
      { code: 'CR2e', title: 'Release to Hang to Customer', type: 'email' },
    ],
  },
  {
    number: 9,
    label: 'Construction Finish',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
    meetings: [
      { code: 'CF1.a', title: 'Internal Sub Meeting (Internal)', type: 'internal' },
      { code: 'CF1m', title: 'Finishes with Customer', type: 'meeting' },
      { code: 'CF2e', title: 'Finish Meeting Recap to Customer', type: 'email' },
    ],
  },
  {
    number: 10,
    label: 'Construction Closeout',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    meetings: [
      { code: 'CC1e', title: 'Close Out Steps to Customer', type: 'email' },
      { code: 'CC1e.1', title: 'Certificate of Occupancy to Customer', type: 'email' },
      { code: 'CC2m', title: 'Punchlist Walkthrough with Customer', type: 'meeting' },
      { code: 'CC3e', title: 'Punch List Walkthrough Meeting Recap to Customer', type: 'email' },
      { code: 'CC4m', title: 'Final Walkthrough with Customer', type: 'meeting' },
    ],
  },
]

const TOTAL_MEETINGS = JOURNEY_PHASES.reduce((sum, p) => sum + p.meetings.length, 0)

// ── Config ────────────────────────────────────────────────────────────────────

const HAPPINESS = {
  green: { bg: '#F0FDF4', color: '#166534', label: 'Happy', accent: '#16a34a' },
  yellow: { bg: '#FFFBEB', color: '#92400E', label: 'At Risk', accent: '#d97706' },
  red: { bg: '#FDF2F0', color: '#9B1C0E', label: 'Needs Attention', accent: '#dc2626' },
}

const PRIORITY_CONFIG: Record<PriorityStatus, { dot: string; color: string; strike: boolean }> = {
  done: { dot: '#16a34a', color: '#16a34a', strike: true },
  in_progress: { dot: '#d97706', color: '#d97706', strike: false },
  unresolved: { dot: '#dc2626', color: '#dc2626', strike: false },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return '$' + v.toLocaleString('en-US')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/customers"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
      style={{ color: 'var(--text3)' }}
    >
      ← Active Clients
    </Link>
  )
}

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ fontSize: 14, opacity: 0.6 }}>{icon}</span>
      <span
        className="text-[11px] font-semibold tracking-[1.2px] uppercase"
        style={{ color: 'var(--text3)' }}
      >
        {children}
      </span>
    </div>
  )
}

function buildGreeting(client: ClientData, journeyRows: Map<string, ClientMeetingRow>): string {
  const completedCount = Array.from(journeyRows.values()).filter(r => r.completed).length
  for (const phase of JOURNEY_PHASES) {
    const allDone = phase.meetings.every(m => journeyRows.get(m.code)?.completed)
    if (!allDone) {
      return `Hey! I have full context on ${client.name}. They're in Phase ${phase.number} — ${phase.label}, ${completedCount} of ${TOTAL_MEETINGS} meetings completed. How can I help?`
    }
  }
  return `Hey! I have full context on ${client.name}. All ${TOTAL_MEETINGS} meetings completed — journey finished! How can I help?`
}

function IntelligencePanel({ client, journeyRows, messages, onSend, onClear }: {
  client: ClientData
  journeyRows: Map<string, ClientMeetingRow>
  messages: { role: 'user' | 'assistant'; content: string }[]
  onSend: (msg: string) => void
  onClear: () => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const greeting = buildGreeting(client, journeyRows)

  // Keep the latest message in view by scrolling the chat's OWN container only.
  // Using scrollTop (not scrollIntoView) means this never bubbles up to scroll
  // the page — so restoring persistent history on mount won't jump the page down.
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    await onSend(text)
    setSending(false)
  }

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'var(--charcoal)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: 'var(--red, #c8311a)', boxShadow: '0 0 6px rgba(200,49,26,0.6)' }}
            />
            <span
              className="text-[12px] font-semibold tracking-[0.8px] uppercase"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              CASK Intelligence — {client.name} context
            </span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] font-medium px-2 py-1 rounded-[4px] transition-opacity"
            style={{
              color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="px-5 py-4 flex flex-col gap-3" style={{ minHeight: 120, maxHeight: 420, overflowY: 'auto' }}>
        <div className="flex justify-start">
          <div
            className="text-[12px] leading-relaxed px-3.5 py-2.5 max-w-[88%]"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: '2px 10px 10px 10px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {greeting}
          </div>
        </div>

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div
                className="text-[12px] leading-relaxed px-3.5 py-2.5 max-w-[88%]"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.9)',
                  borderRadius: '10px 10px 2px 10px',
                }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div
                className="text-[12px] leading-relaxed px-3.5 py-2.5 max-w-[88%] ai-bubble"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.8)',
                  borderRadius: '2px 10px 10px 10px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 6, marginTop: 4 }}>{children}</div>,
                    h2: ({ children }) => <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 5, marginTop: 4 }}>{children}</div>,
                    h3: ({ children }) => <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 12, marginBottom: 4, marginTop: 3 }}>{children}</div>,
                    strong: ({ children }) => <strong style={{ color: '#fff', fontWeight: 600 }}>{children}</strong>,
                    em: ({ children }) => <em style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{children}</em>,
                    p: ({ children }) => <p style={{ margin: '0 0 6px', lineHeight: 1.6 }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ margin: '4px 0 6px', paddingLeft: 16, listStyleType: 'disc' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: '4px 0 6px', paddingLeft: 16 }}>{children}</ol>,
                    li: ({ children }) => <li style={{ margin: '2px 0', color: 'rgba(255,255,255,0.8)', lineHeight: 1.55 }}>{children}</li>,
                    a: ({ children, href }) => <a href={href} style={{ color: '#c8311a', textDecoration: 'underline' }}>{children}</a>,
                    code: ({ children }) => <code style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace' }}>{children}</code>,
                    hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px 0' }} />,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          )
        )}

        {sending && (
          <div className="flex justify-start">
            <div
              className="text-[11px] px-3.5 py-2.5"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.4)',
                borderRadius: '2px 10px 10px 10px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Thinking…
            </div>
          </div>
        )}

      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 pb-4">
        <div
          className="flex items-center gap-2 rounded-[8px] px-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Ask about ${client.name}…`}
            disabled={sending}
            tabIndex={-1}
            className="flex-1 bg-transparent border-none outline-none py-2.5 text-[12px]"
            style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'inherit' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
            style={{
              background: 'var(--red, #c8311a)',
              color: '#fff',
              opacity: !input.trim() || sending ? 0.4 : 1,
              border: 'none',
              cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Agenda / Email modal ──────────────────────────────────────────────────────

function AgendaModal({ code, onClose }: { code: string; onClose: () => void }) {
  const agenda = AGENDAS[code]
  const close = useCallback(onClose, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  if (!agenda) return null

  function renderItem(item: string | AgendaItem, index: number, numbered?: boolean) {
    const isObj = typeof item === 'object'
    const text = isObj ? item.text : item
    const sub = isObj ? item.sub : undefined
    const marker = numbered ? `${index + 1}.` : '•'

    return (
      <li key={index} style={{ marginBottom: sub?.length ? 8 : 5, listStyle: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: 'var(--red, #c8311a)', fontWeight: 600, fontSize: 12, flexShrink: 0, minWidth: 16 }}>{marker}</span>
          <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
        </div>
        {sub?.length ? (
          <ul style={{ margin: '5px 0 0 24px', padding: 0 }}>
            {sub.map((s, si) => (
              <li key={si} style={{ listStyle: 'none', marginBottom: 3, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>›</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600, maxHeight: '80vh',
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif, Georgia, serif)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.2px' }}>
              {agenda.header}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
              {agenda.subheader}
            </p>
          </div>
          <button
            onClick={close}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {agenda.sections.map((section: AgendaSection, si: number) => (
            <div key={si} style={{ marginBottom: 22 }}>
              {section.title && (
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', textTransform: 'uppercase', color: 'var(--red, #c8311a)', marginBottom: 10 }}>
                  {section.title}
                </div>
              )}
              <ul style={{ margin: 0, padding: 0 }}>
                {section.items.map((item, ii) => renderItem(item, ii, section.numbered))}
              </ul>
            </div>
          ))}

          {agenda.nps && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 20px' }} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', textTransform: 'uppercase', color: 'var(--red, #c8311a)', marginBottom: 10 }}>
                NPS SURVEY
              </div>
              <ul style={{ margin: 0, padding: 0 }}>
                {NPS_QUESTIONS.map((q, qi) => (
                  <li key={qi} style={{ listStyle: 'none', marginBottom: 5, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--red, #c8311a)', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>•</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            CASK Construction · caskconstruction.com · 727-201-2551
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Journey phase card ────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  journeyRows,
  markingIds,
  onMarkComplete,
  onOpenRecap,
  onViewAgenda,
  sentEmailsByCode,
  onViewSentEmail,
}: {
  phase: JourneyPhaseDef
  journeyRows: Map<string, ClientMeetingRow>
  markingIds: Set<string>
  onMarkComplete: (code: string, phaseNumber: number, title: string) => void
  onOpenRecap: (code: string, title: string) => void
  onViewAgenda: (code: string) => void
  sentEmailsByCode: Map<string, EmailDraft>
  onViewSentEmail: (draft: EmailDraft) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const completedInPhase = phase.meetings.filter(m => journeyRows.get(m.code)?.completed).length

  return (
    <div
      style={{
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${phase.color}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--surface, #fff)',
      }}
    >
      {/* Phase header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: expanded ? phase.bgColor : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 150ms ease',
          fontFamily: 'inherit',
        }}
      >
        {/* Phase number badge */}
        <span
          className="text-[10px] font-bold shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: phase.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
          }}
        >
          {phase.number}
        </span>

        {/* Label */}
        <span
          className="text-[13px] font-semibold flex-1 text-left"
          style={{ color: 'var(--text)' }}
        >
          {phase.label}
        </span>

        {/* Progress pill */}
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: completedInPhase === phase.meetings.length ? '#f0fdf4' : phase.bgColor,
            color: completedInPhase === phase.meetings.length ? '#16a34a' : phase.color,
            border: `1px solid ${completedInPhase === phase.meetings.length ? '#bbf7d0' : phase.borderColor}`,
          }}
        >
          {completedInPhase}/{phase.meetings.length}
        </span>

        {/* Chevron */}
        <span
          style={{
            color: 'var(--text3)',
            fontSize: 11,
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* Meetings list */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${phase.borderColor}` }}>
          {phase.meetings.map((meeting, i) => {
            const row = journeyRows.get(meeting.code)
            const isCompleted = row?.completed ?? false
            const isMarking = markingIds.has(meeting.code)
            const hasRecap = !!(row?.recap)
            const sentEmail = meeting.type === 'email' ? sentEmailsByCode.get(meeting.code) : undefined

            return (
              <div
                key={meeting.code}
                style={{
                  borderTop: i > 0 ? `1px solid var(--border)` : 'none',
                  background: isCompleted ? '#fafaf9' : 'var(--surface, #fff)',
                  transition: 'background 150ms ease',
                }}
              >
                {/* Main meeting row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Code badge */}
                  <span
                    className="text-[10px] font-mono font-bold shrink-0"
                    style={{
                      background: isCompleted ? '#f0fdf4' : phase.bgColor,
                      color: isCompleted ? '#16a34a' : phase.color,
                      border: `1px solid ${isCompleted ? '#bbf7d0' : phase.borderColor}`,
                      padding: '2px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.3px',
                      minWidth: 48,
                      textAlign: 'center',
                    }}
                  >
                    {meeting.code}
                  </span>

                  {/* Title */}
                  <span
                    className="text-[12px] flex-1"
                    style={{
                      color: isCompleted ? 'var(--text3)' : 'var(--text2)',
                      fontWeight: isCompleted ? 400 : 500,
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      minWidth: 140,
                    }}
                  >
                    {meeting.title}
                  </span>

                  {/* Action buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* View Agenda — shown for meeting/internal types with content */}
                    {meeting.type !== 'email' && AGENDAS[meeting.code] && (
                      <button
                        type="button"
                        onClick={() => onViewAgenda(meeting.code)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          color: phase.color,
                          background: phase.bgColor,
                          border: `1px solid ${phase.borderColor}`,
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'opacity 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                      >
                        📋 View Agenda
                      </button>
                    )}

                    {/* View Email — always shown for email types, regardless of sent/complete status */}
                    {meeting.type === 'email' && AGENDAS[meeting.code] && (
                      <button
                        type="button"
                        onClick={() => onViewAgenda(meeting.code)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#92400e',
                          background: '#fef3c7',
                          border: '1px solid #fde68a',
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'opacity 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                      >
                        📧 View Email
                      </button>
                    )}

                    {/* Email Sent badge + View — replaces View Email + Mark Complete */}
                    {sentEmail && (
                      <>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#166534',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            padding: '3px 8px',
                            borderRadius: 5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ✅ Email Sent
                        </span>
                        <button
                          type="button"
                          onClick={() => onViewSentEmail(sentEmail)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#166534',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            padding: '3px 8px',
                            borderRadius: 5,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'opacity 120ms ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                        >
                          View →
                        </button>
                      </>
                    )}

                    {/* Mark Complete / Done — hidden when email is sent */}
                    {!sentEmail && (
                      <button
                        type="button"
                        onClick={() => onMarkComplete(meeting.code, phase.number, meeting.title)}
                        disabled={isMarking}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: isCompleted ? '#16a34a' : 'var(--text2)',
                          background: isCompleted ? '#f0fdf4' : 'var(--surface2, #f4f3f1)',
                          border: `1px solid ${isCompleted ? '#bbf7d0' : 'var(--border)'}`,
                          padding: '3px 8px',
                          borderRadius: 5,
                          cursor: isMarking ? 'not-allowed' : 'pointer',
                          opacity: isMarking ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                          fontFamily: 'inherit',
                          transition: 'all 120ms ease',
                        }}
                      >
                        {isMarking ? '…' : isCompleted ? '✅ Done' : '✅ Mark Complete'}
                      </button>
                    )}

                    {/* View Recap — shown when recap exists */}
                    {hasRecap && (
                      <button
                        type="button"
                        onClick={() => onOpenRecap(meeting.code, meeting.title)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text2)',
                          background: 'var(--surface2, #f4f3f1)',
                          border: '1px solid var(--border)',
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'border-color 120ms ease, color 120ms ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--border2)'
                          e.currentTarget.style.color = 'var(--text)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text2)'
                        }}
                      >
                        🎙️ View Recap
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [client, setClient] = useState<ClientData | null | 'loading'>('loading')
  const [journeyRows, setJourneyRows] = useState<Map<string, ClientMeetingRow>>(new Map())
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set())
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [userEmail, setUserEmail] = useState('')
  const userEmailRef = useRef('')
  const [activeAgenda, setActiveAgenda] = useState<string | null>(null)
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([])
  const [sentEmails, setSentEmails] = useState<EmailDraft[]>([])
  const [previewDraft, setPreviewDraft] = useState<EmailDraft | null>(null)
  const [editDraft, setEditDraft] = useState<EmailDraft | null>(null)
  const [editBody, setEditBody] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [confirmSendDraft, setConfirmSendDraft] = useState<EmailDraft | null>(null)
  const [viewSentEmail, setViewSentEmail] = useState<EmailDraft | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    const parent = document.querySelector('main')
    if (parent) parent.scrollTop = 0
    const scrollContainers = document.querySelectorAll('.overflow-y-auto')
    scrollContainers.forEach(el => { (el as HTMLElement).scrollTop = 0 })
  }, [])

  useEffect(() => {
    async function fetchUserAndHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      const email = user.email
      setUserEmail(email)
      userEmailRef.current = email

      const pageContext = `customer-${params.id}`
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', email)
        .eq('page_context', pageContext)
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setChatMessages(history as { role: 'user' | 'assistant'; content: string }[])
      }
    }
    fetchUserAndHistory()
  }, [params.id])

  useEffect(() => {
    async function fetchEmailDrafts() {
      const supabase = createClient()
      console.log('[email-drafts] fetching for client_id:', params.id)
      const { data, error } = await supabase
        .from('client_email_drafts')
        .select('*')
        .eq('client_id', params.id)
        .order('created_at', { ascending: false })
      console.log('[email-drafts] fetched:', data, 'error:', error)
      if (data) {
        const all = data as EmailDraft[]
        setEmailDrafts(all.filter(d => d.status === 'draft'))
        setSentEmails(all.filter(d => d.status === 'sent'))
      }
    }
    fetchEmailDrafts()
  }, [params.id])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    async function fetchClient() {
      const supabase = createClient()

      const { data: row, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !row) {
        setClient(null)
        return
      }

      const [{ data: priorityRows }, { data: meetingRows }] = await Promise.all([
        supabase.from('client_priorities').select('*').eq('client_id', params.id),
        supabase.from('client_meetings').select('*').eq('client_id', params.id),
      ])

      const priorities: Priority[] = (priorityRows ?? []).map((p: Record<string, string>) => ({
        text: p.text,
        status: (p.status as PriorityStatus) ?? 'unresolved',
      }))

      // Build meeting rows map keyed by meeting_id
      const rowsMap = new Map<string, ClientMeetingRow>()
      for (const m of (meetingRows ?? []) as ClientMeetingRow[]) {
        if (m.meeting_id) rowsMap.set(m.meeting_id, m)
      }
      setJourneyRows(rowsMap)

      const happiness: Happiness =
        row.happiness === 'yellow' || row.happiness === 'red' ? row.happiness : 'green'

      setClient({
        id: row.id,
        name: row.name,
        initials: getInitials(row.name),
        project_type: row.project_type ?? '',
        project_value: row.project_value ?? 0,
        location: row.location ?? '',
        start_date: row.start_date ?? '',
        happiness,
        owner: row.owner ?? '',
        personality_tags: Array.isArray(row.personality_tags) ? row.personality_tags : [],
        communication_style: row.communication_style ?? 'No communication style added yet.',
        key_interests: row.key_interests ?? 'No interests added yet.',
        ai_tip: row.ai_tip ?? 'Add personality details to get AI communication tips.',
        priorities,
      })
    }

    fetchClient()
  }, [params.id])

  async function markComplete(meetingCode: string, phaseNumber: number, title: string) {
    setMarkingIds(prev => new Set(prev).add(meetingCode))

    try {
      const supabase = createClient()
      const existing = journeyRows.get(meetingCode)

      if (existing) {
        const newCompleted = !existing.completed
        const { error } = await supabase
          .from('client_meetings')
          .update({
            completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : null,
          })
          .eq('id', existing.id)

        if (!error) {
          setJourneyRows(prev => {
            const next = new Map(prev)
            next.set(meetingCode, { ...existing, completed: newCompleted })
            return next
          })
        }
      } else {
        const { data, error } = await supabase
          .from('client_meetings')
          .insert({
            client_id: params.id,
            meeting_id: meetingCode,
            title,
            phase_number: phaseNumber,
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (!error && data) {
          setJourneyRows(prev => {
            const next = new Map(prev)
            next.set(meetingCode, data as ClientMeetingRow)
            return next
          })
        }
      }
    } finally {
      setMarkingIds(prev => {
        const next = new Set(prev)
        next.delete(meetingCode)
        return next
      })
    }
  }

  async function handleSend(draft: EmailDraft) {
    setSendingId(draft.id)
    try {
      const res = await fetch('/api/email-drafts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id:     draft.id,
          to_email:     draft.recipient_email,
          to_name:      draft.recipient_name,
          subject:      draft.subject,
          body:         draft.body,
          client_name:  draft.recipient_name,
          meeting_code: draft.email_code,
        }),
      })
      if (res.ok) {
        const sentDraft: EmailDraft = { ...draft, status: 'sent', sent_at: new Date().toISOString() }
        setEmailDrafts(prev => prev.filter(d => d.id !== draft.id))
        setSentEmails(prev => [sentDraft, ...prev])
        if (previewDraft?.id === draft.id) setPreviewDraft(null)
        if (editDraft?.id === draft.id) setEditDraft(null)
        setToast(`✅ Email sent to ${draft.recipient_name} successfully`)
      } else {
        alert('Failed to send email. Please try again.')
      }
    } catch {
      alert('Failed to send email. Please try again.')
    } finally {
      setSendingId(null)
    }
  }

  async function handleSaveEdit(draft: EmailDraft, newBody: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('client_email_drafts')
      .update({ body: newBody })
      .eq('id', draft.id)
    if (!error) {
      setEmailDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, body: newBody } : d))
    }
    setEditDraft(null)
  }

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: `customer-${params.id}`, role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', `customer-${params.id}`)
    setChatMessages([])
  }

  async function handleChatSend(userMsg: string) {
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMsg }]
    setChatMessages(newMessages)
    saveMessage('user', userMsg)

    try {
      if (!client || client === 'loading') {
        setChatMessages([...newMessages, { role: 'assistant', content: 'Client data is still loading. Please try again.' }])
        return
      }

      // ── Build journey context ─────────────────────────────────────────────
      const allMeetingDefs = JOURNEY_PHASES.flatMap(p => p.meetings.map(m => ({ ...m, phaseNumber: p.number, phaseLabel: p.label })))

      const completedEntries = Array.from(journeyRows.entries())
        .filter(([, r]) => r.completed)
        .sort((a, b) => {
          const ta = a[1].completed_at ? new Date(a[1].completed_at).getTime() : 0
          const tb = b[1].completed_at ? new Date(b[1].completed_at).getTime() : 0
          return tb - ta
        })
      const completedCount = completedEntries.length

      const completedList = completedEntries.map(([code, r]) => {
        const def = allMeetingDefs.find(m => m.code === code)
        return `  ${code} — ${r.title || def?.title || code}${r.completed_at ? ` (completed ${new Date(r.completed_at).toLocaleDateString()})` : ''}`
      })

      // Recaps from completed meetings, most recent first, up to 5
      const recapLines = completedEntries
        .filter(([, r]) => r.recap)
        .slice(0, 5)
        .map(([code, r]) => {
          const def = allMeetingDefs.find(m => m.code === code)
          return `RECAP — ${code} (${r.title || def?.title || code}):\n${r.recap}`
        })

      // Sent emails
      const sentEmailLines = sentEmails.map(e => {
        const preview = e.body.replace(/<[^>]+>/g, '').trim().slice(0, 100)
        const sentDate = e.sent_at ? new Date(e.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown date'
        return `- ${e.email_code} sent on ${sentDate}: ${e.subject}\n  Preview: ${preview}`
      })

      // Current phase = first phase not fully complete
      let currentPhaseNum = 0
      let currentPhaseLabel = 'All phases complete'
      for (const phase of JOURNEY_PHASES) {
        if (!phase.meetings.every(m => journeyRows.get(m.code)?.completed)) {
          currentPhaseNum = phase.number
          currentPhaseLabel = phase.label
          break
        }
      }

      // Next incomplete meeting
      const nextMeeting = allMeetingDefs.find(m => !journeyRows.get(m.code)?.completed)

      const happinessLabel = client.happiness === 'green' ? 'Happy' : client.happiness === 'yellow' ? 'At Risk' : 'Needs Attention'
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      const systemContent = `You are CASK Hub AI assistant for CASK Construction.
You have full context about this specific client.

CLIENT PROFILE:
- Name: ${client.name}
- Project Type: ${client.project_type}
- Project Value: $${client.project_value.toLocaleString()}
- Location: ${client.location}
- Start Date: ${client.start_date}
- Owner: ${client.owner}
- Happiness Status: ${happinessLabel}

PERSONALITY & COMMUNICATION:
- Personality Tags: ${client.personality_tags?.join(', ') || 'None added'}
- Communication Style: ${client.communication_style || 'Not specified'}
- Key Interests: ${client.key_interests || 'Not specified'}
- How to Communicate: ${client.ai_tip || 'Not specified'}

KEY PRIORITIES:
${client.priorities.map(p => `- ${p.text}: ${p.status}`).join('\n') || '- None added'}

MEETING JOURNEY:
- Progress: ${completedCount} of ${TOTAL_MEETINGS} meetings completed
- Current Phase: ${currentPhaseNum > 0 ? `Phase ${currentPhaseNum} — ${currentPhaseLabel}` : currentPhaseLabel}
- Next Incomplete Meeting: ${nextMeeting ? `${nextMeeting.code} — ${nextMeeting.title}` : 'All meetings complete'}
${completedList.length ? `- Completed Meetings:\n${completedList.join('\n')}` : '- Completed Meetings: None yet'}

${recapLines.length ? `MEETING RECAPS (most recent first):\n${recapLines.join('\n\n')}` : 'MEETING RECAPS: No recaps recorded yet.'}

${sentEmailLines.length ? `EMAILS SENT TO CLIENT:\n${sentEmailLines.join('\n')}` : 'EMAILS SENT TO CLIENT: No emails sent yet.'}

Use this context to answer questions about this client.
Help Calin and the team understand:
- How to communicate with this client based on their personality
- What phase they are in and what comes next
- What was discussed in recent meetings
- What action items may be pending based on recaps
- How the client is feeling about the project
- What to focus on in the next meeting

Always be specific to ${client.name}. Never mix up with other clients.
Today's date is ${today}.

## Response formatting
- Use **bold** for important names, values, or terms
- Use ## for section headers when listing multiple topics
- Use - for bullet points; max 2 levels of nesting
- Keep responses concise — 2–4 sentences or a short list unless detail is clearly needed
- Do not wrap the entire response in a code block`

      const res = await fetch('/api/chat/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: systemContent,
          messages: newMessages,
        }),
      })

      if (!res.ok) throw new Error('Chat failed')

      const data = await res.json()
      const reply =
        typeof data === 'string'
          ? data
          : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? 'No response.'

      setChatMessages([...newMessages, { role: 'assistant', content: reply }])
      saveMessage('assistant', reply)
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Unable to get a response right now. Please try again.' }])
    }
  }

  if (client === 'loading') {
    return (
      <>
        <TopBar title="Loading…" subtitle="Customer Journey" />
        <div className="flex-1 overflow-y-auto p-7">
          <div className="rounded-[10px] h-[148px] shimmer mb-3.5" style={{ border: '1px solid var(--border)' }} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg h-[200px] shimmer" style={{ border: '1px solid var(--border)' }} />
            <div className="rounded-lg h-[200px] shimmer" style={{ border: '1px solid var(--border)' }} />
          </div>
        </div>
      </>
    )
  }

  if (!client) {
    return (
      <>
        <TopBar title="Client Not Found" subtitle="Customer Journey" />
        <div className="flex-1 overflow-y-auto p-7">
          <BackLink />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Client not found.</p>
        </div>
      </>
    )
  }

  const happiness = HAPPINESS[client.happiness]
  const completedCount = Array.from(journeyRows.entries()).filter(([code, r]) => r.completed && code.endsWith('m')).length
  const sentEmailCount = sentEmails.length
  const journeyPct = Math.round((completedCount / 18) * 100)
  const sentEmailsByCode = new Map(sentEmails.map(e => [e.email_code, e]))

  return (
    <>
      {activeAgenda && <AgendaModal code={activeAgenda} onClose={() => setActiveAgenda(null)} />}

      {/* Send Confirmation Modal */}
      {confirmSendDraft && (
        <div
          onClick={() => setConfirmSendDraft(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <h2 style={{ fontFamily: 'var(--font-instrument-serif, Georgia, serif)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.3 }}>
                Send Email to {client.name}?
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text2)' }}>To: </span>
                  {confirmSendDraft.recipient_name}{confirmSendDraft.recipient_email ? ` (${confirmSendDraft.recipient_email})` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Subject: </span>
                  {confirmSendDraft.subject}
                </div>
              </div>
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmSendDraft(null)}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', background: 'transparent', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { const d = confirmSendDraft; setConfirmSendDraft(null); handleSend(d) }}
                disabled={sendingId === confirmSendDraft.id}
                style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--charcoal)', border: 'none', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: sendingId === confirmSendDraft.id ? 0.6 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = sendingId === confirmSendDraft.id ? '0.6' : '1' }}
              >
                📤 Yes, Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {previewDraft && (
        <div
          onClick={() => setPreviewDraft(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 620, maxHeight: '82vh', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-instrument-serif, Georgia, serif)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                  {previewDraft.email_code} — Email Preview
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
                  To: {previewDraft.recipient_name}{previewDraft.recipient_email ? ` (${previewDraft.recipient_email})` : ''}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: '3px 0 0', fontWeight: 500 }}>
                  Subject: {previewDraft.subject}
                </p>
              </div>
              <button
                onClick={() => setPreviewDraft(null)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div
                style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}
                dangerouslySetInnerHTML={{ __html: previewDraft.body }}
              />
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditDraft(previewDraft); setEditBody(previewDraft.body); setPreviewDraft(null) }}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => setConfirmSendDraft(previewDraft)}
                disabled={sendingId === previewDraft.id}
                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--red, #c8311a)', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: sendingId === previewDraft.id ? 'not-allowed' : 'pointer', opacity: sendingId === previewDraft.id ? 0.6 : 1, fontFamily: 'inherit' }}
              >
                {sendingId === previewDraft.id ? 'Sending…' : '📤 Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Edit Modal */}
      {editDraft && (
        <div
          onClick={() => setEditDraft(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 620, maxHeight: '88vh', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-instrument-serif, Georgia, serif)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                  ✏️ Edit Email Draft
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
                  {editDraft.subject}
                </p>
              </div>
              <button
                onClick={() => setEditDraft(null)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >×</button>
            </div>
            <div style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
              <ReactQuill
                value={editBody}
                onChange={setEditBody}
                theme="snow"
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['clean'],
                  ],
                }}
              />
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditDraft(null)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', background: 'transparent', border: '1px solid var(--border)', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editDraft, editBody)}
                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--charcoal)', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                Save Changes
              </button>
              <button
                onClick={() => { handleSaveEdit(editDraft, editBody).then(() => setConfirmSendDraft({ ...editDraft, body: editBody })) }}
                disabled={sendingId === editDraft.id}
                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--red, #c8311a)', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: sendingId === editDraft.id ? 'not-allowed' : 'pointer', opacity: sendingId === editDraft.id ? 0.6 : 1, fontFamily: 'inherit' }}
              >
                {sendingId === editDraft.id ? 'Sending…' : '📤 Save & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10002, background: '#166534', color: '#fff',
            padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}

      {/* Sent Email Modal */}
      {viewSentEmail && (
        <div
          onClick={() => setViewSentEmail(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 620, maxHeight: '84vh', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Dark header */}
            <div style={{ padding: '20px 24px', background: 'var(--charcoal)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>📧</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Email Sent</span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-instrument-serif, Georgia, serif)', fontSize: 18, fontWeight: 400, color: '#fff', margin: 0, lineHeight: 1.3 }}>
                  {viewSentEmail.email_code} — {(() => {
                    const phase = JOURNEY_PHASES.flatMap(p => p.meetings).find(m => m.code === viewSentEmail.email_code)
                    return phase?.title ?? viewSentEmail.subject
                  })()}
                </h2>
              </div>
              <button
                onClick={() => setViewSentEmail(null)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* Recipient + sent time */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>Sent to:</span> {viewSentEmail.recipient_name}
                </div>
                {viewSentEmail.recipient_email && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>Email:</span> {viewSentEmail.recipient_email}
                  </div>
                )}
                {viewSentEmail.sent_at && (
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>Sent on:</span>{' '}
                    {new Date(viewSentEmail.sent_at).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'long', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })} ET
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px' }} />

              {/* Subject */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 5 }}>Subject</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{viewSentEmail.subject}</div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '0 0 16px' }} />

              {/* Email body */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Email Body</div>
              <div
                dangerouslySetInnerHTML={{ __html: viewSentEmail.body }}
                style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.6', fontSize: '14px', color: '#333333' }}
                className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_p]:my-2 [&_strong]:font-bold [&_a]:text-blue-600 [&_a]:underline"
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setViewSentEmail(null)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', padding: '7px 20px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <TopBar title={client.name} subtitle="Customer Journey" />

      <div ref={containerRef} className="flex-1 overflow-y-auto p-7 animate-page-in" style={{ scrollbarGutter: 'stable' }}>
        <BackLink />

        {/* ── Hero Card ─────────────────────────────────────────────────── */}
        <div
          className="rounded-[10px] p-7 mb-3.5 relative overflow-hidden"
          style={{ background: 'var(--charcoal)' }}
        >
          <div
            className="absolute bottom-0 right-0 w-[260px] h-[260px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 80% 80%, rgba(255,255,255,0.03) 0%, transparent 60%)',
            }}
          />

          <div className="absolute top-7 right-7 text-right">
            <div
              className="text-[11px] font-medium tracking-[0.8px] uppercase mb-0.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Project Value
            </div>
            <div
              className="text-[22px] font-semibold tracking-[-0.5px]"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              {formatCurrency(client.project_value)}
            </div>
          </div>

          <div className="flex items-center gap-5 mb-5">
            <div
              className="flex items-center justify-center rounded-full text-white font-bold tracking-[0.5px] shrink-0"
              style={{
                width: 64,
                height: 64,
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.12)',
                fontSize: 20,
              }}
            >
              {client.initials}
            </div>
            <div>
              <div
                className="text-[9px] font-medium tracking-[1.8px] uppercase mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Customer Journey · CASK Construction
              </div>
              <h1
                className="font-serif text-[26px] text-white leading-[1.15] tracking-[-0.3px]"
                style={{ margin: 0 }}
              >
                {client.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {client.project_type}
            </span>
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              📍 {client.location}
            </span>
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Started {client.start_date}
            </span>
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Owner: {client.owner}
            </span>
            <span
              className="text-[11px] font-semibold px-3 py-1 rounded-full"
              style={{ background: happiness.bg, color: happiness.color }}
            >
              {happiness.label}
            </span>
          </div>
        </div>

        {/* ── Two-column grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-3">

          {/* Card 1 — Personality & Communication */}
          <div
            className="rounded-lg p-5"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <SectionLabel icon="👤">Personality & Communication</SectionLabel>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {client.personality_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: 'var(--surface2, #f5f5f5)',
                    color: 'var(--text2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mb-3">
              <div
                className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-1"
                style={{ color: 'var(--text3)' }}
              >
                Communication Style
              </div>
              <p
                className="text-[13px] leading-relaxed m-0"
                style={{ color: 'var(--text2)' }}
              >
                {client.communication_style}
              </p>
            </div>

            <div className="mb-4">
              <div
                className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-1"
                style={{ color: 'var(--text3)' }}
              >
                Key Interests
              </div>
              <p
                className="text-[13px] leading-relaxed m-0"
                style={{ color: 'var(--text2)' }}
              >
                {client.key_interests}
              </p>
            </div>

            <div
              className="rounded-[8px] p-3.5"
              style={{
                background: 'var(--red-soft, #fdf2f0)',
                borderLeft: '3px solid var(--red, #c8311a)',
              }}
            >
              <div
                className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-1.5"
                style={{ color: 'var(--red, #c8311a)', opacity: 0.8 }}
              >
                How to communicate with {client.name.split(' ')[0]}
              </div>
              <p
                className="text-[12px] leading-relaxed m-0"
                style={{ color: 'var(--text2)' }}
              >
                {client.ai_tip}
              </p>
            </div>
          </div>

          {/* Card 2 — Key Priorities */}
          <div
            className="rounded-lg p-5"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <SectionLabel icon="🚩">Key Priorities</SectionLabel>

            <div className="flex flex-col gap-2.5">
              {client.priorities.map((p, i) => {
                const cfg = PRIORITY_CONFIG[p.status]
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 8, height: 8, background: cfg.dot }}
                    />
                    <span
                      className="text-[13px] font-medium"
                      style={{
                        color: cfg.color,
                        textDecoration: cfg.strike ? 'line-through' : 'none',
                        opacity: cfg.strike ? 0.65 : 1,
                      }}
                    >
                      {p.text}
                    </span>
                    <span
                      className="ml-auto text-[10px] font-semibold tracking-[0.4px] shrink-0"
                      style={{ color: cfg.color, opacity: 0.7 }}
                    >
                      {p.status === 'done' ? 'Done' : p.status === 'in_progress' ? 'In Progress' : 'Unresolved'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Pending Emails ───────────────────────────────────────────── */}
        {emailDrafts.length > 0 && (
          <div
            className="rounded-lg p-5 mb-3"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            {/* Custom header — bigger + bolder than SectionLabel */}
            <div className="flex items-center gap-2 mb-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="2,4 12,13 22,4" />
              </svg>
              <span
                className="text-[12px] font-bold tracking-[1.2px] uppercase"
                style={{ color: '#92400e' }}
              >
                Pending Emails
              </span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
              >
                {emailDrafts.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {emailDrafts.map(draft => (
                <div
                  key={draft.id}
                  className="rounded-[8px] p-4"
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderLeft: '3px solid #d97706',
                    boxShadow: '0 1px 4px rgba(217,119,6,0.08)',
                  }}
                >
                  {/* Draft header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold tracking-[0.4px] shrink-0"
                          style={{
                            background: '#d97706',
                            color: '#fff',
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontFamily: 'monospace',
                          }}
                        >
                          {draft.email_code}
                        </span>
                        <span
                          className="text-[12px] font-semibold truncate"
                          style={{ color: '#92400e' }}
                        >
                          {draft.subject}
                        </span>
                      </div>
                      <div className="text-[11px]" style={{ color: '#b45309' }}>
                        To: {draft.recipient_name}{draft.recipient_email ? ` (${draft.recipient_email})` : ''}
                      </div>
                      {draft.created_at && (
                        <div className="text-[11px] mt-0.5" style={{ color: '#b45309', opacity: 0.7 }}>
                          Generated: {new Date(draft.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setPreviewDraft(draft)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: '#92400e', background: '#fff', border: '1px solid #fde68a',
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#d97706' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#fde68a' }}
                    >
                      👁 Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => { setEditDraft(draft); setEditBody(draft.body) }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: '#92400e', background: '#fff', border: '1px solid #fde68a',
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#d97706' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#fde68a' }}
                    >
                      ✏️ Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmSendDraft(draft)}
                      disabled={sendingId === draft.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: '#fff', background: 'var(--charcoal, #1a1917)', border: 'none',
                        padding: '4px 12px', borderRadius: 6,
                        cursor: sendingId === draft.id ? 'not-allowed' : 'pointer',
                        opacity: sendingId === draft.id ? 0.5 : 1,
                        fontFamily: 'inherit',
                        transition: 'opacity 120ms ease',
                      }}
                    >
                      {sendingId === draft.id ? '…Sending' : '📤 Send'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Sent Emails ──────────────────────────────────────────────── */}
        {sentEmails.length > 0 && (
          <div
            className="rounded-lg p-5 mb-3"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <SectionLabel icon="📨">Sent Emails</SectionLabel>

            <div className="flex flex-col gap-3">
              {sentEmails.map(sent => (
                <div
                  key={sent.id}
                  className="rounded-[8px] p-4"
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderLeft: '3px solid #16a34a',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Code + title row */}
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold shrink-0"
                          style={{
                            background: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontFamily: 'monospace',
                          }}
                        >
                          ✅ {sent.email_code}
                        </span>
                        <span
                          className="text-[12px] font-semibold truncate"
                          style={{ color: '#166534' }}
                        >
                          {sent.subject}
                        </span>
                      </div>

                      {/* Recipient */}
                      <div className="text-[11px]" style={{ color: '#166534', opacity: 0.75 }}>
                        Sent to: {sent.recipient_name}{sent.recipient_email ? ` (${sent.recipient_email})` : ''}
                      </div>

                      {/* Sent timestamp */}
                      {sent.sent_at && (
                        <div className="text-[11px] mt-0.5" style={{ color: '#166534', opacity: 0.65 }}>
                          Sent on: {new Date(sent.sent_at).toLocaleString('en-US', {
                            timeZone: 'America/New_York',
                            month: 'long', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true,
                          })} ET
                        </div>
                      )}
                    </div>

                    {/* View button */}
                    <button
                      type="button"
                      onClick={() => setViewSentEmail(sent)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: '#166534', background: '#dcfce7',
                        border: '1px solid #bbf7d0',
                        padding: '5px 12px', borderRadius: 6,
                        cursor: 'pointer', fontFamily: 'inherit', shrink: 0,
                        transition: 'opacity 120ms ease',
                        whiteSpace: 'nowrap',
                      } as React.CSSProperties}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Meeting Journey ───────────────────────────────────────────── */}
        <div
          className="rounded-lg p-5 mb-3"
          style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
        >
          <SectionLabel icon="📋">Meeting Journey</SectionLabel>

          {/* Progress summary + bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium" style={{ color: 'var(--text2)' }}>
                {completedCount} of 18 meetings completed
                {sentEmailCount > 0 && (
                  <span style={{ color: 'var(--text3)' }}> · {sentEmailCount} emails sent</span>
                )}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: happiness.accent }}>
                {journeyPct}%
              </span>
            </div>
            <div
              className="h-[5px] rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${journeyPct}%`,
                  background: happiness.accent,
                  transition: 'width 400ms ease',
                }}
              />
            </div>
          </div>

          {/* Phase cards */}
          <div className="flex flex-col gap-2">
            {JOURNEY_PHASES.map(phase => (
              <PhaseCard
                key={phase.number}
                phase={phase}
                journeyRows={journeyRows}
                markingIds={markingIds}
                onMarkComplete={markComplete}
                onOpenRecap={(code) => router.push(`/customers/${params.id}/meetings/${code}`)}
                onViewAgenda={setActiveAgenda}
                sentEmailsByCode={sentEmailsByCode}
                onViewSentEmail={setViewSentEmail}
              />
            ))}
          </div>
        </div>

        {/* ── CASK Intelligence ─────────────────────────────────────────── */}
        <IntelligencePanel
          client={client}
          journeyRows={journeyRows}
          messages={chatMessages}
          onSend={handleChatSend}
          onClear={clearHistory}
        />
      </div>
    </>
  )
}
