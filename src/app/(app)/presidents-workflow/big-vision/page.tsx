'use client'
// src/app/(app)/presidents-workflow/big-vision/page.tsx
//
// CASK Big Vision — hub page. Command-Center-style card grid: 4 top-level cards,
// each opening its own sub-page grid. No right panel (floating CASK Big Vision AI
// instead).
//
// TODO: The shared right-hand AIPanel still renders on this route because
// '/presidents-workflow/big-vision' (and its sub-routes) are listed in
// FULL_WIDTH_ROUTES inside src/app/(app)/layout.tsx. That file is outside the
// big-vision/ folder and is only touched to register full-width routes.

import Link from 'next/link'
import FloatingVisionAI from './_components/FloatingVisionAI'

const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'

// ── Icons (Lucide-style; stroke = currentColor so they tint) ─────────────
const ICON_PATHS: Record<string, React.ReactNode> = {
  layers: (
    <>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>
  ),
  building2: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </>
  ),
  star: (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z" />
    </>
  ),
}

interface CardDef {
  icon: string
  iconBg: string
  iconColor: string
  title: string
  subtitle: string
  bullets: string[]
  more?: number
  href?: string
}

const CARDS: CardDef[] = [
  {
    icon: 'layers',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    title: 'The Big Vision',
    subtitle: 'Core strategy & foundation',
    bullets: ['CASK Manifesto', 'White Paper Draft', '2, 5, 10 Year Goals', '1-Year Plan'],
    more: 3,
    href: '/presidents-workflow/big-vision/the-big-vision',
  },
  {
    icon: 'building2',
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    title: 'Department Alignment',
    subtitle: 'Goals · 1:1s · DISC Assessments',
    bullets: ['Sales & Marketing', 'Human Resources', 'Finance', 'Operations'],
    more: 2,
    href: '/presidents-workflow/big-vision/department-alignment',
  },
  {
    icon: 'star',
    iconBg: '#fefce8',
    iconColor: '#ca8a04',
    title: 'PIT',
    subtitle: 'Personal Improvement Targets',
    bullets: [],
    href: '/presidents-workflow/big-vision/pit',
  },
  {
    icon: 'palette',
    iconBg: '#f5f3ff',
    iconColor: '#7c3aed',
    title: 'Design Center',
    subtitle: 'Design files · Client presentations',
    bullets: [],
    href: '/presidents-workflow/big-vision/design-center',
  },
]

function CardIcon({ name, bg, color }: { name: string; bg: string; color: string }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'grid', placeItems: 'center', color, flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[name]}
      </svg>
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border2)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{text}</span>
    </div>
  )
}

function GridCard({ card }: { card: CardDef }) {
  const inner = (
    <div
      className="bv-card"
      style={{
        border: '1px solid var(--fable-line, var(--border))',
        borderRadius: 'var(--fable-radius)',
        background: 'var(--surface)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 18,
        cursor: card.href ? 'pointer' : 'default',
        transition: 'border-color 150ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <CardIcon name={card.icon} bg={card.iconBg} color={card.iconColor} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.1px' }}>{card.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{card.subtitle}</div>
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        {card.bullets.map((b) => (
          <Bullet key={b} text={b} />
        ))}
        {card.more ? (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '5px 0 2px' }}>+ {card.more} more</div>
        ) : null}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 13 }}>
        <span className="bv-card-link" style={{ fontSize: 12, fontWeight: 550, color: 'var(--text)' }}>
          Open →
        </span>
      </div>
    </div>
  )

  return (
    <Link href={card.href!} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      {inner}
    </Link>
  )
}

export default function BigVisionPage() {
  return (
    <>
      <style>{`
        .bv-card:hover { border-color: var(--border2) !important; }
        .bv-card:hover .bv-card-link { text-decoration: underline; text-underline-offset: 3px; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          background: 'var(--white)',
          borderBottom: '1px solid var(--fable-line, var(--border))',
        }}
      >
        <div style={{ padding: '20px 40px 24px' }}>
          {/* Breadcrumb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text3)',
              marginBottom: 12,
            }}
          >
            <span>President&apos;s Workflow</span>
            <span style={{ color: 'var(--border2)' }}>|</span>
            <span style={{ color: 'var(--text2)' }}>CASK Big Vision</span>
          </div>

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
            CASK Big Vision
          </h1>
          <div style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>
            From 10-year vision to today&apos;s focus — one connected brain.
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in" style={{ background: 'var(--bg)' }}>
        <div style={{ padding: '30px 40px 90px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
            {CARDS.map((card) => (
              <GridCard key={card.href} card={card} />
            ))}
          </div>
        </div>
      </div>

      {/* Floating CASK Big Vision AI — shared component, bottom-right */}
      <FloatingVisionAI />
    </>
  )
}
