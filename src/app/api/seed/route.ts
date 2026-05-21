// src/app/api/seed/route.ts
// Run once: POST /api/seed to populate Supabase with all real meeting data
// Protect this with a secret in production!

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { MEETINGS } from '@/lib/seed-data'

export async function POST(req: NextRequest) {
  // Simple protection - require a secret header
  const secret = req.headers.get('x-seed-secret')
  if (secret !== process.env.SEED_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const results = []

    for (const meeting of MEETINGS) {
      // Insert meeting (without action_items as separate table entries)
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .upsert({
          id: meeting.id,
          title: meeting.title,
          date: meeting.date,
          time_start: meeting.time_start,
          time_end: meeting.time_end,
          attendees: meeting.attendees,
          summary: meeting.summary,
          action_items: meeting.action_items, // stored as jsonb too
          key_decisions: meeting.key_decisions,
          full_transcript: meeting.full_transcript,
          meeting_type: meeting.meeting_type,
          owner: meeting.owner,
          module: meeting.module,
        })
        .select()
        .single()

      if (meetingError) {
        results.push({ meeting: meeting.title, error: meetingError.message })
        continue
      }

      // Insert action items to the separate table
      for (const item of meeting.action_items) {
        await supabase
          .from('action_items')
          .upsert({
            id: item.id,
            meeting_id: meeting.id,
            task: item.task,
            owner: item.owner,
            due_date: item.due_date,
            done: item.done,
          })
      }

      results.push({ meeting: meeting.title, status: 'seeded' })
    }

    // Seed initial user
    await supabase.from('users').upsert({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Rovern Alimpoos',
      email: 'rovern@caskconstruction.com',
      role: 'ai_specialist',
      avatar_initials: 'RA',
    })

    return NextResponse.json({
      success: true,
      results,
      message: `Seeded ${MEETINGS.length} meetings successfully.`,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Seed failed', details: String(error) },
      { status: 500 }
    )
  }
}
