'use client'
// src/app/(app)/presidents-workflow/big-vision/_components/FloatingVisionAI.tsx
//
// Floating CASK Big Vision AI — same floating button + chat drawer pattern used on
// Command Center / Dashboard, now wired with real Supabase context. On first open it
// fetches every cask_vision_content row, builds a system prompt from all 6 horizons,
// and sends that prompt with every message to /api/big-vision-chat.

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const PAGE_CONTEXT = '/presidents-workflow/big-vision'

const AI_ACCENT = '#B5121B' // fable red

const D = {
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
  "CASK Big Vision AI online. I have context on CASK's 1, 3, 5, and 10-year plans, the manifesto, division charters, and strategic roadmap. Ask about the vision, the goals, or what to focus on."

// Starter questions — clickable chips that auto-send.
const STARTER_QUESTIONS = [
  'What is our 1-year revenue target?',
  'Summarize our 5-year plan',
  'What is the CASK Manifesto?',
  'Who leads each division?',
]

// Maps each cask_vision_content.horizon value to its system-prompt section label.
const HORIZON_SECTIONS: { horizon: string; label: string }[] = [
  { horizon: '1yr', label: '1-YEAR PLAN' },
  { horizon: '3yr', label: '3-YEAR PLAN' },
  { horizon: '5yr', label: '5-YEAR PLAN' },
  { horizon: 'manifesto', label: 'CASK MANIFESTO' },
  { horizon: 'division_charters', label: 'DIVISION CHARTERS' },
  { horizon: 'org_chart', label: '10-YEAR STRATEGIC ROADMAP' },
]

interface VisionRow {
  horizon: string
  content: string
}

function buildVisionSystemPrompt(rows: VisionRow[]): string {
  const byHorizon = new Map(rows.map((r) => [r.horizon, r.content ?? '']))
  const sections = HORIZON_SECTIONS.map(
    ({ horizon, label }) => `=== ${label} ===\n${byHorizon.get(horizon)?.trim() || '(not available)'}`,
  ).join('\n\n')

  return (
    'You are CASK Big Vision AI, the strategic intelligence assistant for CASK Construction. ' +
    "You have deep knowledge of CASK's vision, goals, and strategic plans. " +
    'Here is the complete CASK vision data:\n\n' +
    sections +
    "\n\nUse this data to answer questions about CASK's strategy, goals, divisions, revenue targets, " +
    'community vision, and long-term plans. Be concise, direct, and specific. Reference actual data from ' +
    'the vision documents when answering.'
  )
}

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
  fileName?: string // set on user turns that carried an uploaded file (session display only)
}

// ── File upload helpers ───────────────────────────────────────────────
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
const UPLOAD_ACCEPT = '.pdf,.docx,image/*'

