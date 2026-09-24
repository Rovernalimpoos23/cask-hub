// src/components/project-view/shared.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Presentational building blocks for the project status view, shared by:
//   * src/app/(app)/my-project/page.tsx      — staff preview (session + Supabase)
//   * src/app/client-view/[token]/page.tsx   — customer view (token + API route)
//
// Moved VERBATIM from my-project/page.tsx (2026-09-25). Only `export` was added to
// each declaration; no markup, style value or logic changed. Pure presentation: no
// hooks, no data access, no browser APIs — safe to render from any client page.
//
// Theming: MP_TOKENS must be rendered once inside an element carrying the
// `mp-root` class (see either page). The `.dark` switch is the app's own theme
// mechanism from the root layout (ThemeToggle / useTheme), not anything here.
// ──────────────────────────────────────────────────────────────────────────────

import type { PhaseState } from '@/lib/project-progress'

// Editorial treatment for the hero / "Happening now" card / phase tracker. Both fonts
// are ALREADY loaded app-wide by src/app/layout.tsx as CSS variables (--font-fraunces,
// --font-inter), so nothing new is fetched. The global Fraunces is the variable-weight
// build, which is what allows the lighter 300 display weight that my-project's local
// next/font instance (400/500 only) cannot render. my-project's older sections still
// use its local SERIF / DM Sans until their own restyle.
export const DISPLAY = 'var(--font-fraunces), Georgia, serif'
export const BODY = 'var(--font-inter), system-ui, sans-serif'

// Page-scoped palette. Theme switching is the APP's existing mechanism — the `.dark`
// class on <html>, toggled by ThemeToggle / useTheme (sessionStorage) — not a second
// data-theme + localStorage system, which would fight it. Dark mode maps straight onto
// the existing globals.css tokens (--bg #121110, --red #F0565E, …); only the warm-ivory
// light values are new, since globals.css defines no ivory family.
export const MP_TOKENS = `
  .mp-root {
    --mp-bg: #FAF8F5;
    --mp-surface: #FFFFFF;
    --mp-line: #E9E3DA;
    --mp-ink: #1C1917;
    --mp-ink2: #6B635A;
    --mp-ink3: #A0978B;
    --mp-sketch: #D9D1C5;
    --mp-accent: var(--red);
    --mp-accent-soft: rgba(200, 49, 26, 0.12);
    --mp-ok: #22c55e;
    /* Phase tracker, UPCOMING state only. Light mode = the shared tokens exactly
       (no visual change); dark mode raises them below. */
    --mp-phase-upcoming-text: var(--mp-ink3);
    --mp-phase-upcoming-track: var(--mp-line);
  }
  .dark .mp-root {
    --mp-bg: var(--bg);
    --mp-surface: var(--surface);
    --mp-line: var(--border);
    --mp-ink: var(--text);
    --mp-ink2: var(--text2);
    --mp-ink3: var(--text3);
    --mp-sketch: rgba(255, 255, 255, 0.12);
    --mp-accent: var(--red);
    --mp-accent-soft: rgba(240, 86, 94, 0.16);
    --mp-ok: #59B87E;
    /* Dark-mode legibility for upcoming phases, measured on the card (--surface
       #1A1918): text #908F8B = 5.42:1 (AA for small text; the shared --text3
       #7B7A77 was 4.09:1), still below the active description (--text2, 7.29:1) and
       label (--text, 14.73:1). Track white @ 0.34 = 3.12:1 (the UI-graphic 3:1
       bar; the shared --border @ 0.09 was 1.30:1). */
    --mp-phase-upcoming-text: #908F8B;
    --mp-phase-upcoming-track: rgba(255, 255, 255, 0.34);
  }
  .mp-hero { position: relative; }
  .mp-house { position: absolute; right: 0; top: 4px; pointer-events: none; }
  .mp-hero-name { max-width: calc(100% - 150px); }
  @media (max-width: 600px) { .mp-house { display: none; } .mp-hero-name { max-width: none; } }
  @media (max-width: 560px) {
    .mp-now { flex-direction: column-reverse; align-items: flex-start !important; }
    .mp-phases > div { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; row-gap: 18px !important; }
    .mp-details { grid-template-columns: 1fr !important; }
  }
`

// ── Step type → badge styling (per brief) ────────────────────────────────────
export const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  internal: { label: 'Internal', bg: 'var(--purple-bg)', color: '#4c1d95' },
  window: { label: 'Work Window', bg: 'var(--amber-bg)', color: '#78350f' },
  customer: { label: 'Customer', bg: 'var(--red-soft)', color: '#7f1d1d' },
}

