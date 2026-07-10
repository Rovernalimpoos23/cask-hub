// v4 — Fable redesign
'use client'
// src/app/(app)/dashboard/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar, PriorityDot } from '@/components/ui'
import { fetchAllMeetings } from '@/lib/meetings-client'
import { filterMeetingsForRole, isRestrictedRole } from '@/lib/role-filter'
import { createClient } from '@/lib/supabase'
import type { Meeting, ActionItem, Priority } from '@/types'
import { ArtifactContent } from '@/components/ai-panel/artifacts'
// NEW (additive) — shared 33-step Customer Journey data for the Active Clients section.
import { WORKFLOW_STEPS, TOTAL_WORKFLOW_STEPS, ROLE_NAMES, stepCode, checklistKey, computeTaskDueDate, getTaskDueState } from '@/lib/workflow-steps'

// Local display-only extension of ActionItem. `completed_at` persists into the
// meetings.action_items JSON (JSONB column — not a schema change); `meeting_title`
// /`meeting_date` are synthesized at fetch for the "From:" line and never written
// back. Kept local because src/types is out of scope for this change.
type ActionItemX = ActionItem & {
  completed_at?: string
  meeting_title?: string
  meeting_date?: string
}

function getCurrentMonthYear(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' })
}

interface TodayEvent {
  id: string
  title: string
  start_time: string
  end_time: string | null
  organizer: string | null
  attendees: unknown
  meeting_link: string | null
  web_link: string | null
  is_all_day: boolean | null
}

function fmtET(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ── Microsoft Graph "My Calendar" support (additive) ─────────────────
// Shape of the events returned by /api/calendar/my-events (Graph objects).
interface GraphEventLite {
  id: string
  subject: string
  start: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string } | null
  location?: { displayName?: string } | null
  onlineMeeting?: { joinUrl?: string } | null
  isAllDay?: boolean
}

// Graph calendarView returns UTC datetimes with up to 7 fractional-second digits
// and (with no Prefer header) no offset. Trim to ms and treat as UTC.
function parseGraphDate(dt: string): Date {
  const trimmed = dt.replace(/(\.\d{3})\d+/, '$1')
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(trimmed)
  return new Date(hasTz ? trimmed : `${trimmed}Z`)
}

function fmtGraphET(dt: string): string {
  return fmtET(parseGraphDate(dt).toISOString())
}

// Current ET week (Monday–Sunday) formatted like "Jul 6 – Jul 12". Matches the
// Mon–Sun window /api/calendar/my-events uses for weekEvents.
function currentWeekRangeET(): string {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const [y, m, d] = todayStr.split('-').map(Number)
  const etWeekday = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay() // 0=Sun … 6=Sat
  const daysFromMonday = (etWeekday + 6) % 7
  const mon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  mon.setUTCDate(mon.getUTCDate() - daysFromMonday)
  const sun = new Date(mon)
  sun.setUTCDate(sun.getUTCDate() + 6)
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  return `${fmt(mon)} – ${fmt(sun)}`
}

// ── Fable design tokens (additive — semantic colors only) ────────────
const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums lining-nums' }

// ── Sparkline (decorative trend hint) ────────────────────────────────
function Spark({ d, hot }: { d: string; hot?: boolean }) {
  return (
    <svg width="84" height="22" viewBox="0 0 84 22" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={hot ? 'var(--fable-red)' : 'var(--border2)'} strokeWidth="1.5" />
    </svg>
  )
}

// ── Stat cell — joined grid with hairline dividers ───────────────────
function StatBox({
  label,
  value,
  delta,
  deltaTone = 'flat',
  note,
  sparkPath,
  flag = false,
}: {
  label: string
  value: string | number
  delta: string
  deltaTone?: 'up' | 'flat' | 'bad'
  note: string
  sparkPath: string
  flag?: boolean
}) {
  const deltaColor =
    deltaTone === 'up' ? 'var(--fable-ok)' : deltaTone === 'bad' ? 'var(--fable-red)' : 'var(--text3)'
  return (
    <div style={{ background: 'var(--surface)', padding: '16px 18px 14px' }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 8, ...NUM }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 650,
            letterSpacing: '-0.5px',
            lineHeight: 1,
            color: flag ? 'var(--fable-red)' : 'var(--text)',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 550, color: deltaColor }}>{delta}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{note}</span>
        <Spark d={sparkPath} hot={flag} />
      </div>
    </div>
  )
}

// ── Floating CASK Intelligence — palette + chat config ───────────────
const AI_ACCENT = '#B5121B' // fable red (hex needed for alpha suffix tricks)

// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const AI_D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: AI_ACCENT,
}

const AI_GREETING =
  "CASK Intelligence online. I have context on your day — today's meetings, upcoming events, and open action items. Ask about your day, meetings, or actions."

const AI_QUICK_PROMPTS = ["What's on today?", 'My open actions', 'Next meeting']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
  fileName?: string // set on user turns that carried an uploaded document (display only)
}

// ── Document upload (client-side text extraction) ────────────────────
// Files are converted to plain text in the browser, then sent to the
// existing /api/chat route as the next message's context — no API change.
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
const UPLOAD_ACCEPT = '.pdf,.docx,.txt,.csv'

function readPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsText(file)
  })
}

async function readDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer })
  return value
}

async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // Worker served as a static asset from /public (copied from pdfjs-dist/build).
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  let text = ''
  for (let page = 1; page <= pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent()
    text += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n'
  }
  return text
}

// Dispatch on extension. Throws a user-facing message for unsupported types.
async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.csv')) return readPlainText(file)
  if (name.endsWith('.docx')) return readDocxText(file)
  if (name.endsWith('.pdf')) return readPdfText(file)
  throw new Error('Unsupported file type')
}

function PaperclipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

// ── Floating CASK Intelligence button + chat drawer ──────────────────

