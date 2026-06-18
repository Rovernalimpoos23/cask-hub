'use client'
// src/app/(app)/presidents-workflow/big-vision/_components/VisionSubPageShell.tsx
//
// Shared layout for every Big Vision sub-page: a back button to the hub, a
// Command-Center-style header (serif title + subtitle), the scrolling body, and
// the floating CASK Big Vision AI button. No right panel.

import Link from 'next/link'
import FloatingVisionAI from './FloatingVisionAI'

const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'

export default function VisionSubPageShell({
  title,
  subtitle,
  fullWidth = false,
  children,
}: {
  title: string
  subtitle?: string
  fullWidth?: boolean
  children: React.ReactNode
}) {
  return (
    <>
      {/* Header */}
      <header
        style={{
          flexShrink: 0,
          background: 'var(--white)',
          borderBottom: '1px solid var(--fable-line, var(--border))',
        }}
      >
        <div style={{ padding: '20px 40px 22px' }}>
          <Link
            href="/presidents-workflow/big-vision"
            className="bv-back"
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
            ← CASK Big Vision
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
          {subtitle && (
            <div style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>{subtitle}</div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in" style={{ background: 'var(--bg)' }}>
        <div style={{ padding: '30px 40px 90px', maxWidth: fullWidth ? '100%' : 980 }}>
          <style>{`.bv-back:hover { color: var(--text); }`}</style>
          {children}
        </div>
      </div>

      {/* Floating CASK Big Vision AI — shared component, bottom-right */}
      <FloatingVisionAI />
    </>
  )
}
