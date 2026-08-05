'use client'
// src/app/(app)/customers/okr-dashboard/page.tsx
//
// Pre-Con OKR Dashboard — THE live dashboard, the one the whole team uses.
//
// This version was built and reviewed at /customers/okr-dashboard-v2, then
// promoted here by replacing this file's contents wholesale. The version it
// replaced is kept verbatim beside it as `page.tsx.backup` — the rollback copy,
// and not a route (`.backup` is not a Next page extension, so the router and
// tsc both skip it). The v2 route still exists and still serves this same page;
// retiring it is a separate, deliberate change.
//
// ── Visual language ─────────────────────────────────────────────────────────
// The look is the one leadership already knows: the design this page carried
// before the swap, preserved in `page.tsx.backup`. That means the Hub's own
// tokens (--surface / --border / --text* / --green / --amber / --red), 12px
// cards, uppercase letterspaced section headers, the `font-serif` h1, and the
// same table / badge / progress-bar vocabulary. Styling convention follows that
// earlier version exactly — inline styles keyed to CSS variables, with Tailwind
// only for the layout utilities it used (`flex-1 overflow-y-auto p-7
// animate-page-in`, `font-serif`, `shimmer`).
//
// The earlier redesign styling — a scoped `.okr2-root` stylesheet porting the
// mockup's palette, plus Space Grotesk / IBM Plex Mono web fonts — was removed
// wholesale. That pass changed presentation only: same tabs, same tracker reads,
// same Completed/Ongoing toggle, same view-all expansion, same plausibleDays()
// anomaly handling, same AI context. Familiar page, newer functionality under it.
//
// The one <style> block left carries the four rules that cannot be expressed
// inline (a keyframe, the <summary> marker reset, and the caveat notes' <b>) —
// the pre-swap version injected its own keyframe the same way.
//
// ── What is REAL data on this page (same Supabase queries + calculations as
//    before the swap, restyled only) ─────────────────────────────────────────
//   • Top stat cards — Design / Permit / Contract completed this month, Avg design days
//   • Per PM breakdown — Target / Obtain / Gap per stage per PM
//   • Active Projects — Overall Journey, phase bars, KPI tasks per client
//   • Completions Calendar
//
// ── REMOVED ─────────────────────────────────────────────────────────────────
//   • Quarterly Targets — removed outright, not hidden. The source has an
//     unresolved inconsistency: the Q3 tab carries three independent copies of
//     the quarterly-target table (one per month block) and they disagree — the
//     July block reads Design 4/4/3 with a quarter total of 11, while the August
//     and September blocks both read 3/3/3 totalling 9. Nothing accurate can be
//     shown until someone decides which copy is authoritative, so the section is
//     gone rather than sitting here as an empty shell.
//
// ── LIVE from the Excel tracker via /api/okr-dashboard-v2/excel-data ────────
//   • NPS History (NewNPS)            • PIT Goals KPI (PITprecon)
//   • Selections — Completed (SelectionsComp) / Ongoing (SelectionsOng)
//   • Bid        — Completed (BidComp)        / Ongoing (BidOng)
//   Connected in Phase 2a. Each degrades to an em-dash shell plus a `.flag` when
//   the Graph read fails, so an outage costs the numbers, not the page. These
//   figures are also fed into the CASK Intelligence system context so it can
//   answer about them instead of calling them unconnected.
//
//   The Completed | Ongoing toggle exists on the Selections and Bid cards ONLY.
//   Design, Permitting and Contract keep one ongoing view — Active Projects
//   Progress, from Supabase — so the page never carries two differently-sourced
//   answers to the same question. The toggle also only renders when its Ongoing
//   read actually succeeded; a failed SelectionsOng leaves no dead tab behind.
//
// ── Still NOT connected ─────────────────────────────────────────────────────
//   • Avg Design Days — shown from workflow records; the tracker's own version is
//     =AVERAGE(DesignOng[# Days in Design]), i.e. on-going not completed designs.
//   • Monthly Summary — the tracker block is not read at all (Phase 2b).
//
// Explicitly excluded per spec: Weekly Goal notes, MI5 daily task checklists.
//
// Every Microsoft Graph / SharePoint read happens server-side in the API route
// named above and is READ-ONLY; nothing here writes to the workbook. NO Supabase
// schema or write logic is touched either — the four reads below are the same
// reads this page has always performed.

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { WORKFLOW_STEPS } from '@/lib/workflow-steps'
import { ArtifactContent } from '@/components/ai-panel/artifacts'
// Type-only import — erased at compile time, so no server code is pulled into
// this client bundle. Keeps the payload shape in one place.
import type {
  ExcelDataPayload,
  NpsPayload,
  PitPayload,
  CompPayload,
  OngPayload,
} from '@/app/api/okr-dashboard-v2/excel-data/route'

// ═══════════════════════════════════════════════════════════════════════════
// Shared visual tokens — the live dashboard's, verbatim where they exist there.
//
// /customers/okr-dashboard styles with inline objects keyed to the Hub's CSS
// variables rather than a stylesheet, so the same tokens are declared here and
// reused across this page's tables, cards and badges. Anything below that the
// live page also defines (CARD, TH_*, TD_*) is copied from it unchanged so the
// two pages line up pixel for pixel.
// ═══════════════════════════════════════════════════════════════════════════

// Card chrome — identical to the live dashboard's `cardStyle`.
const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
}
// Same card with the padding removed, for tables that run edge to edge.
const CARD_FLUSH: React.CSSProperties = { ...CARD, padding: 0, overflowX: 'auto' }

const TH_BASE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  borderBottom: '0.5px solid var(--border)',
}
const TH_LEFT: React.CSSProperties = { ...TH_BASE, textAlign: 'left', padding: '10px 12px' }
const TH_NUM: React.CSSProperties = { ...TH_BASE, textAlign: 'center', padding: '10px 12px' }
const TD_LEFT: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: 'var(--text)' }
const TD_NUM: React.CSSProperties = {
  textAlign: 'center',
  padding: '10px 12px',
  color: 'var(--text)',
  fontVariantNumeric: 'tabular-nums',
}
const TD_MUTED: React.CSSProperties = { ...TD_LEFT, color: 'var(--text3)' }
const TR_LINE: React.CSSProperties = { borderBottom: '0.5px solid var(--border)' }
// Footer row — the live dashboard's "Actual" / total rows read this way.
const TFOOT_TD: React.CSSProperties = {
  padding: '10px 12px',
  borderTop: '1px solid var(--border2)',
  background: 'var(--surface2)',
  fontWeight: 700,
  color: 'var(--text)',
}
// Alternating column band on the grouped Per-PM tables (was the mockup's `.grp`).
// Uses the same --surface2 wash the live dashboard uses for its zebra rows.
const BAND: React.CSSProperties = { background: 'var(--surface2)' }
const TABLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }

// ── Metric card — the live dashboard's StatCard, split into reusable parts ──
const KPI_CARD: React.CSSProperties = { ...CARD, padding: '16px 18px' }
const KPI_LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  fontWeight: 600,
}
const KPI_VALUE_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 9,
  marginTop: 8,
  fontVariantNumeric: 'tabular-nums',
}
const KPI_VALUE: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 650,
  letterSpacing: '-0.5px',
  lineHeight: 1,
  color: 'var(--text)',
}
const KPI_DELTA: React.CSSProperties = { fontSize: 11.5, fontWeight: 550, color: 'var(--text3)' }
const KPI_FOOT: React.CSSProperties = { fontSize: 11, marginTop: 9, color: 'var(--text3)' }

// Legend / footnote strip under a table — the live dashboard's calendar legend.
const LEGEND: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
  padding: '9px 12px',
  borderTop: '0.5px solid var(--border)',
  fontSize: 11,
  color: 'var(--text3)',
}
// Inline table / column names inside the caveat notes. The mockup set these in
// IBM Plex Mono; that font is gone with the rest of the redesign styling, so they
// are marked the way the live dashboard marks anything set apart — a --surface2
// chip — and stay in the page's own typeface.
const MONO: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '0 4px',
  color: 'var(--text2)',
  whiteSpace: 'nowrap',
}

// Text-only button ("Open full view →", "View all N →"). Borderless, inherits the
// page font, hover handled inline the way the live dashboard does its buttons.
const LINK_BTN: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  fontFamily: 'inherit',
  fontSize: 11.5,
  color: 'var(--text2)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

// ── Tone pairs for pills / badges ───────────────────────────────────────────
// The live dashboard writes these as literal hexes (#166534 green, #92400e amber,
// #991b1b red). In light mode those ARE the theme tokens — var(--green) is
// #166534 and var(--amber) is #92400e — so the tokens are used instead: identical
// where leadership reads the page, and still legible in dark mode, where the
// literals would sit dark-on-dark. Blue has no token in globals.css, so the live
// dashboard's own pair is kept verbatim.
const TONE: Record<string, { bg: string; fg: string }> = {
  green:   { bg: 'var(--green-bg)', fg: 'var(--green)' },
  amber:   { bg: 'var(--amber-bg)', fg: 'var(--amber)' },
  red:     { bg: 'var(--red-soft)', fg: 'var(--red)' },
  blue:    { bg: 'rgba(59, 130, 246, 0.13)', fg: '#1e40af' },
  neutral: { bg: 'var(--surface2)', fg: 'var(--text2)' },
}

// Badge shape — the live dashboard's StatusBadge / CurrentPhaseBadge.
function badgeStyle(tone: keyof typeof TONE | string): React.CSSProperties {
  const t = TONE[tone] ?? TONE.neutral
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10.5,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 99,
    background: t.bg,
    color: t.fg,
    whiteSpace: 'nowrap',
  }
}

// The few rules that cannot be written inline. The live dashboard injects its
// own keyframe block exactly this way; the two <summary> rules only strip the
// native disclosure triangle so the rotating ▸ can stand in for it, and the last
// one puts the caveat notes' <b> in amber without touching every call site.
const OKR2_MIN_CSS = `
@keyframes okrAISlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
details.okr2-fold > summary { list-style: none; }
details.okr2-fold > summary::-webkit-details-marker { display: none; }
.okr2-flagbody b { color: var(--amber); font-weight: 700; }
`

// ═══════════════════════════════════════════════════════════════════════════
// Constants + data logic — carried over VERBATIM from the live dashboard at
// /customers/okr-dashboard. Nothing here is recalculated differently; the only
// change on this page is presentation.
// ═══════════════════════════════════════════════════════════════════════════
const PHASE_KEYS = ['design', 'permit', 'contract'] as const
type PhaseKey = (typeof PHASE_KEYS)[number]

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let n = a; n <= b; n++) out.push(n)
  return out
}

const PHASE_META: Record<
  PhaseKey,
  { label: string; short: string; accent: string; steps: number[]; startStep: number; finalStep: number }
> = {
  // `accent` is the only field that moved: the three phase colours are now the
  // live dashboard's exact hexes (blue / amber / green), not the mockup palette's.
  // Labels, short names and step ranges are untouched — they feed the AI context.
  design:   { label: 'Design completed',  short: 'Design',   accent: '#3b82f6', steps: range(6, 16),  startStep: 6,  finalStep: 16 },
  permit:   { label: 'Permit received',   short: 'Permit',   accent: '#f59e0b', steps: range(17, 20), startStep: 17, finalStep: 20 },
  contract: { label: 'Contract executed', short: 'Contract', accent: '#22c55e', steps: range(21, 26), startStep: 21, finalStep: 26 },
}

