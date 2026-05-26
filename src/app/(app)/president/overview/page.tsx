'use client'
// src/app/(app)/president/overview/page.tsx

import { useState } from 'react'
import { TopBar } from '@/components/ui'

const FREQ = {
  annual:    { color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', label: 'Annual' },
  quarterly: { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', label: 'Quarterly' },
  monthly:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Monthly' },
  weekly:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Weekly' },
  daily:     { color: '#dc4f2a', bg: '#fff5f3', border: '#fecaca', label: 'Daily' },
} as const

type Freq = keyof typeof FREQ

interface PersonItem { name: string }
interface SubSubItem { title: string; personItems?: PersonItem[]; modalKey?: string }
interface SubItem { title: string; subItems?: SubSubItem[]; modalKey?: string }
interface MeetingLevel { title: string; freq: Freq; subItems?: SubItem[]; modalKey?: string }

const LEVELS: MeetingLevel[] = [
  { title: 'Annual Strategy Meeting', freq: 'annual', modalKey: 'annual-strategy' },
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
      { title: 'PIT Goals', modalKey: 'pit-goals' },
      {
        title: 'Department Alignment',
        subItems: [
          {
            title: 'DISC',
            personItems: [
              { name: 'Jeff Azcona' },
              { name: 'Lamont Gilyot' },
              { name: 'Kaitlyn Grunenberg' },
              { name: 'Matteo Carpani' },
            ],
          },
          { title: 'Team Alignment – Hitting Our $20M Goal', modalKey: 'team-alignment' },
          { title: 'Department Roles and Responsibilities', modalKey: 'dept-roles' },
        ],
      },
    ],
  },
  {
    title: 'Daily Huddles',
    freq: 'daily',
    subItems: [
      { title: 'Daily Meeting – Calin and Kai', modalKey: 'daily-calin-kai' },
      { title: 'Data Planning Meeting with Joseph' },
    ],
  },
]

// ── DISC profile data ─────────────────────────────────────────────────────────

interface DiscProfile {
  style: string
  styleLabel: string
  styleColor: string
  styleBg: string
  styleBorder: string
  assessmentDate: string
  tagline: string
  traits: string[]
  strengths: string[]
  growthAreas: string[]
  sharePointUrl: string
}

const DISC_PROFILES: Record<string, DiscProfile> = {
  'Jeff Azcona': {
    style: 'i',
    styleLabel: 'i — Influence',
    styleColor: '#d97706',
    styleBg: '#fffbeb',
    styleBorder: '#fde68a',
    assessmentDate: 'May 23, 2023',
    tagline: 'Strongly inclined toward the i style — dot near the edge of the circle.',
    traits: [
      'Outgoing, enthusiastic, and optimistic',
      'Thrives on relating to and connecting with others',
      'Promotes opinions with passion and wholeheartedness',
      'Quick-paced, gut-instinct decision maker',
      'High energy with a strong ability to initiate action',
    ],
    strengths: [
      'Generates excitement and gets people fired up about goals',
      'Builds an extensive network of friends and colleagues',
      'Brings people together — naturally unifies groups',
      'Gifted storyteller with a colorful, engaging communication style',
      'Actively solicits ideas and sees brainstorming as endless possibility',
    ],
    growthAreas: [
      'May monopolize conversations, especially with soft-spoken people',
      'Optimism can lead to overestimating own abilities or task difficulty',
      'Tends to dive into projects without adequate planning or resources',
      'Avoids conflict — may suppress frustration until it reaches a breaking point',
    ],
    sharePointUrl: 'https://caskconstruction.sharepoint.com/sites/CASKConstruction/Shared%20Documents/Forms/AllItems.aspx?viewid=e70addd7%2D1c61%2D417d%2Dab4e%2Dec2c4bb59e3d&ct=1779743714745&or=WORD%2DWEB%2EBODY%2ENT&id=%2Fsites%2FCASKConstruction%2FShared%20Documents%2FHR%2FDISC%2FAzcona%5FJeff%20DiSC%20Profile%20Report%2Epdf&parent=%2Fsites%2FCASKConstruction%2FShared%20Documents%2FHR%2FDISC',
  },
}

