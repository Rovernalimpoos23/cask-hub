'use client'
// src/components/ui/DateRangeFilter.tsx
//
// Shared date-range filter used by All Sessions and Daily Meetings Recap.
// Renders a row of pill buttons (All Time / This Month / Last Month / Custom).
// When "Custom" is active, two inline date inputs (From / To) appear.
//
// Pill styling mirrors the existing category filter tabs exactly:
//   active   → charcoal-filled (bg var(--text), text var(--bg))
//   inactive → surface2 with a border
// Everything is driven off CSS variables so it adapts to light/dark mode.
//
// Filtering itself is done by the parent via `matchesDateRange` (exported below),
// so this component only owns the UI + value shape.

export type DateRangeType = 'all' | 'this_month' | 'last_month' | 'custom'

export interface DateRangeValue {
  type: DateRangeType
  from?: string // YYYY-MM-DD (custom only)
  to?: string   // YYYY-MM-DD (custom only)
}

// Note: "All Time" (type 'all') remains the default/reset state functionally,
// but is intentionally not rendered as a pill.
const PILLS: { value: DateRangeType; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom' },
]

// ── Range helpers ────────────────────────────────────────────────────
// Returns the inclusive [start, end] YYYY-MM-DD bounds for a preset, using the
// current date dynamically. `null` means "no bound" (i.e. All Time).
function monthBounds(year: number, month0: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month0 + 1)}-01`
  // Day 0 of the next month = last day of this month.
  const last = new Date(year, month0 + 1, 0).getDate()
  const end = `${year}-${pad(month0 + 1)}-${pad(last)}`
  return { start, end }
}

/**
 * Decides whether a meeting date (YYYY-MM-DD string) falls within the selected
 * range. All comparisons are lexicographic on the ISO date string, which is
 * correct for the YYYY-MM-DD format. Meetings without a valid date are excluded
 * only when an actual range is active (All Time keeps everything).
 */
export function matchesDateRange(meetingDate: string | undefined | null, value: DateRangeValue): boolean {
  if (value.type === 'all') return true
  if (!meetingDate) return false

  // Normalize to the YYYY-MM-DD prefix in case a timestamp slips through.
  const d = meetingDate.slice(0, 10)

  if (value.type === 'this_month') {
    const now = new Date()
    const { start, end } = monthBounds(now.getFullYear(), now.getMonth())
    return d >= start && d <= end
  }

  if (value.type === 'last_month') {
    const now = new Date()
    // month - 1; Date rolls the year over automatically for January.
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const { start, end } = monthBounds(prev.getFullYear(), prev.getMonth())
    return d >= start && d <= end
  }

  // custom — inclusive between from/to; either bound is optional.
  if (value.from && d < value.from) return false
  if (value.to && d > value.to) return false
  return true
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      {PILLS.map((pill) => {
        const isActive = value.type === pill.value
        return (
          <button
            key={pill.value}
            onClick={() =>
              onChange(
                pill.value === 'custom'
                  ? { type: 'custom', from: value.from, to: value.to }
                  : { type: pill.value },
              )
            }
            className="text-[12px] font-medium px-3 py-[5px] rounded-[5px] transition-all duration-150"
            style={{
              background: isActive ? 'var(--text)' : 'var(--surface2)',
              color: isActive ? 'var(--bg)' : 'var(--text2)',
              border: isActive ? '1px solid var(--text)' : '1px solid var(--border)',
              fontFamily: 'var(--font-geist), sans-serif',
              cursor: 'pointer',
            }}
          >
            {pill.label}
          </button>
        )
      })}

      {/* Inline From / To date inputs — only while Custom is active. */}
      {value.type === 'custom' && (
        <span className="flex flex-wrap items-center gap-1.5 ml-1">
          <label className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}>
            From
          </label>
          <input
            type="date"
            value={value.from ?? ''}
            onChange={(e) => onChange({ type: 'custom', from: e.target.value || undefined, to: value.to })}
            className="text-[12px] px-2 py-[4px] rounded-[5px] outline-none"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-geist), sans-serif',
              colorScheme: 'light dark',
            }}
          />
          <label className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}>
            To
          </label>
          <input
            type="date"
            value={value.to ?? ''}
            onChange={(e) => onChange({ type: 'custom', from: value.from, to: e.target.value || undefined })}
            className="text-[12px] px-2 py-[4px] rounded-[5px] outline-none"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-geist), sans-serif',
              colorScheme: 'light dark',
            }}
          />
        </span>
      )}
    </div>
  )
}