export function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_BADGE[type] ?? TYPE_BADGE.internal
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.03em',
        color: cfg.color,
        background: cfg.bg,
        padding: '2px 7px',
        borderRadius: 5,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Phase progress tracker (NEW, additive) ────────────────────────────────────
// 4 major milestone phases mapped onto the 37 workflow steps. CSS-var mapping
// follows the same convention documented at the top of this file:
//   --text-muted → --text3 · --text-primary → --text · --text-secondary → --text2
//   --surface-1 → --surface2 · --border-strong → --border2
export interface PhaseDef { label: string; steps: number[]; description: string }

export const PHASES: PhaseDef[] = [
  { label: 'Design & Planning', steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], description: 'Meetings, drawings & design decisions' },
  { label: 'Permit', steps: [17, 18, 19, 20, 21], description: 'Permit submission & approval' },
  { label: 'Contract & Selections', steps: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], description: 'Contract signing & material selections' },
  { label: 'Construction', steps: [37], description: 'Building your home' },
]

export function getPhaseState(phase: PhaseDef, completed: Set<number>, currentStepNumber: number | null): PhaseState {
  if (phase.steps.every(s => completed.has(s))) return 'done'
  if (currentStepNumber != null && phase.steps.includes(currentStepNumber)) return 'active'
  return 'upcoming'
}

// constructionOverride: supplied only once pre-con is complete, when the last entry
// ("Construction", mapped above to pre-con step 37 only) must report the REAL
// Construction Journey instead. Omitted → every state and description is computed
// exactly as before, so a pre-con client's tracker is unchanged.
// Rendering: one horizontal bar per phase. The STATE of each bar is computed exactly
// as before (getPhaseState / constructionOverride — unchanged). Only the fill amount
// is display-derived here:
//   done     → 100%
//   upcoming → 0%
//   active   → the share of THAT phase's own steps already complete. For the last
//              entry once pre-con is done this is `constructionFill` (the page's
//              existing cjPct / 100); null when construction data is unavailable,
//              which draws the highlighted track with no fill rather than a guess.
export function PhaseTracker({ completed, currentStepNumber, constructionOverride, constructionFill }: {
  completed: Set<number>
  currentStepNumber: number | null
  constructionOverride?: { state: PhaseState; description: string }
  constructionFill?: number | null
}) {
  const lastIdx = PHASES.length - 1
  const states = PHASES.map((p, i) =>
    constructionOverride && i === lastIdx ? constructionOverride.state : getPhaseState(p, completed, currentStepNumber)
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PHASES.length}, minmax(0, 1fr))`, gap: 14 }}>
      {PHASES.map((phase, i) => {
        const state = states[i]
        const isOverridden = !!constructionOverride && i === lastIdx
        const fill =
          state === 'done' ? 1
          : state === 'upcoming' ? 0
          : isOverridden ? (constructionFill ?? 0)
          : phase.steps.filter(s => completed.has(s)).length / phase.steps.length

        const labelColor = state === 'upcoming' ? 'var(--mp-phase-upcoming-text)' : 'var(--mp-ink)'
        return (
          <div key={phase.label} style={{ minWidth: 0 }}>
            {/* Bar */}
            <div
              style={{
                height: 4,
                borderRadius: 99,
                overflow: 'hidden',
                background: state === 'active' ? 'var(--mp-accent-soft)' : state === 'upcoming' ? 'var(--mp-phase-upcoming-track)' : 'var(--mp-line)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(fill * 100)}%`,
                  borderRadius: 99,
                  background: state === 'done' ? 'var(--mp-ok)' : 'var(--mp-accent)',
                  transition: 'width 500ms ease',
                }}
              />
            </div>

            {/* Label + state + description */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: state === 'active' ? 600 : 500, color: labelColor, lineHeight: 1.3 }}>
                  {phase.label}
                </span>
                {state === 'active' && (
                  <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mp-accent)' }}>
                    Current
                  </span>
                )}
                {state === 'done' && (
                  <span aria-label="complete" style={{ fontSize: 11, color: 'var(--mp-ok)' }}>✓</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: state === 'active' ? 'var(--mp-ink2)' : state === 'upcoming' ? 'var(--mp-phase-upcoming-text)' : 'var(--mp-ink3)', marginTop: 3, lineHeight: 1.4 }}>
                {isOverridden && constructionOverride ? constructionOverride.description : phase.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Circular progress ring for the "Happening now" card. Purely presentational: the
// percentage is passed in already computed (see the call site for what it means).
export function ProgressRing({ value, color, caption }: { value: number; color: string; caption: string }) {
  const size = 104
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mp-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 300, color: 'var(--mp-ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {clamped}%
          </div>
          <div style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mp-ink3)', marginTop: 4 }}>
            {caption}
          </div>
        </div>
      </div>
    </div>
  )
}

