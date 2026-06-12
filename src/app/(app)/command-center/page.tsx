'use client'
// src/app/(app)/command-center/page.tsx
// CASK Operating System — Command Center
// Framework only. All data hardcoded — no Supabase, no real connections yet.
//
// Design language: Fable — one red accent, neutral cards, semantic color only.
// "Not connected" is a state, not an error: gray, never red.

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

// ── Status model ─────────────────────────────────────────────────────

type Status = 'red' | 'amber' | 'green'

// Semantic display colors — 'red' in data means "not connected", which is
// a neutral state, not an error. Gray dot, gray text.
const DOT_COLOR: Record<Status, string> = {
  red: 'var(--border2)',
  amber: 'var(--fable-warn)',
  green: 'var(--fable-ok)',
}

const STATE_TEXT_COLOR: Record<Status, string> = {
  red: 'var(--text3)',
  amber: 'var(--fable-warn)',
  green: 'var(--fable-ok)',
}

const STATUS_LABEL: Record<Status, string> = {
  red: 'Not Connected',
  amber: 'In Progress',
  green: 'Live',
}

interface Report {
  name: string
  status: Status
}

interface Department {
  name: string
  icon: string
  badge: string
  border: string
  owner: string
  frequency: string
  dataSource: string
  status: Status
  reports: Report[]
  href?: string
}

// ── Typography helpers ───────────────────────────────────────────────

const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums lining-nums' }

// ── Data (hardcoded) ─────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
  {
    name: 'Sales & Marketing',
    icon: 'target',
    badge: '#3B82F6',
    border: '#3B82F6',
    href: '/command-center/sales',
    owner: 'Sales Manager',
    frequency: 'Weekly / Monthly',
    dataSource: 'CRM / Sales Pipeline',
    status: 'red',
    reports: [
      { name: 'Pipeline Report', status: 'red' },
      { name: 'Revenue Forecast', status: 'red' },
      { name: 'Lead Source Report', status: 'red' },
      { name: 'Conversion Metrics', status: 'red' },
      { name: 'Proposal Aging', status: 'red' },
      { name: 'Win / Loss Report', status: 'red' },
      { name: 'Marketing ROI', status: 'red' },
      { name: 'Capacity Alignment', status: 'red' },
      { name: 'Budget vs Actual', status: 'red' },
    ],
  },
  {
    name: 'Operations',
    icon: 'wrench',
    badge: '#F59E0B',
    border: '#F59E0B',
    href: '/command-center/operations',
    owner: 'Operations Manager',
    frequency: 'Weekly',
    dataSource: 'BuilderTrend',
    status: 'red',
    reports: [
      { name: 'WIP Report', status: 'red' },
      { name: 'Project Profitability', status: 'red' },
      { name: 'PM Scorecards', status: 'red' },
      { name: 'Budget vs Actual', status: 'red' },
      { name: 'Change Order Log', status: 'red' },
      { name: 'Job Cost Detail', status: 'red' },
      { name: 'Schedule Status', status: 'red' },
      { name: 'Closeout Status', status: 'red' },
      { name: 'Open Commitments', status: 'red' },
      { name: 'Safety Performance', status: 'red' },
    ],
  },
  {
    name: 'Finance',
    icon: 'dollar',
    badge: '#10B981',
    border: '#10B981',
    href: '/command-center/finance',
    owner: 'Finance Team',
    frequency: 'Weekly / Monthly',
    dataSource: 'QuickBooks Online',
    status: 'red',
    reports: [
      { name: 'Cash Flow Forecast', status: 'red' },
      { name: '13-Week Cash Flow', status: 'red' },
      { name: 'P&L Statement', status: 'red' },
      { name: 'Balance Sheet', status: 'red' },
      { name: 'AR Aging Report', status: 'red' },
      { name: 'AP Aging Report', status: 'red' },
      { name: 'WIP Summary', status: 'red' },
      { name: 'KPI Dashboard', status: 'red' },
      { name: 'Forecast vs Actual', status: 'red' },
      { name: 'Budget vs Actual', status: 'red' },
    ],
  },
]

