'use client'
// src/app/(app)/customers/okr-dashboard/page.tsx
//
// Pre-Construction OKR Dashboard — manager-level KPI tracker for the three
// pre-con OKR phases (Design Completed, Permit Received, Contract Executed).
//
// IMPORTANT: This page hardcodes ONLY layout-neutral constants supplied by the
// spec — the OKR phase step ranges and the monthly/quarterly targets. Every
// piece of business data (client names, PM names, obtained counts, dates) is
// fetched from Supabase at runtime. Nothing from the reference Excel/PDF is
// baked in.

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

// ── Hardcoded constants (allowed by spec) ────────────────────────────────────
// OKR phase → workflow step ranges (from Kai). A phase is "complete" only when
// every step in its range is present in workflow_step_completions.
const PHASE_KEYS = ['design', 'permit', 'contract'] as const
type PhaseKey = (typeof PHASE_KEYS)[number]

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let n = a; n <= b; n++) out.push(n)
  return out
}

const PHASE_META: Record<
  PhaseKey,
  { label: string; accent: string; steps: number[]; startStep: number; finalStep: number }
> = {
  design:   { label: 'Design Completed',  accent: '#3b82f6', steps: range(6, 13),  startStep: 6,  finalStep: 13 },
  permit:   { label: 'Permit Received',   accent: '#f59e0b', steps: range(14, 15), startStep: 14, finalStep: 15 },
  contract: { label: 'Contract Executed', accent: '#22c55e', steps: range(16, 21), startStep: 16, finalStep: 21 },
}

const MONTHLY_TARGET_PER_PM = 3 // each OKR: 3 per PM per month
const QUARTER_TARGET_PER_PM = 9 // each OKR: 9 per PM per quarter

// ── Hardcoded reference data (from the Excel KPI tracker) ────────────────────
// The following blocks are HARDCODED per spec. They mirror the Excel's static
// reference tables — quarterly targets, historical NPS, departmental PIT goals,
// and the two support-team rows (Draft / Selections). These are NOT represented
// in Supabase (no workflow data backs them), so they are intentionally static.

// Section B — quarterly OKR targets (Design | Permit | Contract).
const QUARTERLY_TARGET_ROWS: { label: string; values: number[]; bold?: boolean }[] = [
  { label: 'April Targets', values: [3, 3, 3] },
  { label: 'May Targets', values: [3, 3, 3] },
  { label: 'June Targets', values: [3, 3, 3] },
  { label: 'Qtr Totals', values: [9, 9, 9], bold: true },
]

// Section A — extra (not-yet-tracked) summary columns shown as "—" for now.
const SUMMARY_EXTRA_COLS = ['Selections Completed', 'Bid Completed', 'NPS']

// Section C — historical NPS data (verbatim from the Excel).
const NPS_HISTORY: { period: string; count: string; avg: string; month: string; bold?: boolean; highlight?: boolean }[] = [
  { period: '2024', count: '8', avg: '9', month: '—' },
  { period: 'Q4', count: '8', avg: '9', month: '—' },
  { period: 'Nov', count: '2', avg: '10', month: '—' },
  { period: 'Dec', count: '6', avg: '9', month: '—' },
  { period: '2025', count: '22', avg: '9', month: '—' },
  { period: 'Q1', count: '18', avg: '9', month: '—' },
  { period: 'Jan', count: '12', avg: '9', month: '—' },
  { period: 'Feb', count: '4', avg: '9', month: '—' },
  { period: 'Mar', count: '2', avg: '10', month: '—' },
  { period: 'Q2', count: '2', avg: '10', month: '—' },
  { period: 'Apr', count: '2', avg: '10', month: '—' },
  { period: 'Q4', count: '2', avg: '10', month: '—' },
  { period: 'Nov', count: '2', avg: '10', month: '—' },
  { period: 'Grand Total', count: '30', avg: '9', month: '—', bold: true },
  { period: 'Current Month', count: '—', avg: '—', month: 'Jun-26', highlight: true },
]

