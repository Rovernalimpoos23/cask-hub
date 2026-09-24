// src/app/api/client-view/[token]/route.ts
//
// Token-authorised, read-only project snapshot for the customer-facing
// /client-view/<token> page (that page is a later task). GET only.
//
// AUTHORISATION = THE TOKEN, NOT A SESSION
//   The raw token from the URL is resolved by validateShareToken (sha256 match,
//   not revoked, not expired) to exactly ONE client_id. Every read below is scoped
//   to that id. Nothing in the request can choose a different client.
//   Malformed / unknown / revoked / expired all return the SAME 404 body — see
//   GENERIC_INVALID — so the response never reveals which case applied.
//
// ⚠ NOT YET REACHABLE WITHOUT A LOGIN: middleware.ts redirects every signed-out
//   request except /auth/* and /api/webhooks/* to /auth/login. A customer (no Hub
//   session) calling this route today gets that redirect, not this handler. The
//   /client-view page task must add a /api/client-view/ (and /client-view/)
//   exemption using the same `pathname.startsWith(...)` pattern. Until then this
//   route can be exercised by a signed-in staff user, which is enough to verify it.
//
// MINIMAL FIELDS ONLY — no select('*') anywhere. Every column selected below is
// one the /my-project page actually renders (catalogued 2026-09-25):
//   clients                        name, project_type, location, project_value,
//                                  project_address (details fallback only)
//   workflow_step_completions      step_number
//   client_agenda_header           architect, project_specialist, estimator,
//                                  project_name, project_address, homeowners,
//                                  target_permit_date, zoning, special_conditions
//   client_files                   id, file_name, file_type, file_size, uploaded_at
//                                  (never file_path; no signed URLs — later task)
//   construction_step_definitions  step_number, title
//   construction_step_marks        step_number
// WORKFLOW_STEPS is used server-side only and projected to { step, title, type } —
// its internal per-role task lists never reach the response.
//
// CALCULATION: computeProjectProgress (src/lib/project-progress.ts) — the SAME
// function /my-project uses, so both surfaces produce identical phase/step results.
//
// ERROR SEMANTICS (one deliberate difference from /my-project, flagged):
//   * Construction definitions/marks failure → cjSteps = null → phase "Unavailable",
//     exactly as /my-project does.
//   * clients / Precon completions / header / files failure → 500 load_failed.
//     /my-project (a staff preview) silently treats these as empty; a customer page
//     showing "0 of 37 steps" because a read failed would be actively wrong, so this
//     route refuses to return partial data instead.
//
// The raw token is never logged, never echoed, never included in any response.
import { NextResponse } from 'next/server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import { WORKFLOW_STEPS, TOTAL_WORKFLOW_STEPS } from '@/lib/workflow-steps'
import { computeProjectProgress, normalizeCjDefinitions } from '@/lib/project-progress'
import { validateShareToken } from '@/lib/validate-share-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Bound to a bearer credential in the URL — never cache.
const NO_STORE = { 'Cache-Control': 'no-store' }

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

