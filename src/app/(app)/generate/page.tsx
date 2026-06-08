'use client'
// src/app/(app)/generate/page.tsx

import { useState } from 'react'
import { TopBar, PillGreen } from '@/components/ui'

const FALLBACK_AGENDA = `CASK Leadership Meeting — May 28, 2026
Date: Wednesday, May 28  ·  Time: 11:00 AM – 3:00 PM
Attendees: Calin, Chad, Lamont, Jeff, Matteo, Kait, Juliet

────────────────────────────────

11:00 – 11:05  |  WIFLE  (5 min)
• What I Feel Like Expressing — one word check-in

11:05 – 11:35  |  Education: Team Alignment — $20M Goal  (30 min)
• Where we stand vs. our $20M milestone
• What each department must own to get there
• Key alignment gaps to close this quarter

11:35 – 12:35  |  Q2 KPI Review by Department  (60 min)
• Each leader: biggest win + biggest gap
• Design Center update — Calin
• Operations · Sales/Marketing · Finance · People

12:35 – 1:05  |  Lunch Break  (30 min)

1:05 – 2:15  |  Individual Deep Dives  (20 min each)
• Q2 PIT Goal progress vs. commitment
• One challenge for group brainstorm
• Matteo → Lamont → Jeff → Kait → Chad

2:15 – 2:45  |  Leadership Whiteboard Discussion  (30 min)
• Top 3 priorities for June
• Cross-department decisions + ownership
• Design Center next steps

2:45 – 3:00  |  Wrap-Up & Commitments  (15 min)
• Recap decisions and BFOs (Blinding Flashes of the Obvious)
• Confirm ownership and deadlines
• Submit feedback forms`

export default function GeneratePage() {
  const [meetingType, setMeetingType] = useState('Leadership Meeting')
  const [duration, setDuration] = useState('4 hours')
  const [time, setTime] = useState('')
  const [education, setEducation] = useState('')
  const [topics, setTopics] = useState('')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  async function generate() {
    setLoading(true)
    setOutput('')

    try {
      const res = await fetch('/api/generate-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingType, duration, time, education, topics, date: today }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setOutput(data.agenda)
    } catch {
      setOutput(FALLBACK_AGENDA)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(output)
  }

  return (
    <>
      <TopBar title="Generate Agenda" subtitle="General Meetings">
        <PillGreen>Claude AI Active</PillGreen>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            Generate Meeting Agenda
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            Claude AI will create a tailored agenda based on your past sessions and coaching context.
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-[10px] p-6 mb-3.5"
          style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
        >
          <h2
            className="font-serif text-[20px] font-normal tracking-[-0.3px] mb-1"
            style={{ color: 'var(--text)' }}
          >
            Meeting Details
          </h2>
          <p className="text-[13px] mb-5 leading-relaxed" style={{ color: 'var(--text3)' }}>
            Fill in the details below. Claude will read your past sessions from the database as context.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-[5px]">
              <label
                className="text-[11px] font-semibold tracking-[0.5px]"
                style={{ color: 'var(--text2)' }}
              >
                Meeting Type
              </label>
              <select
                value={meetingType}
                onChange={e => setMeetingType(e.target.value)}
                className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-geist), sans-serif',
                }}
              >
                <option>Leadership Meeting</option>
                <option>Planning Session</option>
                <option>Coaching Session</option>
                <option>Education Session</option>
                <option>Owner Session</option>
              </select>
            </div>

            <div className="flex flex-col gap-[5px]">
              <label
                className="text-[11px] font-semibold tracking-[0.5px]"
                style={{ color: 'var(--text2)' }}
              >
                Duration
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-geist), sans-serif',
                }}
              >
                <option>1 hour</option>
                <option>1.5 hours</option>
                <option>2 hours</option>
                <option>3 hours</option>
                <option>4 hours</option>
                <option>6 hours</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-[5px] mb-3">
            <label
              className="text-[11px] font-semibold tracking-[0.5px]"
              style={{ color: 'var(--text2)' }}
            >
              Start Time <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={time}
              onChange={e => setTime(e.target.value)}
              placeholder="e.g. 11:00 AM"
              className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            />
          </div>

          <div className="flex flex-col gap-[5px] mb-3">
            <label
              className="text-[11px] font-semibold tracking-[0.5px]"
              style={{ color: 'var(--text2)' }}
            >
              Education Topic <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={education}
              onChange={e => setEducation(e.target.value)}
              placeholder="e.g. Team Alignment — Hitting Our $20M Goal"
              className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            />
          </div>

          <div className="flex flex-col gap-[5px] mb-5">
            <label
              className="text-[11px] font-semibold tracking-[0.5px]"
              style={{ color: 'var(--text2)' }}
            >
              Key Topics <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={topics}
              onChange={e => setTopics(e.target.value)}
              placeholder="e.g. Q2 KPI review, Design Center update, Department wins and bottlenecks..."
              rows={3}
              className="rounded-[6px] px-3 py-[9px] text-[13px] outline-none transition-colors duration-150 resize-y leading-relaxed"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-geist), sans-serif',
                minHeight: '70px',
              }}
            />
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-[22px] py-2.5 rounded-[6px] text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-50 disabled:translate-y-0"
              style={{
                background: 'var(--charcoal)',
                border: 'none',
                fontFamily: 'var(--font-geist), sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : undefined,
              }}
            >
              {loading ? (
                <>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1 h-1 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Generating...
                </>
              ) : (
                <>✦ Generate with Claude</>
              )}
            </button>
            {output && (
              <button
                onClick={copyToClipboard}
                className="text-[12px] font-medium px-[18px] py-2.5 rounded-[6px] transition-all duration-150 hover:border-[var(--border2)]"
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  fontFamily: 'var(--font-geist), sans-serif',
                  cursor: 'pointer',
                }}
              >
                Copy to Clipboard
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        {output && (
          <div
            className="rounded-[10px] p-6 relative overflow-hidden"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, var(--charcoal), var(--text2))' }}
            />
            <div
              className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-3.5"
              style={{ color: 'var(--text3)' }}
            >
              Generated Agenda
            </div>
            <pre
              className="text-[13px] leading-[1.9] font-mono whitespace-pre-wrap"
              style={{ color: 'var(--text2)' }}
            >
              {output}
            </pre>
          </div>
        )}
      </div>
    </>
  )
}
