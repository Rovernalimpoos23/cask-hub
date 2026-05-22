'use client'
// src/app/(app)/customers/templates/page.tsx

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/ui'

// ── Data ──────────────────────────────────────────────────────────────────────

type MeetingEntry = string | { code: string; title: string; type: 'meeting' | 'email'; agenda?: string[] }

interface Phase {
  number: number
  label: string
  color: string
  bgColor: string
  borderColor: string
  note?: string
  meetings: MeetingEntry[]
  startIndex: number
}

const PHASES: Phase[] = [
  {
    number: 1,
    label: 'Pre-Construction Pre-Design',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    meetings: [
      {
        code: 'PR1m',
        title: 'Internal Sales to Pre-Con Pass-Off',
        type: 'meeting',
        agenda: [
          'Customer Introduction',
          'Topographic Survey and Plans',
          'Customer Avatar',
          'ADU Checklist',
          'Property Analysis',
          'NPS Survey Handout',
        ],
      },
      {
        code: 'PR2e',
        title: 'Initial Alignment Scheduling to Customer',
        type: 'email',
      },
      {
        code: 'PR3m',
        title: 'Initial Alignment Meeting Agenda',
        type: 'meeting',
        agenda: [
          'Purpose: Review project expectations, budget alignment, site limitations, communication flow',
          'Project Timeline: Design 2-3 months, Permitting 2-3 months, Construction 4-7 months',
          'Floor Plan & Design Ideas',
          'Interior Design & Layout',
          'Mechanical & Utility Options',
          'Exterior & Structural Features',
          'Scheduling & Coordination',
          'Customer Goal',
          'NPS Survey Handout',
        ],
      },
      {
        code: 'PR4e',
        title: 'Alignment Meeting Recap to Customer',
        type: 'email',
      },
      {
        code: 'PR5m',
        title: 'On Site Flag with Customer',
        type: 'meeting',
        agenda: [
          'Welcome & Introductions',
          'Project Footprint Walkthrough',
          'Utility Location Review',
          'Next Steps',
          'Q&A / Customer Feedback',
          'NPS Survey Handout',
        ],
      },
      {
        code: 'PR6e',
        title: 'Flag Meeting Recap to Customer',
        type: 'email',
      },
    ],
    startIndex: 1,
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
    startIndex: 7,
  },
  {
    number: 3,
    label: 'Pre-Construction Permit',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    note: 'This phase is fully automated — all items are email templates sent to the customer during the permitting process.',
    meetings: [
      { code: 'PP1e', title: '1st RFC to Customer', type: 'email' },
      { code: 'PP2e', title: '1st RFC to Customer', type: 'email' },
      { code: 'PP3e', title: '2nd RFC to Customer', type: 'email' },
      { code: 'PP4e', title: '2nd RFC to Customer', type: 'email' },
      { code: 'PP5e', title: 'Permit Approval', type: 'email' },
    ],
    startIndex: 14,
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
    ],
    startIndex: 22,
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
    startIndex: 30,
  },
]

const STATS = [
  { value: '33', label: 'Total Items' },
  { value: '11', label: 'Meetings (M)' },
  { value: '22', label: 'Email Templates (E)' },
  { value: '5', label: 'Phases' },
]

// ── Agenda modal data ─────────────────────────────────────────────────────────

interface AgendaItem {
  text: string
  sub?: string[]
}

interface AgendaSection {
  title?: string
  numbered?: boolean
  items: (string | AgendaItem)[]
}

interface AgendaContent {
  header: string
  subheader: string
  sections: AgendaSection[]
  nps?: boolean
}

const NPS_QUESTIONS = [
  'How happy are you on a scale of 1-10?',
  'How do you feel our communication has been?',
  'How is the pace of the construction journey going?',
  'What could we improve or what made your journey enjoyable?',
]

