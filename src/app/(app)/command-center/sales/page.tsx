'use client'
// src/app/(app)/command-center/sales/page.tsx
// CASK Operating System — Sales & Marketing department
// Live dashboard backed by Supabase (sales_kpi_data, sales_hot_list, sales_conversions,
// sales_funnel_120, sales_lead_sources). Falls back to seeded sample data if the
// tables are empty or unreachable. Premium design matched to the Command Center page.

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import DailyEntryForm from './components/DailyEntryForm'
import ExportPDF from './components/ExportPDF'

const ACCENT = '#3B82F6' // brand blue (Sales & Marketing)
const RED = '#EF4444' // below-target
const GREEN = '#16A34A' // on / above target
const AMBER = '#D97706' // mid-range days badge
const HOT = '#EA580C' // hot-lead status pill
const NEUTRAL = '#9CA3AF' // empty / n-a

// ── Floating Sales AI — palette + chat config ────────────────────────
// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: ACCENT,
}

const AI_GREETING =
  "Sales AI online. I have context on the Sales & Marketing pipeline, forecasts, lead sources, and the 9 reports. Ask about pipeline, forecasts, win rates, or what to connect next."

const QUICK_PROMPTS = ['Pipeline overview', 'Revenue forecast', 'What to connect?']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// Fractal-noise grain + faint engineering grid — same texture as Command Center.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")"
const GRID_BG =
  'linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)'

// REPORTS — 9 locked report cards (Coming Soon until a CRM is connected).
const REPORTS: { name: string; description: string }[] = [
  { name: 'Pipeline Report', description: 'Track all active deals by stage, value and close date' },
  { name: 'Revenue Forecast', description: 'Project monthly and quarterly revenue based on pipeline' },
  { name: 'Lead Source Report', description: 'See where your leads are coming from — referrals, ads, organic' },
  { name: 'Conversion Metrics', description: 'Track lead to close conversion rates across all stages' },
  { name: 'Proposal Aging', description: 'Monitor proposals that have been outstanding too long' },
  { name: 'Win / Loss Report', description: 'Analyze won and lost deals to improve close rates' },
  { name: 'Marketing ROI', description: 'Measure all marketing activities return on investment' },
  { name: 'Capacity Alignment', description: 'Align sales operations and capacity' },
  { name: 'Budget vs Actual', description: 'Compare actual performance against budget targets' },
]

// ── Data shapes + seeded fallbacks ───────────────────────────────────
// Live data comes from Supabase; these seeds (Jeff Azcona's Q2-2026 KPI tracker)
// render the dashboard when the tables are empty or unreachable.

interface KpiRow { metric: string; actual: number; target: number }
interface HotRow { prospect_name: string; address: string | null; project_type: string | null; proposal_amount: number; days_since_meeting: number | null; status: string | null }
interface ConvRow { stage: string; actual_pct: number; target_pct: number }
interface FunnelRow { stage: string; rolling_actual: number; rolling_target: number; rolling_pct: number; avg_days: number | null }
interface SourceRow { source: string; count: number; pct: number }

// New dashboard tables (added below Lead Sources).
// TODO: these tables (sales_weekly_progress, sales_nps_stats, sales_monthly_funnel,
// sales_referrals_weekly) and an `address` column on sales_hot_list must be created
// in Supabase separately — migration SQL is out of scope for this page-only change.
// Until then the seeds below render the sections.
interface WeeklyRow { metric: string; actual: number; target: number }
interface NpsRow { label: string; value: string }
interface MonthlyFunnelRow { stage: string; actual: number; target: number }
interface ReferralRow { name: string; status: string }
interface PitRow { name: string; pit_submitted: number; ps_submitted: number; dept_team_review: number; dept_team_approval: number }

const KPI_SEED: KpiRow[] = [
  { metric: 'Inquiries', actual: 175, target: 200 },
  { metric: 'In-Person Meetings', actual: 40, target: 40 },
  { metric: '2nd Meetings', actual: 29, target: 30 },
  { metric: 'Pre-Con Signed', actual: 12, target: 12 },
  { metric: 'Sales NPS', actual: 0, target: 2 },
  { metric: 'Referrals Out', actual: 17, target: 30 },
]