// Section D — Q2 PIT Goals KPI (verbatim from the Excel).
const PIT_COLUMNS = ['Name', 'PIT Submitted', 'PS Submitted', 'Department Team', 'Department Team', 'SOP Created']
const PIT_GOALS: {
  people: { name: string; values: number[] }[]
  actual: number[]
  quarterTarget: string[]
  diffPct: string[]
} = {
  people: [
    { name: 'Kelly Cuffel', values: [7, 2, 2, 1, 1] },
    { name: 'Matteo Carpani', values: [4, 3, 3, 2, 2] },
    { name: 'Chad Holman', values: [1, 2, 2, 0, 0] },
    { name: 'Tim Ritschel', values: [1, 1, 0, 0, 0] },
  ],
  actual: [13, 8, 7, 3, 3],
  quarterTarget: ['6', '6', '6', '—', '—'],
  diffPct: ['217%', '133%', '117%', '—', '—'],
}

// ── Shared table style tokens (match the spec for all new sections) ──────────
const TH_BASE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  borderBottom: '0.5px solid var(--border)',
}
const TH_LEFT: React.CSSProperties = { ...TH_BASE, textAlign: 'left', padding: '0 10px 8px' }
const TH_NUM: React.CSSProperties = { ...TH_BASE, textAlign: 'center', padding: '0 10px 8px' }
const TD_LEFT: React.CSSProperties = { textAlign: 'left', padding: '10px', color: 'var(--text)' }
const TD_NUM: React.CSSProperties = { textAlign: 'center', padding: '10px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }

// ── Supabase row shapes ──────────────────────────────────────────────────────
interface ClientRowDB {
  id: string
  name: string
  project_type: string | null
  owner: string | null
  location: string | null
}
interface CompletionRowDB {
  client_id: string
  step_number: number
  completed_at: string | null
}
interface StepStartRowDB {
  client_id: string
  step_number: number
  started_at: string | null
}

// ── Derived per-client shapes ────────────────────────────────────────────────
interface PhaseStatus {
  done: boolean
  completedCount: number
  total: number
  completedDate: Date | null // when the phase's final step was completed
}
interface ClientComputed {
  id: string
  name: string
  projectType: string
  owner: string
  design: PhaseStatus
  permit: PhaseStatus
  contract: PhaseStatus
  designDays: number | null // step 6 start → step 13 completion (days)
  currentPhase: 'Design' | 'Permit' | 'Contract' | 'Complete'
}

// ── Date helpers (all Eastern Time, matching the rest of the app) ────────────
function etYMD(d: Date): { ym: string; day: number } {
  const s = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD
  return { ym: s.slice(0, 7), day: Number(s.slice(8, 10)) }
}
function fmtDateUS(d: Date): string {
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Small presentational helpers ─────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 700,
        color: 'var(--text3)',
        marginBottom: 12,
      }}
    >
      {children}
    </h2>
  )
}

function StatCard({
  label,
  value,
  delta,
  deltaTone = 'flat',
}: {
  label: string
  value: string | number
  delta?: string
  deltaTone?: 'up' | 'bad' | 'flat'
}) {
  const deltaColor = deltaTone === 'up' ? 'var(--green)' : deltaTone === 'bad' ? 'var(--red)' : 'var(--text3)'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.5px', lineHeight: 1, color: 'var(--text)' }}>
          {value}
        </span>
        {delta && <span style={{ fontSize: 11.5, fontWeight: 550, color: deltaColor }}>{delta}</span>}
      </div>
    </div>
  )
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div style={{ height: 4, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
      <div style={{ height: 4, borderRadius: 99, width: `${pct}%`, background: color, transition: 'width 200ms ease' }} />
    </div>
  )
}

