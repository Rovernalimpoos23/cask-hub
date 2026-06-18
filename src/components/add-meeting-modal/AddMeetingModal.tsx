'use client'
// src/components/add-meeting-modal/AddMeetingModal.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { MeetingType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionItemForm {
  id: string
  task: string
  owner: string
  due_date: string
  done: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'planning', label: 'Planning' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'education', label: 'Education' },
]

const MODULES = [
  'ActionCOACH',
  'President Workflow — Daily Meetings',
  'President Workflow — Coaching Sessions',
  'President Workflow — Department Alignment',
  'President Workflow — PIT Goals',
  'Customer Journey — Active Clients',
  'Customer Journey — Client Templates',
  'Design Center',
]

const QUICK_ATTENDEES = ['Calin', 'Chad', 'Kai', 'Juliet', 'Lamont', 'Jeff', 'Kait', 'Matteo', 'Rovern']
const OWNERS = ['Calin', 'Chad', 'Kai', 'Rovern', 'Lamont', 'Jeff', 'Kait', 'Matteo']

function newItem(): ActionItemForm {
  return { id: crypto.randomUUID(), task: '', owner: '', due_date: '', done: false }
}

function sanitizeDate(value: string): string | null {
  if (!value ||
      value.toLowerCase() === 'not specified' ||
      value.toLowerCase() === 'n/a' ||
      value.toLowerCase() === 'unknown' ||
      value.trim() === '') {
    return null
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDone: () => void
}

function Toast({ message, type, onDone }: ToastProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2700)
    const t2 = setTimeout(onDone, 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  const isSuccess = type === 'success'
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 10,
        background: isSuccess ? 'var(--green-bg)' : 'var(--red-soft)',
        border: `1px solid ${isSuccess ? '#bbf7d0' : 'var(--red-border)'}`,
        color: isSuccess ? 'var(--green)' : 'var(--red)',
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        animation: exiting
          ? 'toastOut 0.3s ease forwards'
          : 'toastIn 0.25s ease forwards',
        maxWidth: 320,
        fontFamily: 'inherit',
      }}
    >
      {isSuccess ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {message}
    </div>
  )
}

// ─── Tag input (attendees) ────────────────────────────────────────────────────

interface AttendeeInputProps {
  attendees: string[]
  onChange: (attendees: string[]) => void
}