// One body for every "this link does not work" case.
const GENERIC_INVALID = { error: 'link_invalid', message: 'This link is invalid or has expired.' }

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    // ── 1. Service-role client ───────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[client-view] service client config missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      })
      return json({ error: 'server_config' }, 500)
    }
    const supabase = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 2. Resolve the token to one client ───────────────────────────
    const auth = await validateShareToken(supabase, params?.token)
    if (!auth.ok) {
      if (auth.reason === 'error') {
        console.error('[client-view] token lookup failed:', auth.message)
        return json({ error: 'server_error' }, 500)
      }
      return json(GENERIC_INVALID, 404)
    }
    const clientId = auth.clientId

    // ── 3. Minimal, client-scoped reads (in parallel) ────────────────
    const [clientRes, completionsRes, headerRes, filesRes, cjDefRes, cjMarkRes] = await Promise.all([
      supabase.from('clients')
        .select('name, project_type, location, project_value, project_address')
        .eq('id', clientId).maybeSingle(),
      supabase.from('workflow_step_completions')
        .select('step_number').eq('client_id', clientId),
      supabase.from('client_agenda_header')
        .select('architect, project_specialist, estimator, project_name, project_address, homeowners, target_permit_date, zoning, special_conditions')
        .eq('client_id', clientId).maybeSingle(),
      supabase.from('client_files')
        .select('id, file_name, file_type, file_size, uploaded_at')
        .eq('client_id', clientId).order('uploaded_at', { ascending: false }),
      supabase.from('construction_step_definitions')
        .select('step_number, title').order('step_number', { ascending: true }),
      supabase.from('construction_step_marks')
        .select('step_number').eq('client_id', clientId),
    ])

    const coreErr = clientRes.error ?? completionsRes.error ?? headerRes.error ?? filesRes.error
    if (coreErr) {
      console.error('[client-view] load failed:', coreErr.message)
      return json({ error: 'load_failed' }, 500)
    }
    if (!clientRes.data) {
      // Token was valid but its client is gone (should be impossible: tokens
      // cascade-delete with the client). Answer like any other dead link.
      return json(GENERIC_INVALID, 404)
    }

    const client = clientRes.data as {
      name: string | null
      project_type: string | null
      location: string | null
      project_value: number | null
      project_address: string | null
    }
    const completedSteps = new Set(((completionsRes.data ?? []) as { step_number: number }[]).map(r => r.step_number))
    const agendaHeader = (headerRes.data ?? null) as {
      architect: string | null
      project_specialist: string | null
      estimator: string | null
      project_name: string | null
      project_address: string | null
      homeowners: string | null
      target_permit_date: string | null
      zoning: string | null
      special_conditions: string[] | null
    } | null

    // Construction: same fail-to-null rule as /my-project (null, never []).
    let cjSteps: { n: number; title: string }[] | null = null
    let cjMarks = new Set<number>()
    if (cjDefRes.error || cjMarkRes.error) {
      console.error('[client-view] construction load failed:', (cjDefRes.error ?? cjMarkRes.error)?.message)
    } else {
      cjSteps = normalizeCjDefinitions(cjDefRes.data)
      if (cjSteps) {
        cjMarks = new Set(((cjMarkRes.data ?? []) as { step_number: number }[]).map(r => r.step_number))
      }
    }

    // ── 4. Shared calculation — identical to /my-project ─────────────
    const p = computeProjectProgress({ completedSteps, cjSteps, cjMarks, client, agendaHeader })

    // ── 5. Response, organised by section ────────────────────────────
    const files = ((filesRes.data ?? []) as {
      id: string; file_name: string; file_type: string; file_size: number; uploaded_at: string
    }[]).map(f => ({ id: f.id, file_name: f.file_name, file_type: f.file_type, file_size: f.file_size, uploaded_at: f.uploaded_at }))

    return json({
      hero: {
        name: client.name,
        projectType: client.project_type,
        location: client.location,
        projectValue: client.project_value,
      },
      progress: {
        phase: p.phase,                       // 'precon' | 'construction' | 'completed' | null (= unavailable)
        showCjProgress: p.showCjProgress,
        precon: {
          completedCount: p.completedCount,
          total: TOTAL_WORKFLOW_STEPS,
          pct: p.pct,
          currentStep: p.currentStep
            ? { step: p.currentStep.step, title: p.currentStep.title, type: p.currentStep.type }
            : null,
        },
        construction: {
          available: p.cjAvailable,
          doneCount: p.cjDoneCount,
          total: p.cjTotal,
          pct: p.cjPct,
          currentStep: p.cjCurrentStep,       // { n, title } | null
        },
        constructionOverride: p.constructionOverride ?? null,
      },
      timeline: {
        // Everything the tracker and timeline need, without WORKFLOW_STEPS' task lists.
        preconSteps: WORKFLOW_STEPS.map(s => ({ step: s.step, title: s.title, type: s.type })),
        completedPreconSteps: Array.from(completedSteps).sort((a, b) => a - b),
        constructionSteps: cjSteps,           // null when unavailable
        markedConstructionSteps: Array.from(cjMarks).sort((a, b) => a - b),
      },
      files,
      team: {
        members: p.team,
        hasAnyone: p.teamHasAnyone,
      },
      details: {
        fields: p.details,
        conditions: {
          show: p.showConditions,
          values: p.realConditions,           // [] with show=true → "No special conditions"
        },
      },
      footer: {
        specialistName: p.specialistName,
      },
    }, 200)
  } catch (err) {
    // Message only — never the error object, never anything derived from the token.
    console.error('[client-view] error:', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'server_error' }, 500)
  }
}
