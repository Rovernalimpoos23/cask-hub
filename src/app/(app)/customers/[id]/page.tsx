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
  email: string
  project_type: string
  project_value: number
  location: string
  project_address: string
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

// ── Edit Client modal config (mirrors New Client Setup) ───────────────────────

const PROJECT_TYPES = ['Custom Home', 'ADU', 'Detached Garage', 'Addition', 'Other']
const OWNERS = ['Calin', 'Jeff', 'Matteo', 'Chad']
const ALL_TAGS = [
  'Verbal communicator', 'Direct', 'Detail-oriented', 'Analytical',
  'Visual learner', 'Budget-focused', 'Fast decision maker',
  'Slow processor', 'Needs reassurance', 'Email communicator',
  'Relationship-driven', 'Skeptical',
]
const HAPPINESS_OPTIONS: { value: Happiness; emoji: string; label: string; accent: string; bg: string }[] = [
  { value: 'green',  emoji: '🟢', label: 'Happy',           accent: '#16a34a', bg: '#F0FDF4' },
  { value: 'yellow', emoji: '🟡', label: 'At Risk',         accent: '#d97706', bg: '#FFFBEB' },
  { value: 'red',    emoji: '🔴', label: 'Needs Attention', accent: '#dc2626', bg: '#FDF2F0' },
]

const COMM_PLACEHOLDER = 'No communication style added yet.'
const INTEREST_PLACEHOLDER = 'No interests added yet.'

const STATUS_OPTIONS: { value: PriorityStatus; label: string }[] = [
  { value: 'unresolved',  label: 'Unresolved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

interface EditPriorityRow { id: string; text: string; status: PriorityStatus }
interface EditClientForm {
  name: string
  email: string
  project_type: string
  project_value: string
  location: string
  project_address: string
  start_date: string
  owner: string
  happiness: Happiness
  personality_tags: string[]
  communication_style: string
  key_interests: string
  priorities: EditPriorityRow[]
}

const editFieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const editLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text2)' }
const editInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
  boxSizing: 'border-box',
}
function editFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border2)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)'
}
function editBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border)'
  e.currentTarget.style.boxShadow = 'none'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return '$' + v.toLocaleString('en-US')
}

// Strip HTML/markdown noise and clamp to a short, single-line summary.
function summarize(text: string, max: number): string {
  const clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > max ? clean.slice(0, max).trimEnd() + '…' : clean
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

function FloatingClientAI({ client, journeyRows, messages, onSend, onClear, open, onOpenChange }: {
  client: ClientData
  journeyRows: Map<string, ClientMeetingRow>
  messages: { role: 'user' | 'assistant'; content: string }[]
  onSend: (msg: string) => void
  onClear: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const greeting = buildGreeting(client, journeyRows)
  const firstName = client.name.split(' ')[0]

  // Keep the latest message in view by scrolling the chat's OWN container only.
  // Using scrollTop (not scrollIntoView) means this never bubbles up to scroll
  // the page — so restoring persistent history on mount won't jump the page down.
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending, open])

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
    <>
      <style>{`
        @keyframes clientAISlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes clientAIPulse {
          0% { box-shadow: 0 0 0 0 rgba(181,18,27,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(181,18,27,0); }
          100% { box-shadow: 0 0 0 0 rgba(181,18,27,0); }
        }
      `}</style>

      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '11px 18px 11px 14px', borderRadius: 999,
          background: 'var(--charcoal)', color: '#fff', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, letterSpacing: '0.2px',
          boxShadow: btnHover ? '0 12px 30px -6px rgba(0,0,0,0.45)' : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--fable-red)', flexShrink: 0, animation: 'clientAIPulse 2.2s ease-out infinite' }} />
        CASK Intelligence <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.55)' }}>· {firstName}</span>
      </button>

      {open && (
      <div
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 61,
          width: 400, maxWidth: 'calc(100vw - 48px)',
          height: 540, maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRadius: 16, background: 'var(--charcoal)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
          animation: 'clientAISlideUp 220ms ease',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: 'var(--fable-red)', boxShadow: '0 0 6px rgba(181,18,27,0.6)' }}
              />
              <span
                className="text-[12px] font-semibold tracking-[0.8px] uppercase"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                CASK Intelligence · {firstName}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                title="Close"
                className="flex items-center justify-center rounded-[6px]"
                style={{
                  width: 26, height: 26, background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
        </div>

      {/* Messages */}
      <div ref={messagesRef} className="px-5 py-4 flex flex-col gap-3" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
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
      )}
    </>
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

// ── Role-based meeting checklist (NEW — additive feature) ─────────────────────
// Self-contained salesperson checklist that renders inside eligible meeting rows.
// Does not alter any existing meeting-row behaviour; it only adds an expandable
// panel below the existing action buttons for the 4 seeded meeting codes.

// Only these meeting codes have seeded salesperson tasks.
const CHECKLIST_MEETING_CODES = ['PR1m', 'PR3m', 'PD1m', 'PD4m']
// Currently only the salesperson role is surfaced.
const CHECKLIST_ROLE = 'salesperson'
// Render order + display labels for the timing groups.
const CHECKLIST_TIMINGS: { key: string; label: string }[] = [
  { key: 'before', label: 'Before' },
  { key: 'during', label: 'During' },
  { key: 'after', label: 'After' },
]