const AGENDAS: Record<string, AgendaContent> = {
  PR1m: {
    header: 'PR1m — Sales to Pre-Con Pass-Off',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Meeting',
    sections: [
      {
        title: 'AGENDA',
        items: [
          'Customer Introduction',
          'Topographic Survey and Plans (If Applicable)',
          'Customer Avatar',
          'ADU Checklist',
          'Property Analysis',
        ],
      },
      {
        title: 'CUSTOMER INFO',
        items: [
          'Primary Contact: Name / Phone / Email / Address',
          "Owner's Estimated Budget",
          'ADU Option',
          'Topographic Survey',
          'Funding for ADU Secured',
          'Customer Preferred Method of Payment',
          'Secondary Contact: Name / Phone / Email / Address',
        ],
      },
      {
        title: 'KEY SECTIONS & ATTACHMENTS',
        items: [
          'Topographic Survey & Plans',
          'Photos',
          'Avatar',
          'Build Your ADU Checklist',
        ],
      },
      {
        title: 'PRELIMINARY CHECKLIST',
        items: [
          'Structure Type',
          'Flood Zone',
          'Historic',
          'Challenge in Setbacks',
          'Challenge in Parking Requirements',
          'Exterior Wall Materials',
          'Exterior Facade',
          'Roofing Material',
          'Construction Site Preparation',
          'General Elevation',
          'Bathroom Amenity Choices',
          'Shower Niche',
        ],
      },
      {
        title: '50% – 75% DRAWINGS',
        items: [
          'Ceiling Height',
          'Ceiling Style',
          'Roof Pitch',
          'Laundry',
          'Air Condition Handler',
          'Downstairs Garage',
          'Separate Electric Meter',
          'Separate Water Meter',
          'Gas in ADU',
          'Solar Power',
          'Generator',
          'Tesla Charger',
          'Driveway Options',
          'ADU Parking Option',
          'Outdoor Space',
          'Garage Option',
          'Foundation & Footers',
        ],
      },
      {
        title: '95% DRAWINGS',
        items: [
          'Decking Material',
          'Handrail Material',
        ],
      },
      {
        title: 'APPLIANCES',
        items: [
          'Refrigerator',
          'Dishwasher',
          'Garbage Disposal',
          'Stove',
          'Hood',
          'Microwave',
          'Smart A/C Controls',
        ],
      },
      {
        title: 'ELECTRICAL & INSULATION',
        items: [
          'Recessed Ceiling Lighting',
          'Fans Installation',
          'Fans with Lights',
          'Bathroom Exhaust Fan Lights',
          'Soffit Lights',
          'Electrical Outlets Location',
          'Bathroom Fixture',
          'Wall Insulation',
          'Ceiling Insulation',
        ],
      },
      {
        title: 'ADDITIONAL OPTIONS & UPGRADES',
        items: [
          'Wall Texture',
          'Ceiling Texture',
          'Kitchen Backsplash',
          'Solid Core Doors',
          'Large Upper Cabinets',
          'Crown Molding',
          'Hose Bibs Location',
          'Sanitary Line Upgrade',
          'Soffit Material Preference',
          'CASK to Landscape New Outdoor Space',
          'Drywall in Garage',
          'Non-Drywall Electrical Outlets',
          'Glass Windows in Garage Door',
        ],
      },
      {
        title: 'SIGNS AND TESTIMONIALS',
        items: [
          'Post Pre-Con Testimonial',
          'Post Construction Testimonial',
          'Pre-Construction Sign',
          'Construction Sign',
        ],
      },
    ],
    nps: true,
  },
  PR3m: {
    header: 'PR3m — Initial Alignment Meeting',
    subheader: 'Phase 1: Pre-Design · Meeting',
    sections: [
      {
        title: 'PURPOSE OF VISIT',
        items: [
          'Review overall project expectations',
          'Discuss budget alignment and scope',
          'Identify site limitations and considerations',
          'Establish communication flow and milestone tracking',
        ],
      },
      {
        title: 'PROJECT TIMELINE',
        items: [
          'Design Phase: 2-3 months',
          'Permitting Phase: 2-3 months',
          'Estimated Construction: 4-7 months',
        ],
      },
      {
        title: 'FLOOR PLAN & DESIGN IDEAS',
        items: [
          'Open layout preference',
          'Room separation preference',
          'Kitchen placement',
          'Number of bedrooms/workspaces',
        ],
      },
      {
        title: 'INTERIOR DESIGN & LAYOUT',
        items: [
          'Ceiling Height: 8ft (standard), 9ft ($), 10ft ($$)',
          'Ceiling Style: Flat or Vaulted ($)',
          'Laundry Location: Upstairs, Garage, or None',
          'Air Condition Handler: Attic or Mini-Split',
        ],
      },
      {
        title: 'MECHANICAL & UTILITY OPTIONS',
        items: [
          'Electric Meter: Separate or shared',
          'Water Meter: Separate or shared',
          'Gas Meter: Separate, not separate, or none',
        ],
      },
      {
        title: 'EXTERIOR & STRUCTURAL',
        items: [
          'Driveway: Crushed Limestone, Concrete ($), Brick Pavers ($$)',
          'Parking Options',
          'Outdoor Space / Deck',
          'Garage Door Height: 7ft or 8ft ($$)',
        ],
      },
      {
        title: 'SCHEDULING',
        items: [
          'Buildertrend Record Photo',
          'Midway Design Meeting scheduled',
        ],
      },
      {
        title: 'CUSTOMER GOAL',
        items: ['What inspired this project?'],
      },
    ],
    nps: true,
  },
  PR5m: {
    header: 'PR5m — On Site Flag with Customer',
    subheader: 'Phase 1: Pre-Design · Meeting',
    sections: [
      {
        title: 'OBJECTIVE',
        items: [
          'Review the flagged property to outline the project footprint',
          'Confirm utility locations with the Project Manager',
        ],
      },
      {
        title: 'ATTENDEES',
        items: ['Customer', 'Project Manager'],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          { text: 'Welcome & Introductions', sub: ['Quick overview of today\'s site visit and purpose'] },
          { text: 'Project Footprint Walkthrough', sub: ['Review flagged areas marking the layout', 'Answer questions regarding boundaries and placement'] },
          { text: 'Utility Location Review', sub: ['Discuss identified utility locations', 'Confirm any adjustments needed for safety and access'] },
          { text: 'Next Steps', sub: ['Summarize outcomes of the site visit', 'Outline what will happen leading into the next stage'] },
          { text: 'Q&A / Customer Feedback', sub: ['Open discussion for customer questions and concerns'] },
        ],
      },
    ],
    nps: true,
  },
  PD1m: {
    header: 'PD1m — 50% Floor Plan with Customer',
    subheader: 'Phase 2: Pre-Construction Design · Meeting',
    sections: [
      {
        title: 'INITIAL SITE PLAN LAYOUT',
        items: [
          {
            text: 'Trees',
            sub: [
              'Distance of tree(s) to building',
              'Size of tree(s)',
            ],
          },
          {
            text: 'Utilities',
            sub: [
              '(1) Overhead electrical lines — Does power need to be moved for ADU? Does owner want separate electric meter?',
              '(2) Sanitary line location — Is sanitary line under new ADU? Does homeowner want to replace existing line?',
              '(3) Water line size and connection point — Waterline location; Need for new meter and cost implications',
              '(4) Natural gas availability — What appliances need gas? Where will it be fed? Separate meter needed?',
            ],
          },
          'Establish location of parking',
          'If historic — send customer email to clarify expectations',
          'Establish exterior dimensions',
          'Wall layout (furniture flow and functionality)',
          {
            text: 'Kitchen layout',
            sub: [
              'Owner approves area of kitchen',
              'Special features of kitchen',
            ],
          },
        ],
      },
    ],
    nps: true,
  },
  PD4m: {
    header: 'PD4m — 75% Floor Plan with Customer',
    subheader: 'Phase 2: Pre-Construction Design · Meeting',
    sections: [
      {
        title: 'MEP LAYOUT',
        items: [
          {
            text: 'Electrical Layout',
            sub: [
              '(1) Outdoor lighting if necessary',
              '(2) Indoor lighting options',
            ],
          },
          {
            text: 'Plumbing',
            sub: [
              '(1) Locate hose bibs',
              '(2) Location of water heater',
              '(3) Tub or shower selection',
              '(4) Location of shower valve (preferred not on exterior wall)',
            ],
          },
          {
            text: 'Mechanical',
            sub: [
              '(1) Location of air handler',
              '(2) Location of condenser',
              '(3) Determine if range hood exhaust is vented to outside',
            ],
          },
        ],
      },
      {
        title: 'ELEVATIONS',
        items: [
          'Confirm Window Placement',
          'Garage door height – confirm at 7 ft',
        ],
      },
    ],
    nps: true,
  },
}

