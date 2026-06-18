'use client'
// src/app/(app)/presidents-workflow/big-vision/the-big-vision/page.tsx
//
// "The Big Vision" sub-page — Command-Center-style card grid linking to the core
// strategy & foundation documents. Wrapped in the shared Big Vision sub-page
// shell (back button + header + floating CASK Big Vision AI).

import Link from 'next/link'
import VisionSubPageShell from '../_components/VisionSubPageShell'

const ICON_PATHS: Record<string, React.ReactNode> = {
  bookOpen: (
    <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>
  ),
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
    </>
  ),
  barChart: (
    <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>
  ),
  target: (
    <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  globe: (
    <><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></>
  ),
  calendarDays: (
    <>
      <path d="M8 2v4" /><path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
      <path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" />
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
  href?: string
}

const CARDS: CardDef[] = [
  {
    icon: 'bookOpen',
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    title: 'CASK Manifesto',
    subtitle: 'Purpose · Community · Modern Village',
    bullets: ['Built on Purpose', 'Rooted in Community', 'The Modern Village', 'Generational wealth'],
    href: '/presidents-workflow/big-vision/manifesto',
  },
  {
    icon: 'fileText',
    iconBg: 'var(--surface2)',
    iconColor: 'var(--text2)',
    title: 'White Paper Draft',
    subtitle: 'ADU Division · New Build Division',
    bullets: ['Division Charters', 'Org Structure', 'Planning Agenda', 'KPIs'],
    href: '/presidents-workflow/big-vision/charters',
  },
  {
    icon: 'barChart',
    iconBg: '#f0fdfa',
    iconColor: '#0d9488',
    title: '2, 5, 10 Year Goals',
    subtitle: 'Strategic roadmap to $1B+',
    bullets: ['1-Year Plan', '3-Year Plan', '5-Year Plan', '10-Year Vision'],
    href: '/presidents-workflow/big-vision/roadmap',
  },
  {
    icon: 'target',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    title: '1-Year Plan',
    subtitle: '2025–2026 · Laying the Foundation',
    bullets: ['Launch New Build Division', '$10M revenue target', 'ADU Division growth', 'Finance consulting beta'],
    href: '/presidents-workflow/big-vision/1yr',
  },
  {
    icon: 'rocket',
    iconBg: '#f5f3ff',
    iconColor: '#7c3aed',
    title: '3-Year Plan',
    subtitle: '2028 · Dominating Locally',
    bullets: ['All arms operational', 'Consulting launch', 'Productized playbooks', '90/10 revenue split'],
    href: '/presidents-workflow/big-vision/3yr',
  },
  {
    icon: 'globe',
    iconBg: '#f0fdf4',
    iconColor: '#16a34a',
    title: '5-Year Plan',
    subtitle: '2030 · National Expansion',
    bullets: ['20-28 markets', '$1B revenue path', 'Consulting arms live', '70/30 revenue split'],
    href: '/presidents-workflow/big-vision/5yr',
  },
  {
    icon: 'calendarDays',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    title: 'Overall Meeting Outline',
    subtitle: 'Yearly · Quarterly · Monthly',
    bullets: ['Executive Strategy Planning', 'Quarterly Goal Setting', 'Monthly Dept Alignment', 'Action Coach 1:1'],
    href: '/presidents-workflow/big-vision/meeting-cadence',
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
        opacity: card.href ? 1 : 0.7,
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
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 13 }}>
        {card.href ? (
          <span className="bv-card-link" style={{ fontSize: 12, fontWeight: 550, color: 'var(--text)' }}>
            Open →
          </span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 550, color: 'var(--text3)' }}>Coming Soon</span>
        )}
      </div>
    </div>
  )

  return card.href ? (
    <Link href={card.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      {inner}
    </Link>
  ) : (
    inner
  )
}

export default function TheBigVisionPage() {
  return (
    <VisionSubPageShell title="The Big Vision" subtitle="Core strategy & foundation">
      <style>{`
        .bv-card:hover { border-color: var(--border2) !important; }
        .bv-card:hover .bv-card-link { text-decoration: underline; text-underline-offset: 3px; }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
        {CARDS.map((card) => (
          <GridCard key={card.title} card={card} />
        ))}
      </div>
    </VisionSubPageShell>
  )
}