const HR_DEPT: Department = {
  name: 'Human Resources',
  icon: 'users',
  badge: '#8B5CF6',
  border: '#8B5CF6',
  href: '/command-center/hr',
  owner: 'HR Manager',
  frequency: 'Monthly',
  dataSource: 'HR System',
  status: 'red',
  reports: [
    { name: 'Hiring Pipeline', status: 'red' },
    { name: 'Employee Roster', status: 'red' },
    { name: 'Training Compliance', status: 'red' },
    { name: 'Retention Metrics', status: 'red' },
    { name: 'Employee Satisfaction', status: 'red' },
    { name: 'Events Calendar', status: 'red' },
    { name: 'Performance Reviews', status: 'red' },
    { name: 'Compensation Summary', status: 'red' },
    { name: 'Budget vs Actual', status: 'red' },
  ],
}

const EXEC_DEPT: Department = {
  name: 'Executive Command Center',
  icon: 'building',
  badge: '#F59E0B',
  border: '#F59E0B',
  href: '/command-center/executive',
  owner: 'Executive Team',
  frequency: 'Weekly',
  dataSource: 'All Departments',
  status: 'amber',
  reports: [
    { name: 'Executive Dashboard', status: 'green' },
    { name: 'Weekly Leadership Report', status: 'red' },
    { name: 'Company Scorecard', status: 'red' },
    { name: 'KPI Overview', status: 'red' },
    { name: 'Backlog Report', status: 'red' },
    { name: 'Cash Position', status: 'red' },
    { name: 'Profitability Overview', status: 'red' },
    { name: 'Department Scorecards', status: 'red' },
    { name: 'Strategic Initiatives', status: 'red' },
    { name: 'Risk & Opportunity Log', status: 'red' },
    { name: 'Budget vs Actual', status: 'red' },
  ],
}

interface MiniCard {
  icon: string
  badge: string
  title: string
  items: Report[]
}

const MINI_CARDS: MiniCard[] = [
  {
    icon: 'filetext',
    badge: '#6366F1',
    title: 'Standard Report Outputs',
    items: [
      { name: 'Executive Dashboard', status: 'green' },
      { name: 'Weekly Leadership Report', status: 'red' },
      { name: 'KPI Scorecard', status: 'red' },
      { name: 'Forecast vs Actual', status: 'red' },
      { name: 'Cash Flow Summary', status: 'red' },
    ],
  },
  {
    icon: 'bell',
    badge: '#EF4444',
    title: 'Automated Alerts',
    items: [
      { name: 'Cash Flow Alerts', status: 'red' },
      { name: 'Budget Overages', status: 'red' },
      { name: 'AP / AR Alerts', status: 'red' },
      { name: 'Project Margin Alerts', status: 'red' },
    ],
  },
  {
    icon: 'search',
    badge: '#0EA5E9',
    title: 'Ad-Hoc Analysis',
    items: [
      { name: 'Deep dives & special projects', status: 'red' },
      { name: 'Custom report builder', status: 'red' },
    ],
  },
]

const DATA_SOURCES: { name: string; status: Status }[] = [
  { name: 'BuilderTrend', status: 'red' },
  { name: 'QuickBooks Online', status: 'red' },
  { name: 'Payroll System', status: 'red' },
  { name: 'CRM / Sales Pipeline', status: 'red' },
  { name: 'HR System', status: 'red' },
  { name: 'Vendor / AP Portal', status: 'red' },
  { name: 'Banks & Credit', status: 'red' },
]

const STATS: { value: number; label: string; note: string; noteOk?: boolean }[] = [
  { value: 5, label: 'Departments', note: 'Plus executive rollup' },
  { value: 0, label: 'Connected', note: 'Of 7 data sources' },
  { value: 49, label: 'Reports Tracked', note: 'Executive Dashboard is live', noteOk: true },
  { value: 4, label: 'Automated Alerts', note: 'Activate on first connection' },
]

// ── Icons (stroke = currentColor so they can be tinted) ──────────────