// Decorative architectural accent for the hero — thin-stroke house outline.
export function HouseSketch() {
  return (
    <svg
      className="mp-house"
      aria-hidden="true"
      focusable="false"
      width="170" height="120" viewBox="0 0 170 120" fill="none"
      stroke="var(--mp-sketch)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
    >
      {/* ground */}
      <line x1="4" y1="112" x2="166" y2="112" />
      {/* main volume + roof */}
      <polyline points="22,112 22,56 70,20 118,56 118,112" />
      <line x1="14" y1="62" x2="70" y2="20" />
      <line x1="70" y1="20" x2="126" y2="62" />
      {/* chimney */}
      <polyline points="94,38 94,24 104,24 104,46" />
      {/* door */}
      <rect x="60" y="80" width="20" height="32" />
      {/* windows */}
      <rect x="32" y="68" width="18" height="16" />
      <line x1="41" y1="68" x2="41" y2="84" />
      <rect x="90" y="68" width="18" height="16" />
      <line x1="99" y1="68" x2="99" y2="84" />
      {/* garage wing */}
      <polyline points="118,112 118,74 158,74 158,112" />
      <line x1="114" y1="76" x2="162" y2="76" />
      <line x1="126" y1="86" x2="150" y2="86" />
      <line x1="126" y1="94" x2="150" y2="94" />
      <line x1="126" y1="102" x2="150" y2="102" />
    </svg>
  )
}

// ── Team / Project details cards (C1 styling: page-scoped --mp-* tokens) ─────────
export const MP_CARD: React.CSSProperties = {
  background: 'var(--mp-surface)',
  border: '0.5px solid var(--mp-line)',
  borderRadius: 16,
  overflow: 'hidden',
  fontFamily: BODY,
}
export const MP_CARD_HEADER: React.CSSProperties = {
  padding: '18px 24px 14px',
  borderBottom: '0.5px solid var(--mp-line)',
}
export const MP_CARD_TITLE: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 20,
  fontWeight: 300,
  letterSpacing: '-0.01em',
  color: 'var(--mp-ink)',
}

// Avatar initials from a real name: first + last word, or the first two letters of
// a single word. Only ever called with a non-empty trimmed name.
export function personInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

// NEW (additive): human-readable file size + icon for the Your Project Files list.
export function fmtFileSize(bytes: number): string {
  if (bytes == null || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function fileIcon(type: string, name: string): string {
  const t = (type || '').toLowerCase()
  const n = (name || '').toLowerCase()
  if (t.includes('image') || /\.(jpe?g|png|gif|webp)$/.test(n)) return '🖼'
  if (t.includes('sheet') || t.includes('excel') || /\.(xlsx?|csv)$/.test(n)) return '📊'
  return '📄'
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

// ── Shared style fragments ────────────────────────────────────────────────────
export const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  overflow: 'hidden',
}
export const SECTION_HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  padding: '16px 20px',
  borderBottom: '0.5px solid var(--border)',
}
export const SECTION_TITLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text2)',
}
export const SECTION_META: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text3)',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}
export const STEP_PILL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#fff',
  background: '#1a1917',
  borderRadius: 5,
  padding: '3px 7px',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// One Project Timeline row. Shared by the pre-con list (its original markup, moved
// here verbatim) and the Construction list, so both journeys highlight done/current
// steps identically. `badge` renders for done/current rows only, exactly as the
// pre-con TypeBadge always did; Construction passes null (see the call site).
export function timelineRow({ stepNumber, title, done, isCurrent, last, badge }: {
  stepNumber: number
  title: string
  done: boolean
  isCurrent: boolean
  last: boolean
  badge: React.ReactNode
}) {
  return (
    <div
      key={stepNumber}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 20px',
        borderBottom: last ? undefined : '0.5px solid var(--border)',
        background: isCurrent ? 'var(--surface2)' : 'transparent',
      }}
    >
      {/* Dot indicator */}
      {done ? (
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
      ) : isCurrent ? (
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#1a1917', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
      ) : (
        <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--border2)', flexShrink: 0 }} />
      )}

      {/* Step number */}
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', width: 20, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {pad2(stepNumber)}
      </span>

      {/* Title */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: isCurrent ? 600 : 400,
          color: done ? 'var(--text3)' : 'var(--text)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {title}
      </span>

      {/* Badge: type for done/current, "You are here" for current; nothing for future */}
      {isCurrent && (
        <span style={{ ...STEP_PILL, fontSize: 9.5 }}>You are here</span>
      )}
      {(done || isCurrent) && badge}
    </div>
  )
}

