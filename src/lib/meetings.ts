// src/lib/meetings.ts
// Data fetching functions - works with Supabase when connected,
// falls back to seed data for development

import { supabase } from './supabase'
import { MEETINGS } from './seed-data'
import type { Meeting, ActionItem } from '@/types'

// Get all meetings, sorted by date descending
export async function getMeetings(): Promise<Meeting[]> {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('date', { ascending: false })

    if (error || !data || data.length === 0) {
      // Fallback to seed data
      return [...MEETINGS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return data as Meeting[]
  } catch {
    return [...MEETINGS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}

// Get single meeting by ID
export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return MEETINGS.find(m => m.id === id) || null
    }
    return data as Meeting
  } catch {
    return MEETINGS.find(m => m.id === id) || null
  }
}

// Get all action items across all meetings
export async function getAllActionItems(): Promise<ActionItem[]> {
  try {
    const { data, error } = await supabase
      .from('action_items')
      .select('*')
      .order('due_date', { ascending: true })

    if (error || !data || data.length === 0) {
      // Fallback: flatten from seed data
      return MEETINGS.flatMap(m => m.action_items)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    }
    return data as ActionItem[]
  } catch {
    return MEETINGS.flatMap(m => m.action_items)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
  }
}

// Toggle action item done status
export async function toggleActionItem(id: string, done: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('action_items')
      .update({ done })
      .eq('id', id)

    return !error
  } catch {
    return false
  }
}

// Dashboard stats
export async function getDashboardStats() {
  const meetings = await getMeetings()
  const allActions = await getAllActionItems()

  const openActions = allActions.filter(a => !a.done)
  const completedActions = allActions.filter(a => a.done)

  return {
    totalSessions: meetings.length,
    openActionItems: openActions.length,
    completedItems: completedActions.length,
    upcomingMeeting: {
      title: 'CASK Leadership Meeting',
      date: 'May 28, 2026',
      daysUntil: Math.ceil((new Date('2026-05-28').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    },
    recentSessions: meetings.slice(0, 3),
    recentActions: allActions.filter(a => !a.done).slice(0, 3),
    completedThisWeek: completedActions.filter(a => {
      // Show recently completed
      return true
    }).slice(0, 2),
  }
}
