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
      .order('date', { ascending: false })

    if (error || !data || data.length === 0) return seedSorted()
    return data as Meeting[]
  } catch {
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
