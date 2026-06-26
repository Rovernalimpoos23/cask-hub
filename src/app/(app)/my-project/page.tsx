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
// 3. AGENDA_SECTIONS / SPECIAL_CONDITIONS are inlined (read-only copy) because they
//    are not exported from customers/[id]/page.tsx and we must not modify that file
//    beyond adding the single preview button.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Fraunces, DM_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase'
import { WORKFLOW_STEPS, TOTAL_WORKFLOW_STEPS } from '@/lib/workflow-steps'

// ── Fonts (per brief): Fraunces for headings/large numbers, DM Sans for body ──
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

const SERIF = fraunces.style.fontFamily

// ── Step type → badge styling (per brief) ────────────────────────────────────
const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  internal: { label: 'Internal', bg: '#ede9fe', color: '#4c1d95' },
  window: { label: 'Work Window', bg: '#fef3c7', color: '#78350f' },
  customer: { label: 'Customer', bg: '#fee2e2', color: '#7f1d1d' },
}

function TypeBadge({ type }: { type: string }) {
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
// 4 major milestone phases mapped onto the 33 workflow steps. CSS-var mapping
// follows the same convention documented at the top of this file:
//   --text-muted → --text3 · --text-primary → --text · --text-secondary → --text2
//   --surface-1 → --surface2 · --border-strong → --border2
interface PhaseDef { label: string; steps: number[]; description: string }

const PHASES: PhaseDef[] = [
  { label: 'Design & Planning', steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], description: 'Meetings, drawings & design decisions' },
  { label: 'Permit', steps: [14, 15, 16], description: 'Permit submission & approval' },
  { label: 'Contract & Selections', steps: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32], description: 'Contract signing & material selections' },
  { label: 'Construction', steps: [33], description: 'Building your home' },
]

type PhaseState = 'done' | 'active' | 'upcoming'

function getPhaseState(phase: PhaseDef, completed: Set<number>, currentStepNumber: number | null): PhaseState {
  if (phase.steps.every(s => completed.has(s))) return 'done'
  if (currentStepNumber != null && phase.steps.includes(currentStepNumber)) return 'active'
  return 'upcoming'
}

