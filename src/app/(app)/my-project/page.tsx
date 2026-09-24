'use client'
// src/app/(app)/my-project/page.tsx
//
// Premium, read-only, customer-facing project view. Shows a client their journey
// progress + standing agenda. No sidebar, no TopBar, no nav.
//
// ── Notes on constraints ─────────────────────────────────────────────────────
// 1. CSS-VARIABLE MAPPING: the brief referenced design tokens that don't exist in
//    this project (--surface-0/1/2, --text-primary, --text-muted, --bg-success,
//    --text-success, --border-success). They're mapped to the real globals.css
//    tokens here so the page matches the rest of the app + dark mode:
//      --surface-0 → --bg          (page background)
//      --surface-1 → --surface2    (track / hover / current-step row)
//      --surface-2 → --surface     (cards)
//      --text-primary → --text
//      --text-muted   → --text2 (labels) / --text3 (very subtle)
//      --bg-success     → --green-bg
//      --text-success   → --green
//      --border-success → --pill-green-border
// 2. CLEAN LAYOUT: the (app) layout always renders <Sidebar/> + <AIPanel/> and we
//    were told not to modify it. To present a fully clean page we render a
//    position:fixed full-viewport overlay that covers them. (Routing/middleware is
//    handled separately per the brief.)
// 3. The inlined standing-agenda "selections" copy (AGENDA_SECTIONS) and the
//    special-conditions checkbox list were removed with the old Project Details card.
//    Special conditions now render only the values actually stored for the client.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Fraunces, DM_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase'
import { WORKFLOW_STEPS, TOTAL_WORKFLOW_STEPS } from '@/lib/workflow-steps'
import { computeProjectProgress } from '@/lib/project-progress'
// Presentational pieces + style constants, moved verbatim to a shared module so the
// customer-facing /client-view page renders with the exact same components.
import {
  DISPLAY,
  BODY,
  MP_TOKENS,
  TypeBadge,
  PhaseTracker,
  ProgressRing,
  HouseSketch,
  MP_CARD,
  MP_CARD_HEADER,
  MP_CARD_TITLE,
  personInitials,
  fmtFileSize,
  fileIcon,
  fmtCurrency,
  CARD,
  SECTION_HEADER,
  SECTION_TITLE,
  SECTION_META,
  pad2,
  timelineRow,
} from '@/components/project-view/shared'
import { ThemeToggle } from '@/components/theme-toggle'

// ── Fonts (per brief): Fraunces for headings/large numbers, DM Sans for body ──
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

const SERIF = fraunces.style.fontFamily

// ── Data shapes ───────────────────────────────────────────────────────────────
interface ClientRow {
  id: string
  name: string
  project_type: string | null
  location: string | null
  project_value: number | null
  email: string | null
  // Already returned by the existing select('*'); typed here because Project
  // details falls back to it when client_agenda_header.project_address is blank.
  project_address?: string | null
}

