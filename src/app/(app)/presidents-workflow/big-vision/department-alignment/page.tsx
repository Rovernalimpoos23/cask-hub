'use client'
// src/app/(app)/presidents-workflow/big-vision/department-alignment/page.tsx
//
// "Department Alignment" sub-page — Command-Center-style card grid. All cards are
// Coming Soon (grayed, no route) for now. Wrapped in the shared Big Vision
// sub-page shell (back button + header + floating CASK Big Vision AI).

import VisionSubPageShell from '../_components/VisionSubPageShell'

const ICON_PATHS: Record<string, React.ReactNode> = {
  building2: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </>
  ),
  trendingUp: (
    <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  dollarSign: (
    <><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  userCheck: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
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
    icon: 'building2',
    iconBg: 'var(--surface2)',
    iconColor: 'var(--text2)',
    title: 'All Departments',
    subtitle: 'Company-wide alignment',
    bullets: ['Sales & Marketing', 'Operations', 'Finance', 'Human Resources'],
  },
  {
    icon: 'trendingUp',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    title: 'Sales & Marketing',
    subtitle: 'Jeff Azcona · Weekly / Monthly',
    bullets: ['Pipeline goals', 'Revenue targets', 'Lead conversion', 'Marketing strategy'],
  },
  {
    icon: 'users',
    iconBg: '#fdf2f8',
    iconColor: '#db2777',
    title: 'Human Resources',
    subtitle: 'Team · Monthly',
    bullets: ['Hiring pipeline', 'Employee roster', 'Training compliance', 'Retention'],
  },
  {
    icon: 'dollarSign',
    iconBg: '#fefce8',
    iconColor: '#ca8a04',
    title: 'Finance',
    subtitle: 'Lamont Gilyot · Weekly / Monthly',
    bullets: ['Cash flow', 'P&L Statement', 'Budget vs Actual', '13-Week cash flow'],
  },
  {
    icon: 'settings',
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    title: 'Operations',
    subtitle: 'Matteo Carpani · Weekly',
    bullets: ['WIP Report', 'Project profitability', 'PM Scorecards', 'Budget vs Actual'],
  },
  {
    icon: 'userCheck',
    iconBg: '#f0fdfa',
    iconColor: '#0d9488',
    title: '1:1s — Department Heads',
    subtitle: 'Jeff · Lamont · Kait · Matteo',
    bullets: ['Jeff Azcona 1:1', 'Lamont Gilyot 1:1', 'Kait 1:1', 'Matteo Carpani 1:1', 'DISC Personality Assessments'],
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
  return (
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
        cursor: 'default',
        opacity: 0.7,
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
        <span style={{ fontSize: 12, fontWeight: 550, color: 'var(--text3)' }}>Coming Soon</span>
      </div>
    </div>
  )
}

export default function DepartmentAlignmentPage() {
  return (
    <VisionSubPageShell title="Department Alignment" subtitle="Goals · 1:1s · DISC Assessments">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
        {CARDS.map((card) => (
          <GridCard key={card.title} card={card} />
        ))}
      </div>
    </VisionSubPageShell>
  )
}