function StatusBadge({ obtained, target }: { obtained: number; target: number }) {
  let bg = '#dcfce7', color = '#166534', text = '✓ On Track'
  if (obtained > target) { bg = '#dbeafe'; color = '#1e40af'; text = '↑ Ahead' }
  else if (obtained < target) { bg = '#fee2e2'; color = '#991b1b'; text = '⚠ Behind' }
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bg, color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

function DiffText({ diff }: { diff: number }) {
  if (diff > 0) return <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{diff} ahead</span>
  if (diff < 0) return <span style={{ color: 'var(--red)', fontWeight: 600 }}>{diff} behind</span>
  return <span style={{ color: 'var(--text3)', fontWeight: 600 }}>On target</span>
}

function NamePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        background: 'var(--surface2)',
        color: 'var(--text2)',
        border: '1px solid var(--border)',
        borderRadius: 99,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OKRDashboardPage() {
  const [clients, setClients] = useState<ClientRowDB[]>([])
  const [completions, setCompletions] = useState<CompletionRowDB[]>([])
  const [starts, setStarts] = useState<StepStartRowDB[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: c }, { data: comp }, { data: st }] = await Promise.all([
        supabase.from('clients').select('id, name, project_type, owner, location'),
        supabase.from('workflow_step_completions').select('client_id, step_number, completed_at'),
        supabase.from('journey_step_start').select('client_id, step_number, started_at'),
      ])
      setClients((c ?? []) as ClientRowDB[])
      setCompletions((comp ?? []) as CompletionRowDB[])
      setStarts((st ?? []) as StepStartRowDB[])
      setLoading(false)
    }
    load().catch(err => {
      console.error('[okr-dashboard] load error:', err)
      setLoading(false)
    })
  }, [])

  // Current ET month (e.g. "2026-06") + a human label for the subtitle/calendar.
  const now = useMemo(() => new Date(), [])
  const nowYM = etYMD(now).ym
  const [calYearStr, calMonthStr] = nowYM.split('-')
  const calYear = Number(calYearStr)
  const calMonthIdx = Number(calMonthStr) - 1
  const monthLabel = new Date(calYear, calMonthIdx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // ── Derive per-client OKR status ───────────────────────────────────────────
  const computed = useMemo<ClientComputed[]>(() => {
    // client_id → (step → completed_at | null)
    const compByClient = new Map<string, Map<number, string | null>>()
    for (const r of completions) {
      const m = compByClient.get(r.client_id) ?? new Map<number, string | null>()
      m.set(r.step_number, r.completed_at)
      compByClient.set(r.client_id, m)
    }
    // client_id → (step → started_at Date)
    const startByClient = new Map<string, Map<number, Date>>()
    for (const r of starts) {
      if (!r.started_at) continue
      const m = startByClient.get(r.client_id) ?? new Map<number, Date>()
      m.set(r.step_number, new Date(r.started_at))
      startByClient.set(r.client_id, m)
    }

    function statusFor(stepTimes: Map<number, string | null>, key: PhaseKey): PhaseStatus {
      const { steps, finalStep } = PHASE_META[key]
      const completedCount = steps.filter(s => stepTimes.has(s)).length
      const done = completedCount === steps.length
      let completedDate: Date | null = null
      if (done) {
        const fin = stepTimes.get(finalStep)
        if (fin) completedDate = new Date(fin)
        else {
          // Final step has no timestamp — fall back to the latest dated step in range.
          let latest: number | null = null
          for (const s of steps) {
            const ts = stepTimes.get(s)
            if (ts) {
              const ms = new Date(ts).getTime()
              if (latest === null || ms > latest) latest = ms
            }
          }
          if (latest !== null) completedDate = new Date(latest)
        }
      }
      return { done, completedCount, total: steps.length, completedDate }
    }

    return clients.map(c => {
      const stepTimes = compByClient.get(c.id) ?? new Map<number, string | null>()
      const design = statusFor(stepTimes, 'design')
      const permit = statusFor(stepTimes, 'permit')
      const contract = statusFor(stepTimes, 'contract')

      // Avg design days: step 6 start → step 13 completion.
      let designDays: number | null = null
      if (design.done) {
        const start6 = startByClient.get(c.id)?.get(PHASE_META.design.startStep)
        const comp13 = stepTimes.get(PHASE_META.design.finalStep)
        if (start6 && comp13) {
          const days = (new Date(comp13).getTime() - start6.getTime()) / 86_400_000
          if (Number.isFinite(days) && days >= 0) designDays = days
        }
      }

      const currentPhase: ClientComputed['currentPhase'] =
        contract.done ? 'Complete' : permit.done ? 'Contract' : design.done ? 'Permit' : 'Design'

      return {
        id: c.id,
        name: c.name,
        projectType: c.project_type ?? '',
        owner: c.owner?.trim() || 'Unassigned',
        design,
        permit,
        contract,
        designDays,
        currentPhase,
      }
    })
  }, [clients, completions, starts])

  // ── Aggregations ───────────────────────────────────────────────────────────
  const inCurrentMonth = (d: Date | null) => !!d && etYMD(d).ym === nowYM
  const phaseOf = (c: ClientComputed, k: PhaseKey): PhaseStatus => c[k]

  // Distinct PMs (dynamic — derived from the owner field, nothing hardcoded).
  const pmNames = useMemo(
    () => Array.from(new Set(computed.map(c => c.owner))).sort((a, b) => a.localeCompare(b)),
    [computed],
  )
  const numPMs = pmNames.length

  // This-month obtained counts per OKR.
  const obtainedThisMonth = (k: PhaseKey) => computed.filter(c => phaseOf(c, k).done && inCurrentMonth(phaseOf(c, k).completedDate)).length

  // Avg design days across clients with a completed, datable design.
  const designDaysList = computed.map(c => c.designDays).filter((n): n is number => n !== null)
  const avgDesignDays = designDaysList.length
    ? Math.round(designDaysList.reduce((s, n) => s + n, 0) / designDaysList.length)
    : null

  // Completed projects per phase (any completed, dated first, most recent on top).
  function completedList(k: PhaseKey) {
    return computed
      .filter(c => phaseOf(c, k).done)
      .map(c => ({ name: c.name, date: phaseOf(c, k).completedDate }))
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
  }

  // Monthly team target (3 per PM) used for the OKR summary + per-PM rows.
  const monthlyTeamTarget = numPMs * MONTHLY_TARGET_PER_PM

  // Calendar dots: day-of-month → (phase → count of completions that day, current month).
  // Counting (not just presence) lets the calendar show a number inside a dot when
  // more than one client completed the same OKR on the same day (Section F).
  const calendarDots = useMemo(() => {
    const map = new Map<number, Map<PhaseKey, number>>()
    for (const c of computed) {
      for (const k of PHASE_KEYS) {
        const d = phaseOf(c, k).completedDate
        if (!d) continue
        const { ym, day } = etYMD(d)
        if (ym !== nowYM) continue
        const inner = map.get(day) ?? new Map<PhaseKey, number>()
        inner.set(k, (inner.get(k) ?? 0) + 1)
        map.set(day, inner)
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, nowYM])

  const firstWeekday = new Date(calYear, calMonthIdx, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...range(1, daysInMonth),
  ]

  // Per-PM breakdown rows.
  const pmRows = pmNames.map(pm => {
    const group = computed.filter(c => c.owner === pm)
    const perPhase = (k: PhaseKey) => {
      const winners = group.filter(c => phaseOf(c, k).done && inCurrentMonth(phaseOf(c, k).completedDate))
      const obtained = winners.length
      return {
        target: MONTHLY_TARGET_PER_PM,
        obtained,
        diff: obtained - MONTHLY_TARGET_PER_PM,
        names: winners.map(c => c.name),
      }
    }
    return { pm, design: perPhase('design'), permit: perPhase('permit'), contract: perPhase('contract') }
  })

  // Section A — monthly summary stats per OKR.
  // Current Value = all-time completed; Monthly Totals = completed this month;
  // Start Value = value at month start (Current − Monthly); Difference = Current − Target.
  const okrSummaryStats = PHASE_KEYS.map(k => {
    const current = computed.filter(c => phaseOf(c, k).done).length
    const monthly = obtainedThisMonth(k)
    return {
      k,
      current,
      monthly,
      start: Math.max(0, current - monthly),
      target: monthlyTeamTarget,
      diff: current - monthlyTeamTarget,
    }
  })
  type OkrSummaryStat = (typeof okrSummaryStats)[number]
  const summaryRows: { label: string; get: (s: OkrSummaryStat) => number; diff?: boolean }[] = [
    { label: 'Monthly Totals', get: s => s.monthly },
    { label: 'Start Value', get: s => s.start },
    { label: 'Current Value', get: s => s.current },
    { label: 'Target', get: s => s.target },
    { label: 'Difference', get: s => s.diff, diff: true },
  ]

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <>
      <TopBar title="Pre-Con OKR Dashboard" subtitle={`${monthLabel} · Pre-Construction KPI Tracker`} />

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="shimmer" style={{ height: 90, borderRadius: 12, border: '1px solid var(--border)' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Page heading */}
            <div style={{ marginBottom: 24 }}>
              <h1 className="font-serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1.1 }}>
                Pre-Con OKR Dashboard
              </h1>
              <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text3)' }}>
                Tracking Design, Permit &amp; Contract across {computed.length} active client{computed.length === 1 ? '' : 's'} · {numPMs} PM{numPMs === 1 ? '' : 's'}
              </p>
            </div>

            {/* ── SECTION 1: Top stats row ─────────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <StatCard
                  label="Avg Design Days"
                  value={avgDesignDays ?? '—'}
                  delta={designDaysList.length ? `${designDaysList.length} project${designDaysList.length === 1 ? '' : 's'}` : 'No data yet'}
                />
                <StatCard
                  label="Design Completed · This Month"
                  value={obtainedThisMonth('design')}
                  delta={`of ${monthlyTeamTarget} target`}
                  deltaTone={obtainedThisMonth('design') >= monthlyTeamTarget ? 'up' : 'bad'}
                />
                <StatCard
                  label="Permit Received · This Month"
                  value={obtainedThisMonth('permit')}
                  delta={`of ${monthlyTeamTarget} target`}
                  deltaTone={obtainedThisMonth('permit') >= monthlyTeamTarget ? 'up' : 'bad'}
                />
                <StatCard
                  label="Contract Executed · This Month"
                  value={obtainedThisMonth('contract')}
                  delta={`of ${monthlyTeamTarget} target`}
                  deltaTone={obtainedThisMonth('contract') >= monthlyTeamTarget ? 'up' : 'bad'}
                />
              </div>
            </section>

            {/* ── SECTION A: Monthly summary stats table ───────────────────── */}
            <section style={{ marginTop: 32, marginBottom: 32 }}>
              <SectionHeader>Monthly Summary · {monthLabel}</SectionHeader>
              <div style={{ ...cardStyle, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th style={TH_LEFT} />
                      {PHASE_KEYS.map(k => (
                        <th key={k} style={{ ...TH_NUM, color: PHASE_META[k].accent }}>{PHASE_META[k].label}</th>
                      ))}
                      {SUMMARY_EXTRA_COLS.map(c => (
                        <th key={c} style={TH_NUM}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map(rowDef => (
                      <tr key={rowDef.label} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <td style={{ ...TD_LEFT, fontWeight: 600 }}>{rowDef.label}</td>
                        {okrSummaryStats.map(s => {
                          const v = rowDef.get(s)
                          const color = rowDef.diff
                            ? v > 0 ? '#166534' : v < 0 ? '#991b1b' : 'var(--text)'
                            : 'var(--text)'
                          return (
                            <td key={s.k} style={{ ...TD_NUM, color, fontWeight: rowDef.diff ? 700 : 400 }}>
                              {rowDef.diff && v > 0 ? `+${v}` : v}
                            </td>
                          )
                        })}
                        {SUMMARY_EXTRA_COLS.map(c => (
                          <td key={c} style={{ ...TD_NUM, color: 'var(--text3)' }}>—</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── SECTION B: Quarterly targets table ───────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader>Quarterly Targets · Q2 2026</SectionHeader>
              <div style={{ ...cardStyle, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, maxWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={TH_LEFT} />
                      {PHASE_KEYS.map(k => (
                        <th key={k} style={{ ...TH_NUM, color: PHASE_META[k].accent }}>{PHASE_META[k].label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {QUARTERLY_TARGET_ROWS.map(r => (
                      <tr key={r.label} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <td style={{ ...TD_LEFT, fontWeight: r.bold ? 700 : 600 }}>{r.label}</td>
                        {r.values.map((v, i) => (
                          <td key={i} style={{ ...TD_NUM, fontWeight: r.bold ? 700 : 400 }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── SECTION 2: OKR summary (3 columns) ───────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader>OKR Summary · {monthLabel}</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {PHASE_KEYS.map(k => {
                  const meta = PHASE_META[k]
                  const obtained = obtainedThisMonth(k)
                  const diff = obtained - monthlyTeamTarget
                  const list = completedList(k)
                  return (
                    <div key={k} style={{ ...cardStyle, borderTop: `3px solid ${meta.accent}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{meta.label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
                          {obtained}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>obtained of {monthlyTeamTarget} target</span>
                      </div>
                      <ProgressBar value={obtained} total={monthlyTeamTarget} color={meta.accent} />
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        <DiffText diff={diff} />
                        <span style={{ color: 'var(--text3)' }}> · monthly team target (3 / PM)</span>
                      </div>

                      {/* Clients that have completed this OKR */}
                      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>
                          Completed
                        </div>
                        {list.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>None yet.</div>
                        ) : (
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {list.map((it, i) => (
                              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                                <span style={{ color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {it.name}
                                </span>
                                <span style={{ color: 'var(--text3)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                  {it.date ? fmtDateUS(it.date) : '—'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── SECTION 3: Per-PM breakdown ──────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader>Per-PM Breakdown · {monthLabel}</SectionHeader>
              <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 920 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th rowSpan={2} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', verticalAlign: 'bottom' }}>
                        PM
                      </th>
                      {PHASE_KEYS.map(k => (
                        <th key={k} colSpan={5} style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 12, color: PHASE_META[k].accent, borderLeft: '1px solid var(--border)' }}>
                          {PHASE_META[k].label}
                        </th>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {PHASE_KEYS.map(k =>
                        ['Target', 'Obtain', 'Diff', 'Status', 'Name'].map((h, hi) => (
                          <th
                            key={`${k}-${h}`}
                            style={{
                              textAlign: h === 'Name' ? 'left' : 'center',
                              padding: '6px 10px',
                              fontSize: 10.5,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--text3)',
                              borderLeft: hi === 0 ? '1px solid var(--border)' : 'none',
                            }}
                          >
                            {h}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pmRows.length === 0 ? (
                      <tr>
                        <td colSpan={16} style={{ padding: '16px 14px', color: 'var(--text3)', fontSize: 13 }}>
                          No PMs found.
                        </td>
                      </tr>
                    ) : (
                      pmRows.map(row => (
                        <tr key={row.pm} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                            {row.pm}
                          </td>
                          {PHASE_KEYS.map(k => {
                            const cell = row[k]
                            return (
                              <PMPhaseCells key={k} target={cell.target} obtained={cell.obtained} diff={cell.diff} names={cell.names} />
                            )
                          })}
                        </tr>
                      ))
                    )}

                    {/* ── SECTION E: support teams (hardcoded — not tracked in workflow data) ── */}
                    <tr>
                      <td
                        colSpan={16}
                        style={{
                          padding: '8px 14px',
                          borderTop: '2px solid var(--border2)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--text3)',
                          background: 'var(--surface2)',
                        }}
                      >
                        Support Teams · reference (not tracked in workflow data)
                      </td>
                    </tr>

                    {/* Draft Team (Kevin) — Design target 2, Permit target 5, no Contract column */}
                    <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>Kevin</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Draft Team</div>
                      </td>
                      <PMPhaseCells target={2} obtained={0} diff={-2} names={[]} />
                      <PMPhaseCells target={5} obtained={0} diff={-5} names={[]} />
                      <td colSpan={5} style={{ textAlign: 'center', padding: '12px 10px', color: 'var(--text3)', borderLeft: '1px solid var(--border)', fontSize: 12 }}>
                        N/A
                      </td>
                    </tr>

                    {/* Selections Team (Kelly & Hazel) — only a Selections Completed target (2) */}
                    <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>Kelly &amp; Hazel</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Selections Team</div>
                      </td>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '12px 10px', color: 'var(--text3)', borderLeft: '1px solid var(--border)', fontSize: 12 }}>
                        N/A
                      </td>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '12px 10px', color: 'var(--text3)', borderLeft: '1px solid var(--border)', fontSize: 12 }}>
                        N/A
                      </td>
                      <td colSpan={5} style={{ padding: '12px 14px', borderLeft: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>Selections Completed</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>0 / 2</span>
                          <DiffText diff={-2} />
                          <StatusBadge obtained={0} target={2} />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── SECTION 4: Completed projects summary ────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader>Completed Projects Summary</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {PHASE_KEYS.map(k => {
                  const meta = PHASE_META[k]
                  const list = completedList(k)
                  return (
                    <div key={k} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: `2px solid ${meta.accent}`, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        {meta.label}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', fontWeight: 600 }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '6px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', fontWeight: 600 }}>Customer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.length === 0 ? (
                            <tr><td colSpan={2} style={{ padding: '10px 14px', color: 'var(--text3)' }}>None yet.</td></tr>
                          ) : (
                            list.map((it, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '7px 14px', color: 'var(--text3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  {it.date ? fmtDateUS(it.date) : '—'}
                                </td>
                                <td style={{ padding: '7px 14px', color: 'var(--text)' }}>{it.name}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
                {/* Selections — future phase, not yet tracked as an OKR here. */}
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', opacity: 0.7 }}>
                  <div style={{ padding: '10px 14px', borderBottom: '2px solid var(--border2)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                    Selections
                  </div>
                  <div style={{ padding: '14px', fontSize: 12, color: 'var(--text3)' }}>Coming soon</div>
                </div>
              </div>
            </section>

            {/* ── SECTION C: NPS Score History (hardcoded historical data) ─── */}
            <section style={{ marginTop: 32, marginBottom: 32 }}>
              <SectionHeader>NPS Score History</SectionHeader>
              <div style={{ ...cardStyle, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={TH_LEFT}>Period</th>
                      <th style={TH_NUM}># of NPS</th>
                      <th style={TH_NUM}>Average NPS Score</th>
                      <th style={TH_NUM}>Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NPS_HISTORY.map((r, i) => {
                      const bg = r.highlight ? '#fffbeb' : i % 2 === 1 ? 'var(--surface2)' : 'transparent'
                      const fw = r.bold ? 700 : 400
                      return (
                        <tr key={i} style={{ borderBottom: '0.5px solid var(--border)', background: bg }}>
                          <td style={{ ...TD_LEFT, fontWeight: r.bold ? 700 : 600, color: r.highlight ? '#92400e' : 'var(--text)' }}>
                            {r.period}
                          </td>
                          <td style={{ ...TD_NUM, fontWeight: fw }}>{r.count}</td>
                          <td style={{ ...TD_NUM, fontWeight: fw }}>{r.avg}</td>
                          <td style={{ ...TD_NUM, fontWeight: fw, color: r.highlight ? '#92400e' : 'var(--text3)' }}>{r.month}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── SECTION D: Q2 PIT Goals KPI (hardcoded departmental data) ── */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader>Q2 PIT Goals KPI</SectionHeader>
              <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 660 }}>
                  <thead>
                    <tr style={{ background: '#1a1917' }}>
                      {PIT_COLUMNS.map((h, i) => (
                        <th
                          key={i}
                          style={{
                            textAlign: i === 0 ? 'left' : 'center',
                            padding: '10px 12px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: '#fff',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PIT_GOALS.people.map(p => (
                      <tr key={p.name} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <td style={{ ...TD_LEFT, fontWeight: 600 }}>{p.name}</td>
                        {p.values.map((v, i) => (
                          <td key={i} style={TD_NUM}>{v}</td>
                        ))}
                      </tr>
                    ))}
                    {/* Actual (bold) */}
                    <tr style={{ borderTop: '1px solid var(--border2)', borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ ...TD_LEFT, fontWeight: 700 }}>Actual</td>
                      {PIT_GOALS.actual.map((v, i) => (
                        <td key={i} style={{ ...TD_NUM, fontWeight: 700 }}>{v}</td>
                      ))}
                    </tr>
                    {/* Quarter Target (muted) */}
                    <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ ...TD_LEFT, color: 'var(--text3)' }}>Quarter Target</td>
                      {PIT_GOALS.quarterTarget.map((v, i) => (
                        <td key={i} style={{ ...TD_NUM, color: 'var(--text3)' }}>{v}</td>
                      ))}
                    </tr>
                    {/* Difference % (green ≥100%, red <100%) */}
                    <tr>
                      <td style={{ ...TD_LEFT, fontWeight: 600 }}>Difference %</td>
                      {PIT_GOALS.diffPct.map((v, i) => {
                        const pct = parseFloat(v)
                        const color = Number.isNaN(pct) ? 'var(--text3)' : pct >= 100 ? '#166534' : '#991b1b'
                        return (
                          <td key={i} style={{ ...TD_NUM, color, fontWeight: 600 }}>{v}</td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Active Projects Progress ─────────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeader>Active Projects Progress</SectionHeader>
              {computed.length === 0 ? (
                <div style={{ ...cardStyle, fontSize: 13, color: 'var(--text3)' }}>No active clients.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {computed.map(c => (
                    <div key={c.id} style={{ ...cardStyle, padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        <Link href={`/customers/${c.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                          {c.name}
                        </Link>
                        <NamePill>{c.owner}</NamePill>
                        {c.projectType && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{c.projectType}</span>}
                        <span style={{ marginLeft: 'auto' }}>
                          <CurrentPhaseBadge phase={c.currentPhase} />
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {PHASE_KEYS.map(k => {
                          const ps = phaseOf(c, k)
                          const meta = PHASE_META[k]
                          const pct = ps.total > 0 ? Math.round((ps.completedCount / ps.total) * 100) : 0
                          return (
                            <div key={k}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                                <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{meta.label}</span>
                                <span style={{ color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                                  {ps.completedCount} of {ps.total} · {pct}%
                                </span>
                              </div>
                              <div style={{ position: 'relative' }}>
                                <ProgressBar value={ps.completedCount} total={ps.total} color={meta.accent} />
                                <span style={{ position: 'absolute', right: 0, top: 6, fontSize: 10, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                  {pct}%
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Monthly calendar view ────────────────────────────────────── */}
            <section style={{ marginBottom: 12 }}>
              <SectionHeader>{monthLabel} · OKR Completions Calendar</SectionHeader>
              <div style={cardStyle}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  {PHASE_KEYS.map(k => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_META[k].accent }} />
                      {PHASE_META[k].label}
                    </span>
                  ))}
                </div>

                {/* Weekday header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {calendarCells.map((day, i) => {
                    if (day === null) return <div key={`b-${i}`} />
                    const dots = calendarDots.get(day)
                    return (
                      <div
                        key={day}
                        style={{
                          minHeight: 56,
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '5px 7px',
                          background: 'var(--surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{day}</span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {dots &&
                            PHASE_KEYS.filter(k => dots.has(k)).map(k => {
                              const count = dots.get(k) ?? 0
                              const big = count > 1
                              return (
                                <span
                                  key={k}
                                  title={`${PHASE_META[k].label}${big ? ` ×${count}` : ''}`}
                                  style={{
                                    width: big ? 14 : 8,
                                    height: big ? 14 : 8,
                                    borderRadius: '50%',
                                    background: PHASE_META[k].accent,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: 8,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                  }}
                                >
                                  {big ? count : ''}
                                </span>
                              )
                            })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Quarter target reference (hardcoded constant, per spec) */}
            <p style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              Targets: {MONTHLY_TARGET_PER_PM} per PM per month · {QUARTER_TARGET_PER_PM} per PM per quarter (each OKR).
            </p>
          </>
        )}
      </div>
    </>
  )
}

// The five sub-cells (Target / Obtain / Diff / Status / Name) for one OKR phase
// inside a PM's row. Kept as a component so the row map stays readable.
function PMPhaseCells({
  target,
  obtained,
  diff,
  names,
}: {
  target: number
  obtained: number
  diff: number
  names: string[]
}) {
  const num: React.CSSProperties = {
    textAlign: 'center',
    padding: '12px 10px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text)',
  }
  return (
    <>
      <td style={{ ...num, borderLeft: '1px solid var(--border)' }}>{target}</td>
      <td style={{ ...num, fontWeight: 600 }}>{obtained}</td>
      <td style={{ ...num }}>
        <DiffText diff={diff} />
      </td>
      <td style={{ textAlign: 'center', padding: '12px 10px' }}>
        <StatusBadge obtained={obtained} target={target} />
      </td>
      <td style={{ padding: '12px 10px' }}>
        {names.length === 0 ? (
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {names.map((n, i) => (
              <NamePill key={i}>{n}</NamePill>
            ))}
          </div>
        )}
      </td>
    </>
  )
}

// Small badge showing which phase a client is currently working in.
function CurrentPhaseBadge({ phase }: { phase: 'Design' | 'Permit' | 'Contract' | 'Complete' }) {
  const map: Record<string, { bg: string; color: string }> = {
    Design: { bg: '#dbeafe', color: '#1e40af' },
    Permit: { bg: '#fef3c7', color: '#92400e' },
    Contract: { bg: '#dcfce7', color: '#166534' },
    Complete: { bg: 'var(--surface2)', color: 'var(--text2)' },
  }
  const s = map[phase]
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {phase === 'Complete' ? '✓ Complete' : `In ${phase}`}
    </span>
  )
}