const HOT_SEED: HotRow[] = [
  { prospect_name: 'Erce Phillips', address: 'St. Petersburg, FL', project_type: 'ADU', proposal_amount: 215000, days_since_meeting: 36, status: 'Hot Lead' },
  { prospect_name: 'Cainaan & Gabriella Lacy', address: 'St. Petersburg, FL', project_type: 'ADU', proposal_amount: 260000, days_since_meeting: 50, status: 'Hot Lead' },
  { prospect_name: 'Luis Beaumier', address: 'Tampa, FL', project_type: 'New Garage (Detached)', proposal_amount: 123625, days_since_meeting: 29, status: 'Hot Lead' },
  { prospect_name: 'Lindsay Cotto', address: 'Clearwater, FL', project_type: 'ADU', proposal_amount: 240000, days_since_meeting: 9, status: 'Hot Lead' },
  { prospect_name: 'Sean McCurdy', address: 'St. Petersburg, FL', project_type: 'ADU', proposal_amount: 0, days_since_meeting: 3, status: 'Hot Lead' },
  { prospect_name: 'Sue Hoatson', address: 'Largo, FL', project_type: 'ADU', proposal_amount: 260000, days_since_meeting: -4, status: 'Hot Lead' },
]

const CONV_SEED: ConvRow[] = [
  { stage: 'Lead to Contact Made', actual_pct: 81.71, target_pct: 75.0 },
  { stage: 'Lead to In-Person Meeting', actual_pct: 22.86, target_pct: 20.0 },
  { stage: 'Lead to Pre-Con', actual_pct: 6.86, target_pct: 7.5 },
  { stage: 'In-Person Meeting to Pre-Con', actual_pct: 30.0, target_pct: 37.5 },
  { stage: '1st Meeting to 2nd Meeting', actual_pct: 72.5, target_pct: 75.0 },
  { stage: '2nd In-Person to Pre-Con', actual_pct: 41.38, target_pct: 50.0 },
]

const FUNNEL_SEED: FunnelRow[] = [
  { stage: 'Inquiries', rolling_actual: 260, rolling_target: 267, rolling_pct: 98, avg_days: null },
  { stage: 'Ideal Leads', rolling_actual: 151, rolling_target: 160, rolling_pct: 94, avg_days: null },
  { stage: 'Contact Made', rolling_actual: 203, rolling_target: 200, rolling_pct: 102, avg_days: 60 },
  { stage: '1st In-Person', rolling_actual: 52, rolling_target: 53, rolling_pct: 98, avg_days: 52 },
  { stage: '2nd In-Person', rolling_actual: 32, rolling_target: 40, rolling_pct: 80, avg_days: 56 },
  { stage: 'Pre-Con', rolling_actual: 15, rolling_target: 20, rolling_pct: 75, avg_days: 62 },
]

const SOURCE_SEED: SourceRow[] = [
  { source: 'Google', count: 72, pct: 33 },
  { source: 'Other', count: 88, pct: 41 },
  { source: 'Referral', count: 21, pct: 10 },
  { source: 'Signage', count: 16, pct: 7 },
  { source: 'Flyer', count: 9, pct: 4 },
  { source: 'Facebook', count: 4, pct: 2 },
  { source: 'Instagram', count: 3, pct: 1 },
  { source: 'Print Ad', count: 2, pct: 1 },
]

// TODO: weekly / monthly / referral seed values are placeholders pending Jeff's
// actual Week of Jun 15–19 and June 2026 numbers. NPS values are confirmed.
const WEEKLY_SEED: WeeklyRow[] = [
  { metric: 'Inquiries', actual: 38, target: 40 },
  { metric: 'In-Person Meetings', actual: 8, target: 8 },
  { metric: '2nd Meetings', actual: 5, target: 6 },
  { metric: 'Pre-Con Signed', actual: 2, target: 3 },
  { metric: 'Referrals Out', actual: 4, target: 6 },
]

const NPS_SEED: NpsRow[] = [
  { label: 'NPS Volume', value: '17' },
  { label: 'Average', value: '9.9' },
  { label: 'R12 Average', value: '9.7' },
  { label: '2026 Total', value: '34' },
  { label: 'Grand Total NPS', value: '63' },
]

const MONTHLY_FUNNEL_SEED: MonthlyFunnelRow[] = [
  { stage: 'Total Leads', actual: 42, target: 42 },
  { stage: 'Ideal Leads', actual: 28, target: 25 },
  { stage: 'Contact Made', actual: 35, target: 32 },
  { stage: '1st In-Person', actual: 9, target: 8 },
  { stage: '2nd In-Person', actual: 6, target: 6 },
  { stage: 'Pre-Con', actual: 0, target: 3 },
]

// Canonical monthly funnel targets by stage. Used to fill the Target column when
// the sales_monthly_funnel.target value is blank/null in Supabase.
const MONTHLY_TARGETS: Record<string, number> = {
  'Total Leads': 42,
  'Ideal Leads': 25,
  'Contact Made': 32,
  '1st In-Person': 8,
  '2nd In-Person': 6,
  'Pre-Con': 3,
}

