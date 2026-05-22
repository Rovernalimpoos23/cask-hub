'use client'
// src/app/(app)/customers/templates/page.tsx

import Link from 'next/link'
import { useState } from 'react'
import { TopBar } from '@/components/ui'

// ── Data ──────────────────────────────────────────────────────────────────────

const PHASES = [
  {
    number: 1,
    label: 'Preconstruction',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    meetings: [
      'Pre-Design',
      'Design',
      'Permit',
      'Selections',
      'Bid Management',
    ],
    startIndex: 1,
  },
  {
    number: 2,
    label: 'Foundation & Framing',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    meetings: [
      'Foundation Pour Review',
      'Framing Walkthrough',
      'Electrical Rough-in Review',
      'Plumbing Rough-in Review',
      'HVAC Rough-in Review',
      'Insulation Review',
      'Drywall Walkthrough',
      'Paint & Finishes Selection',
    ],
    startIndex: 9,
  },
  {
    number: 3,
    label: 'Interior & Finishes',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    meetings: [
      'Flooring Installation Review',
      'Cabinet & Countertop Review',
      'Fixture Selection Meeting',
      'Tile & Backsplash Review',
      'Appliance Selection Meeting',
      'Trim & Millwork Review',
      'Lighting Review',
      'Interior Paint Final Review',
    ],
    startIndex: 17,
  },
  {
    number: 4,
    label: 'Exterior & Landscaping',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    meetings: [
      'Exterior Paint Review',
      'Roofing Final Inspection',
      'Driveway & Walkway Review',
      'Landscaping Plan Meeting',
      'Pool & Outdoor Living Review',
      'Fence & Gate Review',
      'Garage Door & Entry Review',
      'Exterior Final Walkthrough',
    ],
    startIndex: 25,
  },
  {
    number: 5,
    label: 'Closeout & Handover',
    color: '#c8311a',
    bgColor: '#fdf2f0',
    borderColor: '#f5c9c2',
    meetings: [
      'Punch List Walkthrough',
      'Final Inspection Meeting',
      'Utility Connection Review',
      'Certificate of Occupancy Meeting',
      'Final Cleaning Review',
      'Furniture & Staging Meeting',
      'Client Orientation & Handover',
      '30-Day Follow-up Meeting',
    ],
    startIndex: 33,
  },
]

const STATS = [
  { value: '40', label: 'Total Meetings' },
  { value: '5', label: 'Phases' },
  { value: '~12', label: 'Months Avg' },
  { value: '100%', label: 'Consistent' },
]

// ── Phase accordion ───────────────────────────────────────────────────────────

function PhaseBlock({ phase }: { phase: typeof PHASES[number] }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ border: `1px solid ${phase.borderColor}` }}
    >
      {/* Phase header — clickable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{
          background: phase.bgColor,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {/* Phase number badge */}
        <div
          className="flex items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0"
          style={{ width: 26, height: 26, background: phase.color }}
        >
          {phase.number}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px] font-semibold tracking-[-0.1px]"
            style={{ color: phase.color }}
          >
            Phase {phase.number} — {phase.label}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: phase.color, opacity: 0.65 }}
          >
            Meetings {phase.startIndex}–{phase.startIndex + phase.meetings.length - 1}
          </div>
        </div>

        {/* Meeting count chip */}
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: phase.color, color: '#fff', opacity: 0.85 }}
        >
          {phase.meetings.length} meetings
        </span>

        {/* Chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={phase.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transition: 'transform 200ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            opacity: 0.7,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Meeting rows */}
      {open && (
        <div style={{ background: 'var(--white)', borderTop: `1px solid ${phase.borderColor}` }}>
          {phase.meetings.map((title, i) => {
            const num = phase.startIndex + i
            return (
              <div
                key={num}
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  borderBottom: i < phase.meetings.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Number */}
                <div
                  className="text-[11px] font-semibold w-6 text-center shrink-0"
                  style={{ color: 'var(--text3)' }}
                >
                  {num}
                </div>

                {/* Title */}
                <span
                  className="flex-1 text-[13px] font-medium"
                  style={{ color: 'var(--text)' }}
                >
                  {title}
                </span>

                {/* View Agenda button */}
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
                  style={{
                    background: phase.bgColor,
                    color: phase.color,
                    border: `1px solid ${phase.borderColor}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  View Agenda
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientTemplatesPage() {
  return (
    <>
      <TopBar title="Client Templates" subtitle="Customer Journey" />

      <div className="flex-1 overflow-y-auto animate-page-in">
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 32px 80px' }}>

          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 mb-7"
          >
            <div>
              <h1
                className="font-serif text-[30px] font-normal tracking-[-0.4px] leading-[1.15]"
                style={{ color: 'var(--text)', margin: '0 0 6px' }}
              >
                Client Templates
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, maxWidth: 520 }}>
                Standard workflow for every CASK Construction client — 40 meetings from first contact to closeout
              </p>
            </div>

            <Link
              href="/customers/new"
              className="no-underline shrink-0"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: 'var(--red, #c8311a)',
                padding: '9px 16px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
                marginTop: 4,
              }}
            >
              + New Client
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-7">
            {STATS.map(s => (
              <div
                key={s.label}
                className="rounded-[10px] p-4 text-center"
                style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
              >
                <div
                  className="text-[22px] font-semibold tracking-[-0.5px] mb-0.5"
                  style={{ color: 'var(--text)' }}
                >
                  {s.value}
                </div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Phase accordions */}
          <div className="flex flex-col gap-3 mb-10">
            {PHASES.map(phase => (
              <PhaseBlock key={phase.number} phase={phase} />
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/customers/new"
            className="no-underline flex items-center justify-center gap-2 w-full py-4 rounded-[10px] text-[15px] font-semibold text-white transition-opacity"
            style={{
              background: 'var(--red, #c8311a)',
              boxShadow: '0 4px 16px rgba(200,49,26,0.25)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            Duplicate for New Client →
          </Link>

        </div>
      </div>
    </>
  )
}