function AttendeeInput({ attendees, onChange }: AttendeeInputProps) {
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addAttendee(name: string) {
    const trimmed = name.trim()
    if (trimmed && !attendees.includes(trimmed)) {
      onChange([...attendees, trimmed])
    }
    setInputVal('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addAttendee(inputVal)
    } else if (e.key === 'Backspace' && !inputVal && attendees.length > 0) {
      onChange(attendees.slice(0, -1))
    }
  }

  function removeAttendee(name: string) {
    onChange(attendees.filter(a => a !== name))
  }

  return (
    <div>
      {/* Quick-add chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {QUICK_ATTENDEES.map(name => {
          const active = attendees.includes(name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => active ? removeAttendee(name) : addAttendee(name)}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border)'}`,
                background: active ? 'var(--charcoal)' : 'transparent',
                color: active ? 'white' : 'var(--text2)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                fontFamily: 'inherit',
              }}
            >
              {name}
            </button>
          )
        })}
      </div>

      {/* Tag input area */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '8px 10px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg)',
          cursor: 'text',
          minHeight: 42,
          alignItems: 'center',
        }}
      >
        {attendees.map(name => (
          <span
            key={name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 20,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text)',
            }}
          >
            {name}
            <button
              type="button"
              onClick={() => removeAttendee(name)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text3)',
                lineHeight: 1,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputVal.trim() && addAttendee(inputVal)}
          placeholder={attendees.length === 0 ? 'Type a name and press Enter…' : ''}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            color: 'var(--text)',
            fontFamily: 'inherit',
            minWidth: 120,
            flex: 1,
          }}
        />
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AddMeetingModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [exiting, setExiting] = useState(false)

  // Form state
  const [title, setTitle]               = useState('')
  const [meetingType, setMeetingType]   = useState<MeetingType>('coaching')
  const [module, setModule]             = useState('ActionCOACH')
  const [date, setDate]                 = useState(() => new Date().toISOString().split('T')[0])
  useEffect(() => { setDate(new Date().toISOString().split('T')[0]) }, [])
  const [owner, setOwner]               = useState('Calin')
  const [timeStart, setTimeStart]       = useState('')
  const [timeEnd, setTimeEnd]           = useState('')
  const [attendees, setAttendees]       = useState<string[]>([])
  const [transcript, setTranscript]     = useState('')
  const [summary1, setSummary1]         = useState('')
  const [summary2, setSummary2]         = useState('')
  const [summary3, setSummary3]         = useState('')
  const [actionItems, setActionItems]   = useState<ActionItemForm[]>([newItem()])
  const [decision1, setDecision1]       = useState('')
  const [decision2, setDecision2]       = useState('')
  const [decision3, setDecision3]       = useState('')

  // UI state
  const [saving, setSaving]         = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [aiSuccess, setAiSuccess]   = useState(false)
  const [toast, setToast]           = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ── Open/close logic ──────────────────────────────────────────────────────

  function openModal() {
    setExiting(false)
    setOpen(true)
  }

  const closeModal = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setOpen(false)
      setExiting(false)
    }, 200)
  }, [])

  // Listen for open event from anywhere
  useEffect(() => {
    const handler = () => openModal()
    window.addEventListener('cask-open-add-modal', handler)
    return () => window.removeEventListener('cask-open-add-modal', handler)
  }, [])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, closeModal])

  // ── Action item helpers ────────────────────────────────────────────────────

  function addItem() { setActionItems(p => [...p, newItem()]) }
  function removeItem(id: string) { setActionItems(p => p.filter(i => i.id !== id)) }
  function updateItem(id: string, field: keyof ActionItemForm, value: string | boolean) {
    setActionItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // ── Reset form ─────────────────────────────────────────────────────────────

  function resetForm() {
    setTitle(''); setMeetingType('coaching'); setModule('ActionCOACH')
    setDate(new Date().toISOString().split('T')[0]); setOwner('Calin'); setTimeStart(''); setTimeEnd('')
    setAttendees([]); setTranscript(''); setSummary1(''); setSummary2(''); setSummary3('')
    setActionItems([newItem()]); setDecision1(''); setDecision2(''); setDecision3(''); setAiSuccess(false)
  }

  // ── Auto-fill from transcript ──────────────────────────────────────────────

  async function handleAutoFill() {
    if (!transcript.trim()) {
      setToast({ message: 'Paste a transcript first.', type: 'error' })
      return
    }
    setExtracting(true)
    setAiSuccess(false)
    try {
      const res = await fetch('/api/extract-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Extraction failed')

      const d = json.data
      if (d.title)        setTitle(d.title)
      if (d.date)         setDate(d.date)
      if (d.time_start)   setTimeStart(d.time_start)
      if (d.time_end)     setTimeEnd(d.time_end)
      if (d.meeting_type && ['leadership','planning','coaching','education'].includes(d.meeting_type))
        setMeetingType(d.meeting_type as MeetingType)
      if (d.module && MODULES.includes(d.module)) setModule(d.module)
      if (Array.isArray(d.attendees) && d.attendees.length > 0) setAttendees(d.attendees)
      if (d.owner && OWNERS.includes(d.owner)) setOwner(d.owner)
      if (Array.isArray(d.summary)) {
        setSummary1(d.summary[0] ?? '')
        setSummary2(d.summary[1] ?? '')
        setSummary3(d.summary[2] ?? '')
      }
      if (Array.isArray(d.action_items) && d.action_items.length > 0) {
        setActionItems(d.action_items.map((item: { task?: string; owner?: string; due_date?: string; done?: boolean }) => ({
          id: crypto.randomUUID(),
          task: item.task ?? '',
          owner: item.owner ?? '',
          due_date: item.due_date ?? '',
          done: item.done ?? false,
        })))
      }
      if (Array.isArray(d.key_decisions)) {
        setDecision1(d.key_decisions[0] ?? '')
        setDecision2(d.key_decisions[1] ?? '')
        setDecision3(d.key_decisions[2] ?? '')
      }
      setAiSuccess(true)
    } catch (err) {
      console.error('Auto-fill error:', err)
      setToast({ message: 'AI extraction failed. Please try again or fill manually.', type: 'error' })
    } finally {
      setExtracting(false)
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent, isDraft = false) {
    e.preventDefault()

    const cleanDate = sanitizeDate(date) ?? new Date().toISOString().split('T')[0]

    if (!title.trim() || !cleanDate) {
      setToast({ message: 'Meeting title and date are required.', type: 'error' })
      return
    }

    setSaving(true)

    const meeting = {
      id: crypto.randomUUID(),
      title: title.trim(),
      meeting_type: meetingType,
      date: cleanDate,
      owner,
      time_start: timeStart,
      time_end: timeEnd,
      attendees,
      full_transcript: transcript,
      summary: [summary1, summary2, summary3].filter(s => s.trim()),
      key_decisions: [decision1, decision2, decision3].filter(s => s.trim()),
      action_items: actionItems
        .filter(i => i.task.trim())
        .map(i => ({ id: i.id, task: i.task.trim(), owner: i.owner, due_date: sanitizeDate(i.due_date), done: i.done })),
      module,
      ...(isDraft ? { draft: true } : {}),
    }

    const { error } = await createClient().from('meetings').insert(meeting)

    setSaving(false)

    if (error) {
      console.error('Save error:', error)
      setToast({ message: 'Failed to save. Please try again.', type: 'error' })
      return
    }

    setToast({ message: isDraft ? 'Draft saved.' : 'Meeting saved successfully!', type: 'success' })
    window.dispatchEvent(new Event('cask-meeting-saved'))
    router.refresh()
    resetForm()
    closeModal()
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {/* Overlay + Modal */}
      {open && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: exiting ? 'overlayOut 0.2s ease forwards' : 'overlayIn 0.2s ease forwards',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '85vh',
              background: 'var(--surface)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: exiting ? 'modalOut 0.2s ease forwards' : 'modalIn 0.25s ease forwards',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-instrument-serif), Georgia, serif',
                    fontSize: 20,
                    fontWeight: 400,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.3px',
                  }}
                >
                  ✦ Add New Session
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                  All fields marked <span style={{ color: 'var(--red)' }}>*</span> are required
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  lineHeight: 1,
                  transition: 'all 120ms ease',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--surface2)'
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.borderColor = 'var(--border2)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text3)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* ── AI Auto-fill section ──────────────────────────────── */}
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={fieldStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--red)', fontSize: 13 }}>✦</span>
                    Paste Fireflies Transcript
                  </label>
                  <textarea
                    value={transcript}
                    onChange={e => { setTranscript(e.target.value); setAiSuccess(false) }}
                    placeholder="Paste your raw Fireflies transcript here and let AI fill the form automatically..."
                    rows={6}
                    style={{
                      ...inputStyle,
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 12,
                      lineHeight: 1.7,
                      resize: 'vertical',
                    }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                {/* Auto-fill button */}
                <div>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={extracting || !transcript.trim()}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: extracting ? 'var(--text3)' : 'var(--charcoal)',
                      border: 'none',
                      borderRadius: 8,
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: extracting || !transcript.trim() ? 'not-allowed' : 'pointer',
                      opacity: !transcript.trim() ? 0.45 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      transition: 'opacity 150ms ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (!extracting && transcript.trim()) e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { if (!extracting && transcript.trim()) e.currentTarget.style.opacity = '1' }}
                  >
                    {extracting ? (
                      <>
                        <span>✦ Analyzing transcript</span>
                        <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          <span className="thinking-dot" />
                          <span className="thinking-dot" />
                          <span className="thinking-dot" />
                        </span>
                      </>
                    ) : (
                      '✦ Auto-fill with Groq AI'
                    )}
                  </button>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                    AI will extract title, attendees, summary and action items automatically
                  </p>
                </div>

                {/* Success banner */}
                {aiSuccess && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      background: 'var(--green-bg)',
                      border: '1px solid #bbf7d0',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--green)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    ✦ AI extracted the details — please review before saving
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  or fill in manually
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Title — full width */}
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Meeting Title <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. CASK Leadership Meeting"
                  style={inputStyle}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>

              {/* Type + Module */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Type <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    value={meetingType}
                    onChange={e => setMeetingType(e.target.value as MeetingType)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  >
                    {MEETING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Module <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    value={module}
                    onChange={e => setModule(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  >
                    {MODULES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date + Owner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Date <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    key={date || 'date-input'}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    autoComplete="nope"
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Owner</label>
                  <select
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  >
                    {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Time start + end */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Time Start</label>
                  <input
                    type="text"
                    value={timeStart}
                    onChange={e => setTimeStart(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Time End</label>
                  <input
                    type="text"
                    value={timeEnd}
                    onChange={e => setTimeEnd(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>
              </div>

              {/* Attendees */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Attendees</label>
                <AttendeeInput attendees={attendees} onChange={setAttendees} />
              </div>

              {/* Summary */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Summary Points</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    [summary1, setSummary1, 'First key summary point'],
                    [summary2, setSummary2, 'Second key summary point'],
                    [summary3, setSummary3, 'Third key summary point'],
                  ].map(([val, setter, placeholder], i) => (
                    <input
                      key={i}
                      type="text"
                      value={val as string}
                      onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                      placeholder={placeholder as string}
                      style={inputStyle}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  ))}
                </div>
              </div>

              {/* Key Decisions */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Key Decisions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    [decision1, setDecision1, 'First key decision'],
                    [decision2, setDecision2, 'Second key decision'],
                    [decision3, setDecision3, 'Third key decision'],
                  ].map(([val, setter, placeholder], i) => (
                    <input
                      key={i}
                      type="text"
                      value={val as string}
                      onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                      placeholder={placeholder as string}
                      style={inputStyle}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  ))}
                </div>
              </div>

              {/* Action items */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Action Items</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {actionItems.map((item) => (
                    <div
                      key={item.id}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 110px 140px 32px', gap: 8, alignItems: 'center' }}
                    >
                      <input
                        type="text"
                        value={item.task}
                        onChange={e => updateItem(item.id, 'task', e.target.value)}
                        placeholder="Task description"
                        style={{ ...inputStyle, fontSize: 12 }}
                        onFocus={focusInput}
                        onBlur={blurInput}
                      />
                      <input
                        type="text"
                        value={item.owner}
                        onChange={e => updateItem(item.id, 'owner', e.target.value)}
                        placeholder="Owner"
                        style={{ ...inputStyle, fontSize: 12 }}
                        onFocus={focusInput}
                        onBlur={blurInput}
                      />
                      <input
                        type="date"
                        value={item.due_date}
                        onChange={e => updateItem(item.id, 'due_date', e.target.value)}
                        style={{ ...inputStyle, fontSize: 12 }}
                        onFocus={focusInput}
                        onBlur={blurInput}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text3)',
                          fontSize: 18,
                          lineHeight: 1,
                          padding: 0,
                          transition: 'color 120ms ease',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'color 120ms ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
                >
                  <span style={{ fontSize: 15 }}>+</span> Add action item
                </button>
              </div>

            </div>

            {/* Footer — fixed */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                padding: '14px 22px',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
                background: 'var(--surface)',
              }}
            >
              <button
                type="button"
                disabled={saving}
                onClick={e => handleSave(e, true)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border2)',
                  borderRadius: 9,
                  color: 'var(--text2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                  transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  if (!saving) {
                    e.currentTarget.style.background = 'var(--surface2)'
                    e.currentTarget.style.borderColor = 'var(--border2)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border2)'
                }}
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={e => handleSave(e, false)}
                style={{
                  flex: 2,
                  padding: '10px 16px',
                  background: 'var(--red)',
                  border: 'none',
                  borderRadius: 9,
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  transition: 'opacity 150ms ease, transform 80ms ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.88' }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.opacity = '1' }}
                onMouseDown={e => { if (!saving) e.currentTarget.style.transform = 'scale(0.98)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {saving ? 'Saving…' : 'Save Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Shared input styles ───────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text2)',
}

const inputStyle: React.CSSProperties = {
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
}

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border2)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)'
}

function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border)'
  e.currentTarget.style.boxShadow = 'none'
}