const REFERRALS_SEED: ReferralRow[] = [
  { name: 'Bayfront Electric', status: 'Referred out 6/18' },
  { name: 'Sound Insulation Inc', status: 'Referred out 6/16' },
  { name: 'Gulf Coast HVAC', status: 'Pending — awaiting contact' },
  { name: 'ABC Plumbing', status: 'Do not refer — pending review' },
  { name: 'Sunshine Roofing', status: 'Do not refer — quality concerns' },
]

const PIT_SEED: PitRow[] = [
  { name: 'Jeff Azcona', pit_submitted: 1, ps_submitted: 7, dept_team_review: 7, dept_team_approval: 6 },
  { name: 'Calin Noonan', pit_submitted: 0, ps_submitted: 1, dept_team_review: 1, dept_team_approval: 1 },
  { name: 'Kevin Joshua Balmaceda', pit_submitted: 1, ps_submitted: 1, dept_team_review: 1, dept_team_approval: 1 },
  { name: 'Leonilo Jr. Abbu', pit_submitted: 1, ps_submitted: 1, dept_team_review: 0, dept_team_approval: 0 },
  { name: 'Joseph Estelloso', pit_submitted: 1, ps_submitted: 0, dept_team_review: 0, dept_team_approval: 0 },
]

// Quarter targets per column (Dept Team Approval has no target).
const PIT_TARGETS: (number | null)[] = [6, 6, 6, null]

// Canonical display order (Supabase has no ordering column for these).
const KPI_ORDER = KPI_SEED.map((r) => r.metric)
const CONV_ORDER = CONV_SEED.map((r) => r.stage)
const FUNNEL_ORDER = FUNNEL_SEED.map((r) => r.stage)
const WEEKLY_ORDER = WEEKLY_SEED.map((r) => r.metric)
const NPS_ORDER = NPS_SEED.map((r) => r.label)
const MONTHLY_FUNNEL_ORDER = MONTHLY_FUNNEL_SEED.map((r) => r.stage)
const REFERRALS_ORDER = REFERRALS_SEED.map((r) => r.name)

// ── Formatting + small style helpers ─────────────────────────────────

const clamp = (n: number) => Math.max(0, Math.min(100, n))
function fmtNum(v: number): string { return (Number(v) || 0).toLocaleString('en-US') }
function fmtMoney(v: number): string { return '$' + Math.round(Number(v) || 0).toLocaleString('en-US') }

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '18px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11.5,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
    color,
    background: `${color}1a`,
    border: `1px solid ${color}33`,
    whiteSpace: 'nowrap',
  }
}

function orderRows<T>(rows: T[], key: keyof T, order: string[]): T[] {
  return [...rows].sort((a, b) => {
    const ia = order.indexOf(String(a[key]))
    const ib = order.indexOf(String(b[key]))
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
  })
}

function sortHot(rows: HotRow[]): HotRow[] {
  return [...rows].sort((a, b) => (a.days_since_meeting ?? 9999) - (b.days_since_meeting ?? 9999))
}

// ── Shared icons ─────────────────────────────────────────────────────

function HeroIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
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

function PlusIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function DownloadIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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

// Section label with a short red accent line + subtitle below — CASK Hub style.
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 30, height: 3, borderRadius: 2, background: 'var(--red)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--text)' }}>
          {title}
        </span>
      </div>
      {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 7, marginLeft: 42 }}>{subtitle}</div>}
    </div>
  )
}

// Generic rounded progress bar.
function Bar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: 999, background: 'var(--surface2)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${clamp(pct)}%`, background: color, borderRadius: 999, transition: 'width 600ms ease' }} />
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16 }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text3)' }}>
          {it.line ? (
            <span style={{ width: 2, height: 13, background: it.color, borderRadius: 1 }} />
          ) : (
            <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}

// ── SECTION 1 — Daily KPI Tracker card ───────────────────────────────
function KpiCard({ row }: { row: KpiRow }) {
  const actual = Number(row.actual) || 0
  const target = Number(row.target) || 0
  const pct = target > 0 ? (actual / target) * 100 : actual > 0 ? 100 : 0
  const ok = actual >= target
  const color = ok ? GREEN : RED
  const diff = actual - target
  const diffLabel = diff === 0 ? 'On target' : diff > 0 ? `+${fmtNum(diff)} above` : `${fmtNum(-diff)} below`
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{row.metric}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)' }}>{fmtNum(actual)}</span>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>/ {fmtNum(target)} target</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <Bar pct={pct} color={color} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5 }}>
        <span style={{ fontWeight: 700, color }}>{Math.round(pct)}%</span>
        <span style={{ color: 'var(--text3)' }}>{diffLabel}</span>
      </div>
    </div>
  )
}

