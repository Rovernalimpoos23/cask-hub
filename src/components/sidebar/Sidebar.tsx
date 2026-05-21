'use client'
// src/components/sidebar/Sidebar.tsx

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import clsx from 'clsx'

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

export default function Sidebar() {
  const pathname = usePathname()

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
                <Link
                  key={item.label}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-[9px] px-2.5 py-2 rounded-[6px] font-sans text-[13px] font-medium tracking-[-0.1px] transition-all duration-[180ms] no-underline',
                    isActive
                      ? 'bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.95)]'
                      : 'text-[rgba(255,255,255,0.75)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.92)] hover:pl-3.5'
                  )}
                >
                  <span
                    className={clsx(
                      'text-[13px] w-4 text-center shrink-0',
                      isActive ? 'opacity-90' : 'opacity-50'
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
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
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-[9px] px-2.5 py-[7px] rounded-[6px] font-sans text-[12px] font-normal tracking-[-0.1px] transition-all duration-[180ms] no-underline hover:bg-[rgba(255,255,255,0.07)] hover:pl-3.5"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>›</span>
            {s.label}
          </Link>
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
            RA
          </div>
          <div>
            <div
              className="text-[12px] font-medium"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              Rovern Alimpoos
            </div>
            <div
              className="text-[10px] mt-[1px]"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              AI Workflow Specialist
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
