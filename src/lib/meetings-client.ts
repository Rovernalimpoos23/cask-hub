// src/lib/meetings-client.ts
import { createClient } from './supabase'
import { MEETINGS } from './seed-data'
import type { Meeting, ActionItem } from '@/types'

function seedSorted(): Meeting[] {
  return [...MEETINGS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export async function fetchAllMeetings(): Promise<Meeting[]> {
  try {
    const { data, error } = await createClient()
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[meetings] Supabase error fetching meetings:', error.message, error.details ?? '')
      return seedSorted()
    }
    if (!data) return seedSorted()
    if (data.length === 0) return []

    // Debug: log each row individually so values are visible in console (not collapsed)
    console.log(`[meetings] ${data.length} rows from Supabase:`)
    data.forEach((m: Meeting, i: number) => {
      console.log(`  [${i}] "${m.title}" | date="${m.date}" | created_at="${m.created_at}"`)
    })

    // Parse a date value safely — returns 0 for null/undefined/invalid so those sort last
    function toMs(val: string | null | undefined): number {
      if (!val) return 0
      const ms = new Date(val).getTime()
      return isNaN(ms) ? 0 : ms
    }

    const sorted = [...data].sort((a: Meeting, b: Meeting) => {
      const dateDiff = toMs(b.date) - toMs(a.date)
      if (dateDiff !== 0) return dateDiff
      return toMs(b.created_at) - toMs(a.created_at)
    })

    console.log('[meetings] after client sort:')
    sorted.forEach((m: Meeting, i: number) => {
      console.log(`  [${i}] "${m.title}" | date="${m.date}" | created_at="${m.created_at}"`)
    })

    return sorted as Meeting[]
  } catch (err) {
    console.error('[meetings] unexpected error fetching meetings:', err)
    return seedSorted()
  }
}

export async function fetchMeetingById(id: string): Promise<Meeting | null> {
  try {
    const { data, error } = await createClient()
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return MEETINGS.find(m => m.id === id) ?? null
    return data as Meeting
  } catch {
    return MEETINGS.find(m => m.id === id) ?? null
  }
}

export async function fetchMeetingsByModule(module: string): Promise<Meeting[]> {
  try {
    const { data, error } = await createClient()
      .from('meetings')
      .select('*')
      .eq('module', module)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data as Meeting[]
  } catch {
    return []
  }
}

export async function updateActionItemDone(
  meetingId: string,
  actionId: string,
  done: boolean,
  currentItems: ActionItem[]
): Promise<void> {
  try {
    const updated = currentItems.map(item =>
      item.id === actionId ? { ...item, done } : item
    )
    await createClient()
      .from('meetings')
      .update({ action_items: updated })
      .eq('id', meetingId)
  } catch {
    // best-effort — local state already updated
  }
}
