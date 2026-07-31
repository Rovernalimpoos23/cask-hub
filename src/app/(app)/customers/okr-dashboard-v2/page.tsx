'use client'
// src/app/(app)/customers/okr-dashboard-v2/page.tsx
//
// Pre-Con OKR Dashboard — REDESIGN, Phase 1 (visual structure only).
//
// This is a NEW route built alongside the live dashboard at
// /customers/okr-dashboard. That page is untouched and still serves production;
// nothing here modifies it. When this replaces it, the old route can be retired
// in a separate, deliberate change.
//
// Visual design is a port of the mockup at
//   C:\Users\comte\Downloads\precon-okr-redesign.html
// The mockup's own CSS custom properties (--s0..--s4, --tx, --bd, --green, …)
// collide with globals.css, so — exactly like `.bv-root` on the Big Vision page —
// every selector below is scoped under `.okr2-root` and the variables are
// redefined on that element. Nothing leaks to the rest of the Hub.
//
// ── What is REAL data on this page (same Supabase queries + calculations as the
//    live dashboard, restyled only) ───────────────────────────────────────────
//   • Top stat cards — Design / Permit / Contract completed this month, Avg design days
//   • Per PM breakdown — Target / Obtain / Gap per stage per PM
//   • Active Projects — Overall Journey, phase bars, KPI tasks per client
//   • Completions Calendar
//
// ── What is PLACEHOLDER, real data lands in Phase 2 ─────────────────────────
//   • Quarterly Targets       • PIT Goals KPI        • NPS History
//   • Selections Completed    • Bid Completed
//   These render the mockup's real component shells with em-dashes and a `.flag`
//   note. Deliberately NOT carried over: the hardcoded Excel numbers that the
//   live dashboard still shows for these sections. Shipping stale figures under a
//   new design would read as "connected" when it is not.
//
// Explicitly excluded per spec: Weekly Goal notes, MI5 daily task checklists.
//
// NO Microsoft Graph / SharePoint / Excel calls in this phase. NO Supabase
// schema or write logic is touched — the four reads below are the same reads the
// live dashboard already performs.

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { WORKFLOW_STEPS } from '@/lib/workflow-steps'
import { ArtifactContent } from '@/components/ai-panel/artifacts'
import { useTheme } from '@/lib/theme-context'

// ═══════════════════════════════════════════════════════════════════════════
// Scoped stylesheet — port of the mockup's <style>, minus its sidebar/topbar
// (the Hub shell already provides both).
//
// Space Grotesk and IBM Plex Mono are not in the project, so they come from
// Google the same way the Big Vision page pulls its CDN fonts. Inter and
// Fraunces ARE self-hosted by next/font in src/app/layout.tsx, so they are
// referenced via --font-inter / --font-fraunces rather than re-fetched.
// ═══════════════════════════════════════════════════════════════════════════
const OKR2_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap");
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap");

.okr2-root{
  --s0:#0d0f11; --s1:#15181b; --s2:#1d2125; --s3:#262b30; --s4:#31373d;
  --tx:#e9ebed; --tx2:#a0a8b0; --tx3:#6e767e;
  --bd:rgba(255,255,255,.08); --bd2:rgba(255,255,255,.14); --bd3:rgba(255,255,255,.22);
  --slate:#7f8d9c; --blue:#5b8cba; --teal:#4f9d8b; --ochre:#b8934f; --green:#709b5d;
  --slate-bg:rgba(127,141,156,.14); --blue-bg:rgba(91,140,186,.14); --teal-bg:rgba(79,157,139,.14);
  --ochre-bg:rgba(184,147,79,.14); --green-bg:rgba(112,155,93,.14);
  --risk:#c1655f; --risk-bg:rgba(193,101,95,.14);
  --r:8px; --rc:12px;
  --fd:'Space Grotesk',system-ui,sans-serif;
  --fb:var(--font-inter),system-ui,sans-serif;
  --fm:'IBM Plex Mono',ui-monospace,monospace;
  --fs:var(--font-fraunces),Georgia,serif;
  background:var(--s0);
  color:var(--tx);
  font-family:var(--fb);
  font-size:14px;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.okr2-root[data-theme="light"]{
  --s0:#f4f5f6; --s1:#ffffff; --s2:#fafbfb; --s3:#f0f1f2; --s4:#e6e8ea;
  --tx:#1a1d20; --tx2:#5b646d; --tx3:#8a939c;
  --bd:rgba(0,0,0,.09); --bd2:rgba(0,0,0,.15); --bd3:rgba(0,0,0,.24);
  --slate:#5e6b78; --blue:#3d6f9e; --teal:#2f7d6b; --ochre:#8f6f2f; --green:#4f7a3d;
  --slate-bg:rgba(94,107,120,.10); --blue-bg:rgba(61,111,158,.10); --teal-bg:rgba(47,125,107,.10);
  --ochre-bg:rgba(143,111,47,.10); --green-bg:rgba(79,122,61,.10);
  --risk:#a8443e; --risk-bg:rgba(168,68,62,.10);
}
.okr2-root *{box-sizing:border-box;margin:0;padding:0}
.okr2-root .mono{font-family:var(--fm);font-variant-numeric:tabular-nums}
.okr2-root :focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:4px}
@media (prefers-reduced-motion:reduce){.okr2-root *{transition:none!important;animation:none!important}}

.okr2-root .page{padding:24px 28px 96px;max-width:1220px}
.okr2-root h1{font-family:var(--fs);font-size:27px;font-weight:400;letter-spacing:-.01em}
.okr2-root .lede{font-size:13px;color:var(--tx2);margin-top:5px}
.okr2-root .lede b{color:var(--tx);font-weight:500}

