'use client'
// src/components/ui/index.tsx
// Shared UI components matching the HTML prototype

import Link from 'next/link'
import { useState } from 'react'
import type { Meeting, ActionItem } from '@/types'

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
      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </div>
  )
}

// ── Status Pills ─────────────────────────────────────────────────────
export function PillGreen({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full tracking-[0.1px]"
      style={{
        background: 'var(--green-bg)',
        color: 'var(--green)',
        border: '1px solid #bbf7d0',
      }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full status-blink"
        style={{ background: 'var(--green)' }}
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
        background: 'var(--red-soft)',
        color: 'var(--red)',
        border: '1px solid var(--red-border)',
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
    color: 'var(--red)',
    border: 'var(--red-border)',
    label: 'Leadership',
  },
  planning: {
    bg: '#f0fdf4',
    color: '#166534',
    border: '#bbf7d0',
    label: 'Planning',
  },
  coaching: {
    bg: 'var(--amber-bg)',
    color: 'var(--amber)',
    border: '#fde68a',
    label: 'Coaching',
  },
  education: {
    bg: '#faf5ff',
    color: '#6d28d9',
    border: '#e9d5ff',
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
  leadership: 'rgba(200, 49, 26, 0.10)',
  planning: 'rgba(5, 150, 105, 0.10)',
  coaching: 'rgba(217, 119, 6, 0.10)',
  education: 'rgba(124, 58, 237, 0.10)',
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
        background: hovered ? '#fafaf9' : 'var(--white)',
        border: hovered ? '1px solid var(--border2)' : '1px solid var(--border)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? `-3px 0 16px ${glowColor}, 0 4px 16px rgba(0,0,0,0.06)`
          : 'none',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 150ms ease, background 150ms ease',
      }}
    >
      {/* Left accent — full height, clipped by overflow-hidden */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[4px]"
        style={{ background: accentColor }}
      />

      {/* Date */}
      <div className="text-center shrink-0 w-11 ml-1">
        <div
          className="font-serif text-[28px] leading-none"
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
        className="text-[16px] shrink-0"
        style={{
          color: 'var(--text3)',
          transform: hovered ? 'translateX(2px)' : 'translateX(0)',
          transition: 'transform 150ms ease',
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

  function toggle() {
    const next = !done
    setDone(next)
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
        background: 'var(--white)',
        border: hovered ? '1px solid var(--border2)' : '1px solid var(--border)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 150ms ease',
      }}
    >
      {/* Left accent stripe — amber for open, green for done */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: done ? 'var(--green)' : 'var(--amber)' }}
      />

      {/* Checkbox */}
      <button
        onClick={toggle}
        className="w-4 h-4 rounded-[4px] flex items-center justify-center transition-all duration-150 shrink-0 mt-[1px]"
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
          style={{ color: done ? 'var(--text3)' : 'var(--text)' }}
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
          className="text-[10px] font-semibold shrink-0 mt-0.5 px-2 py-[3px] rounded-full"
          style={
            done
              ? { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #bbf7d0' }
              : { background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid #fde68a' }
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
  const variants = {
    default: {
      background: 'var(--white)',
      border: hovered ? '1px solid var(--border2)' : '1px solid var(--border)',
      topAccent: 'var(--charcoal)',
      valueColor: 'var(--text)',
      iconColor: 'var(--text3)',
    },
    alert: {
      background: 'linear-gradient(135deg, var(--white) 0%, var(--red-soft) 100%)',
      border: hovered ? '1px solid #e8a49d' : '1px solid var(--red-border)',
      topAccent: 'var(--red)',
      valueColor: 'var(--red)',
      iconColor: 'var(--red)',
    },
    success: {
      background: 'linear-gradient(135deg, var(--white) 0%, #f0fdf4 100%)',
      border: hovered ? '1px solid #86efac' : '1px solid #bbf7d0',
      topAccent: '#059669',
      valueColor: '#166534',
      iconColor: '#059669',
    },
  }
  const v = variants[variant]
  const animClass = ['animate-card-in-1', 'animate-card-in-2', 'animate-card-in-3', 'animate-card-in-4'][index] || ''

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden rounded-[10px] p-5 cursor-default ${animClass}`}
      style={{
        background: v.background,
        border: v.border,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 150ms ease',
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
          style={{ color: v.iconColor, opacity: hovered ? 0.7 : 0.35, transition: 'opacity 180ms ease' }}
        >
          {icon}
        </div>
      )}

      <div
        className="font-serif text-[42px] leading-none tracking-[-2px] mt-1"
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
        borderLeft: '2px solid var(--red)',
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
