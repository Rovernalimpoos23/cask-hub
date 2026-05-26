import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

const EXTRACTION_PROMPT = `You are an AI assistant for CASK Construction. Extract meeting information from this transcript and return ONLY valid JSON with no markdown, no code blocks, no extra text:
{
  "title": "string (meeting title)",
  "date": "YYYY-MM-DD string",
  "time_start": "string or null",
  "time_end": "string or null",
  "attendees": ["string array of speaker names"],
  "meeting_type": "leadership | planning | coaching | education",
  "module": "string (ActionCOACH or President Workflow or Customer Journey)",
  "summary": ["3 bullet point strings"],
  "action_items": [{"task": "string", "owner": "string", "due_date": "string or null", "done": false}],
  "key_decisions": ["string array"]
}`


export async function POST(req: NextRequest) {
  // Return 200 immediately so Fireflies doesn't retry
  const immediateResponse = NextResponse.json({ success: true, received: true })

  try {
    const body = await req.json()
    console.log('Fireflies webhook received:', JSON.stringify(body, null, 2))

    const { event, meeting_id } = body

    if (event !== 'meeting.transcribed' || !meeting_id) {
      return immediateResponse
    }

    // 1. Fetch full transcript from Fireflies
    const ffRes = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({ query: TRANSCRIPT_QUERY, variables: { id: meeting_id } }),
    })

    const ffData = await ffRes.json()
    console.log('Fireflies full data:', JSON.stringify(ffData, null, 2))

    const transcript = ffData?.data?.transcript
    if (!transcript) {
      console.error('No transcript in Fireflies response')
      return immediateResponse
    }

    // 2. Build full transcript text
    const fullTranscript = (transcript.sentences ?? [])
      .map((s: { speaker_name: string; text: string }) => `${s.speaker_name}: ${s.text}`)
      .join('\n')

    const meetingDate = new Date(transcript.date).toISOString().split('T')[0]

    // 3. Send to Claude for extraction
    const claudeRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: fullTranscript }],
      max_tokens: 1024,
    })

    const rawContent = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : ''
    console.log('Claude raw content:', rawContent)

    if (!rawContent) {
      console.error('Claude returned empty content.')
    }

    let extracted: Record<string, unknown> = {}
    try {
      extracted = JSON.parse(rawContent)
    } catch {
      console.error('Failed to parse Claude JSON response:', rawContent)
    }

    // 4. Save to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await supabase.from('meetings').insert({
      title: extracted.title ?? transcript.title,
      date: meetingDate,
      time_start: extracted.time_start ?? null,
      time_end: extracted.time_end ?? null,
      attendees: extracted.attendees ?? [],
      meeting_type: extracted.meeting_type ?? null,
      module: extracted.module ?? null,
      summary: extracted.summary ?? [],
      action_items: extracted.action_items ?? [],
      key_decisions: extracted.key_decisions ?? [],
      full_transcript: fullTranscript,
      owner: 'calin',
    })

    if (error) {
      console.error('Supabase insert error:', error)
    } else {
      console.log('Meeting saved successfully for:', transcript.title)
    }
  } catch (error) {
    console.error('Fireflies webhook error:', error)
  }

  return immediateResponse
}
