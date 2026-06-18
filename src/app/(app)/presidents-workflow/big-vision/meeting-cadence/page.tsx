'use client'
// src/app/(app)/presidents-workflow/big-vision/meeting-cadence/page.tsx
//
// "Overall Meeting Outline" — a pure-CSS/JSX flowchart (no images, no SVG
// arrows) rendered inside the shared Big Vision sub-page shell: a vertical red
// timeline spine carries the Yearly → Quarterly → Monthly sections; each
// meeting flows into an attendees box and, where shown, a purpose box.

import VisionSubPageShell from '../_components/VisionSubPageShell'

interface CadenceMeeting {
  title: string
  sub?: string
  freq?: string
  attendees: string[]
  purpose?: string
}

interface CadenceSection {
  label: string
  pillColor: string
  subtitle?: string
  meetings: CadenceMeeting[]
}

const SECTIONS: CadenceSection[] = [
  {
    label: 'YEARLY',
    pillColor: '#DC2626',
    meetings: [
      { title: 'EXECUTIVE STRATEGY PLANNING', freq: 'every November', attendees: ['CALIN', 'CHAD'] },
      { title: 'COMPANY STRATEGIC ALIGNMENT MEETING', freq: 'every December', attendees: ['CALIN', 'CHAD', 'DEPARTMENT HEADS'] },
    ],
  },
  {
    label: 'QUARTERLY',
    pillColor: '#F87171',
    subtitle: 'Timing: 1 month before quarter start',
    meetings: [
      { title: 'Q1 GOAL SETTING', sub: 'KPI + PIT', freq: 'every December', attendees: ['DEPARTMENT HEADS'] },
      { title: 'Q2 GOAL SETTING', sub: 'KPI + PIT', freq: 'every March', attendees: ['DEPARTMENT HEADS'] },
      { title: 'Q3 GOAL SETTING', sub: 'KPI + PIT', freq: 'every June', attendees: ['DEPARTMENT HEADS'] },
      { title: 'Q4 GOAL SETTING', sub: 'KPI + PIT', freq: 'every September', attendees: ['DEPARTMENT HEADS'] },
    ],
  },
  {
    label: 'MONTHLY',
    pillColor: '#3B82F6',
    meetings: [
      { title: 'MONTHLY DEPARTMENT HEAD ALIGNMENT', attendees: ['CALIN + EACH DEPARTMENT HEAD 1:1'], purpose: 'ROLL UP FROM QUARTERLY + PERSONAL GOALS' },
      { title: 'ACTION COACH 1:1', attendees: ['CALIN', 'JULIET'], purpose: "CALIN'S FOCUSES" },
      { title: 'ACTION COACH: CALIN + CHAD', attendees: ['CALIN', 'CHAD', 'JULIET', 'SCOTT'] },
      { title: 'SALES AND MARKETING MEETING', attendees: ['CALIN', 'JEFF'] },
    ],
  },
]

const SPINE_RED = '#DC2626'
const BRANCH_GRAY = '#E5E7EB'

function Arrow() {
  return (
    <span aria-hidden="true" style={{ margin: '0 10px', color: '#9CA3AF', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
      →
    </span>
  )
}

function MeetingRow({ meeting }: { meeting: CadenceMeeting }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* branch stub off the gray secondary spine */}
      <div style={{ width: 24, height: 2, background: BRANCH_GRAY, flexShrink: 0 }} />

      {/* meeting box — white, bordered, rounded */}
      <div
        style={{
          background: '#ffffff',
          border: `1px solid ${BRANCH_GRAY}`,
          borderRadius: 8,
          padding: '14px 16px',
          minWidth: 190,
          maxWidth: 230,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', lineHeight: 1.35, letterSpacing: '0.2px' }}>
          {meeting.title}
        </div>
        {meeting.sub && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#374151', marginTop: 2, letterSpacing: '0.2px' }}>
            {meeting.sub}
          </div>
        )}
        {meeting.freq && (
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#6B7280', marginTop: 4 }}>
            &lt;{meeting.freq}&gt;
          </div>
        )}
      </div>

      <Arrow />

      {/* attendees box — soft teal */}
      <div
        style={{
          background: '#CCFBF1',
          border: '1px solid #99F6E4',
          borderRadius: 8,
          padding: '14px 16px',
          minWidth: 158,
          maxWidth: 220,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0F766E', letterSpacing: '0.5px' }}>ATTENDEES:</div>
        {meeting.attendees.map((a) => (
          <div key={a} style={{ fontSize: 12, fontWeight: 600, color: '#115E59', marginTop: 2 }}>
            {a}
          </div>
        ))}
      </div>

      {meeting.purpose && (
        <>
          <Arrow />
          {/* purpose box — soft blue */}
          <div
            style={{
              background: '#DBEAFE',
              border: '1px solid #BFDBFE',
              borderRadius: 8,
              padding: '14px 16px',
              minWidth: 158,
              maxWidth: 220,
              fontSize: 12,
              fontWeight: 600,
              color: '#1E40AF',
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {meeting.purpose}
          </div>
        </>
      )}
    </div>
  )
}

function MeetingCadenceDiagram() {
  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${BRANCH_GRAY}`,
        borderRadius: 12,
        padding: '28px 24px',
        overflowX: 'auto',
      }}
    >
      {/* Vertical red timeline spine connecting every section */}
      <div style={{ borderLeft: `3px solid ${SPINE_RED}`, marginLeft: 8 }}>
        {SECTIONS.map((section) => (
          <div key={section.label} style={{ paddingTop: 30, paddingBottom: 6 }}>
            {/* Section pill connected to the red spine by a horizontal line */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 28, height: 3, background: SPINE_RED, flexShrink: 0 }} />
              <div
                style={{
                  background: section.pillColor,
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: '8px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  flexShrink: 0,
                }}
              >
                {section.label}
              </div>
            </div>

            {/* Optional gray subtitle below the pill */}
            {section.subtitle && (
              <div style={{ marginLeft: 56, marginTop: 8, fontSize: 11.5, color: '#6B7280' }}>{section.subtitle}</div>
            )}

            {/* Meetings hang off a gray secondary spine under the pill */}
            <div
              style={{
                borderLeft: `2px solid ${BRANCH_GRAY}`,
                marginLeft: 56,
                marginTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {section.meetings.map((m) => (
                <MeetingRow key={m.title} meeting={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MeetingCadencePage() {
  return (
    <VisionSubPageShell title="Overall Meeting Outline">
      <MeetingCadenceDiagram />
    </VisionSubPageShell>
  )
}
