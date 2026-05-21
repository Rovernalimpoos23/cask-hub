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

// ── Meeting Card ─────────────────────────────────────────────────────
export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const date = new Date(meeting.date + 'T00:00:00')
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const borderColor = LEFT_BORDER_COLOR[meeting.meeting_type] || 'var(--border)'

  return (
    <Link
      href={`/sessions/${meeting.id}`}
      className="group no-underline flex items-center gap-[18px] px-5 py-4 rounded-[10px] cursor-pointer transition-all duration-200 relative"
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Left accent border */}
      <div
        className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r-[3px]"
        style={{ background: borderColor }}
      />

      {/* Date */}
      <div className="text-center shrink-0 w-11">
        <div
          className="font-serif text-[24px] leading-none"
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
      <div className="w-px h-8 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-semibold tracking-[-0.2px] truncate mb-1 transition-colors group-hover:text-[var(--text)]"
          style={{ color: 'var(--text)' }}
        >
          {meeting.title}
        </div>
        <div className="text-[11px] flex gap-3" style={{ color: '#78716c' }}>
          <span className="truncate">{meeting.attendees.join(', ')}</span>
          {meeting.time_start && meeting.time_end && (
            <span className="shrink-0">{meeting.time_start} – {meeting.time_end}</span>
          )}
        </div>
      </div>

      <MeetingTypeTag type={meeting.meeting_type} />

      <span
        className="text-[16px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ color: 'var(--text3)' }}
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
      className="flex items-start gap-3 px-3.5 py-3 rounded-[6px] transition-all duration-200 hover:-translate-y-px"
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={toggle}
        className="w-4 h-4 rounded-[4px] flex items-center justify-center transition-all duration-150 shrink-0 mt-[1px]"
        style={
          done
            ? { background: 'var(--green)', border: '1.5px solid var(--green)' }
            : {
                background: 'transparent',
                border: '1.5px solid var(--border2)',
              }
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
          className={`text-[12px] font-medium leading-relaxed ${done ? 'line-through' : ''}`}
          style={{ color: done ? 'var(--text3)' : 'var(--text)' }}
        >
          {item.task}
        </div>
        <div className="text-[10px] mt-0.5 flex gap-2" style={{ color: 'var(--text3)' }}>
          <span>👤 {item.owner}</span>
        </div>
      </div>

      {/* Due date */}
      {dueDate && (
        <div
          className="text-[10px] font-semibold shrink-0 mt-0.5"
          style={{ color: done ? 'var(--green)' : 'var(--amber)' }}
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
}: {
  value: string | number
  label: string
  hint?: string
  variant?: 'default' | 'alert' | 'success'
  index?: number
}) {
  const variants = {
    default: {
      background: 'var(--white)',
      border: '1px solid var(--border)',
      accent: 'var(--border)',
      valueColor: 'var(--text)',
    },
    alert: {
      background: 'linear-gradient(135deg, var(--white) 0%, var(--red-soft) 100%)',
      border: '1px solid var(--red-border)',
      accent: 'var(--red)',
      valueColor: 'var(--red)',
    },
    success: {
      background: 'linear-gradient(135deg, var(--white) 0%, #f0fdf4 100%)',
      border: '1px solid #bbf7d0',
      accent: '#059669',
      valueColor: '#166534',
    },
  }
  const v = variants[variant]
  const animClass = ['animate-card-in-1', 'animate-card-in-2', 'animate-card-in-3', 'animate-card-in-4'][index] || ''

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] p-5 transition-all duration-200 cursor-default hover:-translate-y-0.5 ${animClass}`}
      style={{ background: v.background, border: v.border }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[10px] transition-colors duration-200"
        style={{ background: v.accent }}
      />
      <div
        className="font-serif text-[34px] leading-none tracking-[-1px]"
        style={{ color: v.valueColor }}
      >
        {value}
      </div>
      <div
        className="text-[11px] font-semibold tracking-[0.3px] mt-2"
        style={{ color: '#78716c' }}
      >
        {label}
      </div>
      {hint && (
        <div className="text-[10px] mt-[3px] font-normal" style={{ color: 'var(--text3)' }}>
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
      className="text-[11px] font-semibold tracking-[1px] uppercase flex items-center justify-between mb-3"
      style={{ color: 'var(--text3)' }}
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
