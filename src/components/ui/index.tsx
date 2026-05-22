'use client'
// src/components/ui/index.tsx

import Link from 'next/link'
import { useState } from 'react'
import { useTheme } from '@/lib/theme-context'
import type { Meeting, ActionItem } from '@/types'

// ── Theme Toggle Button ──────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()
  const isDark = theme === 'dark'

  const btnStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'inherit',
    opacity: mounted ? 1 : 0,
  }

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={btnStyle}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--border)'
        e.currentTarget.style.color = 'var(--text2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.color = 'var(--text3)'
      }}
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', opacity: mounted && isDark ? 1 : 0 }}
      >
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', opacity: mounted && !isDark ? 1 : 0 }}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
  )
}

// ── TopBar ──────────────────────────────────────────────────────────
export function TopBar({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className="h-[52px] px-7 flex items-center gap-3 shrink-0"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--white)',
      }}
    >
      <span
        className="text-[14px] font-semibold tracking-[-0.2px]"
        style={{ color: 'var(--text)' }}
      >
        {title}
      </span>
      {subtitle && (
        <>
          <span
            className="w-px h-[14px] shrink-0"
            style={{ background: 'var(--border2)' }}
          />
          <span className="text-[13px] font-normal" style={{ color: 'var(--text3)' }}>
            {subtitle}
          </span>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {children}
        <ThemeToggle />
      </div>
    </div>
  )
}

// ── Status Pills ─────────────────────────────────────────────────────
export function PillGreen({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full tracking-[0.1px]"
      style={{
        background: 'var(--pill-green-bg)',
        color: 'var(--pill-green-color)',
        border: '1px solid var(--pill-green-border)',
      }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full status-blink"
        style={{ background: 'var(--pill-green-color)' }}
      />
      {children}
    </span>
  )
}

export function PillRed({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full tracking-[0.1px]"
      style={{
        background: 'var(--pill-red-bg)',
        color: 'var(--pill-red-color)',
        border: '1px solid var(--pill-red-border)',
      }}
    >
      {children}
    </span>
  )
}

// ── Meeting Type Tag ─────────────────────────────────────────────────
const TYPE_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  leadership: {
    bg: 'var(--red-soft)',
    color: 'var(--tag-leadership-color)',
    border: 'var(--red-border)',
    label: 'Leadership',
  },
  planning: {
    bg: 'var(--green-bg)',
    color: 'var(--tag-planning-color)',
    border: 'var(--tag-planning-border)',
    label: 'Planning',
  },
  coaching: {
    bg: 'var(--amber-bg)',
    color: 'var(--tag-coaching-color)',
    border: 'var(--tag-coaching-border)',
    label: 'Coaching',
  },
  education: {
    bg: 'var(--purple-bg)',
    color: 'var(--tag-education-color)',
    border: 'var(--purple-border)',
    label: 'Education',
  },
}

export function MeetingTypeTag({ type }: { type: string }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.leadership
  return (
    <span
      className="text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-[0.2px] shrink-0"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {style.label}
    </span>
  )
}

// ── Left border color for meeting type ───────────────────────────────
const LEFT_BORDER_COLOR: Record<string, string> = {
  leadership: 'var(--red)',
  planning: '#059669',
  coaching: '#d97706',
  education: '#7c3aed',
}

// ── Glow colors for meeting type left hover ───────────────────────────
const LEFT_GLOW_COLOR: Record<string, string> = {
  leadership: 'rgba(200, 49, 26, 0.12)',
  planning: 'rgba(5, 150, 105, 0.12)',
  coaching: 'rgba(217, 119, 6, 0.12)',
  education: 'rgba(124, 58, 237, 0.12)',
}

