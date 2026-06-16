'use client'
// src/app/(app)/presidents-workflow/big-vision/_components/VisionContent.tsx
//
// Fetches a single cask_vision_content row by horizon and renders it as clean,
// readable sections — NOT a raw text wall. Content is split on "---"; within each
// section the first line becomes a serif sub-header and the remainder is body text.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ParsedSection {
  heading: string
  body: string
}

// Split on a line of three-or-more dashes; first line of each chunk → heading.
function parseSections(content: string): ParsedSection[] {
  return content
    .split(/\n?-{3,}\n?/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((section) => {
      const lines = section.split('\n')
      let heading = (lines[0] ?? '').replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
      let body = lines.slice(1).join('\n').trim()
      // If the "heading" is really a paragraph, keep the whole chunk as body.
      if (heading.length > 90) {
        body = section
        heading = ''
      }
      return { heading, body }
    })
}

export default function VisionContent({
  horizon,
  variant = 'default',
}: {
  horizon: string
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

  const sections = content ? parseSections(content) : []

  if (sections.length === 0) {
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

  const statement = variant === 'statement'

  return (
    <div
      style={{
        border: '1px solid var(--fable-line, var(--border))',
        borderRadius: 'var(--fable-radius)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {sections.map((s, i) => (
        <div
          key={i}
          style={{
            padding: statement ? '26px 30px' : '22px 26px',
            borderTop: i > 0 ? '1px solid var(--fable-line-soft, var(--border))' : 'none',
          }}
        >
          {s.heading && (
            <h2
              style={{
                fontFamily: SERIF,
                fontSize: statement ? 22 : 18,
                fontWeight: 600,
                letterSpacing: '-0.3px',
                lineHeight: 1.25,
                color: 'var(--text)',
                margin: s.body ? '0 0 12px' : '0',
              }}
            >
              {s.heading}
            </h2>
          )}
          {s.body && (
            <p
              style={{
                fontSize: statement ? 16 : 14,
                lineHeight: statement ? 1.85 : 1.7,
                color: 'var(--text2)',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {s.body}
            </p>
          )}
        </div>
      ))}

      {updatedAt && (
        <div
          style={{
            padding: '14px 26px',
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
