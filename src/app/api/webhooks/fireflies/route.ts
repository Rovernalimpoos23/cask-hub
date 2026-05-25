import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TRANSCRIPT_QUERY = `
  query GetTranscript($id: String!) {
    transcript(id: $id) {
      id
      title
      date
      duration
      meeting_attendees {
        displayName
        email
      }
      summary {
        overview
        action_items
        keywords
      }
      sentences {
        text
        speaker_name
      }
    }
  }
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('Fireflies webhook received:', JSON.stringify(body, null, 2))

    // Return 200 immediately so Fireflies doesn't retry
    const response = NextResponse.json({ success: true, received: true })

    const { event, meeting_id } = body

    if (event === 'meeting.transcribed' && meeting_id) {
      const ffRes = await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`,
        },
        body: JSON.stringify({
          query: TRANSCRIPT_QUERY,
          variables: { id: meeting_id },
        }),
      })

      const data = await ffRes.json()
      console.log('Fireflies full data:', JSON.stringify(data, null, 2))
    }

    return response
  } catch (error) {
    console.error('Fireflies webhook error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
