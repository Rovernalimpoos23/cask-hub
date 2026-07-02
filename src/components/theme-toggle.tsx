'use client'
// src/components/theme-toggle.tsx
// Improved theme toggle button. Uses the EXISTING theme system — useTheme from
// @/lib/theme-context (the .dark class + localStorage 'cask-theme' toggle). It
// does NOT introduce next-themes or any new theme mechanism. Icon logic is the
// same as the previous inline sidebar button: sun in dark mode, moon in light,
// crossfaded by opacity and guarded by `mounted` to avoid a hydration flash.

import { useTheme } from '@/lib/theme-context'

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        // `position: relative` anchors the absolutely-positioned icons; `flexShrink: 0`
        // preserves the footer layout (the old button had `shrink-0`). Everything else
        // matches the requested polished style.
        position: 'relative',
        width: 28,
        height: 28,
        borderRadius: 7,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        color: 'var(--text2)',
        fontSize: 14,
        flexShrink: 0,
      }}
    >
      {/* Sun — shown in dark mode */}
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', opacity: mounted && isDark ? 1 : 0, transition: 'opacity 150ms ease' }}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      {/* Moon — shown in light mode */}
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', opacity: mounted && !isDark ? 1 : 0, transition: 'opacity 150ms ease' }}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}