/* ---------- tabs ---------- */
.okr2-root .tabs{display:flex;gap:2px;border-bottom:.5px solid var(--bd);margin:20px 0 22px}
.okr2-root .tab{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:9px 14px;font-family:var(--fd);font-size:13px;font-weight:500;color:var(--tx3);cursor:pointer;display:flex;align-items:center;gap:7px;transition:color .12s}
.okr2-root .tab:hover{color:var(--tx2)}
.okr2-root .tab[aria-selected="true"]{color:var(--tx);border-bottom-color:var(--tx)}
.okr2-root .tab .cnt{font-family:var(--fm);font-size:10.5px;color:var(--tx3);background:var(--s2);border-radius:9px;padding:1px 6px}
.okr2-root .panel[hidden]{display:none}

/* ---------- section labels ---------- */
.okr2-root .slab{display:flex;align-items:baseline;gap:9px;margin:30px 0 10px}
.okr2-root .slab h2{font-family:var(--fd);font-size:13px;font-weight:500;letter-spacing:.01em}
.okr2-root .slab .hint{font-size:11.5px;color:var(--tx3)}
.okr2-root .slab .more{margin-left:auto;font-size:11.5px;color:var(--tx3);background:none;border:0;cursor:pointer;font-family:inherit}
.okr2-root .slab .more:hover{color:var(--tx2)}

/* ---------- metric cards ---------- */
.okr2-root .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:10px}
.okr2-root .kpi{background:var(--s1);border-radius:var(--rc);padding:14px 15px}
.okr2-root .kpi .k{font-size:11px;color:var(--tx3);letter-spacing:.02em}
.okr2-root .kpi .v{font-family:var(--fm);font-size:26px;font-weight:500;margin-top:8px;line-height:1}
.okr2-root .kpi .v small{font-size:12px;color:var(--tx3);font-weight:400}
.okr2-root .kpi .foot{font-size:11px;color:var(--tx3);margin-top:9px}
.okr2-root .track{height:4px;border-radius:2px;background:var(--bd);margin-top:11px;overflow:hidden;position:relative}
.okr2-root .track i{display:block;height:4px;border-radius:2px;background:var(--blue);min-width:3px}
.okr2-root .track .pace{position:absolute;top:-2px;width:1px;height:8px;background:var(--tx3)}
.okr2-root .empty-v{color:var(--tx3)}

/* ---------- pace banner ---------- */
.okr2-root .pacebar{display:flex;align-items:center;gap:11px;background:var(--s1);padding:11px 15px;margin-top:12px;font-size:12.5px;color:var(--tx2);border-left:2px solid var(--slate);border-radius:0 var(--rc) var(--rc) 0}
.okr2-root .pacebar.warn{border-left-color:var(--risk)}
.okr2-root .pacebar b{color:var(--tx);font-weight:500}

/* ---------- tables ---------- */
.okr2-root .tbox{background:var(--s1);border-radius:var(--rc);overflow:hidden}
.okr2-root .tscroll{overflow-x:auto}
.okr2-root table{width:100%;border-collapse:collapse;font-size:12.5px}
.okr2-root th,.okr2-root td{text-align:left;padding:9px 12px;white-space:nowrap}
.okr2-root thead th{font-size:10.5px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;color:var(--tx3)}
.okr2-root tbody tr{border-top:.5px solid var(--bd)}
.okr2-root tbody tr:hover{background:var(--s2)}
.okr2-root th.grp,.okr2-root td.grp{background:var(--s2)}
.okr2-root .ghead{text-align:center;font-family:var(--fd);font-size:11px;font-weight:500;letter-spacing:.02em;text-transform:none;padding-top:9px;padding-bottom:7px}
.okr2-root .num{text-align:right;font-family:var(--fm)}
.okr2-root .ctr{text-align:center}
.okr2-root .nm{font-weight:500;color:var(--tx)}
.okr2-root .sub{font-size:10.5px;color:var(--tx3);font-weight:400}
.okr2-root tfoot td{border-top:.5px solid var(--bd2);background:var(--s2);font-weight:500}
.okr2-root .dim{color:var(--tx3)}

/* ---------- status ---------- */
.okr2-root .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--tx3)}
.okr2-root .dot.go{background:var(--blue)}
.okr2-root .dot.done{background:var(--green)}
.okr2-root .dot.risk{background:var(--risk)}
.okr2-root .pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;padding:2px 9px;border-radius:11px;background:var(--slate-bg);color:var(--slate);white-space:nowrap}
.okr2-root .pill.blue{background:var(--blue-bg);color:var(--blue)}
.okr2-root .pill.teal{background:var(--teal-bg);color:var(--teal)}
.okr2-root .pill.ochre{background:var(--ochre-bg);color:var(--ochre)}
.okr2-root .pill.green{background:var(--green-bg);color:var(--green)}
.okr2-root .pill.risk{background:var(--risk-bg);color:var(--risk)}
.okr2-root .legend{display:flex;gap:16px;flex-wrap:wrap;padding:9px 12px;border-top:.5px solid var(--bd);font-size:11px;color:var(--tx3);align-items:center}
.okr2-root .legend span{display:flex;align-items:center;gap:6px}

/* ---------- project cards ---------- */
.okr2-root .pcard{background:var(--s1);border-radius:var(--rc);padding:14px 16px;margin-bottom:9px}
.okr2-root .phead{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px}
.okr2-root .phead .who2{font-family:var(--fd);font-size:14px;font-weight:500;color:var(--tx);text-decoration:none}
.okr2-root .phead a.who2:hover{text-decoration:underline}
.okr2-root .chip{font-size:10.5px;color:var(--tx2);background:var(--s3);padding:2px 8px;border-radius:var(--r)}
.okr2-root .ptype{font-size:11.5px;color:var(--tx3)}
.okr2-root .prow{display:grid;grid-template-columns:104px 1fr 62px;gap:11px;align-items:center;padding:3.5px 0}
.okr2-root .prow .pl{font-size:11.5px;color:var(--tx2)}
.okr2-root .prow .pl.off{color:var(--tx3)}
.okr2-root .prow .pv{font-family:var(--fm);font-size:11px;color:var(--tx2);text-align:right}
.okr2-root .prow .pv.off{color:var(--tx3)}
/* KPI-tasks sub-row, nested under its phase row. Subordinate by indent, size and
   weight only — no new colour, so the card keeps v2's existing design language. */
