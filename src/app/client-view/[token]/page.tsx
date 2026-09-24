'use client'
// src/app/client-view/[token]/page.tsx
//
// Customer-facing, read-only project view opened from a share link
// (/client-view/<token>). No Hub login: the token IS the authorisation, resolved
// server-side by GET /api/client-view/[token] (validateShareToken + minimal reads +
// computeProjectProgress). This page performs NO Supabase access of its own.
//
// WHY IT LIVES HERE (outside the (app) route group): (app)/layout.tsx renders the
// staff Sidebar and AddMeetingModal into the DOM even when a page visually covers
// them. This route inherits only the ROOT layout — globals.css tokens, the
// Fraunces / Inter font variables, the `.dark` class + theme flash guard — which is
// all it needs. Nothing from (app) is imported.
//
// WHY A CLIENT COMPONENT: the data comes from the token route (single source of
// truth for validation + the minimal-fields contract), the theme toggle is a client
// component, and a client fetch keeps the token-validated data path identical to
// what the API already enforces rather than a second server-side read path.
//
// ⚠ NOT YET REACHABLE BY A SIGNED-OUT VISITOR: middleware.ts sends every signed-out
// request (this page AND /api/client-view/*) to /auth/login. The exemption is task
// D3, deliberately isolated. Until then only a signed-in staff browser can load it.
//
// RENDERING: same approved structure as /my-project (hero → happening now + ring +
// phase tracker → timeline → files → team → details → footer), using the SAME shared
// components (src/components/project-view/shared.tsx). The section JSX itself is a
// copy of /my-project's — see the drift note at the bottom of this file.
//
// FILES: metadata only by design (the API returns no file_path and no signed URL).
// Rows are informational; downloading is a FAST-FOLLOW task (a token-scoped
// signing route reusing validateShareToken). No placeholder button is rendered.

import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
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
import type { PhaseState } from '@/lib/project-progress'

// ── Response shape of GET /api/client-view/[token] ───────────────────────────
interface ClientViewData {
  hero: { name: string | null; projectType: string | null; location: string | null; projectValue: number | null }
  progress: {
    phase: 'precon' | 'construction' | 'completed' | null
    showCjProgress: boolean
    precon: { completedCount: number; total: number; pct: number; currentStep: { step: number; title: string; type: string } | null }
    construction: { available: boolean; doneCount: number; total: number; pct: number; currentStep: { n: number; title: string } | null }
    constructionOverride: { state: PhaseState; description: string } | null
  }
  timeline: {
    preconSteps: { step: number; title: string; type: string }[]
    completedPreconSteps: number[]
    constructionSteps: { n: number; title: string }[] | null
    markedConstructionSteps: number[]
  }
  files: { id: string; file_name: string; file_type: string; file_size: number; uploaded_at: string }[]
  team: { members: { role: string; name: string }[]; hasAnyone: boolean }
  details: { fields: { label: string; value: string }[]; conditions: { show: boolean; values: string[] } }
  footer: { specialistName: string }
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }        // 404 from the route: malformed / unknown / revoked / expired
  | { kind: 'error' }          // anything else: server error, network, non-JSON
  | { kind: 'ready'; data: ClientViewData }

// Minimal shape check at the fetch boundary — enough that a malformed body lands in
// the error state instead of throwing mid-render.
function looksLikeClientView(v: unknown): v is ClientViewData {
  const d = v as Partial<ClientViewData> | null
  return !!d && typeof d === 'object'
    && !!d.hero && !!d.progress && !!d.timeline && Array.isArray(d.files)
    && !!d.team && !!d.details && !!d.footer
}

// Page shell: full-height, page-scoped palette. No fixed overlay is needed here —
// unlike /my-project, there is no app shell to cover.
const shell: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--mp-bg)',
  color: 'var(--mp-ink)',
  fontFamily: BODY,
}

// Static company contact block — the same lines as the approved footer.
function CompanyContact() {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
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
  )
}

