import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MEETINGS } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  return await seedData()
}

export async function POST() {
  return await seedData()
}

async function seedData() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const results = []

    for (const meeting of MEETINGS) {
      const { error } = await supabase
        .from('meetings')
        .upsert({
          id: meeting.id,
          title: meeting.title,
          date: meeting.date,
          time_start: meeting.time_start,
          time_end: meeting.time_end,
          attendees: meeting.attendees,
          summary: meeting.summary,
          action_items: meeting.action_items,
          key_decisions: meeting.key_decisions,
          full_transcript: meeting.full_transcript,
          meeting_type: meeting.meeting_type,
          owner: meeting.owner,
          module: meeting.module,
        }, { onConflict: 'id' })

      results.push({
        title: meeting.title,
        status: error ? 'error' : 'seeded',
        error: error?.message
      })
    }

    return NextResponse.json({
      success: true,
      total: MEETINGS.length,
      results
    })

  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err)
    }, { status: 500 })
  }
}