// ── SECTION 2 — Hot List ─────────────────────────────────────────────
function DaysBadge({ days }: { days: number | null }) {
  if (days == null) return <span style={pillStyle(NEUTRAL)}>—</span>
  if (days < 0) {
    const d = -days
    return <span style={pillStyle(GREEN)}>Meeting in {d} {d === 1 ? 'day' : 'days'}</span>
  }
  const color = days <= 14 ? GREEN : days > 30 ? RED : AMBER
  return <span style={pillStyle(color)}>{days} {days === 1 ? 'day' : 'days'}</span>
}

function HotList({ rows, total }: { rows: HotRow[]; total: number }) {
  const cols = '1.5fr 1.3fr 1fr 1.2fr 0.9fr'
  const headers = ['Prospect', 'Project Type', 'Proposal', 'Days Since Meeting', 'Status']
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', textAlign: i === 2 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={`${r.prospect_name}-${i}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '14px 20px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{r.prospect_name}</div>
                {r.address && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{r.address}</div>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{r.project_type || '—'}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{Number(r.proposal_amount) > 0 ? fmtMoney(Number(r.proposal_amount)) : '—'}</div>
              <div><DaysBadge days={r.days_since_meeting == null ? null : Number(r.days_since_meeting)} /></div>
              <div><span style={pillStyle(HOT)}>{r.status || 'Hot Lead'}</span></div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 10, padding: '14px 20px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)' }}>Total Pipeline</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{fmtMoney(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SECTION 3 — Sales Conversions ────────────────────────────────────
function ConvRowView({ row, last }: { row: ConvRow; last: boolean }) {
  const actual = Number(row.actual_pct) || 0
  const target = Number(row.target_pct) || 0
  const ok = actual >= target
  const color = ok ? GREEN : RED
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 1.3fr) 2fr auto', gap: 16, alignItems: 'center', padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.stage}</div>
      <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--surface2)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${clamp(actual)}%`, background: ACCENT, borderRadius: 999, transition: 'width 600ms ease' }} />
        <div title={`Target ${target}%`} style={{ position: 'absolute', left: `${clamp(target)}%`, top: -3, bottom: -3, width: 2, background: 'var(--red)', borderRadius: 1 }} />
      </div>
      <div style={{ textAlign: 'right', minWidth: 92 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>{actual.toFixed(2)}%</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Target {target.toFixed(1)}%</div>
      </div>
    </div>
  )
}

// ── SECTION 4 — Rolling 120-Day Funnel ───────────────────────────────
function FunnelTable({ rows }: { rows: FunnelRow[] }) {
  const cols = '1.1fr 1.8fr 0.7fr 0.7fr 0.6fr 0.8fr'
  const headers = ['Stage', 'Progress', 'Actual', 'Target', '%', 'Avg Days']
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 680 }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => {
            const pct = Number(r.rolling_pct) || 0
            const color = pct >= 100 ? GREEN : RED
            return (
              <div key={r.stage} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.stage}</div>
                <Bar pct={pct} color={color} />
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmtNum(Number(r.rolling_actual) || 0)}</div>
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text3)' }}>{fmtNum(Number(r.rolling_target) || 0)}</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color }}>{pct}%</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {r.avg_days == null ? (
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                  ) : (
                    <span style={pillStyle(ACCENT)}>{Number(r.avg_days)}d</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── SECTION 5 — Lead Sources ─────────────────────────────────────────
function SourceCard({ row, prominent }: { row: SourceRow; prominent: boolean }) {
  return (
    <div style={{ ...cardStyle, padding: '16px 18px', borderLeft: prominent ? `4px solid ${ACCENT}` : '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>{row.source}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', marginTop: 8 }}>{Number(row.pct)}%</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{fmtNum(Number(row.count) || 0)} leads</div>
    </div>
  )
}

// Loading skeleton for the dashboard body.
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="shimmer" style={{ height: 110, borderRadius: 16 }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="shimmer" style={{ height: 118, borderRadius: 14 }} />
        ))}
      </div>
      <div className="shimmer" style={{ height: 240, borderRadius: 16 }} />
    </div>
  )
}

// Locked report card — matches the original Command Center department report cards.
function ReportCard({ name, description }: { name: string; description: string }) {
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
            width: 32,
            height: 32,
            borderRadius: 8,
            background: ACCENT,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.5px',
            flexShrink: 0,
            boxShadow: `0 2px 8px ${ACCENT}55`,
          }}
        >
          {name.charAt(0).toUpperCase()}
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
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            padding: '5px 11px',
            borderRadius: 20,
            color: 'rgba(255,255,255,0.92)',
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <LockIcon size={10} color="rgba(255,255,255,0.92)" /> Coming Soon
        </span>
      </div>
    </div>
  )
}

// ── SECTION 6 — Current Week Progress card ───────────────────────────
function WeeklyCard({ row }: { row: WeeklyRow }) {
  const actual = Number(row.actual) || 0
  const target = Number(row.target) || 0
  const pct = target > 0 ? (actual / target) * 100 : actual > 0 ? 100 : 0
  const ok = pct >= 100
  const color = ok ? GREEN : RED
  const diff = actual - target
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{row.metric}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)' }}>{fmtNum(actual)}</span>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>/ {fmtNum(target)} target</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <Bar pct={pct} color={color} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5 }}>
        <span style={{ fontWeight: 700, color }}>{Math.round(pct)}%</span>
        {diff === 0 ? (
          <span style={{ fontWeight: 800, color: GREEN, letterSpacing: '0.5px' }}>HIT!</span>
        ) : (
          <span style={{ color: 'var(--text3)' }}>{diff > 0 ? `+${fmtNum(diff)} above` : `${fmtNum(-diff)} below`}</span>
        )}
      </div>
    </div>
  )
}

// ── SECTION 7 — Q2 NPS stat card ─────────────────────────────────────
function NpsStatCard({ row }: { row: NpsRow }) {
  return (
    <div style={{ ...cardStyle, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)' }}>{row.label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1.2px', color: 'var(--text)', marginTop: 10, lineHeight: 1 }}>{row.value}</div>
    </div>
  )
}

// ── SECTION 8 — Monthly Sales Funnel Snapshot table ──────────────────
function MonthlyFunnelTable({ rows }: { rows: MonthlyFunnelRow[] }) {
  const cols = '1.6fr 0.8fr 0.8fr 1fr'
  const headers = ['Stage', 'Actual', 'Target', 'Status']
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 520 }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', textAlign: i === 1 || i === 2 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => {
            const actual = Number(r.actual) || 0
            // Prefer the DB target; fall back to the canonical target when blank/null.
            const target = (Number(r.target) || MONTHLY_TARGETS[r.stage]) || 0
            const onTrack = actual >= target
            // Pre-Con is the critical sign-off stage — highlight when it lags.
            const critical = r.stage === 'Pre-Con' && actual < target
            return (
              <div key={r.stage} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', background: critical ? `${RED}0d` : 'transparent', borderLeft: critical ? `3px solid ${RED}` : '3px solid transparent' }}>
                <div style={{ fontSize: 13, fontWeight: critical ? 800 : 700, color: 'var(--text)' }}>{r.stage}</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmtNum(actual)}</div>
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text3)' }}>{fmtNum(target)}</div>
                <div>
                  <span style={pillStyle(onTrack ? GREEN : RED)}>{onTrack ? 'On Track' : 'Behind'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── SECTION 9 — Weekly Referrals Out list ────────────────────────────
function ReferralList({ rows }: { rows: ReferralRow[] }) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const status = r.status || ''
        // "Referred out" always wins — they were referred out regardless of any
        // "Do not refer" note that follows. Only show Paused when never referred out.
        const done = /referred out/i.test(status)
        const paused = !done && /do not refer/i.test(status)
        return (
          <div key={`${r.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{status || '—'}</div>
            </div>
            {paused && <span style={pillStyle(RED)}>Paused</span>}
            {done && <span style={pillStyle(GREEN)}>Done</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── SECTION — Q2 PIT Submissions table ───────────────────────────────
function PitTable({ rows }: { rows: PitRow[] }) {
  const cols = '1.6fr 1fr 1fr 1.1fr 1.2fr'
  const headers = ['Name', 'PIT Submitted', 'PS Submitted', 'Dept Team Review', 'Dept Team Approval']
  const keys: (keyof PitRow)[] = ['pit_submitted', 'ps_submitted', 'dept_team_review', 'dept_team_approval']
  // Column totals (actual) computed from the rows.
  const totals = keys.map((k) => rows.reduce((sum, r) => sum + (Number(r[k]) || 0), 0))
  const center: React.CSSProperties = { textAlign: 'center' }

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 640 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', textAlign: i === 0 ? 'left' : 'center' }}>{h}</div>
            ))}
          </div>

          {/* Data rows */}
          {rows.map((r, i) => (
            <div key={`${r.name}-${i}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
              {keys.map((k) => (
                <div key={k} style={{ ...center, fontSize: 13.5, color: 'var(--text)' }}>{fmtNum(Number(r[k]) || 0)}</div>
              ))}
            </div>
          ))}

          {/* Totals (Actual) — bold, green if >= target, red if below */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text2)' }}>Actual</div>
            {totals.map((t, ci) => {
              const target = PIT_TARGETS[ci]
              const color = target == null ? 'var(--text)' : t >= target ? GREEN : RED
              return <div key={ci} style={{ ...center, fontSize: 14, fontWeight: 800, color }}>{fmtNum(t)}</div>
            })}
          </div>

          {/* Quarter Targets — muted gray */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>Quarter Target</div>
            {PIT_TARGETS.map((t, ci) => (
              <div key={ci} style={{ ...center, fontSize: 13.5, color: 'var(--text3)' }}>{t == null ? '—' : fmtNum(t)}</div>
            ))}
          </div>

          {/* Difference % — green if >= 100%, red if below.
              Approval has no displayed quarter target but is still measured against 6. */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '13px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>Difference %</div>
            {totals.map((t, ci) => {
              const target = PIT_TARGETS[ci] ?? 6
              if (target === 0) return <div key={ci} style={{ ...center, fontSize: 13.5, color: 'var(--text3)' }}>—</div>
              const pct = Math.round((t / target) * 100)
              return <div key={ci} style={{ ...center, fontSize: 13.5, fontWeight: 700, color: pct >= 100 ? GREEN : RED }}>{pct}%</div>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Floating Sales AI button + chat drawer ───────────────────────────

function FloatingSalesAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      userEmailRef.current = user.email
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', user.email)
        .eq('page_context', '/command-center/sales')
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setMessages(history as PanelMsg[])
      }
    }
    loadHistory()
  }, [])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: '/command-center/sales', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/command-center/sales')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/command-center/sales',
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
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
      <style>{`
        @keyframes salesSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Sales & Marketing */}
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
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          background: 'var(--charcoal)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? '0 12px 30px -6px rgba(0,0,0,0.45)'
            : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>💬</span>
        Sales AI
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
            animation: 'salesSlideUp 220ms ease',
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
                Sales AI
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={clearHistory}
              title="Clear chat history"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear
            </button>
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
            </span>
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
                  {m.role === 'user' ? 'You' : 'Sales AI'}
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
                  Sales AI
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
                placeholder="Ask about pipeline, forecasts..."
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

export default function SalesDepartmentPage() {
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KpiRow[]>([])
  const [hot, setHot] = useState<HotRow[]>([])
  const [conv, setConv] = useState<ConvRow[]>([])
  const [funnel, setFunnel] = useState<FunnelRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [weekly, setWeekly] = useState<WeeklyRow[]>([])
  const [nps, setNps] = useState<NpsRow[]>([])
  const [monthly, setMonthly] = useState<MonthlyFunnelRow[]>([])
  const [referrals, setReferrals] = useState<ReferralRow[]>([])
  const [pit, setPit] = useState<PitRow[]>([])
  const [showDailyEntry, setShowDailyEntry] = useState(false)
  const [toast, setToast] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const supabase = createClient()
        const [k, h, c, f, s, w, n, m, ref] = await Promise.all([
          supabase.from('sales_kpi_data').select('metric, actual, target'),
          supabase.from('sales_hot_list').select('prospect_name, address, project_type, proposal_amount, days_since_meeting, status'),
          supabase.from('sales_conversions').select('stage, actual_pct, target_pct'),
          supabase.from('sales_funnel_120').select('stage, rolling_actual, rolling_target, rolling_pct, avg_days'),
          supabase.from('sales_lead_sources').select('source, count, pct'),
          supabase.from('sales_weekly_progress').select('metric, actual, target'),
          supabase.from('sales_nps_stats').select('label, value'),
          supabase.from('sales_monthly_funnel').select('stage, actual, target'),
          supabase.from('sales_referrals_weekly').select('name, status'),
        ])

        // Q2 PIT Submissions — fetched on its own so it always loads independently.
        const { data: pitData, error: pitError } = await supabase
          .from('sales_pit_data')
          .select('id, name, pit_submitted, ps_submitted, dept_team_review, dept_team_approval')
          .order('name', { ascending: true })

        if (pitError) console.error('PIT fetch error:', pitError)
        if (!active) return
        const kData = (k.data as KpiRow[] | null)?.length ? (k.data as KpiRow[]) : KPI_SEED
        const hData = (h.data as HotRow[] | null)?.length ? (h.data as HotRow[]) : HOT_SEED
        const cData = (c.data as ConvRow[] | null)?.length ? (c.data as ConvRow[]) : CONV_SEED
        const fData = (f.data as FunnelRow[] | null)?.length ? (f.data as FunnelRow[]) : FUNNEL_SEED
        const sData = (s.data as SourceRow[] | null)?.length ? (s.data as SourceRow[]) : SOURCE_SEED
        const wData = (w.data as WeeklyRow[] | null)?.length ? (w.data as WeeklyRow[]) : WEEKLY_SEED
        const nData = (n.data as NpsRow[] | null)?.length ? (n.data as NpsRow[]) : NPS_SEED
        const mData = (m.data as MonthlyFunnelRow[] | null)?.length ? (m.data as MonthlyFunnelRow[]) : MONTHLY_FUNNEL_SEED
        const refData = (ref.data as ReferralRow[] | null)?.length ? (ref.data as ReferralRow[]) : REFERRALS_SEED
        setKpi(orderRows(kData, 'metric', KPI_ORDER))
        setHot(sortHot(hData))
        setConv(orderRows(cData, 'stage', CONV_ORDER))
        setFunnel(orderRows(fData, 'stage', FUNNEL_ORDER))
        setSources([...sData].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)))
        setWeekly(orderRows(wData, 'metric', WEEKLY_ORDER))
        setNps(orderRows(nData, 'label', NPS_ORDER))
        setMonthly(orderRows(mData, 'stage', MONTHLY_FUNNEL_ORDER))
        setReferrals(orderRows(refData, 'name', REFERRALS_ORDER))
        // Render live PIT rows (already ordered by name); fall back to seed only if empty.
        setPit((pitData as PitRow[] | null)?.length ? (pitData as PitRow[]) : PIT_SEED)
        setLastUpdated(new Date())
      } catch {
        if (!active) return
        // Network / config failure — fall back to seeded sample data.
        setKpi(KPI_SEED)
        setHot(sortHot(HOT_SEED))
        setConv(CONV_SEED)
        setFunnel(FUNNEL_SEED)
        setSources([...SOURCE_SEED].sort((a, b) => b.count - a.count))
        setWeekly(WEEKLY_SEED)
        setNps(NPS_SEED)
        setMonthly(MONTHLY_FUNNEL_SEED)
        setReferrals(REFERRALS_SEED)
        setPit(PIT_SEED)
        setLastUpdated(new Date())
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  // Re-fetch only the KPI data (used after a daily entry is saved).
  async function refreshKpi() {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('sales_kpi_data').select('metric, actual, target')
      const kData = (data as KpiRow[] | null)?.length ? (data as KpiRow[]) : KPI_SEED
      setKpi(orderRows(kData, 'metric', KPI_ORDER))
      setLastUpdated(new Date())
    } catch {
      // Leave existing data in place on failure.
    }
  }

  function handleDailySaved() {
    setToast('Daily entry saved! Dashboard updated.')
    refreshKpi()
    window.setTimeout(() => setToast(''), 4000)
  }

  const totalLeads = Number(kpi.find((k) => k.metric === 'Inquiries')?.actual ?? 0)
  const pipeline = hot.reduce((sum, h) => sum + (Number(h.proposal_amount) || 0), 0)
  const winRate = Number(conv.find((c) => c.stage === 'Lead to Pre-Con')?.actual_pct ?? 0)
  const preCon = Number(kpi.find((k) => k.metric === 'Pre-Con Signed')?.actual ?? 0)
  const totalSources = sources.reduce((sum, x) => sum + (Number(x.count) || 0), 0)

  const statCards = [
    { value: fmtNum(totalLeads), label: 'Total Leads' },
    { value: fmtMoney(pipeline), label: 'Active Pipeline' },
    { value: `${winRate}%`, label: 'Win Rate' },
    { value: fmtNum(preCon), label: 'Q2 Pre-Con Signed' },
  ]

  return (
    <>
      <TopBar title="Sales & Marketing" subtitle="Sales Manager · Weekly / Monthly">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            padding: '5px 11px',
            borderRadius: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: GREEN,
            background: `${GREEN}1f`,
            border: `1px solid ${GREEN}40`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
          Live
        </span>
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

        {/* Captured by Export to PDF — the action row (data-html2canvas-ignore) and
            the floating Sales AI (rendered outside this div) are excluded. */}
        <div id="sales-dashboard-content">

        {/* Hero banner — premium dark */}
        <div
          id="pdf-section-header"
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
                  Sales &amp; Marketing
                </h1>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginTop: 7 }}>
                  Sales Manager · Weekly / Monthly
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <StatusBadge color={GREEN} label="Live" />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Data Source: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Sales KPI Tracker · Q2 2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action row — Daily Entry + Export. Excluded from the PDF capture. */}
        <div data-html2canvas-ignore style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => setShowDailyEntry(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
              borderRadius: 10,
              background: 'var(--charcoal)',
              border: '1px solid var(--charcoal)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <PlusIcon size={15} color="#fff" /> Daily Entry
          </button>
          <ExportPDF targetId="sales-dashboard-content" />
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Stats strip */}
            <div
              id="pdf-section-stats"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 36,
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              }}
              className="md:!grid-cols-4"
            >
              {statCards.map((s, i) => (
                <StatSegment key={s.label} value={s.value} label={s.label} index={i} />
              ))}
            </div>

            {/* SECTION 1 — Daily KPI Tracker */}
            <section id="pdf-section-kpi" style={{ marginBottom: 38 }}>
              <SectionHeader title="Daily KPI Tracker" subtitle="Are we on pace? · Updated daily · Q2 2026" />
              {lastUpdated && (
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: -8, marginBottom: 14, marginLeft: 42 }}>
                  Last updated: {lastUpdated.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {kpi.map((r) => (
                  <KpiCard key={r.metric} row={r} />
                ))}
              </div>
            </section>

            {/* SECTION 2 — Hot List */}
            <section id="pdf-section-hotlist" style={{ marginBottom: 38 }}>
              <SectionHeader title="Hot List" subtitle={`Who's close to signing? · ${fmtMoney(pipeline)} total pipeline`} />
              <HotList rows={hot} total={pipeline} />
            </section>

            {/* SECTION 3 — Sales Conversions */}
            <section id="pdf-section-conversions" style={{ marginBottom: 38 }}>
              <SectionHeader title="Sales Conversions" subtitle="Is the funnel healthy? · QTD" />
              <div style={cardStyle}>
                {conv.map((r, i) => (
                  <ConvRowView key={r.stage} row={r} last={i === conv.length - 1} />
                ))}
                <Legend items={[{ color: ACCENT, label: 'Actual' }, { color: '#c8311a', label: 'Target', line: true }]} />
              </div>
            </section>

            {/* SECTION 4 — Rolling 120-Day Funnel */}
            <section id="pdf-section-funnel" style={{ marginBottom: 38 }}>
              <SectionHeader title="Rolling 120-Day Funnel" subtitle="What does the forecast say? · As of Jun 19, 2026" />
              <FunnelTable rows={funnel} />
              <Legend items={[{ color: GREEN, label: 'On / above target' }, { color: RED, label: 'Below target' }]} />
            </section>

            {/* SECTION 5 — Lead Sources */}
            <section id="pdf-section-sources">
              <SectionHeader title="Lead Sources" subtitle={`Where are leads coming from? · QTD · ${fmtNum(totalSources)} total`} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sources.map((r, i) => (
                  <SourceCard key={r.source} row={r} prominent={i < 4} />
                ))}
              </div>
            </section>

            {/* SECTION — Current Week Progress */}
            <section id="pdf-section-weekly" style={{ marginTop: 38 }}>
              <SectionHeader title="Current Week Progress" subtitle="Week of Jun 15–19, 2026 · How are we tracking this week?" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {weekly.map((r) => (
                  <WeeklyCard key={r.metric} row={r} />
                ))}
              </div>
            </section>

            {/* SECTION — Q2 NPS */}
            <section id="pdf-section-nps" style={{ marginTop: 38 }}>
              <SectionHeader title="Q2 NPS" subtitle="Net Promoter Score · Q2 2026" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {nps.map((r) => (
                  <NpsStatCard key={r.label} row={r} />
                ))}
              </div>
            </section>

            {/* SECTION — Monthly Funnel Snapshot */}
            <section id="pdf-section-monthly" style={{ marginTop: 38 }}>
              <SectionHeader title="Monthly Funnel Snapshot" subtitle="June 2026 · Current month actual vs target" />
              <MonthlyFunnelTable rows={monthly} />
            </section>

            {/* SECTION — Weekly Referrals Out */}
            <section id="pdf-section-referrals" style={{ marginTop: 38 }}>
              <SectionHeader title="Weekly Referrals Out" subtitle="Week of Jun 15–19, 2026 · Priority list" />
              <ReferralList rows={referrals} />
            </section>

            {/* SECTION — Q2 PIT Submissions */}
            <section id="pdf-section-pit" style={{ marginTop: 38 }}>
              <SectionHeader title="Q2 PIT Submissions" subtitle="Personal Improvement Targets · Q2 2026 submission tracker" />
              <PitTable rows={pit} />
            </section>

            {/* SECTION 6 — Reports */}
            <section id="pdf-section-reports" style={{ marginTop: 38 }}>
              <SectionHeader title="Reports" subtitle="9 reports · Connect your CRM to unlock full automation" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                {REPORTS.map((r) => (
                  <ReportCard key={r.name} name={r.name} description={r.description} />
                ))}
              </div>
            </section>
          </>
        )}
        </div>{/* end #sales-dashboard-content */}
      </div>

      {/* Floating Sales AI button + chat drawer — bottom-right, this page only */}
      <FloatingSalesAI />

      {/* Daily Entry slide-over */}
      <DailyEntryForm open={showDailyEntry} onClose={() => setShowDailyEntry(false)} onSaved={handleDailySaved} />

      {/* Success / status toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 90,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            borderRadius: 10,
            background: GREEN,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 12px 30px -8px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
          {toast}
        </div>
      )}
    </>
  )
}
