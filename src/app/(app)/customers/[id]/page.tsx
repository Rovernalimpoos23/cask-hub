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
// NEW (additive): shared task due-date / overdue helpers (this page keeps its own
// inline WORKFLOW_STEPS — only the pure timeline helpers are imported here).
import { computeTaskDueDate, getTaskDueState, daysUntilDue } from '@/lib/workflow-steps'

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

// NEW (additive): a file uploaded to Supabase Storage for this client.
interface ClientFile {
  id: string
  client_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_by: string | null
  uploaded_at: string
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

// NEW (additive): human-readable file size (KB / MB) for the Project Files list.
function formatFileSize(bytes: number): string {
  if (bytes == null || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// NEW (additive): pick a file icon from MIME type (falling back to extension).
function fileIcon(type: string, name: string): string {
  const t = (type || '').toLowerCase()
  const n = (name || '').toLowerCase()
  if (t.includes('image') || /\.(jpe?g|png|gif|webp)$/.test(n)) return '🖼'
  if (t.includes('sheet') || t.includes('excel') || /\.(xlsx?|csv)$/.test(n)) return '📊'
  return '📄'
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

// ── Role-based checklist persistence (journey_checklists) ─────────────────────
// Per-client checkbox state. Keyed by meeting_code + role + task_text so the
// same task text under different roles/steps never collides. We no longer track
// the DB row id locally — toggles match rows by these columns (see
// toggleChecklistTask), which is robust against RLS read-back quirks.
interface ChecklistRowState {
  completed: boolean
}

// Build the lookup key used to match a workflow task to its per-client row.
function checklistKey(meetingCode: string, role: string, taskText: string) {
  return `${meetingCode}||${role}||${taskText}`
}

// ── 33-step Customer Journey workflow ─────────────────────────────────────────

type WorkflowRole =
  | 'sales_pm' | 'architect' | 'estimator'
  | 'selection_mgr' | 'construction_pm' | 'permit_dept'
type StepType = 'internal' | 'window' | 'customer'

interface WorkflowRoleTasks { role: WorkflowRole; color: string; tasks: string[] }
interface WorkflowStepDef {
  step: number
  type: StepType
  title: string
  subtitle: string
  timeWindow: string | null
  hasEmail?: boolean
  roles: WorkflowRoleTasks[]
}

// Display names for each role used in the workflow.
const ROLE_NAMES: Record<string, string> = {
  sales_pm: 'Sales PM',
  architect: 'Architect',
  estimator: 'Estimator',
  selection_mgr: 'Selection Manager',
  construction_pm: 'Construction PM',
  permit_dept: 'Permit Dept',
}

// Per-type left-bar color + badge styling.
const STEP_TYPE_CONFIG: Record<StepType, { bar: string; label: string; badgeBg: string; badgeText: string }> = {
  internal: { bar: '#6366f1', label: 'Internal',    badgeBg: '#eef2ff', badgeText: '#4338ca' },
  window:   { bar: '#f59e0b', label: 'Work Window', badgeBg: '#fffbeb', badgeText: '#92400e' },
  customer: { bar: '#ef4444', label: 'Customer',    badgeBg: '#fef2f2', badgeText: '#b91c1c' },
}

// meeting_code used to persist checklist state for a given step (e.g. "step_07").
function stepCode(step: number) {
  return `step_${String(step).padStart(2, '0')}`
}

const WORKFLOW_STEPS: WorkflowStepDef[] = [
  { step: 1, type: 'internal', title: 'Internal Sales-to-Precon Pass-Off', subtitle: 'Internal meeting · handoff', timeWindow: null, roles: [] },
  { step: 2, type: 'window', title: 'After Internal Pass-Off', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Create a set of plans for the alignment meeting'] }
  ]},
  { step: 3, type: 'window', title: 'Before Customer Alignment', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Fill Customer Journey Booklet with dates & contact info; staple business card', 'Print contract template', 'Print Contract Alignment Guide', 'Prefill timeline / contract price on the Contract Alignment Guide from the internal pass-off'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Prefill the design portion of the Alignment Meeting agenda with info from the internal pass-off', 'Print Plans and Architect Guide Agenda'] }
  ]},
  { step: 4, type: 'customer', title: 'Customer Alignment Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present CASK and the team', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule next meeting'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Run through the Architect Guide Agenda', 'Inform customer about Sewer Survey'] }
  ]},
  { step: 5, type: 'window', title: 'After Alignment', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Sales PM (12 hr)', 'Work on 1st design set of plans', 'Send 1st design set to Estimator', 'Request sanitary survey'] }
  ]},
  { step: 6, type: 'window', title: 'Before 1st Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Sales PM (48 hr before)'] }
  ]},
  { step: 7, type: 'customer', title: '1st Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule flag meeting & 2nd design meeting'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Present Alignment Meeting Plans', 'Run through the Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 8, type: 'window', title: 'After 1st Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Sales PM (12 hr)', 'Work on 2nd design set of plans', 'Print Plans and Architect Guide Agenda'] }
  ]},
  { step: 9, type: 'customer', title: 'Flag Meeting', subtitle: 'Customer meeting · on site', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Present 1st Design Meeting Plans', 'Run through the Architect Guide Agenda'] }
  ]},
  { step: 10, type: 'window', title: 'After Flag Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Technical recap email to customer with photos & notes (24 hr)', 'Mark up plans with technical info from flag', 'Send plans to Estimator (4 days before 2nd design meeting)'] }
  ]},
  { step: 11, type: 'window', title: 'Before 2nd Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Sales PM (48 hr before)'] }
  ]},
  { step: 12, type: 'customer', title: '2nd Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule next meeting (possible 3rd design, or contract review + permit submission)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Drawing questions agenda; present 2nd design set of plans'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 13, type: 'window', title: 'After Last Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Technical recap email to Sales PM', 'Prepare permit set of drawings with engineer details (bid-ready)'] }
  ]},
  { step: 14, type: 'window', title: 'Permit Prep & Bid', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Send plans to Estimator & Permit Dept', 'Energy calc and engineer sign & seal'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send out for bid'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Draft permit application'] }
  ]},
  { step: 15, type: 'window', title: 'Permit Submission', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Email customer that plans are in for permit'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Send permit set & energy calc to Permit Dept'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Submit for permit', 'Email Sales PM confirming permit submission'] }
  ]},
  { step: 16, type: 'window', title: 'Contract Draft & Permit Tracking', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Create 3D walkthrough with included selections'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Draft contract and review bid; send for scope revision', 'Schedule contract review meeting with Sales PM'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Check permit status', 'Send RFC to Architect, Sales & Estimator', 'Resubmit for permit (own the resubmission turnaround)', 'Receive permit approval'] }
  ]},
  { step: 17, type: 'window', title: 'Contract Finalization', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Finalize contract', 'Send finalized contract to Sales PM'] }
  ]},
  { step: 18, type: 'internal', title: 'Contract Review — Estimator / Sales PM', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review contract with Estimator'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Explain contract', 'Go through detail comparing Architect Agenda Notes, Drawing and Scope of work'] }
  ]},
  { step: 19, type: 'window', title: 'After Contract Review with Estimator', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Call client to confirm price alignment ahead of execution'] }
  ]},
  { step: 20, type: 'customer', title: 'Contract Review', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review Alignment Guide', 'Review boilerplate', 'Review scope', 'Sign contract', 'Discuss timeline & schedule tentative kick-off (~6 weeks out)', 'Schedule selection meeting'] }
  ]},
  { step: 21, type: 'window', title: 'After Contract Review', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email with executed contract (or, if unsigned, the decision made in the meeting)'] }
  ]},
  { step: 22, type: 'internal', title: 'Selection Internal Alignment', subtitle: 'Internal meeting · before selection meeting', timeWindow: null, roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Meet with Selection Manager to decide needed selections and allowances (e.g., $3.50/sqft for tile)'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Update the selection template with the necessary items'] }
  ]},
  { step: 23, type: 'internal', title: 'Pass-Off: Estimator to Construction Manager', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present customer info and purpose statement'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Run the meeting to hand off scope of work and contract info to the Construction PM'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Begin learning the project'] }
  ]},
  { step: 24, type: 'customer', title: 'Selection Meeting 1', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Assist with walkthrough and any plan markups (set rules for when modifications carry a cost implication)'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 25, type: 'window', title: 'After Selection Meeting 1', subtitle: 'Work window · ½ week', timeWindow: '½ week', hasEmail: true, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Send red markups to Construction Manager for any needed change orders'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send email to Sales PM if we are out of price'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer'] }
  ]},
  { step: 26, type: 'window', title: 'Before Selection Meeting 2', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Contact homeowner if selections and contract price are misaligned'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Work on change order', 'Email Sales PM & Selection if modifications exceed $4k', 'Request sub card, create PO, organize field pass-off, reconcile change-order allowances before breaking ground'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Email Estimator and Sales PM only if customer chooses items outside the allowance'] }
  ]},
  { step: 27, type: 'customer', title: 'Selection Meeting 2', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 28, type: 'window', title: 'After / Before Next Selection Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer', 'Email Estimator & Sales PM only if customer chooses items outside the allowance'] }
  ]},
  { step: 29, type: 'customer', title: 'Selection Meeting Final', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 30, type: 'window', title: 'After Final Selection Meeting', subtitle: 'Work window · ½ week', timeWindow: '½ week', hasEmail: true, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer', 'Email Estimator & Sales PM only if customer chooses items outside the allowance'] }
  ]},
  { step: 31, type: 'window', title: 'Before Final Pass-Off', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send change-order reconciliation allowance to customer for approval'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send change-order reconciliation allowance to Sales PM', 'Internal CM-to-Super pass-off'] }
  ]},
  { step: 32, type: 'internal', title: 'Final Pass-Off: Estimator to Construction Manager', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present customer info and purpose statement'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Run the meeting to hand off scope of work and contract info to the Construction PM'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Go through the selection choices from the customer'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Learn as much as possible about the project'] }
  ]},
  { step: 33, type: 'customer', title: 'Kick-Off Meeting', subtitle: 'Customer meeting · construction begins', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Introduce Construction Manager and Superintendent'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Take over and run the agenda'] }
  ]}
]

const TOTAL_WORKFLOW_STEPS = WORKFLOW_STEPS.length

// ── Workflow step card (replaces PhaseCard) ───────────────────────────────────

const workflowActionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
  color: 'var(--text2)', background: 'var(--white)', border: '1px solid var(--border)',
  padding: '4px 9px', borderRadius: 5, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
}

