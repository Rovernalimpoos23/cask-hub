'use client'
// src/app/(app)/sessions/new/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar, SectionLabel } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import type { MeetingType } from '@/types'

interface ActionItemForm {
  id: string
  task: string
  owner: string
  due_date: string
  done: boolean
}

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

const OWNERS = ['Calin', 'Chad', 'Kai', 'Rovern', 'Lamont', 'Jeff', 'Kait', 'Matteo']

function newItem(): ActionItemForm {
  return { id: crypto.randomUUID(), task: '', owner: '', due_date: '', done: false }
}

export default function AddMeetingPage() {
  const router = useRouter()

  // Form fields
  const [title, setTitle]           = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType>('leadership')
  const [module, setModule]         = useState('ActionCOACH')
  const [date, setDate]             = useState('')
  const [owner, setOwner]           = useState('Calin')
  const [timeStart, setTimeStart]   = useState('')
  const [timeEnd, setTimeEnd]       = useState('')
  const [attendees, setAttendees]   = useState('')
  const [transcript, setTranscript] = useState('')
  const [summary1, setSummary1]     = useState('')
  const [summary2, setSummary2]     = useState('')
  const [summary3, setSummary3]     = useState('')
  const [actionItems, setActionItems] = useState<ActionItemForm[]>([newItem(), newItem(), newItem()])

  // UI state
  const [saving, setSaving]   = useState(false)
  const [status, setStatus]   = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Action item helpers
  function addItem() { setActionItems(p => [...p, newItem()]) }
  function removeItem(id: string) { setActionItems(p => p.filter(i => i.id !== id)) }
  function updateItem(id: string, field: keyof ActionItemForm, value: string | boolean) {
    setActionItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('idle')
    setErrorMsg('')

    if (!title.trim() || !date) {
      setErrorMsg('Meeting title and date are required.')
      setStatus('error')
      return
    }

    setSaving(true)

    const meeting = {
      id: crypto.randomUUID(),
      title: title.trim(),
      meeting_type: meetingType,
      date,
      owner,
      time_start: timeStart,
      time_end: timeEnd,
      attendees: attendees.split(',').map(a => a.trim()).filter(Boolean),
      full_transcript: transcript,
      summary: [summary1, summary2, summary3].filter(s => s.trim()),
      key_decisions: [] as string[],
      action_items: actionItems
        .filter(i => i.task.trim())
        .map(i => ({ id: i.id, task: i.task.trim(), owner: i.owner, due_date: i.due_date, done: i.done })),
      module,
    }

    let saved = false

    // 1️⃣ Try Supabase
    try {
      const { error } = await createClient().from('meetings').insert(meeting)
      if (!error) saved = true
    } catch { /* fall through */ }

    // 2️⃣ localStorage fallback
    if (!saved) {
      try {
        const existing: unknown[] = JSON.parse(localStorage.getItem('cask_meetings') ?? '[]')
        existing.push(meeting)
        localStorage.setItem('cask_meetings', JSON.stringify(existing))
        saved = true
      } catch { /* both failed */ }
    }

    setSaving(false)

    if (saved) {
      setStatus('success')
      setTimeout(() => router.push('/sessions'), 1500)
    } else {
      setStatus('error')
      setErrorMsg('Failed to save meeting. Please try again.')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Add Meeting" subtitle="ActionCOACH" />

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <h1
          className="font-serif text-[28px] font-normal tracking-[-0.01em] mb-3"
          style={{ color: 'var(--text)' }}
        >
          Add New Session
        </h1>
        <p className="text-[12px] mb-6" style={{ color: 'var(--text3)' }}>
          Tip: You can also add meetings using the{' '}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('cask-open-add-modal'))}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--red)',
              fontSize: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            + button
          </button>{' '}
          on any page.
        </p>

        <form onSubmit={handleSave} noValidate>
          <div className="max-w-3xl flex flex-col gap-4">

            {/* ── Main fields card ── */}
            <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

              {/* Row 1 — Title + Type */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="field">
                  <label className="field-label">
                    Meeting Title <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. CASK Leadership Meeting"
                    className="field-input"
                  />
                </div>
                <div className="field">
                  <label className="field-label">
                    Meeting Type <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    value={meetingType}
                    onChange={e => setMeetingType(e.target.value as MeetingType)}
                    className="field-input"
                  >
                    {MEETING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 1b — Module */}
              <div className="field mb-4">
                <label className="field-label">
                  Module <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <select
                  value={module}
                  onChange={e => setModule(e.target.value)}
                  className="field-input"
                >
                  {MODULES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Row 2 — Date + Owner */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="field">
                  <label className="field-label">
                    Date <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Owner</label>
                  <select
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    className="field-input"
                  >
                    {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3 — Times */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="field">
                  <label className="field-label">Time Start</label>
                  <input
                    type="text"
                    value={timeStart}
                    onChange={e => setTimeStart(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    className="field-input"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Time End</label>
                  <input
                    type="text"
                    value={timeEnd}
                    onChange={e => setTimeEnd(e.target.value)}
                    placeholder="e.g. 2:00 PM"
                    className="field-input"
                  />
                </div>
              </div>

              {/* Row 4 — Attendees */}
              <div className="field mb-4">
                <label className="field-label">
                  Attendees{' '}
                  <span className="text-[11px] font-normal" style={{ color: 'var(--text3)' }}>
                    — comma separated
                  </span>
                </label>
                <input
                  type="text"
                  value={attendees}
                  onChange={e => setAttendees(e.target.value)}
                  placeholder="e.g. Calin, Chad, Lamont, Jeff, Kait, Juliet"
                  className="field-input"
                />
              </div>

              {/* Row 5 — Transcript */}
              <div className="field mb-4">
                <label className="field-label">Full Transcript</label>
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="Paste the raw Fireflies transcript here..."
                  rows={10}
                  className="field-input field-textarea"
                />
              </div>

              {/* Row 6 — Summary */}
              <div className="field">
                <label className="field-label">Summary Points</label>
                <div className="flex flex-col gap-2 mt-1">
                  <input
                    type="text"
                    value={summary1}
                    onChange={e => setSummary1(e.target.value)}
                    placeholder="First key summary point"
                    className="field-input"
                  />
                  <input
                    type="text"
                    value={summary2}
                    onChange={e => setSummary2(e.target.value)}
                    placeholder="Second key summary point"
                    className="field-input"
                  />
                  <input
                    type="text"
                    value={summary3}
                    onChange={e => setSummary3(e.target.value)}
                    placeholder="Third key summary point"
                    className="field-input"
                  />
                </div>
              </div>
            </div>

            {/* ── Action Items card ── */}
            <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div
                className="text-[11px] font-semibold tracking-[1.2px] uppercase mb-4"
                style={{ color: 'var(--text3)' }}
              >
                Action Items
              </div>

              {/* Column headers */}
              <div
                className="grid mb-2"
                style={{ gridTemplateColumns: '1fr 130px 160px 50px 32px', gap: '8px' }}
              >
                {['Task', 'Owner', 'Due Date', 'Done', ''].map(h => (
                  <span key={h} className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}>{h}</span>
                ))}
              </div>

              <div className="flex flex-col gap-2.5">
                {actionItems.map(item => (
                  <div
                    key={item.id}
                    className="grid items-center"
                    style={{ gridTemplateColumns: '1fr 130px 160px 50px 32px', gap: '8px' }}
                  >
                    <input
                      type="text"
                      value={item.task}
                      onChange={e => updateItem(item.id, 'task', e.target.value)}
                      placeholder="e.g. Prepare May 28th agenda"
                      className="field-input"
                    />
                    <input
                      type="text"
                      value={item.owner}
                      onChange={e => updateItem(item.id, 'owner', e.target.value)}
                      placeholder="Owner"
                      className="field-input"
                    />
                    <input
                      type="date"
                      value={item.due_date}
                      onChange={e => updateItem(item.id, 'due_date', e.target.value)}
                      className="field-input"
                    />
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={e => updateItem(item.id, 'done', e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--charcoal)' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="remove-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addItem}
                className="add-item-btn"
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                Add another action item
              </button>
            </div>

            {/* ── Status messages ── */}
            {status === 'success' && (
              <div
                className="px-4 py-3 rounded-lg text-[13px] font-medium flex items-center gap-2"
                style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #bbf7d0' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Meeting saved successfully! Redirecting…
              </div>
            )}
            {status === 'error' && (
              <div
                className="px-4 py-3 rounded-lg text-[13px] font-medium"
                style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
              >
                {errorMsg}
              </div>
            )}

            {/* ── Submit buttons ── */}
            <div className="flex flex-col gap-2 pb-4">
              <button
                type="submit"
                disabled={saving}
                className="save-btn"
              >
                {saving ? 'Saving…' : 'Save Meeting'}
              </button>
              <Link
                href="/sessions"
                className="cancel-btn"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        /* Field layout */
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 12px; font-weight: 500; color: var(--text2); }

        /* Inputs */
        .field-input {
          width: 100%;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          color: var(--text);
          outline: none;
          font-family: inherit;
          transition: border-color 150ms ease, box-shadow 150ms ease;
          -webkit-font-smoothing: antialiased;
        }
        .field-input:focus {
          border-color: var(--border2);
          box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
        }
        .field-input::placeholder { color: var(--text3); }
        select.field-input { cursor: pointer; }
        .field-textarea {
          resize: vertical;
          font-family: var(--font-geist-mono, monospace);
          font-size: 12px;
          line-height: 1.75;
          min-height: 180px;
        }

        /* Action item buttons */
        .remove-btn {
          font-size: 18px;
          line-height: 1;
          color: var(--text3);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: color 120ms ease;
          font-family: inherit;
        }
        .remove-btn:hover { color: var(--red); }

        .add-item-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 14px;
          padding: 0;
          font-size: 12px;
          font-weight: 500;
          color: var(--text3);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 150ms ease;
          font-family: inherit;
        }
        .add-item-btn:hover { color: var(--text); }

        /* Submit */
        .save-btn {
          width: 100%;
          padding: 12px;
          background: var(--charcoal);
          color: white;
          font-size: 14px;
          font-weight: 600;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 150ms ease, transform 80ms ease;
          -webkit-font-smoothing: antialiased;
        }
        .save-btn:hover:not(:disabled) { opacity: 0.88; }
        .save-btn:active:not(:disabled) { transform: scale(0.995); }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cancel-btn {
          display: block;
          width: 100%;
          padding: 11px;
          background: none;
          border: 1px solid var(--border);
          border-radius: 9px;
          color: var(--text2);
          font-size: 14px;
          font-weight: 500;
          text-align: center;
          text-decoration: none;
          font-family: inherit;
          transition: border-color 150ms ease, background 150ms ease;
        }
        .cancel-btn:hover {
          background: var(--surface2);
          border-color: var(--border2);
        }
      `}</style>
    </div>
  )
}