const MONTHLY_TARGET_PER_PM = 3 // each OKR: 3 per PM per month
const TOTAL_JOURNEY_STEPS = 37  // denominator for the overall journey row

const PHASE_MEETING_CODES: Record<PhaseKey, Set<string>> = {
  design: new Set(PHASE_META.design.steps.map(n => `step_${String(n).padStart(2, '0')}`)),
  permit: new Set(PHASE_META.permit.steps.map(n => `step_${String(n).padStart(2, '0')}`)),
  contract: new Set(PHASE_META.contract.steps.map(n => `step_${String(n).padStart(2, '0')}`)),
}

const getFixedTaskTotal = (stepStart: number, stepEnd: number) =>
  WORKFLOW_STEPS
    .filter(s => s.step >= stepStart && s.step <= stepEnd)
    .reduce((acc, step) =>
      acc + step.roles.reduce((rAcc, role) => rAcc + role.tasks.length, 0), 0)

const PHASE_TOTAL_TASKS: Record<PhaseKey, number> = {
  design: getFixedTaskTotal(6, 16),
  permit: getFixedTaskTotal(17, 20),
  contract: getFixedTaskTotal(21, 26),
}

// ── Support-team reference rows ─────────────────────────────────────────────
// HARDCODED, carried over from the live dashboard's Section E. These targets are
// hand-entered on the Excel tab and are not backed by any workflow record, which
// is exactly what the `.flag` under this table says. Left as-is rather than
// invented or dropped; obtained stays 0 because there is no source to read.
const SUPPORT_TEAMS: { name: string; team: string; scope: string; target: number; obtained: number }[] = [
  { name: 'Kevin', team: 'Draft team', scope: 'Design', target: 2, obtained: 0 },
  { name: 'Kevin', team: 'Draft team', scope: 'Permit', target: 5, obtained: 0 },
  { name: 'Kelly and Hazel', team: 'Selections team', scope: 'Selections', target: 2, obtained: 0 },
]

// ── Supabase row shapes ────────────────────────────────────────────────────
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
interface ChecklistRowDB {
  client_id: string
  meeting_code: string
  completed: boolean
}

// ── Derived per-client shapes ──────────────────────────────────────────────
interface PhaseStatus {
  done: boolean
  completedCount: number
  total: number
  completedDate: Date | null
}
interface ClientComputed {
  id: string
  name: string
  projectType: string
  owner: string
  design: PhaseStatus
  permit: PhaseStatus
  contract: PhaseStatus
  designDays: number | null
  currentPhase: 'Design' | 'Permit' | 'Contract' | 'Complete'
}

