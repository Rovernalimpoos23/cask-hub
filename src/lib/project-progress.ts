// src/lib/project-progress.ts
// ──────────────────────────────────────────────────────────────────────────────
// The pure "where is this client" calculation behind /my-project, shared with the
// token-validated client-view data route so both compute IDENTICAL results.
//
// Moved verbatim from src/app/(app)/my-project/page.tsx (its Derived values /
// Journey phase / Your team / Project details blocks). Every expression below is
// the one that page used; only the surrounding function is new. No I/O, no React,
// no browser APIs — safe to call on the server or in a client component.
//
// INPUT CONTRACT — cjSteps: `null` and `[]` are NOT the same thing.
//   null  = the Construction reads failed or were unusable → phase is left null
//           past pre-con, which is what renders the "Unavailable" state.
//   array = definitions loaded. Callers must pass null, never [], on failure.
//
// NOTE for client-side callers: this module imports WORKFLOW_STEPS, which carries
// every step's internal per-role task lists. Importing it in a client component
// ships that text in the JS bundle (my-project/page.tsx already did so before this
// extraction). A customer-facing page should render from the client-view route's
// response instead of importing this module.
// ──────────────────────────────────────────────────────────────────────────────

import { WORKFLOW_STEPS, TOTAL_WORKFLOW_STEPS, type WorkflowStepDef } from '@/lib/workflow-steps'
import { getClientPhase, type ClientPhase } from '@/lib/client-phase'

// Phase tracker entry state. Lives here (not in the page) because
// constructionOverride below is typed with it; the page's tracker imports it.
export type PhaseState = 'done' | 'active' | 'upcoming'

export interface ProgressClient {
  name?: string | null
  project_address?: string | null
}

export interface ProgressAgendaHeader {
  project_name?: string | null
  project_address?: string | null
  architect?: string | null
  project_specialist?: string | null
  estimator?: string | null
  target_permit_date?: string | null
  homeowners?: string | null
  zoning?: string | null
  special_conditions?: string[] | null
}

export interface ProjectProgressInput {
  completedSteps: Set<number>
  cjSteps: { n: number; title: string }[] | null
  cjMarks: Set<number>
  client: ProgressClient | null
  agendaHeader: ProgressAgendaHeader | null
}

export interface ProjectProgress {
  completedCount: number
  pct: number
  currentStep: WorkflowStepDef | null
  cjAvailable: boolean
  cjTotal: number
  cjDoneCount: number
  cjCurrentStep: { n: number; title: string } | null
  phase: ClientPhase | null
  cjPct: number
  showCjProgress: boolean
  constructionOverride: { state: PhaseState; description: string } | undefined
  team: { role: string; name: string }[]
  teamHasAnyone: boolean
  specialistName: string
  details: { label: string; value: string }[]
  conditionValues: string[]
  realConditions: string[]
  showConditions: boolean
}

// Fetch-boundary guard: a non-string (or whitespace-only) value reads as absent.
function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function fmtMaybeDate(value: string | null | undefined): string {
  if (!value) return ''
  // ISO date (YYYY-MM-DD) → friendly format; otherwise show raw.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value.slice(0, 10) + 'T00:00:00')
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
  }
  return value
}