// ── Meeting Card ─────────────────────────────────────────────────────
export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [hovered, setHovered] = useState(false)
  const date = new Date(meeting.date + 'T00:00:00')
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const accentColor = LEFT_BORDER_COLOR[meeting.meeting_type] || 'var(--border)'
  const glowColor = LEFT_GLOW_COLOR[meeting.meeting_type] || 'transparent'

  return (
    <Link
      href={`/sessions/${meeting.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group no-underline flex items-center gap-5 pl-6 pr-5 py-[18px] rounded-[10px] cursor-pointer relative overflow-hidden"
      style={{
        background: hovered ? 'var(--glass-card-hover-bg)' : 'var(--glass-card-bg)',
        backdropFilter: 'var(--card-backdrop)',
        WebkitBackdropFilter: 'var(--card-backdrop)',
        border: hovered
          ? `1px solid var(--glass-card-hover-border)`
          : '1px solid var(--glass-card-border)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? `-4px 0 20px ${glowColor}, var(--glass-card-hover-shadow)`
          : 'var(--glass-card-shadow)',
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 150ms ease, background 150ms ease',
      }}
    >
      {/* Left accent — full height, 4px wide */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[4px]"
        style={{ background: accentColor }}
      />

      {/* Date */}
      <div className="text-center shrink-0 w-11 ml-1">
        <div
          className="font-sans text-[28px] leading-none font-light tracking-[-1px]"
          style={{ color: 'var(--text)' }}
        >
          {day}
        </div>
        <div
          className="text-[9px] font-semibold tracking-[1.5px] uppercase mt-0.5"
          style={{ color: 'var(--text3)' }}
        >
          {month}
        </div>
      </div>

      {/* Rule */}
      <div className="w-px h-9 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] font-semibold tracking-[-0.3px] truncate mb-[3px]"
          style={{ color: 'var(--text)' }}
        >
          {meeting.title}
        </div>
        <div className="text-[11px] flex gap-3" style={{ color: 'var(--text3)' }}>
          <span className="truncate">{meeting.attendees.join(', ')}</span>
          {meeting.time_start && meeting.time_end && (
            <span className="shrink-0">{meeting.time_start} – {meeting.time_end}</span>
          )}
        </div>
      </div>

      <MeetingTypeTag type={meeting.meeting_type} />

      <span
        className="text-[16px] shrink-0 font-light"
        style={{
          color: hovered ? 'var(--text2)' : 'var(--text3)',
          transform: hovered ? 'translateX(3px)' : 'translateX(0)',
          transition: 'transform 150ms ease, color 150ms ease',
          display: 'inline-block',
        }}
      >
        ›
      </span>
    </Link>
  )
}

// ── Action Item Row ──────────────────────────────────────────────────
export function ActionItemRow({
  item,
  onToggle,
}: {
  item: ActionItem
  onToggle?: (id: string, done: boolean) => void
}) {
  const [done, setDone] = useState(item.done)
  const [hovered, setHovered] = useState(false)
  const [springKey, setSpringKey] = useState(0)

  function toggle() {
    const next = !done
    setDone(next)
    setSpringKey(k => k + 1)
    onToggle?.(item.id, next)
  }

  const dueDate = item.due_date
    ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-start gap-3 pl-5 pr-3.5 py-3 rounded-[6px] overflow-hidden"
      style={{
        background: 'var(--glass-action-bg)',
        backdropFilter: 'var(--card-backdrop)',
        WebkitBackdropFilter: 'var(--card-backdrop)',
        border: hovered ? '1px solid var(--border2)' : '1px solid var(--glass-action-border)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.03)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 150ms ease',
      }}
    >
      {/* Left accent stripe — amber for open, green for done */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: done ? 'var(--green)' : '#d97706',
          transition: 'background 0.25s ease',
        }}
      />

      {/* Checkbox — spring effect via key remount */}
      <button
        key={springKey}
        onClick={toggle}
        className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 mt-[1px] ${springKey > 0 ? 'animate-spring' : ''}`}
        style={
          done
            ? { background: 'var(--green)', border: '1.5px solid var(--green)' }
            : { background: 'transparent', border: '1.5px solid var(--border2)' }
        }
      >
        {done && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] font-medium leading-relaxed ${done ? 'line-through' : ''}`}
          style={{ color: done ? 'var(--text3)' : 'var(--text)', transition: 'color 0.2s ease' }}
        >
          {item.task}
        </div>
        <div className="text-[10px] mt-0.5 flex gap-2" style={{ color: 'var(--text3)' }}>
          <span>👤 {item.owner}</span>
        </div>
      </div>

      {/* Due date badge */}
      {dueDate && (
        <div
          className="text-[10px] font-semibold shrink-0 mt-0.5 px-2.5 py-[4px] rounded-full tracking-[0.2px]"
          style={
            done
              ? { background: 'var(--green-bg)', color: 'var(--tag-planning-color)', border: '1px solid var(--badge-done-border)' }
              : { background: 'var(--amber-bg)', color: 'var(--tag-coaching-color)', border: '1px solid var(--badge-open-border)' }
          }
        >
          {done ? 'Done ✓' : dueDate}
        </div>
      )}
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────
export function StatCard({
  value,
  label,
  hint,
  variant = 'default',
  index = 0,
  icon,
}: {
  value: string | number
  label: string
  hint?: string
  variant?: 'default' | 'alert' | 'success'
  index?: number
  icon?: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  const variantStyles = {
    default: {
      background: 'var(--glass-stat-bg)',
      border: hovered ? '1px solid var(--border2)' : '1px solid var(--glass-stat-border)',
      topAccent: 'var(--charcoal)',
      valueColor: 'var(--text)',
      iconColor: 'var(--text3)',
    },
    alert: {
      background: 'var(--glass-stat-alert-bg)',
      border: hovered ? '1px solid var(--glass-stat-alert-hover-border)' : '1px solid var(--glass-stat-alert-border)',
      topAccent: 'var(--red)',
      valueColor: 'var(--red)',
      iconColor: 'var(--red)',
    },
    success: {
      background: 'var(--glass-stat-success-bg)',
      border: hovered ? '1px solid var(--glass-stat-success-hover-border)' : '1px solid var(--glass-stat-success-border)',
      topAccent: '#059669',
      valueColor: 'var(--tag-planning-color)',
      iconColor: '#059669',
    },
  }
  const v = variantStyles[variant]
  const animClass = ['animate-card-in-1', 'animate-card-in-2', 'animate-card-in-3', 'animate-card-in-4'][index] || ''

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden rounded-[10px] p-5 cursor-default ${animClass}`}
      style={{
        background: v.background,
        backdropFilter: 'var(--card-backdrop)',
        WebkitBackdropFilter: 'var(--card-backdrop)',
        border: v.border,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--glass-stat-hover-shadow)' : 'var(--glass-stat-shadow)',
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 150ms ease',
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: v.topAccent }}
      />

      {/* Icon — top right */}
      {icon && (
        <div
          className="absolute top-4 right-4"
          style={{ color: v.iconColor, opacity: hovered ? 0.75 : 0.38, transition: 'opacity 200ms ease' }}
        >
          {icon}
        </div>
      )}

      <div
        className="font-sans text-[44px] leading-none tracking-[-2.5px] mt-1 font-light"
        style={{ color: v.valueColor }}
      >
        {value}
      </div>
      <div
        className="text-[11px] font-semibold tracking-[0.4px] mt-2.5 uppercase"
        style={{ color: 'var(--text3)' }}
      >
        {label}
      </div>
      {hint && (
        <div className="text-[10px] mt-[3px] font-normal" style={{ color: 'var(--text3)', opacity: 0.7 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

// ── Section Label ─────────────────────────────────────────────────────
export function SectionLabel({
  children,
  action,
  onAction,
  href,
}: {
  children: React.ReactNode
  action?: string
  onAction?: () => void
  href?: string
}) {
  return (
    <div
      className="text-[11px] font-semibold tracking-[1.5px] uppercase flex items-center justify-between mb-3"
      style={{
        color: 'var(--text3)',
        borderLeft: '3px solid var(--red)',
        paddingLeft: '10px',
      }}
    >
      {children}
      {action && href && (
        <Link
          href={href}
          className="text-[12px] font-medium normal-case tracking-normal no-underline hover:underline"
          style={{ color: 'var(--red)' }}
        >
          {action}
        </Link>
      )}
      {action && onAction && (
        <button
          onClick={onAction}
          className="text-[12px] font-medium normal-case tracking-normal hover:underline"
          style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

// ── Filter Tabs ──────────────────────────────────────────────────────
export function FilterBar({
  tabs,
  active,
  onSelect,
  count,
}: {
  tabs: { value: string; label: string }[]
  active: string
  onSelect: (v: string) => void
  count?: number
}) {
  return (
    <div
      className="flex gap-1.5 mb-4 pb-3 items-center"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onSelect(tab.value)}
          className="text-[12px] font-medium px-3 py-[5px] rounded-[5px] transition-all duration-150"
          style={{
            background: active === tab.value ? 'var(--charcoal)' : 'none',
            color: active === tab.value ? 'white' : 'var(--text3)',
            border: 'none',
            fontFamily: 'var(--font-geist), sans-serif',
            cursor: 'pointer',
          }}
        >
          {tab.label}
        </button>
      ))}
      {count !== undefined && (
        <span className="ml-auto text-[11px] font-medium" style={{ color: 'var(--text3)' }}>
          {count} sessions
        </span>
      )}
    </div>
  )
}
