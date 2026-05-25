'use client'
// src/app/(app)/president/overview/page.tsx

import { TopBar } from '@/components/ui'

const FREQ = {
  annual:    { color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', label: 'Annual' },
  quarterly: { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', label: 'Quarterly' },
  monthly:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Monthly' },
  weekly:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Weekly' },
  daily:     { color: '#dc4f2a', bg: '#fff5f3', border: '#fecaca', label: 'Daily' },
} as const

type Freq = keyof typeof FREQ

interface SubSubItem { title: string }
interface SubItem { title: string; subItems?: SubSubItem[] }
interface MeetingLevel { title: string; freq: Freq; subItems?: SubItem[] }

const LEVELS: MeetingLevel[] = [
  { title: 'Annual Strategy Meeting', freq: 'annual' },
  { title: 'Yearly Company Strategic Alignment', freq: 'annual' },
  { title: 'Quarterly Meetings', freq: 'quarterly' },
  {
    title: 'Monthly Check-ins',
    freq: 'monthly',
    subItems: [{ title: 'DISC' }],
  },
  {
    title: 'Weekly Meetings',
    freq: 'weekly',
    subItems: [
      { title: 'PIT Goals' },
      {
        title: 'Department Alignment',
        subItems: [
          { title: 'DISC' },
          { title: 'Team Alignment – Hitting Our $20M Goal' },
          { title: 'Department Roles and Responsibilities' },
        ],
      },
    ],
  },
  {
    title: 'Daily Huddles',
    freq: 'daily',
    subItems: [
      { title: 'Daily Meeting – Calin and Kai' },
      { title: 'Data Planning Meeting with Joseph' },
    ],
  },
]

function FreqIcon({ freq }: { freq: Freq }) {
  const f = FREQ[freq]
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-[8px]"
      style={{ width: 34, height: 34, background: f.bg, border: `1px solid ${f.border}` }}
    >
      {freq === 'daily' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
        </svg>
      ) : freq === 'weekly' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )}
    </div>
  )
}

function DownArrow() {
  return (
    <div className="flex justify-center" style={{ padding: '3px 0' }}>
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
        <line x1="7" y1="0" x2="7" y2="17" stroke="var(--border2)" strokeWidth="1.5"/>
        <polyline points="3,13 7,19 11,13" stroke="var(--border2)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function LevelCard({ level }: { level: MeetingLevel }) {
  const f = FREQ[level.freq]
  const hasSubItems = level.subItems && level.subItems.length > 0

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3.5 px-5 py-[14px]">
        <FreqIcon freq={level.freq} />

        <div className="flex-1 min-w-0">
          <span
            className="text-[14px] font-semibold tracking-[-0.2px]"
            style={{ color: 'var(--text)' }}
          >
            {level.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px] tracking-[0.3px]"
            style={{ background: f.bg, color: f.color, border: `1px solid ${f.border}` }}
          >
            {f.label}
          </span>

          {/* View Agenda */}
          <button
            type="button"
            className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px]"
            style={{
              background: f.bg,
              color: f.color,
              border: `1px solid ${f.border}`,
              fontFamily: 'inherit',
              opacity: 0.45,
              cursor: 'default',
            }}
          >
            View Agenda
          </button>

          {/* Join Teams */}
          <span
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-[5px]"
            style={{
              background: '#ede9fe',
              color: '#6d28d9',
              border: '1px solid #c4b5fd',
              fontFamily: 'inherit',
              opacity: 0.45,
              cursor: 'default',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="15" height="10" rx="2"/><path d="m17 9 5-3v12l-5-3"/>
            </svg>
            Join Teams
          </span>
        </div>
      </div>

      {/* Sub-items */}
      {hasSubItems && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="pt-3 flex flex-col gap-2" style={{ marginLeft: 48 }}>
            {level.subItems!.map((sub) => (
              <div key={sub.title}>
                <div className="flex items-center gap-2">
                  <div
                    className="shrink-0 rounded-full"
                    style={{ width: 6, height: 6, background: f.border }}
                  />
                  <span
                    className="text-[12.5px] font-medium"
                    style={{ color: 'var(--text2)' }}
                  >
                    {sub.title}
                  </span>
                </div>
                {sub.subItems && sub.subItems.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1.5" style={{ marginLeft: 22 }}>
                    {sub.subItems.map((subsub) => (
                      <div key={subsub.title} className="flex items-center gap-2">
                        <div
                          className="shrink-0 rounded-full"
                          style={{ width: 4, height: 4, background: 'var(--border2)' }}
                        />
                        <span
                          className="text-[11.5px]"
                          style={{ color: 'var(--text3)' }}
                        >
                          {subsub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PresidentOverviewPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <TopBar title="Workflow Overview" subtitle="President Workflow" />
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {LEVELS.map((level, i) => (
            <div key={level.title}>
              <LevelCard level={level} />
              {i < LEVELS.length - 1 && <DownArrow />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