interface ChecklistTemplate {
  id: string
  meeting_code: string
  role: string
  timing: string
  task_text: string
}

// State of a single per-client checklist row, keyed by meeting_code + task_text.
interface ChecklistRowState {
  id: string
  completed: boolean
}

// Build the lookup key used to match a template task to its per-client row.
function checklistKey(meetingCode: string, taskText: string) {
  return `${meetingCode}||${taskText}`
}

function MeetingChecklistPanel({
  meetingCode,
  templates,
  checklistRows,
  togglingKeys,
  onToggle,
}: {
  meetingCode: string
  templates: ChecklistTemplate[]
  checklistRows: Map<string, ChecklistRowState>
  togglingKeys: Set<string>
  onToggle: (meetingCode: string, taskText: string, next: boolean) => void
}) {
  const tasks = templates.filter(t => t.meeting_code === meetingCode)
  if (tasks.length === 0) return null

  const total = tasks.length
  const doneCount = tasks.filter(t => checklistRows.get(checklistKey(meetingCode, t.task_text))?.completed).length

  return (
    <div
      style={{
        marginTop: 6,
        marginBottom: 4,
        background: 'var(--surface2)',
        borderLeft: '2px solid var(--fable-red)',
        borderRadius: 6,
        padding: '10px 12px 11px',
      }}
    >
      {CHECKLIST_TIMINGS.map(timing => {
        const group = tasks.filter(t => (t.timing || '').toLowerCase() === timing.key)
        if (group.length === 0) return null
        return (
          <div key={timing.key} style={{ marginBottom: 9 }}>
            <div
              className="uppercase"
              style={{ fontSize: 10, letterSpacing: '0.11em', color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}
            >
              {timing.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.map(task => {
                const key = checklistKey(meetingCode, task.task_text)
                const checked = checklistRows.get(key)?.completed ?? false
                const busy = togglingKeys.has(key)
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => { if (!busy) onToggle(meetingCode, task.task_text, !checked) }}
                    disabled={busy}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: busy ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <span
                      className="shrink-0"
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: checked ? '1.5px solid var(--charcoal)' : '1.5px solid var(--border2)',
                        background: checked ? 'var(--charcoal)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 1,
                        transition: 'background 120ms ease, border-color 120ms ease',
                      }}
                    >
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        lineHeight: 1.4,
                        color: 'var(--text)',
                        opacity: checked ? 0.5 : 1,
                        textDecoration: checked ? 'line-through' : 'none',
                      }}
                    >
                      {task.task_text}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
        {doneCount} of {total} tasks complete
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
  isCurrent,
  isDone,
  defaultExpanded,
  checklistTemplates,
  checklistRows,
  checklistToggling,
  onToggleChecklist,
}: {
  phase: JourneyPhaseDef
  journeyRows: Map<string, ClientMeetingRow>
  markingIds: Set<string>
  onMarkComplete: (code: string, phaseNumber: number, title: string) => void
  onOpenRecap: (code: string, title: string) => void
  onViewAgenda: (code: string) => void
  sentEmailsByCode: Map<string, EmailDraft>
  onViewSentEmail: (draft: EmailDraft) => void
  isCurrent: boolean
  isDone: boolean
  defaultExpanded: boolean
  // NEW (additive): role-based checklist data + toggle handler
  checklistTemplates: ChecklistTemplate[]
  checklistRows: Map<string, ChecklistRowState>
  checklistToggling: Set<string>
  onToggleChecklist: (meetingCode: string, taskText: string, next: boolean) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // NEW (additive): tracks which meeting rows have their checklist panel open.
  const [openChecklists, setOpenChecklists] = useState<Set<string>>(new Set())
  const toggleChecklistOpen = (code: string) =>
    setOpenChecklists(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const completedInPhase = phase.meetings.filter(m => journeyRows.get(m.code)?.completed).length
  const total = phase.meetings.length
  const nextCode = phase.meetings.find(m => !journeyRows.get(m.code)?.completed)?.code
  const isTodo = !isCurrent && !isDone

  const markStyle: React.CSSProperties = isDone
    ? { background: 'var(--fable-ok-soft)', border: '1.5px solid #BFDECB', color: 'var(--fable-ok)' }
    : isCurrent
    ? { background: 'var(--charcoal)', border: '1.5px solid var(--charcoal)', color: '#fff' }
    : { background: 'var(--white)', border: '1.5px solid var(--border)', color: 'var(--text3)' }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Phase header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 2px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {/* Phase mark */}
        <span
          className="shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            ...markStyle,
          }}
        >
          {isDone ? '✓' : phase.number}
        </span>

        {/* Label */}
        <span
          className="flex-1 text-left"
          style={{ fontSize: 13.5, fontWeight: isCurrent ? 600 : 500, color: isTodo ? 'var(--text2)' : 'var(--text)' }}
        >
          {phase.label}
        </span>

        {/* Current marker */}
        {isCurrent && (
          <span
            className="uppercase shrink-0"
            style={{ fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, color: 'var(--fable-red)' }}
          >
            Current
          </span>
        )}

        {/* Count */}
        <span
          className="shrink-0"
          style={{
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
            color: isDone ? 'var(--fable-ok)' : 'var(--text3)',
            fontWeight: isDone ? 600 : 400,
          }}
        >
          {completedInPhase} / {total}
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
        <div style={{ padding: '0 0 12px 34px' }}>
          {phase.meetings.map((meeting, i) => {
            const row = journeyRows.get(meeting.code)
            const isCompleted = row?.completed ?? false
            const isMarking = markingIds.has(meeting.code)
            const hasRecap = !!(row?.recap)
            const sentEmail = meeting.type === 'email' ? sentEmailsByCode.get(meeting.code) : undefined

            const isNext = meeting.code === nextCode
            // NEW (additive): does this meeting have a salesperson checklist?
            const hasChecklist =
              CHECKLIST_MEETING_CODES.includes(meeting.code) &&
              checklistTemplates.some(t => t.meeting_code === meeting.code)
            const checklistOpen = openChecklists.has(meeting.code)
            const checklistTotal = checklistTemplates.filter(t => t.meeting_code === meeting.code).length
            const checklistDone = checklistTemplates.filter(
              t => t.meeting_code === meeting.code && checklistRows.get(checklistKey(meeting.code, t.task_text))?.completed
            ).length
            return (
              <div
                key={meeting.code}
                style={{ transition: 'background 150ms ease' }}
              >
                {/* Main meeting row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 0',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Status dot */}
                  <span
                    className="shrink-0"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isCompleted ? 'var(--fable-ok)' : isNext ? 'var(--fable-red)' : '#D6D5D0',
                    }}
                  />

                  {/* Title */}
                  <span
                    className="flex-1"
                    style={{
                      fontSize: 13,
                      color: isCompleted ? 'var(--text3)' : isNext ? 'var(--text)' : 'var(--text2)',
                      fontWeight: isNext ? 600 : 400,
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      textDecorationColor: '#CFCEC9',
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
                          color: 'var(--text2)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'border-color 120ms ease, color 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
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
                          color: 'var(--text2)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'border-color 120ms ease, color 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
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

                    {/* Checklist toggle — NEW (additive), only for eligible meetings */}
                    {hasChecklist && (
                      <button
                        type="button"
                        onClick={() => toggleChecklistOpen(meeting.code)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: checklistOpen ? 'var(--text)' : 'var(--text2)',
                          background: 'var(--surface2, #f4f3f1)',
                          border: `1px solid ${checklistOpen ? 'var(--border2)' : 'var(--border)'}`,
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'border-color 120ms ease, color 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = checklistOpen ? 'var(--border2)' : 'var(--border)'; e.currentTarget.style.color = checklistOpen ? 'var(--text)' : 'var(--text2)' }}
                      >
                        ☑ Checklist {checklistDone}/{checklistTotal}
                        <span style={{ fontSize: 9, transition: 'transform 200ms ease', transform: checklistOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Checklist panel — NEW (additive), below the action buttons */}
                {hasChecklist && checklistOpen && (
                  <MeetingChecklistPanel
                    meetingCode={meeting.code}
                    templates={checklistTemplates}
                    checklistRows={checklistRows}
                    togglingKeys={checklistToggling}
                    onToggle={onToggleChecklist}
                  />
                )}

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
  const journeyRef = useRef<HTMLDivElement>(null)
  const [aiOpen, setAiOpen] = useState(false)
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
  const [editForm, setEditForm] = useState<EditClientForm | null>(null)
  const [savingClient, setSavingClient] = useState(false)

  // ── Role-based checklist state (NEW — additive feature) ─────────────────────
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([])
  const [checklistRows, setChecklistRows] = useState<Map<string, ChecklistRowState>>(new Map())
  const [checklistToggling, setChecklistToggling] = useState<Set<string>>(new Set())
  const checklistUserIdRef = useRef<string | null>(null)

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

  // ── Fetch salesperson checklist templates + this client's saved state ───────
  // (NEW — additive feature; does not touch any existing query above.)
  useEffect(() => {
    async function fetchChecklist() {
      const supabase = createClient()

      // Capture the current user id (reuses the existing auth session) for completed_by.
      const { data: { user } } = await supabase.auth.getUser()
      checklistUserIdRef.current = user?.id ?? null

      const [{ data: templates }, { data: saved }] = await Promise.all([
        supabase
          .from('journey_checklist_templates')
          .select('id, meeting_code, role, timing, task_text')
          .eq('role', CHECKLIST_ROLE),
        supabase
          .from('journey_checklists')
          .select('id, meeting_code, task_text, completed')
          .eq('client_id', params.id),
      ])

      if (templates) setChecklistTemplates(templates as ChecklistTemplate[])

      if (saved) {
        const map = new Map<string, ChecklistRowState>()
        for (const r of saved as { id: string; meeting_code: string; task_text: string; completed: boolean }[]) {
          map.set(checklistKey(r.meeting_code, r.task_text), { id: r.id, completed: r.completed })
        }
        setChecklistRows(map)
      }
    }
    fetchChecklist()
  }, [params.id])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const fetchClient = useCallback(async () => {
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
      supabase.from('client_priorities').select('*').eq('client_id', params.id).order('sort_order', { ascending: true }),
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
      email: row.email ?? '',
      project_type: row.project_type ?? '',
      project_value: row.project_value ?? 0,
      location: row.location ?? '',
      project_address: row.project_address ?? '',
      start_date: row.start_date ?? '',
      happiness,
      owner: row.owner ?? '',
      personality_tags: Array.isArray(row.personality_tags) ? row.personality_tags : [],
      communication_style: row.communication_style ?? COMM_PLACEHOLDER,
      key_interests: row.key_interests ?? INTEREST_PLACEHOLDER,
      ai_tip: row.ai_tip ?? 'Add personality details to get AI communication tips.',
      priorities,
    })
  }, [params.id])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  // ── Toggle a checklist task on/off + persist to Supabase ────────────────────
  // (NEW — additive feature; entirely separate from markComplete below.)
  async function toggleChecklistTask(meetingCode: string, taskText: string, next: boolean) {
    const key = checklistKey(meetingCode, taskText)
    setChecklistToggling(prev => new Set(prev).add(key))

    // Optimistic update so the checkbox feels instant.
    const prevRows = checklistRows
    const existing = prevRows.get(key)
    setChecklistRows(prev => {
      const m = new Map(prev)
      m.set(key, { id: existing?.id ?? `optimistic-${key}`, completed: next })
      return m
    })

    try {
      const supabase = createClient()
      const userId = checklistUserIdRef.current

      if (existing && !existing.id.startsWith('optimistic-')) {
        // A real row already exists → update its completed flag.
        const { error } = await supabase
          .from('journey_checklists')
          .update({
            completed: next,
            completed_by: next ? userId : null,
            completed_at: next ? new Date().toISOString() : null,
          })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        // No row yet → insert a new one and keep its id for future updates.
        const { data, error } = await supabase
          .from('journey_checklists')
          .insert({
            client_id: params.id,
            meeting_code: meetingCode,
            role: CHECKLIST_ROLE,
            task_text: taskText,
            completed: next,
            completed_by: next ? userId : null,
            completed_at: next ? new Date().toISOString() : null,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) {
          setChecklistRows(prev => {
            const m = new Map(prev)
            m.set(key, { id: data.id, completed: next })
            return m
          })
        }
      }
    } catch (err) {
      console.error('[journey-checklist] toggle failed:', err)
      // Revert the optimistic change on failure.
      setChecklistRows(prev => {
        const m = new Map(prev)
        if (existing) m.set(key, existing)
        else m.delete(key)
        return m
      })
    } finally {
      setChecklistToggling(prev => {
        const m = new Set(prev)
        m.delete(key)
        return m
      })
    }
  }

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

  function openEditModal() {
    if (!client || client === 'loading') return
    setEditForm({
      name: client.name,
      email: client.email ?? '',
      project_type: client.project_type || 'Custom Home',
      project_value: client.project_value ? String(client.project_value) : '',
      location: client.location ?? '',
      project_address: client.project_address ?? '',
      start_date: client.start_date ?? '',
      owner: client.owner || 'Calin',
      happiness: client.happiness,
      personality_tags: [...client.personality_tags],
      communication_style: client.communication_style === COMM_PLACEHOLDER ? '' : client.communication_style,
      key_interests: client.key_interests === INTEREST_PLACEHOLDER ? '' : client.key_interests,
      priorities: client.priorities.map(p => ({ id: crypto.randomUUID(), text: p.text, status: p.status })),
    })
  }

  async function handleSaveClient() {
    if (!editForm || client === 'loading' || !client) return
    if (!editForm.name.trim()) {
      setToast('Client name is required')
      return
    }

    setSavingClient(true)
    try {
      const supabase = createClient()

      // Build update with only changed fields
      const update: Record<string, unknown> = {}
      if (editForm.name.trim() !== client.name) update.name = editForm.name.trim()
      if (editForm.email.trim() !== (client.email ?? '')) update.email = editForm.email.trim() || null
      if (editForm.project_type !== client.project_type) update.project_type = editForm.project_type
      const newValue = editForm.project_value ? Number(editForm.project_value) : 0
      if (newValue !== client.project_value) update.project_value = newValue
      if (editForm.location.trim() !== client.location) update.location = editForm.location.trim() || null
      if (editForm.project_address.trim() !== (client.project_address ?? '')) update.project_address = editForm.project_address.trim() || null
      if (editForm.start_date !== client.start_date) update.start_date = editForm.start_date || null
      if (editForm.owner !== client.owner) update.owner = editForm.owner
      if (editForm.happiness !== client.happiness) update.happiness = editForm.happiness
      if (JSON.stringify(editForm.personality_tags) !== JSON.stringify(client.personality_tags)) {
        update.personality_tags = editForm.personality_tags
      }
      const origComm = client.communication_style === COMM_PLACEHOLDER ? '' : client.communication_style
      if (editForm.communication_style.trim() !== origComm) {
        update.communication_style = editForm.communication_style.trim() || null
      }
      const origInterests = client.key_interests === INTEREST_PLACEHOLDER ? '' : client.key_interests
      if (editForm.key_interests.trim() !== origInterests) {
        update.key_interests = editForm.key_interests.trim() || null
      }

      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('clients').update(update).eq('id', client.id)
        if (error) throw new Error(error.message)
      }

      // Priorities — delete + reinsert only if changed
      const cleaned = editForm.priorities.filter(p => p.text.trim())
      const newPriKey = JSON.stringify(cleaned.map(p => ({ text: p.text.trim(), status: p.status })))
      const oldPriKey = JSON.stringify(client.priorities.map(p => ({ text: p.text, status: p.status })))
      if (newPriKey !== oldPriKey) {
        await supabase.from('client_priorities').delete().eq('client_id', client.id)
        if (cleaned.length > 0) {
          await supabase.from('client_priorities').insert(
            cleaned.map((p, i) => ({
              id: crypto.randomUUID(),
              client_id: client.id,
              text: p.text.trim(),
              status: p.status,
              sort_order: i,
            }))
          )
        }
      }

      await fetchClient()
      setToast('Client updated successfully')
      setEditForm(null)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to update client')
    } finally {
      setSavingClient(false)
    }
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

  // ── Derived values for the Fable redesign ──────────────────────────────────
  const allMeetingDefs = JOURNEY_PHASES.flatMap(p => p.meetings)

  // Current phase = first phase not fully complete (mirrors the AI-context logic)
  let currentPhaseNumber = 0
  for (const p of JOURNEY_PHASES) {
    if (!p.meetings.every(m => journeyRows.get(m.code)?.completed)) {
      currentPhaseNumber = p.number
      break
    }
  }
  const currentPhase = JOURNEY_PHASES.find(p => p.number === currentPhaseNumber) ?? null

  // First incomplete meeting in the current phase (falls back to global next)
  const nextMeetingDef =
    currentPhase?.meetings.find(m => !journeyRows.get(m.code)?.completed) ??
    allMeetingDefs.find(m => !journeyRows.get(m.code)?.completed) ??
    null

  // Most recent completed meeting — drives next-step context + the "updated" date
  const completedRows = Array.from(journeyRows.values())
    .filter(r => r.completed)
    .sort((a, b) => {
      const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return tb - ta
    })
  const lastCompleted = completedRows[0] ?? null

  const updatedTimes = [
    lastCompleted?.completed_at ? new Date(lastCompleted.completed_at).getTime() : 0,
    ...sentEmails.map(e => (e.sent_at ? new Date(e.sent_at).getTime() : 0)),
  ].filter(Boolean)
  const lastUpdated = updatedTimes.length
    ? new Date(Math.max(...updatedTimes)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  const sentimentLabel: Record<Happiness, string> = {
    green: 'Sentiment positive',
    yellow: 'Sentiment watch',
    red: 'Needs attention',
  }
  const sentiment = sentimentLabel[client.happiness]

  const nextStepDesc = lastCompleted?.recap
    ? summarize(lastCompleted.recap, 180)
    : currentPhase
    ? `Continue the ${currentPhase.label} phase — ${currentPhase.meetings.filter(m => journeyRows.get(m.code)?.completed).length} of ${currentPhase.meetings.length} steps complete.`
    : ''

  const clientSinceDate = client.start_date ? new Date(client.start_date) : null
  const clientSince =
    clientSinceDate && !isNaN(clientSinceDate.getTime())
      ? clientSinceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : client.start_date || ''

  const firstName = client.name.split(' ')[0]
  const hasInterests = !!client.key_interests && client.key_interests !== INTEREST_PLACEHOLDER
  const hasComm = !!client.communication_style && client.communication_style !== COMM_PLACEHOLDER
  const hasTip = !!client.ai_tip && client.ai_tip !== 'Add personality details to get AI communication tips.'

  // Shared button style for the next-step actions
  const nextBtn: React.CSSProperties = {
    fontSize: 13, fontWeight: 550, borderRadius: 7, cursor: 'pointer',
    padding: '9px 15px', lineHeight: 1, border: '1px solid var(--border)',
    background: 'var(--white)', color: 'var(--text)', whiteSpace: 'nowrap', fontFamily: 'inherit',
  }

  return (
    <>
      {activeAgenda && <AgendaModal code={activeAgenda} onClose={() => setActiveAgenda(null)} />}

      {/* Edit Client Modal */}
      {editForm && (
        <div
          onClick={() => { if (!savingClient) setEditForm(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
              <h2 style={{ fontFamily: 'var(--font-instrument-serif, Georgia, serif)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                Edit Client
              </h2>
              <button
                onClick={() => { if (!savingClient) setEditForm(null) }}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Name */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Client Name <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(f => f && { ...f, name: e.target.value })}
                    placeholder="e.g. John Smith"
                    style={{ ...editInputStyle, fontSize: 15, padding: '11px 14px', fontWeight: 500 }}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
                </div>

                {/* Email */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Client Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(f => f && { ...f, email: e.target.value })}
                    placeholder="e.g. johnsmith@gmail.com"
                    style={editInputStyle}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
                </div>

                {/* Project type + Value */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={editFieldStyle}>
                    <label style={editLabelStyle}>Project Type</label>
                    <select
                      value={editForm.project_type}
                      onChange={e => setEditForm(f => f && { ...f, project_type: e.target.value })}
                      style={{ ...editInputStyle, cursor: 'pointer' }}
                      onFocus={editFocus}
                      onBlur={editBlur}
                    >
                      {[...PROJECT_TYPES, editForm.project_type].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i).map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={editFieldStyle}>
                    <label style={editLabelStyle}>Project Value</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)', pointerEvents: 'none' }}>$</span>
                      <input
                        type="number"
                        value={editForm.project_value}
                        onChange={e => setEditForm(f => f && { ...f, project_value: e.target.value })}
                        placeholder="485000"
                        style={{ ...editInputStyle, paddingLeft: 24 }}
                        onFocus={editFocus}
                        onBlur={editBlur}
                      />
                    </div>
                  </div>
                </div>

                {/* Location + Project Address */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={e => setEditForm(f => f && { ...f, location: e.target.value })}
                    placeholder="e.g. St. Petersburg, FL"
                    style={editInputStyle}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
                </div>
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Project Address</label>
                  <input
                    type="text"
                    value={editForm.project_address}
                    onChange={e => setEditForm(f => f && { ...f, project_address: e.target.value })}
                    placeholder="e.g. 123 Main St, St. Petersburg, FL 33701"
                    style={editInputStyle}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
                </div>

                {/* Start date + Owner */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={editFieldStyle}>
                    <label style={editLabelStyle}>Start Date</label>
                    <input
                      type="date"
                      value={editForm.start_date}
                      onChange={e => setEditForm(f => f && { ...f, start_date: e.target.value })}
                      style={editInputStyle}
                      onFocus={editFocus}
                      onBlur={editBlur}
                    />
                  </div>
                  <div style={editFieldStyle}>
                    <label style={editLabelStyle}>Owner</label>
                    <select
                      value={editForm.owner}
                      onChange={e => setEditForm(f => f && { ...f, owner: e.target.value })}
                      style={{ ...editInputStyle, cursor: 'pointer' }}
                      onFocus={editFocus}
                      onBlur={editBlur}
                    >
                      {[...OWNERS, editForm.owner].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i).map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Happiness */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Client Happiness</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {HAPPINESS_OPTIONS.map(opt => {
                      const active = editForm.happiness === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditForm(f => f && { ...f, happiness: opt.value })}
                          style={{
                            padding: '12px 10px', borderRadius: 10,
                            border: `2px solid ${active ? opt.accent : 'var(--border)'}`,
                            background: active ? opt.bg : 'var(--bg)',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 5, fontFamily: 'inherit',
                            transition: 'border-color 150ms ease, background 150ms ease',
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: active ? opt.accent : 'var(--text2)' }}>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Personality tags */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Personality Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {ALL_TAGS.map(tag => {
                      const active = editForm.personality_tags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setEditForm(f => f && ({
                            ...f,
                            personality_tags: f.personality_tags.includes(tag)
                              ? f.personality_tags.filter(t => t !== tag)
                              : [...f.personality_tags, tag],
                          }))}
                          style={{
                            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                            border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border)'}`,
                            background: active ? 'var(--charcoal)' : 'transparent',
                            color: active ? 'white' : 'var(--text2)',
                            cursor: 'pointer', transition: 'all 120ms ease', fontFamily: 'inherit',
                          }}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Communication style */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Communication Style</label>
                  <textarea
                    value={editForm.communication_style}
                    onChange={e => setEditForm(f => f && { ...f, communication_style: e.target.value })}
                    placeholder="How does this client prefer to communicate? What's their style?"
                    rows={3}
                    style={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
                </div>

                {/* Key interests */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Key Interests</label>
                  <textarea
                    value={editForm.key_interests}
                    onChange={e => setEditForm(f => f && { ...f, key_interests: e.target.value })}
                    placeholder="e.g. Tampa Bay Rays fan, loves modern design, rental income potential"
                    rows={2}
                    style={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
                </div>

                {/* Key priorities */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Key Priorities</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editForm.priorities.map((p, i) => (
                      <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 32px', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={p.text}
                          onChange={e => setEditForm(f => f && ({ ...f, priorities: f.priorities.map(x => x.id === p.id ? { ...x, text: e.target.value } : x) }))}
                          placeholder={`Priority ${i + 1}`}
                          style={{ ...editInputStyle, fontSize: 13 }}
                          onFocus={editFocus}
                          onBlur={editBlur}
                        />
                        <select
                          value={p.status}
                          onChange={e => setEditForm(f => f && ({ ...f, priorities: f.priorities.map(x => x.id === p.id ? { ...x, status: e.target.value as PriorityStatus } : x) }))}
                          style={{ ...editInputStyle, cursor: 'pointer', fontSize: 12 }}
                          onFocus={editFocus}
                          onBlur={editBlur}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditForm(f => f && ({ ...f, priorities: f.priorities.filter(x => x.id !== p.id) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1, padding: 0, fontFamily: 'inherit', textAlign: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
                        >×</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditForm(f => f && ({ ...f, priorities: [...f.priorities, { id: crypto.randomUUID(), text: '', status: 'unresolved' }] }))}
                      style={{ marginTop: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, fontWeight: 500, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
                    >
                      <span style={{ fontSize: 15 }}>+</span> Add priority
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { if (!savingClient) setEditForm(null) }}
                disabled={savingClient}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', background: 'transparent', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, cursor: savingClient ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!savingClient) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClient}
                disabled={savingClient}
                style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--charcoal)', border: 'none', padding: '8px 18px', borderRadius: 8, cursor: savingClient ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingClient ? 0.6 : 1 }}
                onMouseEnter={e => { if (!savingClient) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!savingClient) e.currentTarget.style.opacity = '1' }}
              >
                {savingClient ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <TopBar title="Active Clients" subtitle={client.name} />

      <div ref={containerRef} className="flex-1 overflow-y-auto animate-page-in" style={{ scrollbarGutter: 'stable' }}>
        <div style={{ maxWidth: 1180, padding: '28px 36px 90px' }}>
        <BackLink />

        {/* ── Hero (kept dark — it earned it) ───────────────────────────── */}
        <section
          className="rounded-[10px]"
          style={{
            background: 'var(--charcoal)',
            color: '#E8E8EB',
            padding: '22px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div className="flex items-start gap-4 min-w-0">
            {/* Avatar */}
            <div
              className="shrink-0 flex items-center justify-center rounded-full text-white font-semibold"
              style={{
                width: 46,
                height: 46,
                fontSize: 15,
                letterSpacing: '0.3px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            >
              {client.initials}
            </div>
            <div className="min-w-0">
              <div
                className="uppercase"
                style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
              >
                Customer Journey{client.project_type ? ` · ${client.project_type}` : ''}
              </div>
              <div className="flex items-center gap-2.5" style={{ marginTop: 3 }}>
                <h1
                  style={{
                    fontFamily: 'var(--font-fraunces), Georgia, serif',
                    fontWeight: 500,
                    fontSize: 28,
                    letterSpacing: '-0.015em',
                    color: '#fff',
                    lineHeight: 1.1,
                    margin: 0,
                  }}
                >
                  {client.name}
                </h1>
                <button
                  onClick={openEditModal}
                  title="Edit client"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 7,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 13, lineHeight: 1, cursor: 'pointer',
                    fontFamily: 'inherit', flexShrink: 0,
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                >
                  ✏️
                </button>
              </div>

              {/* Meta row — only non-empty fields, separators interleaved cleanly */}
              <div
                className="flex flex-wrap items-center"
                style={{ gap: '6px 14px', marginTop: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.66)' }}
              >
                {(() => {
                  const sep = (k: string) => <span key={k} style={{ color: 'rgba(255,255,255,0.28)' }}>·</span>
                  const nodes: React.ReactNode[] = []
                  if (client.location) nodes.push(<span key="loc">{client.location}</span>)
                  if (clientSince) nodes.push(<span key="since">Client since <b style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 550 }}>{clientSince}</b></span>)
                  if (client.owner) nodes.push(<span key="owner">Owner <b style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 550 }}>{client.owner}</b></span>)
                  if (client.email) nodes.push(
                    <button
                      key="email"
                      onClick={() => {
                        navigator.clipboard.writeText(client.email).then(() => {
                          setToast('Email copied to clipboard!')
                          setTimeout(() => setToast(null), 2000)
                        })
                      }}
                      title="Copy email"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,0.66)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.92)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.66)' }}
                    >
                      {client.email}
                    </button>
                  )
                  return nodes.flatMap((n, i) => (i === 0 ? [n] : [sep('s' + i), n]))
                })()}
              </div>
            </div>
          </div>

          {/* Project value */}
          <div className="text-right shrink-0">
            {client.project_value > 0 && (
              <>
                <div
                  className="uppercase"
                  style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
                >
                  Project Value
                </div>
                <div
                  style={{ fontSize: 26, fontWeight: 650, color: '#fff', letterSpacing: '-0.02em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCurrency(client.project_value)}
                </div>
              </>
            )}
            <div
              className="inline-flex items-center"
              style={{ gap: 6, marginTop: client.project_value > 0 ? 9 : 0, fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: happiness.accent }} />
              {sentiment}{lastUpdated ? ` · updated ${lastUpdated}` : ''}
            </div>
          </div>
        </section>

        {/* ── Next step (computed from the journey) ─────────────────────── */}
        {nextMeetingDef && (
          <section
            className="rounded-[10px]"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--white)',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '16px 20px',
              marginBottom: 24,
            }}
          >
            <span style={{ width: 3, alignSelf: 'stretch', background: 'var(--fable-red)', borderRadius: 3, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div
                className="uppercase"
                style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--text3)', fontWeight: 700 }}
              >
                Next step{currentPhase ? ` · ${currentPhase.label}` : ''}
              </div>
              <div
                style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginTop: 4, color: 'var(--text)' }}
              >
                {nextMeetingDef.title}
              </div>
              {nextStepDesc && (
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{nextStepDesc}</div>
              )}
            </div>
            <button
              onClick={() => setAiOpen(true)}
              style={nextBtn}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Draft follow-up
            </button>
            <button
              onClick={() => journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ ...nextBtn, background: 'var(--charcoal)', borderColor: 'var(--charcoal)', color: '#fff' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              Schedule meeting →
            </button>
          </section>
        )}

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24, alignItems: 'start' }}>

          {/* ===== Left column ===== */}
          <div className="flex flex-col gap-5">

            {/* Personality & Communication — hidden when all fields are empty */}
            {(client.personality_tags.length > 0 || hasInterests || hasComm || hasTip) && (
            <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
              <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
                <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Personality &amp; Communication</h2>
              </div>
              <div style={{ padding: '15px 17px' }}>
                {client.personality_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 13 }}>
                    {client.personality_tags.map(tag => (
                      <span
                        key={tag}
                        style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 11px', background: 'var(--surface2)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {hasInterests && (
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, margin: 0 }}>{client.key_interests}</p>
                )}

                {hasComm && (
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, margin: hasInterests ? '8px 0 0' : 0 }}>{client.communication_style}</p>
                )}

                {hasTip && (
                  <div
                    style={{ marginTop: 14, borderLeft: '3px solid var(--fable-red)', background: 'var(--red-soft)', borderRadius: '0 7px 7px 0', padding: '11px 14px' }}
                  >
                    <h3 className="uppercase" style={{ fontSize: 10.5, letterSpacing: '0.11em', color: 'var(--fable-red)', fontWeight: 700, marginBottom: 6 }}>
                      How to communicate with {firstName}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>{client.ai_tip}</p>
                  </div>
                )}
              </div>
            </div>
            )}{/* /Personality & Communication */}

            {/* Key Priorities — hidden entirely when empty or all items have blank text */}
            {client.priorities.some(p => p.text.trim()) && (
              <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
                <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
                  <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Key Priorities</h2>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>From meeting recaps</span>
                </div>
                <div style={{ padding: '6px 17px' }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {client.priorities.filter(p => p.text.trim()).map((p, i, arr) => {
                      const cfg = PRIORITY_CONFIG[p.status]
                      const statusLabel = p.status === 'done' ? 'Done' : p.status === 'in_progress' ? 'In Progress' : 'Unresolved'
                      return (
                        <li
                          key={i}
                          style={{ display: 'flex', gap: 11, padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 7, flexShrink: 0, background: cfg.dot }} />
                          <div>
                            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text)', textDecoration: cfg.strike ? 'line-through' : 'none', opacity: cfg.strike ? 0.7 : 1 }}>
                              {p.text}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                              <b style={{ color: cfg.color, fontWeight: 600 }}>{statusLabel}</b>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}

          </div>{/* /left column */}

          {/* ===== Right column ===== */}
          <div className="flex flex-col gap-5">

        {/* ── Pending Emails ───────────────────────────────────────────── */}
        {emailDrafts.length > 0 && (
          <div
            className="rounded-lg p-5"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            {/* Custom amber header for actionable drafts */}
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
          <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
            <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
              <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Sent Emails</h2>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{sentEmails.length} sent</span>
            </div>
            <div>
              {sentEmails.map((sent, i) => {
                const title = allMeetingDefs.find(m => m.code === sent.email_code)?.title ?? sent.subject
                const when = sent.sent_at
                  ? new Date(sent.sent_at).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'long', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })
                  : ''
                return (
                  <div
                    key={sent.id}
                    className="flex items-center"
                    style={{ gap: 12, padding: '11px 17px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                    onClick={() => setViewSentEmail(sent)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span
                      className="shrink-0 flex items-center justify-center"
                      style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--fable-ok-soft)', color: 'var(--fable-ok)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 6l-10 7L2 6" />
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 550, letterSpacing: '-0.005em', color: 'var(--text)' }}>{title}</div>
                      {when && (
                        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{when} ET · delivered</div>
                      )}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 550, color: 'var(--text)', flexShrink: 0 }}>View →</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Meeting Journey ───────────────────────────────────────────── */}
        <div ref={journeyRef} className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
          <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Meeting Journey</h2>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
              {completedCount} of 18 meetings{sentEmailCount > 0 ? ` · ${sentEmailCount} emails` : ''}
            </span>
          </div>

          {/* Progress */}
          <div className="flex items-center" style={{ gap: 12, padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <b style={{ fontWeight: 600, color: 'var(--text)' }}>{completedCount} of 18</b> complete
            </span>
            <span className="flex-1 overflow-hidden" style={{ height: 5, borderRadius: 99, background: 'var(--surface2)' }}>
              <span style={{ display: 'block', height: '100%', width: `${journeyPct}%`, background: happiness.accent, borderRadius: 99, transition: 'width 400ms ease' }} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{journeyPct}%</span>
          </div>

          <div style={{ padding: '2px 17px 8px' }}>
            <div className="uppercase" style={{ fontSize: 10.5, letterSpacing: '0.11em', color: 'var(--text3)', fontWeight: 700, padding: '11px 0 3px' }}>
              Pre-Construction
            </div>
            {JOURNEY_PHASES.filter(p => p.number <= 5).map(phase => (
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
                isCurrent={phase.number === currentPhaseNumber}
                isDone={phase.meetings.every(m => journeyRows.get(m.code)?.completed)}
                defaultExpanded={phase.number === currentPhaseNumber}
                checklistTemplates={checklistTemplates}
                checklistRows={checklistRows}
                checklistToggling={checklistToggling}
                onToggleChecklist={toggleChecklistTask}
              />
            ))}

            <div className="uppercase" style={{ fontSize: 10.5, letterSpacing: '0.11em', color: 'var(--text3)', fontWeight: 700, padding: '14px 0 3px' }}>
              Construction
            </div>
            {JOURNEY_PHASES.filter(p => p.number >= 6).map(phase => (
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
                isCurrent={phase.number === currentPhaseNumber}
                isDone={phase.meetings.every(m => journeyRows.get(m.code)?.completed)}
                defaultExpanded={phase.number === currentPhaseNumber}
                checklistTemplates={checklistTemplates}
                checklistRows={checklistRows}
                checklistToggling={checklistToggling}
                onToggleChecklist={toggleChecklistTask}
              />
            ))}
          </div>
        </div>

          </div>{/* /right column */}
        </div>{/* /two-column layout */}
        </div>{/* /max-width wrapper */}
      </div>

      {/* ── CASK Intelligence (floating) ──────────────────────────────── */}
      <FloatingClientAI
        client={client}
        journeyRows={journeyRows}
        messages={chatMessages}
        onSend={handleChatSend}
        onClear={clearHistory}
        open={aiOpen}
        onOpenChange={setAiOpen}
      />
    </>
  )
}