// ── File modal ────────────────────────────────────────────────────────────────

function FileModal({ name, onClose }: { name: string; onClose: () => void }) {
  const profile = DISC_PROFILES[name]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 560,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              {name}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              DiSC Profile — Department Alignment
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {profile ? (
          <>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Style badge + date */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[12px] font-bold px-3 py-1 rounded-full tracking-[0.2px]"
                  style={{ background: profile.styleBg, color: profile.styleColor, border: `1px solid ${profile.styleBorder}` }}
                >
                  {profile.styleLabel}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                  Assessed {profile.assessmentDate}
                </span>
              </div>

              {/* Tagline */}
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                {profile.tagline}
              </p>

              {/* Key Traits */}
              <div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
                  Key Traits
                </div>
                <ul className="flex flex-col gap-1.5">
                  {profile.traits.map(t => (
                    <li key={t} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, background: profile.styleColor }} />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Strengths */}
              <div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
                  Strengths
                </div>
                <ul className="flex flex-col gap-1.5">
                  {profile.strengths.map(s => (
                    <li key={s} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, background: '#16a34a' }} />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Growth Areas */}
              <div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
                  Growth Areas
                </div>
                <ul className="flex flex-col gap-1.5">
                  {profile.growthAreas.map(g => (
                    <li key={g} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, background: '#dc4f2a' }} />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer — View Full Report */}
            <div
              className="shrink-0 px-5 py-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <a
                href={profile.sharePointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-[7px] text-[12px] font-semibold transition-opacity no-underline"
                style={{ background: 'var(--charcoal)', color: '#fff' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                View Full Report
              </a>
            </div>
          </>
        ) : (
          /* Placeholder for profiles not yet added */
          <div
            className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-12"
            style={{ color: 'var(--text3)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p className="text-[13px] text-center" style={{ opacity: 0.5 }}>
              DiSC content will be added here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PIT Goals modal ───────────────────────────────────────────────────────────

const PIT_DEPT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Sales:           { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  Marketing:       { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  Preconstruction: { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  Construction:    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  Finance:         { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  Administrative:  { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
}

function pitStatus(pct: number) {
  if (pct >= 100) return { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', bar: '#22c55e', icon: '✅' }
  if (pct >= 75)  return { color: '#b45309', bg: '#fffbeb', border: '#fde68a', bar: '#f59e0b', icon: '🟡' }
  return             { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', bar: '#ef4444', icon: '🔴' }
}

const PIT_SUMMARY_STATS = [
  { label: 'PIT Submitted',      actual: 78, target: 61 },
  { label: 'PS Submitted',       actual: 63, target: 63 },
  { label: 'Dept Team Review',   actual: 55, target: 81 },
  { label: 'Dept Team Approval', actual: 23, target: 25 },
  { label: 'SOP Created',        actual:  5, target: 25 },
]

const PIT_Q1_DEPTS = [
  { dept: 'Finance',          count: 14 },
  { dept: 'Preconstruction',  count: 10 },
  { dept: 'Sales',            count:  7 },
  { dept: 'Construction',     count:  5 },
  { dept: 'Marketing',        count:  4 },
  { dept: 'Administrative',   count:  1 },
]

const PIT_Q2_DEPTS = [
  { dept: 'Administrative',   count: 10 },
  { dept: 'Preconstruction',  count:  7 },
  { dept: 'Construction',     count:  3 },
  { dept: 'Sales',            count:  3 },
  { dept: 'Marketing',        count:  0 },
  { dept: 'Finance',          count:  0 },
]

const PIT_LEADERBOARD = [
  { name: 'Jeff Azcona',            pits: 17, depts: ['Sales', 'Marketing'] },
  { name: 'Kait Grunenberg',        pits: 14, depts: ['Preconstruction', 'Administrative', 'Construction'] },
  { name: 'Lamont Gilyot',          pits: 13, depts: ['Finance'] },
  { name: 'Calin Noonan',           pits: 10, depts: ['Administrative', 'Sales', 'Construction', 'Marketing', 'Preconstruction'] },
  { name: 'Matteo Carpani',         pits:  4, depts: ['Preconstruction'] },
  { name: 'Chad Holman',            pits:  2, depts: ['Preconstruction'] },
  { name: 'Tim Ritschel',           pits:  2, depts: ['Construction', 'Preconstruction'] },
  { name: 'Kelly Cuffel',           pits:  2, depts: ['Preconstruction'] },
  { name: 'Douglas Mertens',        pits:  1, depts: ['Construction'] },
  { name: 'Eric Bressler',          pits:  1, depts: ['Construction'] },
  { name: 'Peter Deutelmoser',      pits:  1, depts: ['Construction'] },
  { name: 'Jessica Zientarski',     pits:  1, depts: ['Sales'] },
  { name: 'Jasmin Salangsang',      pits:  1, depts: ['Finance'] },
  { name: 'Kevin Joshua Balmaceda', pits:  1, depts: ['Sales'] },
  { name: 'Kai Mapoy',              pits:  1, depts: ['Administrative'] },
  { name: 'Cooper Hermansen',       pits:  1, depts: ['Construction'] },
  { name: 'Joseph Estelloso',       pits:  1, depts: ['Sales'] },
]

const PIT_INACTIVE = [
  { name: 'Kait Grunenberg',  pits: 8, depts: ['Preconstruction', 'Administrative', 'Construction'] },
  { name: 'Calin Noonan',     pits: 2, depts: ['Administrative', 'Preconstruction'] },
  { name: 'Matteo Carpani',   pits: 1, depts: ['Preconstruction'] },
  { name: 'Kai Mapoy',        pits: 1, depts: ['Administrative'] },
  { name: 'Cooper Hermansen', pits: 1, depts: ['Construction'] },
  { name: 'Chad Holman',      pits: 1, depts: ['Preconstruction'] },
  { name: 'Jeff Azcona',      pits: 1, depts: ['Sales', 'Marketing'] },
]

type PitTab = 'all' | 'q1' | 'q2'

function PitDeptBadge({ dept }: { dept: string }) {
  const c = PIT_DEPT_COLORS[dept] ?? PIT_DEPT_COLORS.Administrative
  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px] tracking-[0.3px] uppercase shrink-0"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {dept}
    </span>
  )
}

function PitModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<PitTab>('all')

  const qDepts  = tab === 'q1' ? PIT_Q1_DEPTS  : tab === 'q2' ? PIT_Q2_DEPTS  : null
  const qActual = tab === 'q1' ? 41 : tab === 'q2' ? 23 : null
  const qTarget = tab === 'q1' ? 25 : tab === 'q2' ? 36 : null
  const qPct    = qActual != null && qTarget != null ? Math.round((qActual / qTarget) * 100) : null
  const maxDept = qDepts ? Math.max(...qDepts.map(d => d.count), 1) : 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 680,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 60px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: 'var(--text)' }}>PIT Goals Dashboard</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>Weekly Meetings · President Workflow</div>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* ── All-Time Summary Cards ── */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              All-Time Summary
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {PIT_SUMMARY_STATS.map(({ label, actual, target }) => {
                const pct = Math.round((actual / target) * 100)
                const s = pitStatus(pct)
                return (
                  <div key={label} className="rounded-[8px] px-3 pt-3 pb-2.5 flex flex-col gap-2" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <div className="text-[10px] font-semibold leading-tight" style={{ color: s.color }}>{label}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-[22px] font-bold leading-none tracking-[-0.5px]" style={{ color: s.color }}>{actual}</span>
                      <span className="text-[10px] mb-0.5" style={{ color: s.color, opacity: 0.65 }}>/{target}</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(0,0,0,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: s.bar }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold" style={{ color: s.color }}>{pct}%</span>
                      <span className="text-[12px]">{s.icon}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Quarter Tabs + Dept Breakdown ── */}
          <div>
            <div className="flex items-center gap-1 mb-4 p-1 rounded-[7px]" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', width: 'fit-content' }}>
                {([['all', 'All Time'], ['q1', 'Q1 2026'], ['q2', 'Q2 2026']] as [PitTab, string][]).map(([key, label]) => (
                <button
                  key={key} type="button"
                  className="text-[11px] font-semibold px-3 py-1 rounded-[5px]"
                  style={{
                    background: tab === key ? 'var(--surface)' : 'transparent',
                    color: tab === key ? 'var(--text)' : 'var(--text3)',
                    border: tab === key ? '1px solid var(--border)' : '1px solid transparent',
                    fontFamily: 'inherit', cursor: 'pointer',
                    boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                  }}
                  onClick={() => setTab(key)}
                >{label}</button>
              ))}
            </div>

            {qPct != null && qActual != null && qTarget != null ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 rounded-[8px] mb-4" style={{ background: pitStatus(qPct).bg, border: `1px solid ${pitStatus(qPct).border}` }}>
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-0.5" style={{ color: pitStatus(qPct).color }}>
                      {tab === 'q1' ? 'Q1 2026 — Previous Quarter' : 'Q2 2026 — Current Quarter'}
                    </div>
                    <div className="text-[12px]" style={{ color: pitStatus(qPct).color, opacity: 0.8 }}>
                      {qActual} PITs submitted · Target: {qTarget}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[24px] font-bold tracking-[-0.5px]" style={{ color: pitStatus(qPct).color }}>{qPct}%</span>
                    <span className="text-[16px]">{pitStatus(qPct).icon}</span>
                  </div>
                </div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2.5" style={{ color: 'var(--text3)' }}>Department Breakdown</div>
                <div className="flex flex-col gap-2">
                  {qDepts!.map(({ dept, count }) => {
                    const dc = PIT_DEPT_COLORS[dept] ?? PIT_DEPT_COLORS.Administrative
                    return (
                      <div key={dept} className="flex items-center gap-3">
                        <div className="text-[11.5px] font-medium shrink-0" style={{ width: 118, color: 'var(--text2)' }}>{dept}</div>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round((count / maxDept) * 100)}%`, background: dc.color }} />
                        </div>
                        <span className="shrink-0 text-[11.5px] font-bold w-5 text-right" style={{ color: dc.color }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-[12px]" style={{ color: 'var(--text3)' }}>Select a quarter above to see the department breakdown.</div>
            )}
          </div>

          {/* ── Leaderboard ── */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              All-Time Leaderboard
            </div>
            <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="grid text-[10px] font-semibold px-4 py-2" style={{ gridTemplateColumns: '22px 1fr auto 36px', gap: '10px', background: 'var(--surface2)', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                <span>#</span><span>Team Member</span><span>Departments</span><span className="text-right">PITs</span>
              </div>
              {PIT_LEADERBOARD.map(({ name, pits, depts }, i) => (
                <div
                  key={name}
                  className="grid items-center px-4 py-2.5"
                  style={{ gridTemplateColumns: '22px 1fr auto 36px', gap: '10px', borderBottom: i < PIT_LEADERBOARD.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <span className="text-[11px] font-bold" style={{ color: i === 0 ? '#2563eb' : i === 1 ? '#7c3aed' : i === 2 ? '#d97706' : 'var(--text3)' }}>
                    {i + 1}
                  </span>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{name}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {depts.map(d => <PitDeptBadge key={d} dept={d} />)}
                  </div>
                  <span className="text-[13px] font-bold text-right" style={{ color: 'var(--text)' }}>{pits}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Inactive PITs ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-[10px] font-semibold tracking-[1.2px] uppercase" style={{ color: 'var(--text3)' }}>Inactive PIT Submitted</div>
              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-[3px]" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                ⚠ Needs Action
              </span>
            </div>
            <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid #fecaca' }}>
              {PIT_INACTIVE.map(({ name, pits, depts }, i) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < PIT_INACTIVE.length - 1 ? '1px solid #fecaca' : 'none', background: '#fef2f2' }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-[12px] font-medium shrink-0" style={{ color: '#7f1d1d' }}>{name}</span>
                    {depts.map(d => <PitDeptBadge key={d} dept={d} />)}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: '#b91c1c' }}>{pits} {pits === 1 ? 'PIT' : 'PITs'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Latest Weekly Update ── */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              Latest Weekly Update
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-[8px]" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text3)' }}>Week of 5/24/2026</div>
                <div className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>Jeff Azcona</div>
              </div>
              <div className="flex items-center gap-1.5">
                <PitDeptBadge dept="Sales" />
                <PitDeptBadge dept="Marketing" />
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                  1 PIT
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href="https://caskconstruction.sharepoint.com/:x:/s/CASKConstruction/IQATkTe2nosHSaqOz5PAgd1zAQnksU-Bf2OQt0Bl5soI00Y?e=lO3nZy"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-[7px] text-[12px] font-semibold transition-opacity no-underline"
            style={{ background: 'var(--charcoal)', color: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            View Full Report
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Daily Meeting – Calin and Kai modal ──────────────────────────────────────

const DAILY_CALIN_KAI_AGENDA = [
  {
    number: '1',
    title: 'Calendar Review',
    items: [
      'Identify conflicts, overlaps, or scheduling gaps',
      'Confirm meeting priorities',
      'Flag meetings requiring preparation or materials',
    ],
  },
  {
    number: '2',
    title: 'Emails',
    items: [
      'Review unread and priority emails from yesterday',
      'Review flagged emails',
      'Questions on filing',
    ],
  },
  {
    number: '3',
    title: 'Task Progress, Follow-ups and Priorities',
    items: [
      'Review status of previously assigned items',
      'Updates on action items — Pres task tracker',
      'Completed / updated tasks',
      'In-progress tasks and current status',
    ],
  },
  {
    number: '4',
    title: 'Quick Recap',
    items: [
      'Confirm key action items',
      'Confirm priorities for the day',
      'Ensure nothing urgent was missed',
    ],
  },
]

// TODO: Replace '#' below with the SharePoint document URL when available
const DAILY_CALIN_KAI_URL = '#'

function DailyCalinKaiModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 520,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              Daily Huddle — Calin &amp; Kai
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Facilitator: Kai Mapoy · Attendees: Calin Noonan, Kai Mapoy
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="text-[10px] font-semibold tracking-[1.2px] uppercase" style={{ color: 'var(--text3)' }}>
            Meeting Agenda
          </div>
          {DAILY_CALIN_KAI_AGENDA.map((section) => (
            <div key={section.number}>
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ width: 20, height: 20, background: '#dc4f2a' }}
                >
                  {section.number}
                </div>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  {section.title}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5" style={{ marginLeft: 30 }}>
                {section.items.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                    <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <a
            href={DAILY_CALIN_KAI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-[7px] text-[12px] font-semibold transition-opacity no-underline"
            style={{ background: 'var(--charcoal)', color: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            View Full Document
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Expandable DISC row ───────────────────────────────────────────────────────

function DiscExpandable({ subsub }: { subsub: SubSubItem }) {
  const [open, setOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  return (
    <div>
      {/* DISC header row — clickable */}
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="shrink-0 rounded-full"
          style={{ width: 4, height: 4, background: 'var(--border2)' }}
        />
        <span className="text-[11.5px] font-medium" style={{ color: 'var(--text3)' }}>
          {subsub.title}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            color: 'var(--text3)',
            opacity: 0.5,
            flexShrink: 0,
            transition: 'transform 180ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Person rows */}
      {open && subsub.personItems && (
        <div className="flex flex-col gap-1.5 mt-2" style={{ marginLeft: 14 }}>
          {subsub.personItems.map((person) => (
            <div key={person.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="shrink-0 rounded-full"
                  style={{ width: 3, height: 3, background: 'var(--border2)' }}
                />
                <span className="text-[11.5px]" style={{ color: 'var(--text3)' }}>
                  {person.name}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-opacity"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveModal(person.name)}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                View File
              </button>
            </div>
          ))}
        </div>
      )}

      {activeModal && (
        <FileModal name={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

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

// ── Level card ────────────────────────────────────────────────────────────────

function AnnualStrategyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 560,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              Annual Strategic Planning Session
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Participants: Calin &amp; Chad · Timing: November
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Prep Material */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Prep Material for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Participants should review the following materials prior to the session:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Review Big Vision (10-Year Vision)',
                "Review Last Year's Goals",
                'Review Current Strategic Plan and KPIs',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links for the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Links for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Include links within the meeting document to the following materials:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Chat GPT channel — Company Planning GPT',
                'Teams channel — Company Planning',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purpose Statement */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Purpose Statement of the Meeting
            </div>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
              Set a direction for the next year so that each individual department can set their own mission statement and goals for the upcoming year.
            </p>
          </div>

          {/* Outcomes After the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Outcomes After the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Define the expected outcomes from the session, including:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Set a meeting with the Department Heads',
                'Send out the direction and the vision and mission statement for each department to set their goals.',
                'Alignment on long-term company vision',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

function PlaceholderModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 520,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              {title}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Department Alignment
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4" />
      </div>
    </div>
  )
}

function LevelCard({ level }: { level: MeetingLevel }) {
  const f = FREQ[level.freq]
  const hasSubItems = level.subItems && level.subItems.length > 0
  const [activeSubModal, setActiveSubModal] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<string | null>(null)

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

          <button
            type="button"
            className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
            style={{
              background: f.bg,
              color: f.color,
              border: `1px solid ${f.border}`,
              fontFamily: 'inherit',
              opacity: level.modalKey ? 1 : 0.45,
              cursor: level.modalKey ? 'pointer' : 'default',
            }}
            onClick={() => { if (level.modalKey) setActiveModal(level.modalKey) }}
            onMouseEnter={e => { if (level.modalKey) e.currentTarget.style.opacity = '0.7' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = level.modalKey ? '1' : '0.45' }}
          >
            View Agenda
          </button>

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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 6, height: 6, background: f.border }}
                    />
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text2)' }}>
                      {sub.title}
                    </span>
                  </div>
                  {sub.modalKey && (
                    <button
                      type="button"
                      className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-opacity"
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveSubModal(sub.modalKey!)}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      View File
                    </button>
                  )}
                </div>
                {sub.subItems && sub.subItems.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1.5" style={{ marginLeft: 22 }}>
                    {sub.subItems.map((subsub) =>
                      subsub.personItems ? (
                        <DiscExpandable key={subsub.title} subsub={subsub} />
                      ) : (
                        <div key={subsub.title} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="shrink-0 rounded-full"
                              style={{ width: 4, height: 4, background: 'var(--border2)' }}
                            />
                            <span className="text-[11.5px]" style={{ color: 'var(--text3)' }}>
                              {subsub.title}
                            </span>
                          </div>
                          {subsub.modalKey && (
                            <button
                              type="button"
                              className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-opacity"
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                              }}
                              onClick={() => setActiveSubModal(subsub.modalKey!)}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                            >
                              View File
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubModal === 'pit-goals' && (
        <PitModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'daily-calin-kai' && (
        <DailyCalinKaiModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'team-alignment' && (
        <PlaceholderModal title="Team Alignment – Hitting Our $20M Goal" onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'dept-roles' && (
        <PlaceholderModal title="Department Roles and Responsibilities" onClose={() => setActiveSubModal(null)} />
      )}
      {activeModal === 'annual-strategy' && (
        <AnnualStrategyModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PresidentOverviewPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <TopBar title="President's Meetings" subtitle="President Workflow" />
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