// ── Date helpers (Eastern Time, matching the rest of the app) ──────────────
function etYMD(d: Date): { ym: string; day: number } {
  const s = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD
  return { ym: s.slice(0, 7), day: Number(s.slice(8, 10)) }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pace model — from the mockup's script. Purely presentational: it turns
// (target, done, in-flight) plus "as of day N" into a status token. No data
// source of its own.
// ═══════════════════════════════════════════════════════════════════════════
type PaceState = 'done' | 'go' | 'ok' | 'risk'

const PACE_LABEL: Record<PaceState, string> = {
  done: 'Target met',
  go: 'In progress',
  ok: 'Not started',
  risk: 'Behind pace',
}
// Dot colour and badge tone per state. Same four states as before — only the
// values changed, from the mockup's scoped variables to the Hub's palette.
const PACE_DOT: Record<PaceState, string> = {
  done: 'var(--green)',
  go: '#3b82f6',
  ok: 'var(--text3)',
  risk: 'var(--red)',
}
const PACE_PILL: Record<PaceState, string> = { done: 'green', go: 'blue', ok: 'neutral', risk: 'red' }

function makePace(asOfDay: number, daysInMonth: number) {
  const expected = (target: number) => target * (asOfDay / daysInMonth)
  const state = (target: number, done: number, inFlight: number): PaceState => {
    // Guard the mockup didn't need: with no PMs the target is 0, and 0 >= 0 would
    // report "Target met" against a target that does not exist.
    if (target <= 0) return 'ok'
    if (done >= target) return 'done'
    if (done >= expected(target) - 0.001) return done > 0 ? 'go' : inFlight > 0 ? 'go' : 'ok'
    if (inFlight > 0) return asOfDay >= daysInMonth * 0.45 ? 'risk' : 'go'
    return asOfDay >= daysInMonth * 0.45 ? 'risk' : 'ok'
  }
  return { expected, state }
}

// Signed gap, formatted the way the mockup renders it (− is U+2212). The mockup
// itself always prefixed a minus because its sample data never beat target;
// a real overshoot has to read as +N.
function gapText(done: number, target: number): string {
  const g = done - target
  if (g === 0) return '0'
  return g > 0 ? `+${g}` : `−${Math.abs(g)}`
}

// ═══════════════════════════════════════════════════════════════════════════
export default function OKRDashboardV2Page() {
  // No theme hook any more: with the scoped stylesheet gone, light/dark comes
  // from the Hub's own tokens exactly as it does on the live dashboard.
  const [clients, setClients] = useState<ClientRowDB[]>([])
  const [completions, setCompletions] = useState<CompletionRowDB[]>([])
  const [starts, setStarts] = useState<StepStartRowDB[]>([])
  const [checklistRows, setChecklistRows] = useState<ChecklistRowDB[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'over' | 'pm' | 'proj' | 'hist'>('over')

  // Same four reads as the live dashboard. Read-only.
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: c }, { data: comp }, { data: st }, { data: chk }] = await Promise.all([
        supabase.from('clients').select('id, name, project_type, owner, location'),
        supabase.from('workflow_step_completions').select('client_id, step_number, completed_at'),
        supabase.from('journey_step_start').select('client_id, step_number, started_at'),
        supabase.from('journey_checklists').select('client_id, meeting_code, completed'),
      ])
      setClients((c ?? []) as ClientRowDB[])
      setCompletions((comp ?? []) as CompletionRowDB[])
      setStarts((st ?? []) as StepStartRowDB[])
      setChecklistRows((chk ?? []) as ChecklistRowDB[])
      setLoading(false)
    }
    load().catch(err => {
      console.error('[okr-dashboard-v2] load error:', err)
      setLoading(false)
    })
  }, [])

  // ── Live Excel tracker data (Microsoft Graph, read-only) ─────────────────
  // Separate effect so a slow or failing Graph read never blocks the Supabase
  // sections. The route always answers 200 — on failure it returns nulls plus
  // `errors`, and each section below falls back to its own placeholder.
  const [excel, setExcel] = useState<ExcelDataPayload | null>(null)
  const [excelLoading, setExcelLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadExcel() {
      try {
        const res = await fetch('/api/okr-dashboard-v2/excel-data')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ExcelDataPayload
        if (!cancelled) setExcel(json)
      } catch (err) {
        console.error('[okr-dashboard-v2] tracker read failed:', err)
        if (!cancelled) {
          setExcel({
            ok: false, source: null, nps: null, pit: null, selections: null, bid: null,
            selectionsOngoing: null, bidOngoing: null,
            errors: ['Could not reach the tracker read endpoint.'],
          })
        }
      } finally {
        if (!cancelled) setExcelLoading(false)
      }
    }
    loadExcel()
    return () => { cancelled = true }
  }, [])

  // ── Current ET month ─────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), [])
  const nowYM = etYMD(now).ym
  const todayDay = etYMD(now).day
  const [calYearStr, calMonthStr] = nowYM.split('-')
  const calYear = Number(calYearStr)
  const calMonthIdx = Number(calMonthStr) - 1
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const monthLabel = new Date(calYear, calMonthIdx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthShort = new Date(calYear, calMonthIdx, 1).toLocaleDateString('en-US', { month: 'short' })
  const monthName = new Date(calYear, calMonthIdx, 1).toLocaleDateString('en-US', { month: 'long' })
  const quarterLabel = `Q${Math.floor(calMonthIdx / 3) + 1} ${calYear}`

  // "Viewing as of" scrubber — drives the pace model only, never the data.
  const [asOfDay, setAsOfDay] = useState(todayDay)
  const pace = useMemo(() => makePace(asOfDay, daysInMonth), [asOfDay, daysInMonth])

  // ── Derive per-client OKR status (verbatim from the live dashboard) ───────
  const computed = useMemo<ClientComputed[]>(() => {
    const compByClient = new Map<string, Map<number, string | null>>()
    for (const r of completions) {
      const m = compByClient.get(r.client_id) ?? new Map<number, string | null>()
      m.set(r.step_number, r.completed_at)
      compByClient.set(r.client_id, m)
    }
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

  // ── KPI task completion per client per phase (journey_checklists) ─────────
  const taskStatsByClient = useMemo(() => {
    const map = new Map<string, Record<PhaseKey, { total: number; completed: number }>>()
    for (const r of checklistRows) {
      let pk: PhaseKey | null = null
      for (const k of PHASE_KEYS) {
        if (PHASE_MEETING_CODES[k].has(r.meeting_code)) { pk = k; break }
      }
      if (!pk) continue
      let rec = map.get(r.client_id)
      if (!rec) {
        rec = { design: { total: 0, completed: 0 }, permit: { total: 0, completed: 0 }, contract: { total: 0, completed: 0 } }
        map.set(r.client_id, rec)
      }
      rec[pk].total += 1
      if (r.completed === true) rec[pk].completed += 1
    }
    return map
  }, [checklistRows])

  // ── Overall journey progress per client ──────────────────────────────────
  const completedStepsByClient = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of completions) {
      map.set(r.client_id, (map.get(r.client_id) ?? 0) + 1)
    }
    return map
  }, [completions])

  // ── Aggregations ─────────────────────────────────────────────────────────
  const inCurrentMonth = (d: Date | null) => !!d && etYMD(d).ym === nowYM
  const phaseOf = (c: ClientComputed, k: PhaseKey): PhaseStatus => c[k]

  const pmNames = useMemo(
    () => Array.from(new Set(computed.map(c => c.owner))).sort((a, b) => a.localeCompare(b)),
    [computed],
  )
  const numPMs = pmNames.length
  const monthlyTeamTarget = numPMs * MONTHLY_TARGET_PER_PM

  const obtainedThisMonth = (k: PhaseKey) =>
    computed.filter(c => phaseOf(c, k).done && inCurrentMonth(phaseOf(c, k).completedDate)).length

  // "In flight" = the phase has started but is not finished. Derived from the
  // same completedCount/done the live dashboard already computes; it feeds the
  // mockup's pace model, which needs to tell "not started" from "underway".
  const inFlight = (k: PhaseKey) =>
    computed.filter(c => !phaseOf(c, k).done && phaseOf(c, k).completedCount > 0).length

  const designDaysList = computed.map(c => c.designDays).filter((n): n is number => n !== null)
  const avgDesignDays = designDaysList.length
    ? Math.round(designDaysList.reduce((s, n) => s + n, 0) / designDaysList.length)
    : null

  // ── Per-PM rows ──────────────────────────────────────────────────────────
  const pmRows = pmNames.map(pm => {
    const group = computed.filter(c => c.owner === pm)
    const perPhase = (k: PhaseKey) => {
      const winners = group.filter(c => phaseOf(c, k).done && inCurrentMonth(phaseOf(c, k).completedDate))
      return {
        target: MONTHLY_TARGET_PER_PM,
        obtained: winners.length,
        names: winners.map(c => c.name),
        inFlight: group.filter(c => !phaseOf(c, k).done && phaseOf(c, k).completedCount > 0).length,
      }
    }
    return { pm, design: perPhase('design'), permit: perPhase('permit'), contract: perPhase('contract') }
  })

  // ── Calendar dots ────────────────────────────────────────────────────────
  const calendarDots = useMemo(() => {
    const map = new Map<number, Map<PhaseKey, number>>()
    for (const c of computed) {
      for (const k of PHASE_KEYS) {
        const d = c[k].completedDate
        if (!d) continue
        const { ym, day } = etYMD(d)
        if (ym !== nowYM) continue
        const inner = map.get(day) ?? new Map<PhaseKey, number>()
        inner.set(k, (inner.get(k) ?? 0) + 1)
        map.set(day, inner)
      }
    }
    return map
  }, [computed, nowYM])

  // ── Project cards ────────────────────────────────────────────────────────
  const projCards = computed.map(c => ({
    id: c.id,
    name: c.name,
    pm: c.owner,
    type: c.projectType,
    phase: c.currentPhase,
    steps: [completedStepsByClient.get(c.id) ?? 0, TOTAL_JOURNEY_STEPS] as [number, number],
    // One group per OKR phase: that phase's step progress, with its OWN KPI-task
    // progress nested directly beneath it. This matches the live dashboard, which
    // breaks KPI tasks out per phase rather than showing one combined figure —
    // leadership already reads it that way. The mockup's single aggregate row is
    // deliberately not used.
    //
    // Same source and same arithmetic as the live page: numerator from
    // journey_checklists (taskStatsByClient, which only has rows for checked
    // tasks), denominator from the fixed PHASE_TOTAL_TASKS[k] so the percentage
    // stays meaningful. Only the grouping differs.
    groups: PHASE_KEYS.map(k => {
      const ts = taskStatsByClient.get(c.id)?.[k] ?? { total: 0, completed: 0 }
      return {
        key: k,
        label: PHASE_META[k].short,
        steps: [c[k].completedCount, c[k].total] as [number, number],
        tasks: [ts.completed, PHASE_TOTAL_TASKS[k]] as [number, number],
      }
    }),
  }))

  // ── Pace banner ──────────────────────────────────────────────────────────
  const totalDone = PHASE_KEYS.reduce((s, k) => s + obtainedThisMonth(k), 0)
  const totalTarget = monthlyTeamTarget * PHASE_KEYS.length
  const behindPhases = PHASE_KEYS.filter(
    k => pace.state(monthlyTeamTarget, obtainedThisMonth(k), inFlight(k)) === 'risk',
  )
  const totalInFlight = PHASE_KEYS.reduce((s, k) => s + inFlight(k), 0)
  const elapsedPct = Math.round((asOfDay / daysInMonth) * 100)

  // Phase distribution — used for the Projects-tab note so its copy is derived
  // rather than asserted (the mockup hardcoded "all five sit in design").
  const phaseCounts = computed.reduce<Record<string, number>>((acc, c) => {
    acc[c.currentPhase] = (acc[c.currentPhase] ?? 0) + 1
    return acc
  }, {})
  const allInOnePhase = computed.length > 1 && Object.keys(phaseCounts).length === 1
  const solePhase = allInOnePhase ? Object.keys(phaseCounts)[0] : null

  // ── AI context (same shape the live dashboard sends) ─────────────────────
  const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0)

  // ── Live tracker figures for the AI context ──────────────────────────────
  // NPS, PIT Goals, Selections and Bid became live in Phase 2a. Saying so in the
  // prompt is not enough on its own: the closing instruction tells the model to
  // ground every answer in this context and never invent numbers, so the actual
  // figures have to be here. Otherwise "this data is connected" just licenses it
  // to make numbers up.
  //
  // Reads only the already-fetched `excel` state — no new query, no new maths.
  // All three states are covered honestly: still reading, unreachable, or live.
  const trackerContext = ((): string => {
    const head = 'LIVE EXCEL TRACKER (NPS History, PIT Goals KPI, Selections and Bid — Completed and Ongoing)'

    if (excelLoading) {
      return `${head}:
These four sections ARE connected, but the tracker read for this page load has not finished.
If asked, say the figures are still loading rather than quoting any number.`
    }
    if (!excel?.ok) {
      return `${head}:
These four sections ARE connected in the product, but the tracker could not be read on this
page load, so no figures are available to you. If asked, say the tracker is unreachable right
now. Do NOT guess, and do NOT quote numbers from memory.`
    }

    const L: string[] = [`${head} — CONNECTED AND ANSWERABLE. Figures below are live.`]
    if (excel.source) {
      L.push(
        `Source file: ${excel.source.fileName}` +
        (excel.source.lastModified ? `, last edited ${excel.source.lastModified}` : ''),
      )
    }

    const n = excel.nps
    if (n) {
      L.push(
        '',
        'NPS HISTORY (NewNPS table):',
        `- ${n.total} responses all time; ${n.scored} carry a 1-10 score; average ${n.avgAll ?? 'n/a'}`,
        ...n.years.map(y => `- ${y.year}: ${y.count} responses, avg ${y.avg ?? 'n/a'}` +
          (y.quarters.length ? ` (${y.quarters.map(q => `${q.label} ${q.count}${q.avg !== null ? ` avg ${q.avg}` : ''}`).join(', ')})` : '')),
        ...(n.byPm.length ? [`- By PM: ${n.byPm.map(p => `${p.pm} ${p.count} avg ${p.avg ?? 'n/a'}`).join('; ')}`] : []),
        '- The score is "how satisfied are you with your experience so far?" (1-10). The older',
        '  NPS tab asks likelihood-to-refer instead and is deliberately NOT merged in — if asked',
        '  about referral-based NPS, say that is a different metric and is not on this dashboard.',
      )
    } else {
      L.push('', 'NPS HISTORY: connected, but this read returned nothing — say so if asked.')
    }

    const p = excel.pit
    if (p) {
      L.push(
        '',
        `PIT GOALS KPI (PITprecon table) — ${p.itemCount} items` +
        (p.quarters.length ? `, quarters ${p.quarters.join(', ')}` : ''),
        '- The stage columns are a CUMULATIVE FUNNEL: each counts items that reached AT LEAST',
        '  that stage, so the numbers step down from left to right. An item at "SOP Created" is',
        '  also counted under every earlier stage. Explain it that way if asked.',
        `- Stages, in order: ${p.stages.join(' | ')}`,
        ...p.people.map(person => `- ${person.name}: ${person.counts.join(', ')}`),
        `- Team totals: ${p.totals.join(', ')}`,
        '- The two columns the old dashboard labelled "Department Team" are Review and Approval.',
      )
      if (p.notes.length) L.push(`- Source caveats: ${p.notes.join('; ')}`)
    } else {
      L.push('', 'PIT GOALS KPI: connected, but this read returned nothing — say so if asked.')
    }

    const comp: [string, string, typeof excel.selections][] = [
      ['SELECTIONS COMPLETED', 'SelectionsComp', excel.selections],
      ['BID COMPLETED', 'BidComp', excel.bid],
    ]
    for (const [label, table, d] of comp) {
      if (!d) {
        L.push('', `${label}: connected, but this read returned nothing — say so if asked.`)
        continue
      }
      L.push(
        '',
        `${label} (${table} table):`,
        `- ${d.total} completed all time; ${d.thisMonth} in ${monthLabel}`,
        ...(d.byPm.length ? [`- By PM: ${d.byPm.map(x => `${x.pm} ${x.count}`).join('; ')}`] : []),
        `- That table has no "date completed" column, so "${d.dateColumn}" is used as the`,
        "  completion date — it is the column that reconciles with the sheet's own # Days figure.",
      )
      if (d.anomalies > 0) {
        L.push(`- ${d.anomalies} row(s) where the two dates disagree with # Days — flag this if the dates come up.`)
      }
      if (d.dated < d.total) {
        L.push(`- ${d.total - d.dated} row(s) have no readable date and are excluded from the monthly count.`)
      }
    }

    // Ongoing is the second half of the same two cards, so it belongs in the same
    // context — otherwise the model would call a table the user can see on screen
    // "not connected".
    const ong: [string, string, typeof excel.selectionsOngoing][] = [
      ['SELECTIONS ONGOING', 'SelectionsOng', excel.selectionsOngoing],
      ['BID ONGOING', 'BidOng', excel.bidOngoing],
    ]
    for (const [label, table, d] of ong) {
      if (!d) {
        L.push('', `${label}: connected, but this read returned nothing — say so if asked.`)
        continue
      }
      L.push(
        '',
        `${label} (${table} table) — rows still in the stage, NOT completed:`,
        `- ${d.total} in progress right now`,
        ...(d.byPm.length ? [`- By PM: ${d.byPm.map(x => `${x.pm} ${x.count}`).join('; ')}`] : []),
        ...(d.daysColumn
          ? [`- "${d.daysColumn}" here is days elapsed SO FAR as the workbook last calculated it — it is`,
             '  not a finished duration, and it can lag if the sheet has not recalculated recently.']
          : ['- This table carries no day-count column, so there are no day figures to quote.']),
      )
      if (d.anomalies > 0) {
        L.push(`- ${d.anomalies} row(s) carry an unusable day count and are shown blank — say so if day counts come up.`)
      }
      if (d.notes.length) L.push(`- Source caveats: ${d.notes.join('; ')}`)
    }
    L.push(
      '',
      'Ongoing is read from the tracker for Selections and Bid ONLY. Design, Permitting and',
      'Contract in-progress status comes from Active Projects Progress (Supabase) instead — do',
      'not mix the two sources or quote tracker ongoing figures for those three stages.',
    )

    return L.join('\n')
  })()
  const okrAIContext = `You are CASK Intelligence on the Pre-Con OKR Dashboard for CASK Construction.
Today: ${now.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' })}

ACTIVE CLIENTS AND OKR STATUS:
${computed.map(client => {
  const completedSteps = completedStepsByClient.get(client.id) ?? 0
  return `