function PhaseTracker({ completed, currentStepNumber }: { completed: Set<number>; currentStepNumber: number | null }) {
  const states = PHASES.map(p => getPhaseState(p, completed, currentStepNumber))

  // A connector (the segment to a phase's RIGHT) is solid green when the phase on
  // its LEFT is done; otherwise it's a dashed gray line. Each phase draws its own
  // left + right half so the halves of one connector always match.
  const solidLine: React.CSSProperties = { flex: 1, height: 2, background: '#22c55e' }
  const dashedLine: React.CSSProperties = { flex: 1, height: 0, borderTop: '2px dashed var(--border2)' }
  const blankLine: React.CSSProperties = { flex: 1, height: 2, background: 'transparent' }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', margin: '20px 0' }}>
      <style>{`
        @keyframes myProjectPhasePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(26,25,23,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(26,25,23,0); }
        }
      `}</style>
      {PHASES.map((phase, i) => {
        const state = states[i]
        const leftDone = i > 0 ? states[i - 1] === 'done' : false
        const rightDone = state === 'done'
        const leftStyle = i === 0 ? blankLine : leftDone ? solidLine : dashedLine
        const rightStyle = i === PHASES.length - 1 ? blankLine : rightDone ? solidLine : dashedLine

        const circleBase: React.CSSProperties = {
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
        }
        let circle: React.CSSProperties
        let inner: React.ReactNode = null
        if (state === 'done') {
          circle = { ...circleBase, background: '#22c55e', border: 'none' }
          inner = <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>
        } else if (state === 'active') {
          circle = { ...circleBase, background: '#1a1917', border: 'none', animation: 'myProjectPhasePulse 2s ease-in-out infinite' }
          inner = <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
        } else {
          circle = { ...circleBase, background: 'var(--surface2)', border: '1.5px solid var(--border)' }
        }

        const labelColor = state === 'done' ? '#15803d' : state === 'active' ? 'var(--text)' : 'var(--text3)'
        const labelWeight = state === 'done' ? 600 : state === 'active' ? 700 : 400
        const descColor = state === 'active' ? 'var(--text2)' : 'var(--text3)'

        return (
          <div key={phase.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
            {/* Circle + connector halves on the same horizontal line */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={leftStyle} />
              <div style={circle}>{inner}</div>
              <div style={rightStyle} />
            </div>

            {/* Label + optional CURRENT badge + description */}
            <div style={{ textAlign: 'center', marginTop: 8, paddingInline: 4 }}>
              <div style={{ fontSize: 11, fontWeight: labelWeight, color: labelColor, lineHeight: 1.25 }}>
                {phase.label}
              </div>
              {state === 'active' && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 9, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Current
                  </span>
                </div>
              )}
              <div style={{ fontSize: 10, color: descColor, marginTop: 2, lineHeight: 1.3, opacity: state === 'upcoming' ? 0.6 : 1 }}>
                {phase.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Standing-agenda data (read-only inline copy — see note 3) ─────────────────
interface CustomerAgendaQuestion { key: string; text: string }
interface CustomerAgendaSection { code: string; name: string; questions: CustomerAgendaQuestion[] }

const AGENDA_SECTIONS: CustomerAgendaSection[] = [
  { code: '01 00 00', name: 'General Requirements', questions: [
    { key: 'sign_placement', text: 'Construction sign placement — where can it be staked for visibility?' },
    { key: 'site_access', text: 'Site access — how will construction vehicles and deliveries reach the site?' },
    { key: 'permitting_path', text: 'Permitting path — municipality, expeditor needed, anticipated review timeline?' },
  ]},
  { code: '02 00 00', name: 'Existing Conditions', questions: [
    { key: 'trees_landscaping', text: 'Trees or landscaping that affect the project — any to be removed or protected?' },
    { key: 'existing_structures', text: 'Existing structures to demolish (full or selective)? Describe scope.' },
    { key: 'existing_driveway', text: 'Existing driveway / pavers / hardscape to remove?' },
  ]},
  { code: '03 00 00', name: 'Concrete', questions: [
    { key: 'foundation_type', text: 'Foundation type for site conditions (slab, stem wall, elevated/coastal)?' },
    { key: 'wall_type', text: 'Wall type / material — block vs. wood by floor' },
    { key: 'driveway_surface', text: 'Driveway surface selection' },
    { key: 'parking_pad', text: 'Parking pad / apron surface selection' },
    { key: 'swale_drainage', text: 'Swale / drainage grading' },
  ]},
  { code: '06 00 00', name: 'Wood, Plastics & Composites', questions: [
    { key: 'num_stories', text: 'Number of stories / floors (drives framing, pilings, structure cost)?' },
    { key: 'ceiling_height', text: 'Floor-to-ceiling height — by floor?' },
    { key: 'pilings', text: 'Elevated foundation pilings required (coastal / flood)? Engineered depth?' },
    { key: 'roof_structure', text: 'Roof structure — vaulted or not vaulted?' },
    { key: 'staircase', text: 'Staircase & railing — any upgrade?' },
    { key: 'decking', text: 'Decking material — do they want Trex?' },
    { key: 'deck_columns', text: 'Wrap the deck columns with siding?' },
  ]},
  { code: '07 00 00', name: 'Thermal & Moisture Protection', questions: [
    { key: 'roof_system', text: 'Roof system selection' },
    { key: 'insulation', text: 'Insulation approach' },
    { key: 'garage_insulation', text: 'Does the garage need to be insulated?' },
    { key: 'gutters', text: 'Gutters — always included; which type?' },
  ]},
  { code: '08 00 00', name: 'Openings', questions: [
    { key: 'window_color', text: 'Window color & brand' },
    { key: 'window_style', text: 'Window style' },
    { key: 'frosted_glass', text: 'Frosted glass in the bathroom?' },
    { key: 'garage_door', text: 'Garage door — included? Height & insulation?' },
    { key: 'screened_porch', text: 'Screened porch — in scope?' },
    { key: 'exterior_doors', text: 'Exterior doors — glass & height?' },
    { key: 'interior_doors', text: 'Interior door height?' },
  ]},
  { code: '09 00 00', name: 'Finishes', questions: [
    { key: 'wall_texture', text: 'Wall & ceiling texture' },
    { key: 'garage_drywall', text: 'Garage drywall — finish the garage?' },
    { key: 'flooring', text: 'Flooring — LVP is included throughout. Upgrade?' },
    { key: 'backsplash', text: 'Backsplash — included?' },
    { key: 'paint', text: 'Paint — any extra paint scope (e.g. main house)?' },
    { key: 'window_casing', text: 'Casing around the windows?' },
  ]},
  { code: '10 00 00', name: 'Specialties', questions: [
    { key: 'shower_glass', text: 'Shower / tub glass — do they want custom?' },
  ]},
  { code: '11 00 00', name: 'Equipment', questions: [
    { key: 'appliances', text: 'Appliance package — include all appliances + washer & dryer?' },
  ]},
  { code: '12 00 00', name: 'Furnishings', questions: [
    { key: 'cabinet_construction', text: 'Cabinet construction' },
    { key: 'cabinet_style', text: 'Cabinet style' },
    { key: 'vanity', text: 'Vanity' },
    { key: 'countertop', text: 'Countertop material' },
    { key: 'kitchen_sink', text: 'Kitchen sink' },
    { key: 'bathroom_sink', text: 'Bathroom sink' },
  ]},
  { code: '22 00 00', name: 'Plumbing', questions: [
    { key: 'laundry_location', text: 'Laundry location — where do washer/dryer go?' },
    { key: 'water_heater', text: 'Water heater' },
    { key: 'plumbing_fixtures', text: 'Plumbing fixtures' },
    { key: 'gas_service', text: 'Gas service — in scope for this project?' },
    { key: 'water_utility', text: 'Water utility — connection & metering' },
  ]},
  { code: '23 00 00', name: 'HVAC', questions: [
    { key: 'hvac_type', text: 'HVAC system type & efficiency goal?' },
    { key: 'air_handler', text: 'Air handler location?' },
    { key: 'kitchen_hood', text: 'Kitchen hood' },
  ]},
  { code: '26 00 00', name: 'Electrical', questions: [
    { key: 'electrical_meter', text: 'Electrical meter configuration' },
    { key: 'elevator', text: 'Elevator — in scope?' },
    { key: 'light_fixtures', text: 'Light fixtures' },
    { key: 'special_electrical', text: 'Special electrical' },
  ]},
]

// Canonical special-condition values (must match stored values for the read-only
// checkmarks to reflect saved selections).
const SPECIAL_CONDITIONS = [
  'Historic district / overlay',
  'Coastal construction control line',
  'Flood zone',
  'None of these',
]

// ── Data shapes ───────────────────────────────────────────────────────────────
interface ClientRow {
  id: string
  name: string
  project_type: string | null
  location: string | null
  project_value: number | null
  email: string | null
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

interface AgendaAnswerEntry { answer: string; selected_options: string[] }

function agendaKey(sectionCode: string, questionKey: string) {
  return `${sectionCode}||${questionKey}`
}

// selected_options may arrive as an array or a JSON string — normalize.
function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return raw.trim() ? [raw] : []
    }
  }
  return []
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function fmtMaybeDate(value: string | null | undefined): string {
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

// ── Shared style fragments ────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  overflow: 'hidden',
}
const SECTION_HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  padding: '16px 20px',
  borderBottom: '0.5px solid var(--border)',
}
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text2)',
}
const SECTION_META: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text3)',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}
const STEP_PILL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#fff',
  background: '#1a1917',
  borderRadius: 5,
  padding: '3px 7px',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export default function MyProjectPage() {
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<ClientRow | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [agendaHeader, setAgendaHeader] = useState<AgendaHeaderRow | null>(null)
  const [answers, setAnswers] = useState<Map<string, AgendaAnswerEntry>>(new Map())
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      try {
        // 1. Current logged-in user.
        const { data: { user } } = await supabase.auth.getUser()

        // 2. Match a client by email. (maybeSingle avoids throwing when there's no
        //    row — the brief's .single() would error in that case.)
        let clientRow: ClientRow | null = null
        if (user?.email) {
          const { data } = await supabase.from('clients').select('*').eq('email', user.email).maybeSingle()
          clientRow = (data as ClientRow | null) ?? null
        }

        // 3. Demo fallback → John Smith.
        if (!clientRow) {
          const { data } = await supabase.from('clients').select('*').eq('name', 'John Smith').maybeSingle()
          clientRow = (data as ClientRow | null) ?? null
        }

        if (!clientRow) {
          setClient(null)
          setLoading(false)
          return
        }
        setClient(clientRow)

        // 4-6. Completed steps, agenda header, agenda answers — in parallel.
        const [{ data: completions }, { data: header }, { data: agendaAnswers }] = await Promise.all([
          supabase.from('workflow_step_completions').select('step_number').eq('client_id', clientRow.id),
          supabase.from('client_agenda_header').select('*').eq('client_id', clientRow.id).maybeSingle(),
          supabase.from('client_standing_agenda').select('*').eq('client_id', clientRow.id),
        ])

        setCompletedSteps(new Set((completions ?? []).map((c: { step_number: number }) => c.step_number)))
        setAgendaHeader((header as AgendaHeaderRow | null) ?? null)

        const map = new Map<string, AgendaAnswerEntry>()
        for (const r of (agendaAnswers ?? []) as { section_code: string; question_key: string; answer: string | null; selected_options: unknown }[]) {
          map.set(agendaKey(r.section_code, r.question_key), {
            answer: r.answer ?? '',
            selected_options: normalizeOptions(r.selected_options),
          })
        }
        setAnswers(map)
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
  const completedCount = WORKFLOW_STEPS.filter(s => completedSteps.has(s.step)).length
  const pct = TOTAL_WORKFLOW_STEPS > 0 ? Math.round((completedCount / TOTAL_WORKFLOW_STEPS) * 100) : 0
  const currentStep = WORKFLOW_STEPS.find(s => !completedSteps.has(s.step)) ?? null

  const headerFields: { label: string; value: string }[] = [
    { label: 'Project Name', value: agendaHeader?.project_name ?? '' },
    { label: 'Project Address', value: agendaHeader?.project_address ?? '' },
    { label: 'Architect', value: agendaHeader?.architect ?? '' },
    { label: 'Project Specialist', value: agendaHeader?.project_specialist ?? '' },
    { label: 'Estimator', value: agendaHeader?.estimator ?? '' },
    { label: 'Target Permit Date', value: fmtMaybeDate(agendaHeader?.target_permit_date) },
    { label: 'Homeowners', value: agendaHeader?.homeowners ?? '' },
    { label: 'Zoning', value: agendaHeader?.zoning ?? '' },
  ]
  const selectedConditions = agendaHeader?.special_conditions ?? []

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

  return (
    <div className={dmSans.className} style={{ ...overlay, fontFamily: dmSans.style.fontFamily }}>
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
      </div>

      {/* Centered content column */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* ── SECTION 2 — Hero ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text2)',
              fontWeight: 500,
            }}
          >
            Your project
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, color: 'var(--text)', lineHeight: 1.1, margin: '8px 0 0' }}>
            {client.name}
          </h1>
          {client.project_type && (
            <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, color: 'var(--text2)', lineHeight: 1.1 }}>
              {client.project_type}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--text2)' }}>
            {client.location && <span>{client.location}</span>}
            {client.location && fmtCurrency(client.project_value) && (
              <span style={{ color: 'var(--text3)' }}>·</span>
            )}
            {fmtCurrency(client.project_value) && (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(client.project_value)}</span>
            )}
          </div>
        </div>

        {/* ── SECTION 3 — Progress card ────────────────────────────────────── */}
        <div style={{ ...CARD, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ ...SECTION_TITLE }}>Project progress</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 400, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {completedCount} of {TOTAL_WORKFLOW_STEPS}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6 }}>steps complete</div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--green)',
                background: 'var(--green-bg)',
                border: '0.5px solid var(--pill-green-border)',
                borderRadius: 99,
                padding: '5px 11px',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pct}% complete
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, marginTop: 18, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#22c55e', borderRadius: 99, transition: 'width 500ms ease' }} />
          </div>

          {/* NEW (additive): 4-phase milestone tracker */}
          <PhaseTracker completed={completedSteps} currentStepNumber={currentStep?.step ?? null} />

          {/* Current step row */}
          {currentStep ? (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <span style={STEP_PILL}>STEP {pad2(currentStep.step)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{currentStep.title}</span>
              <TypeBadge type={currentStep.type} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>← You are here</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <span style={{ ...STEP_PILL, background: '#22c55e' }}>DONE</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>All steps complete — your project journey is finished.</span>
            </div>
          )}
        </div>

        {/* ── SECTION 4 — Project Timeline ─────────────────────────────────── */}
        <div style={{ ...CARD, marginBottom: 20 }}>
          <div style={SECTION_HEADER}>
            <span style={SECTION_TITLE}>Project timeline</span>
            <span style={SECTION_META}>{TOTAL_WORKFLOW_STEPS} steps total</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {WORKFLOW_STEPS.map((s, i) => {
              const done = completedSteps.has(s.step)
              const isCurrent = currentStep?.step === s.step
              const last = i === WORKFLOW_STEPS.length - 1
              return (
                <div
                  key={s.step}
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
                    {pad2(s.step)}
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
                    {s.title}
                  </span>

                  {/* Badge: type for done/current, "You are here" for current; nothing for future */}
                  {isCurrent && (
                    <span style={{ ...STEP_PILL, fontSize: 9.5 }}>You are here</span>
                  )}
                  {(done || isCurrent) && <TypeBadge type={s.type} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SECTION 5 — Project Details (Standing Agenda, read-only) ──────── */}
        <div style={{ ...CARD, marginBottom: 20 }}>
          <div style={SECTION_HEADER}>
            <span style={SECTION_TITLE}>Project details</span>
            <span style={SECTION_META}>Standing agenda</span>
          </div>

          {/* Project info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', padding: '18px 20px', borderBottom: '0.5px solid var(--border)' }}>
            {headerFields.map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  {f.label}
                </span>
                <span style={{ fontSize: 13, color: f.value ? 'var(--text)' : 'var(--text3)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {f.value || 'Not yet confirmed'}
                </span>
              </div>
            ))}
          </div>

          {/* Special conditions — read-only checkboxes */}
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
              Special Conditions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', pointerEvents: 'none' }}>
              {SPECIAL_CONDITIONS.map(cond => {
                const checked = selectedConditions.includes(cond)
                return (
                  <span key={cond} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: checked ? '1.5px solid var(--charcoal)' : '1.5px solid var(--border2)',
                        background: checked ? 'var(--charcoal)' : 'transparent',
                        display: 'grid',
                        placeItems: 'center',
                        marginTop: 1,
                        flexShrink: 0,
                      }}
                    >
                      {checked && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>{cond}</span>
                  </span>
                )
              })}
            </div>
          </div>

          {/* Collapsible agenda sections */}
          <div>
            {AGENDA_SECTIONS.map((section, si) => {
              const open = openSections.has(section.code)
              const answeredQuestions = section.questions.filter(q => {
                const a = answers.get(agendaKey(section.code, q.key))
                return !!a && (a.answer.trim().length > 0 || a.selected_options.length > 0)
              })
              const lastSection = si === AGENDA_SECTIONS.length - 1
              return (
                <div key={section.code} style={{ borderBottom: lastSection ? undefined : '0.5px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSections(prev => {
                        const s = new Set(prev)
                        if (s.has(section.code)) s.delete(section.code)
                        else s.add(section.code)
                        return s
                      })
                    }
                    className="my-project-agenda-row"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 20px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ color: '#c8311a', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {section.code}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{section.name}</span>
                    <span style={SECTION_META}>{answeredQuestions.length} of {section.questions.length} answered</span>
                    <span style={{ color: 'var(--text3)', fontSize: 10, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </button>

                  {open && (
                    <div style={{ padding: '4px 20px 16px' }}>
                      {answeredQuestions.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>No details confirmed yet for this section.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {answeredQuestions.map(q => {
                            const entry = answers.get(agendaKey(section.code, q.key))!
                            return (
                              <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>{q.text}</span>
                                {entry.selected_options.length > 0 && (
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {entry.selected_options.map(opt => (
                                      <li
                                        key={opt}
                                        style={{
                                          fontSize: 12,
                                          color: 'var(--text2)',
                                          background: 'var(--surface2)',
                                          border: '0.5px solid var(--border)',
                                          borderRadius: 6,
                                          padding: '3px 9px',
                                        }}
                                      >
                                        {opt}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {entry.answer.trim().length > 0 && (
                                  <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {entry.answer}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SECTION 6 — Footer ───────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Questions about your project?</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            Contact your Project Specialist · CASK Construction
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}>Powered by CASK Hub</div>
        </div>
      </div>

      {/* Hover affordance for agenda rows (matches spec: hover background --surface-1) */}
      <style>{`
        .my-project-agenda-row:hover { background: var(--surface2); }
      `}</style>
    </div>
  )
}
