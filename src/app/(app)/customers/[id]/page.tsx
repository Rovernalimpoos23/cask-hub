'use client'
// src/app/(app)/customers/[id]/page.tsx

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import 'react-quill/dist/quill.snow.css'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { AGENDAS, NPS_QUESTIONS, type AgendaContent, type AgendaItem, type AgendaSection } from '../_agendaData'
// Single source of truth for the 37-step Customer Journey: step data, role display
// names, badge styling, the step/checklist key helpers, and the pure task due-date
// helpers. This page previously kept its own full inline duplicate of the step data.
import {
  WORKFLOW_STEPS,
  TOTAL_WORKFLOW_STEPS,
  ROLE_NAMES,
  STEP_TYPE_CONFIG,
  stepCode,
  checklistKey,
  computeTaskDueDate,
  getTaskDueState,
  daysUntilDue,
  type WorkflowStepDef,
} from '@/lib/workflow-steps'

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
  // Same shape and same optional semantics as start_date above: '' means "not set".
  target_completion_date: string
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

// NOTE: the legacy `TOTAL_MEETINGS` count (55, derived from JOURNEY_PHASES) was
// removed — every remaining reader of journey progress uses TOTAL_WORKFLOW_STEPS (37).
// JOURNEY_PHASES itself is still used for recap labels and sent-email titles.

// ── Config ────────────────────────────────────────────────────────────────────

const HAPPINESS = {
  green: { bg: '#F0FDF4', color: 'var(--green)', label: 'Happy', accent: '#22c55e' },
  yellow: { bg: '#FFFBEB', color: '#92400E', label: 'At Risk', accent: '#f59e0b' },
  red: { bg: '#FDF2F0', color: '#9B1C0E', label: 'Needs Attention', accent: 'var(--red)' },
}

const PRIORITY_CONFIG: Record<PriorityStatus, { dot: string; color: string; strike: boolean }> = {
  done: { dot: '#22c55e', color: '#22c55e', strike: true },
  in_progress: { dot: '#f59e0b', color: '#f59e0b', strike: false },
  unresolved: { dot: 'var(--red)', color: 'var(--red)', strike: false },
}

// ── Edit Client modal config (mirrors New Client Setup) ───────────────────────

const PROJECT_TYPES = ['Custom Home', 'ADU', 'Detached Garage', 'Addition', 'Other']

// ── Client Solution Manager options ─────────────────────────────────────────
// Live from the people actually assigned to clients. This replaced a hardcoded
// ['Calin', 'Jeff', 'Matteo', 'Chad'] that disagreed with the New Client Setup
// list AND with the database — "Scott" and "Drew" are real live values that
// appeared in neither, so opening this modal on one of their clients offered a
// list without that client's own CSM in it.
//
// Deliberately identical to fetchOwnerOptions() in customers/new/page.tsx: same
// query, same trim, same 'Unassigned' exclusion, same sort. The two are copies
// rather than a shared import because this change was scoped to these two
// files; if a third caller ever needs it, lift it into src/lib first.
// PostgREST has no DISTINCT, so the column is deduped here.
async function fetchOwnerOptions(): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('clients').select('owner')
  if (error || !data) return []
  const names = new Set<string>()
  for (const row of data) {
    const n = ((row as { owner: string | null }).owner ?? '').trim()
    if (n && n.toLowerCase() !== 'unassigned') names.add(n)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}
