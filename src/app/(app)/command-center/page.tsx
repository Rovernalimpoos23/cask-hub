'use client'
// src/app/(app)/command-center/page.tsx
// CASK Operating System — Command Center
// Framework only. All data hardcoded — no Supabase, no real connections yet.
//
// Design language: "Bloomberg Terminal meets luxury construction firm."
// Premium, data-dense, intentional. Follows the app theme — works in both light and dark mode.

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

// ── Status model ─────────────────────────────────────────────────────

type Status = 'red' | 'amber' | 'green'

const STATUS_COLOR: Record<Status, string> = {
  red: '#EF4444',
  amber: '#F59E0B',
  green: '#10B981',
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

// ── Page palette — CSS variables so the page follows light/dark mode ─

const PALETTE = {
  page: 'var(--bg)',
  header: 'var(--white)',
  card: 'var(--surface)',
  cardRaised: 'var(--surface2)',
  inner: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  textDim: 'var(--text3)',
}

// 35×35 fractal-noise grain, used as a faint overlay for premium texture.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")"

// Faint engineering-grid overlay — neutral grey works on both light and dark cards.
const GRID_BG =
  'linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)'

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

const STATS: { value: number; label: string; icon: string; accent: string }[] = [
  { value: 5, label: 'Departments', icon: 'building', accent: '#3B82F6' },
  { value: 0, label: 'Connected', icon: 'link', accent: '#EF4444' },
  { value: 49, label: 'Reports Tracked', icon: 'filetext', accent: '#F59E0B' },
  { value: 4, label: 'Automated Alerts', icon: 'bell', accent: '#8B5CF6' },
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

function IconBadge({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: `linear-gradient(150deg, ${color}, ${color}cc)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
        boxShadow: `0 4px 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.28)`,
      }}
    >
      <Icon name={icon} size={size * 0.46} color="#fff" />
    </div>
  )
}

function StatusDot({ status, size = 8, glow = false }: { status: Status; size?: number; glow?: boolean }) {
  const c = STATUS_COLOR[status]
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: c,
        flexShrink: 0,
        display: 'inline-block',
        boxShadow: glow ? `0 0 8px ${c}` : `0 0 4px ${c}66`,
        animation: glow ? 'caskPulse 2.2s ease-in-out infinite' : undefined,
      }}
    />
  )
}

function StatusBadge({ status, prominent = false }: { status: Status; prominent?: boolean }) {
  const c = STATUS_COLOR[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: prominent ? 12 : 11,
        fontWeight: 700,
        padding: prominent ? '6px 12px' : '4px 9px',
        borderRadius: 20,
        color: c,
        background: `${c}1a`,
        border: `1px solid ${c}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
        boxShadow: prominent ? `0 0 16px ${c}33` : 'none',
      }}
    >
      {status === 'red'
        ? <Icon name="lock" size={prominent ? 12 : 10} color={c} strokeWidth={2.4} />
        : <StatusDot status={status} size={prominent ? 7 : 6} glow={status === 'green'} />}
      {STATUS_LABEL[status]}
    </span>
  )
}