export function computeProjectProgress({
  completedSteps,
  cjSteps,
  cjMarks,
  client,
  agendaHeader,
}: ProjectProgressInput): ProjectProgress {
  const completedCount = WORKFLOW_STEPS.filter(s => completedSteps.has(s.step)).length
  const pct = TOTAL_WORKFLOW_STEPS > 0 ? Math.round((completedCount / TOTAL_WORKFLOW_STEPS) * 100) : 0
  const currentStep = WORKFLOW_STEPS.find(s => !completedSteps.has(s.step)) ?? null

  // ── Journey phase ───────────────────────────────────────────────────────────
  // Only matters once pre-con is done (currentStep === null); for every pre-con
  // client getClientPhase returns 'precon'. Mirrors the Construction panel /
  // internal Overview exactly: done count is the INTERSECTION of marks with the
  // definitions, and the current step is the LOWEST-numbered unmarked step (not
  // "highest marked + 1").
  // cjAvailable false (read failed / no definitions) → phase is left null past
  // pre-con, and the page says progress is unavailable instead of guessing.
  const cjAvailable = cjSteps !== null
  const cjTotal = cjSteps?.length ?? 0
  const cjDoneCount = cjSteps ? cjSteps.filter(s => cjMarks.has(s.n)).length : 0
  const cjCurrentStep = cjSteps ? cjSteps.find(s => !cjMarks.has(s.n)) ?? null : null
  // getClientPhase is the sole decider. Mid-pre-con it returns 'precon' whatever the
  // construction values are (completedCount !== 37), so it is safe to call even when
  // the construction read failed; only past pre-con does an unavailable read matter.
  const phase = currentStep !== null || cjAvailable
    ? getClientPhase(completedCount, cjDoneCount, cjTotal)
    : null
  const cjPct = cjTotal > 0 ? Math.round((cjDoneCount / cjTotal) * 100) : 0
  // The progress headline/bar switch to the Construction count only in the two
  // past-pre-con phases with real data; pre-con (and "unavailable") keep 37-step.
  const showCjProgress = phase === 'construction' || phase === 'completed'
  // Replaces the tracker's cosmetic "Construction" entry (which is really pre-con
  // step 37) once pre-con is done. undefined for pre-con → original tracker render.
  const constructionOverride: { state: PhaseState; description: string } | undefined =
    phase === 'precon'
      ? undefined
      : phase === 'completed'
        ? { state: 'done', description: 'Your home is complete' }
        : phase === 'construction' && cjCurrentStep
          ? { state: 'active', description: `Step ${cjCurrentStep.n} of ${cjTotal} · ${cjCurrentStep.title}` }
          // Past pre-con but construction progress could not be read.
          : { state: 'active', description: 'Progress details unavailable right now' }

  // ── Your team / Project details ─────────────────────────────────────────────
  // Every value is a real column or ''.
  // Team — client_agenda_header only. No fallback: the clients table has no column
  // for these roles (clients.owner is the Client Solution Manager, a different role).
  const team: { role: string; name: string }[] = [
    { role: 'Architect', name: text(agendaHeader?.architect) },
    { role: 'Project Specialist', name: text(agendaHeader?.project_specialist) },
    { role: 'Estimator', name: text(agendaHeader?.estimator) },
  ]
  const teamHasAnyone = team.some(m => m.name !== '')
  // Footer CTA reuses the Team card's own value ('' when not assigned).
  const specialistName = team.find(m => m.role === 'Project Specialist')?.name ?? ''

  // Project details. Name / address / homeowners use the SAME fallback as the staff
  // Standing Agenda (customers/[id]/page.tsx:1947-1953): header value, else the
  // clients row (`h?.project_name || clientName`, `h?.project_address ||
  // client.project_address`, `h?.homeowners || clientName`). Permit date and zoning
  // exist only on client_agenda_header, so they have no fallback.
  const details: { label: string; value: string }[] = [
    { label: 'Project name', value: text(agendaHeader?.project_name) || text(client?.name) },
    { label: 'Address', value: text(agendaHeader?.project_address) || text(client?.project_address) },
    { label: 'Homeowners', value: text(agendaHeader?.homeowners) || text(client?.name) },
    { label: 'Target permit date', value: fmtMaybeDate(text(agendaHeader?.target_permit_date)) },
    { label: 'Zoning', value: text(agendaHeader?.zoning) },
  ]

  // Special conditions — rendered only when a header row exists AND its array holds
  // at least one real value. 'None of these' is an explicit answer, not an empty one,
  // so it renders as "No special conditions" rather than being dropped.
  const conditionValues = Array.isArray(agendaHeader?.special_conditions)
    ? (agendaHeader.special_conditions as unknown[]).map(text).filter(v => v !== '')
    : []
  const realConditions = conditionValues.filter(v => v !== 'None of these')
  const showConditions = agendaHeader !== null && conditionValues.length > 0

  return {
    completedCount,
    pct,
    currentStep,
    cjAvailable,
    cjTotal,
    cjDoneCount,
    cjCurrentStep,
    phase,
    cjPct,
    showCjProgress,
    constructionOverride,
    team,
    teamHasAnyone,
    specialistName,
    details,
    conditionValues,
    realConditions,
    showConditions,
  }
}

// ── Construction definitions normaliser ──────────────────────────────────────
// Same rules as my-project/page.tsx's load effect (which keeps its own inline copy
// for now — it was out of scope to touch in this task; switching it to this helper
// is a follow-up). Returns null — never [] — when the list is unusable:
//   * zero rows (an RLS denial comes back as an empty 200), or
//   * ANY malformed row (dropping a step would silently shrink the total).
export function normalizeCjDefinitions(rows: unknown): { n: number; title: string }[] | null {
  const rawDefs = (Array.isArray(rows) ? rows : []) as { step_number: unknown; title: unknown }[]
  const defs = rawDefs
    .filter((r): r is { step_number: number; title: string } => typeof r.step_number === 'number' && typeof r.title === 'string')
    .map(r => ({ n: r.step_number, title: r.title }))
  return defs.length > 0 && defs.length === rawDefs.length ? defs : null
}