const ALL_TAGS = [
  'Verbal communicator', 'Direct', 'Detail-oriented', 'Analytical',
  'Visual learner', 'Budget-focused', 'Fast decision maker',
  'Slow processor', 'Needs reassurance', 'Email communicator',
  'Relationship-driven', 'Skeptical',
]
const HAPPINESS_OPTIONS: { value: Happiness; emoji: string; label: string; accent: string; bg: string }[] = [
  { value: 'green',  emoji: '🟢', label: 'Happy',           accent: 'var(--green)', bg: 'var(--green-bg)' },
  { value: 'yellow', emoji: '🟡', label: 'At Risk',         accent: 'var(--amber)', bg: 'var(--amber-bg)' },
  { value: 'red',    emoji: '🔴', label: 'Needs Attention', accent: 'var(--red)', bg: 'var(--red-soft)' },
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
  target_completion_date: string
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

// ── Profile tabs (NEW) ────────────────────────────────────────────────────────
// This page's sections are grouped into four tab panels. Panels are hidden with the
// `hidden` attribute rather than conditionally rendered, so a tab switch never
// unmounts a section: every state variable, effect and mount-time fetch behaves
// exactly as it did before. Follows the OKR Dashboard's TabBtn / role="tabpanel"
// pattern for consistency.
type ClientTab = 'overview' | 'journey' | 'communication' | 'files' | 'construction'

function ClientTabBtn({ id, cur, set, children }: {
  id: ClientTab
  cur: ClientTab
  set: (v: ClientTab) => void
  children: React.ReactNode
}) {
  const sel = cur === id
  return (
    <button
      role="tab"
      id={`client-t-${id}`}
      aria-selected={sel}
      aria-controls={`client-p-${id}`}
      onClick={() => set(id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: 'none',
        border: 0,
        borderBottom: `2px solid ${sel ? 'var(--charcoal)' : 'transparent'}`,
        marginBottom: -1,
        padding: '9px 14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: sel ? 700 : 600,
        color: sel ? 'var(--text)' : 'var(--text3)',
        transition: 'color 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

// Takes the already-computed 37-step journey state (see getJourneyState) rather
// than journeyRows — the legacy phase/meeting-code lookup it used before always
// reported Phase 1 / the first legacy meeting no matter how far along the client was.
function buildGreeting(client: ClientData, journey: JourneyState): string {
  const { completedCount, currentStep, totalSteps } = journey
  if (!currentStep) {
    return `Hey! I have full context on ${client.name}. All ${totalSteps} steps completed — journey finished! How can I help?`
  }
  return `Hey! I have full context on ${client.name}. They're on step ${currentStep.step} of ${totalSteps} — ${currentStep.title}, ${completedCount} of ${totalSteps} steps completed. How can I help?`
}

function FloatingClientAI({ client, journey, messages, onSend, onClear, open, onOpenChange }: {
  client: ClientData
  journey: JourneyState
  messages: { role: 'user' | 'assistant'; content: string }[]
  onSend: (msg: string) => void
  onClear: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const greeting = buildGreeting(client, journey)
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
          background: 'var(--fable-red)', color: '#fff', border: 'none',
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
          // Half-width by default; expand toggles to near-full width.
          width: expanded ? '85vw' : 400, maxWidth: 'calc(100vw - 48px)',
          height: 540, maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRadius: 16,
          // Always-dark drawer: the body text + bubbles below are all white /
          // rgba-white (built for a dark surface), so the background must stay dark
          // in BOTH themes. Hardcoded #1A1918 (matches the header) — NOT
          // var(--charcoal) (inverts to a light colour in dark mode → the dark-mode
          // bug) and NOT var(--surface) (which is #fff in light mode, and would make
          // the white body text invisible in light mode).
          background: '#1A1918',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
          animation: 'clientAISlideUp 220ms ease',
        }}
      >
        {/* Header — always dark (fixed title bar), independent of theme. The rest of
            this drawer uses var(--charcoal) as its background; giving the header its
            own #1A1918 keeps it dark even in dark mode (where var(--charcoal) inverts
            to a light colour). The drawer body below is out of scope for this
            header-only fix and still uses var(--charcoal). */}
        <div
          className="px-5 py-3.5"
          style={{ background: '#1A1918', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}
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
                onClick={() => setExpanded(prev => !prev)}
                title={expanded ? 'Shrink' : 'Expand'}
                className="flex items-center justify-center rounded-[6px]"
                style={{
                  width: 26, height: 26, background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span aria-hidden>{expanded ? '⤡' : '⤢'}</span>
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
            <h2 style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.2px' }}>
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
  // Attribution, denormalized at write time like client_meeting_action_items does.
  // completed_by keeps holding the auth.users id it always has and is not read here.
  completed_at: string | null
  completed_by_name: string | null
}

// Workflow step data, role display names, badge styling and the stepCode /
// checklistKey helpers all live in @/lib/workflow-steps (imported at the top of
// this file). This page used to keep a full inline duplicate of them.

// ── Journey position — the ONE place "where is this client" is computed ────────
// The authoritative source is `workflow_step_completions` (loaded into the
// `stepCompletions` Set<number>), NOT client_meetings / journeyRows.
//
// journeyRows is keyed by client_meetings.meeting_id, which mixes retired
// JOURNEY_PHASES codes ('PR1m') with step codes ('step_04'). Nothing writes the
// retired codes from this page any more, so every `journeyRows.get(m.code)` lookup
// missed, read as "not completed", and pinned the Next Step banner + AI context to
// the first legacy meeting (PR1m — Internal Sales to Pre-Con Pass-Off) forever,
// regardless of real progress. The Meeting Journey section always used the correct
// source; this helper is that same logic, shared so the banner, the AI context
// string and the AI greeting can no longer drift from it.
interface JourneyState {
  completedCount: number
  currentStepNumber: number | null
  currentStep: WorkflowStepDef | null
  totalSteps: number
}

function getJourneyState(stepCompletions: Set<number>): JourneyState {
  const completedCount = WORKFLOW_STEPS.filter(s => stepCompletions.has(s.step)).length
  // Current step = first step that is not yet completed; null once all 37 are done.
  const currentStepNumber = WORKFLOW_STEPS.find(s => !stepCompletions.has(s.step))?.step ?? null
  const currentStep =
    currentStepNumber != null
      ? WORKFLOW_STEPS.find(s => s.step === currentStepNumber) ?? null
      : null
  return { completedCount, currentStepNumber, currentStep, totalSteps: TOTAL_WORKFLOW_STEPS }
}

// ── Workflow step card (replaces PhaseCard) ───────────────────────────────────

const workflowActionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
  color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)',
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
  onCreateInvite,
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
  // Fired by the "Schedule meeting" action in the header row. Receives THIS step —
  // the invite is always for the step whose card the button sits on.
  onCreateInvite: (targetStep: WorkflowStepDef) => void
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
        background: 'var(--surface)',
      }}
    >
      {/* Header row — click to expand/collapse. This is a div with role="button" rather
          than a real <button> because the "Schedule meeting" action below is itself a
          <button>, and a button may not contain another button (invalid HTML; React logs
          a validateDOMNesting warning and nested activation is unreliable). Keyboard
          activation is preserved explicitly via onKeyDown. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(v => !v)
          }
        }}
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
          <span className="shrink-0 self-center" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--pill-green-border)', padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
            Done
          </span>
        ) : isCurrent ? (
          <span className="shrink-0 self-center" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fable-red)', whiteSpace: 'nowrap' }}>
            Current
          </span>
        ) : null}

        {/* Schedule meeting — rendered on every non-window step (the 10 'customer' and
            4 'internal' steps), never on a work window. Builds the invite for THIS step,
            so no forward-scanning is involved. stopPropagation keeps the click from also
            toggling the header's expand/collapse. */}
        {step.type !== 'window' && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onCreateInvite(step) }}
            title={`Create a Teams invite for STEP${String(step.step).padStart(2, '0')} ${step.title}`}
            className="shrink-0 self-center"
            style={{
              ...workflowActionBtn,
              // Ghost/outline treatment so it sits at the same visual weight as the type
              // badge beside it: transparent fill, hairline neutral border and muted text
              // (the 0.5px + var(--border) + var(--text2) idiom already used by the time
              // window pill below), with padding/font size matched to the badge's
              // '2px 7px' / 9.5px. Only the icon carries the green accent.
              background: 'transparent',
              border: '0.5px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 9.5,
              padding: '2px 7px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
          >
            {/* Stroke set via style rather than the stroke attribute — presentation
                attributes don't resolve var(); same approach as the checkbox tick above. */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--green)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            Schedule meeting
          </button>
        )}

        {/* Chevron */}
        <span className="shrink-0 self-center" style={{ color: 'var(--text3)', fontSize: 11, paddingRight: 12, transition: 'transform 200ms ease', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', padding: '13px 15px 13px 43px' }}>
          {/* Time window pill */}
          {step.timeWindow && (
            <div style={{ marginBottom: 11 }}>
              <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--text2)', border: '0.5px solid var(--border)', background: 'var(--surface)', borderRadius: 99, padding: '2px 8px' }}>
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
                  style={{ flex: '1 1 240px', minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}
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
                      const row = checklistRows.get(key)
                      const checked = row?.completed ?? false
                      // ChecklistRowState is structurally identical to ActionCompletion,
                      // so the existing helper is reused as-is (not redefined).
                      const credit = completionLabel(row)
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
                            style={{ width: 14, height: 14, borderRadius: 3, border: checked ? '1.5px solid var(--checkbox-checked-bg, var(--charcoal))' : '1.5px solid var(--border2)', background: checked ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'background 120ms ease, border-color 120ms ease' }}
                          >
                            {checked && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            )}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--text)', opacity: checked ? 0.5 : 1, textDecoration: checked ? 'line-through' : 'none' }}>
                              {task}
                            </span>
                            {/* Who checked it + when, in ET. Hidden entirely when unchecked
                                (completionLabel returns null unless completed). */}
                            {credit && (
                              <span style={{ fontSize: 10, color: 'var(--green)' }}>{credit}</span>
                            )}
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
                  ? { ...workflowActionBtn, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.13)', border: '1px solid rgba(59, 130, 246, 0.28)', fontWeight: 600 }
                  : { ...workflowActionBtn, color: 'var(--text3)', opacity: 0.5, cursor: 'not-allowed' }}
              >
                🎙️ View Recap
              </button>
            )}
            {step.hasEmail && (
              <button type="button" onClick={() => onAction('email', step)} style={{ ...workflowActionBtn, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--badge-open-border)', fontWeight: 600 }}>✉️ Generate Recap Email</button>
            )}
            <button
              type="button"
              onClick={() => onMarkComplete(step.step, !isCompleted)}
              disabled={marking}
              style={{
                ...workflowActionBtn,
                color: isCompleted ? '#166534' : 'var(--btn-primary-text, #fff)',
                background: isCompleted ? 'var(--green-bg)' : 'var(--btn-primary-bg, var(--charcoal))',
                border: isCompleted ? '1px solid var(--pill-green-border)' : '1px solid var(--btn-primary-bg, var(--charcoal))',
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
  '1ST DESIGN': { bg: 'rgba(59, 130, 246, 0.13)', color: '#3b82f6' },
  'FLAG':       { bg: '#fef2f2', color: '#b91c1c' },
  '2ND DESIGN': { bg: 'var(--green-bg)', color: 'var(--green)' },
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
        border: checked ? '1.5px solid var(--checkbox-checked-bg, var(--charcoal))' : '1.5px solid var(--border2)',
        background: checked ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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
    <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Card header */}
      <button
        type="button"
        onClick={() => setCardOpen(v => !v)}
        className="w-full text-left flex items-center justify-between"
        style={{ padding: '13px 20px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: cardOpen ? '1px solid var(--border)' : 'none' }}
      >
        <div>
          <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Standing Agenda</h2>
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
                fontSize: 12, fontWeight: 600, color: 'var(--btn-primary-text, #fff)', background: 'var(--btn-primary-bg, var(--charcoal))',
                border: '1px solid var(--btn-primary-bg, var(--charcoal))', padding: '8px 16px', borderRadius: 7,
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

// Tolerant of both a JSON string and an already-parsed array.
function parseRecapActionItems(raw: unknown): RecapActionItem[] {
  if (!raw) return []
  let value: unknown = raw
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return value.filter((x): x is RecapActionItem => !!x && typeof x === 'object')
}

// The recap's action items live inside client_meetings.notes — a TEXT column holding
// the JSON blob the Fireflies webhook writes:
//   { summary, key_decisions, action_items: [{task, owner, due_date, done}], transcript }
// This section previously read a `client_meetings.action_items` column, which does not
// exist, so parseRecapActionItems(undefined) returned [] and every meeting rendered
// "No action items in this recap." Reading notes here matches what the Meeting Detail
// page (customers/[id]/meetings/[meetingId]) has always used.
function parseNotesActionItems(notes: unknown): RecapActionItem[] {
  if (typeof notes !== 'string' || notes.trim() === '') return []
  try {
    const parsed = JSON.parse(notes) as { action_items?: unknown }
    return parseRecapActionItems(parsed?.action_items)
  } catch {
    return []
  }
}

// ── Action-item completion state (client_meeting_action_items) ────────────────
// Completion is stored in its own table keyed by (client_meeting_id,
// task_text_normalized). It is NOT read from notes.action_items[].done — the
// Fireflies webhook rewrites notes wholesale on reprocessing, which would destroy
// anything kept inside the blob. That `done` flag is left exactly as written.
//
// IMPORTANT: this normalization must stay byte-identical to the copy in
// customers/[id]/meetings/[meetingId]/page.tsx. Both views key the same table by
// it, so any drift means a toggle in one view stops being visible in the other.
function normalizeTaskText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Local-map key for a (meeting, task) pair — several meetings share one map.
function actionKey(clientMeetingId: string, taskDisplay: string): string {
  return `${clientMeetingId}::${normalizeTaskText(taskDisplay)}`
}

// One completion row's worth of state. The display name is denormalized into
// completed_by_name at write time — the same changed_by / changed_by_name pattern
// agenda_audit_log uses below in this file — because users_select_own RLS stops a
// browser client from reading anyone else's users row after the fact. completed_by
// is still stored for referential integrity; nothing reads it for display.
interface ActionCompletion {
  completed: boolean
  completed_at: string | null
  completed_by_name: string | null
}

// Company timezone is Eastern (St. Petersburg, FL). America/New_York handles the
// EST/EDT switch; the trailing label is the literal "ET" per the agreed format.
// Kept byte-identical to the copy in meetings/[meetingId]/page.tsx.
function formatCompletedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time} ET`
}

// "✓ Jeff · Aug 10, 2026 · 3:45 PM ET". The name is read straight off the row, so
// no id → name lookup is involved. Degrades gracefully:
//  · completed_by_name null (legacy row predating the column, or the id couldn't
//    be resolved at write time) → timestamp only
//  · neither available → null, so the caller renders nothing at all
function completionLabel(c: ActionCompletion | undefined): string | null {
  if (!c || !c.completed) return null
  const when = formatCompletedAt(c.completed_at)
  const who  = c.completed_by_name?.trim() || undefined
  if (who && when) return `✓ ${who} · ${when}`
  if (who)         return `✓ ${who}`
  if (when)        return `✓ ${when}`
  return null
}

function CurrentStepTodos({
  currentStepNumber,
  checklistRows,
  checklistToggling,
  onToggleChecklist,
  journeyRows,
  stepStartMap,
  actionCompletions,
  actionToggling,
  onToggleActionItem,
}: {
  currentStepNumber: number | null
  checklistRows: Map<string, ChecklistRowState>
  checklistToggling: Set<string>
  onToggleChecklist: (meetingCode: string, role: string, taskText: string, next: boolean) => void
  journeyRows: Map<string, ClientMeetingRow>
  // NEW (additive): step → started_at, for per-task due-date indicators.
  stepStartMap: Map<number, Date>
  // Recap action-item completion, keyed by actionKey(client_meeting_id, task).
  actionCompletions: Map<string, ActionCompletion>
  actionToggling: Set<string>
  onToggleActionItem: (clientMeetingId: string, taskDisplay: string, next: boolean) => void
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
  const actionItems = recapRow ? parseNotesActionItems(recapRow.notes) : []
  // Completion comes from client_meeting_action_items, not from the item's own
  // `done` flag inside the notes blob.
  const actionRecord = (item: RecapActionItem): ActionCompletion | undefined =>
    recapRow && typeof item.task === 'string'
      ? actionCompletions.get(actionKey(recapRow.id, item.task))
      : undefined
  const isActionDone = (item: RecapActionItem): boolean => actionRecord(item)?.completed ?? false
  const actionsIncomplete = actionItems.filter(a => !isActionDone(a)).length

  // Today at local midnight, for overdue / due-soon comparisons.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function dueState(item: RecapActionItem): 'overdue' | 'soon' | 'normal' | null {
    if (!item.due_date) return null
    // Completed items never read as overdue/due-soon. Sourced from the completion
    // table via isActionDone, not from the item's own `done` flag.
    if (isActionDone(item)) return 'normal'
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
    color: 'var(--text3)', padding: '10px 20px', borderBottom: '1px solid var(--border)',
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
    <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Card header */}
      <div className="flex items-baseline justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>
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
        <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text3)' }}>All steps complete</div>
      ) : journeyTasks.length === 0 ? (
        <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text3)' }}>No journey tasks for this step.</div>
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
              const row = checklistRows.get(key)
              const checked = row?.completed ?? false
              // Same reused helper as the WorkflowStep site and the action items above.
              const credit = completionLabel(row)
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
                    padding: '8px 20px', background: 'transparent', borderTop: '1px solid var(--border)',
                    borderLeft: 'none', borderRight: 'none', borderBottom: 'none', textAlign: 'left',
                    cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{ width: 14, height: 14, borderRadius: 3, border: checked ? '1.5px solid var(--checkbox-checked-bg, var(--charcoal))' : '1.5px solid var(--border2)', background: checked ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'background 120ms ease, border-color 120ms ease' }}
                  >
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </span>
                  {/* NEW (additive): overdue tasks render in red; default color otherwise. */}
                  <span style={{ fontSize: 13, lineHeight: 1.4, color: taskDue === 'overdue' ? '#ef4444' : 'var(--text)', opacity: checked ? 0.5 : 1, textDecoration: checked ? 'line-through' : 'none' }}>
                    {task}
                  </span>
                  {/* NEW (additive): inline due-date indicator after the task text. */}
                  {taskDue === 'overdue' && (
                    <span style={{ background: 'var(--red-soft)', color: '#991b1b', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 1 }}>
                      Overdue
                    </span>
                  )}
                  {taskDue === 'soon' && (
                    <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 1 }}>
                      Due soon
                    </span>
                  )}
                  {taskDue === 'ok' && taskDueDate && (
                    <span style={{ fontSize: 10.5, color: '#22c55e', marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 2 }}>
                      Due in {daysUntilDue(taskDueDate)} day{daysUntilDue(taskDueDate) === 1 ? '' : 's'}
                    </span>
                  )}
                  {/* Who checked it + when, in ET. Hidden entirely when unchecked
                      (completionLabel returns null unless completed). */}
                  {credit && (
                    <span style={{ fontSize: 10.5, color: 'var(--green)', marginLeft: 6, flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 2 }}>
                      {credit}
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
        <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text3)' }}>No meeting recorded yet for this step</div>
      ) : actionItems.length === 0 ? (
        <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text3)' }}>No action items in this recap.</div>
      ) : (
        actionItems.map((item, i) => {
          const state = dueState(item)
          const done = isActionDone(item)
          const credit = completionLabel(actionRecord(item))
          const taskText = typeof item.task === 'string' ? item.task : ''
          const busy = !!recapRow && !!taskText && actionToggling.has(actionKey(recapRow.id, taskText))
          const textColor = done
            ? 'var(--text3)'
            : state === 'overdue' ? 'var(--fable-red)'
            : state === 'soon' ? 'var(--amber)'
            : 'var(--text)'
          return (
            <div key={i} style={{ padding: '8px 20px', borderTop: '1px solid var(--border)' }}>
              {/* Checkbox + task text. Same checked-state tokens as the Journey tab
                  checkboxes; the existing strikethrough/opacity treatment for a
                  completed item is preserved, just driven by real state now. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <button
                  type="button"
                  onClick={() => { if (!busy && recapRow && taskText) onToggleActionItem(recapRow.id, taskText, !done) }}
                  disabled={busy || !recapRow || !taskText}
                  aria-pressed={done}
                  aria-label={done ? `Mark "${taskText}" not done` : `Mark "${taskText}" done`}
                  style={{
                    flexShrink: 0, width: 14, height: 14, borderRadius: 3, marginTop: 2, padding: 0,
                    border: done ? '1.5px solid var(--checkbox-checked-bg, var(--charcoal))' : '1.5px solid var(--border2)',
                    background: done ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: busy ? 'wait' : taskText ? 'pointer' : 'not-allowed',
                    opacity: busy ? 0.6 : 1,
                    transition: 'background 120ms ease, border-color 120ms ease',
                  }}
                >
                  {done && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: textColor, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                  {item.task ?? 'Untitled task'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {item.owner && <span style={ownerBadgeStyle}>{item.owner}</span>}
                {item.due_date && (
                  <span style={{ fontSize: 11, color: done ? 'var(--text3)' : textColor }}>
                    Due {fmtDue(item.due_date)}
                  </span>
                )}
                {!done && state === 'overdue' && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--red-soft)', color: '#991b1b', borderRadius: 99, padding: '1px 7px' }}>Overdue</span>
                )}
                {!done && state === 'soon' && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--amber-bg)', color: 'var(--amber)', borderRadius: 99, padding: '1px 7px' }}>Due soon</span>
                )}
                <span style={{ fontSize: 10.5, color: 'var(--text3)', fontStyle: 'italic' }}>
                  from {recapRow.title}
                </span>
                {/* Who checked it + when, in ET. Omitted entirely when neither a
                    name nor a timestamp is available. */}
                {credit && (
                  <span style={{ fontSize: 10.5, color: 'var(--green)' }}>
                    {credit}
                  </span>
                )}
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
  // Which profile tab is showing. Presentation only — all four panels stay mounted
  // (hidden via the `hidden` attribute), so no fetch, effect or child state is
  // deferred or reset by switching tabs.
  const [activeTab, setActiveTab] = useState<ClientTab>('overview')
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
  // Confirmation shown after returning from the My Calendar locked-invite flow. `when`
  // is already formatted (or null when Graph's start couldn't be parsed / wasn't sent).
  const [createdToast, setCreatedToast] = useState<{ title: string; when: string | null } | null>(null)
  // Construction-only. Captured on mount from the return URL, then written once the
  // self-lookup has settled — at mount the identity refs are still null, and this row's
  // scheduled_by is a real FK to public.users, so writing immediately would persist an
  // unattributed schedule.
  const [pendingSchedule, setPendingSchedule] = useState<
    { stepNumber: number; scheduledAt: string; title: string } | null
  >(null)
  // Bumped after a schedule write lands so the Construction panel re-reads. The panel
  // mounts in parallel with that write, so without this the badge would only show up
  // after the tab was closed and reopened.
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0)
  // Collapse state for the moved-to-bottom info sections (collapsed by default).
  const [isPersonalityExpanded, setIsPersonalityExpanded] = useState(false)
  const [isPrioritiesExpanded, setIsPrioritiesExpanded] = useState(false)
  // Next Step card briefing — collapsed to 2 lines by default.
  const [isNextStepExpanded, setIsNextStepExpanded] = useState(false)
  const [editForm, setEditForm] = useState<EditClientForm | null>(null)
  // Live Client Solution Manager options for the edit modal's dropdown.
  const [ownerOptions, setOwnerOptions] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    fetchOwnerOptions()
      .then(names => { if (!cancelled) setOwnerOptions(names) })
      .catch(err => console.error('[client-detail] owner options load failed:', err))
    return () => { cancelled = true }
  }, [])
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
  // 37-step workflow completion state (workflow_step_completions table)
  const [stepCompletions, setStepCompletions] = useState<Set<number>>(new Set())
  const [stepMarking, setStepMarking] = useState<Set<number>>(new Set())
  // NEW (additive): when each step started (journey_step_start). Drives task due dates.
  const [stepStartMap, setStepStartMap] = useState<Map<number, Date>>(new Map())

  // ── Recap action-item completion (client_meeting_action_items) ───────────────
  // Keyed by actionKey(client_meeting_id, task) so every loaded meeting's items
  // coexist in one map. The Meeting Detail page writes the same table with the same
  // normalization, so toggling in either view is visible in the other.
  const [actionCompletions, setActionCompletions] = useState<Map<string, ActionCompletion>>(new Map())
  const [actionToggling, setActionToggling] = useState<Set<string>>(new Set())
  // The acting user's own public.users id + display name, resolved ONCE on mount and
  // shared by every completed_by / completed_by_name writer on this page — recap
  // action items AND journey checklists. Renamed from actionUser* when the journey
  // checklists started using it, so nobody adds a third self-lookup.
  // NOTE: distinct from checklistUserIdRef, which holds the auth.users id.
  const selfUserIdRef = useRef<string | null>(null)
  const selfUserNameRef = useRef<string | null>(null)
  // True once the lookup below has SETTLED — resolved or not. The refs above can't
  // drive a re-render, so anything that needs to gate UI on attribution being known
  // (the Construction Journey checkboxes) keys off this instead. Deliberately set on
  // every exit path including failure: a user whose row can't be resolved must still
  // be able to click, taking the documented name-less degradation rather than being
  // left with a permanently dead checkbox.
  const [selfUserReady, setSelfUserReady] = useState(false)

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
          .select('meeting_code, role, task_text, completed, completed_at, completed_by_name')
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
        for (const r of saved as {
          meeting_code: string
          role: string
          task_text: string
          completed: boolean
          completed_at: string | null
          completed_by_name: string | null
        }[]) {
          map.set(checklistKey(r.meeting_code, r.role, r.task_text), {
            completed:         r.completed,
            completed_at:      r.completed_at ?? null,
            completed_by_name: r.completed_by_name ?? null,
          })
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
      target_completion_date: row.target_completion_date ?? '',
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

  // ── Return from the My Calendar locked-invite flow ───────────────────────────
  // Reads ?tab=…&created=1&createdTitle=…&createdWhen=… once on mount. Shared by BOTH
  // journeys' Schedule-meeting buttons — the only difference between them is the `tab`
  // value each puts on its returnTo, so there is one reader here, not two.
  //
  // window.location rather than useSearchParams() so this page needs no Suspense
  // boundary — the same approach the calendar page uses to read these params.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const tab = q.get('tab')
    const created = q.get('created') === '1'

    // Only the two journey tabs are accepted. Compared against literals rather than a
    // list so TypeScript narrows to ClientTab without a cast.
    if (tab === 'journey' || tab === 'construction') setActiveTab(tab)

    if (created) {
      setCreatedToast({
        title: q.get('createdTitle') ?? '',
        // Formatted with this page's EXISTING helper — the URL carries the raw ISO
        // instant Graph confirmed, so no second date formatter is introduced. Returns
        // null for a missing or unparseable value, which the toast renders without.
        when: formatCompletedAt(q.get('createdWhen')),
      })
    }

    // ── Construction-only branch ──────────────────────────────────────────────
    // createdStep is written by handleCjCreateInvite and by nothing else, so its
    // presence is the discriminator. Absent → this was pre-con → nothing here runs and
    // pre-con's behaviour is exactly what it was before this change.
    const stepRaw = q.get('createdStep')
    const whenRaw = q.get('createdWhen')
    if (created && stepRaw && /^\d+$/.test(stepRaw) && whenRaw) {
      // scheduled_at is NOT NULL on the table, so an unparseable timestamp must not be
      // written at all — better no badge than a broken row.
      const validWhen = !isNaN(new Date(whenRaw).getTime())
      if (validWhen) {
        setPendingSchedule({
          stepNumber: Number(stepRaw),
          scheduledAt: whenRaw,
          title: q.get('createdTitle') ?? '',
        })
      }
    }

    // Strip all five so a refresh can't re-fire the toast, re-force the tab, or write
    // the schedule a second time. history.replaceState, NOT router.replace: no
    // navigation, no refetch, no scroll reset, and no re-run of route-keyed effects.
    if (tab || created) {
      q.delete('tab')
      q.delete('created')
      q.delete('createdTitle')
      q.delete('createdWhen')
      q.delete('createdStep')
      const qs = q.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    }
  }, [])

  // Auto-dismiss the created-meeting confirmation. Mirrors the plain `toast` timer
  // above; the × in the toast dismisses it immediately.
  useEffect(() => {
    if (!createdToast) return
    const timer = setTimeout(() => setCreatedToast(null), 5000)
    return () => clearTimeout(timer)
  }, [createdToast])

  // ── Persist a Construction step's scheduled meeting ──────────────────────────
  // Gated on selfUserReady, not run inline in the effect above, because at mount the
  // identity refs are still null and scheduled_by is a real FK to public.users. Waiting
  // one tick is what makes the row attributed. The upsert's UNIQUE (client_id,
  // step_number) is what turns a reschedule into an overwrite rather than a duplicate.
  useEffect(() => {
    if (!pendingSchedule || !selfUserReady) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('construction_step_schedules')
        .upsert(
          {
            client_id:         params.id,
            step_number:       pendingSchedule.stepNumber,
            scheduled_at:      pendingSchedule.scheduledAt,
            scheduled_title:   pendingSchedule.title,
            scheduled_by:      selfUserIdRef.current,
            scheduled_by_name: selfUserNameRef.current,
            // Sent explicitly: a column default only fires on INSERT, so without this
            // an overwriting reschedule would keep the original updated_at.
            updated_at:        new Date().toISOString(),
          },
          { onConflict: 'client_id,step_number' },
        )
      if (cancelled) return
      if (error) {
        // The Outlook event itself was created regardless — say so, rather than letting
        // a missing badge imply the meeting didn't happen.
        console.error('[cj-step-schedule] upsert failed:', error)
        setToast('Meeting created, but the schedule badge could not be saved.')
      } else {
        setScheduleRefreshKey(k => k + 1)
      }
      setPendingSchedule(null)
    })()
    return () => { cancelled = true }
  }, [pendingSchedule, selfUserReady, params.id])

  // ── Resolve the acting user's own public.users id + display name ─────────────
  // ONE lookup, shared by both completion features on this page. Lifted out of the
  // action-items effect (which early-returns when the client has no client_meetings
  // rows) so journey-checklist toggles can't end up writing a null name just because
  // no meetings are loaded. supabase.auth.getUser() returns the auth.users id — a
  // different namespace (see CLAUDE.md) — so match by email, with % and _ escaped so
  // ILIKE wildcards can't hit the wrong user. Left null if unresolvable.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return
        const { data: userRow } = await supabase
          .from('users')
          .select('id, name')
          .ilike('email', user.email.replace(/[%_]/g, '\\$&'))
          .maybeSingle()
        const self = userRow as { id: string; name: string | null } | null
        if (!cancelled) {
          selfUserIdRef.current   = self?.id ?? null
          selfUserNameRef.current = self?.name ?? null
        }
      } catch (err) {
        console.error('[self-user] lookup failed:', err)
      } finally {
        // Additive: unblocks consumers gated on the lookup being settled. Runs on the
        // no-email early return and the catch too, on purpose — see selfUserReady.
        if (!cancelled) setSelfUserReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Load recap action-item completion state ──────────────────────────────────
  // Depends on a stable joined id list rather than the journeyRows Map itself, so
  // marking a step complete (which replaces the Map) doesn't refetch this.
  const journeyMeetingIdKey = useMemo(
    () => Array.from(journeyRows.values()).map(r => r.id).filter(Boolean).sort().join(','),
    [journeyRows],
  )

  useEffect(() => {
    if (!journeyMeetingIdKey) return
    const ids = journeyMeetingIdKey.split(',')
    let cancelled = false

    async function loadActionCompletions() {
      const supabase = createClient()

      // The acting user's id/name come from the shared self-lookup effect above.

      // Zero rows is the normal first-visit case — items then render unchecked.
      // The display name comes down with each row, so no follow-up users query.
      const { data, error } = await supabase
        .from('client_meeting_action_items')
        .select('client_meeting_id, task_text_normalized, completed, completed_at, completed_by_name')
        .in('client_meeting_id', ids)

      if (cancelled) return
      if (error) {
        console.error('[action-items] completion load failed:', error.message)
        setToast('Could not load action-item progress. Items may show as unchecked.')
        return
      }

      const rows = (data ?? []) as {
        client_meeting_id: string
        task_text_normalized: string
        completed: boolean
        completed_at: string | null
        completed_by_name: string | null
      }[]
      const loaded = new Map<string, ActionCompletion>()
      for (const r of rows) {
        loaded.set(`${r.client_meeting_id}::${r.task_text_normalized}`, {
          completed:         r.completed === true,
          completed_at:      r.completed_at ?? null,
          completed_by_name: r.completed_by_name ?? null,
        })
      }
      setActionCompletions(loaded)
    }

    loadActionCompletions()
    return () => { cancelled = true }
  }, [journeyMeetingIdKey])

  // ── Toggle a recap action item + persist to client_meeting_action_items ──────
  // Upsert on the table's unique (client_meeting_id, task_text_normalized) so
  // re-toggling the same item updates in place instead of duplicating. Optimistic,
  // with a revert + visible toast on failure — never a silent console.warn.
  async function toggleRecapActionItem(clientMeetingId: string, taskDisplay: string, next: boolean) {
    const norm = normalizeTaskText(taskDisplay)
    const key = `${clientMeetingId}::${norm}`
    if (actionToggling.has(key)) return

    setActionToggling(prev => new Set(prev).add(key))

    // Stamp the same values we're about to write, so the current user's own name
    // and timestamp appear immediately — the name is already in hand from the
    // self-lookup above, so nothing needs resolving.
    const completedBy   = next ? selfUserIdRef.current : null
    const completedName = next ? selfUserNameRef.current : null
    const completedAt   = next ? new Date().toISOString() : null

    const prevValue = actionCompletions.get(key)
    setActionCompletions(prev => new Map(prev).set(key, {
      completed:         next,
      completed_at:      completedAt,
      completed_by_name: completedName,
    }))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('client_meeting_action_items')
        .upsert(
          {
            client_meeting_id:    clientMeetingId,
            task_text_normalized: norm,
            task_text_display:    taskDisplay,
            completed:            next,
            completed_by:         completedBy,
            completed_by_name:    completedName,
            completed_at:         completedAt,
          },
          { onConflict: 'client_meeting_id,task_text_normalized' },
        )
      if (error) throw error
    } catch (err) {
      console.error('[action-items] toggle failed:', err)
      setActionCompletions(prev => {
        const m = new Map(prev)
        if (prevValue === undefined) m.delete(key)
        else m.set(key, prevValue)
        return m
      })
      setToast('Could not save that action item. Please try again.')
    } finally {
      setActionToggling(prev => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  // ── Toggle a checklist task on/off + persist to journey_checklists ──────────
  // Local state is the source of truth. We update it optimistically and keep it
  // on success (no re-fetch). Rows are matched/updated by their natural columns
  // (client_id + meeting_code + role + task_text) instead of by a returned id,
  // which avoids the bug where an insert's `.select().single()` read-back fails
  // under RLS and incorrectly reverts the checkbox.
  async function toggleChecklistTask(meetingCode: string, role: string, taskText: string, next: boolean) {
    const key = checklistKey(meetingCode, role, taskText)
    setChecklistToggling(prev => new Set(prev).add(key))

    // Optimistic update so the checkbox feels instant. Stamps the same attribution
    // values we're about to write, so the acting user's own name and timestamp paint
    // immediately — the name is already in hand from the shared self-lookup, so
    // nothing needs resolving. Unchecking nulls all three, matching the existing
    // completed_by / completed_at pattern below.
    const existed = checklistRows.has(key)
    const prevRow = checklistRows.get(key)
    const completedName = next ? selfUserNameRef.current : null
    const completedAt   = next ? new Date().toISOString() : null
    setChecklistRows(prev => {
      const m = new Map(prev)
      m.set(key, { completed: next, completed_at: completedAt, completed_by_name: completedName })
      return m
    })

    try {
      const supabase = createClient()
      // Unchanged on purpose: completed_by keeps holding the auth.users id.
      const userId = checklistUserIdRef.current

      if (existed) {
        // A row already exists for this task → update it in place.
        const { error } = await supabase
          .from('journey_checklists')
          .update({
            completed: next,
            completed_by: next ? userId : null,
            completed_by_name: completedName,
            completed_at: completedAt,
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
            completed_by_name: completedName,
            completed_at: completedAt,
          })
        if (error) throw error
      }
      // Success: local state already reflects `next`, so nothing more to do.
    } catch (err) {
      console.error('[journey-checklist] toggle failed:', err)
      // Revert the optimistic change on failure. Restores the whole prior record —
      // completed, completed_at AND completed_by_name — not just the boolean.
      setChecklistRows(prev => {
        const m = new Map(prev)
        if (existed && prevRow) m.set(key, prevRow)
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
      target_completion_date: client.target_completion_date ?? '',
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
      // Independent dirty-check, identical in form to start_date's above. Each field
      // only contributes a key to `update` when it actually changed, so editing one
      // date never writes the other, and clearing a field back to '' persists as null.
      if (editForm.target_completion_date !== client.target_completion_date) {
        update.target_completion_date = editForm.target_completion_date || null
      }
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
      // Completed steps come from workflow_step_completions, not from journeyRows —
      // a journeyRows row only proves a recap was ingested, not that the team marked
      // the step complete, and its meeting_id may still carry a retired code.
      const completedStepList = WORKFLOW_STEPS
        .filter(s => stepCompletions.has(s.step))
        .map(s => `  Step ${s.step} — ${s.title}`)

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

      // Where the client actually is in the journey — same source as the Meeting
      // Journey section on this page (workflow_step_completions). See getJourneyState.
      const journey = getJourneyState(stepCompletions)
      const currentStepLine = journey.currentStep
        ? `Step ${journey.currentStep.step} of ${journey.totalSteps} — ${journey.currentStep.title} (${STEP_TYPE_CONFIG[journey.currentStep.type].label})`
        : `All ${journey.totalSteps} steps complete`

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
- Client Solution Manager: ${client.owner}
- Happiness Status: ${happinessLabel}

PERSONALITY & COMMUNICATION:
- Personality Tags: ${client.personality_tags?.join(', ') || 'None added'}
- Communication Style: ${client.communication_style || 'Not specified'}
- Key Interests: ${client.key_interests || 'Not specified'}
- How to Communicate: ${client.ai_tip || 'Not specified'}

KEY PRIORITIES:
${client.priorities.map(p => `- ${p.text}: ${p.status}`).join('\n') || '- None added'}

MEETING JOURNEY (37-step CASK Customer Journey — the authoritative source for where this client is):
- Progress: ${journey.completedCount} of ${journey.totalSteps} steps completed
- Current / Next Step: ${currentStepLine}
${completedStepList.length ? `- Completed Steps:\n${completedStepList.join('\n')}` : '- Completed Steps: None yet'}

${recapLines.length ? `MEETING RECAPS (most recent first):\n${recapLines.join('\n\n')}` : 'MEETING RECAPS: No recaps recorded yet.'}

${sentEmailLines.length ? `EMAILS SENT TO CLIENT:\n${sentEmailLines.join('\n')}` : 'EMAILS SENT TO CLIENT: No emails sent yet.'}

Only the MEETING JOURNEY section above states where this client is. Recap titles below may
still contain retired meeting codes (e.g. "PR1m") from an older numbering system — never
present one of those as the client's current or next step.

Use this context to answer questions about this client.
Help Calin and the team understand:
- How to communicate with this client based on their personality
- Which of the 37 steps they are on and what comes next
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
          <div className="rounded-[12px] h-[148px] shimmer mb-3.5" style={{ border: '1px solid var(--border)' }} />
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

  // ── 37-step workflow progress ──────────────────────────────────────────────
  // Drives the Meeting Journey section, the Next Step banner and the AI surfaces —
  // all from the one shared helper so they cannot disagree.
  const journey = getJourneyState(stepCompletions)
  const stepsCompletedCount = journey.completedCount
  const stepsPct = Math.round((stepsCompletedCount / TOTAL_WORKFLOW_STEPS) * 100)
  const currentStepNumber = journey.currentStepNumber
  const currentStepDef = journey.currentStep

  // "Schedule meeting" in a step card's header row. Builds the title in the exact shape
  // the Fireflies webhook parses — /^STEP(\d+)\s+(.+):\s*([^:]+)$/, so no space after
  // STEP, two digits, and the client name after the final colon — then hands it to My
  // Calendar prefilled and locked so the format can't be edited away.
  // Name is captured here rather than read inside the handler: the `client` guards
  // above narrow it in straight-line code, but that narrowing does not survive into a
  // nested function declaration.
  const inviteClientName = client.name
  function handleCreateInvite(targetStep: WorkflowStepDef) {
    const inviteTitle = `STEP${String(targetStep.step).padStart(2, '0')} ${targetStep.title}: ${inviteClientName}`
    const query = new URLSearchParams({
      prefillTitle: inviteTitle,
      locked: '1',
      // ?tab= is what fixes the old "always came back to Overview" gap. It rides on
      // returnTo, so the calendar page needs no knowledge of tabs at all — it just
      // preserves whatever it was handed and appends its own created* params.
      returnTo: `/customers/${params.id}?tab=journey`,
    })
    router.push(`/my-workspace/calendar?${query.toString()}`)
  }

  // Construction Journey's "Schedule meeting". Deliberately separate from
  // handleCreateInvite above rather than a shared generic: that one is the pre-con
  // STEP handler and is not being touched. This owns only the navigation — the CSTEP
  // title itself is built by cjInviteTitle in the CJ section, where the step data
  // lives. Same locked-invite mechanism, so the calendar page needs no changes.
  function handleCjCreateInvite(inviteTitle: string, stepNumber: number) {
    const query = new URLSearchParams({
      prefillTitle: inviteTitle,
      locked: '1',
      // Same mechanism as the pre-con handler above — only the tab value differs, plus
      // createdStep. That param is added HERE ONLY: construction_step_schedules is a
      // Construction-only table, so its presence on the way back is exactly what tells
      // the return handler this was a Construction invite and not a pre-con one.
      returnTo: `/customers/${params.id}?tab=construction&createdStep=${stepNumber}`,
    })
    router.push(`/my-workspace/calendar?${query.toString()}`)
  }

  // ── Derived values for the Fable redesign ──────────────────────────────────
  const allMeetingDefs = JOURNEY_PHASES.flatMap(p => p.meetings)

  // The Next Step banner's title/eyebrow now come from currentStepDef above. The
  // legacy phase + meeting-code lookup that used to feed them is gone: it read
  // journeyRows by JOURNEY_PHASES code, which nothing writes any more, so it always
  // resolved to Phase 1 / the first legacy meeting.

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

  // Primary branch (the most recent recap) is source-independent and already correct,
  // so it is unchanged. Only the no-recap-yet fallback was rewritten — it used to
  // describe the legacy phase; it now describes 37-step position.
  const nextStepDesc = lastCompleted?.recap
    ? summarize(lastCompleted.recap, 180)
    : currentStepDef
    ? `Continue step ${currentStepDef.step} of ${TOTAL_WORKFLOW_STEPS} — ${stepsCompletedCount} of ${TOTAL_WORKFLOW_STEPS} steps complete.`
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
    background: 'var(--surface)', color: 'var(--text)', whiteSpace: 'nowrap', fontFamily: 'inherit',
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
              <h2 style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
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
                    <label style={editLabelStyle}>Client Solution Manager</label>
                    <select
                      value={editForm.owner}
                      onChange={e => setEditForm(f => f && { ...f, owner: e.target.value })}
                      style={{ ...editInputStyle, cursor: 'pointer' }}
                      onFocus={editFocus}
                      onBlur={editBlur}
                    >
                      {/* This client's OWN current CSM is appended before the
                          dedupe, so it is always present as an option no matter
                          what the live query returned — including while it is
                          still in flight, and including a name that no longer
                          appears on any other client. Without it the select
                          would render blank and a save could overwrite the
                          field with a value the user never chose. */}
                      {[...ownerOptions, editForm.owner].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i).map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Target Completion Date — optional, and the sibling of Start Date
                    above. Placed in its own row rather than inside that grid so the
                    existing Start Date / Client Solution Manager pairing keeps its
                    current positions. Same input type, same nullable handling, same
                    independent dirty-check on save as start_date. */}
                <div style={editFieldStyle}>
                  <label style={editLabelStyle}>Target Completion Date</label>
                  <input
                    type="date"
                    value={editForm.target_completion_date}
                    onChange={e => setEditForm(f => f && { ...f, target_completion_date: e.target.value })}
                    style={editInputStyle}
                    onFocus={editFocus}
                    onBlur={editBlur}
                  />
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
              <h2 style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.3 }}>
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
                <h2 style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
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
                <h2 style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
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
            zIndex: 10002, background: 'var(--green)', color: '#fff',
            padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}

      {/* Meeting-created confirmation — shown once after returning from the locked
          invite flow, then the URL params are stripped so a refresh won't repeat it.
          Sits above the plain toast's slot; pointerEvents are ON here (unlike that
          one) because this card carries a dismiss button. */}
      {createdToast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10003, background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderLeft: '3px solid var(--green)',
            padding: '11px 13px 11px 14px', borderRadius: 9,
            boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            maxWidth: 420, minWidth: 260,
          }}
        >
          {/* Green check, same 9x9 polyline the checkboxes use, in a filled circle. */}
          <span
            className="shrink-0"
            style={{
              width: 18, height: 18, borderRadius: '50%', background: 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ stroke: '#fff' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>

          <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Meeting created</span>
            {createdToast.title && (
              <span style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--text3)', wordBreak: 'break-word' }}>
                {createdToast.title}
              </span>
            )}
            {/* Confirmed start time, in the page's standard ET format. Omitted entirely
                when Graph didn't return a parseable start. */}
            {createdToast.when && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--green)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--green)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {createdToast.when}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={() => setCreatedToast(null)}
            aria-label="Dismiss"
            className="shrink-0"
            style={{
              background: 'transparent', border: 'none', padding: 0, marginLeft: 2,
              color: 'var(--text3)', fontSize: 15, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ×
          </button>
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
                <h2 style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 18, fontWeight: 400, color: '#fff', margin: 0, lineHeight: 1.3 }}>
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

        {/* ── Profile tabs (NEW) ───────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Client profile views"
          style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 24 }}
        >
          <ClientTabBtn id="overview" cur={activeTab} set={setActiveTab}>Overview</ClientTabBtn>
          <ClientTabBtn id="journey" cur={activeTab} set={setActiveTab}>Precon Journey</ClientTabBtn>
          {/* 5th tab. Deliberately UNGATED client-side, exactly like the four tabs
              around it — the email allowlist that used to wrap this is now scoped to
              the Admin override switch inside the panel and nothing else. The real
              boundary for everything this panel reads or writes is RLS: on
              construction_step_marks, construction_step_completions,
              construction_step_schedules and workflow_step_completions, and on the
              construction-files bucket. Do not reintroduce a UI gate here as a
              security measure — it never was one. */}
          <ClientTabBtn id="construction" cur={activeTab} set={setActiveTab}>Construction Journey</ClientTabBtn>
          <ClientTabBtn id="communication" cur={activeTab} set={setActiveTab}>Communication</ClientTabBtn>
          <ClientTabBtn id="files" cur={activeTab} set={setActiveTab}>Files &amp; Agenda</ClientTabBtn>
        </div>

        {/* ══════════════ OVERVIEW ══════════════ */}
        <section id="client-p-overview" role="tabpanel" aria-labelledby="client-t-overview" hidden={activeTab !== 'overview'}>
        {/* ── Hero (kept dark — it earned it) ───────────────────────────── */}
        <section
          className="rounded-[12px]"
          style={{
            background: 'var(--sidebar)',
            color: '#E8E8EB',
            border: '1px solid var(--border)',
            padding: '22px 24px',
            marginBottom: 20,
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
                    fontFamily: 'var(--font-instrument), Georgia, serif',
                    fontWeight: 500,
                    fontSize: 26,
                    letterSpacing: '-0.5px',
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
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#ffffff',
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
                  if (client.owner) nodes.push(<span key="owner">CSM <b style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 550 }}>{client.owner}</b></span>)
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
        {currentStepDef && (
          <section
            className="rounded-[12px]"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '16px 20px',
              marginBottom: 20,
            }}
          >
            <span style={{ width: 3, alignSelf: 'stretch', background: 'var(--fable-red)', borderRadius: 3, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div
                className="uppercase"
                style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--text3)', fontWeight: 700 }}
              >
                Next step · Step {currentStepDef.step} of {TOTAL_WORKFLOW_STEPS}
              </div>
              <div
                style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginTop: 4, color: 'var(--text)' }}
              >
                {currentStepDef.title}
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
              actionCompletions={actionCompletions}
              actionToggling={actionToggling}
              onToggleActionItem={toggleRecapActionItem}
            />

        </div>{/* /full-width stacked layout */}
        </section>{/* /OVERVIEW */}

        {/* ══════════════ JOURNEY ══════════════ */}
        <section id="client-p-journey" role="tabpanel" aria-labelledby="client-t-journey" hidden={activeTab !== 'journey'}>
        <div className="flex flex-col gap-5">

        {/* ── Meeting Journey — 37-step workflow ────────────────────────── */}
        <div ref={journeyRef} className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-baseline justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Meeting Journey</h2>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
              {stepsCompletedCount} of {TOTAL_WORKFLOW_STEPS} steps{sentEmailCount > 0 ? ` · ${sentEmailCount} emails` : ''}
            </span>
          </div>

          {/* Progress */}
          <div className="flex items-center" style={{ gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <b style={{ fontWeight: 600, color: 'var(--text)' }}>{stepsCompletedCount} of {TOTAL_WORKFLOW_STEPS}</b> steps complete
            </span>
            <span className="flex-1 overflow-hidden" style={{ height: 4, borderRadius: 99, background: 'var(--surface2)' }}>
              <span style={{ display: 'block', height: '100%', width: `${stepsPct}%`, background: happiness.accent, borderRadius: 99, transition: 'width 200ms ease' }} />
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
                onCreateInvite={handleCreateInvite}
              />
            ))}
          </div>
        </div>
        </div>
        </section>{/* /JOURNEY */}

        {/* ══════════════ COMMUNICATION ══════════════ */}
        <section id="client-p-communication" role="tabpanel" aria-labelledby="client-t-communication" hidden={activeTab !== 'communication'}>
        <div className="flex flex-col gap-5">

        {/* ── Emails — Pending (left) | Sent (right), side-by-side grid ──── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column: Pending Emails */}
        <div>
        {emailDrafts.length > 0 && (
          <div
            className="rounded-[12px] p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {/* Custom amber header for actionable drafts */}
            <div className="flex items-center gap-2 mb-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85, color: 'var(--amber)' }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="2,4 12,13 22,4" />
              </svg>
              <span
                className="text-[12px] font-bold tracking-[1.2px] uppercase"
                style={{ color: 'var(--amber)' }}
              >
                Pending Emails
              </span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--badge-open-border)' }}
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
                    background: 'var(--amber-bg)',
                    border: '1px solid var(--badge-open-border)',
                    borderLeft: '3px solid var(--amber)',
                  }}
                >
                  {/* Draft header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold tracking-[0.4px] shrink-0"
                          style={{
                            background: 'var(--amber)',
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
                          style={{ color: 'var(--amber)' }}
                        >
                          {draft.subject}
                        </span>
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--amber)' }}>
                        To: {draft.recipient_name}{draft.recipient_email ? ` (${draft.recipient_email})` : ''}
                      </div>
                      {draft.created_at && (
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--amber)', opacity: 0.7 }}>
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
                        color: 'var(--amber)', background: 'var(--surface)', border: '1px solid var(--badge-open-border)',
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--badge-open-border)' }}
                    >
                      👁 Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => { setEditDraft(draft); setEditBody(draft.body) }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        color: 'var(--amber)', background: 'var(--surface)', border: '1px solid var(--badge-open-border)',
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--badge-open-border)' }}
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
                        color: 'var(--btn-primary-text, #fff)', background: 'var(--btn-primary-bg, var(--charcoal, #1a1917))', border: 'none',
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
          <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-baseline justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Sent Emails</h2>
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
                    style={{ gap: 12, padding: '11px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer', overflow: 'hidden' }}
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

        {/* ── Recent Meeting Recaps (NEW) ───────────────────────────────── */}
        <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-baseline justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Recent Meeting Recaps</h2>
          </div>
          {recentRecaps.length === 0 ? (
            <div style={{ padding: '15px 20px', fontSize: 13, color: 'var(--text3)' }}>
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
                    style={{ gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}
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
                      style={{ ...workflowActionBtn, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.13)', border: '1px solid rgba(59, 130, 246, 0.28)', fontWeight: 600 }}
                    >
                      View Recap →
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>{/* /Recent Meeting Recaps */}

        {/* ── Personality & Communication (moved · collapsible) ─────────── */}
        {(client.personality_tags.length > 0 || hasInterests || hasComm || hasTip) && (
        <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button
            type="button"
            onClick={() => setIsPersonalityExpanded(v => !v)}
            className="w-full flex items-center justify-between"
            style={{ padding: '13px 20px', borderBottom: isPersonalityExpanded ? '1px solid var(--border)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Personality &amp; Communication</h2>
            <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform 200ms ease', transform: isPersonalityExpanded ? 'none' : 'rotate(-90deg)' }}>▾</span>
          </button>
          {isPersonalityExpanded && (
              <div style={{ padding: '15px 20px' }}>
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
              <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <button
                  type="button"
                  onClick={() => setIsPrioritiesExpanded(v => !v)}
                  className="w-full flex items-center justify-between"
                  style={{ padding: '13px 20px', borderBottom: isPrioritiesExpanded ? '1px solid var(--border)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Key Priorities</h2>
                  <span className="flex items-center" style={{ gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>From meeting recaps</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform 200ms ease', transform: isPrioritiesExpanded ? 'none' : 'rotate(-90deg)' }}>▾</span>
                  </span>
                </button>
                {isPrioritiesExpanded && (
                <div style={{ padding: '6px 20px' }}>
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
        </div>
        </section>{/* /COMMUNICATION */}

        {/* ══════════════ FILES & AGENDA ══════════════ */}
        <section id="client-p-files" role="tabpanel" aria-labelledby="client-t-files" hidden={activeTab !== 'files'}>
        <div className="flex flex-col gap-5">

        {/* ── Project Files (NEW · additive) ────────────────────────────── */}
        <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {/* Hidden file input — drives the "+ Upload File" / browse buttons */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Header */}
          <div className="flex items-center justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>Project Files</h2>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                color: 'var(--fable-red)', background: 'var(--surface)', border: '1px solid var(--border)',
                padding: '4px 10px', borderRadius: 5, whiteSpace: 'nowrap',
                cursor: uploadingFile ? 'not-allowed' : 'pointer', opacity: uploadingFile ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              + Upload File
            </button>
          </div>

          {/* Upload area / status */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                color: 'var(--fable-red)', background: 'var(--surface)', border: '1px solid var(--border)',
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
            <div style={{ padding: '15px 20px', fontSize: 13, color: 'var(--text3)' }}>
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
                    style={{ gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}
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
                        color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)',
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
                        color: 'var(--red)', background: 'var(--surface)', border: '1px solid var(--red-border, #f5c9c2)',
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

        {/* ── Standing Agenda (NEW) ─────────────────────────────────────── */}
        <StandingAgenda clientId={params.id} clientName={client.name} clientProjectAddress={client.project_address ?? ''} onToast={setToast} />
        </div>
        </section>{/* /FILES & AGENDA */}

        {/* ══════════════ CONSTRUCTION JOURNEY ══════════════ */}
        {/* NOT AN INCONSISTENCY: the four panels above are always mounted and hidden
            via the `hidden` attribute, deliberately, so a tab switch never unmounts
            their fetches and effects. This panel is still mount-gated on activeTab
            instead — no longer because an allowlist required it absent from the DOM
            (that allowlist is gone from here), but because it owns fetches (per-task
            step completions, marks, schedules, precon progress) that we WANT re-read
            on re-entry, since another operator may have ticked a box in the meantime.
            What still resets on tab exit is only the override/filter/expand state.
            selfUserIdRef / selfUserNameRef are threaded down rather than re-resolved:
            the lookup above is the page's single copy and its declaration comment
            explicitly warns against adding another.
            canSeeAdminOverride is the ONLY thing the email allowlist still decides —
            it gates the Admin override switch inside the panel, nothing else. It is
            false until userEmail resolves, which is what keeps that switch out of the
            first paint rather than flashing in and out. */}
        {activeTab === 'construction' && (
          <section id="client-p-construction" role="tabpanel" aria-labelledby="client-t-construction">
            <ConstructionJourneyPanel
              clientId={params.id}
              clientName={client.name}
              onCreateInvite={handleCjCreateInvite}
              scheduleRefreshKey={scheduleRefreshKey}
              selfUserIdRef={selfUserIdRef}
              selfUserNameRef={selfUserNameRef}
              selfUserReady={selfUserReady}
              canSeeAdminOverride={canSeeCjPreview(userEmail)}
            />
          </section>
        )}

        </div>{/* /max-width wrapper */}
      </div>

      {/* ── CASK Intelligence (floating) ──────────────────────────────── */}
      <FloatingClientAI
        client={client}
        journey={journey}
        messages={chatMessages}
        onSend={handleChatSend}
        onClear={clearHistory}
        open={aiOpen}
        onOpenChange={setAiOpen}
      />
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSTRUCTION JOURNEY — PANEL (additive, self-contained)
//
// Everything below this line is self-contained. Nothing above it calls into this
// block except the 5th tab button and the 5th panel in ClientDetailPage, neither
// of which is gated any more: both render for any authenticated user. The single
// surviving `canSeeCjPreview(userEmail)` call is the `canSeeAdminOverride` prop
// threaded into the panel, and its only effect is whether the Admin override
// switch renders.
//
// Declared after ClientDetailPage rather than before it to keep the diff to one
// contiguous append; function declarations hoist, and the consts are only read at
// render time, long after module evaluation.
//
// Ported verbatim from (app)/construction-journey-preview/page.tsx, with every
// identifier Cj/CJ_-prefixed: this file already imports ROLE_NAMES and
// STEP_TYPE_CONFIG from @/lib/workflow-steps and uses `Step` throughout.
// ═════════════════════════════════════════════════════════════════════════════

type CjStepType = 'customer' | 'internal' | 'email' | 'window'
type CjStepStatus = 'done' | 'current' | 'pending'

interface CjRoleBlock {
  r: string
  tasks: string[]
  // NO LONGER READ. This used to seed the mock checkbox state; per-task completion now
  // comes from construction_step_completions, so what renders is whatever the database
  // holds for this client. Left in the data rather than stripped from all 19 steps,
  // which would be a large unrelated diff — but nothing consumes it.
  done: number[]
}

interface CjStep {
  n: number
  type: CjStepType
  title: string
  // NO LONGER READ. Step-level completion now comes from construction_step_marks, and
  // "current" is derived as the lowest-numbered unmarked step — so the badge, the
  // progress bar and the default-expanded row are all per-client data, not this
  // literal. Left in the data rather than stripped from all 19 steps (a large diff for
  // no behaviour change), following the same precedent as CjRoleBlock.done above.
  status: CjStepStatus
  objective: string
  who: string
  roles: CjRoleBlock[]
}

// ── The 19 Construction Journey steps (static, verbatim) ─────────────────────

const CJ_STEPS: CjStep[] = [
  {n:1,type:'customer',title:'C1 — Kickoff Meeting with Customer',status:'done',
   objective:'Organize drawings, selections, and changes; set expectations; review BT schedule and field plans; confirm site logistics.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Present Cask and the team','Review BT schedule and upcoming construction journey','Review permitted set of plans and marked-up field set','Review electrical, kitchen, bathroom, plumbing, HVAC, window placement, exterior wall finish','Identify neighbors of concern','Confirm backyard laydown space; coordinate owner to clear area and install temp fencing','Verify construction sign install location with flag','Confirm QR code sheet is in the job box for sub plan review','If demo required — review demo FAQs (utility shutoff, clear space, etc.)','Schedule next meeting (Foundation and Slab on Grade)'],done:[0,1]},
          {r:'super',tasks:['Walk site and confirm all field conditions noted','Mark up field set of plans with 100% of changes'],done:[0]}]},

  {n:2,type:'email',title:'C1 Email — Kickoff Meeting Recap',status:'current',
   objective:'Send kickoff recap to customer; confirm foundation meeting date and site survey date.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Include kickoff meeting agenda notes and any changes to field set of plans','Confirm date and time for Foundation and Slab on Grade meeting','Confirm date for site survey'],done:[]}]},

  {n:3,type:'window',title:'Demo (if needed)',status:'pending',
   objective:'If demo required — 3–6 weeks post kickoff; disconnect utilities, contact 811 Dig, prep demo site.',
   who:'Superintendent',
   roles:[{r:'super',tasks:['Disconnect utilities','Contact 811 Dig','Prep demo site (removal of items from area)'],done:[]}]},

  {n:4,type:'window',title:'Site Survey and Layout',status:'pending',
   objective:'Schedule survey and request pinning of building and blue-top elevation; double-check all setbacks.',
   who:'Superintendent',
   roles:[{r:'super',tasks:['Schedule site survey','Request pinning of building and blue-top elevation','Double-check setbacks: side, rear, front; stair setbacks if stairs planned'],done:[]}]},

  {n:5,type:'internal',title:'Internal Sub Meeting — Structure',status:'pending',
   objective:'Email field set of plans; superintendent walks subs and reviews scope of work.',
   who:'Superintendent, subs (framer, concrete, electrician, plumber)',
   roles:[{r:'super',tasks:['Email field set of plans to all subs','Framer — review elevation changes, window/door/garage openings, wall finishes, truss layout','Concrete — review elevation changes, window/door/garage openings, wall finishes','Electrician — install and double-check all underground','Plumber — install and double-check all underground'],done:[]}]},

  {n:6,type:'customer',title:'C2 — Foundation and Slab on Grade Meeting',status:'pending',
   objective:'Review BT schedule; walk site to confirm building corners, setbacks, slab elevation, and sanitary conditions.',
   who:'Superintendent, customer',
   roles:[{r:'super',tasks:['Review BT schedule highlighting structure timeline','Walk site: confirm corners of building, setbacks (rear, side, front), stair setback per zoning','Confirm elevation of slab on grade','Determine sanitary condition; inform owner of replacement if needed'],done:[]}]},

  {n:7,type:'email',title:'C2 Email — Foundation and Slab on Grade Recap',status:'pending',
   objective:'Send meeting recap; outline next stage in customer journey.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Include foundation and slab meeting agenda notes and any changes to field set of plans','Outline next stage in customer journey'],done:[]}]},

  {n:8,type:'email',title:'C3 Email — Structure Stage Expectations',status:'pending',
   objective:'Set customer expectations for the structure stage; outline schedule and site activity.',
   who:'Sender: Project manager · CC: Superintendent, framer, concrete subs → to customer',
   roles:[{r:'pm',tasks:['Confirm structure complete celebration meeting date and time','Outline BT schedule and workflow for structure stage','Detail which subs will be on site during structure','Share best practices — notify neighbors of high-traffic period; provide FAQ post-card if needed'],done:[]}]},

  {n:9,type:'customer',title:'C3 Meeting — Structure Complete Celebration',status:'pending',
   objective:'Walk space; celebrate passing structure; prepare for MEP rough-in stage.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Review BT schedule highlighting next steps in construction journey','Walk the completed structure with customer','Confirm rough-in next steps and upcoming MEP work'],done:[]},
          {r:'super',tasks:['Verify construction sign and QR code sheet are in place in job box'],done:[]}]},

  {n:10,type:'email',title:'C4 Email — Structure Complete Celebration Recap',status:'pending',
   objective:'Send celebration meeting recap; outline rough-in stage.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Include celebration meeting agenda notes and any changes to field set of plans','Outline next stage (rough-in) in customer journey'],done:[]}]},

  {n:11,type:'internal',title:'Internal Sub Meeting — Rough-In',status:'pending',
   objective:'Walk subs with updated scope; review MEP layout before installation.',
   who:'Superintendent, subs',
   roles:[{r:'super',tasks:['Review BT schedule highlighting rough-in stage','Review permitted plans and marked-up field plans with subs','Cover: electrical layout, kitchen layout, bathroom lighting and vanity, plumbing, HVAC'],done:[]}]},

  {n:12,type:'customer',title:'C4 Meeting — Rough-In with Customer',status:'pending',
   objective:'Walk space with client to lay out electrical, kitchen, plumbing, and HVAC before MEPs are installed.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Review BT schedule highlighting next steps','Walk and confirm: electrical layout, kitchen layout, bathroom lighting/vanity, plumbing, HVAC','Determine neighbor concerns; coordinate direct communication if needed','Verify construction sign and QR code sheet are in place in job box'],done:[]},
          {r:'super',tasks:['Confirm all marked-up field plans are current'],done:[]}]},

  {n:13,type:'customer',title:'C5 Meeting — Finishes with Customer',status:'pending',
   objective:'Post-drywall re-walk; review and confirm all finishes to be installed; celebrate framing and in-wall inspections passing.',
   who:'Project manager, superintendent, selections manager, customer',
   roles:[{r:'pm',tasks:['Review BT schedule and selections packet','Update field drawings for all finishes to be installed','Celebrate customer passing framing and in-wall inspections','Verify construction sign and QR code sheet with updated link to plans are in job box','Confirm selections packet is in job box'],done:[]},
          {r:'select',tasks:['Walk through all finish selections with customer','Confirm kitchen and bathroom layout decisions','Document any open decisions still to be made and assign due dates'],done:[]},
          {r:'super',tasks:['Confirm field drawings are updated for all finishes'],done:[]}]},

  {n:14,type:'internal',title:'Internal Sub Meeting — Finishes',status:'pending',
   objective:'Walk subs installing finishes; review updated field drawings and selections.',
   who:'Superintendent, subs',
   roles:[{r:'super',tasks:['Review BT schedule and selections packet with subs','Review kitchen and bathroom layout with relevant subs','Update field drawings for all finishes to be installed'],done:[]}]},

  {n:15,type:'email',title:'C5 Email — Finish Meeting Recap',status:'pending',
   objective:'Send finish meeting recap; confirm open decisions and due dates.',
   who:'Sender: Project manager · CC: Superintendent, selections manager, appropriate subs → to customer',
   roles:[{r:'pm',tasks:['Recap bathroom and kitchen selections decisions; include on marked-up drawings','List items discovered during the meeting','List decisions still to be made with due dates'],done:[]}]},

  {n:16,type:'email',title:'C6 Email — Close Out Steps to Customer',status:'pending',
   objective:'Notify customer of punchlist walkthrough availability; outline close-out process.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Provide available dates and times for punchlist walkthrough','Outline close-out process: permitting, punchlist, and turnover'],done:[]}]},

  {n:17,type:'customer',title:'C6 Meeting — Punchlist Walkthrough',status:'pending',
   objective:'Walk punchlist items still to be addressed; receive customer confirmation all concerns are resolved.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Review BT punchlist with customer','Identify items missing or to be repaired','Receive customer confirmation all concerns are addressed by end of meeting'],done:[]},
          {r:'super',tasks:['Walk all punchlist items; note any new items raised by customer'],done:[]}]},

  {n:18,type:'email',title:'C7 Email — Punchlist Walkthrough Recap',status:'pending',
   objective:'Send recap of punchlist walkthrough; outline next steps and send final walkthrough invite if available.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Review punchlist walkthrough agenda notes','Include BT punchlist print view with timestamps of completed items','Outline next steps; include final walkthrough meeting invite if available'],done:[]}]},

  {n:19,type:'customer',title:'C7 Meeting — Final Walkthrough with Customer',status:'pending',
   objective:'Conduct full interior and exterior walkthrough; deliver project to customer; close out certificate of completion.',
   who:'Project manager, superintendent, marketing manager, customer',
   roles:[{r:'pm',tasks:['Review status of Certificate of Completion (CO) and permit closing','Conduct interior walkthrough: doors and windows, appliances, walls and rooms, thermostat','Conduct exterior walkthrough: property perimeter, signage','Verify all punchlist items are complete; note any remaining items','Provide customer with ADU best practices sheet and warranty contact info','Provide CASK blueprint gift','Remove construction sign','Confirm testimonial video date/time; encourage online review'],done:[]},
          {r:'super',tasks:['Confirm punchlist is fully resolved prior to walkthrough'],done:[]},
          {r:'market',tasks:['Coordinate testimonial video recording','Capture project completion photos/video for marketing'],done:[]}]}
]

// ── Display config ───────────────────────────────────────────────────────────

// Local copies rather than imports from lib/workflow-steps.ts: that module is the
// 37-step pre-construction source of truth and is out of scope here. The three
// shared types keep its exact colours so the two journeys look like one system;
// 'email' is new to this journey and takes the blue already used for the recap
// action on the real client page.
const CJ_STEP_TYPE_CONFIG: Record<CjStepType, { bar: string; label: string; badgeBg: string; badgeText: string }> = {
  internal: { bar: '#6366f1', label: 'Internal',    badgeBg: '#eef2ff', badgeText: '#4338ca' },
  window:   { bar: '#f59e0b', label: 'Work Window', badgeBg: '#fffbeb', badgeText: '#92400e' },
  customer: { bar: '#ef4444', label: 'Customer',    badgeBg: '#fef2f2', badgeText: '#b91c1c' },
  email:    { bar: '#3b82f6', label: 'Email',       badgeBg: '#eff6ff', badgeText: '#1d4ed8' },
}

const CJ_ROLE_NAMES: Record<string, string> = {
  pm: 'Project Manager',
  super: 'Superintendent',
  select: 'Selections Manager',
  market: 'Marketing Manager',
}

const CJ_ROLE_COLORS: Record<string, string> = {
  pm: '#3b82f6',
  super: '#8b5cf6',
  select: '#ec4899',
  market: '#14b8a6',
}

// Same shape as the real client page's workflowActionBtn.
const cjActionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
  color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)',
  padding: '4px 9px', borderRadius: 5, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
}

const cjBadgeBase: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap',
}

// One key per (step, role, task text) — exactly the natural key of a
// construction_step_completions row, so the same helper keys both the local Map and
// the database row and there is no second key format to keep in sync.
//
// Keyed on the task TEXT, not its array index, matching the existing precedent in
// journey_checklists and client_meeting_action_items: index keying silently
// misattributes completion state if tasks are ever reordered or edited, whereas
// text keying only fails visibly — a reworded task simply shows unchecked again,
// which is the known and accepted trade-off.
//
// The `||` separator is safe: no CJ_STEPS task string contains it (verified across
// all 85 task strings, which are plain ASCII apart from an em dash).
function cjTaskKey(n: number, role: string, task: string) {
  return `${n}||${role}||${task}`
}

// Invite title for a Construction Journey step. Mirrors the shape the pre-con
// handleCreateInvite builds, but with a CSTEP prefix instead of STEP: Construction
// steps are numbered 1-19 and pre-con 1-37, so a bare STEP01 would be ambiguous
// between the two journeys.
//
// NOT YET PARSED ON INGESTION: the Fireflies webhook matches
// /^STEP(\d+)\s+(.+):\s*([^:]+)$/ and does not recognise a CSTEP prefix. Teaching it
// to is a separate, later task — until then these invites carry the right format but
// are not auto-linked back to a step when the meeting is recorded.
//
// Same caveat the real handler documents: a client name containing a colon would
// break the trailing ([^:]+)$ shape. Not a concern for real CASK client names.
function cjInviteTitle(n: number, title: string, clientName: string): string {
  return `CSTEP${String(n).padStart(2, '0')} ${title}: ${clientName}`
}

// One construction_step_schedules row, reduced to what the header badge needs.
// `at` is the raw timestamptz — formatting happens at render via formatCompletedAt.
interface CjSchedule {
  at: string
  title: string | null
}

// ── CjStep row ─────────────────────────────────────────────────────────────────

function CjStepRow({
  step,
  completions,
  toggling,
  attributionReady,
  onToggle,
  clientName,
  onCreateInvite,
  schedule,
  clientId,
  isDone,
  isCurrent,
  mark,
  marking,
  markReady,
  onMarkComplete,
}: {
  step: CjStep
  // Real per-task completion state from construction_step_completions, keyed by
  // cjTaskKey. Values use the same 3-field shape as ActionCompletion so the existing
  // completionLabel() helper is reused verbatim rather than re-implemented here.
  completions: Map<string, ActionCompletion>
  // Keys with a write in flight — those checkboxes are busy, not disabled-for-identity.
  toggling: Set<string>
  // False while the completions fetch OR the page's self-lookup is still settling.
  // Checkboxes stay disabled until then so a click can't persist a null attribution
  // that a moment's wait would have supplied.
  attributionReady: boolean
  onToggle: (stepNumber: number, role: string, taskText: string, next: boolean) => void
  // The real client's display name, threaded down the same path as clientId. Needed
  // here because the CSTEP title format belongs with the step data; navigation stays
  // in ClientDetailPage, which is what onCreateInvite below is for.
  clientName: string
  // Hands a finished invite title back up to the page, which owns the router. Same
  // callback-passed-down shape the pre-con WorkflowStep uses for onCreateInvite.
  // The step number rides along so the return URL can carry createdStep.
  onCreateInvite: (inviteTitle: string, stepNumber: number) => void
  // This step's scheduled meeting, or null when none exists. Drives both the header
  // badge and whether the button reads "Schedule meeting" or "Reschedule".
  schedule: CjSchedule | null
  // Threaded down from ConstructionJourneyPanel's own prop (the route's params.id) so
  // the per-step upload panel scopes to the same real client every other tab uses. Not
  // re-fetched and not defaulted: a blank value makes cjFolderPrefix() return null and
  // CjFilesFolder refuse to read or write, rather than fall back to a shared prefix.
  clientId: string
  // ── Step-level completion (construction_step_marks) ────────────────────────
  // All four arrive as props rather than being derived from `step.status`, which is
  // now dead for this purpose (see the note on CjStep.status). The panel owns the
  // marks Map because the progress bar and "current step" both need the whole set,
  // and a row cannot compute "am I the lowest incomplete step" on its own.
  isDone: boolean
  isCurrent: boolean
  // This step's mark row, or null when unmarked. Shaped as ActionCompletion (with a
  // synthetic `completed: true` — the table has no such column, row existence IS
  // completion) purely so completionLabel() is reused verbatim, exactly as the
  // per-task checkboxes above already do.
  mark: ActionCompletion | null
  // A mark/un-mark write is in flight for this step — busy, not disabled-for-identity.
  marking: boolean
  // False while the marks fetch or the page's self-lookup is still settling. Unlike
  // pre-con's Mark Complete (which has no gate at all and can therefore persist a
  // null completed_by), this button waits: construction_step_marks.completed_by is a
  // real FK to users.id and completed_by_name is denormalized at write time, so a
  // click before the lookup lands would save an unattributable row.
  markReady: boolean
  onMarkComplete: (stepNumber: number, completed: boolean) => void
}) {
  const [expanded, setExpanded] = useState(isCurrent)
  // `isCurrent` is now async-derived, and useState locks in its first value, so the
  // real current step would never auto-expand once the marks fetch resolves. Same
  // fix (and same "only react to changes, leave manual toggles alone" caveat) as the
  // pre-con WorkflowStep's defaultExpanded sync.
  const prevIsCurrent = useRef(isCurrent)
  useEffect(() => {
    if (isCurrent !== prevIsCurrent.current) {
      prevIsCurrent.current = isCurrent
      setExpanded(isCurrent)
    }
  }, [isCurrent])
  const cfg = CJ_STEP_TYPE_CONFIG[step.type]
  // Who marked this step complete, and when, in ET. Null while unmarked, so the line
  // is skipped entirely rather than rendering an empty row.
  const markCredit = completionLabel(mark ?? undefined)
  const showAgenda = step.type === 'customer'
  const showRecap = step.type === 'customer' || step.type === 'internal'

  // Attach-files gate. Inherited verbatim from the removed Schedule-meeting button so
  // the affordance lands on exactly the same 10 steps: INCLUSION-based on purpose, and
  // deliberately NOT the real component's `step.type !== 'window'` — this journey has
  // four step types where pre-con has three, so an exclusion would wrongly also match
  // 'email'. An email step is a recap sent after the fact and a 'window' is a date
  // range, so neither is a place a photo or a marked-up sheet belongs. 10 of the 19
  // steps qualify (7 customer + 3 internal); the other 9 do not (7 email + 2 window).
  const showAttach = step.type === 'customer' || step.type === 'internal'

  // Reuses the page's existing ET formatter — no second date function. Null when there
  // is no schedule, or when the stored timestamp won't parse, in which case the badge
  // is skipped entirely rather than rendering an empty pill.
  const scheduleLabel = schedule ? formatCompletedAt(schedule.at) : null

  // Upload-panel disclosure. Deliberately its OWN state, not folded into `expanded`:
  // opening files must not expand the checklist and expanding the checklist must not
  // open files, so the two never move together. Mounted only while open, so the
  // folder's listing re-fetches on each open — correct, since another operator may
  // have uploaded to this step in the meantime.
  const [attachOpen, setAttachOpen] = useState(false)

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        borderLeft: isCurrent ? '3px solid #ef4444' : `3px solid ${cfg.bar}`,
        background: 'var(--surface)',
      }}
    >
      {/* Header row — click anywhere to expand/collapse. role="button" rather than a
          real <button> because the action buttons in the body would otherwise nest. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(v => !v)
          }
        }}
        className="w-full text-left"
        style={{ display: 'flex', alignItems: 'stretch', gap: 11, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {/* CjStep number gutter */}
        <span
          className="shrink-0"
          style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}
        >
          {String(step.n).padStart(2, '0')}
        </span>

        {/* Title + who */}
        <span className="flex-1" style={{ padding: '10px 0', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{step.title}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{step.who}</span>
        </span>

        {/* Type badge */}
        <span className="shrink-0 self-center" style={{ ...cjBadgeBase, color: cfg.badgeText, background: cfg.badgeBg }}>
          {cfg.label}
        </span>

        {/* Status badge. isDone / isCurrent are now real per-client state from
            construction_step_marks (see the props above), not step.status.
            DELIBERATE DIVERGENCE FROM PRE-CON — the third "Pending" branch is kept.
            The real WorkflowStep renders nothing for a step that is neither done nor
            current, which works there because that list is always shown whole. This
            list has a step-type FILTER (All / Customer / Internal / Email / Window):
            filter to 'email' and the current step is usually not among the rows, so
            every visible row would carry no status badge at all and read as broken
            rather than as not-yet-started. Dropping Pending here means matching
            pre-con's markup at the cost of the clarity the filter makes necessary. */}
        {isDone ? (
          <span className="shrink-0 self-center" style={{ ...cjBadgeBase, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--pill-green-border)' }}>
            Done
          </span>
        ) : isCurrent ? (
          <span className="shrink-0 self-center" style={{ ...cjBadgeBase, color: 'var(--fable-red)' }}>
            Current
          </span>
        ) : (
          <span className="shrink-0 self-center" style={{ ...cjBadgeBase, color: 'var(--text3)', border: '1px solid var(--border)' }}>
            Pending
          </span>
        )}

        {/* Scheduled-meeting badge — rendered only when a construction_step_schedules
            row exists for this step. Date/time comes from the page's existing
            formatCompletedAt, so it reads identically to every other timestamp here.
            cjBadgeBase is reused for shape, but its uppercase/letter-spacing is undone:
            a date set in caps with tracking reads badly. */}
        {scheduleLabel && (
          <span
            className="shrink-0 self-center"
            style={{
              ...cjBadgeBase,
              textTransform: 'none',
              letterSpacing: 0,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(29,158,117,0.1)',
              border: '1px solid rgba(29,158,117,0.35)',
              color: '#5dcaa5',
            }}
            title={schedule?.title ?? undefined}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: '#5dcaa5' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {scheduleLabel}
          </span>
        )}

        {/* Schedule meeting — real. Lands on exactly the same 10 steps as Attach
            files by reusing that same `showAttach` boolean rather than restating the
            condition, so the two can never drift apart. Builds the CSTEP-prefixed
            title and hands it up to the page, which pushes My Calendar with the invite
            prefilled and locked — the identical mechanism the pre-con button already
            proves, so the calendar page needs no changes. stopPropagation keeps the
            click from also toggling the header's expand/collapse. */}
        {showAttach && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onCreateInvite(cjInviteTitle(step.n, step.title, clientName), step.n) }}
            title={
              schedule
                ? `Reschedule CSTEP${String(step.n).padStart(2, '0')} ${step.title} — currently ${scheduleLabel}`
                : `Create a Teams invite for CSTEP${String(step.n).padStart(2, '0')} ${step.title}`
            }
            className="shrink-0 self-center"
            style={{
              // cjActionBtn plus the real WorkflowStep button's exact overrides, so
              // this sits at badge weight next to the type badge.
              ...cjActionBtn,
              background: 'transparent',
              border: '0.5px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 9.5,
              padding: '2px 7px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
          >
            {/* Stroke set via style rather than the stroke attribute — presentation
                attributes don't resolve var(); same approach as the checkbox tick. */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--green)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            {/* Same button, handler and gate either way — only the label changes once a
                schedule exists. Re-clicking overwrites the row via the upsert. */}
            {schedule ? 'Reschedule' : 'Schedule meeting'}
          </button>
        )}

        {/* Attach files — 'customer' and 'internal' steps only, in the exact header
            slot the removed mock Schedule-meeting button occupied (between the status
            badge and the chevron) with the same ghost/outline treatment at badge
            weight. Unlike its predecessor this one is real: it toggles the inline
            upload panel below, which reads and writes this client's storage prefix.
            stopPropagation keeps the click from also toggling expand/collapse — the
            two disclosures are independent by design. */}
        {showAttach && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setAttachOpen(v => !v) }}
            aria-expanded={attachOpen}
            aria-label={`${attachOpen ? 'Hide' : 'Show'} files for step ${step.n}`}
            title="Upload and view files for this step"
            className="shrink-0 self-center"
            style={{
              ...cjActionBtn,
              background: attachOpen ? 'var(--surface2)' : 'transparent',
              border: '0.5px solid var(--border)',
              color: attachOpen ? 'var(--text)' : 'var(--text2)',
              fontSize: 9.5,
              padding: '2px 7px',
            }}
          >
            📎 Attach files
          </button>
        )}

        {/* Chevron */}
        <span className="shrink-0 self-center" style={{ color: 'var(--text3)', fontSize: 11, paddingRight: 12, transition: 'transform 200ms ease', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </div>

      {/* Per-step files — its own disclosure, rendered between the header row and
          the checklist body so it reads as attached to the step that opened it. Gated
          on `attachOpen` alone, never on `expanded`, which is what keeps the two
          independent. The card inside is the same CjFilesFolder the Reference Files
          sub-tab uses, handed a per-step folder def — no upload, listing, signing,
          thumbnail or delete logic is duplicated here. Left padding matches the
          expanded body so both align to the same gutter, and the wrapper stays
          background-free so the card sits on the row's own surface exactly as it does
          on the Reference Files tab. */}
      {showAttach && attachOpen && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '13px 15px 13px 43px' }}>
          <div style={{ maxWidth: 560 }}>
            <CjFilesFolder folder={cjStepFolderDef(step)} clientId={clientId} />
          </div>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', padding: '13px 15px 13px 43px' }}>
          {/* Objective */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 3 }}>
              Objective
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text2)' }}>{step.objective}</div>
          </div>

          {/* Who */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--text2)', border: '0.5px solid var(--border)', background: 'var(--surface)', borderRadius: 99, padding: '2px 8px' }}>
              👥 {step.who}
            </span>
          </div>

          {/* Role cards */}
          {step.roles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {step.roles.map(rb => (
                <div
                  key={rb.r}
                  style={{ flex: '1 1 240px', minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CJ_ROLE_COLORS[rb.r] ?? 'var(--text3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text2)' }}>
                      {CJ_ROLE_NAMES[rb.r] ?? rb.r}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {rb.tasks.map((task, ti) => {
                      // `ti` is the React list key only — never the identity of the
                      // completion row, which is the task text itself.
                      const key = cjTaskKey(step.n, rb.r, task)
                      const row = completions.get(key)
                      const on = row?.completed ?? false
                      // The same completionLabel() the three Journey-tab sites use —
                      // reused as-is, not redefined. ActionCompletion is structurally
                      // what `row` already is, so no adapter is needed.
                      const credit = completionLabel(row)
                      const busy = toggling.has(key)
                      const disabled = busy || !attributionReady
                      return (
                        <button
                          key={ti}
                          type="button"
                          onClick={() => { if (!disabled) onToggle(step.n, rb.r, task, !on) }}
                          disabled={disabled}
                          title={!attributionReady ? 'Loading task progress…' : undefined}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: disabled ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}
                        >
                          <span
                            className="shrink-0"
                            style={{ width: 14, height: 14, borderRadius: 3, border: on ? '1.5px solid var(--checkbox-checked-bg, var(--charcoal))' : '1.5px solid var(--border2)', background: on ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'background 120ms ease, border-color 120ms ease' }}
                          >
                            {on && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          {/* Site A layout (WorkflowStep): task text with the credit
                              line stacked beneath it in a column/gap-2 wrapper. */}
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--text)', opacity: on ? 0.5 : 1, textDecoration: on ? 'line-through' : 'none' }}>
                              {task}
                            </span>
                            {/* Who checked it + when, in ET. Hidden entirely when
                                unchecked (completionLabel returns null unless
                                completed), and degrades to timestamp-only when the
                                name is missing. */}
                            {credit && (
                              <span style={{ fontSize: 10, color: 'var(--green)' }}>{credit}</span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action row — visual only. Every button here is deliberately inert. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {showAgenda && (
              <button type="button" title="Preview only — this button does nothing" style={cjActionBtn}>📋 View Agenda</button>
            )}
            {showRecap && (
              <button type="button" title="Preview only — this button does nothing" style={{ ...cjActionBtn, color: 'var(--text3)', opacity: 0.5 }}>🎙️ View Recap</button>
            )}
            {step.type === 'email' && (
              <button type="button" title="Preview only — this button does nothing" style={{ ...cjActionBtn, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--badge-open-border)', fontWeight: 600 }}>✉️ Generate Recap Email</button>
            )}
            {/* Mark Complete — REAL. Writes construction_step_marks via the panel's
                markCjStep handler. Disabled while a write is in flight or while
                attribution is still resolving; see the markReady prop note. */}
            <button
              type="button"
              onClick={() => { if (!marking && markReady) onMarkComplete(step.n, !isDone) }}
              disabled={marking || !markReady}
              title={!markReady ? 'Loading step progress…' : undefined}
              style={{
                ...cjActionBtn,
                color: isDone ? '#166534' : 'var(--btn-primary-text, #fff)',
                background: isDone ? 'var(--green-bg)' : 'var(--btn-primary-bg, var(--charcoal))',
                border: isDone ? '1px solid var(--pill-green-border)' : '1px solid var(--btn-primary-bg, var(--charcoal))',
                fontWeight: 600,
                cursor: marking ? 'wait' : !markReady ? 'not-allowed' : 'pointer',
                opacity: marking || !markReady ? 0.5 : 1,
              }}
            >
              {marking ? '…' : isDone ? '✓ Completed' : 'Mark Complete'}
            </button>
          </div>

          {/* Who marked the step complete + when, in ET. Same completionLabel() output
              and same green treatment as the per-task credit lines above, so step-level
              and task-level attribution read identically. Sits under the action row
              rather than inside it so it never competes for space with the buttons. */}
          {markCredit && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--green)' }}>{markCredit}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Lock icon ────────────────────────────────────────────────────────────────

// Inline padlock so the locked tab needs no icon dependency (this page
// deliberately avoids the CDN icon sets the Big Vision pages pull in).
function CjLockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: -1 }}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

// ── Sub-tab button (secondary to the row above — pill, not underline) ────────

// Deliberately a different treatment from TabBtn: smaller type on a recessed
// pill track, so the two levels read as page-section vs. view-within-section.
function CjSubTabBtn({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      style={{
        padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11.5, fontWeight: active ? 700 : 600,
        color: active ? 'var(--text)' : 'var(--text3)',
        background: active ? 'var(--surface)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 150ms ease, color 150ms ease',
      }}
    >
      {label}
    </button>
  )
}

// ── Reference Files — real Supabase Storage folders ──────────────────────────
//
// This is the FIRST functional feature inside the Construction Journey panel.
// Everything else in this panel (the Steps sub-tab, the mock Schedule-meeting
// modal, the demo lock switch) stays exactly as inert as before. Nothing here
// shares state or handlers with any of it — each folder below owns its own
// state, so leaving the Reference Files sub-tab simply unmounts it.
//
// SECURITY — read this before changing anything here:
// There is NO UI gate in front of these files. The Construction Journey tab and
// panel render for any authenticated user; the old `canSeeCjPreview(userEmail)`
// tab gate has been removed, and that allowlist now decides one thing only —
// whether the Admin override switch renders. So RLS on the `construction-files`
// bucket is not a backstop behind a UI check, it is the ONLY boundary.
//
// That policy now allows SELECT/INSERT/UPDATE/DELETE to `current_user_role() IS
// NOT NULL` — any authenticated user — widened from the original
// 'president','ea','ai_specialist' list. Every call below runs through the
// cookie-backed browser client, so it is the signed-in user's own session that
// decides the outcome.
//
// Consequence to know before extending this: any Hub user can read, upload and
// delete any client's reference files. If that needs narrowing, narrow the bucket
// policy — do not add a UI gate and call it security.
//
// PATHING — scoped per client, but still under a preview umbrella:
//
// Objects live at `construction-preview/<clientId>/<folder>/<key>`, where
// clientId is the route's real `params.id` — the same clients.id every other tab
// on this page uses as `client_id`, and the same identifier the client-files
// upload path already keys on. So these files are correctly isolated per client:
// uploading on one client's page no longer surfaces on every other client's page.
//
// The `construction-preview/` root is deliberate and is NOT the same claim as
// "wired to production construction data". The Construction Journey panel around
// these folders is still structurally a preview — its 19 steps are hardcoded
// CJ_STEPS, not per-client records — so these uploads are real, correctly scoped
// files hanging off a panel whose surrounding data is not yet client-driven.
// Connecting the journey itself to real per-client construction records remains a
// future step; when it lands, this root is the thing to revisit, not the scoping.

const CJ_FILES_BUCKET = 'construction-files'

// Root prefix for every object this panel writes. See the PATHING note above for
// why this is `construction-preview` rather than something production-sounding.
const CJ_PREVIEW_ROOT = 'construction-preview'

// Mirrors the bucket's own configured ceiling. Checked client-side purely so the
// user gets an immediate, specific message instead of a failed request — the
// bucket limit remains the authority.
const CJ_MAX_UPLOAD_BYTES = 40 * 1024 * 1024

// Must stay a subset of the bucket's allowed_mime_types.
const CJ_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const CJ_ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const CJ_FILE_ACCEPT = [...CJ_ALLOWED_EXT, ...CJ_ALLOWED_MIME].join(',')

// Thumbnails are minted once per list; the open-in-new-tab link is minted fresh
// at click time and never stored, so a stale tile cannot hand out a live URL.
const CJ_THUMB_TTL_SECONDS = 3600
const CJ_OPEN_TTL_SECONDS = 60

interface CjFolderDef {
  // Also the trailing path segment for this folder inside a client's prefix.
  key: string
  icon: string
  title: string
  note: string
}

const CJ_FILE_FOLDERS: CjFolderDef[] = [
  {
    key: 'drawings',
    icon: '📐',
    title: 'Drawings',
    note: 'Permitted set plus the marked-up field set carried through every stage meeting.',
  },
  {
    key: 'selections',
    icon: '🎨',
    title: 'Selections',
    note: 'The selections packet referenced from the finishes and rough-in walkthroughs.',
  },
  // Was CJ_SCHEDULING_CARD, an inert placeholder card with a dead "Open folder"
  // button. Now a real folder on the same footing as the two above — icon, title and
  // note are its original copy, carried over verbatim. The open DOMO / BuilderTrend
  // question it was waiting on was never about whether this folder should exist; it is
  // about whether BT exports land here automatically. Until that is settled they are
  // uploaded by hand, which the bucket's existing PDF allowance already covers.
  {
    key: 'scheduling',
    icon: '📅',
    title: 'Scheduling',
    note: 'BT schedule exports and stage timelines the crew works off during construction.',
  },
]

// The per-client prefix for one folder. clientId is the route's params.id (a real
// clients.id UUID), so it needs no sanitising — but it is guarded anyway, because
// an empty value here would silently collapse every client back onto one shared
// prefix, which is exactly the cross-client leak this scoping exists to prevent.
function cjFolderPrefix(clientId: string, folderKey: string): string | null {
  const id = (clientId ?? '').trim()
  if (!id) return null
  return `${CJ_PREVIEW_ROOT}/${id}/${folderKey}`
}

// A CjFolderDef for one step's own attachments, consumed by the same CjFilesFolder
// the Reference Files sub-tab renders. `key` is a TWO-segment path fragment, which is
// the whole reason no refactor was needed: cjFolderPrefix() interpolates the key as
// given, so 'steps/7' yields `construction-preview/<clientId>/steps/7` and every
// object below it inherits the same per-client isolation Drawings and Selections
// already have. Nothing about the two existing folders changes — they keep passing
// their own single-segment keys ('drawings', 'selections') and resolve to byte-for-byte
// the same prefixes as before.
//
// The segment is String(step.n) — unpadded, so step 7 is `steps/7`, matching the
// `steps/<stepNumber>` shape this was specified as. The trade-off is that a storage
// browser sorts these lexicographically (1, 10, 11 … 19, 2, 3), which is cosmetic;
// zero-padding would sort better but would not match the spec, and changing it later
// orphans anything already uploaded, so it is called out rather than quietly chosen.
function cjStepFolderDef(step: CjStep): CjFolderDef {
  return {
    key: `steps/${step.n}`,
    icon: '📎',
    title: `Step ${String(step.n).padStart(2, '0')} files`,
    note: 'Photos, marked-up sheets and PDFs for this step only. Scoped to this client and this step — not shared with other steps.',
  }
}

// Count shown in the section head. Every folder is real now, so this is the array
// length with nothing added — the `+ 1` it used to carry was the inert Scheduling
// card, which is now the array's third entry. Kept as a named const so the head has a
// single thing to read and cannot drift from the array again.
const CJ_FOLDER_COUNT = CJ_FILE_FOLDERS.length

interface CjStoredFile {
  // Raw object name, including the `<epoch>_` prefix. This is the storage
  // identity — never render it; render displayName instead.
  name: string
  // The original filename as the user chose it, for display only.
  displayName: string
  path: string
  size: number
  isPdf: boolean
  // Signed URL used only to paint the tile (an <img> src, or the bytes pdf.js
  // renders). Null when signing failed for this row.
  thumbUrl: string | null
}

function cjFormatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 KB'
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function cjFileIsAllowed(file: File): boolean {
  const name = file.name.toLowerCase()
  const extOk = CJ_ALLOWED_EXT.some(e => name.endsWith(e))
  // file.type is empty for some OS/browser combinations, so the extension is
  // the fallback rather than the other way round.
  const mimeOk = file.type ? CJ_ALLOWED_MIME.includes(file.type) : true
  return extOk && mimeOk
}

// Object keys are ASCII-safe and collision-free. The timestamp prefix means two
// uploads of the same filename coexist instead of one silently winning, which is
// why upsert stays false on the upload call.
//
// Long names are trimmed on the BASE name only, keeping the extension attached.
// An earlier version sliced the tail of the whole string, which chopped the front
// of a long filename instead — the extension survived but the name it belonged to
// did not.
function cjStorageKey(prefix: string, fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_.]+/, '')
  const dot = safe.lastIndexOf('.')
  const ext = dot > 0 ? safe.slice(dot, dot + 12) : ''
  const base = (dot > 0 ? safe.slice(0, dot) : safe).slice(0, 100)
  return `${prefix}/${Date.now()}_${base || 'file'}${ext}`
}

// The `<epoch>_` prefix in a storage key is an implementation detail for collision
// avoidance — it should never be what the user reads. Stripping it is what turns
// a tile label from "1787726648077_baby-photo.jpg" (which the tile's ellipsis then
// cuts down to just the digits) into "baby-photo.jpg".
//
// Requires 10+ digits so a legitimately numeric filename like "2024_budget.pdf"
// is left alone; Date.now() is 13 digits and will be for centuries. Anything that
// does not match falls through unchanged, which also covers objects uploaded
// before this scheme existed.
function cjDisplayName(objectName: string): string {
  const m = objectName.match(/^\d{10,}_(.+)$/)
  return m ? m[1] : objectName
}

// First-page PDF thumbnail, rendered client-side to a canvas. Same pdf.js setup
// the dashboard's PDF text extraction already uses: dynamic import (pdf.js
// touches `document` at import time) plus the worker served from /public.
function CjPdfThumb({ url, label }: { url: string | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading')

  useEffect(() => {
    let cancelled = false
    if (!url) {
      setState('failed')
      return
    }
    setState('loading')
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        // Worker served as a static asset from /public (copied from pdfjs-dist/build).
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.arrayBuffer()
        if (cancelled) return
        const pdf = await pdfjs.getDocument({ data }).promise
        const page = await pdf.getPage(1)
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        // Fit the tile width, capped so a huge sheet does not allocate a giant canvas.
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(2, Math.max(0.2, 320 / base.width))
        const viewport = page.getViewport({ scale })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label={`First page of ${label}`}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: state === 'ok' ? 'block' : 'none',
        }}
      />
      {state !== 'ok' && (
        <span
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10.5, color: 'var(--text3)', textAlign: 'center', padding: 8,
          }}
        >
          {state === 'loading' ? 'Rendering…' : 'No preview'}
        </span>
      )}
    </>
  )
}

function CjUploadIcon() {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--text3)', opacity: 0.75 }}
    >
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

// One real folder: drop zone + live listing off Supabase Storage. Fully
// self-contained — all state is local to this component instance.
function CjFilesFolder({ folder, clientId }: { folder: CjFolderDef; clientId: string }) {
  const [files, setFiles] = useState<CjStoredFile[]>([])
  const [listing, setListing] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Null only if clientId is somehow blank. Every storage call below refuses to
  // run in that case rather than falling back to an unscoped prefix.
  const prefix = cjFolderPrefix(clientId, folder.key)

  const loadFiles = useCallback(async () => {
    if (!prefix) {
      setError('No client is in scope for this page, so files cannot be listed.')
      setFiles([])
      setListing(false)
      return
    }
    setListing(true)
    const supabase = createClient()
    const { data, error: listErr } = await supabase.storage
      .from(CJ_FILES_BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

    if (listErr) {
      // A denied read surfaces here rather than as an empty folder, so an RLS
      // problem never looks like "no files yet".
      setError(`Could not load files: ${listErr.message}`)
      setFiles([])
      setListing(false)
      return
    }

    // Rows without an id are folder entries; Supabase also parks a hidden
    // placeholder object in otherwise-empty prefixes.
    const rows = (data ?? []).filter(o => o.id && o.name !== '.emptyFolderPlaceholder')
    if (rows.length === 0) {
      setFiles([])
      setListing(false)
      return
    }

    const paths = rows.map(r => `${prefix}/${r.name}`)
    const { data: signed } = await supabase.storage
      .from(CJ_FILES_BUCKET)
      .createSignedUrls(paths, CJ_THUMB_TTL_SECONDS)

    setFiles(
      rows.map((r, i) => ({
        name: r.name,
        displayName: cjDisplayName(r.name),
        path: paths[i],
        size: (r.metadata as { size?: number } | null)?.size ?? 0,
        isPdf: r.name.toLowerCase().endsWith('.pdf'),
        thumbUrl: signed?.[i]?.signedUrl ?? null,
      })),
    )
    setListing(false)
  }, [prefix])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  async function handleFiles(picked: FileList | File[] | null) {
    const chosen = picked ? Array.from(picked) : []
    if (chosen.length === 0) return
    setError(null)

    if (!prefix) {
      setError('No client is in scope for this page, so files cannot be uploaded.')
      return
    }

    // Validate everything up front so a bad file in the middle of a multi-file
    // drop does not leave a half-finished upload behind.
    for (const f of chosen) {
      if (!cjFileIsAllowed(f)) {
        setError(`"${f.name}" is not an accepted file type. Use JPG, PNG, WEBP or PDF.`)
        return
      }
      if (f.size > CJ_MAX_UPLOAD_BYTES) {
        setError(`"${f.name}" is ${cjFormatBytes(f.size)} — over the 40 MB limit.`)
        return
      }
    }

    setUploading(true)
    const supabase = createClient()
    for (const f of chosen) {
      const { error: upErr } = await supabase.storage
        .from(CJ_FILES_BUCKET)
        .upload(cjStorageKey(prefix, f.name), f, {
          cacheControl: '3600',
          upsert: false,
          contentType: f.type || undefined,
        })
      if (upErr) {
        setError(`Upload failed for "${f.name}": ${upErr.message}`)
        break
      }
    }
    setUploading(false)
    // Refresh regardless: earlier files in the batch may have landed before the
    // failure, and the listing is the source of truth for what actually exists.
    await loadFiles()
  }

  // Minted at click time and never stored, so the URL a tile can hand out is
  // always short-lived.
  async function openFile(file: CjStoredFile) {
    setError(null)
    const supabase = createClient()
    const { data, error: signErr } = await supabase.storage
      .from(CJ_FILES_BUCKET)
      .createSignedUrl(file.path, CJ_OPEN_TTL_SECONDS)
    if (signErr || !data?.signedUrl) {
      setError(`Could not open "${file.displayName}": ${signErr?.message ?? 'no signed URL returned'}`)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteFile(file: CjStoredFile) {
    if (!window.confirm(`Delete "${file.displayName}" from ${folder.title}?\n\nThis removes it from storage and cannot be undone.`)) {
      return
    }
    setError(null)
    setDeleting(file.path)
    const supabase = createClient()
    const { error: delErr } = await supabase.storage.from(CJ_FILES_BUCKET).remove([file.path])
    if (delErr) setError(`Delete failed for "${file.displayName}": ${delErr.message}`)
    setDeleting(null)
    await loadFiles()
  }

  return (
    <div
      style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 15px',
      }}
    >
      <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 5 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
          <span style={{ fontSize: 15, marginRight: 6 }}>{folder.icon}</span>
          {folder.title}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {listing ? 'Loading…' : `${files.length} ${files.length === 1 ? 'file' : 'files'}`}
        </span>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text3)', marginBottom: 11 }}>{folder.note}</div>

      {/* Drop zone — also clickable, and keyboard-reachable as a real button. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer?.files ?? null)
        }}
        disabled={uploading}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 6, padding: '18px 12px', borderRadius: 9,
          border: `1.5px dashed ${dragOver ? 'var(--red)' : 'var(--border)'}`,
          background: dragOver ? 'var(--surface)' : 'transparent',
          cursor: uploading ? 'progress' : 'pointer', fontFamily: 'inherit',
          transition: 'border-color 120ms ease, background 120ms ease',
        }}
      >
        <CjUploadIcon />
        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text2)' }}>
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>JPG, PNG, WEBP or PDF · up to 40 MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={CJ_FILE_ACCEPT}
        style={{ display: 'none' }}
        onChange={e => {
          void handleFiles(e.target.files)
          // Clear so re-picking the same file still fires a change event.
          e.target.value = ''
        }}
      />

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10, padding: '8px 10px', borderRadius: 7, fontSize: 11, lineHeight: 1.45,
            color: 'var(--red)', background: 'var(--red-soft)', border: '1px solid var(--red-border)',
          }}
        >
          {error}
        </div>
      )}

      {/* Listing */}
      <div style={{ marginTop: 12 }}>
        {listing ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 0' }}>Loading files…</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 0' }}>
            {error ? 'Nothing to show.' : 'No files uploaded yet.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 9 }}>
            {files.map(f => (
              <div key={f.path} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => void openFile(f)}
                  title={`${f.displayName} · ${cjFormatBytes(f.size)}`}
                  style={{
                    display: 'block', width: '100%', padding: 0, borderRadius: 8, overflow: 'hidden',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      position: 'relative', display: 'block', width: '100%', aspectRatio: '1 / 1',
                      overflow: 'hidden', background: 'var(--surface2)',
                    }}
                  >
                    {f.isPdf ? (
                      <CjPdfThumb url={f.thumbUrl} label={f.displayName} />
                    ) : f.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed
                      // storage URL with a short TTL; next/image would need the host
                      // allowlisted and would proxy/cache a private object.
                      <img
                        src={f.thumbUrl}
                        alt={f.displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <span
                        style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 10.5, color: 'var(--text3)',
                        }}
                      >
                        No preview
                      </span>
                    )}
                    {f.isPdf && (
                      <span
                        style={{
                          position: 'absolute', left: 5, bottom: 5, fontSize: 8.5, fontWeight: 700,
                          letterSpacing: '0.05em', padding: '2px 5px', borderRadius: 4,
                          background: 'rgba(17,17,17,0.82)', color: '#fff',
                        }}
                      >
                        PDF
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      display: 'block', padding: '5px 6px', fontSize: 9.5, lineHeight: 1.3,
                      color: 'var(--text2)', textAlign: 'left', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {f.displayName}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteFile(f)}
                  disabled={deleting === f.path}
                  aria-label={`Delete ${f.displayName}`}
                  title={`Delete ${f.displayName}`}
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text3)', fontSize: 11, lineHeight: 1,
                    cursor: deleting === f.path ? 'progress' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {deleting === f.path ? '…' : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CjReferenceFilesPanel({ clientId }: { clientId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {CJ_FILE_FOLDERS.map(f => (
          <CjFilesFolder key={f.key} folder={f} clientId={clientId} />
        ))}
      </div>
    </div>
  )
}

// ── Construction Journey — sub-tabs ──────────────────────────────────────────

// Views inside the Construction Journey panel.
type CjView = 'steps' | 'files'

// ── Construction Journey — Admin override allowlist ──────────────────────────
//
// SCOPE, as of this change: this list gates the Admin override switch and NOTHING
// else. The tab button and the panel are no longer wrapped in it — they render for
// any authenticated user, exactly like the other four tabs, and RLS on the four
// construction tables plus the construction-files bucket is the only real boundary.
// Do not widen this back into a tab/panel gate; if the override should become a
// role check, replace this list rather than re-wrapping the tab in it.
//
// Where it IS still used, the absence guarantee still holds: the switch is a
// conditional render, so for a non-matching user it does not exist in the DOM at
// all — not hidden, not disabled, absent.
//
// Deliberately still an email allowlist, not a role check: this component has no
// role / current_user_role() fetch today and a preview gate does not justify adding
// one. Calin's address is written as a literal here because the repo's four
// `CALIN_EMAIL` constants all live in server API routes as module-local,
// non-exported consts — there is nothing importable for a client component to reuse.
// Entries must stay lower-case: the comparison below normalises only its input,
// not this list.
const CJ_PREVIEW_EMAILS = [
  'r.alimpoos@caskconstruction.com',
  'c.noonan@caskconstruction.com',
  'k.mapoy@caskconstruction.com',
] as const

// Trimmed + lower-cased rather than a bare ===, per CLAUDE.md's rule about
// comparing auth emails. Also returns false for the '' that `userEmail` holds
// before supabase.auth.getUser() resolves, which is what keeps the tab out of the
// first paint entirely — it appears only once a real matching email is confirmed,
// so there is no visible-then-hidden flash. Widening the list does not weaken that:
// '' equals no entry, so for all three operators the tab mounts only after a
// confirmed match, never before.
function canSeeCjPreview(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase()
  return CJ_PREVIEW_EMAILS.some(allowed => allowed === normalized)
}

// ── Construction Journey ─ step-type filter ───────────────────────────

type CjFilter = 'all' | CjStepType

// 'All' carries the live total; the other four are plain labels. The count is
// derived from CJ_STEPS.length rather than written as a literal 19, so it follows
// the data if the ported step list ever changes.
//
// NOTE: the 'window' pill reads "Work window" here, while the type badge on each
// step row reads "Work Window" (from CJ_STEP_TYPE_CONFIG, which is ported data and
// off-limits). One character of casing; left as specified rather than reconciled.
const CJ_FILTERS: { id: CjFilter; label: string }[] = [
  { id: 'all',      label: `All ${CJ_STEPS.length}` },
  { id: 'customer', label: 'Customer' },
  { id: 'email',    label: 'Email' },
  { id: 'internal', label: 'Internal' },
  { id: 'window',   label: 'Work window' },
]

// Ghost/outline pills. Shape (type size, padding, radius, gap, font family) is
// inherited by spreading cjActionBtn, so these sit in the same visual family as
// the inert action buttons inside each step row; only background, border, colour
// and weight vary by state. Inactive is fully transparent with a hairline border;
// active takes the same subtle --surface2 fill the panel already uses for its
// recessed surfaces (the sub-tab track, the demo-controls card).
//
// aria-pressed, not role="tab": these are toggle filters over one list, not tabs
// selecting between panels.
function CjFilterBtn({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      style={{
        ...cjActionBtn,
        background: active ? 'var(--surface2)' : 'transparent',
        border: `1px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
        color: active ? 'var(--text)' : 'var(--text3)',
        fontWeight: active ? 600 : 500,
        transition: 'background 150ms ease, color 150ms ease',
      }}
    >
      {label}
    </button>
  )
}

// ── Construction Journey panel (PREVIEW ONLY) ────────────────────────────────
//
// Ported from (app)/construction-journey-preview/page.tsx, which stays in the repo
// as the standalone version. Everything below is the same static content: the demo
// lock switch, the 19-step list and the Steps / Reference Files sub-tabs.
//
// Adapted for life inside an existing panel rather than a whole page: no TopBar, no
// scroll container, no breadcrumb, and no main tab row (this page's own tab row
// replaces it). One deliberate behavioural change is called out below.
//
// The Steps sub-tab is still ZERO data: no Supabase client, no fetch, no effect.
// Every step is hardcoded in CJ_STEPS and its only state is local, resetting when
// the tab is left.
//
// The Reference Files sub-tab is NOT: it makes real Supabase Storage calls against
// the construction-files bucket, scoped by clientId. (This comment used to claim
// the whole panel was data-free — that stopped being true when Reference Files
// became functional.) clientId is threaded through purely so those calls can be
// scoped per client; nothing in the Steps sub-tab reads it.
function ConstructionJourneyPanel({
  clientId,
  clientName,
  onCreateInvite,
  scheduleRefreshKey,
  selfUserIdRef,
  selfUserNameRef,
  selfUserReady,
  canSeeAdminOverride,
}: {
  clientId: string
  // Pass-through only — the panel itself never reads these; CjStepRow does. Threaded
  // the same way clientId already is, rather than re-fetched or re-derived.
  clientName: string
  onCreateInvite: (inviteTitle: string, stepNumber: number) => void
  // Incremented by the page after a post-invite schedule write lands, so the fetch
  // below re-runs and the new badge appears without reopening the tab.
  scheduleRefreshKey: number
  // Threaded from ClientDetailPage rather than re-resolved here. That lookup is the
  // page's single copy and its declaration comment explicitly warns against a third.
  // These hold a public.users id + display name — the namespace
  // construction_step_completions.completed_by has its foreign key against.
  selfUserIdRef: React.MutableRefObject<string | null>
  selfUserNameRef: React.MutableRefObject<string | null>
  selfUserReady: boolean
  // Whether to render the Admin override switch AT ALL. Computed at the call site
  // from CJ_PREVIEW_EMAILS — the last remaining use of that allowlist. False (so:
  // absent) until the caller's userEmail has resolved and matched, which is the same
  // no-flash property the tab gate used to rely on. This is a UI affordance gate, not
  // a security boundary: the override only changes what THIS component renders, and
  // every read/write below is decided by RLS under the signed-in user's own role.
  canSeeAdminOverride: boolean
}) {
  // Admin override. Off by default, so the real Precon-derived lock state is what a
  // viewer sees first.
  //
  // RENAMED from `preComplete` (the old demo switch). That name now actively lies:
  // whether Pre-Construction is complete is REAL data as of this change, held in
  // precoDone below, and having `preComplete` mean "ignore precoDone" one line away
  // from `precoDone` itself is the kind of pair that gets misread once and stays
  // misread. Nothing outside this panel referenced it.
  const [adminOverride, setAdminOverride] = useState(false)
  const [cjView, setCjView] = useState<CjView>('steps')
  // Real per-task completion state, keyed by cjTaskKey. Starts EMPTY and is filled by
  // the fetch below — the old cjSeedChecked() seed off CJ_STEPS' hardcoded `done`
  // arrays is gone, so what renders is what the database actually holds.
  const [completions, setCompletions] = useState<Map<string, ActionCompletion>>(new Map())
  const [cjLoading, setCjLoading] = useState(true)
  const [cjToggling, setCjToggling] = useState<Set<string>>(new Set())
  const [cjError, setCjError] = useState<string | null>(null)
  // Scheduled meetings, keyed by step_number. UNIQUE (client_id, step_number) on the
  // table guarantees at most one per step, which is what makes a Map the right shape.
  const [schedules, setSchedules] = useState<Map<number, CjSchedule>>(new Map())
  const [filter, setFilter] = useState<CjFilter>('all')
  // ── Step-level completion (construction_step_marks) ─────────────────────────
  // Keyed by step_number. Presence in the Map IS completion — the table has no
  // `completed` column, so marking inserts a row and un-marking deletes it, exactly
  // as pre-con's workflow_step_completions does. Values carry a synthetic
  // `completed: true` so completionLabel() can be reused with no adapter.
  //
  // A Map assumes at most one row per (client_id, step_number). A duplicate would be
  // harmless here (the later row simply wins the key), but it is a UNIQUE constraint
  // on the table — not this code — that prevents a double-click from creating one;
  // see the note in markCjStep below.
  const [marks, setMarks] = useState<Map<number, ActionCompletion>>(new Map())
  const [marksLoading, setMarksLoading] = useState(true)
  // Step numbers with a mark/un-mark write in flight.
  const [markToggling, setMarkToggling] = useState<Set<number>>(new Set())
  // ── Pre-Construction progress (workflow_step_completions) — READ-ONLY ───────
  // This client's completed PRE-CON step numbers, which is what actually gates this
  // journey. `null` means "not loaded yet" and is deliberately distinct from an empty
  // Set ("loaded, nothing done"): the gate must never unlock on absence of data, and
  // the locked card must not flash before the answer is known.
  //
  // Construction code NEVER writes to workflow_step_completions. This is the single
  // SELECT that exists here, and pre-con's own Journey tab is untouched by it.
  const [precoSteps, setPrecoSteps] = useState<Set<number> | null>(null)
  const [precoLoading, setPrecoLoading] = useState(true)

  // Deliberately its OWN effect, not folded into the completions fetch: a reschedule
  // bumps scheduleRefreshKey, and that must not force the larger completions read to
  // re-run. Same mount/tab-open timing as that fetch otherwise.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!clientId) return
      const supabase = createClient()
      const { data, error } = await supabase
        .from('construction_step_schedules')
        .select('step_number, scheduled_at, scheduled_title')
        .eq('client_id', clientId)
      if (cancelled) return
      if (error) {
        // Surfaced rather than swallowed, so a denied read never just looks like
        // "nothing scheduled yet". Shares the panel's one error slot.
        setCjError(`Could not load scheduled meetings: ${error.message}`)
        return
      }
      const rows = (data ?? []) as {
        step_number: number
        scheduled_at: string | null
        scheduled_title: string | null
      }[]
      const m = new Map<number, CjSchedule>()
      for (const r of rows) {
        if (!r.scheduled_at) continue
        m.set(r.step_number, { at: r.scheduled_at, title: r.scheduled_title })
      }
      setSchedules(m)
    })()
    return () => { cancelled = true }
  }, [clientId, scheduleRefreshKey])

  // Load this client's real per-task completions. Runs on panel mount, which is also
  // tab-open (the panel is conditionally rendered), so re-entering the tab re-reads —
  // correct, since another operator may have ticked a box in the meantime.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!clientId) {
        // Mirrors CjFilesFolder: refuse rather than fall back to an unscoped read.
        setCjError('No client is in scope for this page, so step progress cannot be loaded.')
        setCjLoading(false)
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from('construction_step_completions')
        .select('step_number, role, task_text, completed, completed_at, completed_by_name')
        .eq('client_id', clientId)
      if (cancelled) return
      if (error) {
        // A denied read surfaces here rather than as an all-unchecked journey, so an
        // RLS problem never looks like "nothing has been done yet".
        setCjError(`Could not load step progress: ${error.message}`)
        setCjLoading(false)
        return
      }
      const rows = (data ?? []) as {
        step_number: number
        role: string | null
        task_text: string | null
        completed: boolean | null
        completed_at: string | null
        completed_by_name: string | null
      }[]
      // Keyed by task TEXT, identical to the write path below and to what the
      // checkbox renderer looks up — one key format, three call sites.
      const m = new Map<string, ActionCompletion>()
      for (const r of rows) {
        m.set(cjTaskKey(r.step_number, r.role ?? '', r.task_text ?? ''), {
          completed: r.completed ?? false,
          completed_at: r.completed_at ?? null,
          // Model/legacy rows can hold a non-string here; normalise at the fetch
          // boundary so completionLabel() only ever sees string | null.
          completed_by_name: typeof r.completed_by_name === 'string' ? r.completed_by_name : null,
        })
      }
      setCompletions(m)
      setCjLoading(false)
    })()
    return () => { cancelled = true }
  }, [clientId])

  // Load this client's step-level marks. Its OWN effect rather than folded into the
  // completions read above, matching the schedules effect's shape: one failing read
  // must not cost the other its data, and the two answer different questions (which
  // TASKS are ticked vs. which STEPS are signed off). Same mount/tab-open timing.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!clientId) {
        setCjError('No client is in scope for this page, so step completion cannot be loaded.')
        setMarksLoading(false)
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from('construction_step_marks')
        .select('step_number, completed_at, completed_by_name')
        .eq('client_id', clientId)
      if (cancelled) return
      if (error) {
        // Surfaced, not swallowed — a denied read must not look like "no steps are
        // done yet". Shares the panel's one error slot, like the other two reads.
        setCjError(`Could not load step completion: ${error.message}`)
        setMarksLoading(false)
        return
      }
      const rows = (data ?? []) as {
        step_number: number
        completed_at: string | null
        completed_by_name: string | null
      }[]
      const m = new Map<number, ActionCompletion>()
      for (const r of rows) {
        m.set(r.step_number, {
          // Row existence is completion; there is no column to read.
          completed: true,
          completed_at: r.completed_at ?? null,
          // Normalised at the fetch boundary so completionLabel() only ever sees
          // string | null, per CLAUDE.md's rule on model/legacy JSON values.
          completed_by_name: typeof r.completed_by_name === 'string' ? r.completed_by_name : null,
        })
      }
      setMarks(m)
      setMarksLoading(false)
    })()
    return () => { cancelled = true }
  }, [clientId])

  // Load this client's PRE-CON step completions — the real unlock condition for this
  // journey. Its own effect, same mount/tab-open timing and same `cancelled` guard as
  // the other three reads.
  //
  // STRICTLY READ-ONLY, and deliberately the exact query pre-con's own Journey tab
  // uses (`select('step_number').eq('client_id', …)`), so the two can never disagree
  // about where a client is. The count is then handed to getJourneyState — the same
  // module-level helper the pre-con tab calls — rather than re-derived here, which is
  // what keeps "37" out of this code entirely and keeps the intersection-with-
  // WORKFLOW_STEPS semantics (a stray step_number cannot inflate the count).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!clientId) {
        setCjError('No client is in scope for this page, so Precon progress cannot be loaded.')
        setPrecoLoading(false)
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from('workflow_step_completions')
        .select('step_number')
        .eq('client_id', clientId)
      if (cancelled) return
      if (error) {
        // Surfaced rather than swallowed. Note the consequence is FAIL-CLOSED:
        // precoSteps stays null, so precoDone stays false and the journey stays
        // locked unless an admin overrides. A denied read must not hand out access.
        setCjError(`Could not load Precon progress: ${error.message}`)
        setPrecoLoading(false)
        return
      }
      const rows = (data ?? []) as { step_number: number }[]
      setPrecoSteps(new Set(rows.map(r => r.step_number)))
      setPrecoLoading(false)
    })()
    return () => { cancelled = true }
  }, [clientId])

  // ── Mark a construction step complete / incomplete (construction_step_marks) ──
  // Mirrors pre-con's markStepComplete deliberately: plain .insert() on mark, hard
  // .delete() on un-mark (no soft flag — the table has no `completed` column),
  // optimistic update first, full revert plus a surfaced error on failure, and NO
  // dependency whatsoever on construction_step_completions / journey_checklists task
  // state. The one intentional difference is the attribution pair, which pre-con's
  // looser table cannot store: completed_by is a real FK to users.id and
  // completed_by_name is denormalized at write time, both taken from the page's
  // single self-lookup (hence the markReady gate on the button).
  async function markCjStep(stepNumber: number, completed: boolean) {
    if (!clientId) {
      setCjError('No client is in scope for this page, so step completion cannot be saved.')
      return
    }
    setMarkToggling(prev => new Set(prev).add(stepNumber))
    setCjError(null)

    // Stamp exactly what is about to be written so the acting user's own name and
    // time paint immediately — the name is already in hand from the threaded
    // self-lookup, so nothing needs resolving. Same approach as toggleCjTask.
    const completedName = selfUserNameRef.current
    const completedAt = new Date().toISOString()
    const prevRow = marks.get(stepNumber)

    setMarks(prev => {
      const m = new Map(prev)
      if (completed) m.set(stepNumber, { completed: true, completed_at: completedAt, completed_by_name: completedName })
      else m.delete(stepNumber)
      return m
    })

    try {
      const supabase = createClient()
      if (completed) {
        // Plain insert, not an upsert — pre-con's pattern, and correct here because
        // un-marking removes the row outright, so there is never a dead row to
        // revive. A UNIQUE (client_id, step_number) on the table is what makes a
        // double-click safe: with it the second insert fails 23505 and lands in the
        // catch below (the step IS complete, so the revert is cosmetically wrong but
        // self-corrects on the next tab open); without it the race writes a harmless
        // duplicate. Worth confirming the constraint exists before relying on either.
        const { error } = await supabase
          .from('construction_step_marks')
          .insert({
            client_id:         clientId,
            step_number:       stepNumber,
            completed_by:      selfUserIdRef.current,
            completed_by_name: completedName,
            completed_at:      completedAt,
          })
        if (error) throw error
      } else {
        // Hard delete, per pre-con. `count` is checked because the sibling table
        // construction_step_completions has NO delete policy by design (see
        // toggleCjTask), so a refused delete on this table would return 204 with no
        // error and the un-mark would appear to work until the next reload. Counting
        // turns that silent desync into a visible message. DELIBERATE ADDITION over
        // pre-con's unchecked delete — drop the `count` option and this branch to
        // match it exactly.
        const { error, count } = await supabase
          .from('construction_step_marks')
          .delete({ count: 'exact' })
          .eq('client_id', clientId)
          .eq('step_number', stepNumber)
        if (error) throw error
        if (count === 0) {
          throw new Error('no row was removed — it may already have been un-marked by someone else')
        }
      }
    } catch (err) {
      console.error('[cj-step-mark] mark complete failed:', err)
      // Restore the whole prior record — completed_at AND completed_by_name — not
      // just presence, so a failed un-mark keeps its original attribution.
      setMarks(prev => {
        const m = new Map(prev)
        if (prevRow) m.set(stepNumber, prevRow)
        else m.delete(stepNumber)
        return m
      })
      setCjError(`Could not update step ${stepNumber}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setMarkToggling(prev => {
        const s = new Set(prev)
        s.delete(stepNumber)
        return s
      })
    }
  }

  // Persist one task's checkbox. Optimistic, with a full revert on failure.
  async function toggleCjTask(stepNumber: number, role: string, taskText: string, next: boolean) {
    const key = cjTaskKey(stepNumber, role, taskText)
    setCjToggling(prev => new Set(prev).add(key))
    setCjError(null)

    // Stamp exactly what we're about to write so the acting user's own name and time
    // paint immediately — the name is already in hand from the threaded self-lookup,
    // so nothing needs resolving. Unchecking nulls all three, matching the
    // journey_checklists pattern this mirrors.
    const completedName = next ? selfUserNameRef.current : null
    const completedAt   = next ? new Date().toISOString() : null
    const prevRow = completions.get(key)
    setCompletions(prev => new Map(prev).set(key, {
      completed: next,
      completed_at: completedAt,
      completed_by_name: completedName,
    }))

    try {
      const supabase = createClient()
      if (next) {
        // Insert-or-revive. The table's UNIQUE (client_id, step_number, role,
        // task_text) is what makes this idempotent — without it every re-check would
        // append a duplicate row. Stored verbatim, not normalized: see the note on
        // cjTaskKey, and journey_checklists' matching exact-match convention.
        const { error } = await supabase
          .from('construction_step_completions')
          .upsert(
            {
              client_id:         clientId,
              step_number:       stepNumber,
              role,
              task_text:         taskText,
              completed:         true,
              completed_by:      selfUserIdRef.current,
              completed_by_name: completedName,
              completed_at:      completedAt,
            },
            { onConflict: 'client_id,step_number,role,task_text' },
          )
        if (error) throw error
      } else {
        // Unchecking is an UPDATE, never a DELETE — there is no DELETE policy on this
        // table by design, so a delete would be silently refused under RLS.
        const { error } = await supabase
          .from('construction_step_completions')
          .update({ completed: false, completed_by: null, completed_by_name: null, completed_at: null })
          .eq('client_id', clientId)
          .eq('step_number', stepNumber)
          .eq('role', role)
          .eq('task_text', taskText)
        if (error) throw error
      }
    } catch (err) {
      console.error('[cj-step-completion] toggle failed:', err)
      // Restore the whole prior record — completed, completed_at AND
      // completed_by_name — not just the boolean.
      setCompletions(prev => {
        const m = new Map(prev)
        if (prevRow) m.set(key, prevRow)
        else m.delete(key)
        return m
      })
      setCjError(`Could not save that task: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCjToggling(prev => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  // ── Pre-Construction gate (real data + admin override) ──────────────────────
  // getJourneyState is pre-con's own helper, reused rather than re-implemented, so
  // these numbers are by construction the same ones the Precon Journey tab shows.
  // precoTotal comes from it too (TOTAL_WORKFLOW_STEPS = WORKFLOW_STEPS.length) —
  // nothing here hardcodes 37.
  const precoJourney = precoSteps ? getJourneyState(precoSteps) : null
  const precoCompletedCount = precoJourney?.completedCount ?? 0
  const precoTotal = precoJourney?.totalSteps ?? TOTAL_WORKFLOW_STEPS
  const precoPct = precoTotal > 0 ? Math.round((precoCompletedCount / precoTotal) * 100) : 0
  // Requires a loaded result: `precoJourney != null` keeps an unresolved or failed
  // read from ever reading as "complete".
  const precoDone = precoJourney != null && precoCompletedCount === precoTotal
  // The gate. Real completion unlocks it; an admin can open it early.
  const locked = !(precoDone || adminOverride)
  // Open ONLY because of the override — the case that needs the amber caveat. A
  // genuine unlock gets no banner.
  const overrideActive = adminOverride && !precoDone

  // ── Real 19-step progress (construction_step_marks) ─────────────────────────
  // Mirrors pre-con's getJourneyState exactly:
  //  · doneCount is the INTERSECTION with CJ_STEPS, never a raw row count, so a stray
  //    or retired step_number left in the table cannot inflate it past 19.
  //  · currentStepNumber is the LOWEST-numbered unmarked step — not "highest marked
  //    + 1". Marking step 10 while 5 is still open leaves Current on 5.
  //  · null once all 19 are marked, which is what makes the Current badge disappear
  //    instead of pinning to the last row.
  const doneCount = CJ_STEPS.filter(s => marks.has(s.n)).length
  const pct = Math.round((doneCount / CJ_STEPS.length) * 100)
  const cjCurrentStepNumber = CJ_STEPS.find(s => !marks.has(s.n))?.n ?? null

  // Presentational filter only: doneCount and pct above deliberately stay on the
  // full set, so the progress bar keeps meaning "progress through the whole
  // journey" instead of rebasing itself every time the filter changes.
  const visibleSteps = filter === 'all' ? CJ_STEPS : CJ_STEPS.filter(s => s.type === filter)

  return (
    <div className="flex flex-col gap-5">

      {/* Mixed-state notice. This panel is no longer "preview only" — four features
          in it now read and write real per-client data (reference files, per-task
          checkboxes, scheduled meetings and, as of this change, step completion), so
          leading with "nothing is saved" was actively misleading: an operator could
          click Mark Complete believing it was a demo. The amber treatment stays,
          because what remains static still needs calling out. Keep this text in sync
          with what is actually wired — it is the only thing telling operators which
          half of the panel is real.
          NOTE: the lock is no longer listed as demo-only, because it no longer is —
          it now derives from this client's real workflow_step_completions rows, and
          the switch beside it is an admin override rather than a simulation. The
          earlier wart (real controls sitting behind a purely fictional demo switch)
          is therefore gone. */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '9px 13px', borderRadius: 8,
          background: 'var(--amber-bg)', border: '1px solid var(--badge-open-border)',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1.3 }}>⚠️</span>
        <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text2)' }}>
          <b style={{ fontWeight: 700, color: 'var(--text)' }}>Partly live.</b>{' '}
          Step completion, per-task checkboxes, scheduled meetings and reference files
          are real: they save against this client and anyone else with access to this
          tab will see them, and the lock below reflects this client&apos;s real Precon
          progress. Still demo-only — the 19 steps themselves are a fixed template
          rather than per-client records, and View Agenda, View Recap and Generate
          Recap Email do nothing.
        </span>
      </div>

      {/* Real Pre-Construction progress for THIS client. Always rendered — it is the
          reason the journey below is locked or open, so seeing it must never require
          flipping anything. A read-only mirror of workflow_step_completions; the
          numbers come from getJourneyState, the same helper the Precon Journey tab
          calls, so the two surfaces cannot drift. */}
      <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            Precon progress for this client —{' '}
            {precoLoading
              ? <span style={{ color: 'var(--text3)' }}>checking…</span>
              : <><b style={{ fontWeight: 600, color: 'var(--text)' }}>{precoCompletedCount} of {precoTotal}</b> steps complete</>}
          </span>
          <span className="flex-1 overflow-hidden" style={{ height: 4, borderRadius: 99, background: 'var(--border2)', minWidth: 80 }}>
            <span style={{ display: 'block', height: '100%', width: precoLoading ? '0%' : `${precoPct}%`, background: 'var(--purple)', borderRadius: 99, transition: 'width 200ms ease' }} />
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>
            {precoLoading ? '—' : `${precoPct}%`}
          </span>
        </div>
      </div>

      {/* Admin override — opens the journey early. Gated on canSeeAdminOverride, which
          is the ONLY thing CJ_PREVIEW_EMAILS still decides anywhere in this file.
          A conditional render, NOT a `disabled` prop, on purpose: for a non-matching
          user this switch must be genuinely absent from the DOM, not greyed out.
          canSeeAdminOverride is also false while the caller's userEmail is still
          unresolved, so the switch is absent on first paint too and appears only once a
          real match is confirmed — same no-flash property the tab gate used to have.
          NOTE: affordance gate only. This is NOT what stops a non-admin writing
          construction data — RLS is. Flipping it changes nothing outside this render.
          Amber rather than green when on: an override is a caveat, not an achievement.
          On the standalone page this switch gated the Construction Journey TAB. Here
          the tab is this page's own ClientTabBtn, which must not grow a locked variant
          (it is shared by the four live tabs), so it gates the panel BODY instead. */}
      {canSeeAdminOverride && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 14, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 9,
            background: 'var(--surface2)', border: '1px dashed var(--border2)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 3 }}>
              Admin override
            </div>
            <label htmlFor="cj-admin-override" style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              Open the Construction Journey before Precon is complete
            </label>
          </div>

          {/* Switch */}
          <button
            id="cj-admin-override"
            type="button"
            role="switch"
            aria-checked={adminOverride}
            onClick={() => setAdminOverride(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, background: 'none',
              border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 34, height: 19, borderRadius: 99, padding: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                justifyContent: adminOverride ? 'flex-end' : 'flex-start',
                background: adminOverride ? 'var(--amber)' : 'var(--border2)',
                transition: 'background 150ms ease',
              }}
            >
              <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', display: 'block' }} />
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: adminOverride ? 'var(--amber)' : 'var(--text3)', minWidth: 30, textAlign: 'left' }}>
              {adminOverride ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      )}

      {/* Admin-override caveat. Shown ONLY when the journey is open because of the
          switch AND the client has not genuinely finished Precon. A real unlock needs
          no caveat, which is exactly what `overrideActive` encodes — do not relax it
          to plain `adminOverride`, or every finished client gets a false warning. */}
      {overrideActive && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 9,
            padding: '9px 13px', borderRadius: 8,
            background: 'var(--amber-bg)', border: '1px solid var(--badge-open-border)',
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1.3 }}>🔓</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text2)' }}>
            <b style={{ fontWeight: 700, color: 'var(--text)' }}>Admin override active.</b>{' '}
            This client is only {precoCompletedCount} of {precoTotal} Precon steps complete — you
            can see the Construction Journey because you&apos;re an admin, not because it is
            genuinely unlocked yet.
          </span>
        </div>
      )}

      {/* ── Locked state ── */}
      {/* `!precoLoading` matters: without it a client who HAS finished Precon would
          see the padlock card flash before the read resolves, and the card would
          briefly claim "0 of 37 done". */}
      {locked && !precoLoading && (
        <div
          className="rounded-[12px]"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '38px 24px', textAlign: 'center' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text3)', marginBottom: 12 }}>
            {/* Real numbers on the padlock itself, not a generic string. This card is
                the panel's lock affordance — the Construction Journey TAB button is a
                shared ClientTabBtn with no locked variant by design (see above), so
                there is no tab tooltip to put them on. */}
            <span
              title={`Unlocks once Pre-Construction is complete (${precoCompletedCount} of ${precoTotal} done)`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              <CjLockIcon />
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Construction Journey locked
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text3)', maxWidth: 460, margin: '0 auto' }}>
            Unlocks once Pre-Construction is complete{' '}
            (<b style={{ fontWeight: 600, color: 'var(--text2)' }}>{precoCompletedCount} of {precoTotal}</b> done).
            {/* Only shown to someone who actually has the switch. Gated on the SAME
                `canSeeAdminOverride` that renders the switch itself, so the card can
                never point at a control that is absent from the reader's DOM. For
                everyone else the message stops at the real numbers. The leading
                {' '} is explicit because JSX drops the newline-bearing whitespace
                before an expression container. */}
            {canSeeAdminOverride && (
              <>
                {' '}Flip <b style={{ fontWeight: 600, color: 'var(--text2)' }}>Admin override</b> above
                to open it anyway.
              </>
            )}
          </div>
        </div>
      )}

      {/* Precon read still in flight. Stands in for the locked card so the panel does
          not sit empty, and does not assert a lock state it cannot know yet. */}
      {locked && precoLoading && (
        <div
          className="rounded-[12px]"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '38px 24px', textAlign: 'center', fontSize: 11.5, color: 'var(--text3)' }}
        >
          Checking this client&apos;s Precon progress…
        </div>
      )}

      {/* ── Unlocked state ── */}
      {!locked && (
        <div className="flex flex-col gap-4">
          {/* Sub-tab row (views within Construction Journey). Deliberately a smaller,
              recessed pill treatment so it reads as secondary to this page's main
              underlined tab row above. */}
          <div>
            <div
              role="tablist"
              aria-label="Construction Journey views"
              style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              <CjSubTabBtn label="Steps" active={cjView === 'steps'} onSelect={() => setCjView('steps')} />
              <CjSubTabBtn label="Reference Files" active={cjView === 'files'} onSelect={() => setCjView('files')} />
            </div>
          </div>

          <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {/* Section head */}
            <div className="flex items-baseline justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>
                {cjView === 'steps' ? 'Construction Journey' : 'Reference Files'}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                {cjView === 'steps' ? `${doneCount} of ${CJ_STEPS.length} steps` : `${CJ_FOLDER_COUNT} folders`}
              </span>
            </div>

            {cjView === 'steps' ? (
              <>
                {/* Progress */}
                <div className="flex items-center" style={{ gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <b style={{ fontWeight: 600, color: 'var(--text)' }}>{doneCount} of {CJ_STEPS.length}</b> steps complete
                  </span>
                  <span className="flex-1 overflow-hidden" style={{ height: 4, borderRadius: 99, background: 'var(--surface2)' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 200ms ease' }} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                </div>

                {/* Filter by step type */}
                <div
                  role="group"
                  aria-label="Filter steps by type"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '11px 20px', borderBottom: '1px solid var(--border)' }}
                >
                  {CJ_FILTERS.map(f => (
                    <CjFilterBtn
                      key={f.id}
                      label={f.label}
                      active={filter === f.id}
                      onSelect={() => setFilter(f.id)}
                    />
                  ))}
                </div>

                {/* Step-progress read/write errors. Same inline treatment the
                    Reference Files card uses, so a failure reads the same way on
                    both sub-tabs. */}
                {cjError && (
                  <div
                    role="alert"
                    style={{
                      margin: '0 0 10px', padding: '8px 10px', borderRadius: 7, fontSize: 11, lineHeight: 1.45,
                      color: 'var(--red)', background: 'var(--red-soft)', border: '1px solid var(--red-border)',
                    }}
                  >
                    {cjError}
                  </div>
                )}

                {/* Steps */}
                <div>
                  {visibleSteps.length === 0 ? (
                    // Unreachable with the current data (all four types are
                    // populated), but the count is derived precisely because the
                    // data may change.
                    <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 11.5, color: 'var(--text3)' }}>
                      No steps of this type.
                    </div>
                  ) : (
                    visibleSteps.map(step => (
                      <CjStepRow
                        key={step.n}
                        step={step}
                        completions={completions}
                        toggling={cjToggling}
                        // Both gates in one flag: rows still loading, or the page's
                        // self-lookup not settled yet.
                        attributionReady={selfUserReady && !cjLoading}
                        onToggle={toggleCjTask}
                        clientName={clientName}
                        onCreateInvite={onCreateInvite}
                        schedule={schedules.get(step.n) ?? null}
                        clientId={clientId}
                        // Real step-level completion. isCurrent is computed once for
                        // the whole list above, so no row can disagree with another.
                        isDone={marks.has(step.n)}
                        isCurrent={step.n === cjCurrentStepNumber}
                        mark={marks.get(step.n) ?? null}
                        marking={markToggling.has(step.n)}
                        // Both gates in one flag, like attributionReady above: the
                        // marks read still in flight, or the self-lookup unsettled.
                        markReady={selfUserReady && !marksLoading}
                        onMarkComplete={markCjStep}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <CjReferenceFilesPanel clientId={clientId} />
            )}
          </div>
        </div>
      )}

    </div>
  )
}
