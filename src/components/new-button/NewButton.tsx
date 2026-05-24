'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ITEMS = [
  { label: 'Add Session',     action: 'session' },
  { label: 'Add Client',      action: 'client'  },
  { label: 'Add Action Item', action: 'action'  },
]

export default function NewButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleItem(action: string) {
    setOpen(false)
    if (action === 'session') {
      window.dispatchEvent(new Event('cask-open-add-modal'))
    } else if (action === 'action') {
      router.push('/actions')
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 11,
        right: 316,
        zIndex: 1000,
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 12px',
          borderRadius: 7,
          background: 'var(--charcoal)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          letterSpacing: '-0.1px',
          transition: 'opacity 120ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        New
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 160,
            overflow: 'hidden',
            zIndex: 1001,
          }}
        >
          {ITEMS.map((item, i) => (
            <button
              key={item.action}
              onClick={() => handleItem(item.action)}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 14px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontWeight: 400,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