function TopBar({ firstName }: { firstName: string }) {
  return (
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
        <img src="/cask-logo-white.svg" alt="CASK Construction" style={{ height: 32, width: 'auto' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {firstName && (
          <span
            style={{
              fontSize: 12, fontWeight: 500, color: '#fff',
              background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.2)',
              borderRadius: 99, padding: '6px 13px', whiteSpace: 'nowrap',
            }}
          >
            Welcome back, {firstName}
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  )
}

// Loading / invalid / error share one centred layout (same pattern as /my-project's
// loading and not-found states).
function CenteredMessage({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mp-root" style={shell}>
      <style dangerouslySetInnerHTML={{ __html: MP_TOKENS }} />
      <TopBar firstName="" />
      <div style={{ display: 'grid', placeItems: 'center', padding: '96px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          {title && (
            <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 300, letterSpacing: '-0.01em', color: 'var(--mp-ink)', marginBottom: 10 }}>
              {title}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ClientViewPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const token = params?.token ?? ''

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/client-view/${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 404) { setState({ kind: 'invalid' }); return }
        if (!res.ok) { setState({ kind: 'error' }); return }
        let body: unknown
        try { body = await res.json() } catch { body = null }
        if (cancelled) return
        setState(looksLikeClientView(body) ? { kind: 'ready', data: body } : { kind: 'error' })
      } catch {
        // Never log anything here: the request URL carries the token.
        if (!cancelled) setState({ kind: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [token])

  if (state.kind === 'loading') {
    return (
      <CenteredMessage>
        <div style={{ fontSize: 13, color: 'var(--mp-ink3)' }}>Loading your project…</div>
      </CenteredMessage>
    )
  }

  if (state.kind === 'invalid' || state.kind === 'error') {
    return (
      <CenteredMessage title={state.kind === 'invalid' ? 'This link is invalid or has expired' : 'We couldn’t load your project'}>
        <div style={{ fontSize: 13.5, color: 'var(--mp-ink2)', lineHeight: 1.6 }}>
          {state.kind === 'invalid'
            ? 'Please contact CASK Construction and we’ll send you a new link.'
            : 'Something went wrong on our side. Please try again in a few minutes, or contact us.'}
        </div>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '0.5px solid var(--mp-line)' }}>
          <CompanyContact />
        </div>
      </CenteredMessage>
    )
  }

  // ── Ready ───────────────────────────────────────────────────────────────────
  const { hero, progress, timeline, files, team, details, footer } = state.data
  const phase = progress.phase
  const showCjProgress = progress.showCjProgress
  const currentStep = progress.precon.currentStep
  const cjCurrentStep = progress.construction.currentStep
  const cjTotal = progress.construction.total
  const cjSteps = timeline.constructionSteps
  const completedSteps = new Set(timeline.completedPreconSteps)
  const cjMarks = new Set(timeline.markedConstructionSteps)
  const firstName = (hero.name ?? '').trim().split(' ')[0] ?? ''

  // "Happening now" — the same four branches, in the same order, as /my-project.
  const ringValue = showCjProgress ? progress.construction.pct : progress.precon.pct
  const happening: { eyebrow: string; title: string; meta: React.ReactNode; ringCaption: string; ringColor: string } =
    currentStep
      ? {
          eyebrow: 'Happening now · Pre-construction',
          title: currentStep.title,
          meta: (
            <>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>Step {pad2(currentStep.step)} of {progress.precon.total}</span>
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
              eyebrow: 'Pre-construction complete',
              title: 'Construction progress is not available right now',
              meta: <span>All {progress.precon.total} pre-construction steps are done — please check back soon.</span>,
              ringCaption: 'Pre-construction',
              ringColor: 'var(--mp-ok)',
            }

  const specialistName = footer.specialistName

  return (
    <div className="mp-root" style={shell}>
      <style dangerouslySetInnerHTML={{ __html: MP_TOKENS }} />
      <TopBar firstName={firstName} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="mp-hero" style={{ marginBottom: 36, paddingTop: 8, fontFamily: BODY }}>
          <HouseSketch />
          <div style={{ position: 'relative', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--mp-ink3)', fontWeight: 500 }}>
            Your project
          </div>
          <h1 style={{ position: 'relative', fontFamily: DISPLAY, fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--mp-ink)', lineHeight: 1.04, margin: '14px 0 0' }} className="mp-hero-name">
            {hero.name}
          </h1>
          {hero.projectType && (
            <div style={{ position: 'relative', fontFamily: DISPLAY, fontSize: 26, fontWeight: 300, fontStyle: 'italic', color: 'var(--mp-ink2)', lineHeight: 1.2, marginTop: 6 }}>
              {hero.projectType}
            </div>
          )}
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 13, color: 'var(--mp-ink3)', letterSpacing: '0.01em' }}>
            {hero.location && <span>{hero.location}</span>}
            {hero.location && fmtCurrency(hero.projectValue) && <span aria-hidden="true">·</span>}
            {fmtCurrency(hero.projectValue) && (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(hero.projectValue)}</span>
            )}
          </div>
        </div>

        {/* ── Happening now ────────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--mp-surface)', border: '0.5px solid var(--mp-line)', borderRadius: 16,
            padding: '26px 28px 24px', marginBottom: 20, fontFamily: BODY,
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
              <div style={{ fontSize: 12, color: 'var(--mp-ink3)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                {showCjProgress ? progress.construction.doneCount : progress.precon.completedCount} of {showCjProgress ? cjTotal : progress.precon.total} {showCjProgress ? 'construction steps complete' : 'steps complete'}
              </div>
            </div>
            <ProgressRing value={ringValue} color={happening.ringColor} caption={happening.ringCaption} />
          </div>

          <div className="mp-phases" style={{ marginTop: 26, paddingTop: 22, borderTop: '0.5px solid var(--mp-line)' }}>
            <PhaseTracker
              completed={completedSteps}
              currentStepNumber={currentStep?.step ?? null}
              constructionOverride={progress.constructionOverride ?? undefined}
              constructionFill={showCjProgress ? progress.construction.pct / 100 : null}
            />
          </div>
        </div>

        {/* ── Project timeline ─────────────────────────────────────────── */}
        <div style={{ ...CARD, marginBottom: 20 }}>
          <div style={SECTION_HEADER}>
            <span style={SECTION_TITLE}>Project timeline</span>
            <span style={SECTION_META}>
              {showCjProgress
                ? `${cjTotal} construction steps total`
                : phase === null
                  ? 'Construction'
                  : <>{progress.precon.total} steps total</>}
            </span>
          </div>
          {showCjProgress && cjSteps ? (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
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
            <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
              Construction progress is not available right now — please check back soon.
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {timeline.preconSteps.map((s, i) => timelineRow({
                stepNumber: s.step,
                title: s.title,
                done: completedSteps.has(s.step),
                isCurrent: currentStep?.step === s.step,
                last: i === timeline.preconSteps.length - 1,
                badge: <TypeBadge type={s.type} />,
              }))}
            </div>
          )}
        </div>

        {/* ── Your project files (informational only — no download yet) ── */}
        <div style={{ ...MP_CARD, marginBottom: 20 }}>
          <div style={MP_CARD_HEADER}>
            <span style={MP_CARD_TITLE}>Your project files</span>
          </div>
          {files.length === 0 ? (
            <div style={{ padding: '20px 24px', fontSize: 13, color: 'var(--mp-ink3)', lineHeight: 1.6 }}>
              No files have been shared yet — your project documents will appear here once
              your CASK team uploads them.
            </div>
          ) : (
            <>
              {files.map((file, i) => {
                const dateLabel = file.uploaded_at
                  ? new Date(file.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : ''
                return (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 24px',
                      borderTop: i === 0 ? undefined : '0.5px solid var(--mp-line)',
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(file.file_type, file.file_name)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--mp-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.file_name}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 11.5, color: 'var(--mp-ink3)' }}>
                        <span>{fmtFileSize(file.file_size)}</span>
                        {dateLabel && <span>· {dateLabel}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div style={{ padding: '12px 24px 16px', borderTop: '0.5px solid var(--mp-line)', fontSize: 12, color: 'var(--mp-ink3)' }}>
                Need a copy of a file? Contact {specialistName || 'your Project Specialist'} and we&apos;ll send it over.
              </div>
            </>
          )}
        </div>

        {/* ── Your team ────────────────────────────────────────────────── */}
        <div style={{ ...MP_CARD, marginBottom: 20 }}>
          <div style={MP_CARD_HEADER}>
            <span style={MP_CARD_TITLE}>Your team</span>
          </div>
          {team.hasAnyone ? (
            <div>
              {team.members.map((m, i) => {
                const assigned = m.name !== ''
                return (
                  <div
                    key={m.role}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderTop: i === 0 ? undefined : '0.5px solid var(--mp-line)' }}
                  >
                    {assigned ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                          background: 'var(--mp-accent-soft)', color: 'var(--mp-accent)',
                          fontFamily: DISPLAY, fontSize: 15, fontWeight: 400, letterSpacing: '0.02em',
                        }}
                      >
                        {personInitials(m.name)}
                      </span>
                    ) : (
                      <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: '1px dashed var(--mp-line)' }} />
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

        {/* ── Project details ──────────────────────────────────────────── */}
        <div style={{ ...MP_CARD, marginBottom: 20 }}>
          <div style={MP_CARD_HEADER}>
            <span style={MP_CARD_TITLE}>Project details</span>
          </div>
          <div className="mp-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px', padding: '20px 24px' }}>
            {details.fields.map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mp-ink3)' }}>{f.label}</span>
                {f.value ? (
                  <span style={{ fontSize: 14, color: 'var(--mp-ink)', lineHeight: 1.45, wordBreak: 'break-word' }}>{f.value}</span>
                ) : (
                  <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--mp-ink3)', lineHeight: 1.45 }}>Not yet confirmed</span>
                )}
              </div>
            ))}
          </div>
          {details.conditions.show && (
            <div style={{ padding: '16px 24px 20px', borderTop: '0.5px solid var(--mp-line)' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mp-ink3)', marginBottom: 10 }}>
                Special conditions
              </div>
              {details.conditions.values.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {details.conditions.values.map(cond => (
                    <span key={cond} style={{ fontSize: 12.5, color: 'var(--mp-ink)', lineHeight: 1.3, border: '0.5px solid var(--mp-line)', borderRadius: 99, padding: '5px 12px' }}>
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

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginTop: 44, fontFamily: BODY }}>
          <div style={{ fontSize: 13, color: 'var(--mp-ink2)' }}>Questions about your project?</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 300, letterSpacing: '-0.01em', color: 'var(--mp-ink)', marginTop: 6, lineHeight: 1.3 }}>
            {specialistName
              ? <>Contact {specialistName}, your Project Specialist</>
              : <>Contact your Project Specialist · CASK Construction</>}
          </div>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '0.5px solid var(--mp-line)', maxWidth: 360, marginInline: 'auto' }}>
            <CompanyContact />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}>Powered by CASK Hub</div>
        </div>
      </div>
    </div>
  )
}

// DRIFT NOTE: the section JSX above mirrors /my-project's section by section, fed by
// the API response instead of page state. The shared COMPONENTS are one copy; the
// section MARKUP is two. Extracting each section (Hero, HappeningNow, Timeline,
// Team, Details, Footer) into shared.tsx and rendering it from both pages is the
// natural follow-up — it was out of scope here because it changes my-project's JSX.