// Receives the logged-in user's role + first name from the page so the chat
// request can be role-scoped server-side (restricted users get only their own
// meetings/action items; admins are unaffected).
function FloatingDashboardAI({ userRole, userName }: { userRole: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  // Document upload state — added on top of the existing chat.
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [readingFile, setReadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onPickFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File too large (max 5MB)')
      return
    }
    setAttachedFile(file)
  }

  function removeAttachedFile() {
    setAttachedFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      userEmailRef.current = user.email
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', user.email)
        .eq('page_context', '/dashboard')
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setMessages(history as PanelMsg[])
      }
    }
    loadHistory()
  }, [])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: '/dashboard', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/dashboard')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  // Extract the document to text, then send it as context through /api/chat.
  async function sendWithFile(file: File, question: string) {
    if (thinking || readingFile) return
    setFileError('')
    setReadingFile(true)
    let fileText: string
    try {
      fileText = await extractFileText(file)
    } catch {
      setReadingFile(false)
      setFileError('Could not read this file. Try a different file.')
      return
    }
    setReadingFile(false)

    const displayText = question.trim() || `Please review "${file.name}".`
    // Shown in the chat + saved to history — kept clean (no giant text blob).
    const next: PanelMsg[] = [...messages, { role: 'user', content: displayText, fileName: file.name }]
    setMessages(next)
    saveMessage('user', displayText)
    setInput('')
    removeAttachedFile()
    setThinking(true)

    // What Claude actually receives: the document text prefixed onto this turn.
    const apiMessages = next.map((m, i) =>
      i === next.length - 1
        ? { role: m.role, content: `Document content:\n${fileText}\n\nUser question: ${displayText}` }
        : { role: m.role, content: m.content },
    )

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, pageContext: '/dashboard', userRole, userName }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  async function send(text?: string) {
    if (attachedFile) {
      sendWithFile(attachedFile, text ?? input)
      return
    }
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/dashboard',
          userRole,
          userName,
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <style>{`
        @keyframes dashboardSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes caskPulse {
          0% { box-shadow: 0 0 0 0 rgba(181,18,27,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(181,18,27,0); }
          100% { box-shadow: 0 0 0 0 rgba(181,18,27,0); }
        }
      `}</style>

      {/* Floating button — always visible on Dashboard */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '12px 19px 12px 15px',
          borderRadius: 999,
          background: 'var(--fable-red)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? '0 12px 30px -6px rgba(0,0,0,0.45)'
            : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--fable-red)',
            flexShrink: 0,
            animation: 'caskPulse 2.2s ease-out infinite',
          }}
        />
        CASK Intelligence
      </button>

      {/* Chat drawer — slides up from bottom-right */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 61,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            height: 500,
            maxHeight: 'calc(100vh - 48px)',
            background: AI_D.bg,
            color: AI_D.text,
            border: `1px solid ${AI_D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'dashboardSlideUp 220ms ease',
          }}
        >
          {/* Dark header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: 'var(--charcoal)',
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: AI_D.accent,
                  boxShadow: `0 0 8px ${AI_D.accent}`,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: '#fff',
                }}
              >
                CASK Intelligence
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={clearHistory}
              title="Clear chat history"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            </span>
          </div>

          {/* Feed */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? `1px solid ${AI_D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? AI_D.text3 : AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'CASK Intelligence'}
                </div>
                {m.fileName && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      maxWidth: '100%',
                      padding: '3px 8px',
                      marginBottom: 6,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: AI_D.text2,
                      background: AI_D.surface,
                      border: `1px solid ${AI_D.border}`,
                    }}
                  >
                    <span style={{ color: AI_D.text3, display: 'inline-flex', flexShrink: 0 }}>
                      <PaperclipIcon />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.fileName}
                    </span>
                  </span>
                )}
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? AI_D.text2 : AI_D.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <ArtifactContent content={m.content} />
                </div>
              </div>
            ))}

            {(thinking || readingFile) && (
              <div style={{ padding: '11px 0' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  CASK Intelligence
                </div>
                <div style={{ fontSize: 12.5, color: AI_D.text3, fontStyle: 'italic' }}>
                  {readingFile ? 'Reading document…' : 'Analyzing…'}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {AI_QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: AI_D.surface,
                    border: `1px solid ${AI_D.border}`,
                    color: AI_D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${AI_D.accent}66`
                    e.currentTarget.style.color = AI_D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = AI_D.border
                    e.currentTarget.style.color = AI_D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${AI_D.border}`, flexShrink: 0 }}>
            {/* Attached-file chip */}
            {attachedFile && (
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: '100%',
                    padding: '4px 8px',
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: 600,
                    color: AI_D.text2,
                    background: AI_D.surface,
                    border: `1px solid ${AI_D.border}`,
                  }}
                >
                  <span style={{ color: AI_D.text3, display: 'inline-flex', flexShrink: 0 }}>
                    <PaperclipIcon />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {attachedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={removeAttachedFile}
                    title="Remove file"
                    aria-label="Remove file"
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: AI_D.text3,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              </div>
            )}
            {fileError && (
              <div style={{ marginBottom: 8, fontSize: 11, color: '#b91c1c' }}>{fileError}</div>
            )}

            {/* Hidden file input — PDF, DOCX, TXT, CSV */}
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              style={{ display: 'none' }}
              onChange={e => {
                onPickFile(e.target.files?.[0])
                e.target.value = '' // allow re-selecting the same file
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${AI_D.border}`,
                background: AI_D.surface,
              }}
            >
              {/* Attach / paperclip */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={thinking || readingFile}
                title="Attach a document (PDF, DOCX, TXT, CSV)"
                aria-label="Attach a document"
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  color: attachedFile ? AI_D.accent : AI_D.text3,
                  border: 'none',
                  cursor: thinking || readingFile ? 'not-allowed' : 'pointer',
                  transition: 'color 150ms ease',
                }}
              >
                <PaperclipIcon />
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={attachedFile ? 'Ask a question about this document…' : 'Ask about your day, meetings, actions...'}
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: AI_D.text,
                  fontFamily: 'inherit',
                  maxHeight: 96,
                  overflowY: 'auto',
                  border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={(!input.trim() && !attachedFile) || thinking || readingFile}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: (input.trim() || attachedFile) && !thinking && !readingFile ? AI_D.accent : AI_D.surface,
                  color: (input.trim() || attachedFile) && !thinking && !readingFile ? '#fff' : AI_D.text3,
                  border: 'none',
                  cursor: (!input.trim() && !attachedFile) || thinking || readingFile ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms ease',
                }}
                title="Send"
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 1L11 6L6 11M11 6H1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Active Clients — Customer Journey (NEW, additive) ────────────────────────
// Read-only aggregation for the dashboard. Pulls every client plus their workflow
// step completions, per-step checklist state, and completed meeting recaps, then
// derives each client's current step and the to-dos for that step. No writes.

interface JourneyTaskDisplay {
  role: string
  task: string
  completed: boolean
}

// Action item shape parsed out of a client_meetings recap row.
interface JourneyMeetingActionItem {
  task?: string
  owner?: string
  due_date?: string | null
  done?: boolean
}

interface JourneyClient {
  id: string
  name: string
  project_type: string
  happiness: 'green' | 'yellow' | 'red'
  location: string
  currentStepNumber: number | null // lowest step NOT yet completed; null when all done
  currentStepTitle: string | null
  completedCount: number
  journeyTasks: JourneyTaskDisplay[]
  meetingActionItems: JourneyMeetingActionItem[]
  hasRecapForStep: boolean
}

// action_items on a client_meetings row may be a JSON string or an already-parsed
// array depending on the column type — parse defensively.
function parseJourneyActionItems(raw: unknown): JourneyMeetingActionItem[] {
  if (!raw) return []
  let value: unknown = raw
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return value.filter((x): x is JourneyMeetingActionItem => !!x && typeof x === 'object')
}

// Map a happiness status to a Fable indicator color.
function happinessColor(h: string): string {
  if (h === 'red') return 'var(--fable-red)'
  if (h === 'yellow') return 'var(--fable-warn)'
  return 'var(--fable-ok)'
}

export default function DashboardPage() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  // NEW (additive): the user's role from the users table, used to decide whether
  // they see every owner's action items or only their own.
  const [userRole, setUserRole] = useState('')
  // Gates the whole dashboard until the role resolves, so restricted users never
  // flash the full admin view first. False until the role fetch settles.
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [greeting, setGreeting] = useState('Good morning')
  const [calendarEvents, setCalendarEvents] = useState<TodayEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null)
  const [nextEventHint, setNextEventHint] = useState<string>('Loading…')
  // NEW (additive) — signed-in user's email, captured from the existing auth
  // effect below. Drives which users see the Make.com calendar feed vs. the
  // Outlook "connect" empty state (see showCalinCalendar in the render section).
  const [userEmail, setUserEmail] = useState('')
  // NEW (additive) — one-shot toast driven by the ?connected / ?error params the
  // Microsoft OAuth callback sets on its redirect back to /dashboard.
  const [oauthToast, setOauthToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [clockStr, setClockStr] = useState('')
  const [actionItems, setActionItems] = useState<ActionItemX[]>([])
  const [actionItemsLoading, setActionItemsLoading] = useState(true)
  const [bottomActionItems, setBottomActionItems] = useState<ActionItem[]>([])
  const [bottomLoading, setBottomLoading] = useState(true)
  const [syncMins, setSyncMins] = useState(0)
  const [expandedOwners, setExpandedOwners] = useState<Record<string, boolean>>({})
  const [yesterdayMeetings, setYesterdayMeetings] = useState<Meeting[]>([])
  // NEW (additive) — Active Clients — Customer Journey section
  const [clientsData, setClientsData] = useState<JourneyClient[]>([])
  const [clientsJourneyLoading, setClientsJourneyLoading] = useState(true)
  // NEW (additive) — Past Due Alerts: client_id → (step_number → started_at)
  const [stepStartByClient, setStepStartByClient] = useState<Map<string, Map<number, Date>>>(new Map())

  useEffect(() => {
    const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours()
    if (hour >= 5 && hour < 12) setGreeting('Good morning')
    else if (hour >= 12 && hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    function tick() {
      const now = new Date()
      const date = now.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
      const time = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
      setClockStr(`${date} · ${time} ET`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setSyncMins(m => m + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const loadMeetings = useCallback(() => {
    fetchAllMeetings().then(data => {
      setMeetings(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadMeetings()
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { setRoleLoaded(true); return }
      // Capture the session email — drives showCalinCalendar in the render below.
      setUserEmail(user.email)
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('name, role')
          .eq('email', user.email)
          .single()
        const name = userData?.name?.split(' ')[0] || ''
        setFirstName(name)
        setUserRole(userData?.role ?? '')
      } finally {
        // Mark loaded on success or failure so the page never stays blank.
        setRoleLoaded(true)
      }
    })
    const handler = () => { loadMeetings(); router.refresh() }
    window.addEventListener('cask-meeting-saved', handler)
    return () => window.removeEventListener('cask-meeting-saved', handler)
  }, [loadMeetings, router])

  // NEW (additive) — surface the OAuth callback result once, then strip the query
  // params (via replaceState, no navigation) so a refresh doesn't replay the toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'outlook') {
      setOauthToast({ kind: 'success', message: 'Outlook connected successfully!' })
    } else if (params.get('error') === 'oauth_state') {
      setOauthToast({ kind: 'error', message: 'Connection failed. Please try again.' })
    } else if (params.get('error') === 'user_not_found') {
      setOauthToast({ kind: 'error', message: 'User not found. Contact your admin.' })
    } else {
      return
    }
    window.history.replaceState({}, '', '/dashboard')
    const t = setTimeout(() => setOauthToast(null), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const now = new Date()
    const etTodayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // Compute the exact UTC bounds of today in Eastern Time.
    // ET is UTC-4 (EDT) or UTC-5 (EST). We detect the actual offset so DST is handled correctly.
    const etNowApprox = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const offsetMs = now.getTime() - etNowApprox.getTime() // positive = ET behind UTC

    const [y, mo, d] = etTodayStr.split('-').map(Number)
    const etDayStartUTC = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0)).getTime() + offsetMs
    const etDayEndUTC = etDayStartUTC + 24 * 60 * 60 * 1000

    // Today's Schedule: all events that START during ET today
    supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', new Date(etDayStartUTC).toISOString())
      .lt('start_time', new Date(etDayEndUTC).toISOString())
      .order('start_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[dashboard] calendar_events error:', error)
        setCalendarEvents((data ?? []) as TodayEvent[])
        setCalendarLoading(false)
      })

    // This-week stat card: count events from start of today through end of Sunday (ET)
    // etDayStartUTC is already computed above as the UTC ms for ET midnight today
    const etDayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay() // 0=Sun … 6=Sat
    const daysUntilSunday = etDayOfWeek === 0 ? 0 : 7 - etDayOfWeek
    const etWeekEndUTC = etDayStartUTC + (daysUntilSunday + 1) * 24 * 60 * 60 * 1000 // exclusive end = start of next Monday ET

    const fmtShort = (ms: number) => new Date(ms).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
    })
    const weekRange = `${fmtShort(etDayStartUTC)} – ${fmtShort(etWeekEndUTC - 1)}`
    setNextEventHint(weekRange)

    supabase
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .gte('start_time', new Date(etDayStartUTC).toISOString())
      .lt('start_time', new Date(etWeekEndUTC).toISOString())
      .then(({ count }) => {
        setUpcomingCount(count ?? 0)
      })

  }, [])

  // Yesterday's Meetings — query Supabase directly (no seed fallback) so we
  // only ever show meetings Fireflies actually captured and saved.
  useEffect(() => {
    const etTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const [yy, mm, dd] = etTodayStr.split('-').map(Number)
    const y = new Date(Date.UTC(yy, mm - 1, dd))
    y.setUTCDate(y.getUTCDate() - 1)
    const etYesterdayStr = y.toISOString().slice(0, 10)

    createClient()
      .from('meetings')
      .select('*')
      .eq('date', etYesterdayStr)
      .then(({ data, error }) => {
        if (error) {
          console.error('[dashboard] yesterday meetings error:', error)
          return
        }
        setYesterdayMeetings((data ?? []) as Meeting[])
      })
  }, [])

  // NEW (additive) — Active Clients — Customer Journey.
  // Fetches all clients plus the supporting tables needed to derive each client's
  // current step and to-dos. Purely read-only; does not touch any existing query.
  useEffect(() => {
    async function loadClientsJourney() {
      const supabase = createClient()
      const [
        { data: clients },
        { data: completions },
        { data: checklists },
        { data: meetingRows },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, project_type, happiness, location'),
        supabase.from('workflow_step_completions').select('client_id, step_number'),
        supabase.from('journey_checklists').select('client_id, meeting_code, role, task_text, completed'),
        // action_items holds each step's recap action items (see customers/[id]); we
        // match recaps to a step by meeting_id (e.g. "step_04").
        supabase.from('client_meetings').select('client_id, meeting_id, title, action_items').eq('completed', true),
      ])

      // Index supporting rows by client_id for O(1) lookups while building cards.
      const completionsByClient = new Map<string, Set<number>>()
      for (const c of (completions ?? []) as { client_id: string; step_number: number }[]) {
        const set = completionsByClient.get(c.client_id) ?? new Set<number>()
        set.add(c.step_number)
        completionsByClient.set(c.client_id, set)
      }

      const checklistByClient = new Map<string, Map<string, boolean>>()
      for (const r of (checklists ?? []) as { client_id: string; meeting_code: string; role: string; task_text: string; completed: boolean }[]) {
        const map = checklistByClient.get(r.client_id) ?? new Map<string, boolean>()
        map.set(checklistKey(r.meeting_code, r.role, r.task_text), r.completed)
        checklistByClient.set(r.client_id, map)
      }

      // client_id → (meeting_id → action_items)
      const meetingsByClient = new Map<string, Map<string, unknown>>()
      for (const m of (meetingRows ?? []) as { client_id: string; meeting_id: string; action_items: unknown }[]) {
        if (!m.meeting_id) continue
        const map = meetingsByClient.get(m.client_id) ?? new Map<string, unknown>()
        map.set(m.meeting_id, m.action_items)
        meetingsByClient.set(m.client_id, map)
      }

      const built: JourneyClient[] = ((clients ?? []) as {
        id: string; name: string; project_type: string | null; happiness: string | null; location: string | null
      }[]).map(c => {
        const completed = completionsByClient.get(c.id) ?? new Set<number>()
        const completedCount = WORKFLOW_STEPS.filter(s => completed.has(s.step)).length
        const step = WORKFLOW_STEPS.find(s => !completed.has(s.step)) ?? null

        // Journey tasks for the current step, flattened with their role + completion.
        const clientChecklist = checklistByClient.get(c.id)
        const journeyTasks: JourneyTaskDisplay[] = step
          ? step.roles.flatMap(rb =>
              rb.tasks.map(task => ({
                role: rb.role,
                task,
                completed: clientChecklist?.get(checklistKey(stepCode(step.step), rb.role, task)) ?? false,
              })),
            )
          : []

        // Meeting action items from this step's saved recap (if one exists).
        const recapRaw = step ? meetingsByClient.get(c.id)?.get(stepCode(step.step)) : undefined
        const hasRecapForStep = recapRaw !== undefined
        const meetingActionItems = parseJourneyActionItems(recapRaw)

        const happiness: 'green' | 'yellow' | 'red' =
          c.happiness === 'red' || c.happiness === 'yellow' ? c.happiness : 'green'

        return {
          id: c.id,
          name: c.name,
          project_type: c.project_type ?? '',
          happiness,
          location: c.location ?? '',
          currentStepNumber: step?.step ?? null,
          currentStepTitle: step?.title ?? null,
          completedCount,
          journeyTasks,
          meetingActionItems,
          hasRecapForStep,
        }
      })

      setClientsData(built)
      setClientsJourneyLoading(false)
    }
    loadClientsJourney().catch(err => {
      console.error('[dashboard] active clients journey error:', err)
      setClientsJourneyLoading(false)
    })
  }, [])

  // NEW (additive) — Past Due Alerts. Fetch when each step started for every client
  // so the dashboard can flag overdue current-step tasks. Read-only.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('journey_step_start')
      .select('client_id, step_number, started_at')
      .then(({ data, error }) => {
        if (error) {
          console.error('[dashboard] journey_step_start error:', error)
          return
        }
        const byClient = new Map<string, Map<number, Date>>()
        for (const r of (data ?? []) as { client_id: string; step_number: number; started_at: string }[]) {
          if (!r.started_at) continue
          const m = byClient.get(r.client_id) ?? new Map<number, Date>()
          m.set(r.step_number, new Date(r.started_at))
          byClient.set(r.client_id, m)
        }
        setStepStartByClient(byClient)
      })
  }, [])

  const loadAllActionItems = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('meetings')
      .select('title, date, action_items')
      .not('action_items', 'is', null)
      .neq('action_items', '[]')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        // Carry each item's source meeting title + date for the "From:" line so
        // same-titled meetings stay distinguishable. These are display-only and
        // never written back to the DB.
        const flattened = (data ?? []).flatMap(
          (m: { title: string; date: string; action_items: ActionItem[] | null }) =>
            (m.action_items ?? []).map(a => ({ ...a, meeting_title: m.title, meeting_date: m.date }))
        )
        setActionItems(flattened as ActionItemX[])
        setActionItemsLoading(false)
      })
  }, [])

  const loadBottomActionItems = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('action_items')
      .select('*')
      .eq('done', false)
      .in('owner', ['Calin', 'Kai', 'Rovern', 'Calin Noonan', 'Kai Mapoy', 'Rovern Alimpoos'])
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setBottomActionItems((data ?? []) as ActionItem[])
        setBottomLoading(false)
      })
  }, [])

  useEffect(() => {
    loadAllActionItems()
    loadBottomActionItems()
  }, [loadAllActionItems, loadBottomActionItems])

  async function handleBottomToggle(item: ActionItem, done: boolean) {
    const matches = (a: ActionItem) => a.task === item.task && a.owner === item.owner

    // Stamp the completion time when checking; clear it when unchecking.
    const completedAt = done ? new Date().toISOString() : undefined
    const applyDone = (a: ActionItemX): ActionItemX => {
      const next = { ...a, done }
      if (done) next.completed_at = completedAt
      else delete next.completed_at
      return next
    }

    // Optimistic UI — the item is filtered out of the open list once done.
    setActionItems(prev => prev.map(a => (matches(a) ? applyDone(a) : a)))

    const supabase = createClient()

    // 1. Find the meeting whose action_items JSON contains this item (matched by task + owner).
    const { data } = await supabase
      .from('meetings')
      .select('id, action_items')
      .not('action_items', 'is', null)
    const rows = (data ?? []) as { id: string; action_items: ActionItemX[] | null }[]
    const target = rows.find(m => (m.action_items ?? []).some(matches))
    if (!target) return

    // 2. Update that specific item's done + completed_at within the array.
    const updated = (target.action_items ?? []).map(a => (matches(a) ? applyDone(a) : a))

    // 3. Save the updated array back to the meetings.action_items column.
    await supabase.from('meetings').update({ action_items: updated }).eq('id', target.id)

    loadAllActionItems()
  }

  // Mirrors handleBottomToggle exactly, but writes the priority field instead of done.
  async function handlePriorityChange(item: ActionItem, priority: Priority) {
    const matches = (a: ActionItem) => a.task === item.task && a.owner === item.owner

    // Optimistic UI
    setActionItems(prev => prev.map(a => (matches(a) ? { ...a, priority } : a)))

    const supabase = createClient()

    // 1. Find the meeting whose action_items JSON contains this item (matched by task + owner).
    const { data } = await supabase
      .from('meetings')
      .select('id, action_items')
      .not('action_items', 'is', null)
    const rows = (data ?? []) as { id: string; action_items: ActionItem[] | null }[]
    const target = rows.find(m => (m.action_items ?? []).some(matches))
    if (!target) return

    // 2. Update that specific item's priority field within the array.
    const updated = (target.action_items ?? []).map(a => (matches(a) ? { ...a, priority } : a))

    // 3. Save the updated array back to the meetings.action_items column.
    await supabase.from('meetings').update({ action_items: updated }).eq('id', target.id)

    loadAllActionItems()
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  function isCoreOwner(owner: string) {
    const o = owner.toLowerCase().trim()
    return (
      o === 'calin' || o.startsWith('calin ') ||
      o === 'kai' || o.startsWith('kai ') ||
      o === 'rovern' || o.startsWith('rovern ')
    )
  }
  const coreActions = actionItems.filter(a => isCoreOwner(a.owner))
  const openActions = coreActions.filter(a => !a.done)
  const completedActions = coreActions.filter(a => a.done)

  // NEW (additive): restricted roles (vp_sales/Jeff, ops_manager/Matteo,
  // vp_ops/Chad, vp_finance/Lamont) only see meetings they attended — i.e. where
  // their first name is in the meeting's attendees array. Admin roles (president,
  // ea, ai_specialist) get the full list, unchanged. Drives Recent Sessions, the
  // Sessions stat count, and Yesterday's Meetings below.
  const visibleMeetings = filterMeetingsForRole(meetings, userRole, firstName)
  const visibleYesterdayMeetings = filterMeetingsForRole(yesterdayMeetings, userRole, firstName)

  const recentMeetings = visibleMeetings.slice(0, 3)

  // ── Derived display values (presentation only — no new fetching) ────
  const etTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  function isOverdue(a: ActionItem): boolean {
    return !!a.due_date && a.due_date < etTodayStr
  }
  function overdueDays(a: ActionItem): number {
    return Math.max(0, Math.floor((Date.parse(etTodayStr) - Date.parse(a.due_date)) / 86400000))
  }
  function fmtDue(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const overdueActions = openActions.filter(isOverdue)
  const oldestOverdue = overdueActions.reduce<ActionItem | null>(
    (oldest, a) => (!oldest || a.due_date < oldest.due_date ? a : oldest),
    null
  )
  const oldestDays = oldestOverdue ? overdueDays(oldestOverdue) : 0

  const thisMonthPrefix = etTodayStr.slice(0, 7)
  const sessionsThisMonth = visibleMeetings.filter(m => m.date?.startsWith(thisMonthPrefix)).length

  const completionRate = coreActions.length > 0
    ? Math.round((completedActions.length / coreActions.length) * 100)
    : 0

  const nowMs = Date.now()
  const nextEventToday = calendarEvents.find(
    ev => !ev.is_all_day && new Date(ev.start_time).getTime() > nowMs
  )
  const allEventsDone =
    calendarEvents.length > 0 &&
    calendarEvents.every(ev => ev.is_all_day || (ev.end_time ? new Date(ev.end_time).getTime() < nowMs : false))

  // Owner groups for the action items column — overdue-heavy owners first
  const ownerGroups = (() => {
    const map = new Map<string, ActionItemX[]>()
    for (const a of openActions) {
      const first = a.owner.trim().split(' ')[0]
      const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
      const list = map.get(name) ?? []
      list.push(a)
      map.set(name, list)
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items: [...items].sort((x, y) => {
          // Priority first (High → Medium → Low), then preserve the existing
          // overdue-first ordering and due_date ascending within each tier.
          const PRANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
          const xp = PRANK[x.priority ?? 'low']
          const yp = PRANK[y.priority ?? 'low']
          if (xp !== yp) return xp - yp
          const xo = isOverdue(x) ? 0 : 1
          const yo = isOverdue(y) ? 0 : 1
          if (xo !== yo) return xo - yo
          return (x.due_date || '9999').localeCompare(y.due_date || '9999')
        }),
        overdue: items.filter(isOverdue).length,
      }))
      .sort((a, b) => b.overdue - a.overdue || b.items.length - a.items.length)
  })()

  // ── NEW (additive): personal action-items view for non-leadership users ──────
  // Leadership roles (president, ea, ai_specialist) keep the existing full board.
  // Everyone else (vp_sales, ops_manager, vp_ops…) sees only their OWN open items,
  // with a "View all team items" toggle to reveal everyone.
  const currentFirst = firstName.trim()
  const canSeeAllItems = ['president', 'ea', 'ai_specialist'].includes(userRole.toLowerCase())

  // Open items across EVERY owner (not just the core board), grouped + sorted the
  // same way as ownerGroups, then with the current user's own group floated first.
  const allOpenActions = actionItems.filter(a => !a.done)
  const allOwnerGroups = (() => {
    const map = new Map<string, ActionItemX[]>()
    for (const a of allOpenActions) {
      const first = a.owner.trim().split(' ')[0]
      const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
      const list = map.get(name) ?? []
      list.push(a)
      map.set(name, list)
    }
    const groups = Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items: [...items].sort((x, y) => {
          const PRANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
          const xp = PRANK[x.priority ?? 'low']
          const yp = PRANK[y.priority ?? 'low']
          if (xp !== yp) return xp - yp
          const xo = isOverdue(x) ? 0 : 1
          const yo = isOverdue(y) ? 0 : 1
          if (xo !== yo) return xo - yo
          return (x.due_date || '9999').localeCompare(y.due_date || '9999')
        }),
        overdue: items.filter(isOverdue).length,
      }))
      .sort((a, b) => b.overdue - a.overdue || b.items.length - a.items.length)
    // Float the current user's own group to the very top (stable otherwise).
    return groups.sort((a, b) => {
      const am = a.name.toLowerCase() === currentFirst.toLowerCase() ? 0 : 1
      const bm = b.name.toLowerCase() === currentFirst.toLowerCase() ? 0 : 1
      return am - bm
    })
  })()
  const myGroup = currentFirst
    ? allOwnerGroups.find(g => g.name.toLowerCase() === currentFirst.toLowerCase()) ?? null
    : null
  const otherGroups = allOwnerGroups.filter(g => g !== myGroup)
  const myOverdueActions = (myGroup?.items ?? []).filter(isOverdue)

  // NEW (additive): restricted roles (vp_sales/Jeff, ops_manager/Matteo,
  // vp_ops/Chad, vp_finance/Lamont) get a personalized dashboard. Admin roles
  // (president, ea, ai_specialist) are unaffected by everything below.
  const isRestricted = isRestrictedRole(userRole)
  // NEW — only Calin (c.noonan) and Kai (k.mapoy) have the Make.com calendar feed
  // wired up; everyone else sees the Outlook "connect" empty state until Microsoft
  // Graph calendar data lands (later phase). Gated purely on the signed-in email.
  const showCalinCalendar =
    userEmail === 'c.noonan@caskconstruction.com' ||
    userEmail === 'k.mapoy@caskconstruction.com'

  // NEW (additive) — Microsoft Graph "My Calendar" for everyone who ISN'T on the
  // Make.com feed (i.e. not Calin/Kai). Fetches the signed-in user's own Outlook
  // calendar from /api/calendar/my-events. Leaves the Make.com path untouched.
  const [isOutlookConnected, setIsOutlookConnected] = useState(false)
  const [myTodayEvents, setMyTodayEvents] = useState<GraphEventLite[]>([])
  const [myWeekEvents, setMyWeekEvents] = useState<GraphEventLite[]>([])
  // Loading flag for the Graph fetch — drives the "Pulling today's schedule…"
  // line in the briefing for non-Calin/Kai users.
  const [myCalendarLoading, setMyCalendarLoading] = useState(true)

  useEffect(() => {
    // Wait until the role/email has resolved so we don't fire for Calin/Kai (whose
    // showCalinCalendar only flips true once their email loads).
    if (!roleLoaded || showCalinCalendar) return
    let cancelled = false
    fetch('/api/calendar/my-events')
      .then(r => r.json())
      .then((json: { todayEvents?: GraphEventLite[]; weekEvents?: GraphEventLite[]; error?: string }) => {
        if (cancelled) return
        if (Array.isArray(json.todayEvents)) {
          // Connected — even an empty array means a valid, connected calendar.
          setIsOutlookConnected(true)
          setMyTodayEvents(json.todayEvents)
          setMyWeekEvents(Array.isArray(json.weekEvents) ? json.weekEvents : [])
        } else if (json.error === 'not_connected' || json.error === 'token_invalid') {
          setIsOutlookConnected(false)
        }
        // Any other error: leave disconnected so the existing Connect Outlook
        // empty state shows.
        setMyCalendarLoading(false)
      })
      .catch(() => {
        // network error — leave disconnected
        if (!cancelled) setMyCalendarLoading(false)
      })
    return () => { cancelled = true }
  }, [roleLoaded, showCalinCalendar])

  // NEW (additive) — Graph equivalents for non-Calin/Kai users' briefing "Next up"
  // line. Per spec, "next" = the first event whose END time is still in the future
  // (an in-progress meeting counts as next up); all-day events are excluded from
  // the "next" pick and treated as done for the all-wrapped check. nowMs is
  // computed further below in render scope but is in scope by the time this reads.
  const myNextEvent = myTodayEvents.find(
    ev => !ev.isAllDay && ev.end?.dateTime != null && parseGraphDate(ev.end.dateTime).getTime() > Date.now()
  )
  const allMyEventsDone =
    myTodayEvents.length > 0 &&
    myTodayEvents.every(ev => ev.isAllDay || (ev.end?.dateTime ? parseGraphDate(ev.end.dateTime).getTime() < Date.now() : false))
  // Their own open count (open items assigned to them) for the briefing line.
  const myOpenCount = myGroup?.items.length ?? 0
  // CHANGE 4: Completed stat for restricted users — only THEIR action items
  // (owner contains their first name, case-insensitive), with a personal
  // completion rate (their completed / their total assigned).
  const myAllActionItems = currentFirst
    ? actionItems.filter(a => a.owner.toLowerCase().includes(currentFirst.toLowerCase()))
    : []
  const myCompletedCount = myAllActionItems.filter(a => a.done).length
  const myCompletionRate = myAllActionItems.length > 0
    ? Math.round((myCompletedCount / myAllActionItems.length) * 100)
    : 0
  // CHANGE: "Open action items" stat for restricted users — only THEIR open
  // items (owner contains first name, done === false). Derived from the same
  // includes-based match as /actions "My Items", so the count matches exactly.
  // Overdue count + oldest-overdue age are likewise restricted to their items.
  const myOpenItems = myAllActionItems.filter(a => !a.done)
  const myOpenOverdue = myOpenItems.filter(isOverdue)
  const myOpenOldestOverdue = myOpenOverdue.reduce<ActionItem | null>(
    (oldest, a) => (!oldest || a.due_date < oldest.due_date ? a : oldest),
    null,
  )
  const myOpenOldestDays = myOpenOldestOverdue ? overdueDays(myOpenOldestOverdue) : 0

  // Overdue banner source: leadership sees the whole core board; everyone else
  // sees only their own overdue count (so they never see "45 of them Calin's").
  const bannerOverdueActions = canSeeAllItems ? overdueActions : myOverdueActions
  const bannerOverdueCount = bannerOverdueActions.length
  const bannerOldestOverdue = canSeeAllItems
    ? oldestOverdue
    : bannerOverdueActions.reduce<ActionItem | null>(
        (o, a) => (!o || a.due_date < o.due_date ? a : o),
        null
      )

  const briefingLabel =
    greeting === 'Good morning' ? 'Morning Briefing'
    : greeting === 'Good afternoon' ? 'Afternoon Briefing'
    : 'Evening Briefing'

  const greetSub =
    greeting === 'Good evening'
      ? 'Here’s where CASK Construction stands tonight.'
      : `Here’s where CASK Construction stands — ${getCurrentMonthYear()}.`

  const syncText = syncMins === 0 ? 'Synced just now' : `Synced ${syncMins} min ago`

  // NEW (additive) — Past Due Alerts: overdue current-step journey tasks across all
  // active clients. Derived from clientsData + stepStartByClient; no fetching here.
  const journeyOverdueAlerts = clientsData.flatMap(client => {
    if (client.currentStepNumber == null) return []
    const step = WORKFLOW_STEPS.find(s => s.step === client.currentStepNumber)
    if (!step) return []
    const startedAt = stepStartByClient.get(client.id)?.get(client.currentStepNumber) ?? null
    return client.journeyTasks
      .filter(t => !t.completed)
      .filter(t => getTaskDueState(computeTaskDueDate(startedAt, step.timeWindow, t.task), false) === 'overdue')
      .map(t => ({
        clientId: client.id,
        clientName: client.name,
        stepNumber: step.step,
        task: t.task,
      }))
  })

  // ── NEW (additive): owner-group renderers ──────────────────────────────────
  // Extracted verbatim from the inline render so the same card can be reused for
  // both the leadership board and the personal-first view. Behavior unchanged.
  type OwnerGroup = { name: string; items: ActionItemX[]; overdue: number }

  function renderOwnerGroupCard(group: OwnerGroup) {
    const expanded = !!expandedOwners[group.name]
    const visible = expanded ? group.items : group.items.slice(0, 3)
    const hidden = group.items.length - visible.length
    return (
      <div
        key={group.name}
        className="fb-rise"
        style={{
          border: '1px solid var(--fable-line, var(--border))',
          borderRadius: 'var(--fable-radius)',
          background: 'var(--surface)',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        {/* Owner header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '10px 14px',
            background: 'var(--surface2)',
            borderBottom: '1px solid var(--fable-line-soft, var(--border))',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--surface2)',
              color: 'var(--text)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 9.5,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {group.name.charAt(0)}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{group.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)', ...NUM }}>
            {group.overdue > 0 && (
              <>
                <b style={{ color: 'var(--fable-red)', fontWeight: 650 }}>{group.overdue} overdue</b>
                {' · '}
              </>
            )}
            {group.items.length} open
          </span>
        </div>

        {/* Tasks */}
        {visible.map(item => {
          const over = isOverdue(item)
          return (
            <div
              key={item.id}
              className="fb-task"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 11,
                padding: '11px 14px',
                borderBottom: '1px solid var(--fable-line-soft, var(--border))',
                transition: 'background 150ms ease',
              }}
            >
              <button
                className="fb-cb"
                role="checkbox"
                aria-checked="false"
                title="Mark complete"
                onClick={() => handleBottomToggle(item, true)}
                style={{
                  width: 15,
                  height: 15,
                  border: '1.5px solid var(--border2)',
                  borderRadius: 4,
                  flexShrink: 0,
                  marginTop: 2,
                  cursor: 'pointer',
                  background: 'transparent',
                  padding: 0,
                  transition: 'border-color 150ms ease',
                }}
              />
              {/* Priority dot — inline before the task text */}
              <div style={{ marginTop: 3 }}>
                <PriorityDot priority={item.priority} onChange={p => handlePriorityChange(item, p)} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text)' }}>{item.task}</div>
                {item.meeting_title && (
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                    From: {item.meeting_title}
                    {item.meeting_date
                      ? ` · ${new Date(item.meeting_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : ''}
                  </div>
                )}
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 550,
                  paddingTop: 2,
                  whiteSpace: 'nowrap',
                  color: over ? 'var(--fable-red)' : 'var(--text3)',
                  ...NUM,
                }}
              >
                {item.due_date ? fmtDue(item.due_date) : 'No due date'}
                {over && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginLeft: 6,
                      background: 'var(--fable-red-soft)',
                      padding: '1px 6px',
                      borderRadius: 5,
                      fontWeight: 600,
                    }}
                  >
                    {overdueDays(item)}d
                  </span>
                )}
              </span>
            </div>
          )
        })}

        {/* Show more / less */}
        {(hidden > 0 || expanded) && (
          <button
            className="fb-show-more"
            onClick={() => setExpandedOwners(prev => ({ ...prev, [group.name]: !expanded }))}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              padding: 9,
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--text3)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color 150ms ease',
            }}
          >
            {expanded ? 'Show less' : `Show ${hidden} more from ${group.name}`}
          </button>
        )}
      </div>
    )
  }

  // Hold the entire dashboard until the role resolves, so restricted users never
  // see the admin stat cards / briefing / schedule flash before their view loads.
  if (!roleLoaded) {
    return (
      <>
        <TopBar title="Dashboard" subtitle="CASK Construction Command Center" />
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text3)', fontSize: 13 }}>
          Loading…
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        .fb-sess-item:hover { background: var(--surface2); }
        .fb-task:hover { background: var(--surface2); }
        .fb-task:last-child { border-bottom: none !important; }
        .fb-show-more:hover { color: var(--text); }
        .fb-btn:hover { border-color: var(--border2); }
        .fb-btn-primary:hover { opacity: 0.88; }
        .fb-all:hover { color: var(--text); }
        .fb-cb:hover { border-color: var(--text2) !important; }
        @media (prefers-reduced-motion: no-preference) {
          .fb-rise { animation: fbRise .35s ease both; }
          @keyframes fbRise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        }
      `}</style>

      <TopBar title="Dashboard" subtitle="CASK Construction Command Center">
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text3)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fable-ok)', flexShrink: 0 }} />
          {syncText}
        </span>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in" style={{ background: 'transparent' }}>
        {/* NEW (additive) — OAuth result toast (Outlook connect / errors). Green
            for success (var(--fable-ok)); red (var(--red)) only for errors. Neutral
            var(--surface2) background keeps it theme-safe in light + dark mode. */}
        {oauthToast && (
          <div
            role="status"
            className="fb-rise"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 18,
              padding: '11px 14px',
              borderRadius: 9,
              background: 'var(--surface2)',
              border: `1px solid ${oauthToast.kind === 'success' ? 'var(--fable-ok)' : 'var(--red-border)'}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: oauthToast.kind === 'success' ? 'var(--fable-ok)' : 'var(--red)',
              }}
            />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>
              {oauthToast.message}
            </span>
            <button
              onClick={() => setOauthToast(null)}
              aria-label="Dismiss"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                color: 'var(--text3)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Greeting */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 26 }}>
          <div>
            <h1
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 30,
                letterSpacing: '-0.45px',
                lineHeight: 1.15,
                color: 'var(--text)',
              }}
            >
              {greeting}{firstName ? `, ${firstName}.` : '.'}
            </h1>
            <div style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>{greetSub}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, flexShrink: 0, ...NUM }}>
            {clockStr}
          </div>
        </div>

        {/* Stats — joined hairline grid */}
        <div
          className="fb-rise"
          style={{
            display: 'grid',
            // CHANGE 1: restricted roles don't see "Events this week", so the
            // stat grid drops from 4 to 3 columns to lay out cleanly.
            gridTemplateColumns: isRestricted ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
            gap: 1,
            background: 'var(--fable-line, var(--border))',
            border: '1px solid var(--fable-line, var(--border))',
            borderRadius: 'var(--fable-radius)',
            overflow: 'hidden',
            marginBottom: 26,
          }}
        >
          <StatBox
            label="Sessions"
            value={loading ? '…' : visibleMeetings.length}
            delta={loading ? '' : sessionsThisMonth > 0 ? `▲ ${sessionsThisMonth} this month` : 'None this month'}
            deltaTone={sessionsThisMonth > 0 ? 'up' : 'flat'}
            note="All time"
            sparkPath="M0 17 L12 15 L24 16 L36 12 L48 13 L60 9 L72 7 L84 4"
          />
          {/* "Events this week" — gated by user. Calin (c.noonan) and Kai (k.mapoy)
              see the live Make.com calendar_events count as before; everyone else
              gets an em-dash + a subtle "Connect Outlook" link until Graph calendar
              data lands. Still hidden entirely for restricted roles.
              NOTE: "Events this week" counts company calendar_events (a different
              table than meetings, with a different attendees shape), so the
              meeting-attendee role filter does not apply here and is intentionally
              left unchanged. */}
          {!isRestricted && (
            showCalinCalendar ? (
              <StatBox
                label="Events this week"
                value={upcomingCount ?? '…'}
                delta={nextEventHint}
                deltaTone="flat"
                note={
                  calendarLoading ? '…'
                  : nextEventToday ? `Next: ${fmtET(nextEventToday.start_time)}`
                  : allEventsDone ? 'All done today'
                  : 'No more events today'
                }
                sparkPath="M0 12 L12 14 L24 10 L36 13 L48 8 L60 12 L72 10 L84 11"
              />
            ) : !showCalinCalendar && isOutlookConnected ? (
              // Outlook-connected users: their own week count from Microsoft Graph.
              // delta = current ET Mon–Sun range (matches the API's weekEvents window).
              <StatBox
                label="Events this week"
                value={myWeekEvents.length}
                delta={currentWeekRangeET()}
                deltaTone="flat"
                note={myTodayEvents.length > 0 ? `${myTodayEvents.length} today` : 'None today'}
                sparkPath="M0 12 L12 14 L24 10 L36 13 L48 8 L60 12 L72 10 L84 11"
              />
            ) : (
              // Non-Calin variant — mirrors StatBox's cell (background/padding/
              // typography) but swaps the trend line for a Connect Outlook link.
              <div style={{ background: 'var(--surface)', padding: '16px 18px 14px' }}>
                <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>
                  Events this week
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 8, ...NUM }}>
                  <span style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.5px', lineHeight: 1, color: 'var(--text)' }}>—</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  {/* Plain <a> (not next/link) so the browser issues a real GET to
                      the API route, which redirects into the Microsoft OAuth flow. */}
                  <a
                    href="/api/auth/microsoft"
                    className="fb-all"
                    style={{ fontSize: 11.5, color: 'var(--text2)', textDecoration: 'none' }}
                  >
                    Connect Outlook →
                  </a>
                </div>
              </div>
            )
          )}
          {/* CHANGE: restricted roles see only THEIR open items here (count,
              overdue, and oldest-overdue age); admins see the company-wide
              numbers, unchanged. */}
          <StatBox
            label="Open action items"
            value={actionItemsLoading ? '…' : (isRestricted ? myOpenItems.length : openActions.length)}
            delta={
              actionItemsLoading ? ''
              : (isRestricted ? myOpenOverdue.length : overdueActions.length) > 0
                ? `${isRestricted ? myOpenOverdue.length : overdueActions.length} overdue`
                : 'On track'
            }
            deltaTone={(isRestricted ? myOpenOverdue.length : overdueActions.length) > 0 ? 'bad' : 'flat'}
            note={
              (isRestricted ? myOpenOverdue.length : overdueActions.length) > 0
                ? `Oldest: ${isRestricted ? myOpenOldestDays : oldestDays} days`
                : 'Nothing overdue'
            }
            sparkPath="M0 16 L12 14 L24 14 L36 11 L48 9 L60 9 L72 6 L84 5"
            flag={!actionItemsLoading && (isRestricted ? myOpenOverdue.length : overdueActions.length) > 0}
          />
          {/* CHANGE 4: restricted roles see only THEIR completed items + personal
              completion rate; admins see the company-wide total, unchanged. */}
          <StatBox
            label="Completed"
            value={actionItemsLoading ? '…' : (isRestricted ? myCompletedCount : completedActions.length)}
            delta={actionItemsLoading ? '' : `▲ ${isRestricted ? myCompletionRate : completionRate}%`}
            deltaTone={(isRestricted ? myCompletionRate : completionRate) > 0 ? 'up' : 'flat'}
            note={isRestricted ? 'Your completion rate · all time' : 'Completion rate · all time'}
            sparkPath="M0 18 L12 17 L24 15 L36 14 L48 11 L60 10 L72 7 L84 5"
          />
        </div>

        {/* NEW (additive): Past Due Alerts — placed high on the page, directly ABOVE the
            briefing section. Only rendered when there are overdue customer-journey tasks. */}
        {journeyOverdueAlerts.length > 0 && (
          <section aria-label="Past due customer journey alerts" className="fb-rise" style={{ marginBottom: 26 }}>
            <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--red)' }}>
                  ⚠️ Past Due — Customer Journey
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', ...NUM }}>{journeyOverdueAlerts.length}</span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {journeyOverdueAlerts.slice(0, 3).map((a, i) => (
                  <li key={i} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                    <Link href={`/customers/${a.clientId}`} style={{ color: 'var(--red)', textDecoration: 'none' }}>
                      <b style={{ fontWeight: 650 }}>{a.clientName}</b>
                      {' · '}STEP {String(a.stepNumber).padStart(2, '0')}{' · '}
                      <span style={{ color: 'var(--red)' }}>{a.task}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {journeyOverdueAlerts.length > 3 && (
                <Link
                  href="/customers"
                  className="fb-all"
                  style={{ display: 'inline-block', marginTop: 8, fontSize: 11.5, fontWeight: 500, color: 'var(--red)', textDecoration: 'none' }}
                >
                  and {journeyOverdueAlerts.length - 3} more →
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ROW 2: Afternoon Briefing (full width) */}
        {/* Briefing — the signature element */}
        <section
          aria-label="Daily briefing"
          className="fb-rise"
          style={{
            border: '1px solid var(--fable-line, var(--border))',
            borderRadius: 'var(--fable-radius)',
            background: 'var(--surface)',
            marginBottom: 30,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid var(--fable-line-soft, var(--border))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 18, height: 2, background: 'var(--fable-red)', flexShrink: 0 }} />
              <h2
                style={{
                  fontSize: 11.5,
                  letterSpacing: '1.4px',
                  textTransform: 'uppercase',
                  fontWeight: 650,
                  color: 'var(--text)',
                }}
              >
                {briefingLabel}
              </h2>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{todayLabel}</div>
          </div>

          {/* CHANGE 2: restricted roles don't see "Today's schedule", so the
              briefing collapses to a single column (no right divider). */}
          <div style={{ display: 'grid', gridTemplateColumns: isRestricted ? '1fr' : '1.4fr 1fr', alignItems: 'start' }}>
            {/* Main briefing text */}
            <div style={{ padding: '18px 20px', borderRight: isRestricted ? 'none' : '1px solid var(--fable-line-soft, var(--border))' }}>
              <p
                style={{
                  fontFamily: SERIF,
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                {/* CHANGE 3: restricted roles get a briefing that references ONLY
                    their own action items — no calendar/schedule data. Admins keep
                    the existing schedule-aware briefing below, unchanged. */}
                {isRestricted ? (
                  actionItemsLoading ? (
                    'Loading your action items…'
                  ) : (
                    <>
                      You have{' '}
                      <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                        {myOpenCount} open action item{myOpenCount === 1 ? '' : 's'}
                      </em>
                      {myOverdueActions.length > 0 ? (
                        <>
                          ,{' '}
                          <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                            {myOverdueActions.length} overdue
                          </em>
                          .
                        </>
                      ) : (
                        ', none overdue.'
                      )}
                    </>
                  )
                ) : (
                  <>
                {showCalinCalendar ? (
                  // Calin/Kai — Make.com calendar_events feed (unchanged).
                  calendarLoading ? (
                    'Pulling today’s schedule…'
                  ) : calendarEvents.length === 0 ? (
                    'Nothing on the calendar today.'
                  ) : allEventsDone ? (
                    'All of today’s meetings are wrapped.'
                  ) : nextEventToday ? (
                    <>
                      Next up:{' '}
                      <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                        {nextEventToday.title} at {fmtET(nextEventToday.start_time)}
                      </em>
                      .
                    </>
                  ) : (
                    `${calendarEvents.length} event${calendarEvents.length === 1 ? '' : 's'} on today’s calendar.`
                  )
                ) : (
                  // Everyone else — their own Microsoft Graph calendar (myTodayEvents).
                  myCalendarLoading ? (
                    'Pulling today’s schedule…'
                  ) : myTodayEvents.length === 0 ? (
                    'Nothing on the calendar today.'
                  ) : allMyEventsDone ? (
                    'All of today’s meetings are wrapped.'
                  ) : myNextEvent ? (
                    <>
                      Next up:{' '}
                      <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                        {myNextEvent.subject} at {fmtGraphET(myNextEvent.start.dateTime)}
                      </em>
                      .
                    </>
                  ) : (
                    `${myTodayEvents.length} event${myTodayEvents.length === 1 ? '' : 's'} on today’s calendar.`
                  )
                )}{' '}
                {actionItemsLoading ? null : bannerOverdueCount > 0 ? (
                  <>
                    <em style={{ fontStyle: 'normal', borderBottom: '2px solid var(--fable-red-soft)' }}>
                      {bannerOverdueCount} action item{bannerOverdueCount === 1 ? ' is' : 's are'} past due
                    </em>
                    {/* Owner attribution only for leadership; everyone else sees just their own count. */}
                    {canSeeAllItems && ownerGroups[0] && ownerGroups[0].overdue > 1
                      ? `, ${ownerGroups[0].overdue} of them ${ownerGroups[0].name}’s.`
                      : '.'}
                  </>
                ) : (
                  'No action items are overdue — the board is clean.'
                )}
                  </>
                )}
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <Link
                  href="/actions"
                  className="fb-btn-primary"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 550,
                    borderRadius: 7,
                    padding: '8px 13px',
                    lineHeight: 1,
                    background: 'var(--fable-red)',
                    border: '1px solid var(--fable-red)',
                    color: '#fff',
                    textDecoration: 'none',
                    transition: 'opacity 150ms ease',
                  }}
                >
                  Review overdue items
                </Link>
                {!isRestricted && (
                  <Link
                    href={showCalinCalendar ? '/president/calendar' : '/my-workspace/calendar'}
                    className="fb-btn"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 550,
                      borderRadius: 7,
                      padding: '8px 13px',
                      lineHeight: 1,
                      background: 'var(--surface)',
                      border: '1px solid var(--fable-line, var(--border))',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    Open calendar
                  </Link>
                )}
              </div>

              {/* Recent Sessions — fills the space below the briefing buttons */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--fable-line-soft, var(--border))' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>
                    Recent Sessions
                  </h3>
                  <Link
                    href="/sessions"
                    className="fb-all"
                    style={{ fontSize: 11.5, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms ease' }}
                  >
                    View all →
                  </Link>
                </div>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="shimmer" style={{ height: 40, borderRadius: 6 }} />
                    ))}
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {recentMeetings.map(m => {
                      const sDate = new Date(m.date + 'T00:00:00')
                      const recapReady = (m.summary?.length ?? 0) > 0
                      const shown = m.attendees.slice(0, 4)
                      const extra = m.attendees.length - shown.length
                      return (
                        <li key={m.id}>
                          <Link
                            href={`/sessions/${m.id}`}
                            className="fb-sess-item"
                            style={{
                              display: 'flex',
                              gap: 12,
                              alignItems: 'center',
                              padding: '8px',
                              borderRadius: 8,
                              textDecoration: 'none',
                              transition: 'background 150ms ease',
                            }}
                          >
                            <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
                              <div style={{ fontSize: 15, fontWeight: 650, lineHeight: 1, color: 'var(--text)', ...NUM }}>
                                {sDate.getDate()}
                              </div>
                              <div style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginTop: 2 }}>
                                {sDate.toLocaleString('en-US', { month: 'short' })}
                              </div>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)', letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.title}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {shown.join(', ')}{extra > 0 ? ` +${extra}` : ''}
                              </div>
                            </div>
                            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 550, color: recapReady ? 'var(--fable-ok)' : 'var(--fable-warn)' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: recapReady ? 'var(--fable-ok)' : 'var(--fable-warn)' }} />
                              {recapReady ? 'Recap ready' : 'Awaiting recap'}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Today's schedule — CHANGE 2: hidden for restricted roles (no
                calendar/schedule data surfaced to them); admins see it as before. */}
            {!isRestricted && (
            <div style={{ padding: '18px 20px' }}>
              <h3
                style={{
                  fontSize: 10,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text3)',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Today&apos;s schedule
              </h3>
              {/* Gated by user — Calin (c.noonan) and Kai (k.mapoy) see the live
                  Make.com calendar feed as before; everyone else gets the Outlook
                  "connect" empty state until Graph calendar data lands. */}
              {showCalinCalendar ? (
                calendarLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="shimmer" style={{ height: 18, borderRadius: 5 }} />
                    <div className="shimmer" style={{ height: 18, borderRadius: 5, opacity: 0.6 }} />
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>No meetings scheduled today.</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {calendarEvents.map(ev => {
                      const startMs = new Date(ev.start_time).getTime()
                      const endMs = ev.end_time ? new Date(ev.end_time).getTime() : null
                      const isDone = !ev.is_all_day && endMs !== null && endMs < nowMs
                      const isNow = !ev.is_all_day && startMs <= nowMs && endMs !== null && endMs >= nowMs
                      const title = ev.web_link ? (
                        <a
                          href={ev.web_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          {ev.title}
                        </a>
                      ) : (
                        ev.title
                      )
                      return (
                        <li
                          key={ev.id}
                          style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0', color: 'var(--text2)' }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: 'var(--text)',
                              width: 62,
                              flexShrink: 0,
                              ...NUM,
                            }}
                          >
                            {ev.is_all_day ? 'All day' : fmtET(ev.start_time)}
                          </span>
                          <span
                            style={{
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              ...(isDone
                                ? {
                                    color: 'var(--text3)',
                                    textDecoration: 'line-through',
                                    textDecorationColor: 'var(--border2)',
                                  }
                                : {}),
                            }}
                          >
                            {title}
                          </span>
                          {isDone && <span style={{ color: 'var(--fable-ok)', fontWeight: 600, flexShrink: 0 }}>✓</span>}
                          {isNow && (
                            <span
                              style={{
                                color: 'var(--fable-ok)',
                                fontWeight: 650,
                                fontSize: 10.5,
                                flexShrink: 0,
                                alignSelf: 'center',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              ● Now
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )
              ) : !showCalinCalendar && isOutlookConnected ? (
                // Outlook-connected users: their own Microsoft Graph calendar for
                // today, styled to match Calin's Make.com schedule items above.
                myTodayEvents.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>No meetings today</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {myTodayEvents.slice(0, 8).map(ev => {
                      const endMs = ev.end?.dateTime ? parseGraphDate(ev.end.dateTime).getTime() : null
                      const isDone = !ev.isAllDay && endMs !== null && endMs < nowMs
                      return (
                        <li
                          key={ev.id}
                          style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0', color: 'var(--text2)' }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text)', width: 62, flexShrink: 0, ...NUM }}>
                            {ev.isAllDay ? 'All day' : fmtGraphET(ev.start.dateTime)}
                          </span>
                          <span
                            style={{
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              ...(isDone
                                ? { color: 'var(--text3)', textDecoration: 'line-through', textDecorationColor: 'var(--border2)' }
                                : {}),
                            }}
                          >
                            {ev.subject}
                          </span>
                          {isDone && <span style={{ color: 'var(--fable-ok)', fontWeight: 600, flexShrink: 0 }}>✓</span>}
                        </li>
                      )
                    })}
                  </ul>
                )
              ) : (
                <div
                  style={{
                    background: 'var(--surface2)',
                    borderRadius: 10,
                    padding: '22px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 11,
                  }}
                >
                  {/* Calendar icon — matches the file's inline-SVG icon style
                      (stroke: currentColor, rounded caps). */}
                  <span style={{ color: 'var(--text3)', display: 'inline-flex' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 260, lineHeight: 1.5 }}>
                    Connect your Outlook to see today&apos;s schedule
                  </div>
                  {/* Plain <a> (not next/link) so the browser issues a real GET to
                      the API route, which redirects into the Microsoft OAuth flow.
                      Styled to match the dashboard's primary button (fb-btn-primary). */}
                  <a
                    href="/api/auth/microsoft"
                    className="fb-btn-primary"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 550,
                      borderRadius: 7,
                      padding: '8px 14px',
                      lineHeight: 1,
                      background: 'var(--fable-red)',
                      border: '1px solid var(--fable-red)',
                      color: '#fff',
                      textDecoration: 'none',
                      transition: 'opacity 150ms ease',
                    }}
                  >
                    Connect Outlook
                  </a>
                </div>
              )}
            </div>
            )}
          </div>
        </section>

        {/* ROW 3: Open Action Items (full width) */}
        <section aria-label="Open action items" style={{ display: 'block', marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 11.5, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 650, color: 'var(--text)' }}>
                Open Action Items
              </h2>
              <Link
                href="/actions"
                className="fb-all"
                style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms ease' }}
              >
                View all {actionItemsLoading ? '' : openActions.length} →
              </Link>
            </div>

            {/* Overdue alert strip */}
            {!actionItemsLoading && bannerOverdueCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  marginBottom: 12,
                  background: 'var(--red-soft)',
                  border: '1px solid var(--red-border)',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: 'var(--red)',
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
                <span>
                  <b style={{ fontWeight: 650 }}>
                    {bannerOverdueCount} item{bannerOverdueCount === 1 ? '' : 's'} overdue
                  </b>
                  {bannerOldestOverdue ? ` — oldest open since ${fmtDue(bannerOldestOverdue.due_date)}` : ''}
                </span>
              </div>
            )}

            {bottomLoading && actionItemsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="shimmer" style={{ height: 54, borderRadius: 8, border: '1px solid var(--border)' }} />
                ))}
              </div>
            ) : canSeeAllItems ? (
              /* ===== Leadership board — existing behavior, unchanged ===== */
              ownerGroups.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 0' }}>
                  No open action items. 🎉
                </div>
              ) : (
                ownerGroups.map(group => renderOwnerGroupCard(group))
              )
            ) : myGroup || otherGroups.length > 0 ? (
              /* ===== Personal view (Jeff, Matteo, Chad…) — own items only ===== */
              myGroup ? (
                renderOwnerGroupCard(myGroup)
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 0', marginBottom: 4 }}>
                  You have no open action items. 🎉
                </div>
              )
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 0' }}>
                No open action items. 🎉
              </div>
            )}

            {/* Bottom CTA → full Action Items page (leadership only) */}
            {!actionItemsLoading && canSeeAllItems && ownerGroups.length > 0 && (
              <Link
                href="/actions"
                className="fb-show-more"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: 11,
                  fontSize: 12.5,
                  fontWeight: 550,
                  color: 'var(--text2)',
                  textDecoration: 'none',
                  background: 'var(--surface2)',
                  border: '1px solid var(--fable-line, var(--border))',
                  borderRadius: 'var(--fable-radius)',
                  transition: 'color 150ms ease',
                }}
              >
                Show all {openActions.length} items →
              </Link>
            )}
          </section>

        {/* NEW (additive): Active Clients — Customer Journey (between Action Items and Yesterday's Meetings) */}
        <section aria-label="Active clients customer journey" style={{ display: 'block', marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 11.5, letterSpacing: '1.4px', textTransform: 'uppercase', fontWeight: 650, color: 'var(--text)' }}>
              Active Clients — Customer Journey
            </h2>
            <Link
              href="/customers"
              className="fb-all"
              style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms ease' }}
            >
              View all clients →
            </Link>
          </div>

          {clientsJourneyLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1].map(i => (
                <div key={i} className="shimmer" style={{ height: 120, borderRadius: 10, border: '1px solid var(--border)' }} />
              ))}
            </div>
          ) : clientsData.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 0' }}>No active clients</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {clientsData.map(client => {
                // ── Journey tasks: cap at 5 total, then group those by role ──
                const MAX_TASKS = 5
                const visibleTasks = client.journeyTasks.slice(0, MAX_TASKS)
                const moreTasks = client.journeyTasks.length - visibleTasks.length
                const taskGroups: { role: string; tasks: JourneyTaskDisplay[] }[] = []
                for (const t of visibleTasks) {
                  let g = taskGroups.find(x => x.role === t.role)
                  if (!g) { g = { role: t.role, tasks: [] }; taskGroups.push(g) }
                  g.tasks.push(t)
                }

                // ── Meeting action items: only when a recap exists for this step ──
                const visibleActions = client.meetingActionItems.slice(0, 3)
                const showActions = client.hasRecapForStep && visibleActions.length > 0

                const stepBadge =
                  client.currentStepNumber != null
                    ? `STEP ${String(client.currentStepNumber).padStart(2, '0')} · ${client.currentStepTitle}`
                    : 'Journey complete'

                const subLabelStyle: React.CSSProperties = {
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--text3)',
                  fontWeight: 600,
                  marginBottom: 8,
                }

                return (
                  <div
                    key={client.id}
                    className="fb-rise"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '16px 20px',
                    }}
                  >
                    {/* 1 — Client header row */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <Link
                        href={`/customers/${client.id}`}
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
                      >
                        {client.name}
                      </Link>
                      {client.project_type && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: 'var(--text2)',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: 99,
                            padding: '2px 9px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {client.project_type}
                        </span>
                      )}
                      <span
                        title={`Happiness: ${client.happiness}`}
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: happinessColor(client.happiness),
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, ...NUM }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{stepBadge}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {client.completedCount} of {TOTAL_WORKFLOW_STEPS} steps
                        </span>
                      </span>
                    </div>

                    {/* 2 — Journey Tasks (current step) */}
                    <div style={{ marginTop: 16 }}>
                      <div style={subLabelStyle}>Journey Tasks</div>
                      {taskGroups.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {client.currentStepNumber == null ? 'All steps complete.' : 'No journey tasks for this step.'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {taskGroups.map(g => (
                            <div key={g.role}>
                              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>
                                {ROLE_NAMES[g.role] ?? g.role}
                              </div>
                              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {g.tasks.map((t, ti) => (
                                  <li
                                    key={ti}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 8,
                                      opacity: t.completed ? 0.5 : 1,
                                    }}
                                  >
                                    {/* Read-only display checkbox (12x12) */}
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        width: 12,
                                        height: 12,
                                        flexShrink: 0,
                                        marginTop: 2,
                                        borderRadius: 3,
                                        border: '1.5px solid var(--border2)',
                                        background: t.completed ? 'var(--fable-ok)' : 'transparent',
                                        display: 'grid',
                                        placeItems: 'center',
                                      }}
                                    >
                                      {t.completed && (
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                      )}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        lineHeight: 1.45,
                                        color: 'var(--text)',
                                        textDecoration: t.completed ? 'line-through' : 'none',
                                      }}
                                    >
                                      {t.task}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          {moreTasks > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>and {moreTasks} more</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3 — Meeting Action Items (from current step's recap) */}
                    {showActions && (
                      <div style={{ marginTop: 16 }}>
                        <div style={subLabelStyle}>Meeting Action Items</div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {visibleActions.map((a, ai) => (
                            <li
                              key={ai}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 8,
                                opacity: a.done ? 0.5 : 1,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  color: 'var(--text)',
                                  textDecoration: a.done ? 'line-through' : 'none',
                                }}
                              >
                                {a.task ?? 'Untitled action'}
                              </span>
                              {a.owner && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    color: 'var(--text2)',
                                    background: 'var(--surface2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 99,
                                    padding: '1px 8px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {a.owner}
                                </span>
                              )}
                              {a.due_date && (
                                <span style={{ fontSize: 11, color: 'var(--text3)', ...NUM }}>
                                  {fmtDue(a.due_date)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* View full journey */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                      <Link
                        href={`/customers/${client.id}`}
                        className="fb-all"
                        style={{ fontSize: 11.5, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms ease' }}
                      >
                        View Journey →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Yesterday's Meetings — moved below Row 3 (full width).
            Visible for ALL roles — gated ONLY by data presence (never by user
            role/canSeeAllItems). Do not wrap this in a role condition.
            Uses visibleYesterdayMeetings so restricted roles only see meetings
            they attended; admins still see every meeting. */}
        {visibleYesterdayMeetings.length > 0 && (
          <section aria-label="Yesterday's meetings">
            <div
              style={{
                border: '1px solid var(--fable-line, var(--border))',
                borderRadius: 'var(--fable-radius)',
                background: 'var(--surface)',
                padding: '16px 20px',
              }}
            >
              <h3
                style={{
                  fontSize: 10,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text3)',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Yesterday&apos;s Meetings
              </h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {visibleYesterdayMeetings.map(m => (
                  <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                    <Link
                      href={`/sessions/${m.id}`}
                      style={{
                        color: 'var(--text)',
                        textDecoration: 'none',
                        fontWeight: 550,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.title}
                    </Link>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        flexShrink: 0,
                        fontSize: 11.5,
                        fontWeight: 550,
                        color: 'var(--fable-ok)',
                      }}
                    >
                      ✅ Recap ready
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      {/* Floating CASK Intelligence button + chat drawer — bottom-right, this page only.
          ROLE-SCOPING: the dashboard's AI context is built server-side in
          /api/chat. We pass the user's role + first name so that route can scope
          restricted roles (Jeff/Matteo/Chad/Lamont) to ONLY their own meetings +
          action items, excluding calendar/company-wide data. Admins (or any
          missing role) are unaffected and still get the full context. */}
      <FloatingDashboardAI userRole={userRole} userName={firstName} />
    </>
  )
}
