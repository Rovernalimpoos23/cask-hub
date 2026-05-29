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

function buildExtractionPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  const year = new Date().getFullYear()
  return `You are an AI assistant for CASK Construction. Extract meeting information from the transcript and return ONLY a valid JSON object with no markdown, no code blocks, no extra text before or after.

Today's date is ${today} (${year}). When extracting meeting dates, always use ${year} as the year unless the transcript explicitly mentions a different year. Never use years before ${year}.

Return this exact structure:
{
  "title": "string (meeting title)",
  "date": "YYYY-MM-DD",
  "time_start": "string or null (e.g. 10:00 AM)",
  "time_end": "string or null",
  "attendees": ["first names only"],
  "meeting_type": "leadership | planning | coaching | education",
  "module": "ActionCOACH or President Workflow — Daily Meetings or President Workflow — Coaching Sessions or President Workflow — Department Alignment or Customer Journey — Active Clients",
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "action_items": [{"task": "string", "owner": "string", "due_date": "YYYY-MM-DD or null", "done": false}],
  "key_decisions": ["string array"]
}

CASK Construction context:
- Company goal: $20M revenue 2026
- Key people: Calin (President), Chad (VP Ops), Lamont (VP Finance), Jeff (VP Sales), Kait (VP HR), Matteo (Ops Manager), Kai (EA), Rovern (AI Specialist), Juliet (ActionCOACH)
- If Juliet is in the meeting — module is "ActionCOACH", type is "coaching" or "leadership"
- If only Calin and Kai — module is "President Workflow — Coaching Sessions"
- If multiple department heads present — type is "leadership" or "planning"
- Use first names only in attendees array`
}

function extractJSON(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON object found in Claude response. Raw: ${text.slice(0, 200)}`)
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  // Always return 200 immediately so Fireflies doesn't retry on timeout
  const ok = NextResponse.json({ success: true, received: true })

  try {
    const body = await req.json()
    console.log('[fireflies] webhook received event:', body?.event, 'meeting_id:', body?.meeting_id)

    const { event, meeting_id } = body

    if (event !== 'meeting.transcribed' || !meeting_id) {
      console.log('[fireflies] ignoring event:', event)
      return ok
    }

    // 1. Fetch full transcript from Fireflies GraphQL API
    const ffRes = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({ query: TRANSCRIPT_QUERY, variables: { id: meeting_id } }),
    })

    if (!ffRes.ok) {
      console.error('[fireflies] GraphQL request failed:', ffRes.status, await ffRes.text())
      return ok
    }

    const ffData = await ffRes.json()

    if (ffData.errors) {
      console.error('[fireflies] GraphQL errors:', JSON.stringify(ffData.errors))
      return ok
    }

    const transcript = ffData?.data?.transcript
    if (!transcript) {
      console.error('[fireflies] no transcript in response for meeting_id:', meeting_id)
      return ok
    }

    console.log('[fireflies] fetched transcript:', transcript.title, '| sentences:', transcript.sentences?.length ?? 0)

    // 2. Build plain-text transcript
    const fullTranscript = (transcript.sentences ?? [])
      .map((s: { speaker_name: string; text: string }) => `${s.speaker_name}: ${s.text}`)
      .join('\n')

    const today = new Date().toISOString().split('T')[0]
    const meetingDate = transcript.date
      ? new Date(transcript.date).toISOString().split('T')[0]
      : today

    // 3. Claude extraction
    const claudeRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: buildExtractionPrompt(),
      messages: [{ role: 'user', content: fullTranscript || transcript.title }],
      max_tokens: 1500,
    })

    const rawContent = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : ''
    console.log('[fireflies] Claude raw response:', rawContent.slice(0, 500))

    let extracted: Record<string, unknown> = {}
    try {
      extracted = extractJSON(rawContent)
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      console.error('[fireflies] JSON parse failed:', msg)
      // Fall through — save with Fireflies metadata only
    }

    const hasMeaningfulContent =
      extracted.summary &&
      (extracted.summary as string[]).length > 0 &&
      (extracted.summary as string[])[0].length > 10

    if (!hasMeaningfulContent) {
      console.log('[fireflies] skipping save — insufficient content extracted for:', transcript.title)
      return NextResponse.json({ success: true, message: 'Skipped — insufficient content extracted' })
    }

    // 4. Save to Supabase using service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validate extracted date — Claude sometimes hallucinates the wrong year
    const rawDate: string = (extracted.date as string) ?? meetingDate
    const extractedYear = new Date(rawDate).getFullYear()
    const currentYear = new Date().getFullYear()
    const safeDate = (!rawDate || isNaN(extractedYear) || extractedYear < currentYear)
      ? today
      : rawDate

    const sessionTitle = (extracted.title as string) ?? transcript.title ?? 'Untitled Meeting'

    const { data: existing } = await supabase
      .from('meetings')
      .select('id')
      .eq('title', sessionTitle)
      .eq('date', safeDate)
      .single()

    if (existing) {
      console.log('[fireflies] duplicate session detected, skipping:', sessionTitle, '| date:', safeDate)
      return NextResponse.json({ success: true, message: 'Session already exists, skipping duplicate' })
    }

    const record = {
      title:           sessionTitle,
      date:            safeDate,
      time_start:      extracted.time_start   ?? null,
      time_end:        extracted.time_end     ?? null,
      attendees:       extracted.attendees    ?? (transcript.meeting_attendees ?? []).map((a: { displayName: string }) => a.displayName),
      meeting_type:    extracted.meeting_type ?? null,
      module:          extracted.module       ?? null,
      summary:         extracted.summary      ?? [],
      action_items:    extracted.action_items ?? [],
      key_decisions:   extracted.key_decisions ?? [],
      full_transcript: fullTranscript,
      owner:           'calin',
    }

    const { error: dbError } = await supabase.from('meetings').insert(record)

    if (dbError) {
      console.error('[fireflies] Supabase insert error:', dbError.message, dbError.details)
    } else {
      console.log('[fireflies] meeting saved successfully:', record.title, '| date:', record.date)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[fireflies] unhandled webhook error:', msg, err)
  }

  return ok
}