function StatSegment({ stat, index }: { stat: typeof STATS[number]; index: number }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 26px',
        borderLeft: index > 0 ? `1px solid ${PALETTE.borderSoft}` : 'none',
        overflow: 'hidden',
      }}
    >
      {/* per-stat background tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 120% at 85% 0%, ${stat.accent}12, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      {/* icon */}
      <div
        style={{
          position: 'absolute',
          top: 22,
          right: 22,
          color: stat.accent,
          opacity: 0.55,
        }}
      >
        <Icon name={stat.icon} size={18} />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 46,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-2px',
          color: PALETTE.text,
          textShadow: `0 0 30px ${stat.accent}25`,
        }}
      >
        {stat.value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: PALETTE.text3,
          textTransform: 'uppercase',
          letterSpacing: '1.4px',
          marginTop: 12,
        }}
      >
        {stat.label}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '2px',
          color: PALETTE.text2,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span style={{ fontSize: 12, color: PALETTE.textDim, letterSpacing: '0.2px' }}>{subtitle}</span>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${PALETTE.border}, transparent)`,
        }}
      />
    </div>
  )
}

function ReportRow({ report }: { report: Report }) {
  const connected = report.status !== 'red'
  const live = report.status === 'green'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px', borderRadius: 6 }}>
      <StatusDot status={report.status} size={7} glow={live} />
      <span
        style={{
          fontSize: 13,
          fontWeight: connected ? 600 : 400,
          color: live ? '#34d399' : connected ? PALETTE.text : PALETTE.text3,
          textShadow: live ? '0 0 12px rgba(16,185,129,0.45)' : 'none',
        }}
      >
        {report.name}
      </span>
      {live && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#34d399',
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
  const [hovered, setHovered] = useState(false)
  const color = dept.border
  const connected = dept.status !== 'red'

  const card = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        backgroundImage: GRID_BG,
        backgroundSize: '22px 22px',
        borderTop: `1px solid ${hovered ? `${color}44` : PALETTE.border}`,
        borderRight: `1px solid ${hovered ? `${color}44` : PALETTE.border}`,
        borderBottom: `1px solid ${hovered ? `${color}44` : PALETTE.border}`,
        borderLeft: `6px solid ${color}`,
        borderRadius: 14,
        padding: '20px 22px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: dept.href ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease',
        boxShadow: hovered
          ? `0 16px 36px -10px ${color}55, 0 0 0 1px ${color}22`
          : '0 1px 3px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header: icon + name + (exec) prominent badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <IconBadge icon={dept.icon} color={dept.badge} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-geist), sans-serif',
                fontSize: 18,
                fontWeight: 700,
                color: PALETTE.text,
                lineHeight: 1.15,
                letterSpacing: '-0.3px',
              }}
            >
              {dept.name}
            </div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: PALETTE.textDim,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginTop: 5,
              }}
            >
              {dept.owner} · {dept.frequency}
            </div>
          </div>
          {important && <StatusBadge status={dept.status} prominent />}
        </div>

        {/* Data source box — glow matches department color */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: connected ? `${color}12` : 'var(--surface2)',
            border: `1px solid ${connected ? `${color}40` : `${color}1f`}`,
            boxShadow: connected ? `0 0 22px ${color}22, inset 0 0 18px ${color}10` : 'none',
            marginBottom: 16,
          }}
        >
          {/* Label + badge share the top row — keeps the value text full-width */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: connected ? color : PALETTE.textDim,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Data Source
            </div>
            {!important && <StatusBadge status={dept.status} />}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: connected ? PALETTE.text : PALETTE.text3,
            }}
          >
            {dept.dataSource}
          </div>
        </div>

        {/* Reports list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 18 }}>
          {dept.reports.map((r) => (
            <ReportRow key={r.name} report={r} />
          ))}
        </div>

        {/* Footer action */}
        {dept.href ? (
          <div
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              background: color,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.3px',
              textAlign: 'center',
              boxShadow: hovered ? `0 8px 22px ${color}66` : `0 2px 10px ${color}33`,
              transition: 'box-shadow 200ms ease',
            }}
          >
            View Reports →
          </div>
        ) : (
          <div
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--surface2)',
              border: `1px solid ${PALETTE.border}`,
              color: PALETTE.text3,
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Icon name="lock" size={12} color={PALETTE.text3} /> Connect
          </div>
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
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: PALETTE.card,
        backgroundImage: `${GRID_BG}`,
        backgroundSize: '22px 22px',
        border: `1px solid ${hovered ? `${card.badge}44` : PALETTE.border}`,
        borderRadius: 14,
        padding: '18px 20px',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease',
        boxShadow: hovered ? `0 14px 30px -10px ${card.badge}44` : '0 1px 3px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <IconBadge icon={card.icon} color={card.badge} size={40} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: PALETTE.text,
            letterSpacing: '-0.2px',
          }}
        >
          {card.title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {card.items.map((item) => (
          <ReportRow key={item.name} report={item} />
        ))}
      </div>
    </div>
  )
}

function DataSourcePill({ name, status }: { name: string; status: Status }) {
  const connected = status !== 'red'
  const c = STATUS_COLOR[status]
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 15px',
        borderRadius: 999,
        background: 'var(--surface2)',
        border: `1px solid ${PALETTE.border}`,
        opacity: connected ? 1 : 0.85,
      }}
    >
      <StatusDot status={status} size={7} glow={status === 'green'} />
      <span style={{ fontSize: 13, fontWeight: 600, color: connected ? PALETTE.text : PALETTE.text2 }}>
        {name}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: c, opacity: 0.85, letterSpacing: '0.2px' }}>
        {STATUS_LABEL[status]}
      </span>
    </div>
  )
}

// ── System Insights panel (overlays the shared AI panel column) ──────
//
// Self-contained panel rendered position:fixed over the 440px right column.
// It only exists while this page is mounted — navigating away unmounts it
// and the shared AIPanel shows through again. No other file touched.

// Panel palette — uses CSS variables so it adapts to light/dark mode with the rest of the app.
const D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  surface2: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  green: '#34D399',
  red: '#F87171',
  accent: '#F59E0B',
}

type InsightRow =
  | { kind: 'metric'; emoji: string; label: string; value: string }
  | { kind: 'status'; dot: string; label: string; value: string }

const INSIGHTS: InsightRow[] = [
  { kind: 'metric', emoji: '⚡', label: 'Departments Connected', value: '0 of 5' },
  { kind: 'metric', emoji: '📊', label: 'Reports Live', value: '1 of 49' },
  { kind: 'status', dot: '#10B981', label: 'Customer Journey', value: 'Active' },
  { kind: 'status', dot: '#EF4444', label: 'Sales & Marketing', value: 'Not Connected' },
  { kind: 'status', dot: '#EF4444', label: 'Operations', value: 'Not Connected' },
  { kind: 'status', dot: '#EF4444', label: 'Finance', value: 'Not Connected' },
  { kind: 'status', dot: '#EF4444', label: 'HR', value: 'Not Connected' },
]

const RECOMMENDED: { text: string; accent: string }[] = [
  { text: 'Connect QuickBooks → unlock Finance', accent: '#10B981' },
  { text: 'Get CRM access from Jeff → unlock Sales', accent: '#3B82F6' },
  { text: 'Check BuilderTrend API → unlock Operations', accent: '#F59E0B' },
]

const AI_GREETING =
  "CCFOS AI online. I have context on all 5 departments, their connection status, and the roadmap. Ask what to connect next, who owns a report, or what's live."

const QUICK_PROMPTS = ['What needs connecting?', "What's live now?", 'Department owners']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

function InsightRowItem({ row }: { row: InsightRow }) {
  const isGreen = row.kind === 'status' && row.value === 'Active'
  const valueColor = row.kind === 'metric' ? D.text : isGreen ? D.green : D.red
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 0',
        borderBottom: `1px solid ${D.borderSoft}`,
      }}
    >
      {row.kind === 'metric' ? (
        <span style={{ fontSize: 14, lineHeight: 1, width: 16, textAlign: 'center', flexShrink: 0 }}>
          {row.emoji}
        </span>
      ) : (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: row.dot,
            boxShadow: isGreen ? `0 0 8px ${row.dot}` : `0 0 4px ${row.dot}66`,
            flexShrink: 0,
            marginLeft: 4,
            marginRight: 4,
          }}
        />
      )}
      <span style={{ fontSize: 12.5, color: D.text2, flex: 1, minWidth: 0 }}>{row.label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: valueColor, whiteSpace: 'nowrap' }}>
        {row.value}
      </span>
    </div>
  )
}

function RecommendedItem({ text, accent }: { text: string; accent: string }) {
  const arrowIdx = text.indexOf('→')
  const pre = arrowIdx >= 0 ? text.slice(0, arrowIdx).trim() : text
  const post = arrowIdx >= 0 ? text.slice(arrowIdx + 1).trim() : ''
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '9px 11px',
        borderRadius: 8,
        background: D.surface,
        border: `1px solid ${D.borderSoft}`,
        borderLeft: `2px solid ${accent}`,
        lineHeight: 1.45,
      }}
    >
      <span style={{ fontSize: 12.5, color: D.text2 }}>
        {pre}
        {post && (
          <span style={{ color: accent, fontWeight: 600 }}> → {post}</span>
        )}
      </span>
    </div>
  )
}

function CommandCenterPanel() {
  const [aiOpen, setAiOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aiOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, aiOpen])

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
    <aside
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        zIndex: 40,
        background: D.bg,
        color: D.text,
        borderLeft: `1px solid ${D.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-geist), sans-serif',
      }}
    >
      {/* ── SECTION 1 — System Insights ── */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '18px 18px 22px' }}>
        {/* Header */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: D.text2,
          }}
        >
          System Insights
        </div>
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${D.border}, transparent)`,
            margin: '11px 0 4px',
          }}
        />

        {/* Status rows */}
        <div>
          {INSIGHTS.map(row => (
            <InsightRowItem key={row.label} row={row} />
          ))}
        </div>

        {/* Recommended actions */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '1.8px',
            textTransform: 'uppercase',
            color: D.text3,
            margin: '22px 0 11px',
          }}
        >
          Recommended Actions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {RECOMMENDED.map(a => (
            <RecommendedItem key={a.text} text={a.text} accent={a.accent} />
          ))}
        </div>
      </div>

      {/* ── SECTION 2 — CCFOS AI (collapsible) ── */}
      <div
        style={{
          flex: aiOpen ? '1 1 0' : '0 0 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderTop: `1px solid ${D.border}`,
          background: D.bg,
        }}
      >
        {/* Header / toggle */}
        <button
          onClick={() => setAiOpen(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '13px 16px',
            background: D.surface,
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: D.accent,
                boxShadow: `0 0 8px ${D.accent}`,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '1.6px',
                textTransform: 'uppercase',
                color: D.text,
              }}
            >
              CCFOS AI
            </span>
          </span>
          <span
            style={{
              color: D.text3,
              fontSize: 11,
              transform: aiOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 160ms ease',
            }}
          >
            ▼
          </span>
        </button>

        {/* Chat — only when expanded */}
        {aiOpen && (
          <>
            {/* Feed */}
            <div
              style={{
                flex: '1 1 0',
                minHeight: 0,
                overflowY: 'auto',
                padding: '6px 16px 10px',
              }}
            >
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
                    {m.role === 'user' ? 'You' : 'CCFOS AI'}
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
                    CCFOS AI
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
                  placeholder="Ask about departments, reports..."
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
                    color: input.trim() && !thinking ? '#0f0f0f' : D.text3,
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
          </>
        )}
      </div>
    </aside>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  return (
    <>
      <style>{`
        @keyframes caskSheen { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes caskPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          50% { box-shadow: 0 0 0 5px rgba(16,185,129,0); }
        }
        @keyframes caskDotBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        style={{
          position: 'relative',
          flexShrink: 0,
          background: PALETTE.header,
          borderBottom: `1px solid ${PALETTE.border}`,
          overflow: 'hidden',
        }}
      >
        {/* multi-department accent line */}
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, #3B82F6, #F59E0B, #10B981, #8B5CF6, #F59E0B)',
          }}
        />
        {/* animated sheen */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(110deg, transparent 32%, rgba(200,49,26,0.12) 47%, rgba(245,158,11,0.07) 55%, transparent 70%)',
            backgroundSize: '220% 100%',
            animation: 'caskSheen 14s linear infinite',
            pointerEvents: 'none',
          }}
        />
        {/* radial glow */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            left: '26%',
            width: 460,
            height: 320,
            background: 'radial-gradient(circle, rgba(200,49,26,0.18), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* grain */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: GRAIN,
            opacity: 0.5,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '28px 40px 30px',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-instrument), Georgia, serif',
                lineHeight: 1.1,
                color: PALETTE.text,
                letterSpacing: '-0.5px',
                margin: 0,
              }}
            >
              <span style={{ display: 'block', fontSize: 40 }}>CASK Construction</span>
              <span style={{ display: 'block', fontSize: 28, opacity: 0.75 }}>Financial Operating System</span>
            </h1>
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                color: PALETTE.text2,
              }}
            >
              One System&nbsp;·&nbsp;One Source of Truth&nbsp;·&nbsp;One Company
            </p>
          </div>

          {/* 0 Connected badge — prominent */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 20px',
              borderRadius: 12,
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.28)',
              boxShadow: '0 0 30px rgba(239,68,68,0.12)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 10px #EF4444',
                animation: 'caskDotBlink 1.8s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-geist), sans-serif',
                fontSize: 28,
                fontWeight: 700,
                color: PALETTE.text,
                lineHeight: 1,
                letterSpacing: '-1px',
              }}
            >
              0
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#EF4444',
              }}
            >
              Connected
            </span>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in"
        style={{ background: PALETTE.page, position: 'relative' }}
      >
        {/* faint page grain */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: GRAIN,
            opacity: 0.22,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', padding: '32px 40px 56px' }}>
          {/* Stats strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              background: PALETTE.card,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 36,
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            }}
          >
            {STATS.map((s, i) => (
              <StatSegment key={s.label} stat={s} index={i} />
            ))}
          </div>

          {/* Row 1 — Sales & Marketing, Operations, Finance */}
          <div style={{ marginBottom: 34 }}>
            <SectionHeader title="Departments" subtitle="Reporting owners & data feeds" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
              {DEPARTMENTS.map((d) => (
                <DeptCard key={d.name} dept={d} />
              ))}
            </div>
          </div>

          {/* Row 2 — Human Resources + Executive Command Center */}
          <div style={{ marginBottom: 34 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              <DeptCard dept={HR_DEPT} />
              <DeptCard dept={EXEC_DEPT} important />
            </div>
          </div>

          {/* Row 3 — Standard Reports, Automated Alerts, Ad-Hoc Analysis */}
          <div style={{ marginBottom: 34 }}>
            <SectionHeader title="Outputs" subtitle="Reports, alerts & analysis" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
              {MINI_CARDS.map((c) => (
                <MiniReportCard key={c.title} card={c} />
              ))}
            </div>
          </div>

          {/* Row 4 — Data Sources */}
          <div>
            <SectionHeader title="Data Sources" />
            <div
              style={{
                position: 'relative',
                background: PALETTE.card,
                backgroundImage: GRID_BG,
                backgroundSize: '22px 22px',
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 16,
                padding: '24px 26px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <IconBadge icon="database" color="#64748B" size={34} />
                <div style={{ fontSize: 16, fontWeight: 700, color: PALETTE.text, letterSpacing: '-0.2px' }}>
                  Connected Systems
                </div>
              </div>
              <div style={{ fontSize: 13, color: PALETTE.text3, marginBottom: 18, marginLeft: 46 }}>
                All systems feed CASK Construction Financial Operating System
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {DATA_SOURCES.map((s) => (
                  <DataSourcePill key={s.name} name={s.name} status={s.status} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Insights + CCFOS AI — overlays the shared AI panel column, this page only */}
      <CommandCenterPanel />
    </>
  )
}
