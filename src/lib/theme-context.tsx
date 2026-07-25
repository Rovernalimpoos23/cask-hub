'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const THEME_EVENT = 'cask-theme-change'

// sessionStorage is the single source of truth for the current tab. It survives a
// refresh but is cleared when the tab/window closes, which gives us:
//   fresh tab / browser restart  → dark
//   refresh in the same tab      → keeps the user's choice
//   tab closed and reopened      → dark again
//
// It also replaces the module-scoped variable this file used before. That was
// there to stop a component mounting after a toggle (e.g. on navigation) from
// resetting the theme back to dark; sessionStorage solves the same problem
// better, since every useTheme() instance reads the one shared value.
const THEME_KEY = 'cask-theme-session'

// The old persist-forever key. Nothing reads it any more — it is only removed on
// mount so a stale preference cannot linger in the browser.
const LEGACY_THEME_KEY = 'cask-theme'

// Every storage access is guarded: Safari private mode and hardened browser
// settings throw on both read and write rather than returning null.
function readSessionTheme(): Theme {
  try {
    const saved = sessionStorage.getItem(THEME_KEY)
    // Validate rather than cast, so a corrupted value falls back to dark.
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

function writeSessionTheme(next: Theme) {
  try {
    sessionStorage.setItem(THEME_KEY, next)
  } catch {
    // Storage unavailable — the toggle still applies for this page view, it just
    // will not survive a refresh.
  }
}

function applyTheme(next: Theme) {
  if (next === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Adopt this tab's theme — dark on a fresh session, otherwise whatever the
    // user last chose in this tab.
    const initial = readSessionTheme()
    setTheme(initial)
    applyTheme(initial)
    setMounted(true)

    // Clear any preference saved by the older persisting version.
    try {
      localStorage.removeItem(LEGACY_THEME_KEY)
    } catch {
      // Private mode / storage disabled — nothing to clean up.
    }

    // Stay in sync when another toggle instance fires
    const sync = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    }
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    writeSessionTheme(next)
    setTheme(next)
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return { theme, toggleTheme, mounted }
}
