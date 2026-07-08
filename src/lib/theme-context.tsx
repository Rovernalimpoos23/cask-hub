'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const THEME_EVENT = 'cask-theme-change'
const THEME_KEY = 'cask-theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Default to dark; a saved preference (from the toggle) always wins.
    const saved = localStorage.getItem(THEME_KEY) as Theme | null
    const initial: Theme = saved ?? 'dark'
    setTheme(initial)
    if (initial === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    setMounted(true)

    // Stay in sync when another toggle instance fires
    const sync = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    }
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem(THEME_KEY, next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return { theme, toggleTheme, mounted }
}
