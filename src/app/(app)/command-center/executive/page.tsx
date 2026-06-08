'use client'
// src/app/(app)/command-center/executive/page.tsx
// CASK Operating System — Executive Command Center
// Framework / placeholder only. All data hardcoded — no Supabase, no real connections yet.

import { useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/ui'

const ACCENT = '#F59E0B'
const GREEN = '#10B981'
const RED = '#EF4444'

// ── Data (hardcoded) ─────────────────────────────────────────────────

const STATS: { label: string; value: string; badge?: boolean }[] = [
  { label: 'Departments Connected', value: '0/5' },
  { label: 'Total Reports Live', value: '1/49' },
  { label: 'Active Alerts', value: '0' },
  { label: 'Weekly Briefing', value: 'Ready', badge: true },
]

const DEPARTMENT_STATUS: { name: string; connected: boolean; href?: string }[] = [
  { name: 'Customer Journey', connected: true, href: '/customers' },
  { name: 'Sales & Marketing', connected: false, href: '/command-center/sales' },
  { name: 'Operations', connected: false, href: '/command-center/operations' },
  { name: 'Finance', connected: false, href: '/command-center/finance' },
  { name: 'Human Resources', connected: false, href: '/command-center/hr' },
]

interface ExecReport {
  icon: string
  name: string
  description: string
  live: boolean
  href?: string
  cta?: string
}

const REPORTS: ExecReport[] = [
  { icon: '📊', name: 'Executive Dashboard', description: 'Real-time company overview — already live in CASK Hub', live: true, href: '/dashboard', cta: 'Open Dashboard →' },
  { icon: '📰', name: 'Weekly Leadership Report', description: 'Auto-generated weekly summary for the leadership team', live: false },
  { icon: '🏅', name: 'Company Scorecard', description: 'Overall company performance against strategic goals', live: false },
  { icon: '📈', name: 'KPI Overview', description: 'Key performance indicators across all departments', live: false },
  { icon: '📋', name: 'Backlog Report', description: 'Pipeline of upcoming projects and work backlog', live: false },
  { icon: '💵', name: 'Cash Position', description: 'Real-time cash position and liquidity overview', live: false },
  { icon: '💹', name: 'Profitability Overview', description: 'Company-wide profitability and margin analysis', live: false },
  { icon: '🗂️', name: 'Department Scorecards', description: 'Individual department performance scorecards', live: false },
  { icon: '🎯', name: 'Strategic Initiatives', description: 'Track progress on key strategic company initiatives', live: false },
  { icon: '⚠️', name: 'Risk & Opportunity Log', description: 'Monitor risks and opportunities across the business', live: false },
  { icon: '💰', name: 'Budget vs Actual', description: 'Company-wide budget vs actual performance', live: false },
]

// ── Sub-components ───────────────────────────────────────────────────

function StatTile({ value, label, badge }: { value: string; label: string; badge?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      {badge ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 20,
            color: GREEN,
            background: `${GREEN}14`,
            border: `1px solid ${GREEN}33`,
            marginBottom: 8,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: `0 0 5px ${GREEN}55` }} />
          {value}
        </span>
      ) : (
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
          {value}
        </div>
      )}
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

