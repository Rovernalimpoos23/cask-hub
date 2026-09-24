// src/lib/client-phase.ts
// ──────────────────────────────────────────────────────────────────────────────
// Which journey a client is in: Precon → Construction → Completed.
//
// Shared by the Active Clients list (customers/page.tsx) and the client detail
// page's Overview (customers/[id]/page.tsx) so the two can never disagree about
// where a client is.
//
// Pre-con gates construction, matching the detail page's own gate
// (`precoCompletedCount === precoTotal` is what unlocks the Construction tab): a
// client is in Construction only once every pre-con step is done, and Completed
// only once every construction step is done on top of that.
//
// Both counts must be INTERSECTIONS of the client's completed step numbers with
// the steps that actually exist (never raw row counts), so neither can overshoot
// its total.
//
// The construction total is a PARAMETER, not a constant, because its source of
// truth is the row count of public.construction_step_definitions — a DB fact this
// pure module cannot know. Callers pass whatever total they counted against.
// ──────────────────────────────────────────────────────────────────────────────

import { TOTAL_WORKFLOW_STEPS } from '@/lib/workflow-steps'

export type ClientPhase = 'precon' | 'construction' | 'completed'

export function getClientPhase(
  preconCompleted: number,
  constructionCompleted: number,
  constructionTotal: number,
): ClientPhase {
  if (preconCompleted !== TOTAL_WORKFLOW_STEPS) return 'precon'
  // `constructionTotal > 0` so an unloaded or empty step list can never read as
  // "all construction steps done" (0 === 0) — absence of data is not completion.
  return constructionTotal > 0 && constructionCompleted === constructionTotal
    ? 'completed'
    : 'construction'
}