const ICON_PATHS: Record<string, React.ReactNode> = {
  target: (
    <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  dollar: (
    <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>
  ),
  users: (
    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
  ),
  building: (
    <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /><path d="M3 15h6" /><path d="M15 7h2" /><path d="M15 11h2" /><path d="M15 15h2" /></>
  ),
  filetext: (
    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>
  ),
  bell: (
    <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>
  ),
  search: (
    <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
  ),
  link: (
    <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
  ),
  lock: (
    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
  ),
  database: (
    <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>
  ),
}

function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 2 }: { name: string; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

// Small neutral gray rounded square — no department colors.
function DeptIcon({ icon }: { icon: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: 'var(--surface2)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--text2)',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={16} />
    </div>
  )
}

function StatusDot({ status, size = 6 }: { status: Status; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: DOT_COLOR[status],
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}

// Source connection state — gray dot + gray text when off; semantic only when live.
function SrcState({ status }: { status: Status }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 550,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: STATE_TEXT_COLOR[status],
        whiteSpace: 'nowrap',
      }}
    >
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2
        style={{
          fontSize: 11.5,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          fontWeight: 650,
          color: 'var(--text)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {subtitle && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</span>}
    </div>
  )
}

// Report row — small gray dot + gray text; live rows get ink text + green.
// Locked / coming soon is just dimmed — no lock icons, no red.
function ReportRow({ report }: { report: Report }) {
  const live = report.status === 'green'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: live ? 'var(--fable-ok)' : 'var(--border2)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: live ? 500 : 400,
          color: live ? 'var(--text)' : 'var(--text3)',
        }}
      >
        {report.name}
      </span>
      {live && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            fontWeight: 650,
            letterSpacing: '1px',
            color: 'var(--fable-ok)',
            textTransform: 'uppercase',
          }}
        >
          Live
        </span>
      )}
    </div>
  )
}

function DeptCard({ dept, important = false }: { dept: Department; important?: boolean }) {
  const liveCount = dept.reports.filter(r => r.status === 'green').length
  const visible = dept.reports.slice(0, important ? 7 : 4)
  const more = dept.reports.length - visible.length

  const card = (
    <div
      className="fb-dept"
      style={{
        border: `1px solid ${liveCount > 0 ? '#CBE3D4' : 'var(--fable-line, var(--border))'}`,
        borderRadius: 'var(--fable-radius)',
        background: 'var(--surface)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: dept.href ? 'pointer' : 'default',
        transition: 'border-color 150ms ease',
      }}
    >
      {/* Header: neutral icon + name + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 16px 12px' }}>
        <DeptIcon icon={dept.icon} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.1px' }}>
            {dept.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {dept.owner} · {dept.frequency}
          </div>
        </div>
        {important && <SrcState status={dept.status} />}
      </div>

      {/* Data source strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          margin: '0 16px',
          padding: '9px 11px',
          background: 'var(--surface2)',
          border: '1px solid var(--fable-line-soft, var(--border))',
          borderRadius: 7,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{dept.dataSource}</span>
        {!important && <SrcState status={dept.status} />}
      </div>

      {/* Reports — dimmed list, live rows highlighted */}
      <div style={{ padding: '11px 16px 4px', flex: 1 }}>
        {important ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 22 }}>
            <div>
              {visible.slice(0, 4).map(r => (
                <ReportRow key={r.name} report={r} />
              ))}
            </div>
            <div>
              {visible.slice(4).map(r => (
                <ReportRow key={r.name} report={r} />
              ))}
              {more > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '5px 0 2px', ...NUM }}>
                  + {more} more
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {visible.map(r => (
              <ReportRow key={r.name} report={r} />
            ))}
            {more > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '5px 0 2px', ...NUM }}>
                + {more} more
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — tally + plain text link */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 16px',
          borderTop: '1px solid var(--fable-line-soft, var(--border))',
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 11.5, color: 'var(--text3)', ...NUM }}>
          <b style={{ color: liveCount > 0 ? 'var(--fable-ok)' : 'var(--text)', fontWeight: 600 }}>{liveCount}</b>{' '}
          of {dept.reports.length} live
        </span>
        {dept.href && (
          <span className="fb-dept-link" style={{ fontSize: 12, fontWeight: 550, color: 'var(--text)' }}>
            View Reports →
          </span>
        )}
      </div>
    </div>
  )

  if (dept.href) {
    return (
      <Link href={dept.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        {card}
      </Link>
    )
  }
  return card
}

function MiniReportCard({ card }: { card: MiniCard }) {
  return (
    <div
      className="fb-rise"
      style={{
        border: '1px solid var(--fable-line, var(--border))',
        borderRadius: 'var(--fable-radius)',
        background: 'var(--surface)',
        padding: '15px 16px',
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          color: 'var(--text)',
          letterSpacing: '-0.05px',
          margin: 0,
        }}
      >
        <span style={{ color: 'var(--text2)', display: 'inline-flex' }}>
          <Icon name={card.icon} size={15} />
        </span>
        {card.title}
      </h3>
      <div style={{ marginTop: 10 }}>
        {card.items.map(item => (
          <ReportRow key={item.name} report={item} />
        ))}
      </div>
    </div>
  )
}