function ConnectionPill({ name, connected }: { name: string; connected: boolean }) {
  const color = connected ? GREEN : RED
  return (
    <div
      style={{
        flex: '1 1 160px',
        minWidth: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          color,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}55` }} />
        {connected ? 'Connected' : 'Not Connected'}
      </span>
    </div>
  )
}

function ReportCard({ report }: { report: ExecReport }) {
  const [hovered, setHovered] = useState(false)
  const isLive = report.live

  const card = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        borderTop: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderRight: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderBottom: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderLeft: `4px solid ${isLive ? GREEN : ACCENT}`,
        borderRadius: 12,
        padding: '18px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: isLive ? 'pointer' : 'default',
        opacity: isLive ? 1 : hovered ? 1 : 0.88,
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, opacity 160ms ease',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Header: icon + name + live tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{report.icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25, flex: 1, minWidth: 0 }}>
          {report.name}
        </span>
        {isLive && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.3px',
              padding: '2px 8px',
              borderRadius: 20,
              color: GREEN,
              background: `${GREEN}14`,
              border: `1px solid ${GREEN}33`,
              flexShrink: 0,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, boxShadow: `0 0 5px ${GREEN}55` }} />
            Live
          </span>
        )}
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', margin: 0, marginBottom: 16 }}>
        {report.description}
      </p>

      {/* Footer */}
      <div style={{ marginTop: 'auto' }}>
        {isLive ? (
          <span
            style={{
              display: 'inline-block',
              width: '100%',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              padding: '9px 14px',
              borderRadius: 8,
              color: GREEN,
              background: `${GREEN}14`,
              border: `1px solid ${GREEN}40`,
            }}
          >
            {report.cta ?? 'Open →'}
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              color: 'var(--text3)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
            }}
          >
            🔒 Coming Soon
          </span>
        )}
      </div>
    </div>
  )

  if (isLive && report.href) {
    return (
      <Link href={report.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        {card}
      </Link>
    )
  }
  return card
}

function ConnectRow({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        <span style={{ fontSize: 14 }}>{connected ? '✅' : '🔴'}</span>
        {name}
        <span style={{ fontSize: 12, fontWeight: 500, color: connected ? GREEN : 'var(--text3)' }}>
          {connected ? '— Connected' : '— Not Connected'}
        </span>
      </span>
      {!connected && (
        <button
          disabled
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 8,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text3)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'not-allowed',
            opacity: 0.7,
          }}
        >
          Connect
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              padding: '2px 5px',
              borderRadius: 4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text3)',
            }}
          >
            Coming Soon
          </span>
        </button>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

export default function ExecutiveDepartmentPage() {
  return (
    <>
      <TopBar title="Executive Command Center" subtitle="Executive Team · Weekly">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 20,
            color: ACCENT,
            background: `${ACCENT}14`,
            border: `1px solid ${ACCENT}33`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 5px ${ACCENT}55` }} />
          In Progress
        </span>
      </TopBar>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-7 animate-page-in">

        {/* Back link */}
        <Link
          href="/command-center"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text3)',
            textDecoration: 'none',
            marginBottom: 18,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = ACCENT }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          ← Command Center
        </Link>

        {/* Hero header */}
        <div
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            borderLeft: `4px solid ${ACCENT}`,
            borderRadius: 12,
            padding: '20px 22px',
            marginBottom: 28,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: ACCENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 2px 10px ${ACCENT}55`,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /><path d="M3 15h6" /><path d="M15 7h2" /><path d="M15 11h2" /><path d="M15 15h2" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="font-serif" style={{ fontSize: 24, fontWeight: 400, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1.1, margin: 0 }}>
                Executive Command Center
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                Executive Team · Weekly
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 20,
                color: ACCENT,
                background: `${ACCENT}14`,
                border: `1px solid ${ACCENT}33`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 5px ${ACCENT}55` }} />
              In Progress
            </span>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Data Source: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>All Departments</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {STATS.map((s) => (
            <StatTile key={s.label} value={s.value} label={s.label} badge={s.badge} />
          ))}
        </div>

        {/* Department connections */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text2)', textTransform: 'uppercase' }}>
              Department Connections
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
            Connect all departments to unlock the full Executive view
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {DEPARTMENT_STATUS.map((d) => (
              <ConnectionPill key={d.name} name={d.name} connected={d.connected} />
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text2)', textTransform: 'uppercase' }}>
              Reports
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>11 reports · 1 live, 10 unlock as departments connect</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {REPORTS.map((r) => (
              <ReportCard key={r.name} report={r} />
            ))}
          </div>
        </div>

        {/* Connect section */}
        <div
          style={{
            borderRadius: 14,
            padding: '26px 28px',
            background: `linear-gradient(135deg, ${ACCENT}14, ${ACCENT}08)`,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Unlock the Full Executive View
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
            Connect all 5 departments to power the Executive Command Center
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {DEPARTMENT_STATUS.map((d) => (
              <ConnectRow key={d.name} name={d.name} connected={d.connected} />
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Each department you connect adds more intelligence to the Executive Command Center
          </div>
        </div>
      </div>
    </>
  )
}