.okr2-root .prow.kpirow{padding:0 0 6px}
.okr2-root .prow.kpirow .pl{padding-left:11px;font-size:10.5px;color:var(--tx3);letter-spacing:.02em}
.okr2-root .prow.kpirow .pv{font-size:10.5px;color:var(--tx3)}
.okr2-root .prow.kpirow .track{height:3px}
.okr2-root .prow.kpirow .track i{height:3px;opacity:.6}
.okr2-root .prow.kpirow .none{font-size:10.5px;color:var(--tx3);font-style:italic;grid-column:2 / span 2}
.okr2-root .overall{display:flex;align-items:center;gap:11px;padding-bottom:11px;margin-bottom:9px;border-bottom:.5px solid var(--bd)}
.okr2-root .overall .ol{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3);flex:0 0 104px}
.okr2-root .overall .pv{font-family:var(--fm);font-size:11px;color:var(--tx2);text-align:right;flex:0 0 62px}

/* ---------- collapsibles ---------- */
.okr2-root .fold{background:var(--s1);border-radius:var(--rc);margin-bottom:7px;overflow:hidden}
.okr2-root .fold>summary{list-style:none;cursor:pointer;padding:12px 15px;display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--tx2)}
.okr2-root .fold>summary::-webkit-details-marker{display:none}
.okr2-root .fold>summary:hover{background:var(--s2);color:var(--tx)}
.okr2-root .fold>summary .cv{transition:transform .15s;color:var(--tx3);font-size:10px}
.okr2-root .fold[open]>summary .cv{transform:rotate(90deg)}
.okr2-root .fold>summary .ft{font-family:var(--fd);font-weight:500;color:var(--tx)}
.okr2-root .fold>summary .fm{margin-left:auto;font-size:11px;color:var(--tx3)}
.okr2-root .foldbody{padding:0 15px 15px}

/* ---------- calendar ---------- */
.okr2-root .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--bd);border-radius:var(--rc);overflow:hidden}
.okr2-root .cal .dow{background:var(--s2);padding:6px;text-align:center;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--tx3)}
.okr2-root .cal .cell{background:var(--s1);min-height:52px;padding:5px 7px;font-family:var(--fm);font-size:10.5px;color:var(--tx3);display:flex;flex-direction:column;gap:4px}
.okr2-root .cal .cell.pad{background:var(--s0)}
.okr2-root .cal .cell.today{background:var(--s2);color:var(--tx)}
.okr2-root .cal .cdots{display:flex;gap:3px;flex-wrap:wrap}
.okr2-root .cal .cdot{width:8px;height:8px;border-radius:50%;display:grid;place-items:center;font-size:7px;font-weight:600;line-height:1;color:#fff}
.okr2-root .cal .cdot.multi{width:14px;height:14px;font-size:8px}
.okr2-root .calempty{background:var(--s1);border-radius:var(--rc);padding:22px;text-align:center}
.okr2-root .calempty p{font-size:12.5px;color:var(--tx2)}
.okr2-root .calempty small{font-size:11.5px;color:var(--tx3);display:block;margin-top:4px}
.okr2-root .calempty button{margin-top:12px;font-family:inherit;font-size:12px;background:var(--s3);border:.5px solid var(--bd2);color:var(--tx);border-radius:var(--r);padding:6px 13px;cursor:pointer}
.okr2-root .calempty button:hover{background:var(--s4)}

/* ---------- flag note ---------- */
.okr2-root .flag{display:flex;gap:9px;align-items:flex-start;background:var(--ochre-bg);border-left:2px solid var(--ochre);padding:10px 14px;margin-top:10px;font-size:12px;color:var(--tx2);border-radius:0 var(--r) var(--r) 0}
.okr2-root .flag b{color:var(--ochre);font-weight:500}

/* ---------- loading ---------- */
.okr2-root .skel{background:var(--s1);border-radius:var(--rc);height:90px}

/* ---------- FAB / AI panel ---------- */
.okr2-root .fab{position:fixed;bottom:22px;right:22px;z-index:60;display:flex;align-items:center;gap:8px;background:var(--s2);border:.5px solid var(--bd2);color:var(--tx);border-radius:22px;padding:10px 17px;font-family:var(--fd);font-size:12.5px;font-weight:500;cursor:pointer;box-shadow:0 1px 0 var(--bd) inset}
.okr2-root .fab:hover{background:var(--s3);border-color:var(--bd3)}
.okr2-root .fab .sp{color:var(--ochre);font-size:13px}

@media (max-width:900px){
  .okr2-root .page{padding:18px 16px 96px}
  .okr2-root .prow{grid-template-columns:88px 1fr 56px}
}
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
  design:   { label: 'Design completed',  short: 'Design',   accent: 'var(--blue)',  steps: range(6, 13),  startStep: 6,  finalStep: 13 },
  permit:   { label: 'Permit received',   short: 'Permit',   accent: 'var(--ochre)', steps: range(14, 15), startStep: 14, finalStep: 15 },
  contract: { label: 'Contract executed', short: 'Contract', accent: 'var(--green)', steps: range(16, 21), startStep: 16, finalStep: 21 },
}

const MONTHLY_TARGET_PER_PM = 3 // each OKR: 3 per PM per month
const TOTAL_JOURNEY_STEPS = 33  // denominator for the overall journey row

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
  design: getFixedTaskTotal(6, 13),
  permit: getFixedTaskTotal(14, 15),
  contract: getFixedTaskTotal(16, 21),
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
const PACE_DOT: Record<PaceState, string> = { done: 'done', go: 'go', ok: '', risk: 'risk' }
const PACE_PILL: Record<PaceState, string> = { done: 'green', go: 'blue', ok: '', risk: 'risk' }

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
  const { theme } = useTheme()

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

