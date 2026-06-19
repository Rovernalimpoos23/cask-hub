'use client'
// src/app/(app)/presidents-workflow/big-vision/_components/VisionContent.tsx
//
// Fetches a single cask_vision_content row by horizon and renders the raw
// Supabase text as clean, readable blocks — NOT a cramped text wall. Raw text
// often arrives hard-wrapped with single \r\n line breaks that split sentences
// mid-word, so we normalize line endings, collapse single newlines into spaces,
// and only then split on blank lines into paragraphs. ALL-CAPS lines become
// section headers and "-"/"•" lines become list items.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

// CSS custom properties requested for this component. These project tokens are
// not yet defined globally, so each carries a fallback to the existing token.
const TEXT_PRIMARY = 'var(--color-text-primary, var(--text))'
const TEXT_SECONDARY = 'var(--color-text-secondary, var(--text2))'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Block =
  | { type: 'header'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'para'; text: string }
  | { type: 'spacer' }

// Strip light markdown noise so raw Supabase text renders cleanly.
function clean(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .trim()
}

// A line is a section header when it is entirely upper-case (and has letters).
function isAllCaps(line: string): boolean {
  return /[A-Z]/.test(line) && line === line.toUpperCase()
}

// Parse raw text into blocks.
//
// FIX 1 — fix mid-word wrapping caused by hard line breaks:
//   1. Normalize all \r\n (and lone \r) to \n.
//   2. Collapse single \n into spaces so broken sentences flow naturally,
//      while preserving blank-line paragraph breaks and newlines that precede
//      a list bullet (so multi-line lists stay intact).
//   3. Split on \n\n to create paragraphs.
function parseBlocks(content: string): Block[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Replace a single \n (one not preceded or followed by another \n) with a
  // space, unless it directly precedes a list bullet.
  const joined = normalized.replace(/(?<!\n)\n(?!\n|[-•])/g, ' ')

  const paragraphs = joined.split(/\n{2,}/)
  const blocks: Block[] = []

  for (const rawParagraph of paragraphs) {
    const paragraph = clean(rawParagraph)

    // Empty paragraph → spacer.
    if (!paragraph) {
      blocks.push({ type: 'spacer' })
      continue
    }

    // List paragraph: starts with a bullet. Preserved internal newlines (see
    // FIX 1) separate the individual items.
    if (/^[-•]\s+/.test(paragraph)) {
      const items = paragraph
        .split('\n')
        .map((l) => clean(l).replace(/^[-•]\s+/, '').trim())
        .filter(Boolean)
      blocks.push({ type: 'list', items })
      continue
    }

    // Section header: an ALL-CAPS line.
    if (isAllCaps(paragraph)) {
      blocks.push({ type: 'header', text: paragraph })
      continue
    }

    blocks.push({ type: 'para', text: paragraph })
  }

  return blocks
}

export default function VisionContent({
  horizon,
}: {
  horizon: string
  // Kept for backwards-compat with existing callers; rendering is now uniform
  // across variants, so this no longer changes the output.
  variant?: 'default' | 'statement'
}) {
  const [content, setContent] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(false)
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from('cask_vision_content')
        .select('content, updated_at')
        .eq('horizon', horizon)
        .limit(1)
      if (!active) return
      if (fetchError) {
        setError(true)
      } else {
        const row = data?.[0]
        setContent(row?.content ?? '')
        setUpdatedAt(row?.updated_at ?? null)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [horizon])

  if (error) {
    return (
      <div
        className="text-[13px]"
        style={{
          color: 'var(--text3)',
          border: '1px solid var(--fable-line, var(--border))',
          borderRadius: 'var(--fable-radius)',
          background: 'var(--surface)',
          padding: '16px 20px',
        }}
      >
        Unable to load content.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer" style={{ height: i === 0 ? 90 : 140, borderRadius: 'var(--fable-radius)' }} />
        ))}
      </div>
    )
  }

  const blocks = content ? parseBlocks(content) : []

  if (blocks.length === 0) {
    return (
      <div
        style={{
          border: '1px solid var(--fable-line, var(--border))',
          borderRadius: 'var(--fable-radius)',
          background: 'var(--surface)',
          padding: '20px',
          fontSize: 13,
          color: 'var(--text3)',
          fontStyle: 'italic',
        }}
      >
        No content yet.
      </div>
    )
  }

  return (
    <div
      style={{
        // FIX 2: constrain and center the content card.
        maxWidth: 860,
        margin: '0 auto',
        border: '1px solid var(--fable-line, var(--border))',
        borderRadius: 'var(--fable-radius)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {/* FIX 2: generous padding — 40px top/bottom, 32px left/right. */}
      <div style={{ padding: '40px 32px' }}>
        {blocks.map((block, i) => {
          if (block.type === 'header') {
            return (
              <span
                key={i}
                style={{
                  // FIX 3: section header styling.
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  lineHeight: 1.4,
                  textTransform: 'uppercase',
                  textAlign: 'left', // FIX 4
                  color: TEXT_SECONDARY,
                  // No top margin for the very first block.
                  margin: i === 0 ? '0 0 0.75rem' : '2rem 0 0.75rem',
                }}
              >
                {block.text}
              </span>
            )
          }

          if (block.type === 'list') {
            return (
              <ul
                key={i}
                style={{
                  // FIX 3: list items with bullet and 24px left indent.
                  listStyle: 'disc',
                  paddingLeft: 24,
                  margin: '0 0 1.4rem',
                }}
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    style={{
                      fontSize: 16,
                      lineHeight: 2.0,
                      color: TEXT_PRIMARY,
                      textAlign: 'left', // FIX 4
                      margin: '4px 0',
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )
          }

          if (block.type === 'spacer') {
            // FIX 3: empty lines render as small spacers.
            return <div key={i} style={{ margin: '0.5rem 0' }} />
          }

          return (
            <p
              key={i}
              style={{
                // FIX 3: body text. FIX 4: left aligned.
                fontSize: 16,
                lineHeight: 2.0,
                color: TEXT_PRIMARY,
                textAlign: 'left',
                margin: '0 0 1.4rem',
              }}
            >
              {block.text}
            </p>
          )
        })}
      </div>

      {updatedAt && (
        <div
          style={{
            padding: '14px 32px',
            borderTop: '1px solid var(--fable-line-soft, var(--border))',
            fontSize: 11,
            color: 'var(--text3)',
          }}
        >
          Last updated {formatDate(updatedAt)}
        </div>
      )}
    </div>
  )
}
