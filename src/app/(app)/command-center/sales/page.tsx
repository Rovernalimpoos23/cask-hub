'use client'
// src/app/(app)/command-center/sales/page.tsx
// CASK Operating System — Sales & Marketing department
// Framework / placeholder only. All data hardcoded — no Supabase, no real connections yet.

import { useState } from 'react'
import Link from 'next/link'
import { TopBar, PillRed } from '@/components/ui'

const ACCENT = '#3B82F6'

// ── Data (hardcoded) ─────────────────────────────────────────────────

const STATS: { label: string; value: string }[] = [
  { label: 'Total Leads', value: '0' },
  { label: 'Active Pipeline', value: '$0' },
  { label: 'Win Rate', value: '0%' },
  { label: 'Revenue This Month', value: '$0' },
]

const REPORTS: { icon: string; name: string; description: string }[] = [
  { icon: '📊', name: 'Pipeline Report', description: 'Track all active deals by stage, value and close date' },
  { icon: '📈', name: 'Revenue Forecast', description: 'Project monthly and quarterly revenue based on pipeline' },
  { icon: '🎯', name: 'Lead Source Report', description: 'See where your leads are coming from — referrals, ads, organic' },
  { icon: '🔄', name: 'Conversion Metrics', description: 'Track lead to close conversion rates across all stages' },
  { icon: '⏱️', name: 'Proposal Aging', description: 'Monitor proposals that have been outstanding too long' },
  { icon: '🏆', name: 'Win / Loss Report', description: 'Analyze won and lost deals to improve close rates' },
  { icon: '💹', name: 'Marketing ROI', description: 'Measure return on investment for all marketing activities' },
  { icon: '⚖️', name: 'Capacity Alignment', description: 'Align sales pipeline with operations capacity' },
  { icon: '💰', name: 'Budget vs Actual', description: 'Compare sales budget targets against actual performance' },
]

const CRM_OPTIONS = ['HubSpot', 'Salesforce', 'Pipedrive']

// ── Sub-components ───────────────────────────────────────────────────

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
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

function ReportCard({ icon, name, description }: { icon: string; name: string; description: string }) {
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
        borderLeft: `4px solid ${ACCENT}`,
        borderRadius: 12,
        padding: '18px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: hovered ? 1 : 0.88,
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, opacity 160ms ease',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Header: icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25 }}>
          {name}
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', margin: 0, marginBottom: 16 }}>
        {description}
      </p>

      {/* Coming Soon badge */}
      <div style={{ marginTop: 'auto' }}>
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
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

export default function SalesDepartmentPage() {
  return (
    <>
      <TopBar title="Sales & Marketing" subtitle="Sales Manager · Weekly / Monthly">
        <PillRed>Not Connected</PillRed>
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
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="font-serif" style={{ fontSize: 24, fontWeight: 400, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1.1, margin: 0 }}>
                Sales &amp; Marketing
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                Sales Manager · Weekly / Monthly
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
                color: '#EF4444',
                background: '#EF444414',
                border: '1px solid #EF444433',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 5px #EF444455' }} />
              Not Connected
            </span>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Data Source: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>CRM / Sales Pipeline</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {STATS.map((s) => (
            <StatTile key={s.label} value={s.value} label={s.label} />
          ))}
        </div>

        {/* Reports grid */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text2)', textTransform: 'uppercase' }}>
              Reports
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>9 reports · unlock by connecting your CRM</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {REPORTS.map((r) => (
              <ReportCard key={r.name} icon={r.icon} name={r.name} description={r.description} />
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
            Connect Your Data Source
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
            Link your CRM / Sales Pipeline to unlock all 9 reports
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {CRM_OPTIONS.map((crm) => (
              <button
                key={crm}
                disabled
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 9,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'not-allowed',
                  opacity: 0.7,
                }}
              >
                {crm}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text3)',
                  }}
                >
                  Coming Soon
                </span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Using a different CRM? Contact Rovern
          </div>
        </div>
      </div>
    </>
  )
}
