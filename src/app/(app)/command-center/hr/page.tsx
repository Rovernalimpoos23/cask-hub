'use client'
// src/app/(app)/command-center/hr/page.tsx
// CASK Operating System — Human Resources department
// Framework / placeholder only. All data hardcoded — no Supabase, no real connections yet.
// Premium design matched to the Command Center page. Theme-adaptive (light + dark).

import { useState } from 'react'
import Link from 'next/link'
import { TopBar, PillRed } from '@/components/ui'

const ACCENT = '#8B5CF6'
const RED = '#EF4444'

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")"
const GRID_BG =
  'linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)'

// ── Data (hardcoded) ─────────────────────────────────────────────────

const STATS: { label: string; value: string }[] = [
  { label: 'Total Employees', value: '0' },
  { label: 'Open Positions', value: '0' },
  { label: 'Training Compliance', value: '0%' },
  { label: 'Employee Satisfaction', value: '0%' },
]

const REPORTS: { icon: string; name: string; description: string }[] = [
  { icon: '🧑‍💼', name: 'Hiring Pipeline', description: 'Track open positions and candidates in the pipeline' },
  { icon: '📇', name: 'Employee Roster', description: 'Complete list of all active CASK employees' },
  { icon: '🎓', name: 'Training Compliance', description: 'Monitor completion of required training programs' },
  { icon: '🔁', name: 'Retention Metrics', description: 'Track employee retention and turnover rates' },
  { icon: '😊', name: 'Employee Satisfaction', description: 'Measure team satisfaction and engagement scores' },
  { icon: '📅', name: 'Events Calendar', description: 'Company events, reviews and key HR dates' },
  { icon: '📝', name: 'Performance Reviews', description: 'Track scheduled and completed performance reviews' },
  { icon: '💵', name: 'Compensation Summary', description: 'Salary and compensation overview by department' },
  { icon: '💰', name: 'Budget vs Actual', description: 'Compare HR budget against actual spend' },
]

const DATA_SOURCE_OPTIONS = ['HR System']

// ── Shared icons ─────────────────────────────────────────────────────

function HeroIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function LockIcon({ size = 11, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function IconBadge({ size = 52, children }: { size?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        background: `linear-gradient(150deg, ${ACCENT}, ${ACCENT}cc)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 6px 18px ${ACCENT}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}
    >
      {children}
    </div>
  )
}

function StatusBadge({ color, label, locked = false }: { color: string; label: string; locked?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        padding: '5px 11px',
        borderRadius: 20,
        color,
        background: `${color}1f`,
        border: `1px solid ${color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}
    >
      {locked ? <LockIcon size={11} color={color} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
      {label}
    </span>
  )
}

function StatSegment({ value, label, index }: { value: string; label: string; index: number }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '22px 24px',
        borderLeft: index > 0 ? '1px solid var(--border)' : 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 120% at 85% 0%, ${ACCENT}10, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-1.5px',
          color: 'var(--text)',
          textShadow: `0 0 28px ${ACCENT}22`,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '1.2px',
          marginTop: 12,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--text2)', textTransform: 'uppercase' }}>
        {title}
      </span>
      {subtitle && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</span>}
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border), transparent)' }} />
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
        position: 'relative',
        background: 'var(--surface)',
        backgroundImage: GRID_BG,
        backgroundSize: '22px 22px',
        borderTop: `1px solid ${hovered ? `${ACCENT}44` : 'var(--border)'}`,
        borderRight: `1px solid ${hovered ? `${ACCENT}44` : 'var(--border)'}`,
        borderBottom: `1px solid ${hovered ? `${ACCENT}44` : 'var(--border)'}`,
        borderLeft: `6px solid ${ACCENT}`,
        borderRadius: 14,
        padding: '18px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease',
        boxShadow: hovered ? `0 14px 30px -10px ${ACCENT}55, 0 0 0 1px ${ACCENT}22` : '0 1px 3px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: `${ACCENT}16`,
            border: `1px solid ${ACCENT}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
          {name}
        </span>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', margin: 0, marginBottom: 16 }}>
        {description}
      </p>

      <div style={{ marginTop: 'auto' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 11px',
            borderRadius: 20,
            color: 'var(--text3)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
          }}
        >
          <LockIcon size={11} /> Coming Soon
        </span>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────

export default function HRDepartmentPage() {
  return (
    <>
      <TopBar title="Human Resources" subtitle="HR Manager · Monthly">
        <PillRed>Not Connected</PillRed>
      </TopBar>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-7 animate-page-in" style={{ background: 'var(--bg)' }}>

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

        {/* Hero banner — premium dark */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1c1c20 0%, #121215 100%)',
            borderLeft: `6px solid ${ACCENT}`,
            borderRadius: 14,
            padding: '24px 26px',
            marginBottom: 28,
            boxShadow: '0 10px 34px -14px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ position: 'absolute', top: -100, left: '18%', width: 380, height: 260, background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.4, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
              <IconBadge><HeroIcon /></IconBadge>
              <div style={{ minWidth: 0 }}>
                <h1 className="font-serif" style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 30, fontWeight: 400, letterSpacing: '-0.5px', color: '#fafaf9', lineHeight: 1.05, margin: 0 }}>
                  Human Resources
                </h1>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginTop: 7 }}>
                  HR Manager · Monthly
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <StatusBadge color={RED} label="Not Connected" locked />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Data Source: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>HR System</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 32,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}
          className="md:!grid-cols-4"
        >
          {STATS.map((s, i) => (
            <StatSegment key={s.label} value={s.value} label={s.label} index={i} />
          ))}
        </div>

        {/* Reports grid */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Reports" subtitle="9 reports · unlock by connecting your HR System" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {REPORTS.map((r) => (
              <ReportCard key={r.name} icon={r.icon} name={r.name} description={r.description} />
            ))}
          </div>
        </div>

        {/* Connect section */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 16,
            padding: '28px 30px',
            background: `linear-gradient(135deg, ${ACCENT}16, ${ACCENT}06)`,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>
            Connect Your Data Source
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
            Link your HR System to unlock all 9 reports
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {DATA_SOURCE_OPTIONS.map((source) => (
              <button
                key={source}
                disabled
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 16px',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  border: `1px solid ${ACCENT}33`,
                  color: 'var(--text2)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'not-allowed',
                }}
              >
                {source}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${ACCENT}14`,
                    border: `1px solid ${ACCENT}30`,
                    color: ACCENT,
                  }}
                >
                  Coming Soon
                </span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Need access? Contact Kaitlyn Grunenberg or Rovern
          </div>
        </div>
      </div>
    </>
  )
}