NOT YET CONNECTED (do not answer questions about these — say the data is not wired up yet):
Quarterly Targets, PIT Goals KPI, NPS History, Selections Completed, Bid Completed.

Answer questions about client OKR status, PM assignments and monthly targets. Be specific and ground every answer in the data above — never invent clients or numbers not present here.`

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <>
      <TopBar title="Pre-Con OKR Dashboard" subtitle={`${monthLabel} · redesign preview`}>
        {/* "Viewing as of" scrubber. Lives in the Hub top bar rather than inside
            the scoped root, so it is styled with the Hub's own tokens. */}
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
              style={{ width: 96, accentColor: '#5b8cba' }}
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

      {/* `.okr2-root` carries the scoped tokens. `animate-page-in` goes on the
          inner div only — its transform would otherwise become the containing
          block for the position:fixed FAB. */}
      <div className="okr2-root flex-1 overflow-y-auto" data-theme={theme}>
        <style dangerouslySetInnerHTML={{ __html: OKR2_CSS }} />

        <div className="page animate-page-in">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => <div key={i} className="skel shimmer" />)}
            </div>
          ) : (
            <>
              <h1>Pre-con OKR dashboard</h1>
              <p className="lede">
                Design, permit and contract across{' '}
                <b>{computed.length} active client{computed.length === 1 ? '' : 's'}</b> and {numPMs} PM
                {numPMs === 1 ? '' : 's'}.{' '}
                {/* The mockup said "Synced from the Excel tracker · 6 min ago". There is
                    no Excel connection on this page yet, so the source is stated honestly
                    instead — the same mistake the Precon Pipeline badge already makes. */}
                <span className="dim">Live from workflow records · Excel tracker sync not connected yet</span>
              </p>

              <div className="tabs" role="tablist" aria-label="Dashboard views">
                <TabBtn id="over" cur={tab} set={setTab}>Overview</TabBtn>
                <TabBtn id="pm" cur={tab} set={setTab} count={numPMs}>Per PM</TabBtn>
                <TabBtn id="proj" cur={tab} set={setTab} count={computed.length}>Projects</TabBtn>
                <TabBtn id="hist" cur={tab} set={setTab}>History</TabBtn>
              </div>

              {/* ══════════════ OVERVIEW ══════════════ */}
              <section className="panel" id="okr2-p-over" role="tabpanel" aria-labelledby="okr2-t-over" hidden={tab !== 'over'}>
                <div className="kpis">
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
                      <div className="kpi" key={k}>
                        <div className="k">{PHASE_META[k].label}</div>
                        <div className="v">
                          {done}<small> / {monthlyTeamTarget}</small>
                        </div>
                        <div className="track">
                          <i
                            style={{
                              width: monthlyTeamTarget > 0 ? `${Math.min(100, (done / monthlyTeamTarget) * 100)}%` : '0%',
                              background: st === 'risk' ? 'var(--risk)' : 'var(--blue)',
                            }}
                          />
                          <span className="pace" style={{ left: `${Math.min(100, (asOfDay / daysInMonth) * 100)}%` }} />
                        </div>
                        <div className="foot" style={{ color: st === 'risk' ? 'var(--risk)' : undefined }}>{foot}</div>
                      </div>
                    )
                  })}

                  {/* Avg design days — real, from step 6 start → step 13 completion */}
                  <div className="kpi">
                    <div className="k">Avg design days</div>
                    <div className={avgDesignDays === null ? 'v empty-v' : 'v'}>{avgDesignDays ?? '—'}</div>
                    <div className="foot">
                      {designDaysList.length
                        ? `across ${designDaysList.length} completed design${designDaysList.length === 1 ? '' : 's'}`
                        : 'No completions to measure yet'}
                    </div>
                  </div>

                  {/* PLACEHOLDER — Phase 2. Same empty-card pattern the mockup uses
                      for "Avg design days" with no data. */}
                  <div className="kpi">
                    <div className="k">Selections completed</div>
                    <div className="v empty-v">—</div>
                    <div className="foot">Not connected yet · Phase 2</div>
                  </div>
                  <div className="kpi">
                    <div className="k">Bid completed</div>
                    <div className="v empty-v">—</div>
                    <div className="foot">Not connected yet · Phase 2</div>
                  </div>
                </div>

                <div className={behindPhases.length ? 'pacebar warn' : 'pacebar'}>
                  <span className={`dot ${behindPhases.length ? 'risk' : totalInFlight > 0 ? 'go' : ''}`} />
                  <span>
                    {behindPhases.length ? (
                      <>
                        <b>{elapsedPct}% of {monthName} elapsed, {totalDone} of {totalTarget} completed.</b>{' '}
                        {behindPhases.length} of {PHASE_KEYS.length} OKRs {behindPhases.length === 1 ? 'is' : 'are'} behind
                        pace ({behindPhases.map(k => PHASE_META[k].short.toLowerCase()).join(', ')}).{' '}
                        {totalInFlight > 0
                          ? `${totalInFlight} package${totalInFlight === 1 ? '' : 's'} in flight.`
                          : 'Nothing is in flight.'}
                      </>
                    ) : (
                      <>
                        <b>{elapsedPct}% of {monthName} elapsed.</b> {totalDone} of {totalTarget} completed,{' '}
                        {totalInFlight} in flight. Nothing is behind pace yet.
                      </>
                    )}
                  </span>
                </div>

                <div className="slab">
                  <h2>Per PM</h2>
                  <span className="hint">monthly targets · {MONTHLY_TARGET_PER_PM} each per OKR</span>
                  <button className="more" onClick={() => setTab('pm')}>Open full view →</button>
                </div>
                <div className="tbox">
                  <div className="tscroll">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 96 }} />
                          <th className="grp ghead" colSpan={3}>Design</th>
                          <th className="ghead" colSpan={3}>Permit</th>
                          <th className="grp ghead" colSpan={3}>Contract</th>
                        </tr>
                        <tr>
                          <th>PM</th>
                          {PHASE_KEYS.map(k => {
                            const band = k === 'permit' ? '' : 'grp '
                            return (
                              <Fragment key={k}>
                                <th className={`${band}num`}>Tgt</th>
                                <th className={`${band}num`}>Done</th>
                                <th className={`${band}ctr`}>St</th>
                              </Fragment>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {pmRows.length === 0 ? (
                          <tr><td colSpan={10} className="dim">No PMs found.</td></tr>
                        ) : (
                          pmRows.map(row => (
                            <tr key={row.pm}>
                              <td className="nm">{row.pm}</td>
                              {PHASE_KEYS.map(k => {
                                const cell = row[k]
                                const st = pace.state(cell.target, cell.obtained, cell.inFlight)
                                const band = k === 'permit' ? '' : 'grp '
                                return (
                                  <Fragment key={k}>
                                    <td className={`${band}num dim`}>{cell.target}</td>
                                    <td className={`${band}num${cell.obtained ? '' : ' dim'}`}>{cell.obtained}</td>
                                    <td className={`${band}ctr`} title={PACE_LABEL[st]}>
                                      <i className={`dot ${PACE_DOT[st]}`} />
                                    </td>
                                  </Fragment>
                                )
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <PaceLegend note="Red appears only when actual trails the expected run-rate for the day" />
                </div>

                <div className="slab">
                  <h2>Active projects</h2>
                  <span className="hint">
                    {computed.length} tracked{solePhase ? ` · all in ${solePhase.toLowerCase()}` : ''}
                  </span>
                  <button className="more" onClick={() => setTab('proj')}>Open full view →</button>
                </div>
                {projCards.length === 0 ? (
                  <div className="pcard dim" style={{ fontSize: 12.5 }}>No active clients.</div>
                ) : (
                  <>
                    {projCards.slice(0, 2).map(p => <ProjectCard key={p.id} p={p} />)}
                    {projCards.length > 2 && (
                      <details className="fold">
                        <summary>
                          <span className="cv">▶</span>
                          {projCards.length - 2} more project{projCards.length - 2 === 1 ? '' : 's'}
                          <span className="fm">{projCards.slice(2).map(p => p.name).join(', ')}</span>
                        </summary>
                        <div className="foldbody">
                          {projCards.slice(2).map(p => <ProjectCard key={p.id} p={p} />)}
                        </div>
                      </details>
                    )}
                  </>
                )}

                <div className="slab"><h2>Reference</h2><span className="hint">expand when you need it</span></div>

                <Fold title="Quarterly targets" meta={quarterLabel} metaRight="not connected yet">
                  <QuarterlyTargetsPlaceholder />
                </Fold>
                <Fold title="PIT goals KPI" meta={quarterLabel} metaRight="not connected yet">
                  <PitGoalsPlaceholder />
                </Fold>
                <Fold title="NPS history" meta="all time" metaRight="not connected yet">
                  <NpsHistoryPlaceholder />
                </Fold>
                <Fold title="Selections completed" meta={monthLabel} metaRight="not connected yet">
                  <SimplePlaceholder
                    what="Selections completed"
                    detail="Selections is not modelled as an OKR phase in workflow records yet, so there is nothing to count. It stays a placeholder here, exactly as on the current dashboard."
                  />
                </Fold>
                <Fold title="Bid completed" meta={monthLabel} metaRight="new · not connected yet">
                  <SimplePlaceholder
                    what="Bid completed"
                    detail="New section — it does not exist on the current dashboard at all. No source is wired up, so no number is shown."
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
              </section>

              {/* ══════════════ PER PM ══════════════ */}
              <section className="panel" id="okr2-p-pm" role="tabpanel" aria-labelledby="okr2-t-pm" hidden={tab !== 'pm'}>
                <div className="slab">
                  <h2>Per PM breakdown</h2>
                  <span className="hint">{monthLabel} · {MONTHLY_TARGET_PER_PM} per PM per OKR</span>
                </div>
                <div className="tbox">
                  <div className="tscroll">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 110 }} />
                          {PHASE_KEYS.map(k => (
                            <th key={k} className={`${k === 'permit' ? '' : 'grp '}ghead`} colSpan={4}>
                              {PHASE_META[k].label}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          <th>PM</th>
                          {PHASE_KEYS.map(k => {
                            const band = k === 'permit' ? '' : 'grp '
                            return (
                              <Fragment key={k}>
                                <th className={`${band}num`}>Tgt</th>
                                <th className={`${band}num`}>Done</th>
                                <th className={`${band}num`}>Gap</th>
                                <th className={`${band}ctr`}>Status</th>
                              </Fragment>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {pmRows.length === 0 ? (
                          <tr><td colSpan={13} className="dim">No PMs found.</td></tr>
                        ) : (
                          pmRows.map(row => (
                            <tr key={row.pm}>
                              <td className="nm">{row.pm}</td>
                              {PHASE_KEYS.map(k => {
                                const cell = row[k]
                                const st = pace.state(cell.target, cell.obtained, cell.inFlight)
                                const band = k === 'permit' ? '' : 'grp '
                                const g = cell.obtained - cell.target
                                return (
                                  <Fragment key={k}>
                                    <td className={`${band}num dim`}>{cell.target}</td>
                                    <td className={`${band}num${cell.obtained ? '' : ' dim'}`}>{cell.obtained}</td>
                                    <td
                                      className={`${band}num`}
                                      style={{ color: g < 0 && st === 'risk' ? 'var(--risk)' : 'var(--tx3)' }}
                                    >
                                      {gapText(cell.obtained, cell.target)}
                                    </td>
                                    <td className={`${band}ctr`}>
                                      <span className={`pill ${PACE_PILL[st]}`}>
                                        <i className={`dot ${PACE_DOT[st]}`} />{PACE_LABEL[st]}
                                      </span>
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
                            <td>Team</td>
                            {PHASE_KEYS.map(k => {
                              const done = obtainedThisMonth(k)
                              const st = pace.state(monthlyTeamTarget, done, inFlight(k))
                              const band = k === 'permit' ? '' : 'grp '
                              const g = done - monthlyTeamTarget
                              return (
                                <Fragment key={k}>
                                  <td className={`${band}num`}>{monthlyTeamTarget}</td>
                                  <td className={`${band}num`}>{done}</td>
                                  <td className={`${band}num`} style={{ color: g < 0 && st === 'risk' ? 'var(--risk)' : 'var(--tx3)' }}>
                                    {gapText(done, monthlyTeamTarget)}
                                  </td>
                                  <td className={`${band}ctr`}>
                                    <span className={`pill ${PACE_PILL[st]}`}>
                                      <i className={`dot ${PACE_DOT[st]}`} />{PACE_LABEL[st]}
                                    </span>
                                  </td>
                                </Fragment>
                              )
                            })}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  <PaceLegend />
                </div>

                <div className="slab"><h2>Support teams</h2><span className="hint">not tracked in workflow data</span></div>
                <div className="tbox">
                  <div className="tscroll">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 150 }}>Team</th>
                          <th className="num">Target</th>
                          <th className="num">Done</th>
                          <th className="num">Gap</th>
                          <th>Status</th>
                          <th>Scope</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SUPPORT_TEAMS.map((t, i) => {
                          const st = pace.state(t.target, t.obtained, 0)
                          return (
                            <tr key={i}>
                              <td>
                                <span className="nm">{t.name}</span>
                                <div className="sub">{t.team}</div>
                              </td>
                              <td className="num">{t.target}</td>
                              <td className={`num${t.obtained ? '' : ' dim'}`}>{t.obtained}</td>
                              <td className="num">{gapText(t.obtained, t.target)}</td>
                              <td>
                                <span className={`pill ${PACE_PILL[st]}`}>
                                  <i className={`dot ${PACE_DOT[st]}`} />{PACE_LABEL[st]}
                                </span>
                              </td>
                              <td className="dim">{t.scope}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Flag>
                  <b>Data gap.</b> Support-team numbers are entered by hand on the Excel tab and don&apos;t flow from
                  project records, so they can&apos;t be cross-checked against the pipeline. The targets shown are
                  carried over from the current dashboard; the &ldquo;Done&rdquo; column has no source to read and stays 0.
                  Worth resolving before anyone reports off them.
                </Flag>
              </section>

              {/* ══════════════ PROJECTS ══════════════ */}
              <section className="panel" id="okr2-p-proj" role="tabpanel" aria-labelledby="okr2-t-proj" hidden={tab !== 'proj'}>
                <div className="slab">
                  <h2>Active projects</h2>
                  <span className="hint">
                    {computed.length} client{computed.length === 1 ? '' : 's'}
                    {solePhase ? ` · all in ${solePhase.toLowerCase()} stage` : ''}
                  </span>
                </div>
                {projCards.length === 0 ? (
                  <div className="pcard dim" style={{ fontSize: 12.5 }}>No active clients.</div>
                ) : (
                  projCards.map(p => <ProjectCard key={p.id} p={p} />)
                )}
                {allInOnePhase && solePhase === 'Design' && (
                  <Flag>
                    <b>All {computed.length} sit in design.</b> Nothing has reached permit or contract, which is why
                    every downstream OKR reads zero. The bottleneck is upstream of the metrics, not in them.
                  </Flag>
                )}
              </section>

              {/* ══════════════ HISTORY ══════════════ */}
              <section className="panel" id="okr2-p-hist" role="tabpanel" aria-labelledby="okr2-t-hist" hidden={tab !== 'hist'}>
                <div className="slab"><h2>NPS history</h2><span className="hint">Phase 2</span></div>
                <NpsHistoryPlaceholder />

                <div className="slab"><h2>PIT goals KPI</h2><span className="hint">{quarterLabel} · Phase 2</span></div>
                <PitGoalsPlaceholder />

                <div className="slab"><h2>Quarterly targets</h2><span className="hint">{quarterLabel} · Phase 2</span></div>
                <QuarterlyTargetsPlaceholder />

                <div className="slab"><h2>Completions calendar</h2><span className="hint">{monthLabel}</span></div>
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

        {/* Rendered inside .okr2-root so the scoped tokens apply, but as a sibling
            of the animated div so position:fixed stays anchored to the viewport. */}
        {!loading && <FloatingOKRAI aiContext={okrAIContext} />}
      </div>
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
  return (
    <button
      className="tab"
      role="tab"
      id={`okr2-t-${id}`}
      aria-selected={cur === id}
      aria-controls={`okr2-p-${id}`}
      onClick={() => set(id)}
    >
      {children}
      {count !== undefined && <span className="cnt">{count}</span>}
    </button>
  )
}

function PaceLegend({ note }: { note?: string }) {
  return (
    <div className="legend">
      <span><i className="dot" />Not started</span>
      <span><i className="dot go" />In progress</span>
      <span><i className="dot risk" />Behind pace</span>
      <span><i className="dot done" />Target met</span>
      {note && <span className="dim" style={{ marginLeft: 'auto' }}>{note}</span>}
    </div>
  )
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <div className="flag">
      <span aria-hidden="true">⚑</span>
      <div>{children}</div>
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
  return (
    <details className="fold">
      <summary>
        <span className="cv">▶</span>
        <span className="ft">{title}</span>
        {meta && <span>{meta}</span>}
        {metaRight && <span className="fm">{metaRight}</span>}
      </summary>
      <div className="foldbody">{children}</div>
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

const PHASE_PILL: Record<ProjCard['phase'], { cls: string; dot: string; label: string }> = {
  Design: { cls: 'blue', dot: 'go', label: 'In design' },
  Permit: { cls: 'ochre', dot: '', label: 'In permit' },
  Contract: { cls: 'green', dot: 'done', label: 'In contract' },
  Complete: { cls: 'teal', dot: 'done', label: 'Complete' },
}

function ProjectCard({ p }: { p: ProjCard }) {
  const [sDone, sTotal] = p.steps
  const oPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0
  const pill = PHASE_PILL[p.phase]
  return (
    <div className="pcard">
      <div className="phead">
        <Link href={`/customers/${p.id}`} className="who2">{p.name}</Link>
        <span className="chip">{p.pm}</span>
        {p.type && <span className="ptype">{p.type}</span>}
        <span className={`pill ${pill.cls}`} style={{ marginLeft: 'auto' }}>
          <i className={`dot ${pill.dot}`} />{pill.label}
        </span>
      </div>

      <div className="overall">
        <span className="ol">Overall journey</span>
        <div className="track" style={{ margin: 0, flex: 1 }}>
          {sDone > 0 && <i style={{ width: `${oPct}%` }} />}
        </div>
        <span className="pv mono">{sDone} / {sTotal}</span>
      </div>

      {p.groups.map(g => {
        const [gSteps, gStepsTotal] = g.steps
        const [gTasks, gTasksTotal] = g.tasks
        const stepsOff = gSteps === 0
        const tasksOff = gTasks === 0
        const stepPct = gStepsTotal > 0 ? Math.round((gSteps / gStepsTotal) * 100) : 0
        const taskPct = gTasksTotal > 0 ? Math.round((gTasks / gTasksTotal) * 100) : 0
        return (
          <Fragment key={g.key}>
            {/* Phase step progress */}
            <div className="prow">
              <span className={stepsOff ? 'pl off' : 'pl'}>{g.label}</span>
              <div className="track" style={{ margin: 0 }}>
                {!stepsOff && <i style={{ width: `${stepPct}%` }} />}
              </div>
              <span className={stepsOff ? 'pv off' : 'pv'}>{gSteps} / {gStepsTotal}</span>
            </div>

            {/* KPI tasks for THIS phase, nested under it. Keeps the live
                dashboard's fallback for a phase with no tasks defined. */}
            <div className="prow kpirow">
              <span className="pl">KPI tasks</span>
              {gTasksTotal === 0 ? (
                <span className="none">No tasks recorded yet</span>
              ) : (
                <>
                  <div className="track" style={{ margin: 0 }}>
                    {!tasksOff && <i style={{ width: `${taskPct}%` }} />}
                  </div>
                  <span className="pv">{gTasks} / {gTasksTotal}</span>
                </>
              )}
            </div>
          </Fragment>
        )
      })}
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
  // When there is nothing to plot the mockup shows a short empty state with an
  // opt-in to reveal the grid anyway. With entries, the grid shows immediately.
  const [shown, setShown] = useState(hasEntries)
  const firstWeekday = new Date(year, monthIdx, 1).getDay() // 0 = Sun
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const trailing = (firstWeekday + daysInMonth) % 7

  return (
    <div>
      {!hasEntries && (
        <div className="calempty">
          <p>No completions logged in {monthName} yet</p>
          <small>Design, permit and contract dates appear here as projects clear each stage.</small>
          <button onClick={() => setShown(s => !s)}>
            {shown ? 'Hide calendar' : 'Show the empty calendar anyway'}
          </button>
        </div>
      )}

      {shown && (
        <div style={{ marginTop: hasEntries ? 0 : 10 }}>
          <div className="cal">
            {dows.map(d => <div className="dow" key={d}>{d}</div>)}
            {Array.from({ length: firstWeekday }, (_, i) => <div className="cell pad" key={`lead-${i}`} />)}
            {range(1, daysInMonth).map(d => {
              const day = dots.get(d)
              return (
                <div className={d === todayDay ? 'cell today' : 'cell'} key={d}>
                  <span>{d}</span>
                  {day && (
                    <div className="cdots">
                      {PHASE_KEYS.filter(k => day.has(k)).map(k => {
                        const n = day.get(k) ?? 0
                        const multi = n > 1
                        return (
                          <span
                            key={k}
                            className={multi ? 'cdot multi' : 'cdot'}
                            title={`${PHASE_META[k].label}${multi ? ` ×${n}` : ''}`}
                            style={{ background: PHASE_META[k].accent }}
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
            {trailing > 0 &&
              Array.from({ length: 7 - trailing }, (_, i) => <div className="cell pad" key={`trail-${i}`} />)}
          </div>
          <div className="legend" style={{ border: 0, padding: '9px 0' }}>
            {PHASE_KEYS.map(k => (
              <span key={k}>
                <i className="dot" style={{ background: PHASE_META[k].accent }} />
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
// PLACEHOLDERS — Phase 2 sections.
//
// These render the mockup's real table shells so the layout is final, but every
// value is an em-dash. The hardcoded Excel figures the live dashboard still
// shows for these sections are deliberately NOT carried over: under a fresh
// design they would read as connected data.
// ═══════════════════════════════════════════════════════════════════════════
function PlaceholderRowsNote({ children }: { children: React.ReactNode }) {
  return <Flag><b>Placeholder.</b> {children}</Flag>
}

function QuarterlyTargetsPlaceholder() {
  const cols = ['Design', 'Permit', 'Contract', 'Done']
  return (
    <div>
      <div className="tbox">
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>Month</th>
                {cols.map(c => <th className="num" key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {['Month 1', 'Month 2', 'Month 3'].map(m => (
                <tr key={m}>
                  <td className="nm dim">{m}</td>
                  {cols.map(c => <td className="num dim" key={c}>—</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="dim">Quarter total</td>
                {cols.map(c => <td className="num dim" key={c}>—</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <PlaceholderRowsNote>
        Quarterly targets are not wired to a source yet. There is also an unresolved conflict to settle first — the
        tracker footnote says 9 per PM per quarter while the quarterly tab totals 9 for the whole team. Phase 2.
      </PlaceholderRowsNote>
    </div>
  )
}

function PitGoalsPlaceholder() {
  // Column names follow the mockup, which renamed the source tab's two
  // identically-labelled "Department Team" columns. That rename is still
  // unconfirmed — see the flag.
  const cols = ['PIT submitted', 'PS submitted', 'Dept team trained', 'Dept team certified', 'SOP created']
  return (
    <div>
      <div className="tbox">
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>Name</th>
                {cols.map(c => <th className="num" key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="dim">—</td>
                {cols.map(c => <td className="num dim" key={c}>—</td>)}
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="dim">Quarter target</td>
                {cols.map(c => <td className="num dim" key={c}>—</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <PlaceholderRowsNote>
        No PIT source is connected yet. When it is: two columns shared the header &ldquo;Department Team&rdquo; on the
        source tab, renamed here to trained and certified — confirm which is which before this goes live.
      </PlaceholderRowsNote>
    </div>
  )
}

function NpsHistoryPlaceholder() {
  return (
    <div>
      <div className="tbox">
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Period</th>
                <th className="num">Responses</th>
                <th className="num">Avg score</th>
                <th className="num" style={{ minWidth: 80 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="dim">—</td>
                <td className="num dim">—</td>
                <td className="num dim">—</td>
                <td className="num dim">—</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="dim">All time</td>
                <td className="num dim">—</td>
                <td className="num dim">—</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <PlaceholderRowsNote>
        NPS responses are not connected yet, so the year → quarter → month drill-down has nothing to expand. The
        historical figures shown on the current dashboard are hand-copied from the tracker and are not carried over
        here on purpose. Phase 2.
      </PlaceholderRowsNote>
    </div>
  )
}

function SimplePlaceholder({ what, detail }: { what: string; detail: string }) {
  return (
    <div>
      <div className="tbox">
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>{what}</th>
                <th className="num">Target</th>
                <th className="num">Done</th>
                <th className="num">Gap</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="dim">—</td>
                <td className="num dim">—</td>
                <td className="num dim">—</td>
                <td className="num dim">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <PlaceholderRowsNote>{detail}</PlaceholderRowsNote>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Floating CASK Intelligence — same behaviour as the live dashboard's panel
// (POSTs to /api/chat/client, persists to chat_history scoped by user_email +
// page_context), restyled to the mockup's FAB and surface tokens.
//
// page_context is '/customers/okr-dashboard-v2' so this preview's history stays
// separate from the live dashboard's thread.
// ═══════════════════════════════════════════════════════════════════════════
const OKR2_PAGE_CONTEXT = '/customers/okr-dashboard-v2'
const OKR2_AI_GREETING =
  "CASK Intelligence online. I have live context on every active client's OKR status — Design, Permit and Contract progress, PM assignments and this month's targets. Quarterly targets, PIT goals, NPS and the Selections/Bid metrics are not connected yet, so I'll say so rather than guess."
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
      <button className="fab" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="okr2-aipanel">
        <span className="sp" aria-hidden="true">✦</span>CASK Intelligence
      </button>

      {open && (
        <div
          id="okr2-aipanel"
          role="dialog"
          aria-label="CASK Intelligence"
          style={{
            position: 'fixed',
            bottom: 70,
            right: 22,
            zIndex: 59,
            width: 360,
            maxWidth: 'calc(100vw - 44px)',
            height: 480,
            maxHeight: 'calc(100vh - 120px)',
            background: 'var(--s2)',
            border: '.5px solid var(--bd2)',
            borderRadius: 'var(--rc)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: 'var(--tx)',
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 15px', borderBottom: '.5px solid var(--bd)',
              fontFamily: 'var(--fd)', fontSize: 12.5, fontWeight: 500, flexShrink: 0,
            }}
          >
            <span style={{ color: 'var(--ochre)' }} aria-hidden="true">✦</span>
            CASK Intelligence
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={clearHistory}
                title="Clear chat history"
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 20,
                  background: 'var(--s1)', border: '.5px solid var(--bd)',
                  color: 'var(--tx3)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: 'none', border: 0, color: 'var(--tx3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          </div>

          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '4px 15px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? '.5px solid var(--bd)' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase',
                    color: m.role === 'user' ? 'var(--tx3)' : 'var(--ochre)', marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'CASK Intelligence'}
                </div>
                <div
                  style={{
                    fontSize: 12.5, lineHeight: 1.55,
                    color: m.role === 'user' ? 'var(--tx2)' : 'var(--tx)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}
                >
                  <ArtifactContent content={m.content} />
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ padding: '11px 0' }}>
                <div style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ochre)', marginBottom: 5 }}>
                  CASK Intelligence
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--tx3)', fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 && !thinking && (
            <div style={{ padding: '0 15px 10px', flexShrink: 0 }}>
              {OKR2_QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    fontFamily: 'inherit', fontSize: 12, color: 'var(--tx2)',
                    background: 'var(--s1)', border: '.5px solid var(--bd)',
                    borderRadius: 'var(--r)', padding: '8px 11px', marginBottom: 6, cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '10px 15px 13px', borderTop: '.5px solid var(--bd)', flexShrink: 0 }}>
            <div
              style={{
                display: 'flex', alignItems: 'flex-end', gap: 6,
                borderRadius: 'var(--r)', padding: 5,
                border: '.5px solid var(--bd)', background: 'var(--s1)',
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about OKR status, PMs, targets…"
                rows={1}
                style={{
                  flex: 1, resize: 'none', background: 'transparent', fontSize: 12.5,
                  padding: '5px 6px', outline: 'none', lineHeight: 1.5,
                  color: 'var(--tx)', fontFamily: 'inherit', maxHeight: 96,
                  overflowY: 'auto', border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || thinking}
                title="Send"
                style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: 'var(--r)',
                  display: 'grid', placeItems: 'center',
                  background: input.trim() && !thinking ? 'var(--ochre)' : 'var(--s3)',
                  color: input.trim() && !thinking ? 'var(--s0)' : 'var(--tx3)',
                  border: 'none', cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
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