// Resolve the Claude-compatible media type from a File.
function detectMediaType(file: File): string {
  if (file.type) {
    if (file.type === 'application/pdf') return 'application/pdf'
    if (file.type.startsWith('image/')) return file.type
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return file.type
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  return file.type || 'application/octet-stream'
}

// Read a File as pure base64 (strips the "data:...;base64," prefix).
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') return reject(new Error('Unexpected file reader result'))
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

function PaperclipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

export default function FloatingVisionAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  // Vision context (system prompt) built from cask_vision_content on first open.
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState(false)
  const contextRequestedRef = useRef(false)

  // File upload state (added on top of the existing chat — no change to chat logic).
  const [attachedFile, setAttachedFile] = useState<{ file: File; name: string } | null>(null)
  const [fileError, setFileError] = useState('')
  const [readingFile, setReadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onPickFile(file: File | undefined) {
    if (!file) return
    setFileError('')
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File too large (max 10MB)')
      return
    }
    setAttachedFile({ file, name: file.name })
  }

  function removeAttachedFile() {
    setAttachedFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Send the attached file + question to the upload route, then clear the file.
  async function sendWithFile(attached: { file: File; name: string }, question: string) {
    if (thinking || contextLoading || readingFile) return
    setFileError('')
    setReadingFile(true)
    let base64: string
    let mediaType: string
    try {
      base64 = await readFileAsBase64(attached.file)
      mediaType = detectMediaType(attached.file)
    } catch {
      setReadingFile(false)
      setFileError('Upload failed. Please try again.')
      return
    }
    setReadingFile(false)

    const questionText = question.trim() || `Please analyze "${attached.name}".`
    const next: PanelMsg[] = [...messages, { role: 'user', content: questionText, fileName: attached.name }]
    setMessages(next)
    saveMessage('user', questionText)
    setInput('')
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setThinking(true)
    try {
      const res = await fetch('/api/big-vision-upload-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
          file: { base64, mediaType, name: attached.name },
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Upload failed. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  // Load any saved chat history for this page once we know the user.
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
        .eq('page_context', PAGE_CONTEXT)
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setMessages(history as PanelMsg[])
      }
    }
    loadHistory()
  }, [])

  // Fetch vision content + build the system prompt the first time the drawer opens.
  useEffect(() => {
    if (!open || contextRequestedRef.current) return
    contextRequestedRef.current = true

    async function loadContext() {
      setContextLoading(true)
      setContextError(false)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('cask_vision_content').select('horizon, content')
        if (error) throw error
        setSystemPrompt(buildVisionSystemPrompt((data as VisionRow[]) ?? []))
      } catch {
        setContextError(true)
        // Allow the assistant to still answer generally if context fails to load.
        setSystemPrompt(buildVisionSystemPrompt([]))
      } finally {
        setContextLoading(false)
      }
    }
    loadContext()
  }, [open])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: PAGE_CONTEXT, role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', PAGE_CONTEXT)
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text?: string) {
    // Upload feature added on top: when a file is attached, route through sendWithFile.
    if (attachedFile) {
      sendWithFile(attachedFile, text ?? input)
      return
    }
    const msg = (text ?? input).trim()
    if (!msg || thinking || contextLoading) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/big-vision-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
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

  const showStarters = messages.length <= 1 && !thinking && !contextLoading

  return (
    <>
      <style>{`
        @keyframes bvfosSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bvfosPulse {
          0% { box-shadow: 0 0 0 0 rgba(181,18,27,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(181,18,27,0); }
          100% { box-shadow: 0 0 0 0 rgba(181,18,27,0); }
        }
      `}</style>

      {/* Floating button — always visible */}
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
          background: 'var(--charcoal)',
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
            animation: 'bvfosPulse 2.2s ease-out infinite',
          }}
        />
        CASK Big Vision AI
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
            background: D.bg,
            color: D.text,
            border: `1px solid ${D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'bvfosSlideUp 220ms ease',
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
                  background: D.accent,
                  boxShadow: `0 0 8px ${D.accent}`,
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
                CASK Big Vision AI
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

          {/* Context status banners */}
          {contextLoading && (
            <div
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                fontSize: 11,
                color: D.text3,
                background: D.surface,
                borderBottom: `1px solid ${D.border}`,
                fontStyle: 'italic',
              }}
            >
              Loading CASK vision context…
            </div>
          )}
          {!contextLoading && contextError && (
            <div
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                fontSize: 11,
                color: '#92400e',
                background: '#fffbeb',
                borderBottom: '1px solid #fde68a',
              }}
            >
              Running without full context — some answers may be limited
            </div>
          )}

          {/* Feed — user right, AI left */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
            {messages.map((m, i) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '9px 12px',
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      borderRadius: 12,
                      borderBottomRightRadius: isUser ? 4 : 12,
                      borderBottomLeftRadius: isUser ? 12 : 4,
                      background: isUser ? 'var(--charcoal)' : D.surface,
                      color: isUser ? '#fff' : D.text,
                      border: isUser ? 'none' : `1px solid ${D.border}`,
                    }}
                  >
                    {m.fileName && (
                      <div style={{ marginBottom: 6 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            maxWidth: '100%',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: isUser ? 'rgba(255,255,255,0.16)' : D.surface,
                            border: isUser ? 'none' : `1px solid ${D.border}`,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fileName}</span>
                        </span>
                      </div>
                    )}
                    {m.content}
                  </div>
                </div>
              )
            })}

            {(thinking || readingFile) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '9px 12px',
                    fontSize: 12.5,
                    color: D.text3,
                    fontStyle: 'italic',
                    borderRadius: 12,
                    borderBottomLeftRadius: 4,
                    background: D.surface,
                    border: `1px solid ${D.border}`,
                  }}
                >
                  {readingFile ? 'Reading file…' : 'Analyzing…'}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Starter question chips (only when chat is empty) */}
          {showStarters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: D.surface,
                    border: `1px solid ${D.border}`,
                    color: D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${D.accent}66`
                    e.currentTarget.style.color = D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = D.border
                    e.currentTarget.style.color = D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
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
                    color: D.text2,
                    background: D.surface,
                    border: `1px solid ${D.border}`,
                  }}
                >
                  <span style={{ color: D.text3, display: 'inline-flex', flexShrink: 0 }}>
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
                      color: D.text3,
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

            {/* Hidden file input — PDF, DOCX, images only */}
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              style={{ display: 'none' }}
              onChange={(e) => {
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
                border: `1px solid ${D.border}`,
                background: D.surface,
              }}
            >
              {/* Attach / paperclip */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={thinking || contextLoading || readingFile}
                title="Attach a file (PDF, DOCX, image)"
                aria-label="Attach a file"
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  color: attachedFile ? D.accent : D.text3,
                  border: 'none',
                  cursor: thinking || contextLoading || readingFile ? 'not-allowed' : 'pointer',
                  transition: 'color 150ms ease',
                }}
              >
                <PaperclipIcon />
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={contextLoading ? 'Loading vision context…' : attachedFile ? 'Ask a question about this file…' : 'Ask about the CASK vision...'}
                rows={1}
                disabled={contextLoading}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: D.text,
                  fontFamily: 'inherit',
                  maxHeight: 96,
                  overflowY: 'auto',
                  border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={(!input.trim() && !attachedFile) || thinking || contextLoading || readingFile}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: (input.trim() || attachedFile) && !thinking && !contextLoading && !readingFile ? D.accent : D.surface,
                  color: (input.trim() || attachedFile) && !thinking && !contextLoading && !readingFile ? '#fff' : D.text3,
                  border: 'none',
                  cursor: (!input.trim() && !attachedFile) || thinking || contextLoading || readingFile ? 'not-allowed' : 'pointer',
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