function WorkflowStep({
  step,
  isCompleted,
  isCurrent,
  defaultExpanded,
  checklistRows,
  checklistToggling,
  onToggleChecklist,
  marking,
  onMarkComplete,
  onAction,
  hasRecap,
}: {
  step: WorkflowStepDef
  isCompleted: boolean
  isCurrent: boolean
  defaultExpanded: boolean
  checklistRows: Map<string, ChecklistRowState>
  checklistToggling: Set<string>
  onToggleChecklist: (meetingCode: string, role: string, taskText: string, next: boolean) => void
  marking: boolean
  onMarkComplete: (stepNumber: number, completed: boolean) => void
  onAction: (kind: 'agenda' | 'recap' | 'email', step: WorkflowStepDef) => void
  // True when a saved recap (client_meetings row) exists for this step.
  hasRecap: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // `defaultExpanded` depends on the current step, which is only known after the
  // async step-completions load resolves. useState locks in its first value, so
  // sync `expanded` whenever `defaultExpanded` flips (e.g. step 1 → real current
  // step once data arrives). Only reacts to default changes, so a user's manual
  // expand/collapse during a stable period is left untouched.
  const prevDefaultExpanded = useRef(defaultExpanded)
  useEffect(() => {
    if (defaultExpanded !== prevDefaultExpanded.current) {
      prevDefaultExpanded.current = defaultExpanded
      setExpanded(defaultExpanded)
    }
  }, [defaultExpanded])
  const cfg = STEP_TYPE_CONFIG[step.type]
  const code = stepCode(step.step)
  const isCustomer = step.type === 'customer'

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        // 3px colored bar by type; current step gets a red bar on the whole row.
        borderLeft: isCurrent ? '3px solid #ef4444' : `3px solid ${cfg.bar}`,
        background: 'var(--white)',
      }}
    >
      {/* Header row — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left"
        style={{ display: 'flex', alignItems: 'stretch', gap: 11, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {/* Step number column */}
        <span
          className="shrink-0"
          style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}
        >
          {String(step.step).padStart(2, '0')}
        </span>

        {/* Title + subtitle */}
        <span className="flex-1" style={{ padding: '10px 0', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{step.title}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{step.subtitle}</span>
        </span>

        {/* Type badge */}
        <span
          className="shrink-0 self-center"
          style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: cfg.badgeText, background: cfg.badgeBg, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}
        >
          {cfg.label}
        </span>

        {/* Status badge */}
        {isCompleted ? (
          <span className="shrink-0 self-center" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
            Done
          </span>
        ) : isCurrent ? (
          <span className="shrink-0 self-center" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fable-red)', whiteSpace: 'nowrap' }}>
            Current
          </span>
        ) : null}

        {/* Chevron */}
        <span className="shrink-0 self-center" style={{ color: 'var(--text3)', fontSize: 11, paddingRight: 12, transition: 'transform 200ms ease', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', padding: '13px 15px 13px 43px' }}>
          {/* Time window pill */}
          {step.timeWindow && (
            <div style={{ marginBottom: 11 }}>
              <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--text2)', border: '0.5px solid var(--border)', background: 'var(--white)', borderRadius: 99, padding: '2px 8px' }}>
                ⏱ {step.timeWindow}
              </span>
            </div>
          )}

          {/* Role columns — one card per role */}
          {step.roles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {step.roles.map(roleBlock => (
                <div
                  key={roleBlock.role}
                  style={{ flex: '1 1 240px', minWidth: 220, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}
                >
                  {/* Role header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: roleBlock.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text2)' }}>
                      {ROLE_NAMES[roleBlock.role] ?? roleBlock.role}
                    </span>
                  </div>

                  {/* Tasks with checkboxes (persist via existing journey_checklists) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {roleBlock.tasks.map((task, ti) => {
                      const key = checklistKey(code, roleBlock.role, task)
                      const checked = checklistRows.get(key)?.completed ?? false
                      const busy = checklistToggling.has(key)
                      return (
                        <button
                          key={ti}
                          type="button"
                          onClick={() => { if (!busy) onToggleChecklist(code, roleBlock.role, task, !checked) }}
                          disabled={busy}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}
                        >
                          <span
                            className="shrink-0"
                            style={{ width: 14, height: 14, borderRadius: 3, border: checked ? '1.5px solid var(--charcoal)' : '1.5px solid var(--border2)', background: checked ? 'var(--charcoal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'background 120ms ease, border-color 120ms ease' }}
                          >
                            {checked && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            )}
                          </span>
                          <span style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--text)', opacity: checked ? 0.5 : 1, textDecoration: checked ? 'line-through' : 'none' }}>
                            {task}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {isCustomer && (
              <button type="button" onClick={() => onAction('agenda', step)} style={workflowActionBtn}>📋 View Agenda</button>
            )}
            {(isCustomer || step.type === 'internal') && (
              <button
                type="button"
                onClick={() => onAction('recap', step)}
                style={hasRecap
                  ? { ...workflowActionBtn, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', fontWeight: 600 }
                  : { ...workflowActionBtn, color: 'var(--text3)', opacity: 0.5, cursor: 'not-allowed' }}
              >
                🎙️ View Recap
              </button>
            )}
            {step.hasEmail && (
              <button type="button" onClick={() => onAction('email', step)} style={{ ...workflowActionBtn, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', fontWeight: 600 }}>✉️ Generate Recap Email</button>
            )}
            <button
              type="button"
              onClick={() => onMarkComplete(step.step, !isCompleted)}
              disabled={marking}
              style={{
                ...workflowActionBtn,
                color: isCompleted ? '#166534' : '#fff',
                background: isCompleted ? '#f0fdf4' : 'var(--charcoal)',
                border: isCompleted ? '1px solid #bbf7d0' : '1px solid var(--charcoal)',
                fontWeight: 600,
                cursor: marking ? 'not-allowed' : 'pointer',
                opacity: marking ? 0.5 : 1,
              }}
            >
              {marking ? '…' : isCompleted ? '✓ Completed' : 'Mark Complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Standing Agenda (NEW — additive feature) ──────────────────────────────────
// Per-client, editable "living record" of architect design decisions. Saves to
// client_agenda_header (one row/client) + client_standing_agenda (one row per
// answered question). Fully self-contained: own state, own fetch, own save.

interface AgendaQuestion {
  key: string
  text: string
  tags: string[]
  type: 'notes' | 'options_notes'
  options?: string[]
}
interface AgendaSectionDef {
  code: string
  name: string
  questions: AgendaQuestion[]
}

const AGENDA_SECTIONS: AgendaSectionDef[] = [
  {
    code: '01 00 00',
    name: 'General Requirements',
    questions: [
      { key: 'sign_placement', text: 'Construction sign placement — where can it be staked for visibility?', tags: ['FLAG'], type: 'notes' },
      { key: 'site_access', text: 'Site access — how will construction vehicles and deliveries reach the site?', tags: ['FLAG'], type: 'notes' },
      { key: 'permitting_path', text: 'Permitting path — municipality, expeditor needed, anticipated review timeline?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'notes' },
    ]
  },
  {
    code: '02 00 00',
    name: 'Existing Conditions',
    questions: [
      { key: 'trees_landscaping', text: 'Trees or landscaping that affect the project — any to be removed or protected?', tags: ['1ST DESIGN', 'FLAG'], type: 'notes' },
      { key: 'existing_structures', text: 'Existing structures to demolish (full or selective)? Describe scope.', tags: ['1ST DESIGN', 'FLAG'], type: 'options_notes', options: ['Full structure demo', 'Selective / partial demo', 'None'] },
      { key: 'existing_driveway', text: 'Existing driveway / pavers / hardscape to remove?', tags: ['FLAG'], type: 'options_notes', options: ['Driveway demo', 'Paver removal', 'None'] },
    ]
  },
  {
    code: '03 00 00',
    name: 'Concrete',
    questions: [
      { key: 'foundation_type', text: 'Foundation type for site conditions (slab, stem wall, elevated/coastal)?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'notes' },
      { key: 'wall_type', text: 'Wall type / material — block vs. wood by floor', tags: ['1ST DESIGN'], type: 'options_notes', options: ['1st floor block, 2nd floor wood (standard)', '1st floor block (single story)', '1st floor wood', '1st & 2nd floor wood', '1st & 2nd floor block'] },
      { key: 'driveway_surface', text: 'Driveway surface selection', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Crushed limestone (durable, affordable)', 'Concrete ($) — clean classic', 'Brick pavers ($$) — upscale'] },
      { key: 'parking_pad', text: 'Parking pad / apron surface selection', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Crushed limestone', 'Concrete ($)', 'Brick pavers ($$)'] },
      { key: 'swale_drainage', text: 'Swale / drainage grading', tags: ['FLAG', '2ND DESIGN'], type: 'notes' },
    ]
  },
  {
    code: '06 00 00',
    name: 'Wood, Plastics & Composites',
    questions: [
      { key: 'num_stories', text: 'Number of stories / floors (drives framing, pilings, structure cost)?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'notes' },
      { key: 'ceiling_height', text: 'Floor-to-ceiling height — by floor?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['8 ft (standard, cost-effective)', '9 ft ($) more open', '10 ft ($$) high-end'] },
      { key: 'pilings', text: 'Elevated foundation pilings required (coastal / flood)? Engineered depth?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Wood pilings required', 'Conventional foundation'] },
      { key: 'roof_structure', text: 'Roof structure — vaulted or not vaulted?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Flat / standard truss (standard)', 'Vaulted ($) — open & spacious'] },
      { key: 'staircase', text: 'Staircase & railing — any upgrade?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Standard pressure-treated (included)', 'Upgrade (specify below)'] },
      { key: 'decking', text: 'Decking material — do they want Trex?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Pressure-treated lumber (standard)', 'Trex / composite ($)'] },
      { key: 'deck_columns', text: 'Wrap the deck columns with siding?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Yes — wrap columns in siding', 'No — leave exposed'] },
    ]
  },
  {
    code: '07 00 00',
    name: 'Thermal & Moisture Protection',
    questions: [
      { key: 'roof_system', text: 'Roof system selection', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Shingle (standard)', 'Architectural shingle ($)', 'TPO ($)', 'Flat roof ($)', 'Clay shingle ($$)'] },
      { key: 'insulation', text: 'Insulation approach', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Foam (traditional HVAC) + batt in walls', 'Batt in ceiling + cold floor (mini-split)'] },
      { key: 'garage_insulation', text: 'Does the garage need to be insulated?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Yes — insulate garage', 'No'] },
      { key: 'gutters', text: 'Gutters — always included; which type?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Standard gutter (included)', 'Round copper gutter ($)'] },
    ]
  },
  {
    code: '08 00 00',
    name: 'Openings',
    questions: [
      { key: 'window_color', text: 'Window color & brand', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['White, MI brand w/ PGT sliding (standard)', 'All PGT ($)'] },
      { key: 'window_style', text: 'Window style', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Single hung (standard)', 'Roller / other ($) — specify'] },
      { key: 'frosted_glass', text: 'Frosted glass in the bathroom?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Yes — frosted bathroom window', 'No'] },
      { key: 'garage_door', text: 'Garage door — included? Height & insulation?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['7 ft (standard vehicles)', '8 ft ($$) taller / grander', 'Insulated garage door', 'No garage door'] },
      { key: 'screened_porch', text: 'Screened porch — in scope?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Include (added to contract)', 'Exclude / allowance'] },
      { key: 'exterior_doors', text: 'Exterior doors — glass & height?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['With glass', 'Without glass', '6/8 height (standard)', '8 ft height ($)'] },
      { key: 'interior_doors', text: 'Interior door height?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['6/8 height (standard)', '8 ft height ($)'] },
    ]
  },
  {
    code: '09 00 00',
    name: 'Finishes',
    questions: [
      { key: 'wall_texture', text: 'Wall & ceiling texture', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Orange peel walls / knock-down ceiling (standard)', 'Smooth — Level 4 ($)'] },
      { key: 'garage_drywall', text: 'Garage drywall — finish the garage?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Yes ($) clean finished look', 'Ceiling only (standard)', 'No — unfinished'] },
      { key: 'flooring', text: 'Flooring — LVP is included throughout. Upgrade?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['LVP throughout (standard)', 'Tile throughout', 'Hardwood throughout', 'Tile in bathrooms + LVP elsewhere', 'Hardwood throughout + tile in bathrooms'] },
      { key: 'backsplash', text: 'Backsplash — included?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Yes — include backsplash', 'No'] },
      { key: 'paint', text: 'Paint — any extra paint scope (e.g. main house)?', tags: ['2ND DESIGN'], type: 'notes' },
      { key: 'window_casing', text: 'Casing around the windows?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Drywall return (included)', 'Wood casing ($)', 'Marble sill ($)'] },
    ]
  },
  {
    code: '10 00 00',
    name: 'Specialties',
    questions: [
      { key: 'shower_glass', text: 'Shower / tub glass — do they want custom?', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Without glass (standard)', 'Custom glass ($)'] },
    ]
  },
  {
    code: '11 00 00',
    name: 'Equipment',
    questions: [
      { key: 'appliances', text: 'Appliance package — include all appliances + washer & dryer?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Low — Frigidaire', 'Mid — Samsung', 'High — specialties ($$)'] },
    ]
  },
  {
    code: '12 00 00',
    name: 'Furnishings',
    questions: [
      { key: 'cabinet_construction', text: 'Cabinet construction', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Semi-custom (standard)', 'Full custom (+$15K, depends on size)'] },
      { key: 'cabinet_style', text: 'Cabinet style', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Shaker', 'Euro'] },
      { key: 'vanity', text: 'Vanity', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Standard with custom counter', 'Floating'] },
      { key: 'countertop', text: 'Countertop material', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Quartz Level 1 (standard)', 'Granite, construction grade (cheaper)', 'Special stone ($)'] },
      { key: 'kitchen_sink', text: 'Kitchen sink', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Single bowl undermount (standard)', 'Farmhouse ($) — must be accounted for'] },
      { key: 'bathroom_sink', text: 'Bathroom sink', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Square undermount (standard)', 'Floating (specify)'] },
    ]
  },
  {
    code: '22 00 00',
    name: 'Plumbing',
    questions: [
      { key: 'laundry_location', text: 'Laundry location — where do washer/dryer go?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Upstairs (near bedrooms)', 'Garage', 'Lower level / utility', 'No laundry'] },
      { key: 'water_heater', text: 'Water heater', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Traditional tank', 'Instant / tankless'] },
      { key: 'plumbing_fixtures', text: 'Plumbing fixtures', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Low', 'Mid — Delta (included)', 'High end ($)'] },
      { key: 'gas_service', text: 'Gas service — in scope for this project?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Gas included (added to scope)', 'Excluded'] },
      { key: 'water_utility', text: 'Water utility — connection & metering', tags: ['FLAG', '2ND DESIGN'], type: 'options_notes', options: ['Connect to main house', 'Separate water meter ($2K + separate bill)'] },
    ]
  },
  {
    code: '23 00 00',
    name: 'HVAC',
    questions: [
      { key: 'hvac_type', text: 'HVAC system type & efficiency goal?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Ducted central', 'Ductless mini-split', 'Ducted mini-split'] },
      { key: 'air_handler', text: 'Air handler location?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Attic (saves floor space)', 'Mini-split wall units (room control)', 'Other (specify)'] },
      { key: 'kitchen_hood', text: 'Kitchen hood', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Microwave used as hood', 'Design hood'] },
    ]
  },
  {
    code: '26 00 00',
    name: 'Electrical',
    questions: [
      { key: 'electrical_meter', text: 'Electrical meter configuration', tags: ['FLAG', '2ND DESIGN'], type: 'options_notes', options: ['1 meter for ADU — don\'t touch main house', '2 meters — ADU + move main-house meter to ADU if line is on the way ($3K)', '1 meter on house feeding ADU ($3K)', '1 meter moved from house to ADU, feeding house from ADU ($3K)'] },
      { key: 'elevator', text: 'Elevator — in scope?', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['Yes — add $50K', 'Not needed'] },
      { key: 'light_fixtures', text: 'Light fixtures', tags: ['2ND DESIGN'], type: 'options_notes', options: ['Low — construction grade', 'Mid (included)', 'High end ($)'] },
      { key: 'special_electrical', text: 'Special electrical', tags: ['1ST DESIGN', '2ND DESIGN'], type: 'options_notes', options: ['EV charger', 'Generator', 'Low voltage in kitchen ($2K)', 'Data box'] },
    ]
  },
]

// Tag pill colors.
const AGENDA_TAG_STYLES: Record<string, { bg: string; color: string }> = {
  '1ST DESIGN': { bg: '#eff6ff', color: '#1d4ed8' },
  'FLAG':       { bg: '#fef2f2', color: '#b91c1c' },
  '2ND DESIGN': { bg: '#f0fdf4', color: '#166534' },
}

const SPECIAL_CONDITIONS = [
  'Historic district / overlay',
  'Coastal construction control line',
  'Flood zone',
  'None of these',
]

interface AgendaAnswer { answer: string; selected_options: string[] }
interface AgendaHeaderState {
  project_name: string
  project_address: string
  architect: string
  project_specialist: string
  estimator: string
  target_permit_date: string
  homeowners: string
  zoning: string
  special_conditions: string[]
  special_conditions_notes: string
  plumbing_survey_notes: string
  general_notes: string
}

function agendaKey(sectionCode: string, questionKey: string) {
  return `${sectionCode}||${questionKey}`
}

// Shared styles to match the rest of the page.
const agendaInputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '7px 9px', fontSize: 12, color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const agendaTextareaStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
  lineHeight: 1.45,
}
const agendaLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)',
}

// Small checkbox matching the existing checklist checkboxes in this file.
function AgendaCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className="shrink-0"
      style={{
        width: 14, height: 14, borderRadius: 3,
        border: checked ? '1.5px solid var(--charcoal)' : '1.5px solid var(--border2)',
        background: checked ? 'var(--charcoal)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      )}
    </span>
  )
}

// ── Standing Agenda audit trail (NEW — additive feature) ──────────────────────
// Field-level change history persisted to `agenda_audit_log`. Purely additive:
// existing save/upsert logic is extended, never replaced.

interface AuditEntry {
  section_code: string
  question_key: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string
}

// "section_code:question_key" — the key format used for the auditLog Map and popovers.
function auditEntryKey(sectionCode: string, questionKey: string) {
  return `${sectionCode}:${questionKey}`
}

// snake_case → Title Case (e.g. 'foundation_type' → 'Foundation Type').
function humanizeKey(key: string) {
  return key.split('_').map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

// Nicer labels for the header (project info) fields; falls back to humanizeKey.
const AGENDA_HEADER_LABELS: Record<string, string> = {
  project_name: 'Project Name',
  project_address: 'Project Address',
  architect: 'Architect',
  project_specialist: 'Project Specialist',
  estimator: 'Estimator',
  target_permit_date: 'Target Permit Submission Date',
  homeowners: 'Homeowner(s)',
  zoning: 'Zoning',
  special_conditions: 'Special Conditions',
  special_conditions_notes: 'Notes on Special Conditions & Impact',
  plumbing_survey_notes: 'Plumbing Survey Notes',
  general_notes: 'General Notes',
}

// The header keys tracked for audit (section_code === 'header').
const HEADER_AUDIT_KEYS: (keyof AgendaHeaderState)[] = [
  'project_name', 'project_address', 'architect', 'project_specialist',
  'estimator', 'target_permit_date', 'homeowners', 'zoning',
  'special_conditions', 'special_conditions_notes', 'plumbing_survey_notes', 'general_notes',
]

function auditFieldLabel(sectionCode: string, questionKey: string) {
  if (sectionCode === 'header') return AGENDA_HEADER_LABELS[questionKey] ?? humanizeKey(questionKey)
  return humanizeKey(questionKey)
}

// Render any stored value as a readable string (arrays joined with ", ").
function stringifyAuditValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Combined readable value for a question answer (selected options + notes).
function answerValueString(a: AgendaAnswer | undefined): string {
  if (!a) return ''
  const parts: string[] = []
  if (a.selected_options.length) parts.push(a.selected_options.join(', '))
  if (a.answer.trim()) parts.push(a.answer.trim())
  return parts.join(' — ')
}

// Relative time for the "Last updated" line.
function getRelativeTime(ts: string): string {
  const then = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const sameYear = then.getFullYear() === now.getFullYear()
  // Relative thresholds above use the true time difference; only the displayed
  // fallback date is converted to Eastern Time.
  return then.toLocaleDateString('en-US', sameYear
    ? { timeZone: 'America/New_York', month: 'short', day: 'numeric' }
    : { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
}

// Full date + time for the history popover, displayed in Eastern Time.
function formatAuditDateTime(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET'
}

function StandingAgenda({ clientId, clientName, clientProjectAddress, onToast }: { clientId: string; clientName: string; clientProjectAddress: string; onToast: (msg: string) => void }) {
  const [cardOpen, setCardOpen] = useState(true)
  // All sections collapsed by default.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [header, setHeader] = useState<AgendaHeaderState>({
    project_name: '', project_address: '', architect: '', project_specialist: '',
    estimator: '', target_permit_date: '', homeowners: '', zoning: '',
    special_conditions: [], special_conditions_notes: '', plumbing_survey_notes: '', general_notes: '',
  })
  const [answers, setAnswers] = useState<Map<string, AgendaAnswer>>(new Map())
  const [saving, setSaving] = useState(false)

  // ── Audit trail state (additive) ──────────────────────────────────────────
  // auditLog: "section_code:question_key" → entries (newest first).
  const [auditLog, setAuditLog] = useState<Map<string, AuditEntry[]>>(new Map())
  const [openHistoryKey, setOpenHistoryKey] = useState<string | null>(null)
  // Snapshot of the last-saved values so persist() can diff against them.
  const savedHeaderRef = useRef<AgendaHeaderState | null>(null)
  const savedAnswersRef = useRef<Map<string, AgendaAnswer>>(new Map())
  // Current user (id + display name) for changed_by / changed_by_name.
  const auditUserRef = useRef<{ id: string | null; name: string }>({ id: null, name: '' })

  // Resolve the current user once for audit attribution.
  // NOTE: supabase.auth.getUser() returns the AUTH user id, which differs from
  // the public.users id (the emails match, the UUIDs do not). Look the user up
  // by email so changed_by carries the correct public.users id and name.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('email', user.email)
          .single()
        if (active && userData) {
          auditUserRef.current = { id: userData.id ?? null, name: userData.name ?? user.email ?? '' }
        }
      } catch (err) {
        console.error('[standing-agenda] audit user lookup failed:', err)
      }
    })()
    return () => { active = false }
  }, [])

  // Fetch this client's full audit trail and rebuild the auditLog Map. Reusable
  // so we can refresh both on mount AND right after a save (the authoritative
  // source of truth — does not depend on insert().select() returning rows).
  const fetchAuditLog = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('agenda_audit_log')
        .select('*')
        .eq('client_id', clientId)
        .order('changed_at', { ascending: false })
      if (error) {
        console.error('[standing-agenda] audit log fetch error:', error)
        return
      }
      if (!data) return
      const m = new Map<string, AuditEntry[]>()
      for (const row of data as AuditEntry[]) {
        const key = auditEntryKey(row.section_code, row.question_key)
        const arr = m.get(key) ?? []
        arr.push(row) // query already sorts changed_at desc
        m.set(key, arr)
      }
      console.log('[standing-agenda] audit log fetched:', data.length, 'rows; keys:', Array.from(m.keys()))
      setAuditLog(m)
    } catch (err) {
      console.error('[standing-agenda] audit log fetch failed:', err)
    }
  }, [clientId])

  // Fetch this client's full audit trail on mount.
  useEffect(() => { fetchAuditLog() }, [fetchAuditLog])

  // Insert audit rows for any fields that changed between two snapshots, then
  // re-fetch the audit log so the UI reflects the new rows.
  async function logAuditTrail(
    supabase: ReturnType<typeof createClient>,
    prevHeader: AgendaHeaderState | null,
    newHeader: AgendaHeaderState,
    prevAnswers: Map<string, AgendaAnswer>,
    newAnswers: Map<string, AgendaAnswer>,
  ) {
    console.log('[standing-agenda] logAuditTrail fired', { hasPrevHeader: !!prevHeader, prevAnswerCount: prevAnswers.size })
    const changes: { section_code: string; question_key: string; field_name: string; old_value: string; new_value: string }[] = []

    // Header (project info) fields. On first save there is no previous snapshot,
    // so treat the old value as '' — any filled field then counts as a change.
    for (const key of HEADER_AUDIT_KEYS) {
      const oldStr = prevHeader ? stringifyAuditValue(prevHeader[key]) : ''
      const newStr = stringifyAuditValue(newHeader[key])
      if (oldStr !== newStr) {
        changes.push({ section_code: 'header', question_key: key, field_name: auditFieldLabel('header', key), old_value: oldStr, new_value: newStr })
      }
    }

    // Section question fields (notes + selected options combined). A missing
    // previous entry is treated as '' so the first filled value is logged.
    const allKeysArr = Array.from(new Set<string>(Array.from(prevAnswers.keys()).concat(Array.from(newAnswers.keys()))))
    for (const k of allKeysArr) {
      const [section_code, question_key] = k.split('||')
      const oldStr = answerValueString(prevAnswers.get(k))
      const newStr = answerValueString(newAnswers.get(k))
      if (oldStr !== newStr) {
        changes.push({ section_code, question_key, field_name: auditFieldLabel(section_code, question_key), old_value: oldStr, new_value: newStr })
      }
    }

    console.log('[standing-agenda] audit changes detected:', changes.length, changes.map(c => `${c.section_code}:${c.question_key}`))
    if (!changes.length) return

    const u = auditUserRef.current
    const rows = changes.map(c => ({
      client_id: clientId,
      section_code: c.section_code,
      question_key: c.question_key,
      field_name: c.field_name,
      old_value: c.old_value || null,
      new_value: c.new_value || null,
      changed_by: u.id,
      changed_by_name: u.name || null,
      // changed_at: handled by DB default (now()).
    }))

    const { data, error } = await supabase.from('agenda_audit_log').insert(rows).select()
    console.log('[standing-agenda] audit insert result:', { inserted: data?.length ?? 0, error })
    if (error) throw error

    // Re-fetch from the DB so the UI updates even when insert().select() returns
    // nothing (e.g. RLS "returning representation"). This is the source of truth.
    await fetchAuditLog()
  }

  // Fetch this client's saved agenda on mount.
  useEffect(() => {
    let active = true
    async function load() {
      const supabase = createClient()
      const [{ data: h }, { data: rows }] = await Promise.all([
        supabase.from('client_agenda_header').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_standing_agenda').select('section_code, question_key, answer, selected_options').eq('client_id', clientId),
      ])
      if (!active) return
      // Always seed the header so prefill fields (Project Name / Address /
      // Homeowner(s)) populate from the client even before a row is saved.
      const loadedHeader: AgendaHeaderState = {
        project_name: h?.project_name || clientName || '',
        project_address: h?.project_address || clientProjectAddress || '',
        architect: h?.architect ?? '',
        project_specialist: h?.project_specialist ?? '',
        estimator: h?.estimator ?? '',
        target_permit_date: h?.target_permit_date ?? '',
        homeowners: h?.homeowners || clientName || '',
        zoning: h?.zoning ?? '',
        special_conditions: Array.isArray(h?.special_conditions) ? h.special_conditions : [],
        special_conditions_notes: h?.special_conditions_notes ?? '',
        plumbing_survey_notes: h?.plumbing_survey_notes ?? '',
        general_notes: h?.general_notes ?? '',
      }
      setHeader(loadedHeader)
      // Snapshot the loaded header so audit diffs compare against last-saved values.
      savedHeaderRef.current = loadedHeader
      if (rows) {
        const m = new Map<string, AgendaAnswer>()
        for (const r of rows as { section_code: string; question_key: string; answer: string | null; selected_options: unknown }[]) {
          m.set(agendaKey(r.section_code, r.question_key), {
            answer: r.answer ?? '',
            selected_options: Array.isArray(r.selected_options) ? (r.selected_options as string[]) : [],
          })
        }
        setAnswers(m)
        // Snapshot the loaded answers for audit diffing.
        savedAnswersRef.current = new Map(m)
      }
    }
    load()
    return () => { active = false }
  }, [clientId, clientName, clientProjectAddress])

  // Persist everything via upsert. Accepts explicit overrides so callers that
  // also setState (e.g. checkbox toggles) can save the freshest value without
  // waiting for a re-render. Requires unique constraints: client_agenda_header
  // (client_id) and client_standing_agenda (client_id, section_code, question_key).
  async function persist(showToast: boolean, overrideHeader?: AgendaHeaderState, overrideAnswers?: Map<string, AgendaAnswer>) {
    const hdr = overrideHeader ?? header
    const ans = overrideAnswers ?? answers
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: hErr } = await supabase
        .from('client_agenda_header')
        .upsert({
          client_id: clientId,
          project_name: hdr.project_name || null,
          project_address: hdr.project_address || null,
          architect: hdr.architect || null,
          project_specialist: hdr.project_specialist || null,
          estimator: hdr.estimator || null,
          // target_permit_date is a date column — enter YYYY-MM-DD; empty saves as null.
          target_permit_date: hdr.target_permit_date || null,
          homeowners: hdr.homeowners || null,
          zoning: hdr.zoning || null,
          special_conditions: hdr.special_conditions,
          special_conditions_notes: hdr.special_conditions_notes || null,
          plumbing_survey_notes: hdr.plumbing_survey_notes || null,
          general_notes: hdr.general_notes || null,
        }, { onConflict: 'client_id' })
      if (hErr) throw hErr

      const rows = Array.from(ans.entries()).map(([k, v]) => {
        const [section_code, question_key] = k.split('||')
        return { client_id: clientId, section_code, question_key, answer: v.answer || null, selected_options: v.selected_options }
      })
      if (rows.length) {
        const { error: rErr } = await supabase
          .from('client_standing_agenda')
          .upsert(rows, { onConflict: 'client_id,section_code,question_key' })
        if (rErr) throw rErr
      }

      // ── Audit trail (additive) ──────────────────────────────────────────
      // Log field-level changes vs the last-saved snapshot. Failures here must
      // never break the save, so they are caught and logged independently.
      try {
        await logAuditTrail(supabase, savedHeaderRef.current, hdr, savedAnswersRef.current, ans)
      } catch (auditErr) {
        console.error('[standing-agenda] audit log failed:', auditErr)
      }
      // Advance the snapshot so the next save diffs against these saved values.
      savedHeaderRef.current = hdr
      savedAnswersRef.current = new Map(ans)

      if (showToast) onToast('Standing Agenda saved')
    } catch (err) {
      console.error('[standing-agenda] save failed:', err)
      onToast('Could not save Standing Agenda. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function setHeaderField(patch: Partial<AgendaHeaderState>) {
    setHeader(prev => ({ ...prev, ...patch }))
  }
  function toggleSpecialCondition(cond: string) {
    const has = header.special_conditions.includes(cond)
    const next = has ? header.special_conditions.filter(c => c !== cond) : [...header.special_conditions, cond]
    const nextHeader = { ...header, special_conditions: next }
    setHeader(nextHeader)
    persist(false, nextHeader)
  }
  function setAnswerNotes(sectionCode: string, questionKey: string, value: string) {
    const key = agendaKey(sectionCode, questionKey)
    setAnswers(prev => {
      const m = new Map(prev)
      const cur = m.get(key) ?? { answer: '', selected_options: [] }
      m.set(key, { ...cur, answer: value })
      return m
    })
  }
  function toggleOption(sectionCode: string, questionKey: string, option: string) {
    const key = agendaKey(sectionCode, questionKey)
    const cur = answers.get(key) ?? { answer: '', selected_options: [] }
    const has = cur.selected_options.includes(option)
    const nextOpts = has ? cur.selected_options.filter(o => o !== option) : [...cur.selected_options, option]
    const nextMap = new Map(answers)
    nextMap.set(key, { ...cur, selected_options: nextOpts })
    setAnswers(nextMap)
    persist(false, undefined, nextMap) // auto-save (checkboxes have no blur)
  }

  // "Last updated by … · <relative time>" line + click-to-open history popover.
  // Renders nothing if the field has no audit entries.
  function renderLastUpdated(sectionCode: string, questionKey: string) {
    const key = auditEntryKey(sectionCode, questionKey)
    const entries = auditLog.get(key)
    if (!entries || entries.length === 0) {
      // Diagnostic: surface key mismatches between lookup and stored audit rows.
      if (auditLog.size > 0) console.debug('[standing-agenda] no audit entries for lookup key', key, '— available keys:', Array.from(auditLog.keys()))
      return null
    }
    const latest = entries[0]
    const isOpen = openHistoryKey === key
    return (
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => setOpenHistoryKey(isOpen ? null : key)}
          style={{ fontSize: 10.5, color: 'var(--text3)', fontStyle: 'italic', marginTop: 3, cursor: 'pointer' }}
        >
          Last updated by {latest.changed_by_name || 'Unknown'} · {getRelativeTime(latest.changed_at)}
        </div>
        {isOpen && (
          <>
            {/* Click-outside backdrop */}
            <div onClick={() => setOpenHistoryKey(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div
              style={{
                position: 'absolute', zIndex: 100, top: '100%', left: 0, marginTop: 4,
                background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8,
                padding: '10px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                minWidth: 240, maxWidth: 360, maxHeight: 200, overflowY: 'auto',
              }}
            >
              {entries.map((e, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11, color: 'var(--text2)', paddingBottom: 6, marginBottom: 6,
                    borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700 }}>{e.changed_by_name || 'Unknown'}</span> changed this · <span style={{ color: 'var(--text3)' }}>{formatAuditDateTime(e.changed_at)}</span>
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 10.5, marginTop: 2 }}>
                    {e.old_value || '(empty)'} → {e.new_value || '(empty)'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
      {/* Card header */}
      <button
        type="button"
        onClick={() => setCardOpen(v => !v)}
        className="w-full text-left flex items-center justify-between"
        style={{ padding: '13px 17px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: cardOpen ? '1px solid var(--border)' : 'none' }}
      >
        <div>
          <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Standing Agenda</h2>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Architect Design Agenda · Living record</div>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform 200ms ease', transform: cardOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {cardOpen && (
        <div style={{ padding: '14px 17px 16px' }}>
          {/* Legend — meeting-phase tag key */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {([
              { tag: '1ST DESIGN', text: '1st Design — broad direction: footprint, layout, room program, major scope yes/no' },
              { tag: 'FLAG', text: 'Flag Meeting — on-site truth: footprint staked, utilities, access, trees, setbacks' },
              { tag: '2ND DESIGN', text: '2nd Design — lock every selection so drawings can go to permit' },
            ] as const).map(item => {
              const ts = AGENDA_TAG_STYLES[item.tag]
              return (
                <div key={item.tag} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', color: ts.color, background: ts.bg, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>{item.tag}</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>{item.text}</span>
                </div>
              )
            })}
          </div>

          {/* Project info grid — prefilled from the client; saved to client_agenda_header. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 14 }}>
            {([
              { k: 'project_name', label: 'Project Name', type: 'text' },
              { k: 'project_address', label: 'Project Address', type: 'text' },
              { k: 'architect', label: 'Architect', type: 'text' },
              { k: 'project_specialist', label: 'Project Specialist', type: 'text' },
              { k: 'estimator', label: 'Estimator', type: 'text' },
              { k: 'target_permit_date', label: 'Target Permit Submission Date', type: 'date' },
              { k: 'homeowners', label: 'Homeowner(s)', type: 'text' },
              { k: 'zoning', label: 'Zoning', type: 'text' },
            ] as const).map(f => (
              <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={agendaLabelStyle}>{f.label}</label>
                <input
                  type={f.type}
                  value={header[f.k]}
                  onChange={e => setHeaderField({ [f.k]: e.target.value })}
                  onBlur={() => persist(false)}
                  style={agendaInputStyle}
                />
                {/* Audit trail — last updated indicator + history popover */}
                {renderLastUpdated('header', f.k)}
              </div>
            ))}
          </div>

          {/* Special conditions */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...agendaLabelStyle, display: 'block', marginBottom: 7 }}>Special Conditions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 16px' }}>
              {SPECIAL_CONDITIONS.map(cond => {
                const checked = header.special_conditions.includes(cond)
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleSpecialCondition(cond)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <AgendaCheckbox checked={checked} />
                    <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{cond}</span>
                  </button>
                )
              })}
            </div>
            {/* Audit trail — last updated indicator for the special-conditions selections */}
            {renderLastUpdated('header', 'special_conditions')}
            {/* Notes specific to special conditions (separate from General Notes) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              <label style={agendaLabelStyle}>Notes on special conditions &amp; impact:</label>
              <textarea
                rows={2}
                value={header.special_conditions_notes}
                onChange={e => setHeaderField({ special_conditions_notes: e.target.value })}
                onBlur={() => persist(false)}
                style={agendaTextareaStyle}
              />
              {/* Audit trail — last updated indicator + history popover */}
              {renderLastUpdated('header', 'special_conditions_notes')}
            </div>
          </div>

          {/* Plumbing Survey */}
          <div style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 8, padding: '11px 12px', background: 'var(--surface2)' }}>
            <label style={{ ...agendaLabelStyle, display: 'block', marginBottom: 7 }}>Plumbing Survey</label>
            <p style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.45, margin: '0 0 9px' }}>
              Remind the customer that we will schedule a plumbing survey, and they will receive an email from the architect.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={agendaLabelStyle}>Plumbing survey notes:</label>
              <textarea
                rows={2}
                value={header.plumbing_survey_notes}
                onChange={e => setHeaderField({ plumbing_survey_notes: e.target.value })}
                onBlur={() => persist(false)}
                style={agendaTextareaStyle}
              />
              {/* Audit trail — last updated indicator + history popover */}
              {renderLastUpdated('header', 'plumbing_survey_notes')}
            </div>
          </div>

          {/* General notes */}
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={agendaLabelStyle}>General Notes</label>
            <textarea
              rows={3}
              value={header.general_notes}
              onChange={e => setHeaderField({ general_notes: e.target.value })}
              onBlur={() => persist(false)}
              style={agendaTextareaStyle}
            />
            {/* Audit trail — last updated indicator + history popover */}
            {renderLastUpdated('header', 'general_notes')}
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AGENDA_SECTIONS.map(section => {
              const open = openSections.has(section.code)
              const answered = section.questions.filter(q => {
                const a = answers.get(agendaKey(section.code, q.key))
                return !!a && (a.answer.trim().length > 0 || a.selected_options.length > 0)
              }).length
              return (
                <div key={section.code} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenSections(prev => {
                      const s = new Set(prev)
                      if (s.has(section.code)) s.delete(section.code)
                      else s.add(section.code)
                      return s
                    })}
                    className="w-full text-left flex items-center gap-9"
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: 'var(--surface2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span style={{ color: 'var(--fable-red)', fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{section.code}</span>
                    <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{section.name}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{answered} of {section.questions.length} answered</span>
                    <span style={{ color: 'var(--text3)', fontSize: 10, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </button>

                  {open && (
                    <div style={{ padding: '11px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {section.questions.map(q => {
                        const entry = answers.get(agendaKey(section.code, q.key))
                        return (
                          <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {/* Question text + tags */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4, flex: '1 1 auto' }}>{q.text}</span>
                              <span style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                                {q.tags.map(tag => {
                                  const ts = AGENDA_TAG_STYLES[tag] ?? { bg: 'var(--surface2)', color: 'var(--text3)' }
                                  return (
                                    <span key={tag} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', color: ts.color, background: ts.bg, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{tag}</span>
                                  )
                                })}
                              </span>
                            </div>

                            {/* Options (multi-select) */}
                            {q.type === 'options_notes' && q.options && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {q.options.map(opt => {
                                  const checked = entry?.selected_options.includes(opt) ?? false
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => toggleOption(section.code, q.key, opt)}
                                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                    >
                                      <AgendaCheckbox checked={checked} />
                                      <span style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.4, opacity: checked ? 1 : 0.85 }}>{opt}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}

                            {/* Notes */}
                            <textarea
                              rows={2}
                              placeholder="Notes…"
                              value={entry?.answer ?? ''}
                              onChange={e => setAnswerNotes(section.code, q.key, e.target.value)}
                              onBlur={() => persist(false)}
                              style={agendaTextareaStyle}
                            />
                            {/* Audit trail — last updated indicator + history popover */}
                            {renderLastUpdated(section.code, q.key)}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Save */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => persist(true)}
              disabled={saving}
              style={{
                fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--charcoal)',
                border: '1px solid var(--charcoal)', padding: '8px 16px', borderRadius: 7,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Save Agenda'}
            </button>
          </div>
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

// ── Current Step To-Do's (NEW — additive, read-only aggregation) ──────────────
// Surfaces the *current* workflow step's checklist tasks (from WORKFLOW_STEPS,
// state in checklistRows) plus the Fireflies action items from that step's saved
// recap (client_meetings row in journeyRows). Reuses the existing checklist
// toggle handler — it adds no new fetching or persistence of its own.

interface RecapActionItem {
  task?: string
  owner?: string
  due_date?: string | null
  done?: boolean
}

// action_items comes from client_meetings (selected with '*'); depending on the
// column type it may be a JSON string or an already-parsed array. Parse safely.
function parseRecapActionItems(raw: unknown): RecapActionItem[] {
  if (!raw) return []
  let value: unknown = raw
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return value.filter((x): x is RecapActionItem => !!x && typeof x === 'object')
}

function CurrentStepTodos({
  currentStepNumber,
  checklistRows,
  checklistToggling,
  onToggleChecklist,
  journeyRows,
  stepStartMap,
}: {
  currentStepNumber: number | null
  checklistRows: Map<string, ChecklistRowState>
  checklistToggling: Set<string>
  onToggleChecklist: (meetingCode: string, role: string, taskText: string, next: boolean) => void
  journeyRows: Map<string, ClientMeetingRow>
  // NEW (additive): step → started_at, for per-task due-date indicators.
  stepStartMap: Map<number, Date>
}) {
  const step = currentStepNumber != null ? WORKFLOW_STEPS.find(s => s.step === currentStepNumber) : undefined

  // Journey tasks for the current step only, flattened with their role for keying.
  const journeyTasks = step
    ? step.roles.flatMap(rb => rb.tasks.map(task => ({ role: rb.role, task })))
    : []
  const journeyIncomplete = step
    ? journeyTasks.filter(t => !(checklistRows.get(checklistKey(stepCode(step.step), t.role, t.task))?.completed)).length
    : 0

  // Fireflies action items from this step's saved recap (if a recap exists).
  const recapRow = step ? journeyRows.get('step_' + step.step.toString().padStart(2, '0')) : undefined
  const actionItems = recapRow
    ? parseRecapActionItems((recapRow as unknown as { action_items?: unknown }).action_items)
    : []
  const actionsIncomplete = actionItems.filter(a => a.done !== true).length

  // Today at local midnight, for overdue / due-soon comparisons.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function dueState(item: RecapActionItem): 'overdue' | 'soon' | 'normal' | null {
    if (!item.due_date) return null
    if (item.done === true) return 'normal'
    const due = new Date(item.due_date + 'T00:00:00')
    if (isNaN(due.getTime())) return 'normal'
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0) return 'overdue'
    if (diffDays <= 2) return 'soon'
    return 'normal'
  }

  function fmtDue(d: string): string {
    const date = new Date(d + 'T00:00:00')
    if (isNaN(date.getTime())) return d
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const subHeaderStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--text3)', padding: '10px 17px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 8,
  }
  const countBadgeStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 'normal', textTransform: 'none',
    background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)',
    borderRadius: 99, padding: '1px 7px',
  }
  const ownerBadgeStyle: React.CSSProperties = {
    fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text2)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap',
  }

  const stepLabel = step
    ? `STEP ${String(step.step).padStart(2, '0')} · ${step.title}`
    : 'All steps complete'

  return (
    <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
      {/* Card header */}
      <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
        <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>
          Current Step To-Do&apos;s
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{stepLabel}</span>
      </div>

      {/* Sub-section 1 — Journey Tasks (from WORKFLOW_STEPS) */}
      <div style={subHeaderStyle}>
        <span>Journey Tasks</span>
        <span style={countBadgeStyle}>{journeyIncomplete}</span>
      </div>
      {!step ? (
        <div style={{ padding: '10px 17px', fontSize: 13, color: 'var(--text3)' }}>All steps complete</div>
      ) : journeyTasks.length === 0 ? (
        <div style={{ padding: '10px 17px', fontSize: 13, color: 'var(--text3)' }}>No journey tasks for this step.</div>
      ) : (
        step.roles.map((rb, ri) => (
          <div key={rb.role} style={{ borderBottom: ri < step.roles.length - 1 ? '1px solid var(--border)' : undefined }}>
            {/* Role group header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 17px 4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: rb.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text2)' }}>
                {ROLE_NAMES[rb.role] ?? rb.role}
              </span>
            </div>
            {rb.tasks.map((task, ti) => {
              const key = checklistKey(stepCode(step.step), rb.role, task)
              const checked = checklistRows.get(key)?.completed ?? false
              const busy = checklistToggling.has(key)
              // NEW (additive): per-task due date + color state from when this step started.
              const taskDueDate = computeTaskDueDate(stepStartMap.get(step.step) ?? null, step.timeWindow, task)
              const taskDue = getTaskDueState(taskDueDate, checked)
              return (
                <button
                  key={ti}
                  type="button"
                  onClick={() => { if (!busy) onToggleChecklist(stepCode(step.step), rb.role, task, !checked) }}
                  disabled={busy}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'flex-start', gap: 9,
                    padding: '8px 17px', background: 'transparent', borderTop: '1px solid var(--border)',
                    borderLeft: 'none', borderRight: 'none', borderBottom: 'none', textAlign: 'left',
                    cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{ width: 14, height: 14, borderRadius: 3, border: checked ? '1.5px solid var(--charcoal)' : '1.5px solid var(--border2)', background: checked ? 'var(--charcoal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'background 120ms ease, border-color 120ms ease' }}
                  >
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </span>
                  {/* NEW (additive): overdue tasks render in red; default color otherwise. */}
                  <span style={{ fontSize: 13, lineHeight: 1.4, color: taskDue === 'overdue' ? '#ef4444' : 'var(--text)', opacity: checked ? 0.5 : 1, textDecoration: checked ? 'line-through' : 'none' }}>
                    {task}
                  </span>
                  {/* NEW (additive): inline due-date indicator after the task text. */}
                  {taskDue === 'overdue' && (
                    <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 1 }}>
                      Overdue
                    </span>
                  )}
                  {taskDue === 'soon' && (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 1 }}>
                      Due soon
                    </span>
                  )}
                  {taskDue === 'ok' && taskDueDate && (
                    <span style={{ fontSize: 10.5, color: '#22c55e', marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 2 }}>
                      Due in {daysUntilDue(taskDueDate)} day{daysUntilDue(taskDueDate) === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))
      )}

      {/* Sub-section 2 — Meeting Action Items (from Fireflies recap) */}
      <div style={{ ...subHeaderStyle, borderTop: '1px solid var(--border)' }}>
        <span>Meeting Action Items</span>
        <span style={countBadgeStyle}>{actionsIncomplete}</span>
      </div>
      {!recapRow ? (
        <div style={{ padding: '10px 17px', fontSize: 13, color: 'var(--text3)' }}>No meeting recorded yet for this step</div>
      ) : actionItems.length === 0 ? (
        <div style={{ padding: '10px 17px', fontSize: 13, color: 'var(--text3)' }}>No action items in this recap.</div>
      ) : (
        actionItems.map((item, i) => {
          const state = dueState(item)
          const done = item.done === true
          const textColor = done
            ? 'var(--text3)'
            : state === 'overdue' ? 'var(--fable-red)'
            : state === 'soon' ? '#d97706'
            : 'var(--text)'
          return (
            <div key={i} style={{ padding: '8px 17px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: textColor, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                {item.task ?? 'Untitled task'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {item.owner && <span style={ownerBadgeStyle}>{item.owner}</span>}
                {item.due_date && (
                  <span style={{ fontSize: 11, color: done ? 'var(--text3)' : textColor }}>
                    Due {fmtDue(item.due_date)}
                  </span>
                )}
                {!done && state === 'overdue' && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#991b1b', borderRadius: 99, padding: '1px 7px' }}>Overdue</span>
                )}
                {!done && state === 'soon' && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '1px 7px' }}>Due soon</span>
                )}
                <span style={{ fontSize: 10.5, color: 'var(--text3)', fontStyle: 'italic' }}>
                  from {recapRow.title}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
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
  // Collapse state for the moved-to-bottom info sections (collapsed by default).
  const [isPersonalityExpanded, setIsPersonalityExpanded] = useState(false)
  const [isPrioritiesExpanded, setIsPrioritiesExpanded] = useState(false)
  // Next Step card briefing — collapsed to 2 lines by default.
  const [isNextStepExpanded, setIsNextStepExpanded] = useState(false)
  const [editForm, setEditForm] = useState<EditClientForm | null>(null)
  const [savingClient, setSavingClient] = useState(false)

  // ── Project Files state (NEW · additive · client_files table) ───────────────
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Captured on load so uploads can stamp uploaded_by without re-fetching auth.
  const fileUserIdRef = useRef<string | null>(null)

  // ── Role-based checklist state (journey_checklists) ─────────────────────────
  const [checklistRows, setChecklistRows] = useState<Map<string, ChecklistRowState>>(new Map())
  const [checklistToggling, setChecklistToggling] = useState<Set<string>>(new Set())
  const checklistUserIdRef = useRef<string | null>(null)
  // 33-step workflow completion state (workflow_step_completions table)
  const [stepCompletions, setStepCompletions] = useState<Set<number>>(new Set())
  const [stepMarking, setStepMarking] = useState<Set<number>>(new Set())
  // NEW (additive): when each step started (journey_step_start). Drives task due dates.
  const [stepStartMap, setStepStartMap] = useState<Map<number, Date>>(new Map())

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

  // ── Fetch this client's checklist state + workflow step completions ─────────
  // Loads once on mount; local state is the source of truth thereafter (toggles
  // update it directly without re-fetching). Does not touch existing queries.
  useEffect(() => {
    async function fetchChecklist() {
      const supabase = createClient()

      // Capture the current user id (reuses the existing auth session) for completed_by.
      const { data: { user } } = await supabase.auth.getUser()
      checklistUserIdRef.current = user?.id ?? null

      const [{ data: saved }, { data: completions }, { data: stepStarts }] = await Promise.all([
        supabase
          .from('journey_checklists')
          .select('meeting_code, role, task_text, completed')
          .eq('client_id', params.id),
        supabase
          .from('workflow_step_completions')
          .select('step_number')
          .eq('client_id', params.id),
        // NEW (additive): when each step started, for task due-date calculation.
        supabase
          .from('journey_step_start')
          .select('step_number, started_at')
          .eq('client_id', params.id),
      ])

      if (saved) {
        const map = new Map<string, ChecklistRowState>()
        for (const r of saved as { meeting_code: string; role: string; task_text: string; completed: boolean }[]) {
          map.set(checklistKey(r.meeting_code, r.role, r.task_text), { completed: r.completed })
        }
        setChecklistRows(map)
      }

      if (completions) {
        setStepCompletions(new Set((completions as { step_number: number }[]).map(c => c.step_number)))
      }

      // NEW (additive): build the step → started_at map (ignored if table/data absent).
      if (stepStarts) {
        const startMap = new Map<number, Date>()
        for (const r of stepStarts as { step_number: number; started_at: string }[]) {
          if (r.started_at) startMap.set(r.step_number, new Date(r.started_at))
        }
        setStepStartMap(startMap)
      }
    }
    fetchChecklist()
  }, [params.id])

  // ── Fetch this client's uploaded files (NEW · additive) ─────────────────────
  // Loads once on mount; local state is the source of truth thereafter (upload /
  // delete update it directly). Also captures the current user id for uploaded_by.
  useEffect(() => {
    async function fetchClientFiles() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      // client_files.uploaded_by references the public `users` table, whose ids
      // differ from the Supabase auth user id. Look up the matching public user
      // by email so uploads record a valid FK (fixes "could not be recorded").
      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser?.email ?? '')
        .single()
      fileUserIdRef.current = publicUser?.id ?? null

      const { data } = await supabase
        .from('client_files')
        .select('*')
        .eq('client_id', params.id)
        .order('uploaded_at', { ascending: false })
      if (data) setClientFiles(data as ClientFile[])
    }
    fetchClientFiles()
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

  // ── Toggle a checklist task on/off + persist to journey_checklists ──────────
  // Local state is the source of truth. We update it optimistically and keep it
  // on success (no re-fetch). Rows are matched/updated by their natural columns
  // (client_id + meeting_code + role + task_text) instead of by a returned id,
  // which avoids the bug where an insert's `.select().single()` read-back fails
  // under RLS and incorrectly reverts the checkbox.
  async function toggleChecklistTask(meetingCode: string, role: string, taskText: string, next: boolean) {
    const key = checklistKey(meetingCode, role, taskText)
    setChecklistToggling(prev => new Set(prev).add(key))

    // Optimistic update so the checkbox feels instant.
    const existed = checklistRows.has(key)
    const prevCompleted = checklistRows.get(key)?.completed
    setChecklistRows(prev => {
      const m = new Map(prev)
      m.set(key, { completed: next })
      return m
    })

    try {
      const supabase = createClient()
      const userId = checklistUserIdRef.current

      if (existed) {
        // A row already exists for this task → update it in place.
        const { error } = await supabase
          .from('journey_checklists')
          .update({
            completed: next,
            completed_by: next ? userId : null,
            completed_at: next ? new Date().toISOString() : null,
          })
          .eq('client_id', params.id)
          .eq('meeting_code', meetingCode)
          .eq('role', role)
          .eq('task_text', taskText)
        if (error) throw error
      } else {
        // First time this task is toggled → insert a new row.
        const { error } = await supabase
          .from('journey_checklists')
          .insert({
            client_id: params.id,
            meeting_code: meetingCode,
            role,
            task_text: taskText,
            completed: next,
            completed_by: next ? userId : null,
            completed_at: next ? new Date().toISOString() : null,
          })
        if (error) throw error
      }
      // Success: local state already reflects `next`, so nothing more to do.
    } catch (err) {
      console.error('[journey-checklist] toggle failed:', err)
      // Revert the optimistic change on failure.
      setChecklistRows(prev => {
        const m = new Map(prev)
        if (existed) m.set(key, { completed: prevCompleted ?? false })
        else m.delete(key)
        return m
      })
      setToast('Could not save checklist change. Please try again.')
    } finally {
      setChecklistToggling(prev => {
        const m = new Set(prev)
        m.delete(key)
        return m
      })
    }
  }

  // ── Mark a workflow step complete / incomplete (workflow_step_completions) ──
  async function markStepComplete(stepNumber: number, completed: boolean) {
    setStepMarking(prev => new Set(prev).add(stepNumber))

    // Optimistic update.
    const wasCompleted = stepCompletions.has(stepNumber)
    setStepCompletions(prev => {
      const s = new Set(prev)
      if (completed) s.add(stepNumber)
      else s.delete(stepNumber)
      return s
    })

    try {
      const supabase = createClient()
      if (completed) {
        const { error } = await supabase
          .from('workflow_step_completions')
          .insert({
            client_id: params.id,
            step_number: stepNumber,
            completed_by: checklistUserIdRef.current,
            completed_at: new Date().toISOString(),
          })
        if (error) throw error

        // NEW (additive): record when the NEXT step starts so task due dates can be
        // derived from it. Isolated in its own try/catch so a failure here can never
        // disrupt the existing step-completion flow.
        try {
          const nextStep = stepNumber + 1
          const startedAtIso = new Date().toISOString()
          const { error: startErr } = await supabase
            .from('journey_step_start')
            .upsert(
              { client_id: params.id, step_number: nextStep, started_at: startedAtIso },
              { onConflict: 'client_id,step_number' },
            )
          if (startErr) {
            console.error('[journey-step-start] upsert failed:', startErr)
          } else {
            setStepStartMap(prev => {
              const m = new Map(prev)
              m.set(nextStep, new Date(startedAtIso))
              return m
            })
          }
        } catch (startErr) {
          console.error('[journey-step-start] upsert error:', startErr)
        }
      } else {
        const { error } = await supabase
          .from('workflow_step_completions')
          .delete()
          .eq('client_id', params.id)
          .eq('step_number', stepNumber)
        if (error) throw error
      }
    } catch (err) {
      console.error('[workflow-step] mark complete failed:', err)
      // Revert on failure.
      setStepCompletions(prev => {
        const s = new Set(prev)
        if (wasCompleted) s.add(stepNumber)
        else s.delete(stepNumber)
        return s
      })
      setToast('Could not update step. Please try again.')
    } finally {
      setStepMarking(prev => {
        const s = new Set(prev)
        s.delete(stepNumber)
        return s
      })
    }
  }

  // ── Customer-meeting action buttons (View Agenda / Recap / Generate Email) ──
  // Agenda / email remain placeholders. View Recap looks up the saved
  // client_meetings recap for this step (meeting_id like 'step_04') and, when
  // present, navigates to its recap page; otherwise it shows the linked-yet toast.
  function handleWorkflowAction(kind: 'agenda' | 'recap' | 'email', step: WorkflowStepDef) {
    if (kind === 'recap') {
      const code = stepCode(step.step)
      const recapRow = journeyRows.get(code)
      if (recapRow) {
        router.push(`/customers/${params.id}/meetings/${code}`)
      } else {
        setToast(`Recap for "${step.title}" isn't linked yet.`)
      }
      return
    }
    const labels = { agenda: 'Agenda', recap: 'Recap', email: 'Recap email' }
    setToast(`${labels[kind]} for "${step.title}" isn't linked yet.`)
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
  const sentEmailCount = sentEmails.length

  // ── 33-step workflow progress (drives the Meeting Journey section) ──────────
  const stepsCompletedCount = WORKFLOW_STEPS.filter(s => stepCompletions.has(s.step)).length
  const stepsPct = Math.round((stepsCompletedCount / TOTAL_WORKFLOW_STEPS) * 100)
  // Current step = first step that is not yet completed.
  const currentStepNumber = WORKFLOW_STEPS.find(s => !stepCompletions.has(s.step))?.step ?? null

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

  // ROOT CAUSE FIX: nextStepDesc above is truncated to 180 chars at the data layer
  // by summarize(), so the expanded "Show less" view had nothing longer to render.
  // nextStepFull is the same text cleaned of HTML/markdown but NOT length-clamped,
  // so the expanded view can show the complete recap.
  const nextStepFull = lastCompleted?.recap
    ? summarize(lastCompleted.recap, Number.MAX_SAFE_INTEGER)
    : nextStepDesc

  const clientSinceDate = client.start_date ? new Date(client.start_date) : null
  const clientSince =
    clientSinceDate && !isNaN(clientSinceDate.getTime())
      ? clientSinceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : client.start_date || ''

  const firstName = client.name.split(' ')[0]
  const hasInterests = !!client.key_interests && client.key_interests !== INTEREST_PLACEHOLDER
  const hasComm = !!client.communication_style && client.communication_style !== COMM_PLACEHOLDER
  const hasTip = !!client.ai_tip && client.ai_tip !== 'Add personality details to get AI communication tips.'

  // ── Recent Meeting Recaps — last 4 completed workflow steps with a saved recap.
  // journeyRows is keyed by meeting_id (e.g. "step_04"); we match each to its
  // WORKFLOW_STEPS definition for the title + step type (dot color).
  const recentRecaps = Array.from(journeyRows.values())
    .filter(r => r.completed === true && r.recap !== null && r.recap !== '' && r.recap !== undefined)
    .map(r => {
      const stepNum = parseInt(String(r.meeting_id ?? '').replace('step_', ''), 10)
      const def = WORKFLOW_STEPS.find(s => s.step === stepNum)
      return { row: r, stepNum, def }
    })
    .filter(x => x.def !== undefined)
    .sort((a, b) => {
      const ta = a.row.completed_at ? new Date(a.row.completed_at).getTime() : 0
      const tb = b.row.completed_at ? new Date(b.row.completed_at).getTime() : 0
      return tb - ta
    })
    .slice(0, 4)

  // ── Project Files handlers (NEW · additive) ─────────────────────────────────
  const MAX_FILE_BYTES = 10 * 1024 * 1024

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so re-selecting the same file fires onChange again.
    e.target.value = ''
    if (!file) return
    setFileError(null)

    if (file.size > MAX_FILE_BYTES) {
      setFileError('File too large — maximum size is 10MB.')
      return
    }

    setUploadingFile(true)
    try {
      const supabase = createClient()
      const filePath = `${params.id}/${Date.now()}_${file.name}`

      const { error: uploadErr } = await supabase.storage
        .from('client-files')
        .upload(filePath, file)
      if (uploadErr) {
        setFileError('Upload failed — please try again.')
        return
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('client_files')
        .insert({
          client_id: params.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: fileUserIdRef.current,
        })
        .select()
        .single()
      if (insertErr || !inserted) {
        setFileError('File uploaded but could not be recorded — please refresh.')
        return
      }

      setClientFiles(prev => [inserted as ClientFile, ...prev])
    } catch (err) {
      console.error('[client-files] upload error:', err)
      setFileError('Upload failed — please try again.')
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleFileDownload(file: ClientFile) {
    setFileError(null)
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('client-files')
      .createSignedUrl(file.file_path, 3600)
    if (error || !data?.signedUrl) {
      setFileError('Could not generate a download link — please try again.')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleFileDelete(file: ClientFile) {
    if (!window.confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return
    setFileError(null)
    setDeletingFileId(file.id)
    try {
      const supabase = createClient()
      await supabase.storage.from('client-files').remove([file.file_path])
      const { error } = await supabase.from('client_files').delete().eq('id', file.id)
      if (error) {
        setFileError('Delete failed — please try again.')
        return
      }
      setClientFiles(prev => prev.filter(f => f.id !== file.id))
    } catch (err) {
      console.error('[client-files] delete error:', err)
      setFileError('Delete failed — please try again.')
    } finally {
      setDeletingFileId(null)
    }
  }

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
                {/* NEW (additive): preview the customer-facing /my-project view. Gated to the
                    John Smith demo client because /my-project resolves to the logged-in user
                    (or the John Smith fallback), not this profile's id. */}
                {client.name === 'John Smith' && (
                  <Link
                    href="/my-project"
                    title="Preview customer view"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      height: 28, padding: '0 11px', borderRadius: 7,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: 'rgba(255,255,255,0.82)',
                      fontSize: 11.5, fontWeight: 600, lineHeight: 1, cursor: 'pointer',
                      fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap', textDecoration: 'none',
                      transition: 'background 150ms ease, border-color 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                  >
                    Customer View →
                  </Link>
                )}
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
                <div>
                  {!isNextStepExpanded && (
                    <div style={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      fontSize: 13,
                      color: 'var(--text2)',
                      lineHeight: 1.5,
                      marginTop: 4
                    }}>
                      {nextStepDesc}
                    </div>
                  )}
                  {isNextStepExpanded && (
                    <div style={{
                      fontSize: 13,
                      color: 'var(--text2)',
                      lineHeight: 1.5,
                      marginTop: 4
                    }}>
                      {nextStepFull}
                    </div>
                  )}
                  {(nextStepFull.length > 120 || nextStepFull !== nextStepDesc) && (
                    <span
                      onClick={() => setIsNextStepExpanded(v => !v)}
                      style={{
                        fontSize: 11,
                        color: 'var(--fable-red)',
                        cursor: 'pointer',
                        fontWeight: 500,
                        marginTop: 2,
                        display: 'inline-block'
                      }}
                    >
                      {isNextStepExpanded ? 'Show less ←' : 'Read more →'}
                    </span>
                  )}
                </div>
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

        {/* ── Full-width stacked layout ─────────────────────────────────── */}
        <div className="flex flex-col gap-5">

            {/* ── Current Step To-Do's (NEW) — full width ──────────────────── */}
            <CurrentStepTodos
              currentStepNumber={currentStepNumber}
              checklistRows={checklistRows}
              checklistToggling={checklistToggling}
              onToggleChecklist={toggleChecklistTask}
              journeyRows={journeyRows}
              stepStartMap={stepStartMap}
            />

        {/* ── Emails — Pending (left) | Sent (right), side-by-side grid ──── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column: Pending Emails */}
        <div>
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
        </div>{/* /left column: Pending Emails */}

        {/* Right column: Sent Emails */}
        <div>
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
                    style={{ gap: 12, padding: '11px 17px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer', overflow: 'hidden' }}
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
                      <div style={{ fontSize: 12.5, fontWeight: 550, letterSpacing: '-0.005em', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                      {when && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{when} ET · delivered</div>
                      )}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 550, color: 'var(--text)', flexShrink: 0 }}>View →</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </div>{/* /right column: Sent Emails */}
        </div>{/* /emails grid */}
        </div>{/* /full-width stacked layout */}

        <div className="flex flex-col gap-5" style={{ marginTop: 24 }}>

        {/* ── Recent Meeting Recaps (NEW) ───────────────────────────────── */}
        <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
          <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Recent Meeting Recaps</h2>
          </div>
          {recentRecaps.length === 0 ? (
            <div style={{ padding: '15px 17px', fontSize: 13, color: 'var(--text3)' }}>
              No meeting recaps yet — recaps appear here after meetings are recorded
            </div>
          ) : (
            <div>
              {recentRecaps.map(({ row, stepNum, def }) => {
                const dotColor = def ? STEP_TYPE_CONFIG[def.type].bar : 'var(--text3)'
                const dateLabel = row.completed_at
                  ? new Date(row.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : ''
                return (
                  <div
                    key={row.id ?? row.meeting_id}
                    className="flex items-center"
                    style={{ gap: 12, padding: '10px 17px', borderBottom: '1px solid var(--border)' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', fontFamily: 'monospace', flexShrink: 0 }}>
                      STEP {String(stepNum).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {def?.title}
                    </span>
                    {dateLabel && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{dateLabel}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => router.push(`/customers/${params.id}/meetings/${row.meeting_id}`)}
                      style={{ ...workflowActionBtn, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', fontWeight: 600 }}
                    >
                      View Recap →
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>{/* /Recent Meeting Recaps */}

        {/* ── Project Files (NEW · additive) ────────────────────────────── */}
        <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
          {/* Hidden file input — drives the "+ Upload File" / browse buttons */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Header */}
          <div className="flex items-center justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Project Files</h2>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                color: 'var(--fable-red)', background: 'var(--white)', border: '1px solid var(--border)',
                padding: '4px 10px', borderRadius: 5, whiteSpace: 'nowrap',
                cursor: uploadingFile ? 'not-allowed' : 'pointer', opacity: uploadingFile ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              + Upload File
            </button>
          </div>

          {/* Upload area / status */}
          <div style={{ padding: '12px 17px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                color: 'var(--fable-red)', background: 'var(--white)', border: '1px solid var(--border)',
                padding: '6px 12px', borderRadius: 6, whiteSpace: 'nowrap',
                cursor: uploadingFile ? 'not-allowed' : 'pointer', opacity: uploadingFile ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              {uploadingFile ? 'Uploading…' : 'Click to browse'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              PDF, Word, Excel or images · max 10MB
            </span>
            {fileError && (
              <span style={{ fontSize: 11, color: 'var(--fable-red)', fontWeight: 500 }}>{fileError}</span>
            )}
          </div>

          {/* File list */}
          {clientFiles.length === 0 ? (
            <div style={{ padding: '15px 17px', fontSize: 13, color: 'var(--text3)' }}>
              No files uploaded yet — upload plans, permits, or documents for this client
            </div>
          ) : (
            <div>
              {clientFiles.map(file => {
                const dateLabel = file.uploaded_at
                  ? new Date(file.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : ''
                return (
                  <div
                    key={file.id}
                    className="flex items-center"
                    style={{ gap: 12, padding: '10px 17px', borderBottom: '1px solid var(--border)' }}
                  >
                    <span style={{ fontSize: 16, marginRight: 8, flexShrink: 0 }}>{fileIcon(file.file_type, file.file_name)}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.file_name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{formatFileSize(file.file_size)}</span>
                    {dateLabel && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{dateLabel}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleFileDownload(file)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 500,
                        color: 'var(--text2)', background: 'var(--white)', border: '1px solid var(--border)',
                        padding: '4px 9px', borderRadius: 5, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFileDelete(file)}
                      disabled={deletingFileId === file.id}
                      title="Delete file"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
                        fontSize: 13, fontWeight: 700, lineHeight: 1,
                        color: '#dc2626', background: 'var(--white)', border: '1px solid var(--red-border, #f5c9c2)',
                        borderRadius: 5, cursor: deletingFileId === file.id ? 'not-allowed' : 'pointer',
                        opacity: deletingFileId === file.id ? 0.5 : 1, fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>{/* /Project Files */}

        {/* ── Personality & Communication (moved · collapsible) ─────────── */}
        {(client.personality_tags.length > 0 || hasInterests || hasComm || hasTip) && (
        <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
          <button
            type="button"
            onClick={() => setIsPersonalityExpanded(v => !v)}
            className="w-full flex items-center justify-between"
            style={{ padding: '13px 17px', borderBottom: isPersonalityExpanded ? '1px solid var(--border)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Personality &amp; Communication</h2>
            <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform 200ms ease', transform: isPersonalityExpanded ? 'none' : 'rotate(-90deg)' }}>▾</span>
          </button>
          {isPersonalityExpanded && (
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
          )}
        </div>
        )}{/* /Personality & Communication */}

        {/* ── Key Priorities (moved · collapsible) ──────────────────────── */}
        {client.priorities.some(p => p.text.trim()) && (
              <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
                <button
                  type="button"
                  onClick={() => setIsPrioritiesExpanded(v => !v)}
                  className="w-full flex items-center justify-between"
                  style={{ padding: '13px 17px', borderBottom: isPrioritiesExpanded ? '1px solid var(--border)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Key Priorities</h2>
                  <span className="flex items-center" style={{ gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>From meeting recaps</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform 200ms ease', transform: isPrioritiesExpanded ? 'none' : 'rotate(-90deg)' }}>▾</span>
                  </span>
                </button>
                {isPrioritiesExpanded && (
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
                )}
              </div>
        )}{/* /Key Priorities */}

        {/* ── Standing Agenda (NEW) ─────────────────────────────────────── */}
        <StandingAgenda clientId={params.id} clientName={client.name} clientProjectAddress={client.project_address ?? ''} onToast={setToast} />

        {/* ── Meeting Journey — 33-step workflow ────────────────────────── */}
        <div ref={journeyRef} className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
          <div className="flex items-baseline justify-between" style={{ padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text)' }}>Meeting Journey</h2>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
              {stepsCompletedCount} of {TOTAL_WORKFLOW_STEPS} steps{sentEmailCount > 0 ? ` · ${sentEmailCount} emails` : ''}
            </span>
          </div>

          {/* Progress */}
          <div className="flex items-center" style={{ gap: 12, padding: '13px 17px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <b style={{ fontWeight: 600, color: 'var(--text)' }}>{stepsCompletedCount} of {TOTAL_WORKFLOW_STEPS}</b> steps complete
            </span>
            <span className="flex-1 overflow-hidden" style={{ height: 5, borderRadius: 99, background: 'var(--surface2)' }}>
              <span style={{ display: 'block', height: '100%', width: `${stepsPct}%`, background: happiness.accent, borderRadius: 99, transition: 'width 400ms ease' }} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{stepsPct}%</span>
          </div>

          {/* Steps */}
          <div>
            {WORKFLOW_STEPS.map(step => (
              <WorkflowStep
                key={step.step}
                step={step}
                isCompleted={stepCompletions.has(step.step)}
                isCurrent={step.step === currentStepNumber}
                defaultExpanded={step.step === currentStepNumber}
                checklistRows={checklistRows}
                checklistToggling={checklistToggling}
                onToggleChecklist={toggleChecklistTask}
                marking={stepMarking.has(step.step)}
                onMarkComplete={markStepComplete}
                onAction={handleWorkflowAction}
                hasRecap={journeyRows.has(stepCode(step.step))}
              />
            ))}
          </div>
        </div>
        </div>
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
