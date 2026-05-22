'use client'
// src/app/(app)/customers/new/page.tsx

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_TYPES = ['Custom Home', 'ADU', 'Detached Garage', 'Other']
const OWNERS = ['Jeff', 'Chad', 'Calin', 'Rovern', 'Kai']
const HAPPINESS_OPTIONS = [
  { value: 'green', emoji: '🟢', label: 'Happy', accent: '#16a34a', border: '#16a34a', bg: '#F0FDF4' },
  { value: 'yellow', emoji: '🟡', label: 'At Risk', accent: '#d97706', border: '#d97706', bg: '#FFFBEB' },
  { value: 'red', emoji: '🔴', label: 'Needs Attention', accent: '#dc2626', border: '#dc2626', bg: '#FDF2F0' },
] as const

const ALL_TAGS = [
  'Verbal communicator', 'Direct', 'Detail-oriented', 'Analytical',
  'Visual learner', 'Budget-focused', 'Fast decision maker',
  'Slow processor', 'Needs reassurance', 'Email communicator',
  'Relationship-driven', 'Skeptical',
]

const DEFAULT_MEETINGS = [
  'First In-Person Sales Meeting',
  'Budget & Financing Discussion',
  'Floor Plan Selection',
  'Design Center Walkthrough',
  'Contract Signing',
  'Pre-Construction Meeting',
  'Foundation Review',
  'Framing Walkthrough',
]

const DEFAULT_PRIORITIES = [
  'Budget alignment',
  'Financing confirmed',
  'Floor plan approved',
  'Design alignment',
  'Contract signed',
]

type PriorityStatus = 'Unresolved' | 'In Progress' | 'Done'

interface PriorityRow {
  id: string
  text: string
  status: PriorityStatus
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2700)
    const t2 = setTimeout(onDone, 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  const ok = type === 'success'
  return (
    <div
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 10001,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 10,
        background: ok ? 'var(--green-bg)' : 'var(--red-soft)',
        border: `1px solid ${ok ? '#bbf7d0' : 'var(--red-border)'}`,
        color: ok ? 'var(--green)' : 'var(--red)',
        fontSize: 13, fontWeight: 500,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        animation: exiting ? 'toastOut 0.3s ease forwards' : 'toastIn 0.25s ease forwards',
        maxWidth: 340, fontFamily: 'inherit',
      }}
    >
      {ok ? (
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

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderLeft: '3px solid var(--red, #c8311a)',
        paddingLeft: 20,
        marginBottom: 28,
      }}
    >
      <div
        className="text-[11px] font-semibold tracking-[1.2px] uppercase mb-4"
        style={{ color: 'var(--red, #c8311a)' }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Shared input styles ───────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text2)' }

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
  boxSizing: 'border-box',
}

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border2)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)'
}

