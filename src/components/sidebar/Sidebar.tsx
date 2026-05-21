'use client'
// src/components/sidebar/Sidebar.tsx

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const NAV_SECTIONS = [
  {
    label: 'ActionCOACH',
    items: [
      { href: '/dashboard', icon: '▣', label: 'Dashboard', locked: false },
      { href: '/sessions', icon: '◈', label: 'Sessions', locked: false },
      { href: '/generate', icon: '✦', label: 'Generate Agenda', locked: false },
      { href: '/actions', icon: '◎', label: 'Action Items', locked: false },
    ],
  },
  {
    label: 'President Workflow',
    items: [
      { href: '/president/daily', icon: '📅', label: 'Daily Meetings', locked: false },
      { href: '/president/coaching', icon: '🎯', label: 'Coaching Sessions', locked: false },
      { href: '/president/alignment', icon: '🏢', label: 'Department Alignment', locked: false },
      { href: '/president/pit-goals', icon: '⚡', label: 'PIT Goals', locked: false },
    ],
  },
  {
    label: 'Customer Journey',
    items: [
      { href: '/customers', icon: '👥', label: 'Active Clients', locked: false },
      { href: '/customers/templates', icon: '📋', label: 'Client Templates', locked: false },
      { href: '/customers/new', icon: '➕', label: 'New Client Setup', locked: false },
    ],
  },
  {
    label: 'Meeting Intelligence',
    locked: true,
    items: [
      { href: '#', icon: '🎙', label: 'AI Notetaker', locked: true },
      { href: '#', icon: '📅', label: 'Calendar Sync', locked: true },
      { href: '#', icon: '📋', label: 'Transcripts', locked: true },
    ],
  },
  {
    label: 'Estimates',
    locked: true,
    items: [
      { href: '#', icon: '📐', label: 'Upload Drawing', locked: true },
      { href: '#', icon: '💰', label: 'ACE Budget Format', locked: true },
      { href: '#', icon: '📁', label: 'Past Estimates', locked: true },
    ],
  },
  {
    label: 'KPI Dashboard',
    locked: true,
    items: [
      { href: '#', icon: '📊', label: 'Revenue Tracker', locked: true },
      { href: '#', icon: '🎯', label: '$20M Goal', locked: true },
      { href: '#', icon: '👥', label: 'Team Performance', locked: true },
    ],
  },
]

const RECENT_SESSIONS = [
  { label: 'Apr 30 · Leadership', href: '/sessions/a1b2c3d4-0006-0006-0006-000000000006' },
  { label: 'Mar 27 · Q2 Planning', href: '/sessions/a1b2c3d4-0003-0003-0003-000000000003' },
  { label: 'Feb 27 · Leadership', href: '/sessions/a1b2c3d4-0001-0001-0001-000000000001' },
]

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

function getDisplayName(user: User | null): string {
  if (!user) return 'Loading…'
  const meta = user.user_metadata as Record<string, string> | undefined
  return meta?.full_name ?? meta?.name ?? user.email ?? 'CASK User'
}

function getSubtitle(user: User | null): string {
  if (!user) return ''
  const meta = user.user_metadata as Record<string, string> | undefined
  return meta?.role ?? meta?.title ?? user.email ?? ''
}

function SideNavLink({ href, icon, label, isActive }: { href: string; icon: string; label: string; isActive: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-[9px] rounded-[6px] font-sans text-[13px] font-medium tracking-[-0.1px] no-underline"
      style={{
        paddingTop: '8px',
        paddingBottom: '8px',
        paddingRight: '10px',
        paddingLeft: isActive ? '10px' : hovered ? '14px' : '10px',
        background: isActive ? 'rgba(255,255,255,0.08)' : hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: isActive ? 'rgba(255,255,255,0.95)' : hovered ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)',
        transition: 'padding-left 180ms ease, background 180ms ease, color 180ms ease',
      }}
    >
      <span
        className="text-[13px] w-4 text-center shrink-0"
        style={{ opacity: isActive ? 0.9 : 0.5 }}
      >
        {icon}
      </span>
      {label}
    </Link>
  )
}

function SideRecentLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-[9px] rounded-[6px] font-sans text-[12px] font-normal tracking-[-0.1px] no-underline"
      style={{
        paddingTop: '7px',
        paddingBottom: '7px',
        paddingRight: '10px',
        paddingLeft: hovered ? '14px' : '10px',
        background: hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: 'rgba(255,255,255,0.45)',
        transition: 'padding-left 180ms ease, background 180ms ease',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.25)' }}>›</span>
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const displayName = getDisplayName(user)
  const subtitle = getSubtitle(user)
  const initials = user ? getInitials(
    (user.user_metadata as Record<string, string> | undefined)?.full_name ??
    (user.user_metadata as Record<string, string> | undefined)?.name,
    user.email
  ) : '…'

  return (
    <aside
      className="flex flex-col overflow-hidden relative"
      style={{ background: 'var(--sidebar)' }}
    >
      {/* Right border gradient */}
      <div
        className="absolute top-0 right-0 w-px h-full"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)',
        }}
      />

      {/* Header */}
      <div
        className="px-4 pt-[18px] pb-[14px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center">
            <Image
              src="/cask-logo-white.svg"
              alt="CASK"
              width={72}
              height={22}
              className="h-[22px] w-auto object-contain"
              priority
            />
          </div>
          <div
            className="w-px h-[18px] mx-1.5"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />
          <div>
            <div
              className="font-serif text-[15px] font-normal tracking-[0.2px]"
              style={{ color: 'rgba(255,255,255,0.88)' }}
            >
              Hub
            </div>
            <div
              className="text-[9px] font-sans font-medium tracking-[1.5px] uppercase"
              style={{ color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}
            >
              Leadership
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2.5 overflow-y-auto flex flex-col gap-px">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div
              className="text-[10px] font-medium tracking-[1.5px] uppercase px-2 pt-3 pb-1"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              {section.label}
              {section.locked && (
                <span
                  className="ml-2 text-[9px] font-semibold tracking-[0.8px] uppercase py-[2px] px-1.5 rounded-[3px]"
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  SOON
                </span>
              )}
            </div>
            {section.items.map((item) => {
              const isActive = !item.locked && pathname === item.href
              if (item.locked) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-[9px] px-2.5 py-2 rounded-[6px] opacity-40 cursor-not-allowed"
                    style={{ color: 'rgba(255,255,255,0.75)' }}
                  >
                    <span className="text-[13px] w-4 text-center opacity-50 shrink-0">{item.icon}</span>
                    <span className="font-sans text-[13px] font-medium tracking-[-0.1px]">{item.label}</span>
                    <span
                      className="ml-auto text-[9px] font-semibold tracking-[0.8px] uppercase py-[2px] px-1.5 rounded-[3px] shrink-0"
                      style={{
                        color: 'rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      SOON
                    </span>
                  </div>
                )
              }
              return (
                <SideNavLink
                  key={item.label}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={isActive}
                />
              )
            })}
          </div>
        ))}

        {/* Separator */}
        <div className="h-px my-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Recent Sessions */}
        <div
          className="text-[10px] font-medium tracking-[1.5px] uppercase px-2 pt-3 pb-1"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Recent Sessions
        </div>
        {RECENT_SESSIONS.map((s) => (
          <SideRecentLink key={s.href} href={s.href} label={s.label} />
        ))}

        {/* Upcoming */}
        <div
          className="mx-0.5 mt-2.5 rounded-lg p-3.5 relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, var(--red), #e8754a)' }}
          />
          <div
            className="text-[9px] font-semibold tracking-[1.5px] uppercase mb-1.5"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Upcoming
          </div>
          <div
            className="text-[12px] font-semibold mb-[3px] leading-tight"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            Leadership Meeting
          </div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            May 28, 2026 · 11am–3pm
          </div>
          <Link
            href="/generate"
            className="block w-full mt-2.5 text-center text-[11px] font-semibold text-white py-2 rounded-[5px] transition-colors no-underline"
            style={{ background: 'rgba(200,49,26,0.8)' }}
          >
            Prepare Agenda →
          </Link>
        </div>
      </nav>

      {/* Footer / User */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5 p-2 rounded-[6px]">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 tracking-[0.5px]"
            style={{ background: 'linear-gradient(135deg, var(--red), #e8754a)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12px] font-medium truncate"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {displayName}
            </div>
            {subtitle && (
              <div
                className="text-[10px] mt-[1px] truncate"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            className="shrink-0 rounded-[5px] p-1.5 transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
