'use client'
// src/app/(app)/command-center/page.tsx
// CASK Operating System — Command Center
// Framework only. All data hardcoded — no Supabase, no real connections yet.

import { useState } from 'react'
import { TopBar, PillRed } from '@/components/ui'

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
}

// ── Data (hardcoded) ─────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
  {
    name: 'Sales & Marketing',
    icon: 'target',
    badge: '#3B82F6',
    border: '#3B82F6',
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

// ── Sub-components ───────────────────────────────────────────────────

const ICON_PATHS: Record<string, React.ReactNode> = {
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  wrench: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  dollar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  building: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 7h2"/><path d="M15 11h2"/><path d="M15 15h2"/>
    </svg>
  ),
  filetext: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
}

function IconBadge({ icon, color }: { icon: string; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 2px 8px ${color}55`,
      }}
    >
      {ICON_PATHS[icon]}
    </div>
  )
}

function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: STATUS_COLOR[status],
        flexShrink: 0,
        display: 'inline-block',
        boxShadow: `0 0 5px ${STATUS_COLOR[status]}55`,
      }}
    />
  )
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 20,
        color: STATUS_COLOR[status],
        background: `${STATUS_COLOR[status]}14`,
        border: `1px solid ${STATUS_COLOR[status]}33`,
      }}
    >
      <StatusDot status={status} size={6} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '1.2px',
          color: 'var(--text2)',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {subtitle && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
    </div>
  )
}

function DeptCard({ dept }: { dept: Department }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        borderTop: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderRight: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderBottom: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderLeft: `4px solid ${dept.border}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Header: icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <IconBadge icon={dept.icon} color={dept.badge} />
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
          {dept.name}
        </span>
      </div>
      {/* Owner row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 9, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Owner:
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>
          {dept.owner}
        </span>
      </div>

      {/* Frequency badge */}
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 20,
            color: 'var(--text2)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
          }}
        >
          {dept.frequency}
        </span>
      </div>

      {/* Data source + connection status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
            Data Source
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
            {dept.dataSource}
          </div>
        </div>
        <StatusBadge status={dept.status} />
      </div>

      {/* Reports list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 }}>
        {dept.reports.map((r) => (
          <div
            key={r.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '6px 4px',
              borderRadius: 6,
            }}
          >
            <StatusDot status={r.status} size={7} />
            <span
              style={{
                fontSize: 13,
                fontWeight: r.status === 'red' ? 400 : 500,
                color: r.status === 'red' ? 'var(--text3)' : 'var(--text)',
              }}
            >
              {r.name}
            </span>
          </div>
        ))}
      </div>

      {/* Connect button (disabled) */}
      <button
        disabled
        style={{
          marginTop: 'auto',
          width: '100%',
          padding: '9px 14px',
          borderRadius: 8,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text3)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'not-allowed',
        }}
      >
        Connect →
      </button>
    </div>
  )
}

function MiniReportCard({ card }: { card: MiniCard }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '16px 18px',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <IconBadge icon={card.icon} color={card.badge} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{card.title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {card.items.map((item) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px' }}>
            <StatusDot status={item.status} size={7} />
            <span
              style={{
                fontSize: 13,
                fontWeight: item.status === 'red' ? 400 : 500,
                color: item.status === 'red' ? 'var(--text3)' : 'var(--text)',
              }}
            >
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataSourcePill({ name, status }: { name: string; status: Status }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 14px',
        borderRadius: 9,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
      }}
    >
      <StatusDot status={status} size={8} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{STATUS_LABEL[status]}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  return (
    <>
      <TopBar title="CASK Operating System" subtitle="One System. One Source of Truth. One Company.">
        <PillRed>0 Connected</PillRed>
      </TopBar>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-7 animate-page-in">

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatTile value={5} label="Departments" />
          <StatTile value={0} label="Connected" />
          <StatTile value={49} label="Reports" />
          <StatTile value={4} label="Automated Alerts" />
        </div>

        {/* Row 1 — Sales & Marketing, Operations, Finance */}
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="DEPARTMENTS" subtitle="Reporting owners & data feeds" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {DEPARTMENTS.map((d) => (
              <DeptCard key={d.name} dept={d} />
            ))}
          </div>
        </div>

        {/* Row 2 — Human Resources + Executive Command Center (wider) */}
        <div style={{ marginBottom: 28 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            <DeptCard dept={HR_DEPT} />
            <DeptCard dept={EXEC_DEPT} />
          </div>
        </div>

        {/* Row 3 — Standard Reports, Automated Alerts, Ad-Hoc Analysis */}
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="OUTPUTS" subtitle="Reports, alerts & analysis" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {MINI_CARDS.map((c) => (
              <MiniReportCard key={c.title} card={c} />
            ))}
          </div>
        </div>

        {/* Row 4 — Data Sources */}
        <div style={{ marginBottom: 12 }}>
          <SectionHeader title="DATA SOURCES" />
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
              Data Sources
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
              All systems feed CASK Operating System
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {DATA_SOURCES.map((s) => (
                <DataSourcePill key={s.name} name={s.name} status={s.status} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
