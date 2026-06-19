'use client'
// src/app/(app)/presidents-workflow/big-vision/department-alignment/_components/DepartmentDetail.tsx
//
// Shared layout for every Department Alignment sub-page (Sales & Marketing, HR,
// Finance, Operations). Renders its own Command-Center-style shell — a back
// button to the Department Alignment hub, a serif header, then two sections:
//   1. DEPARTMENT GOALS — placeholder card.
//   2. 1:1 — [HEAD] — a DISC Personality Assessment framework card.
// The floating CASK Big Vision AI is reused from the shared Big Vision shell.

import Link from 'next/link'
import FloatingVisionAI from '../../_components/FloatingVisionAI'

const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'
const ACCENT_RED = '#DC2626'

// One DISC dimension. `color` is the colored circle; `descTemplate` is filled
// with the person's first name at render time.
interface DiscDimension {
  letter: 'D' | 'I' | 'S' | 'C'
  name: string
  color: string
  descTemplate: string
}

const DISC: DiscDimension[] = [
  { letter: 'D', name: 'Dominance', color: '#DC2626', descTemplate: 'handles problems and challenges' },
  { letter: 'I', name: 'Influence', color: '#EAB308', descTemplate: 'handles people and relationships' },
  { letter: 'S', name: 'Steadiness', color: '#16A34A', descTemplate: 'handles pace and consistency' },
  { letter: 'C', name: 'Conscientiousness', color: '#2563EB', descTemplate: 'handles procedures and standards' },
]

export interface DepartmentDetailProps {
  // Page title, e.g. "Sales & Marketing".
  title: string
  // Page subtitle, e.g. "Jeff Azcona · Weekly / Monthly".
  subtitle: string
  // Uppercase 1:1 section label, e.g. "1:1 — JEFF AZCONA".
  oneOnOneLabel: string
  // Department head label used in placeholders/notes, e.g. "Jeff Azcona" or "HR Lead".
  head: string
  // Short name used inside the DISC descriptions, e.g. "Jeff", "HR Lead".
  discName: string
}

// Uppercase section label with a short red accent line — matches CASK Hub style.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ width: 26, height: 2, background: ACCENT_RED, borderRadius: 1, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--text)',
        }}
      >
        {children}
      </span>
    </div>
  )
}

function DiscRow({ dim, name, first }: { dim: DiscDimension; name: string; first: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 0',
        borderTop: first ? 'none' : '1px solid var(--fable-line-soft, var(--border))',
      }}
    >
      {/* Left: colored circle + label / description / style note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: dim.color,
            color: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {dim.letter}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {dim.letter} — {dim.name}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
            How {name} {dim.descTemplate}
          </div>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text3)', marginTop: 6 }}>
            To be assessed
          </div>
        </div>
      </div>

      {/* Right: score badge (empty placeholder) */}
      <div
        style={{
          flexShrink: 0,
          minWidth: 38,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'var(--surface2)',
          border: '1px solid var(--fable-line, var(--border))',
          color: 'var(--text3)',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        —
      </div>
    </div>
  )
}

function DiscCard({ head, discName }: { head: string; discName: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--fable-line, var(--border))',
        borderRadius: 'var(--fable-radius)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.2px' }}>
          DISC Personality Assessment
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
          {discName}&apos;s communication and work style profile
        </div>
      </div>

      {/* DISC dimension rows */}
      <div style={{ padding: '6px 24px 0' }}>
        {DISC.map((dim, i) => (
          <DiscRow key={dim.letter} dim={dim} name={discName} first={i === 0} />
        ))}
      </div>

      {/* Communication Tips */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--fable-line-soft, var(--border))', marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 8 }}>
          Communication Tips
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text3)' }}>
          Communication tips will appear here once DISC assessment is completed.
        </div>
      </div>

      {/* Bottom note */}
      <div
        style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--fable-line-soft, var(--border))',
          background: 'var(--surface2)',
          fontSize: 12.5,
          color: 'var(--text3)',
        }}
      >
        DISC assessment data to be provided by {head}. Contact Kai to schedule.
      </div>
    </div>
  )
}

export default function DepartmentDetail({ title, subtitle, oneOnOneLabel, head, discName }: DepartmentDetailProps) {
  return (
    <>
      {/* Header — mirrors the shared Big Vision shell but links back to the
          Department Alignment hub. */}
      <header
        style={{
          flexShrink: 0,
          background: 'var(--white)',
          borderBottom: '1px solid var(--fable-line, var(--border))',
        }}
      >
        <div style={{ padding: '20px 40px 22px' }}>
          <Link
            href="/presidents-workflow/big-vision/department-alignment"
            className="dept-back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 550,
              color: 'var(--text3)',
              textDecoration: 'none',
              marginBottom: 14,
              transition: 'color 150ms ease',
            }}
          >
            ← Department Alignment
          </Link>
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 30,
              letterSpacing: '-0.45px',
              lineHeight: 1.15,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          <div style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>{subtitle}</div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in" style={{ background: 'var(--bg)' }}>
        <div style={{ width: '100%', padding: '30px 40px 90px' }}>
          <style>{`.dept-back:hover { color: var(--text); }`}</style>

          {/* SECTION 1 — Department Goals */}
          <section style={{ marginBottom: 36 }}>
            <SectionLabel>Department Goals</SectionLabel>
            <div
              style={{
                border: '1px solid var(--fable-line, var(--border))',
                borderRadius: 'var(--fable-radius)',
                background: 'var(--surface)',
                padding: '22px 24px',
                fontSize: 14,
                color: 'var(--text3)',
                fontStyle: 'italic',
              }}
            >
              Goals coming soon — to be defined by {head}
            </div>
          </section>

          {/* SECTION 2 — 1:1 + DISC */}
          <section>
            <SectionLabel>{oneOnOneLabel}</SectionLabel>
            <DiscCard head={head} discName={discName} />
          </section>
        </div>
      </div>

      {/* Floating CASK Big Vision AI — shared component, bottom-right */}
      <FloatingVisionAI />
    </>
  )
}