// Data source chip — border + gray dot for not connected. Gray means
// inactive, not error.
function DataSourcePill({ name, status }: { name: string; status: Status }) {
  const connected = status !== 'red'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: `1px solid ${connected ? '#CBE3D4' : 'var(--fable-line, var(--border))'}`,
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        color: connected ? 'var(--text)' : 'var(--text2)',
        background: 'var(--surface)',
      }}
    >
      <StatusDot status={status} />
      {name}
      <span style={{ fontSize: 11, color: STATE_TEXT_COLOR[status], fontWeight: 550 }}>
        {STATUS_LABEL[status]}
      </span>
    </span>
  )
}

// ── Command Center AI + insights ─────────────────────────────────────
//
// The shared right-hand AI panel is hidden on this route (see layout.tsx),
// so the page runs full-width. System Insights now lives inline as a compact
// status bar, and CASK OS AI lives in a floating button + drawer bottom-right.

// Drawer palette — CSS variables so it adapts to light/dark mode with the app.
const AI_ACCENT = '#B5121B' // fable red (hex needed for alpha suffix tricks)

const D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  surface2: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: AI_ACCENT,
}

// Inline status-bar data — compact single-row system snapshot.
// Semantic tones only: 'ok' = live/green, 'off' = neutral gray.
const STATUS_ITEMS: { tone: 'ok' | 'off'; text: string }[] = [
  { tone: 'off', text: '0 of 5 departments connected' },
  { tone: 'ok', text: '1 report live' },
  { tone: 'ok', text: 'Customer Journey active' },
]

const RECOMMENDED_ACTIONS: { text: string }[] = [
  { text: 'Connect QuickBooks' },
  { text: 'Get CRM from Jeff' },
  { text: 'Check BuilderTrend' },
]

const AI_GREETING =
  "CASK OS AI online. I have context on all 5 departments, their connection status, and the roadmap. Ask what to connect next, who owns a report, or what's live."

const QUICK_PROMPTS = ['What needs connecting?', "What's live now?", 'Department owners']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Inline System Insights status bar ────────────────────────────────
// Compact full-width bar: a status row (dividers) over a recommended-actions row.

function SystemInsightsBar() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--fable-line, var(--border))',
        borderRadius: 'var(--fable-radius)',
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      {/* Row 1 — status snapshot */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        {STATUS_ITEMS.map((item, i) => (
          <span key={item.text} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && (
              <span style={{ color: 'var(--fable-line, var(--border))', margin: '0 14px', fontSize: 13 }}>|</span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: item.tone === 'ok' ? 'var(--fable-ok)' : 'var(--border2)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 550, color: 'var(--text)', ...NUM }}>{item.text}</span>
            </span>
          </span>
        ))}
      </div>

      {/* Row 2 — recommended actions as plain text links */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 18 }}>
        {RECOMMENDED_ACTIONS.map(a => (
          <span
            key={a.text}
            className="fb-action-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text2)',
              cursor: 'pointer',
            }}
          >
            <span style={{ color: 'var(--text3)' }}>→</span>
            {a.text}
          </span>
        ))}
      </div>
    </div>
  )
}

function FloatingCASKOSAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/command-center',
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.content || 'No response.' }])
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

  return (
    <>
      {/* Floating button — always visible on Command Center */}
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
            animation: 'ccfosPulse 2.2s ease-out infinite',
          }}
        />
        CASK OS AI
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
            animation: 'ccfosSlideUp 220ms ease',
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
                CASK OS AI
              </span>
            </span>
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
          </div>

          {/* Feed */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? `1px solid ${D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? D.text3 : D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'CASK OS AI'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? D.text2 : D.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ padding: '11px 0' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: D.accent,
                    marginBottom: 5,
                  }}
                >
                  CASK OS AI
                </div>
                <div style={{ fontSize: 12.5, color: D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {QUICK_PROMPTS.map(q => (
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
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about departments..."
                rows={1}
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
                disabled={!input.trim() || thinking}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: input.trim() && !thinking ? D.accent : D.surface,
                  color: input.trim() && !thinking ? '#fff' : D.text3,
                  border: 'none',
                  cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
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

// ── Page ─────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const connectedCount = DATA_SOURCES.filter(s => s.status !== 'red').length

  return (
    <>
      <style>{`
        @keyframes ccfosSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ccfosPulse {
          0% { box-shadow: 0 0 0 0 rgba(181,18,27,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(181,18,27,0); }
          100% { box-shadow: 0 0 0 0 rgba(181,18,27,0); }
        }
        .fb-dept:hover { border-color: var(--border2) !important; }
        .fb-dept:hover .fb-dept-link { text-decoration: underline; text-underline-offset: 3px; }
        .fb-action-link:hover { color: var(--text); text-decoration: underline; text-underline-offset: 3px; }
        @media (prefers-reduced-motion: no-preference) {
          .fb-rise { animation: fbRise .35s ease both; }
          @keyframes fbRise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          background: 'var(--white)',
          borderBottom: '1px solid var(--fable-line, var(--border))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            padding: '24px 40px',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 30,
                letterSpacing: '-0.45px',
                lineHeight: 1.15,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              CASK OS
            </h1>
            <div style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>
              CASK Construction Operating System
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 12.5, marginTop: 3 }}>
              One system, one source of truth —{' '}
              <b style={{ fontWeight: 600, color: 'var(--text2)' }}>49 reports</b> across five departments.
            </div>
          </div>

          {/* Connected badge — neutral border style, gray dot + number */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--fable-line, var(--border))',
              background: 'var(--surface)',
              borderRadius: 99,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 550,
              color: 'var(--text)',
              flexShrink: 0,
              ...NUM,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: connectedCount > 0 ? 'var(--fable-ok)' : 'var(--border2)',
                flexShrink: 0,
              }}
            />
            <b style={{ fontWeight: 650 }}>{connectedCount}</b>
            <span style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Connected
            </span>
          </span>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in"
        style={{ background: 'var(--bg)' }}
      >
        <div style={{ padding: '30px 40px 90px', maxWidth: 1180 }}>
          {/* Inline System Insights status bar */}
          <SystemInsightsBar />

          {/* Stats — joined hairline grid, same pattern as Dashboard */}
          <div
            className="fb-rise"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'var(--fable-line, var(--border))',
              border: '1px solid var(--fable-line, var(--border))',
              borderRadius: 'var(--fable-radius)',
              overflow: 'hidden',
              marginBottom: 30,
            }}
          >
            {STATS.map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', padding: '16px 18px 14px' }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: 'var(--text3)',
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 650,
                    letterSpacing: '-0.5px',
                    lineHeight: 1,
                    color: 'var(--text)',
                    marginTop: 8,
                    ...NUM,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: s.noteOk ? 'var(--fable-ok)' : 'var(--text3)',
                    fontWeight: s.noteOk ? 550 : 400,
                    marginTop: 9,
                  }}
                >
                  {s.note}
                </div>
              </div>
            ))}
          </div>

          {/* Row 1 — Sales & Marketing, Operations, Finance */}
          <div style={{ marginBottom: 30 }}>
            <SectionHeader title="Departments" subtitle="Reporting owners & data feeds" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
              {DEPARTMENTS.map(d => (
                <div key={d.name} className="fb-rise" style={{ height: '100%' }}>
                  <DeptCard dept={d} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — Human Resources + Executive Command Center */}
          <div style={{ marginBottom: 30 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
              <div className="fb-rise" style={{ height: '100%' }}>
                <DeptCard dept={HR_DEPT} />
              </div>
              <div className="fb-rise" style={{ height: '100%' }}>
                <DeptCard dept={EXEC_DEPT} important />
              </div>
            </div>
          </div>

          {/* Row 3 — Standard Reports, Automated Alerts, Ad-Hoc Analysis */}
          <div style={{ marginBottom: 30 }}>
            <SectionHeader title="Outputs" subtitle="Reports, alerts & analysis" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
              {MINI_CARDS.map(c => (
                <MiniReportCard key={c.title} card={c} />
              ))}
            </div>
          </div>

          {/* Row 4 — Data Sources */}
          <div>
            <SectionHeader
              title="Data Sources"
              subtitle={`${connectedCount} of ${DATA_SOURCES.length} connected`}
            />
            <div
              className="fb-rise"
              style={{
                border: '1px solid var(--fable-line, var(--border))',
                borderRadius: 'var(--fable-radius)',
                background: 'var(--surface)',
                padding: '16px 18px',
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 13 }}>
                Every system feeds CASK OS. Connect a source and its reports come online automatically.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DATA_SOURCES.map(s => (
                  <DataSourcePill key={s.name} name={s.name} status={s.status} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating CASK OS AI button + chat drawer — bottom-right, this page only */}
      <FloatingCASKOSAI />
    </>
  )
}