function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border)'
  e.currentTarget.style.boxShadow = 'none'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewClientSetupPage() {
  const router = useRouter()

  // Client details
  const [name, setName]               = useState('')
  const [projectType, setProjectType] = useState('Custom Home')
  const [projectValue, setProjectValue] = useState('')
  const [location, setLocation]       = useState('')
  const [startDate, setStartDate]     = useState('')
  const [owner, setOwner]             = useState('Jeff')

  // Happiness
  const [happiness, setHappiness] = useState<'green' | 'yellow' | 'red'>('green')

  // Personality
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [commStyle, setCommStyle]       = useState('')
  const [keyInterests, setKeyInterests] = useState('')

  // Priorities
  const [priorities, setPriorities] = useState<PriorityRow[]>(
    DEFAULT_PRIORITIES.map(text => ({ id: crypto.randomUUID(), text, status: 'Unresolved' as PriorityStatus }))
  )

  // UI
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function addPriority() {
    setPriorities(prev => [...prev, { id: crypto.randomUUID(), text: '', status: 'Unresolved' }])
  }

  function removePriority(id: string) {
    setPriorities(prev => prev.filter(p => p.id !== id))
  }

  function updatePriority(id: string, field: 'text' | 'status', value: string) {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setToast({ message: 'Client name is required.', type: 'error' })
      return
    }

    setSaving(true)
    const supabase = createClient()
    const clientId = crypto.randomUUID()

    try {
      // 1. Insert client
      const { error: clientError } = await supabase.from('clients').insert({
        id: clientId,
        name: name.trim(),
        project_type: projectType,
        project_value: projectValue ? Number(projectValue) : null,
        location: location.trim() || null,
        start_date: startDate || null,
        owner,
        happiness,
        personality_tags: selectedTags,
        communication_style: commStyle.trim() || null,
        key_interests: keyInterests.trim() || null,
        meetings_completed: 0,
        total_meetings: 40,
      })

      if (clientError) throw new Error(clientError.message)

      // 2. Insert priorities
      const priorityRows = priorities
        .filter(p => p.text.trim())
        .map((p, i) => ({
          id: crypto.randomUUID(),
          client_id: clientId,
          text: p.text.trim(),
          status: p.status.toLowerCase().replace(' ', '_'),
          sort_order: i,
        }))

      if (priorityRows.length > 0) {
        const { error: priError } = await supabase.from('client_priorities').insert(priorityRows)
        if (priError) console.warn('Priority insert warning:', priError.message)
      }

      // 3. Insert standard meetings
      const meetingRows = DEFAULT_MEETINGS.map((title, i) => ({
        id: crypto.randomUUID(),
        client_id: clientId,
        number: i + 1,
        title,
        completed: false,
      }))

      const { error: meetError } = await supabase.from('client_meetings').insert(meetingRows)
      if (meetError) console.warn('Meeting insert warning:', meetError.message)

      // 4. Success
      setToast({ message: 'Client created successfully!', type: 'success' })
      setTimeout(() => router.push(`/customers/${clientId}`), 1200)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setToast({ message: msg, type: 'error' })
      setSaving(false)
    }
  }, [name, projectType, projectValue, location, startDate, owner, happiness, selectedTags, commStyle, keyInterests, priorities, router])

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <TopBar title="New Client Setup" subtitle="Customer Journey" />

      <div className="flex-1 overflow-y-auto animate-page-in">
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 32px 80px' }}>

          {/* Back link */}
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-5 no-underline transition-colors duration-150 hover:text-[var(--text)]"
            style={{ color: 'var(--text3)' }}
          >
            ← Active Clients
          </Link>

          {/* Page title */}
          <h1
            className="font-serif text-[30px] font-normal tracking-[-0.4px] leading-[1.15]"
            style={{ color: 'var(--text)', margin: '0 0 6px' }}
          >
            New Client Setup
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 36px' }}>
            Create a new client folder with all standard meetings pre-loaded
          </p>

          <form onSubmit={handleSubmit}>

            {/* ── Section 1: Client Details ─────────────────────────────── */}
            <Section title="Client Details">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Client Name <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. John Smith"
                    required
                    style={{ ...inputStyle, fontSize: 15, padding: '11px 14px', fontWeight: 500 }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                {/* Project type + Value */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Project Type</label>
                    <select
                      value={projectType}
                      onChange={e => setProjectType(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    >
                      {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Project Value</label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                          fontSize: 13, color: 'var(--text3)', pointerEvents: 'none',
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        value={projectValue}
                        onChange={e => setProjectValue(e.target.value)}
                        placeholder="485000"
                        style={{ ...inputStyle, paddingLeft: 24 }}
                        onFocus={focusInput}
                        onBlur={blurInput}
                      />
                    </div>
                  </div>
                </div>

                {/* Location + Start date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. St. Petersburg, FL"
                      style={inputStyle}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={inputStyle}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  </div>
                </div>

                {/* Owner */}
                <div style={{ ...fieldStyle, maxWidth: 220 }}>
                  <label style={labelStyle}>Owner</label>
                  <select
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  >
                    {OWNERS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* ── Section 2: Client Happiness ───────────────────────────── */}
            <Section title="Client Happiness">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {HAPPINESS_OPTIONS.map(opt => {
                  const active = happiness === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setHappiness(opt.value)}
                      style={{
                        padding: '14px 12px',
                        borderRadius: 10,
                        border: `2px solid ${active ? opt.border : 'var(--border)'}`,
                        background: active ? opt.bg : 'var(--bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'border-color 150ms ease, background 150ms ease',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: active ? opt.accent : 'var(--text2)',
                          transition: 'color 150ms ease',
                        }}
                      >
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>

            {/* ── Section 3: Personality & Communication ────────────────── */}
            <Section title="Personality & Communication">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Tag chips */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Personality Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {ALL_TAGS.map(tag => {
                      const active = selectedTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 500,
                            border: `1px solid ${active ? 'var(--charcoal)' : 'var(--border)'}`,
                            background: active ? 'var(--charcoal)' : 'transparent',
                            color: active ? 'white' : 'var(--text2)',
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                            fontFamily: 'inherit',
                          }}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Communication style */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Communication Style</label>
                  <textarea
                    value={commStyle}
                    onChange={e => setCommStyle(e.target.value)}
                    placeholder="How does this client prefer to communicate? What's their style?"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                {/* Key interests */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Key Interests</label>
                  <textarea
                    value={keyInterests}
                    onChange={e => setKeyInterests(e.target.value)}
                    placeholder="e.g. Tampa Bay Rays fan, loves modern design, rental income potential"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>
              </div>
            </Section>

            {/* ── Section 4: Key Priorities ─────────────────────────────── */}
            <Section title="Key Priorities">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {priorities.map((p, i) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 32px', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={p.text}
                      onChange={e => updatePriority(p.id, 'text', e.target.value)}
                      placeholder={`Priority ${i + 1}`}
                      style={{ ...inputStyle, fontSize: 13 }}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                    <select
                      value={p.status}
                      onChange={e => updatePriority(p.id, 'status', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer', fontSize: 12 }}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    >
                      <option>Unresolved</option>
                      <option>In Progress</option>
                      <option>Done</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removePriority(p.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text3)', fontSize: 18, lineHeight: 1,
                        padding: 0, transition: 'color 120ms ease', fontFamily: 'inherit',
                        textAlign: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPriority}
                  style={{
                    marginTop: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: 12, fontWeight: 500,
                    padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                    transition: 'color 120ms ease', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}
                >
                  <span style={{ fontSize: 15 }}>+</span> Add priority
                </button>
              </div>

              {/* Standard meetings note */}
              <div
                className="mt-4 rounded-[8px] p-3.5"
                style={{
                  background: 'var(--surface2, #f5f5f5)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="text-[11px] font-semibold tracking-[0.6px] uppercase mb-2"
                  style={{ color: 'var(--text3)' }}
                >
                  8 Standard Meetings Auto-created
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DEFAULT_MEETINGS.map((m, i) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 11, fontWeight: 500,
                        color: 'var(--text3)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {i + 1}. {m}
                    </span>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── Buttons ───────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: saving ? 'var(--text3)' : 'var(--charcoal)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'opacity 150ms ease',
                  fontFamily: 'inherit',
                  letterSpacing: '-0.1px',
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.opacity = '1' }}
              >
                {saving ? 'Creating Client…' : 'Create Client'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <Link
                  href="/customers"
                  style={{
                    fontSize: 13,
                    color: 'var(--text3)',
                    textDecoration: 'none',
                    fontFamily: 'inherit',
                    transition: 'color 120ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}
                >
                  Cancel
                </Link>
              </div>
            </div>

          </form>
        </div>
      </div>
    </>
  )
}