// ── Agenda modal ──────────────────────────────────────────────────────────────

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
      <li key={index} style={{ marginBottom: sub ? 8 : 5, listStyle: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: 'var(--red, #c8311a)', fontWeight: 600, fontSize: 12, flexShrink: 0, minWidth: 16 }}>{marker}</span>
          <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
        </div>
        {sub && (
          <ul style={{ margin: '5px 0 0 24px', padding: 0 }}>
            {sub.map((s, si) => (
              <li key={si} style={{ listStyle: 'none', marginBottom: 3, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>›</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        )}
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
        animation: 'overlayIn 0.2s ease forwards',
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
          animation: 'modalIn 0.25s ease forwards',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-instrument-serif, Georgia, serif)',
                fontSize: 18, fontWeight: 400,
                color: 'var(--text)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.2px',
              }}
            >
              {agenda.header}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
              {agenda.subheader}
            </p>
          </div>
          <button
            onClick={close}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {agenda.sections.map((section, si) => (
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

          {/* NPS section */}
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

// ── Phase accordion ───────────────────────────────────────────────────────────

function PhaseBlock({ phase, onViewAgenda }: { phase: Phase; onViewAgenda: (code: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ border: `1px solid ${phase.borderColor}` }}
    >
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: phase.bgColor, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
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
          <div className="text-[13px] font-semibold tracking-[-0.1px]" style={{ color: phase.color }}>
            Phase {phase.number} — {phase.label}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: phase.color, opacity: 0.65 }}>
            Meetings {phase.startIndex}–{phase.startIndex + phase.meetings.length - 1}
          </div>
        </div>

        {/* Count chip */}
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: phase.color, color: '#fff', opacity: 0.85 }}
        >
          {phase.meetings.length} meetings
        </span>

        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={phase.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Meeting rows */}
      {open && (
        <div style={{ background: 'var(--white)', borderTop: `1px solid ${phase.borderColor}` }}>
          {phase.note && (
            <div
              className="flex items-start gap-2 px-5 py-3 text-[12px]"
              style={{
                background: phase.bgColor,
                borderBottom: `1px solid ${phase.borderColor}`,
                color: phase.color,
                lineHeight: 1.5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="9" y1="6" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="12" r="0.8" fill="currentColor"/>
              </svg>
              <span style={{ opacity: 0.85 }}>{phase.note}</span>
            </div>
          )}
          {phase.meetings.map((item, i) => {
            const num = phase.startIndex + i
            const isObj = typeof item === 'object'
            const title = isObj ? item.title : item
            const code = isObj ? item.code : null
            const type = isObj ? item.type : null

            const isEmail = type === 'email'

            return (
              <div
                key={`${num}-${code ?? i}`}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderBottom: i < phase.meetings.length - 1 ? '1px solid var(--border)' : 'none',
                  paddingLeft: isEmail ? 28 : 20,
                  paddingRight: 20,
                  background: isEmail ? 'var(--surface2, #fafafa)' : 'var(--white)',
                  opacity: isEmail ? 0.85 : 1,
                }}
              >
                {/* Number — hide for email rows, show mail icon instead */}
                {isEmail ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                ) : (
                  <div className="text-[11px] font-semibold w-6 text-center shrink-0" style={{ color: 'var(--text3)' }}>
                    {num}
                  </div>
                )}

                {/* Code */}
                {code && (
                  <span
                    className="text-[10px] font-bold tracking-[0.4px] shrink-0"
                    style={{ color: isEmail ? '#d97706' : phase.color, opacity: 0.75, minWidth: 36 }}
                  >
                    {code}
                  </span>
                )}

                {/* Title */}
                <span
                  className="flex-1 text-[13px]"
                  style={{
                    color: isEmail ? 'var(--text2)' : 'var(--text)',
                    fontWeight: isEmail ? 400 : 500,
                    fontStyle: isEmail ? 'italic' : 'normal',
                  }}
                >
                  {title}
                </span>

                {/* Auto Email label for email rows */}
                {isEmail && (
                  <span
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#fef3c7', color: '#92400e' }}
                    title="Automated email template"
                  >
                    Auto Email
                  </span>
                )}

                {/* M / E badge */}
                {type && (
                  <span
                    className="shrink-0 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: isEmail ? '#fef3c7' : '#dbeafe',
                      color: isEmail ? '#92400e' : '#1d4ed8',
                    }}
                    title={isEmail ? 'Automated email template' : 'Meeting — has agenda'}
                  >
                    {isEmail ? 'E' : 'M'}
                  </span>
                )}

                {/* Action button */}
                {!isEmail && (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
                    style={{
                      background: phase.bgColor,
                      color: phase.color,
                      border: `1px solid ${phase.borderColor}`,
                      cursor: code && AGENDAS[code] ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      opacity: code && AGENDAS[code] ? 1 : 0.4,
                    }}
                    onClick={() => { if (code && AGENDAS[code]) onViewAgenda(code) }}
                    onMouseEnter={e => { if (code && AGENDAS[code]) e.currentTarget.style.opacity = '0.75' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = code && AGENDAS[code] ? '1' : '0.4' }}
                  >
                    View Agenda
                  </button>
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

export default function ClientTemplatesPage() {
  const [activeAgenda, setActiveAgenda] = useState<string | null>(null)

  return (
    <>
      {activeAgenda && <AgendaModal code={activeAgenda} onClose={() => setActiveAgenda(null)} />}
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
              <PhaseBlock key={phase.number} phase={phase} onViewAgenda={setActiveAgenda} />
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