- Client: ${client.name} | PM: ${client.owner} | Type: ${client.projectType}
  Overall Journey: ${completedSteps} of ${TOTAL_JOURNEY_STEPS} steps · ${pct(completedSteps, TOTAL_JOURNEY_STEPS)}%
  Design (Steps 6-13): ${client.design.completedCount} of ${client.design.total} steps ${client.design.done ? '✓ COMPLETE' : 'IN PROGRESS'}
  Permit (Steps 14-15): ${client.permit.completedCount} of ${client.permit.total} steps ${client.permit.done ? '✓ COMPLETE' : 'IN PROGRESS'}
  Contract (Steps 16-21): ${client.contract.completedCount} of ${client.contract.total} steps ${client.contract.done ? '✓ COMPLETE' : 'IN PROGRESS'}`
}).join('')}

MONTHLY TARGETS (${monthLabel}):
${PHASE_KEYS.map(k => `- ${PHASE_META[k].label}: Target ${monthlyTeamTarget} | Obtained ${obtainedThisMonth(k)} | In flight ${inFlight(k)}`).join('\n')}

${trackerContext}

NOT CONNECTED (do not answer from these — say the data is not wired up yet):
Avg Design Days on this dashboard is derived from workflow records, not the tracker. The
tracker's Monthly Summary block is not read at all.

There is no Quarterly Targets section on this dashboard. If asked about quarterly targets,
say the section was removed because the source tracker holds three conflicting copies of it.

Answer questions about client OKR status, PM assignments, monthly targets, and the live
tracker figures above (NPS, PIT Goals, Selections, Bid). Be specific and ground every answer
in the data above — never invent clients or numbers not present here.`

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <>
      <TopBar title="Pre-Con OKR Dashboard" subtitle={monthLabel}>
        {/* "Viewing as of" scrubber. Already drawn with the Hub's own tokens, so
            it carries over from the previous pass unchanged apart from the
            accent, which now matches the Design phase colour. */}
        {!loading && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '4px 9px',
            }}
          >
            <label htmlFor="okr2-day" style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              Viewing as of
            </label>
            <input
              id="okr2-day"
              type="range"
              min={1}
              max={daysInMonth}
              step={1}
              value={asOfDay}
              onChange={e => setAsOfDay(Number(e.target.value))}
              style={{ width: 96, accentColor: PHASE_META.design.accent }}
            />
            <output
              htmlFor="okr2-day"
              style={{ fontSize: 11.5, color: 'var(--text)', minWidth: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {monthShort} {asOfDay}
            </output>
          </div>
        )}
      </TopBar>

      <style dangerouslySetInnerHTML={{ __html: OKR2_MIN_CSS }} />

      {/* Same shell as the live dashboard. The floating AI stays OUTSIDE this
          div: `animate-page-in` transforms it, which would otherwise make it the
          containing block for a position:fixed child. */}
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
            <div style={{ marginBottom: 20 }}>
              <h1
                className="font-serif"
                style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1.1 }}
              >
                Pre-con OKR dashboard
              </h1>
              <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text3)' }}>
                Design, permit and contract across{' '}
                <b style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {computed.length} active client{computed.length === 1 ? '' : 's'}
                </b>{' '}
                and {numPMs} PM{numPMs === 1 ? '' : 's'}.{' '}
                {/* Source stated precisely rather than the mockup's blanket "Synced from
                    the Excel tracker". The OKR figures come from workflow records; only
                    NPS, PIT, Selections and Bid come from the tracker. Avg design days
                    and the monthly summary are still unconnected. */}
                <span>
                  OKR figures live from workflow records
                  {excelLoading
                    ? ' · reading the Excel tracker…'
                    : excel?.ok
                      ? ` · NPS, PIT, Selections and Bid live from ${excel.source?.fileName ?? 'the Excel tracker'}${
                          excel.source?.lastModified
                            ? `, last edited ${new Date(excel.source.lastModified).toLocaleString('en-US', {
                                timeZone: 'America/New_York', month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })} ET`
                            : ''
                        }`
                      : ' · Excel tracker unreachable, those sections show placeholders'}
                </span>
              </p>
            </div>

            {/* Tabs — the live dashboard has none, so these follow its own idiom:
                an underline in --charcoal (the colour it uses for the overall
                journey bar) against uppercase-free 12.5px labels. */}
            <div
              role="tablist"
              aria-label="Dashboard views"
              style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 24 }}
            >
              <TabBtn id="over" cur={tab} set={setTab}>Overview</TabBtn>
              <TabBtn id="pm" cur={tab} set={setTab} count={numPMs}>Per PM</TabBtn>
              <TabBtn id="proj" cur={tab} set={setTab} count={computed.length}>Projects</TabBtn>
              <TabBtn id="hist" cur={tab} set={setTab}>History</TabBtn>
            </div>

            {/* ══════════════ OVERVIEW ══════════════ */}
            <section id="okr2-p-over" role="tabpanel" aria-labelledby="okr2-t-over" hidden={tab !== 'over'}>
              {/* The live dashboard fixes this row at four columns; six cards ride
                  here, so it wraps on the same 12px gutter instead. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                {PHASE_KEYS.map(k => {
                  const done = obtainedThisMonth(k)
                  const flight = inFlight(k)
                  const st = pace.state(monthlyTeamTarget, done, flight)
                  const exp = Math.round(pace.expected(monthlyTeamTarget))
                  const foot =
                    st === 'risk' ? `${Math.max(0, exp - done)} behind pace · ${exp} expected by ${monthShort} ${asOfDay}`
                    : st === 'done' ? 'Target met'
                    : flight > 0 ? `${flight} in flight · on pace as of ${monthShort} ${asOfDay}`
                    : `On pace · ${exp} expected by ${monthShort} ${asOfDay}`
                  return (
                    <div style={KPI_CARD} key={k}>
                      <div style={KPI_LABEL}>{PHASE_META[k].label}</div>
                      <div style={KPI_VALUE_ROW}>
                        <span style={KPI_VALUE}>{done}</span>
                        <span style={KPI_DELTA}>of {monthlyTeamTarget} target</span>
                      </div>
                      {/* Progress bar with the pace marker sitting on top of it —
                          same 4px bar the live dashboard uses everywhere. */}
                      <div style={{ position: 'relative', marginTop: 11 }}>
                        <ProgressBar
                          value={done}
                          total={monthlyTeamTarget}
                          color={st === 'risk' ? 'var(--red)' : PHASE_META[k].accent}
                        />
                        <span
                          title={`Expected pace at ${monthShort} ${asOfDay}`}
                          style={{
                            position: 'absolute',
                            top: -3,
                            left: `${Math.min(100, (asOfDay / daysInMonth) * 100)}%`,
                            width: 1,
                            height: 10,
                            background: 'var(--text3)',
                          }}
                        />
                      </div>
                      <div style={{ ...KPI_FOOT, color: st === 'risk' ? 'var(--red)' : 'var(--text3)' }}>{foot}</div>
                    </div>
                  )
                })}

                {/* Avg design days — real, from step 6 → step 16 */}
                <div style={KPI_CARD}>
                  <div style={KPI_LABEL}>Avg design days</div>
                  <div style={KPI_VALUE_ROW}>
                    <span style={{ ...KPI_VALUE, color: avgDesignDays === null ? 'var(--text3)' : 'var(--text)' }}>
                      {avgDesignDays ?? '—'}
                    </span>
                  </div>
                  <div style={KPI_FOOT}>
                    {designDaysList.length
                      ? `across ${designDaysList.length} completed design${designDaysList.length === 1 ? '' : 's'}`
                      : 'No completions to measure yet'}
                  </div>
                </div>

                {/* LIVE from the Excel tracker (SelectionsComp / BidComp tables).
                    Falls back to an em-dash card when the read fails. */}
                <TrackerCountCard
                  label="Selections completed"
                  data={excel?.selections ?? null}
                  loading={excelLoading}
                  monthShort={monthShort}
                />
                <TrackerCountCard
                  label="Bid completed"
                  data={excel?.bid ?? null}
                  loading={excelLoading}
                  monthShort={monthShort}
                />
              </div>

              {/* Pace banner — the live dashboard's alert language: a soft red
                  wash when something is behind, plain card chrome otherwise. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  marginTop: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 12.5,
                  color: 'var(--text2)',
                  background: behindPhases.length ? 'var(--red-soft)' : 'var(--surface)',
                  border: `1px solid ${behindPhases.length ? 'var(--red-border)' : 'var(--border)'}`,
                }}
              >
                <Dot color={behindPhases.length ? 'var(--red)' : totalInFlight > 0 ? PACE_DOT.go : 'var(--text3)'} />
                <span>
                  {behindPhases.length ? (
                    <>
                      <b style={{ color: 'var(--text)', fontWeight: 600 }}>
                        {elapsedPct}% of {monthName} elapsed, {totalDone} of {totalTarget} completed.
                      </b>{' '}
                      {behindPhases.length} of {PHASE_KEYS.length} OKRs {behindPhases.length === 1 ? 'is' : 'are'} behind
                      pace ({behindPhases.map(k => PHASE_META[k].short.toLowerCase()).join(', ')}).{' '}
                      {totalInFlight > 0
                        ? `${totalInFlight} package${totalInFlight === 1 ? '' : 's'} in flight.`
                        : 'Nothing is in flight.'}
                    </>
                  ) : (
                    <>
                      <b style={{ color: 'var(--text)', fontWeight: 600 }}>{elapsedPct}% of {monthName} elapsed.</b>{' '}
                      {totalDone} of {totalTarget} completed, {totalInFlight} in flight. Nothing is behind pace yet.
                    </>
                  )}
                </span>
              </div>

              <SectionLabel
                title="Per PM"
                hint={`monthly targets · ${MONTHLY_TARGET_PER_PM} each per OKR`}
                action="Open full view →"
                onAction={() => setTab('pm')}
              />
              <div style={CARD_FLUSH}>
                <table style={{ ...TABLE, minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH_LEFT, minWidth: 96 }} />
                      {PHASE_KEYS.map(k => (
                        <th
                          key={k}
                          colSpan={3}
                          style={{
                            ...TH_NUM,
                            ...(k === 'permit' ? {} : BAND),
                            color: PHASE_META[k].accent,
                            fontSize: 11,
                            letterSpacing: '0.02em',
                            textTransform: 'none',
                          }}
                        >
                          {PHASE_META[k].short}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th style={TH_LEFT}>PM</th>
                      {PHASE_KEYS.map(k => {
                        const band = k === 'permit' ? {} : BAND
                        return (
                          <Fragment key={k}>
                            <th style={{ ...TH_NUM, ...band }}>Tgt</th>
                            <th style={{ ...TH_NUM, ...band }}>Done</th>
                            <th style={{ ...TH_NUM, ...band }}>St</th>
                          </Fragment>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pmRows.length === 0 ? (
                      <tr><td colSpan={10} style={TD_MUTED}>No PMs found.</td></tr>
                    ) : (
                      pmRows.map(row => (
                        <tr key={row.pm} style={TR_LINE}>
                          <td style={{ ...TD_LEFT, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.pm}</td>
                          {PHASE_KEYS.map(k => {
                            const cell = row[k]
                            const st = pace.state(cell.target, cell.obtained, cell.inFlight)
                            const band = k === 'permit' ? {} : BAND
                            return (
                              <Fragment key={k}>
                                <td style={{ ...TD_NUM, ...band, color: 'var(--text3)' }}>{cell.target}</td>
                                <td style={{ ...TD_NUM, ...band, color: cell.obtained ? 'var(--text)' : 'var(--text3)' }}>
                                  {cell.obtained}
                                </td>
                                <td style={{ ...TD_NUM, ...band }} title={PACE_LABEL[st]}>
                                  <Dot color={PACE_DOT[st]} />
                                </td>
                              </Fragment>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <PaceLegend note="Red appears only when actual trails the expected run-rate for the day" />
              </div>

              <SectionLabel
                title="Active projects"
                hint={`${computed.length} tracked${solePhase ? ` · all in ${solePhase.toLowerCase()}` : ''}`}
                action="Open full view →"
                onAction={() => setTab('proj')}
              />
              {projCards.length === 0 ? (
                <div style={{ ...CARD, fontSize: 13, color: 'var(--text3)' }}>No active clients.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projCards.slice(0, 2).map(p => <ProjectCard key={p.id} p={p} />)}
                  {projCards.length > 2 && (
                    <Fold
                      title={`${projCards.length - 2} more project${projCards.length - 2 === 1 ? '' : 's'}`}
                      meta={projCards.slice(2).map(p => p.name).join(', ')}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {projCards.slice(2).map(p => <ProjectCard key={p.id} p={p} />)}
                      </div>
                    </Fold>
                  )}
                </div>
              )}

              <SectionLabel title="Reference" hint="expand when you need it" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Fold
                  title="PIT goals KPI"
                  meta={excel?.pit ? `${excel.pit.itemCount} items${excel.pit.quarters.length ? ` · ${excel.pit.quarters.join(', ')}` : ''}` : quarterLabel}
                  metaRight={foldMeta(excelLoading, !!excel?.pit)}
                >
                  <PitGoalsSection data={excel?.pit ?? null} loading={excelLoading} errors={excel?.errors ?? []} />
                </Fold>
                <Fold
                  title="NPS history"
                  meta={excel?.nps ? `${excel.nps.total} responses all time` : 'all time'}
                  metaRight={excel?.nps?.avgAll != null ? `avg ${excel.nps.avgAll.toFixed(1)}` : foldMeta(excelLoading, !!excel?.nps)}
                >
                  <NpsHistorySection data={excel?.nps ?? null} loading={excelLoading} errors={excel?.errors ?? []} />
                </Fold>
                <Fold
                  title="Selections completed"
                  meta={excel?.selections ? `${excel.selections.total} all time` : monthLabel}
                  metaRight={foldMeta(excelLoading, !!excel?.selections)}
                >
                  <CompletionsSection
                    what="Selections"
                    data={excel?.selections ?? null}
                    ongoing={excel?.selectionsOngoing ?? null}
                    loading={excelLoading}
                    errors={excel?.errors ?? []}
                    monthLabel={monthLabel}
                    fallbackDetail="Selections is not modelled as an OKR phase in workflow records, so this comes from the tracker's SelectionsComp table instead."
                  />
                </Fold>
                <Fold
                  title="Bid completed"
                  meta={excel?.bid ? `${excel.bid.total} all time` : monthLabel}
                  metaRight={foldMeta(excelLoading, !!excel?.bid)}
                >
                  <CompletionsSection
                    what="Bid"
                    data={excel?.bid ?? null}
                    ongoing={excel?.bidOngoing ?? null}
                    loading={excelLoading}
                    errors={excel?.errors ?? []}
                    monthLabel={monthLabel}
                    fallbackDetail="New section — it does not exist on the current dashboard at all. It reads the tracker's BidComp table."
                  />
                </Fold>
                <Fold
                  title="Completions calendar"
                  meta={monthLabel}
                  metaRight={calendarDots.size ? `${calendarDots.size} day${calendarDots.size === 1 ? '' : 's'} with entries` : 'no entries'}
                >
                  <CompletionsCalendar
                    year={calYear}
                    monthIdx={calMonthIdx}
                    daysInMonth={daysInMonth}
                    todayDay={todayDay}
                    monthName={monthName}
                    dots={calendarDots}
                  />
                </Fold>
              </div>
            </section>

            {/* ══════════════ PER PM ══════════════ */}
            <section id="okr2-p-pm" role="tabpanel" aria-labelledby="okr2-t-pm" hidden={tab !== 'pm'}>
              <SectionLabel
                title="Per PM breakdown"
                hint={`${monthLabel} · ${MONTHLY_TARGET_PER_PM} per PM per OKR`}
              />
              <div style={CARD_FLUSH}>
                <table style={{ ...TABLE, minWidth: 920 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH_LEFT, minWidth: 110 }} />
                      {PHASE_KEYS.map(k => (
                        <th
                          key={k}
                          colSpan={4}
                          style={{
                            ...TH_NUM,
                            ...(k === 'permit' ? {} : BAND),
                            color: PHASE_META[k].accent,
                            fontSize: 12,
                            letterSpacing: '0.02em',
                            textTransform: 'none',
                          }}
                        >
                          {PHASE_META[k].label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th style={TH_LEFT}>PM</th>
                      {PHASE_KEYS.map(k => {
                        const band = k === 'permit' ? {} : BAND
                        return (
                          <Fragment key={k}>
                            <th style={{ ...TH_NUM, ...band }}>Tgt</th>
                            <th style={{ ...TH_NUM, ...band }}>Done</th>
                            <th style={{ ...TH_NUM, ...band }}>Gap</th>
                            <th style={{ ...TH_NUM, ...band }}>Status</th>
                          </Fragment>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pmRows.length === 0 ? (
                      <tr><td colSpan={13} style={TD_MUTED}>No PMs found.</td></tr>
                    ) : (
                      pmRows.map(row => (
                        <tr key={row.pm} style={TR_LINE}>
                          <td style={{ ...TD_LEFT, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.pm}</td>
                          {PHASE_KEYS.map(k => {
                            const cell = row[k]
                            const st = pace.state(cell.target, cell.obtained, cell.inFlight)
                            const band = k === 'permit' ? {} : BAND
                            const g = cell.obtained - cell.target
                            return (
                              <Fragment key={k}>
                                <td style={{ ...TD_NUM, ...band, color: 'var(--text3)' }}>{cell.target}</td>
                                <td style={{ ...TD_NUM, ...band, color: cell.obtained ? 'var(--text)' : 'var(--text3)' }}>
                                  {cell.obtained}
                                </td>
                                <td
                                  style={{
                                    ...TD_NUM,
                                    ...band,
                                    color: g < 0 && st === 'risk' ? 'var(--red)' : 'var(--text3)',
                                    fontWeight: g < 0 && st === 'risk' ? 600 : 400,
                                  }}
                                >
                                  {gapText(cell.obtained, cell.target)}
                                </td>
                                <td style={{ ...TD_NUM, ...band }}>
                                  <Pill tone={PACE_PILL[st]} dot={PACE_DOT[st]}>{PACE_LABEL[st]}</Pill>
                                </td>
                              </Fragment>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {pmRows.length > 0 && (
                    <tfoot>
                      <tr>
                        <td style={TFOOT_TD}>Team</td>
                        {PHASE_KEYS.map(k => {
                          const done = obtainedThisMonth(k)
                          const st = pace.state(monthlyTeamTarget, done, inFlight(k))
                          const g = done - monthlyTeamTarget
                          return (
                            <Fragment key={k}>
                              <td style={{ ...TFOOT_TD, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                {monthlyTeamTarget}
                              </td>
                              <td style={{ ...TFOOT_TD, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                {done}
                              </td>
                              <td
                                style={{
                                  ...TFOOT_TD,
                                  textAlign: 'center',
                                  fontVariantNumeric: 'tabular-nums',
                                  color: g < 0 && st === 'risk' ? 'var(--red)' : 'var(--text3)',
                                }}
                              >
                                {gapText(done, monthlyTeamTarget)}
                              </td>
                              <td style={{ ...TFOOT_TD, textAlign: 'center' }}>
                                <Pill tone={PACE_PILL[st]} dot={PACE_DOT[st]}>{PACE_LABEL[st]}</Pill>
                              </td>
                            </Fragment>
                          )
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
                <PaceLegend />
              </div>

              <SectionLabel title="Support teams" hint="not tracked in workflow data" />
              <div style={CARD_FLUSH}>
                <table style={{ ...TABLE, minWidth: 660 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH_LEFT, minWidth: 150 }}>Team</th>
                      <th style={TH_NUM}>Target</th>
                      <th style={TH_NUM}>Done</th>
                      <th style={TH_NUM}>Gap</th>
                      <th style={TH_LEFT}>Status</th>
                      <th style={TH_LEFT}>Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUPPORT_TEAMS.map((t, i) => {
                      const st = pace.state(t.target, t.obtained, 0)
                      return (
                        <tr key={i} style={TR_LINE}>
                          <td style={TD_LEFT}>
                            <span style={{ fontWeight: 600 }}>{t.name}</span>
                            <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{t.team}</div>
                          </td>
                          <td style={TD_NUM}>{t.target}</td>
                          <td style={{ ...TD_NUM, color: t.obtained ? 'var(--text)' : 'var(--text3)' }}>{t.obtained}</td>
                          <td style={{ ...TD_NUM, color: 'var(--text3)' }}>{gapText(t.obtained, t.target)}</td>
                          <td style={TD_LEFT}>
                            <Pill tone={PACE_PILL[st]} dot={PACE_DOT[st]}>{PACE_LABEL[st]}</Pill>
                          </td>
                          <td style={TD_MUTED}>{t.scope}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Flag>
                <b>Data gap.</b> Support-team numbers are entered by hand on the Excel tab and don&apos;t flow from
                project records, so they can&apos;t be cross-checked against the pipeline. The targets shown are
                carried over from the current dashboard; the &ldquo;Done&rdquo; column has no source to read and stays 0.
                Worth resolving before anyone reports off them.
              </Flag>
            </section>

            {/* ══════════════ PROJECTS ══════════════ */}
            <section id="okr2-p-proj" role="tabpanel" aria-labelledby="okr2-t-proj" hidden={tab !== 'proj'}>
              <SectionLabel
                title="Active projects"
                hint={`${computed.length} client${computed.length === 1 ? '' : 's'}${solePhase ? ` · all in ${solePhase.toLowerCase()} stage` : ''}`}
              />
              {projCards.length === 0 ? (
                <div style={{ ...CARD, fontSize: 13, color: 'var(--text3)' }}>No active clients.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projCards.map(p => <ProjectCard key={p.id} p={p} />)}
                </div>
              )}
              {allInOnePhase && solePhase === 'Design' && (
                <Flag>
                  <b>All {computed.length} sit in design.</b> Nothing has reached permit or contract, which is why
                  every downstream OKR reads zero. The bottleneck is upstream of the metrics, not in them.
                </Flag>
              )}
            </section>

            {/* ══════════════ HISTORY ══════════════ */}
            <section id="okr2-p-hist" role="tabpanel" aria-labelledby="okr2-t-hist" hidden={tab !== 'hist'}>
              <SectionLabel
                title="NPS history"
                hint={excel?.nps ? `${excel.nps.total} responses · click a year to expand` : foldMeta(excelLoading, false)}
              />
              <NpsHistorySection data={excel?.nps ?? null} loading={excelLoading} errors={excel?.errors ?? []} />

              <SectionLabel
                title="PIT goals KPI"
                hint={excel?.pit
                  ? `${excel.pit.itemCount} items${excel.pit.quarters.length ? ` · ${excel.pit.quarters.join(', ')}` : ''}`
                  : foldMeta(excelLoading, false)}
              />
              <PitGoalsSection data={excel?.pit ?? null} loading={excelLoading} errors={excel?.errors ?? []} />

              <SectionLabel title="Selections completed" hint="from the tracker" />
              <CompletionsSection
                what="Selections"
                data={excel?.selections ?? null}
                ongoing={excel?.selectionsOngoing ?? null}
                loading={excelLoading}
                errors={excel?.errors ?? []}
                monthLabel={monthLabel}
                fallbackDetail="Selections is not modelled as an OKR phase in workflow records, so this comes from the tracker's SelectionsComp table instead."
              />

              <SectionLabel title="Bid completed" hint="from the tracker" />
              <CompletionsSection
                what="Bid"
                data={excel?.bid ?? null}
                ongoing={excel?.bidOngoing ?? null}
                loading={excelLoading}
                errors={excel?.errors ?? []}
                monthLabel={monthLabel}
                fallbackDetail="New section — it does not exist on the current dashboard at all. It reads the tracker's BidComp table."
              />

              <SectionLabel title="Completions calendar" hint={monthLabel} />
              <CompletionsCalendar
                year={calYear}
                monthIdx={calMonthIdx}
                daysInMonth={daysInMonth}
                todayDay={todayDay}
                monthName={monthName}
                dots={calendarDots}
              />
            </section>
          </>
        )}
      </div>

      {/* Sibling of the scrolling, animated container so position:fixed stays
          anchored to the viewport — the live dashboard mounts its FAB the same way. */}
      {!loading && <FloatingOKRAI aiContext={okrAIContext} />}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Presentational pieces
// ═══════════════════════════════════════════════════════════════════════════

function TabBtn({
  id, cur, set, count, children,
}: {
  id: 'over' | 'pm' | 'proj' | 'hist'
  cur: string
  set: (v: 'over' | 'pm' | 'proj' | 'hist') => void
  count?: number
  children: React.ReactNode
}) {
  const sel = cur === id
  return (
    <button
      role="tab"
      id={`okr2-t-${id}`}
      aria-selected={sel}
      aria-controls={`okr2-p-${id}`}
      onClick={() => set(id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: 'none',
        border: 0,
        borderBottom: `2px solid ${sel ? 'var(--charcoal)' : 'transparent'}`,
        marginBottom: -1,
        padding: '9px 14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: sel ? 700 : 600,
        color: sel ? 'var(--text)' : 'var(--text3)',
        transition: 'color 150ms ease',
      }}
    >
      {children}
      {count !== undefined && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: 'var(--text3)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 99,
            padding: '1px 7px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// Section heading — the live dashboard's SectionHeader, plus the optional hint
// and right-hand link this page's sections already used.
function SectionLabel({
  title, hint, action, onAction,
}: {
  title: string
  hint?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '32px 0 12px' }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text3)',
        }}
      >
        {title}
      </h2>
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{hint}</span>}
      {action && (
        <button
          onClick={onAction}
          style={{ ...LINK_BTN, marginLeft: 'auto' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)' }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

// Status dot — the live dashboard's calendar-legend dot.
function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  )
}

// Soft tinted badge — the live dashboard's StatusBadge / CurrentPhaseBadge shape.
function Pill({ tone, dot, children }: { tone: string; dot?: string; children: React.ReactNode }) {
  return (
    <span style={badgeStyle(tone)}>
      {dot && <Dot color={dot} size={6} />}
      {children}
    </span>
  )
}

// 4px progress bar — copied from the live dashboard's ProgressBar.
function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div style={{ height: 4, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
      <div style={{ height: 4, borderRadius: 99, width: `${pct}%`, background: color, transition: 'width 200ms ease' }} />
    </div>
  )
}

function PaceLegend({ note }: { note?: string }) {
  const item = (color: string, label: string) => (
    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Dot color={color} />
      {label}
    </span>
  )
  return (
    <div style={LEGEND}>
      {item(PACE_DOT.ok, 'Not started')}
      {item(PACE_DOT.go, 'In progress')}
      {item(PACE_DOT.risk, 'Behind pace')}
      {item(PACE_DOT.done, 'Target met')}
      {note && <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>{note}</span>}
    </div>
  )
}

// Caveat note. The live dashboard has no dedicated component for this, but it
// does have a caution language — the amber wash it puts behind the NPS
// "Current Month" row — so the flag is drawn in the same amber tokens.
function Flag({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 9,
        alignItems: 'flex-start',
        marginTop: 12,
        padding: '11px 14px',
        borderRadius: 12,
        background: 'var(--amber-bg)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--amber)',
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--text2)',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--amber)' }}>⚑</span>
      {/* `b` inside the note picks up the amber the same way the live dashboard's
          highlighted rows do. */}
      <div style={{ minWidth: 0 }} className="okr2-flagbody">{children}</div>
    </div>
  )
}

function Fold({
  title, meta, metaRight, children,
}: {
  title: string
  meta?: string
  metaRight?: string
  children: React.ReactNode
}) {
  // Mirrors the <details> open state purely so the ▸ can rotate; the element
  // still opens and closes itself.
  const [open, setOpen] = useState(false)
  return (
    <details
      className="okr2-fold"
      style={{ ...CARD, padding: 0, overflow: 'hidden' }}
      onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12.5,
          color: 'var(--text3)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 9,
            color: 'var(--text3)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        >
          ▶
        </span>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {meta && (
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
        )}
        {metaRight && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{metaRight}</span>}
      </summary>
      <div style={{ padding: '0 16px 16px' }}>{children}</div>
    </details>
  )
}

// ── Project card ───────────────────────────────────────────────────────────
// One group per OKR phase: [completed, total] steps, plus [completed, total] KPI
// tasks for that same phase.
interface ProjCardGroup {
  key: PhaseKey
  label: string
  steps: [number, number]
  tasks: [number, number]
}
interface ProjCard {
  id: string
  name: string
  pm: string
  type: string
  phase: 'Design' | 'Permit' | 'Contract' | 'Complete'
  steps: [number, number]
  groups: ProjCardGroup[]
}

// Same four phases the live dashboard's CurrentPhaseBadge covers, in its tones.
const PHASE_PILL: Record<ProjCard['phase'], { tone: string; dot: string; label: string }> = {
  Design: { tone: 'blue', dot: PACE_DOT.go, label: 'In design' },
  Permit: { tone: 'amber', dot: 'var(--amber)', label: 'In permit' },
  Contract: { tone: 'green', dot: PACE_DOT.done, label: 'In contract' },
  Complete: { tone: 'neutral', dot: 'var(--text3)', label: 'Complete' },
}

function ProjectCard({ p }: { p: ProjCard }) {
  const [sDone, sTotal] = p.steps
  const oPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0
  const pill = PHASE_PILL[p.phase]
  return (
    <div style={{ ...CARD, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <Link
          href={`/customers/${p.id}`}
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
        >
          {p.name}
        </Link>
        {/* PM chip — the live dashboard's NamePill */}
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
          {p.pm}
        </span>
        {p.type && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{p.type}</span>}
        <span style={{ marginLeft: 'auto' }}>
          <Pill tone={pill.tone} dot={pill.dot}>{pill.label}</Pill>
        </span>
      </div>

      {/* Overall journey — charcoal bar, exactly as on the live dashboard. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>
            Overall journey
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
            {sDone} of {sTotal} steps · {oPct}%
          </span>
        </div>
        <ProgressBar value={sDone} total={sTotal} color="var(--charcoal)" />
        <div style={{ borderBottom: '1px solid var(--border)', marginTop: 14 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {p.groups.map(g => {
          const [gSteps, gStepsTotal] = g.steps
          const [gTasks, gTasksTotal] = g.tasks
          const stepPct = gStepsTotal > 0 ? Math.round((gSteps / gStepsTotal) * 100) : 0
          const taskPct = gTasksTotal > 0 ? Math.round((gTasks / gTasksTotal) * 100) : 0
          return (
            <div key={g.key}>
              {/* Phase step progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{g.label}</span>
                <span style={{ color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                  {gSteps} of {gStepsTotal} · {stepPct}%
                </span>
              </div>
              <ProgressBar value={gSteps} total={gStepsTotal} color={PHASE_META[g.key].accent} />

              {/* KPI tasks for THIS phase, nested under it. Keeps the live
                  dashboard's fallback for a phase with no tasks defined. */}
              <div style={{ marginTop: 6 }}>
                {gTasksTotal === 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>No tasks recorded yet</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text3)' }}>KPI tasks</span>
                      <span style={{ color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                        {gTasks} of {gTasksTotal} · {taskPct}%
                      </span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: 3,
                          borderRadius: 99,
                          width: `${taskPct}%`,
                          background: PHASE_META[g.key].accent,
                          opacity: 0.6,
                          transition: 'width 200ms ease',
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Completions calendar (real data) ───────────────────────────────────────
function CompletionsCalendar({
  year, monthIdx, daysInMonth, todayDay, monthName, dots,
}: {
  year: number
  monthIdx: number
  daysInMonth: number
  todayDay: number
  monthName: string
  dots: Map<number, Map<PhaseKey, number>>
}) {
  const hasEntries = dots.size > 0
  // When there is nothing to plot the page shows a short empty state with an
  // opt-in to reveal the grid anyway. With entries, the grid shows immediately.
  const [shown, setShown] = useState(hasEntries)
  const firstWeekday = new Date(year, monthIdx, 1).getDay() // 0 = Sun
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      {!hasEntries && (
        <div style={{ ...CARD, textAlign: 'center', padding: 22 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text2)' }}>No completions logged in {monthName} yet</p>
          <small style={{ fontSize: 11.5, color: 'var(--text3)', display: 'block', marginTop: 4 }}>
            Design, permit and contract dates appear here as projects clear each stage.
          </small>
          <button
            onClick={() => setShown(s => !s)}
            style={{
              marginTop: 12,
              fontFamily: 'inherit',
              fontSize: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '6px 13px',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {shown ? 'Hide calendar' : 'Show the empty calendar anyway'}
          </button>
        </div>
      )}

      {shown && (
        <div style={{ ...CARD, marginTop: hasEntries ? 0 : 10 }}>
          {/* Weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {dows.map(d => (
              <div
                key={d}
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {Array.from({ length: firstWeekday }, (_, i) => <div key={`lead-${i}`} />)}
            {range(1, daysInMonth).map(d => {
              const day = dots.get(d)
              return (
                <div
                  key={d}
                  style={{
                    minHeight: 56,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '5px 7px',
                    background: d === todayDay ? 'var(--surface2)' : 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: d === todayDay ? 'var(--text)' : 'var(--text3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {d}
                  </span>
                  {day && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {PHASE_KEYS.filter(k => day.has(k)).map(k => {
                        const n = day.get(k) ?? 0
                        const multi = n > 1
                        return (
                          <span
                            key={k}
                            title={`${PHASE_META[k].label}${multi ? ` ×${n}` : ''}`}
                            style={{
                              width: multi ? 14 : 8,
                              height: multi ? 14 : 8,
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
                            {multi ? n : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend — same row the live dashboard puts above its calendar. */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            {PHASE_KEYS.map(k => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text2)' }}>
                <Dot color={PHASE_META[k].accent} />
                {PHASE_META[k].short}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE TRACKER SECTIONS — read from the Precon KPI Tracker via
// /api/okr-dashboard-v2/excel-data (Graph, read-only).
//
// Each one degrades to an em-dash shell when the read fails, so a Graph outage
// costs you the numbers, not the page.
// ═══════════════════════════════════════════════════════════════════════════

// Right-hand meta text on a fold summary.
function foldMeta(loading: boolean, hasData: boolean): string {
  if (loading) return 'reading tracker…'
  return hasData ? 'live from tracker' : 'tracker unavailable'
}

// Shown in place of a section's table when the tracker read failed.
function TrackerUnavailable({ what, detail, errors }: { what: string; detail: string; errors: string[] }) {
  return (
    <Flag>
      <b>{what} unavailable.</b> {detail} The dashboard could not read the tracker just now, so no figures are
      shown rather than stale ones.
      {errors.length > 0 && (
        <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--text3)' }}>
          {errors.slice(0, 3).join(' · ')}
        </span>
      )}
    </Flag>
  )
}

function SectionSkeleton() {
  return <div className="shimmer" style={{ height: 120, borderRadius: 12, border: '1px solid var(--border)' }} />
}

// ── Selections / Bid KPI card ──────────────────────────────────────────────
function TrackerCountCard({
  label, data, loading, monthShort,
}: {
  label: string
  data: CompPayload | null
  loading: boolean
  monthShort: string
}) {
  if (loading) {
    return (
      <div style={KPI_CARD}>
        <div style={KPI_LABEL}>{label}</div>
        <div style={KPI_VALUE_ROW}><span style={{ ...KPI_VALUE, color: 'var(--text3)' }}>·</span></div>
        <div style={KPI_FOOT}>Reading tracker…</div>
      </div>
    )
  }
  if (!data) {
    return (
      <div style={KPI_CARD}>
        <div style={KPI_LABEL}>{label}</div>
        <div style={KPI_VALUE_ROW}><span style={{ ...KPI_VALUE, color: 'var(--text3)' }}>—</span></div>
        <div style={KPI_FOOT}>Tracker unavailable</div>
      </div>
    )
  }
  // "This month" against the tracker's own completion dates. There is no target
  // for these two in the source, so no track bar and no pace marker.
  return (
    <div style={KPI_CARD}>
      <div style={KPI_LABEL}>{label}</div>
      <div style={KPI_VALUE_ROW}>
        <span style={{ ...KPI_VALUE, color: data.thisMonth === 0 ? 'var(--text3)' : 'var(--text)' }}>
          {data.thisMonth}
        </span>
        <span style={KPI_DELTA}>in {monthShort}</span>
      </div>
      <div style={KPI_FOOT}>{data.total} all time · from tracker</div>
    </div>
  )
}

// ── NPS history (year → quarter → month drill-down) ────────────────────────
function Spark({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1)
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14, verticalAlign: -2 }}
    >
      {counts.map((v, i) => (
        <i
          key={i}
          style={{
            display: 'block',
            width: 3,
            borderRadius: 1,
            background: 'var(--text3)',
            height: `${Math.max(1, (v / max) * 14)}px`,
            opacity: v ? 1 : 0.25,
          }}
        />
      ))}
    </span>
  )
}

// Twisty used by the NPS tree — a borderless button with a rotating ▸.
function Twisty({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-expanded={open}
      onClick={onClick}
      style={{
        background: 'none',
        border: 0,
        padding: 0,
        color: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 9,
          width: 9,
          color: 'var(--text3)',
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 150ms ease',
        }}
      >
        ▶
      </span>
      {children}
    </button>
  )
}

function NpsHistorySection({
  data, loading, errors,
}: {
  data: NpsPayload | null
  loading: boolean
  errors: string[]
}) {
  // Newest year open by default; everything else collapsed.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const firstYear = data?.years[0]?.year
  const isOpen = (id: string, dflt = false) => open[id] ?? dflt

  if (loading) return <SectionSkeleton />
  if (!data) {
    return (
      <TrackerUnavailable
        what="NPS history"
        detail="It reads the tracker's NewNPS table."
        errors={errors}
      />
    )
  }

  const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(1))

  return (
    <div>
      <div style={CARD_FLUSH}>
        <table style={{ ...TABLE, minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ ...TH_LEFT, minWidth: 190 }}>Period</th>
              <th style={TH_NUM}>Responses</th>
              <th style={TH_NUM}>Avg score</th>
              <th style={{ ...TH_NUM, minWidth: 80 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.years.length === 0 ? (
              <tr><td colSpan={4} style={TD_MUTED}>No dated responses in the tracker.</td></tr>
            ) : (
              data.years.map(y => {
                const yId = `y${y.year}`
                const yOpen = isOpen(yId, y.year === firstYear)
                return (
                  <Fragment key={yId}>
                    <tr style={TR_LINE}>
                      <td style={{ ...TD_LEFT, fontWeight: 600 }}>
                        <Twisty open={yOpen} onClick={() => setOpen(o => ({ ...o, [yId]: !yOpen }))}>
                          {y.year}
                        </Twisty>
                      </td>
                      <td style={TD_NUM}>{y.count}</td>
                      <td style={TD_NUM}>{fmt(y.avg)}</td>
                      <td style={TD_NUM}><Spark counts={y.spark} /></td>
                    </tr>
                    {yOpen && y.quarters.map(q => {
                      const qId = `${yId}-${q.label}`
                      const qOpen = isOpen(qId, true)
                      return (
                        <Fragment key={qId}>
                          <tr style={TR_LINE}>
                            <td style={{ ...TD_LEFT, paddingLeft: 34, color: 'var(--text2)' }}>
                              <Twisty open={qOpen} onClick={() => setOpen(o => ({ ...o, [qId]: !qOpen }))}>
                                {q.label}
                              </Twisty>
                            </td>
                            <td style={{ ...TD_NUM, color: q.count ? 'var(--text)' : 'var(--text3)' }}>{q.count}</td>
                            <td style={{ ...TD_NUM, color: q.avg !== null ? 'var(--text)' : 'var(--text3)' }}>{fmt(q.avg)}</td>
                            <td style={TD_NUM} />
                          </tr>
                          {qOpen && q.months.map(m => (
                            <tr style={TR_LINE} key={`${qId}-${m.label}`}>
                              <td style={{ ...TD_LEFT, paddingLeft: 56, paddingTop: 6, paddingBottom: 6, fontSize: 11.5, color: 'var(--text3)' }}>
                                {m.label}
                              </td>
                              <td style={{ ...TD_NUM, paddingTop: 6, paddingBottom: 6, fontSize: 11.5, color: m.count ? 'var(--text)' : 'var(--text3)' }}>
                                {m.count || '—'}
                              </td>
                              <td style={{ ...TD_NUM, paddingTop: 6, paddingBottom: 6, fontSize: 11.5, color: m.avg !== null ? 'var(--text)' : 'var(--text3)' }}>
                                {fmt(m.avg)}
                              </td>
                              <td style={TD_NUM} />
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={TFOOT_TD}>All time</td>
              <td style={{ ...TFOOT_TD, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{data.total}</td>
              <td style={{ ...TFOOT_TD, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmt(data.avgAll)}</td>
              <td style={TFOOT_TD} />
            </tr>
          </tfoot>
        </table>
        {data.byPm.length > 0 && (
          <div style={LEGEND}>
            {data.byPm.map(p => (
              <span key={p.pm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Dot color={PACE_DOT.go} size={6} />
                {p.pm} · {p.count} · avg {fmt(p.avg)}
              </span>
            ))}
          </div>
        )}
      </div>
      <Flag>
        <b>Live from the tracker.</b> Read from the <span style={MONO}>NewNPS</span> table, scored on
        &ldquo;how satisfied are you with your experience so far?&rdquo; (1&ndash;10) and bucketed by Date Submitted.
        {data.scored < data.total && ` ${data.total - data.scored} of ${data.total} responses carry no score and are counted but not averaged.`}
        {' '}The older <span style={MONO}>NPS</span> tab asks a different question (likelihood to refer) and is
        not merged in — the two are not the same metric.
      </Flag>
    </div>
  )
}

// ── PIT goals KPI (per person × stage) ─────────────────────────────────────
function PitGoalsSection({
  data, loading, errors,
}: {
  data: PitPayload | null
  loading: boolean
  errors: string[]
}) {
  if (loading) return <SectionSkeleton />
  if (!data) {
    return (
      <TrackerUnavailable
        what="PIT goals KPI"
        detail="It reads the tracker's PITprecon table."
        errors={errors}
      />
    )
  }

  return (
    <div>
      <div style={CARD_FLUSH}>
        <table style={{ ...TABLE, minWidth: 660 }}>
          <thead>
            {/* Same column shape as the current dashboard: Name + the five
                stages, on its dark header band. No Total column — the funnel
                makes the first stage column equal to the person's item count. */}
            <tr style={{ background: '#1a1917' }}>
              <th style={{ ...TH_LEFT, minWidth: 150, color: '#fff', borderBottom: 'none', fontSize: 10.5, letterSpacing: '0.06em' }}>
                Name
              </th>
              {data.stages.map(s => (
                <th
                  key={s}
                  style={{ ...TH_NUM, color: '#fff', borderBottom: 'none', fontSize: 10.5, letterSpacing: '0.06em' }}
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.people.length === 0 ? (
              <tr><td colSpan={data.stages.length + 1} style={TD_MUTED}>No PIT items in the tracker.</td></tr>
            ) : (
              data.people.map(p => (
                <tr key={p.name} style={TR_LINE}>
                  <td style={TD_LEFT}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    {p.email && <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{p.email}</div>}
                  </td>
                  {p.counts.map((c, i) => (
                    <td style={{ ...TD_NUM, color: c ? 'var(--text)' : 'var(--text3)' }} key={i}>{c}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={TFOOT_TD}>Actual</td>
              {data.totals.map((t, i) => (
                <td style={{ ...TFOOT_TD, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} key={i}>{t}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <Flag>
        <b>Live from the tracker.</b> Read from the <span style={MONO}>PITprecon</span> table, where{' '}
        <span style={MONO}>Status</span> records the furthest stage an item has reached. The columns are therefore
        a <b>cumulative funnel</b>: an item at &ldquo;SOP Created&rdquo; is counted under every earlier stage too, so
        each column reads &ldquo;how many have got at least this far&rdquo; and the numbers step down left to right.
        <span style={{ display: 'block', marginTop: 6 }}>
          This also settles the old ambiguity: the two columns that both read &ldquo;Department Team&rdquo; on the
          current dashboard are <b>Review</b> and <b>Approval</b> — not &ldquo;trained / certified&rdquo;, which the
          redesign mockup had guessed. Running this funnel against the live table reproduces the current
          dashboard&apos;s hand-maintained figures exactly for Kelly, Matteo and Tim; Chad reads one higher because
          he has logged an item since those numbers were typed in.
        </span>
        {data.notes.length > 0 && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
            {data.notes.join(' · ')}
          </span>
        )}
      </Flag>
    </div>
  )
}

// ── Selections / Bid — Completed | Ongoing ─────────────────────────────────
// One card, two datasets. Completed is the view on load; Ongoing is only offered
// when its table actually came back, so a failed SelectionsOng read costs the
// toggle rather than leaving a tab that opens onto nothing.
//
// Each list previews PREVIEW_ROWS and expands from there — the same interaction
// as Big Vision's "Load N more". Expansion is tracked per view, so opening the
// whole Completed list does not silently open the Ongoing one behind it.
const PREVIEW_ROWS = 12

type CompView = 'completed' | 'ongoing'

// The two datasets differ in exactly one column — a completion date vs a start
// date — so they are normalised to one shape and rendered through one table
// instead of two near-identical copies of the same markup drifting apart.
interface DisplayRow {
  customer: string
  pm: string
  projectType: string
  date: string | null
  days: number | null
}

function CompletionsSection({
  what, data, ongoing, loading, errors, monthLabel, fallbackDetail,
}: {
  what: string
  data: CompPayload | null
  ongoing: OngPayload | null
  loading: boolean
  errors: string[]
  monthLabel: string
  fallbackDetail: string
}) {
  // Hooks before the early returns below — those are conditional, hook calls
  // cannot be.
  const [view, setView] = useState<CompView>('completed')
  const [expanded, setExpanded] = useState<Record<CompView, boolean>>({
    completed: false,
    ongoing: false,
  })

  if (loading) return <SectionSkeleton />
  if (!data) {
    return <TrackerUnavailable what={`${what} completed`} detail={fallbackDetail} errors={errors} />
  }

  const tableName = what === 'Bid' ? 'BidComp' : 'SelectionsComp'
  const ongTableName = what === 'Bid' ? 'BidOng' : 'SelectionsOng'

  // Narrowing through a local keeps the rest of the component free of non-null
  // assertions: `activeOng` is non-null exactly when the Ongoing view is live.
  const activeOng = view === 'ongoing' ? ongoing : null
  const isOngoing = activeOng !== null

  const rows: DisplayRow[] = activeOng
    ? activeOng.rows.map(r => ({
        customer: r.customer,
        pm: r.pm,
        projectType: r.projectType,
        date: r.started,
        days: r.days,
      }))
    : data.rows.map(r => ({
        customer: r.customer,
        pm: r.pm,
        projectType: r.projectType,
        date: r.date,
        days: r.days,
      }))

  const source = activeOng ?? data
  const dateHeader = activeOng ? (activeOng.startColumn ?? 'Started') : data.dateColumn
  const isExpanded = expanded[isOngoing ? 'ongoing' : 'completed']
  const visible = isExpanded ? rows : rows.slice(0, PREVIEW_ROWS)
  // Rows are sorted longest-first, so the first usable figure is the maximum.
  const longestOngoing = activeOng?.rows.find(r => r.days !== null)?.days ?? null
  const toggleExpanded = () =>
    setExpanded(e => ({ ...e, [isOngoing ? 'ongoing' : 'completed']: !isExpanded }))

  return (
    <div>
      <div style={CARD_FLUSH}>
        {ongoing && (
          <div
            role="group"
            aria-label={`${what} — completed or ongoing`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {/* Segmented control, drawn in the live dashboard's pill vocabulary:
                a --surface2 trough with the active segment lifted onto --surface. */}
            <div
              style={{
                display: 'inline-flex',
                gap: 2,
                padding: 2,
                borderRadius: 99,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              {([['completed', 'Completed'], ['ongoing', 'Ongoing']] as [CompView, string][]).map(([id, label]) => {
                const on = (id === 'ongoing') === isOngoing
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setView(id)}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: 11.5,
                      fontWeight: on ? 700 : 600,
                      padding: '4px 13px',
                      borderRadius: 99,
                      cursor: 'pointer',
                      background: on ? 'var(--surface)' : 'transparent',
                      border: `1px solid ${on ? 'var(--border)' : 'transparent'}`,
                      color: on ? 'var(--text)' : 'var(--text3)',
                      transition: 'color 150ms ease, background 150ms ease',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
              {isOngoing
                ? `${ongoing.total} still in ${what.toLowerCase()} · ${ongTableName}`
                : `${data.total} completed all time · ${tableName}`}
            </span>
          </div>
        )}
        <table style={{ ...TABLE, minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ ...TH_LEFT, minWidth: 170 }}>Customer</th>
              <th style={TH_LEFT}>PM</th>
              <th style={TH_LEFT}>Type</th>
              <th style={TH_NUM}>{dateHeader}</th>
              <th style={TH_NUM}>Days</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} style={TD_MUTED}>
                  No {isOngoing ? 'ongoing' : 'completed'} rows in the tracker.
                </td>
              </tr>
            ) : (
              visible.map((r, i) => (
                <tr key={`${isOngoing ? 'ong' : 'comp'}-${r.customer}-${i}`} style={TR_LINE}>
                  <td style={{ ...TD_LEFT, fontWeight: 600 }}>{r.customer || '—'}</td>
                  <td style={TD_MUTED}>{r.pm || '—'}</td>
                  <td style={TD_MUTED}>{r.projectType || '—'}</td>
                  <td style={{ ...TD_NUM, color: r.date ? 'var(--text)' : 'var(--text3)' }}>{r.date ?? '—'}</td>
                  <td style={{ ...TD_NUM, color: r.days !== null ? 'var(--text)' : 'var(--text3)' }}>{r.days ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={TFOOT_TD}>
                {isOngoing ? `${source.total} in progress` : `${source.total} completed all time`}
              </td>
              <td colSpan={2} style={{ ...TFOOT_TD, fontWeight: 400, color: 'var(--text3)' }}>
                {source.byPm.map(p => `${p.pm} ${p.count}`).join(' · ')}
              </td>
              <td style={{ ...TFOOT_TD, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {isOngoing
                  ? (longestOngoing !== null ? `${longestOngoing}d longest` : '—')
                  : `${data.thisMonth} in ${monthLabel.split(' ')[0]}`}
              </td>
              <td style={TFOOT_TD} />
            </tr>
          </tfoot>
        </table>
        {(rows.length > PREVIEW_ROWS || source.truncated > 0 || !ongoing) && (
          <div style={LEGEND}>
            {rows.length > PREVIEW_ROWS && (
              <span>
                {isExpanded
                  ? `All ${rows.length} rows — ${isOngoing ? 'longest-running first' : 'newest first'}`
                  : `Showing ${visible.length} of ${rows.length} — ${isOngoing ? 'longest-running first' : 'newest first'}`}
              </span>
            )}
            {source.truncated > 0 && (
              <span>
                {source.truncated} further row{source.truncated === 1 ? '' : 's'} exist in the tracker but are
                past the read endpoint&apos;s row ceiling and were not loaded
              </span>
            )}
            {!ongoing && (
              <span>
                Ongoing view unavailable — <span style={MONO}>{ongTableName}</span> did not come back on this read
              </span>
            )}
            {rows.length > PREVIEW_ROWS && (
              <button
                type="button"
                onClick={toggleExpanded}
                style={{ ...LINK_BTN, marginLeft: 'auto', fontSize: 11 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)' }}
              >
                {isExpanded ? 'Show less' : `View all ${rows.length} →`}
              </button>
            )}
          </div>
        )}
      </div>
      {isOngoing && activeOng ? (
        <Flag>
          <b>Live from the tracker.</b> Read from the <span style={MONO}>{ongTableName}</span> table — rows still
          in {what.toLowerCase()}, not yet completed. These rows have no completion date, so the date column is
          {' '}<span style={MONO}>{activeOng.startColumn ?? 'unavailable'}</span> (the start), and
          {' '}<span style={MONO}>#&nbsp;Days</span> is the sheet&apos;s own elapsed-days figure as of its last
          calculation — days so far, not a finished duration, and it lags if the workbook has not recalculated
          recently.
          {activeOng.dated < activeOng.total && ` ${activeOng.total - activeOng.dated} row(s) have no readable start date.`}
          {activeOng.notes.length > 0 && (
            <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
              {activeOng.notes.join(' · ')}
            </span>
          )}
          {activeOng.anomalies > 0 && (
            <span style={{ display: 'block', marginTop: 6 }}>
              <b>{activeOng.anomalies} row{activeOng.anomalies === 1 ? '' : 's'} carry an unusable day count</b>
              {' '}— negative, or longer than ten years, which is the sheet&apos;s formula emitting a raw date serial
              instead of a day count. Those show <span style={MONO}>—</span> rather than a wrong number and sort
              to the end of the list. This is the same source defect the completed side reports; with no second date
              on an ongoing row there is nothing else to cross-check, so this is the whole of the ongoing count.
            </span>
          )}
        </Flag>
      ) : (
        <Flag>
          <b>Live from the tracker.</b> Read from the <span style={MONO}>{tableName}</span> table. That table has
          no &ldquo;date completed&rdquo; column, so <span style={MONO}>{data.dateColumn}</span> is used as the
          completion date — it is the column whose difference from <span style={MONO}>Date Permit Routed</span>
          {' '}matches the sheet&apos;s own <span style={MONO}>#&nbsp;Days</span> figure.
          {data.dated < data.total && ` ${data.total - data.dated} row(s) have no readable date and are excluded from the monthly count.`}
          {data.anomalies > 0 && (
            <span style={{ display: 'block', marginTop: 6 }}>
              <b>{data.anomalies} row{data.anomalies === 1 ? '' : 's'} disagree with {data.dateColumn === 'Date Contract Signed' ? 'their own' : 'the'} day count</b>
              {' '}— the two dates and <span style={MONO}>#&nbsp;Days</span> do not reconcile, or the day count
              itself is unusable, so at least one of the three is wrong at source. Worth a look before reporting off
              these dates.
            </span>
          )}
        </Flag>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Floating CASK Intelligence — POSTs to /api/chat/client and persists to
// chat_history scoped by user_email + page_context, behind the CASK-red FAB,
// the charcoal drawer header and the red speaker labels.
//
// page_context is '/customers/okr-dashboard' — this page's own route — so the
// team keeps reading and writing the thread it has always had here. (While it
// was a preview it wrote to a separate '/customers/okr-dashboard-v2' thread;
// anything said there still sits in chat_history under that key and simply no
// longer surfaces on this page.)
// ═══════════════════════════════════════════════════════════════════════════
const OKR2_PAGE_CONTEXT = '/customers/okr-dashboard'
const OKR2_AI_ACCENT = '#c8311a' // CASK red — the live dashboard's panel accent
const OKR2_AI_D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: OKR2_AI_ACCENT,
}
const OKR2_AI_GREETING =
  "CASK Intelligence online. I have live context on every active client's OKR status — Design, Permit and Contract progress, PM assignments and this month's targets — plus live figures from the Precon KPI Tracker for NPS, PIT goals, and Selections/Bid completions. Ask who's behind, how NPS is trending, or where a PIT item sits."
const OKR2_QUICK_PROMPTS = [
  'Why has nothing moved past design this month?',
  'Which PM is closest to hitting target?',
  'Who is furthest behind?',
]

interface OKR2Msg {
  role: 'user' | 'assistant'
  content: string
}

function FloatingOKRAI({ aiContext }: { aiContext: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<OKR2Msg[]>([{ role: 'assistant', content: OKR2_AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

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
        .eq('page_context', OKR2_PAGE_CONTEXT)
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) setMessages(history as OKR2Msg[])
    }
    loadHistory()
  }, [])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: OKR2_PAGE_CONTEXT, role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', OKR2_PAGE_CONTEXT)
    setMessages([{ role: 'assistant', content: OKR2_AI_GREETING }])
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: OKR2Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: aiContext,
          messages: next.map(m => ({ role: m.role, content: m.content })),
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
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        aria-expanded={open}
        aria-controls="okr2-aipanel"
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
          background: 'var(--fable-red)',
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
        CASK Intelligence
      </button>

      {/* Chat drawer — slides up from bottom-right */}
      {open && (
        <div
          id="okr2-aipanel"
          role="dialog"
          aria-label="CASK Intelligence"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 61,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            height: 500,
            maxHeight: 'calc(100vh - 48px)',
            background: OKR2_AI_D.bg,
            color: OKR2_AI_D.text,
            border: `1px solid ${OKR2_AI_D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'okrAISlideUp 220ms ease',
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
                  background: OKR2_AI_D.accent,
                  boxShadow: `0 0 8px ${OKR2_AI_D.accent}`,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1.6px', textTransform: 'uppercase', color: '#fff' }}>
                CASK Intelligence
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={clearHistory}
                title="Clear chat history"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  padding: '5px 9px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.85)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                aria-label="Close"
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
                  borderBottom: i < messages.length - 1 ? `1px solid ${OKR2_AI_D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? OKR2_AI_D.text3 : OKR2_AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'CASK Intelligence'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? OKR2_AI_D.text2 : OKR2_AI_D.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <ArtifactContent content={m.content} />
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
                    color: OKR2_AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  CASK Intelligence
                </div>
                <div style={{ fontSize: 12.5, color: OKR2_AI_D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px', flexShrink: 0 }}>
              {OKR2_QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: OKR2_AI_D.surface,
                    border: `1px solid ${OKR2_AI_D.border}`,
                    color: OKR2_AI_D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${OKR2_AI_D.accent}66`
                    e.currentTarget.style.color = OKR2_AI_D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = OKR2_AI_D.border
                    e.currentTarget.style.color = OKR2_AI_D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${OKR2_AI_D.border}`, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${OKR2_AI_D.border}`,
                background: OKR2_AI_D.surface,
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about OKR status, PMs, targets..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: OKR2_AI_D.text,
                  fontFamily: 'inherit',
                  maxHeight: 96,
                  overflowY: 'auto',
                  border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || thinking}
                title="Send"
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: input.trim() && !thinking ? OKR2_AI_D.accent : OKR2_AI_D.surface,
                  color: input.trim() && !thinking ? '#fff' : OKR2_AI_D.text3,
                  border: 'none',
                  cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms ease',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1L11 6L6 11M11 6H1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
