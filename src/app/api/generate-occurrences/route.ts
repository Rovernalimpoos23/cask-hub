// src/app/api/generate-occurrences/route.ts
// Expands a recurring calendar event into individual occurrences with pure
// date math (no Claude), then batch-inserts them into Supabase calendar_events.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const MAX_OCCURRENCES = 365

// Map the lowercase day names sent by the client to JS getUTCDay() indices.
const DOW: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

// Parse a naive "YYYY-MM-DDTHH:mm:ss" wall-clock string into a UTC Date so all
// arithmetic preserves the original time-of-day regardless of server timezone.
function parseNaive(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = String(value).match(
    /(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  )
  if (!m) return null
  return new Date(
    Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
  )
}

// Format a UTC Date back into the same naive "YYYY-MM-DDTHH:mm:ss" string.
function formatNaive(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

export async function POST(req: NextRequest) {
  const {
    title,
    start_time,
    end_time,
    location,
    recurring_frequency,
    recurring_days,
    recurring_indefinite,
    recurring_until,
    recurring_id,
    event_id,
  } = await req.json()

  console.log('Generate occurrences — received times:', { start_time, end_time })

  const start = parseNaive(start_time)
  if (!start) {
    return NextResponse.json({ error: 'Invalid start_time' }, { status: 400 })
  }

  const end = parseNaive(end_time)
  const durationMs = end && end.getTime() > start.getTime() ? end.getTime() - start.getTime() : 0
  const hasEnd = durationMs > 0

  // Window end = 12 months from start, capped by recurring_until if it's sooner.
  const limit = new Date(start)
  limit.setUTCMonth(limit.getUTCMonth() + 12)
  const until = parseNaive(recurring_until ? `${recurring_until}T23:59:59` : null)
  if (until && until.getTime() < limit.getTime()) {
    limit.setTime(until.getTime())
  }

  // Collect occurrence start dates based on frequency.
  const starts: Date[] = []
  const cursor = new Date(start)

  if (recurring_frequency === 'Custom') {
    const wanted = new Set(
      (Array.isArray(recurring_days) ? recurring_days : [])
        .map((d: string) => DOW[String(d).toLowerCase()])
        .filter((n: number | undefined) => n !== undefined)
    )
    while (cursor.getTime() <= limit.getTime() && starts.length < MAX_OCCURRENCES) {
      if (wanted.has(cursor.getUTCDay())) starts.push(new Date(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  } else {
    while (cursor.getTime() <= limit.getTime() && starts.length < MAX_OCCURRENCES) {
      starts.push(new Date(cursor))
      if (recurring_frequency === 'Daily') {
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      } else if (recurring_frequency === 'Weekly') {
        cursor.setUTCDate(cursor.getUTCDate() + 7)
      } else if (recurring_frequency === 'Monthly') {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      } else {
        break // unknown frequency — emit a single occurrence at start
      }
    }
  }

  // Whitelist the exact columns for the calendar_events insert.
  const occurrences = starts.map(occStart => ({
    title,
    start_time: formatNaive(occStart) + '-04:00',
    end_time: hasEnd ? formatNaive(new Date(occStart.getTime() + durationMs)) + '-04:00' : null,
    location: location || '',
    is_recurring: true,
    recurring_id,
    recurring_frequency,
    recurring_days,
    recurring_indefinite,
    event_id: crypto.randomUUID(),
    meeting_link: null,
  }))

  console.log('Generate occurrences — first occurrence before insert:', occurrences[0])

  try {
    const supabase = createClient()
    const { error } = await supabase.from('calendar_events').insert(occurrences)
    if (error) {
      console.error('Generate occurrences — Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save occurrences' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Generate occurrences — Supabase insert error:', error)
    return NextResponse.json(
      { error: 'Failed to save occurrences' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, count: occurrences.length })
}
