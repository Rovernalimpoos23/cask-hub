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

interface NavCard {
  icon: string
  title: string
  description: string
  badge: string
  badgeTone: BadgeTone
  href: string
}

// Static cards. Card 7 (Documents) badge count is filled in dynamically.
const STATIC_CARDS: NavCard[] = [
  {
    icon: '🎯',
    title: '1-Year Plan',
    description: 'Launch New Build Division · $10M revenue target',
    badge: '2025–2026',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/1yr',
  },
  {
    icon: '🚀',
    title: '3-Year Plan',
    description: 'Dominate locally · Launch consulting arms',
    badge: '2028',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/3yr',
  },
  {
    icon: '🌍',
    title: '5-Year Plan',
    description: 'National expansion · $1B path · Platform building',
    badge: '2030',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/5yr',
  },
  {
    icon: '📜',
    title: 'CASK Manifesto',
    description: 'Purpose · Community · The Modern Village',
    badge: 'Core Values',
    badgeTone: 'blue',
    href: '/presidents-workflow/big-vision/manifesto',
  },
  {
    icon: '🏗️',
    title: 'White Paper Draft',
    description: 'ADU Division (Kait) · New Build Division (Mateo)',
    badge: 'Structure',
    badgeTone: 'gray',
    href: '/presidents-workflow/big-vision/charters',
  },
  {
    icon: '🗺️',
    title: '2, 5, 10 Year Goals',
    description: 'Blueprint for builders nationwide · $1B+ enterprise',
    badge: '2035 Vision',
    badgeTone: 'green',
    href: '/presidents-workflow/big-vision/roadmap',
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
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              background: 'var(--surface2)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {card.icon}
          </div>
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
    icon: '📁',
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