interface AgendaHeaderRow {
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

// NEW (additive): a file shared with the customer (read-only on this page).
interface ProjectFile {
  id: string
  client_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_at: string
}

export default function MyProjectPage() {
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<ClientRow | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [agendaHeader, setAgendaHeader] = useState<AgendaHeaderRow | null>(null)
  // NEW (additive): files shared with this customer (read-only).
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])
  // Set only when an explicit ?client=<id> was given and resolved to no client.
  // Deliberately separate from `client === null` (the email/John Smith path's own
  // "No project found" state), so a staff user with a mistyped or stale link sees
  // that their link is wrong rather than being handed John Smith's project.
  const [requestedClientNotFound, setRequestedClientNotFound] = useState<string | null>(null)
  // Construction Journey (read-only). cjSteps is the shared step list from
  // construction_step_definitions — `null` means it could not be loaded (error or
  // zero rows), never a fallback list. cjMarks holds this client's marked step
  // numbers from construction_step_marks; row presence IS completion.
  // Only consulted once every pre-con step is done — see the phase derivation.
  const [cjSteps, setCjSteps] = useState<{ n: number; title: string }[] | null>(null)
  const [cjMarks, setCjMarks] = useState<Set<number>>(new Set())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      try {
        // 0. Explicit client (staff preview from a client profile's "Customer View"
        //    button). window.location rather than useSearchParams() so this page
        //    needs no Suspense boundary — same approach as customers/[id]/page.tsx.
        //    Mutually exclusive with steps 1-3: when the param is PRESENT (even if
        //    empty), the page resolves by id or shows "Client not found" — it never
        //    falls through to the email match or the John Smith fallback.
        const q = new URLSearchParams(window.location.search)
        const hasClientParam = q.has('client')
        const requestedClientId = (q.get('client') ?? '').trim()

        let clientRow: ClientRow | null = null
        if (hasClientParam) {
          // An empty or malformed id is simply "not found": a non-uuid value makes
          // PostgREST return an error rather than a row, and either way no row means
          // the requested client could not be shown.
          if (requestedClientId) {
            const { data, error } = await supabase.from('clients').select('*').eq('id', requestedClientId).maybeSingle()
            if (error) console.error('[my-project] client-by-id lookup error:', error)
            clientRow = (data as ClientRow | null) ?? null
          }
          if (!clientRow) {
            setRequestedClientNotFound(requestedClientId)
            setClient(null)
            setLoading(false)
            return
          }
        } else {
          // ── Existing resolution, unchanged ──────────────────────────────────
          // 1. Current logged-in user.
          const { data: { user } } = await supabase.auth.getUser()

          // 2. Match a client by email. (maybeSingle avoids throwing when there's no
          //    row — the brief's .single() would error in that case.)
          if (user?.email) {
            const { data } = await supabase.from('clients').select('*').eq('email', user.email).maybeSingle()
            clientRow = (data as ClientRow | null) ?? null
          }

          // 3. Demo fallback → John Smith.
          if (!clientRow) {
            const { data } = await supabase.from('clients').select('*').eq('name', 'John Smith').maybeSingle()
            clientRow = (data as ClientRow | null) ?? null
          }
        }

        if (!clientRow) {
          setClient(null)
          setLoading(false)
          return
        }
        setClient(clientRow)

        // 4-8. Completed steps, agenda header, shared files, and the Construction
        //      Journey (definitions + this client's marks) — in parallel, so the one
        //      existing `loading` gate covers all of them. (client_standing_agenda is no
        //      longer read: the selections section it fed has been removed.)
        const [
          { data: completions },
          { data: header },
          { data: files },
          { data: cjDefRows, error: cjDefErr },
          { data: cjMarkRows, error: cjMarkErr },
        ] = await Promise.all([
          supabase.from('workflow_step_completions').select('step_number').eq('client_id', clientRow.id),
          supabase.from('client_agenda_header').select('*').eq('client_id', clientRow.id).maybeSingle(),
          supabase.from('client_files').select('*').eq('client_id', clientRow.id).order('uploaded_at', { ascending: false }),
          // Same table and order as the Construction panel's fetchCjSteps (not
          // importable — module-local to customers/[id]/page.tsx); only the two
          // columns this page renders.
          supabase.from('construction_step_definitions').select('step_number, title').order('step_number', { ascending: true }),
          supabase.from('construction_step_marks').select('step_number').eq('client_id', clientRow.id),
        ])

        setCompletedSteps(new Set((completions ?? []).map((c: { step_number: number }) => c.step_number)))

        // Construction: fail to "unavailable", never to a guess. Zero definition rows
        // is treated as a failure too (an RLS denial comes back as an empty 200), and
        // a failed marks read leaves the whole journey unavailable rather than reading
        // as "nothing done yet".
        if (cjDefErr || cjMarkErr) {
          console.error('[my-project] construction load error:', cjDefErr ?? cjMarkErr)
        } else {
          const rawDefs = (cjDefRows ?? []) as { step_number: unknown; title: unknown }[]
          const defs = rawDefs
            .filter((r): r is { step_number: number; title: string } => typeof r.step_number === 'number' && typeof r.title === 'string')
            .map(r => ({ n: r.step_number, title: r.title }))
          // A malformed row makes the whole list unavailable (as fetchCjSteps throws)
          // rather than being skipped — dropping a step would silently shrink the total.
          if (defs.length > 0 && defs.length === rawDefs.length) {
            setCjSteps(defs)
            setCjMarks(new Set(((cjMarkRows ?? []) as { step_number: number }[]).map(r => r.step_number)))
          }
        }
        setAgendaHeader((header as AgendaHeaderRow | null) ?? null)
        setProjectFiles((files as ProjectFile[] | null) ?? [])
      } catch (err) {
        console.error('[my-project] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived values ──────────────────────────────────────────────────────────
  const firstName = client?.name?.trim().split(' ')[0] ?? ''

  // ── Journey phase / team / details ──────────────────────────────────────────
  // The whole pure calculation lives in src/lib/project-progress.ts, shared with
  // the token-validated client-view route so both compute identical results.
  // cjSteps stays null (not []) when the Construction reads failed — that is what
  // produces the "Unavailable" state. Names are destructured unchanged, so every
  // render site below reads exactly the values it read before the extraction.
  const {
    completedCount,
    pct,
    currentStep,
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
    realConditions,
    showConditions,
  } = computeProjectProgress({ completedSteps, cjSteps, cjMarks, client, agendaHeader })

  // NEW (additive): open a shared file via a short-lived signed URL.
  async function handleFileDownload(file: ProjectFile) {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('client-files')
      .createSignedUrl(file.file_path, 3600)
    if (error || !data?.signedUrl) {
      console.error('[my-project] download error:', error)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  // ── Full-viewport clean overlay (covers the app shell — see note 2) ──────────
  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    overflowY: 'auto',
    background: 'var(--bg)',
    color: 'var(--text)',
  }

  if (loading) {
    return (
      <div className={dmSans.className} style={{ ...overlay, display: 'grid', placeItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading your project…</div>
      </div>
    )
  }

  if (!client && requestedClientNotFound !== null) {
    return (
      <div className={dmSans.className} style={{ ...overlay, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontFamily: SERIF, fontSize: 24, color: 'var(--text)', marginBottom: 8 }}>
            Client not found
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
            {requestedClientNotFound
              ? <>No client matches the id <code style={{ fontSize: 12 }}>{requestedClientNotFound}</code>. The link may be mistyped or out of date.</>
              : <>This link names no client. Open Customer View from a client&apos;s profile instead.</>}
          </div>
          <Link href="/customers" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--text)' }}>
            ← Back to Active Clients
          </Link>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className={dmSans.className} style={{ ...overlay, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontFamily: SERIF, fontSize: 24, color: 'var(--text)', marginBottom: 8 }}>
            No project found
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
            We couldn&apos;t find a project linked to your account. Please contact your Project Specialist at
            CASK Construction.
          </div>
        </div>
      </div>
    )
  }

  // ── "Happening now" display model ────────────────────────────────────────────
  // Display-only: every value is one the page already computed above (phase,
  // currentStep, cjCurrentStep, cjTotal, pct, cjPct, showCjProgress). The branch
  // order is exactly the old current-step row's: pre-con row → construction row →
  // completed → construction-unavailable.
  // RING = progress through the client's CURRENT JOURNEY — the same number the old
  // "% complete" pill showed (`showCjProgress ? cjPct : pct`), not a new metric.
  const ringValue = showCjProgress ? cjPct : pct
  const happening: {
    eyebrow: string
    title: string
    meta: React.ReactNode
    ringCaption: string
    ringColor: string
  } = currentStep
    ? {
        eyebrow: 'Happening now · Pre-construction',
        title: currentStep.title,
        meta: (
          <>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>Step {pad2(currentStep.step)} of {TOTAL_WORKFLOW_STEPS}</span>
            <TypeBadge type={currentStep.type} />
          </>
        ),
        ringCaption: 'Pre-construction',
        ringColor: 'var(--mp-accent)',
      }
    : phase === 'construction' && cjCurrentStep
      ? {
          eyebrow: 'Happening now · Construction',
          title: cjCurrentStep.title,
          // No TypeBadge: its config is pre-con's three types (see Phase B).
          meta: <span style={{ fontVariantNumeric: 'tabular-nums' }}>Step {pad2(cjCurrentStep.n)} of {cjTotal}</span>,
          ringCaption: 'Construction',
          ringColor: 'var(--mp-accent)',
        }
      : phase === 'completed'
        ? {
            eyebrow: 'Complete',
            title: 'Your home is complete',
            meta: <span>Pre-construction and all {cjTotal} construction steps are finished.</span>,
            ringCaption: 'Construction',
            ringColor: 'var(--mp-ok)',
          }
        : {
            // Past pre-con, construction progress could not be read. The ring shows
            // the pre-con figure (which is real and 100%), captioned as such, rather
            // than any construction number.
            eyebrow: 'Pre-construction complete',
            title: 'Construction progress is not available right now',
            meta: <span>All {TOTAL_WORKFLOW_STEPS} pre-construction steps are done — please check back soon.</span>,
            ringCaption: 'Pre-construction',
            ringColor: 'var(--mp-ok)',
          }

  return (
    <div className={`${dmSans.className} mp-root`} style={{ ...overlay, background: 'var(--mp-bg)', fontFamily: dmSans.style.fontFamily }}>
      <style dangerouslySetInnerHTML={{ __html: MP_TOKENS }} />
      {/* ── SECTION 1 — Top bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 24px',
          background: '#1a1917',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/cask-logo-white.svg"
            alt="CASK Construction"
            style={{ height: 32, width: 'auto' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {firstName && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 99,
                padding: '6px 13px',
                whiteSpace: 'nowrap',
              }}
            >
              Welcome back, {firstName}
            </span>
          )}
          {/* The app's own toggle (useTheme / `.dark` on <html>), so this page and
              the rest of the Hub can never disagree about the current theme. */}
          <ThemeToggle />
        </div>
      </div>

      {/* Centered content column */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* ── SECTION 2 — Hero ─────────────────────────────────────────────── */}
        <div className="mp-hero" style={{ marginBottom: 36, paddingTop: 8, fontFamily: BODY }}>
          <HouseSketch />
          <div
            style={{
              position: 'relative',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--mp-ink3)',
              fontWeight: 500,
            }}
          >
            Your project
          </div>
          <h1 style={{ position: 'relative', fontFamily: DISPLAY, fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--mp-ink)', lineHeight: 1.04, margin: '14px 0 0' }} className="mp-hero-name">
            {client.name}
          </h1>
          {client.project_type && (
            <div style={{ position: 'relative', fontFamily: DISPLAY, fontSize: 26, fontWeight: 300, fontStyle: 'italic', color: 'var(--mp-ink2)', lineHeight: 1.2, marginTop: 6 }}>
              {client.project_type}
            </div>
          )}
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 13, color: 'var(--mp-ink3)', letterSpacing: '0.01em' }}>
            {client.location && <span>{client.location}</span>}
            {client.location && fmtCurrency(client.project_value) && (
              <span aria-hidden="true">·</span>
            )}
            {fmtCurrency(client.project_value) && (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(client.project_value)}</span>
            )}
          </div>
        </div>

        {/* ── SECTION 3 — Happening now ────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--mp-surface)',
            border: '0.5px solid var(--mp-line)',
            borderRadius: 16,
            padding: '26px 28px 24px',
            marginBottom: 20,
            fontFamily: BODY,
          }}
        >
          <div className="mp-now" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mp-accent)' }}>
                {happening.eyebrow}
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 300, letterSpacing: '-0.01em', color: 'var(--mp-ink)', lineHeight: 1.2, marginTop: 10 }}>
                {happening.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--mp-ink2)', lineHeight: 1.5 }}>
                {happening.meta}
              </div>
              {/* The step count the old headline showed — same values, same wording. */}
              <div style={{ fontSize: 12, color: 'var(--mp-ink3)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                {showCjProgress ? cjDoneCount : completedCount} of {showCjProgress ? cjTotal : TOTAL_WORKFLOW_STEPS} {showCjProgress ? 'construction steps complete' : 'steps complete'}
              </div>
            </div>
            <ProgressRing value={ringValue} color={happening.ringColor} caption={happening.ringCaption} />
          </div>

          {/* 4-phase tracker — horizontal bars */}
          <div className="mp-phases" style={{ marginTop: 26, paddingTop: 22, borderTop: '0.5px solid var(--mp-line)' }}>
            <PhaseTracker
              completed={completedSteps}
              currentStepNumber={currentStep?.step ?? null}
              constructionOverride={constructionOverride}
              constructionFill={showCjProgress ? cjPct / 100 : null}
            />
          </div>
        </div>

        {/* ── SECTION 4 — Project Timeline ─────────────────────────────────── */}
        <div style={{ ...CARD, marginBottom: 20 }}>
          {/* Which journey this card lists follows Phase B's derivation, never its own:
              the 37 pre-con steps while phase is 'precon' (unchanged), the fetched
              Construction steps once phase is 'construction' / 'completed'
              (showCjProgress), and an explicit notice when pre-con is done but the
              Construction reads failed (phase === null). */}
          <div style={SECTION_HEADER}>
            <span style={SECTION_TITLE}>Project timeline</span>
            <span style={SECTION_META}>
              {showCjProgress
                ? `${cjTotal} construction steps total`
                : phase === null
                  ? 'Construction'
                  : <>{TOTAL_WORKFLOW_STEPS} steps total</>}
            </span>
          </div>
          {showCjProgress && cjSteps ? (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {/* cjSteps is already in step_number order (Phase B's query). Current =
                  cjCurrentStep, Phase B's lowest-unmarked step — not recomputed here.
                  No type badge: this page's TypeBadge only knows pre-con's three types,
                  and Phase B's read does not select step_type, so there is no accurate
                  label to show without widening that query. */}
              {cjSteps.map((s, i) => timelineRow({
                stepNumber: s.n,
                title: s.title,
                done: cjMarks.has(s.n),
                isCurrent: cjCurrentStep?.n === s.n,
                last: i === cjSteps.length - 1,
                badge: null,
              }))}
            </div>
          ) : phase === null ? (
            // Same wording as Phase B's unavailable step row, so the two cards agree.
            <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
              Construction progress is not available right now — please check back soon.
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {WORKFLOW_STEPS.map((s, i) => timelineRow({
                stepNumber: s.step,
                title: s.title,
                done: completedSteps.has(s.step),
                isCurrent: currentStep?.step === s.step,
                last: i === WORKFLOW_STEPS.length - 1,
                badge: <TypeBadge type={s.type} />,
              }))}
            </div>
          )}
        </div>

        {/* ── SECTION 4.5 — Your Project Files (NEW · additive · read-only) ── */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: 'var(--text)', lineHeight: 1.2, margin: '0 0 12px' }}>
            Your Project Files
          </h2>
          <div style={CARD}>
            {projectFiles.length === 0 ? (
              <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
                No files have been shared yet — your project documents will appear here once uploaded by your CASK team
              </div>
            ) : (
              <div>
                {projectFiles.map((file, i) => {
                  const last = i === projectFiles.length - 1
                  const dateLabel = file.uploaded_at
                    ? new Date(file.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : ''
                  return (
                    <div
                      key={file.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 20px',
                        borderBottom: last ? undefined : '0.5px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(file.file_type, file.file_name)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.file_name}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtFileSize(file.file_size)}</span>
                          {dateLabel && <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {dateLabel}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileDownload(file)}
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--text)',
                          background: 'var(--surface)',
                          border: '0.5px solid var(--border2)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          flexShrink: 0,
                        }}
                      >
                        Download →
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 5a — Your team ───────────────────────────────────────── */}
        {/* One card, one of two shapes. With at least one name on file: all three
            roles as person rows, unfilled ones quietly marked "Not yet assigned". With
            no names at all (no header row, or a row with none of the three): a single
            card-level note instead of three repeated placeholders. */}
        <div style={{ ...MP_CARD, marginBottom: 20 }}>
          <div style={MP_CARD_HEADER}>
            <span style={MP_CARD_TITLE}>Your team</span>
          </div>
          {teamHasAnyone ? (
            <div>
              {team.map((m, i) => {
                const assigned = m.name !== ''
                return (
                  <div
                    key={m.role}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 24px',
                      borderTop: i === 0 ? undefined : '0.5px solid var(--mp-line)',
                    }}
                  >
                    {assigned ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          display: 'grid', placeItems: 'center',
                          background: 'var(--mp-accent-soft)', color: 'var(--mp-accent)',
                          fontFamily: DISPLAY, fontSize: 15, fontWeight: 400, letterSpacing: '0.02em',
                        }}
                      >
                        {personInitials(m.name)}
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          border: '1px dashed var(--mp-line)',
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      {assigned ? (
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--mp-ink)', lineHeight: 1.3 }}>{m.name}</div>
                      ) : (
                        <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--mp-ink3)', lineHeight: 1.3 }}>Not yet assigned</div>
                      )}
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mp-ink3)', marginTop: 3 }}>
                        {m.role}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '20px 24px', fontSize: 13, color: 'var(--mp-ink3)', lineHeight: 1.6 }}>
              Your architect, project specialist and estimator will appear here once
              they&apos;re assigned to your project.
            </div>
          )}
        </div>

        {/* ── SECTION 5b — Project details ─────────────────────────────────── */}
        <div style={{ ...MP_CARD, marginBottom: 20 }}>
          <div style={MP_CARD_HEADER}>
            <span style={MP_CARD_TITLE}>Project details</span>
          </div>
          <div className="mp-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px', padding: '20px 24px' }}>
            {details.map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mp-ink3)' }}>
                  {f.label}
                </span>
                {f.value ? (
                  <span style={{ fontSize: 14, color: 'var(--mp-ink)', lineHeight: 1.45, wordBreak: 'break-word' }}>{f.value}</span>
                ) : (
                  <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--mp-ink3)', lineHeight: 1.45 }}>Not yet confirmed</span>
                )}
              </div>
            ))}
          </div>

          {/* Special conditions — omitted entirely unless there is a real answer. */}
          {showConditions && (
            <div style={{ padding: '16px 24px 20px', borderTop: '0.5px solid var(--mp-line)' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mp-ink3)', marginBottom: 10 }}>
                Special conditions
              </div>
              {realConditions.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {realConditions.map(cond => (
                    <span
                      key={cond}
                      style={{
                        fontSize: 12.5, color: 'var(--mp-ink)', lineHeight: 1.3,
                        border: '0.5px solid var(--mp-line)', borderRadius: 99, padding: '5px 12px',
                      }}
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--mp-ink2)' }}>No special conditions</span>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 6 — Footer ───────────────────────────────────────────── */}
        {/* Primary CTA names the real project specialist when one is on file — the
            same value the Team card shows (team[], from client_agenda_header; no new
            read) — else keeps the generic wording, like the Team card's empty state.
            Below it: static company contact info, identical for every client. No
            social links and no second logo, by decision. */}
        <div style={{ textAlign: 'center', marginTop: 44, fontFamily: BODY }}>
          <div style={{ fontSize: 13, color: 'var(--mp-ink2)' }}>Questions about your project?</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 300, letterSpacing: '-0.01em', color: 'var(--mp-ink)', marginTop: 6, lineHeight: 1.3 }}>
            {specialistName
              ? <>Contact {specialistName}, your Project Specialist</>
              : <>Contact your Project Specialist · CASK Construction</>}
          </div>

          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              marginTop: 18, paddingTop: 16, borderTop: '0.5px solid var(--mp-line)',
              maxWidth: 360, marginInline: 'auto',
              fontSize: 12, color: 'var(--mp-ink3)', lineHeight: 1.55,
            }}
          >
            <div>
              <a href="tel:+17272012551" style={{ color: 'inherit', textDecoration: 'none' }}>(727) 201-2551</a>
              <span aria-hidden="true" style={{ margin: '0 8px' }}>·</span>
              <a href="mailto:info@caskconstruction.com" style={{ color: 'inherit', textDecoration: 'none' }}>info@caskconstruction.com</a>
            </div>
            <div>900 16th St. N., St Petersburg, FL 33705</div>
            <div>Mon thru Fri: 9am – 5pm · Sat and Sun: Closed</div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}>Powered by CASK Hub</div>
        </div>
      </div>
    </div>
  )
}
