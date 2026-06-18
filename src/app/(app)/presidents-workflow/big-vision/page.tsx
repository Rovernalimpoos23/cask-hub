'use client'
// src/app/(app)/presidents-workflow/big-vision/page.tsx
//
// CASK Big Vision — hub page. Command-Center-style card grid; each card links to a
// sub-page. No right panel (floating CASK Big Vision AI instead).
//
// TODO: The shared right-hand AIPanel still renders on this route because
// '/presidents-workflow/big-vision' (and its sub-routes) are not listed in
// FULL_WIDTH_ROUTES inside src/app/(app)/layout.tsx. To fully hide the right panel
// and run full-width like Command Center, those routes must be added there — that
// file is outside the big-vision/ folder and is intentionally left untouched.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import FloatingVisionAI from './_components/FloatingVisionAI'

const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'

type BadgeTone = 'gray' | 'blue' | 'green'

const BADGE_STYLES: Record<BadgeTone, { color: string; bg: string; border: string }> = {
  gray: { color: 'var(--text3)', bg: 'var(--surface2)', border: 'var(--fable-line, var(--border))' },
  blue: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  green: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
}

// Lucide-style inline SVG paths (same icon approach as Command Center's <Icon>).
const ICON_PATHS: Record<string, React.ReactNode> = {
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
  bookOpen: (
    <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>
  ),
  building: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </>
  ),
  barChart: (
    <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>
  ),
  folder: (
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
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

// Small rounded-square icon container — same size/radius as Command Center's
// DeptIcon, but with a soft colored background per card.
function CardIcon({ name, bg, color }: { name: string; bg: string; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: bg,
        display: 'grid',
        placeItems: 'center',
        color,
        flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[name]}
      </svg>
    </div>
  )
}

interface NavCard {
  icon: string
  iconBg: string
  iconColor: string
  title: string
  description: string
  badge: string
  badgeTone: BadgeTone
  href: string
}

// Static cards. Card 7 (Documents) badge count is filled in dynamically.
const STATIC_CARDS: NavCard[] = [
  {
    icon: 'target',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    title: '1-Year Plan',
    description: 'Launch New Build Division · $10M revenue target',
    badge: '2025–2026',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/1yr',
  },
  {
    icon: 'rocket',
    iconBg: '#f5f3ff',
    iconColor: '#7c3aed',
    title: '3-Year Plan',
    description: 'Dominate locally · Launch consulting arms',
    badge: '2028',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/3yr',
  },
  {
    icon: 'globe',
    iconBg: '#f0fdf4',
    iconColor: '#16a34a',
    title: '5-Year Plan',
    description: 'National expansion · $1B path · Platform building',
    badge: '2030',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/5yr',
  },
  {
    icon: 'bookOpen',
    iconBg: '#fffbeb',
    iconColor: '#d97706',
    title: 'CASK Manifesto',
    description: 'Purpose · Community · The Modern Village',
    badge: 'Core Values',
    badgeTone: 'blue',
    href: '/presidents-workflow/big-vision/manifesto',
  },
  {
    icon: 'building',
    iconBg: 'var(--surface2)',
    iconColor: 'var(--text2)',
    title: 'White Paper Draft',
    description: 'ADU Division (Kait) · New Build Division (Mateo)',
    badge: 'Structure',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/charters',
  },
  {
    icon: 'barChart',
    iconBg: '#f0fdfa',
    iconColor: '#0d9488',
    title: '2, 5, 10 Year Goals',
    description: 'Blueprint for builders nationwide · $1B+ enterprise',
    badge: '2035 Vision',
    badgeTone: 'green',
    href: '/presidents-workflow/big-vision/roadmap',
  },
  {
    icon: 'calendarDays',
    iconBg: '#FEE2E2',
    iconColor: '#dc2626',
    title: 'Overall Meeting Outline',
    description: 'Yearly · Quarterly · Monthly meeting structure',
    badge: 'Structure',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/meeting-cadence',
  },
]

function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const s = BADGE_STYLES[tone]
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.2px',
        padding: '3px 9px',
        borderRadius: 999,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function VisionNavCard({ card }: { card: NavCard }) {
  return (
    <Link href={card.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      <div
        className="bv-card"
        style={{
          border: '1px solid var(--fable-line, var(--border))',
          borderRadius: 'var(--fable-radius)',
          background: 'var(--surface)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
          padding: '18px',
          cursor: 'pointer',
          transition: 'border-color 150ms ease',
        }}
      >
        {/* Icon + badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <CardIcon name={card.icon} bg={card.iconBg} color={card.iconColor} />
          <Badge tone={card.badgeTone}>{card.badge}</Badge>
        </div>

        {/* Title + description */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.1px' }}>
            {card.title}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
            {card.description}
          </div>
        </div>

        {/* Footer link */}
        <div className="bv-card-link" style={{ marginTop: 'auto', fontSize: 12, fontWeight: 550, color: 'var(--text)' }}>
          Open →
        </div>
      </div>
    </Link>
  )
}

export default function BigVisionPage() {
  const [fileCount, setFileCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    async function loadCount() {
      const supabase = createClient()
      const { count } = await supabase
        .from('cask_vision_files')
        .select('*', { count: 'exact', head: true })
      if (!active) return
      setFileCount(count ?? 0)
    }
    loadCount()
    return () => {
      active = false
    }
  }, [])

  const documentsCard: NavCard = {
    icon: 'folder',
    iconBg: '#fef9c3',
    iconColor: '#a16207',
    title: 'Documents & Files',
    description: 'Source documents · Upload & reference materials',
    badge: fileCount === null ? '… files' : `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`,
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/documents',
  }

  const cards: NavCard[] = [...STATIC_CARDS, documentsCard]

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
        <div style={{ padding: '30px 40px 90px', maxWidth: 1180 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
            {cards.map((card) => (
              <VisionNavCard key={card.href} card={card} />
            ))}
          </div>
        </div>
      </div>

      {/* Floating CASK Big Vision AI — shared component, bottom-right */}
      <FloatingVisionAI />
    </>
  )
}
