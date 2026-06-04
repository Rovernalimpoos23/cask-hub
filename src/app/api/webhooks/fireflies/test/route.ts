/**
 * GET  /api/webhooks/fireflies/test          — run extraction on built-in sample transcript
 * POST /api/webhooks/fireflies/test          — run extraction on { transcript: "..." } body
 *
 * Add ?save=true to either method to also write the result to Supabase.
 * Useful for verifying the full pipeline (Claude + Supabase) without a real Fireflies event.
 */
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_SYSTEM_PROMPT = `You are an AI assistant for CASK Construction. Extract meeting information from the transcript and return ONLY a valid JSON object with no markdown, no code blocks, no extra text before or after.

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

const SAMPLE_TRANSCRIPT = `Meeting Title: PR1m Internal Sales to Pre-Con Pass-Off: John Smith
Date: ${new Date().toISOString().split('T')[0]}
Module: Customer Journey — Active Clients

Jeff: Alright, let's get this handoff started. John, welcome to the pre-construction team.
John: Thanks Jeff, really excited to get this project underway.
Jeff: So the purpose of this meeting is to pass John off from sales to the pre-construction team. We've reviewed his property, confirmed the ADU option, and the budget is aligned.
Matteo: Great to meet you John. I'll be your project manager through the design and permitting phases.
Jeff: We went through the customer avatar and ADU checklist during the sales process. John is looking at a detached ADU, no flood zone, standard setbacks.
Matteo: Perfect. John, our next step is the initial alignment meeting where we'll go deeper into your vision for the project — layout preferences, timeline, and any site considerations.
John: Sounds good. I want to make sure we stay on budget and on schedule.
Matteo: Absolutely. We'll cover all of that. Rovern, can you set up the pre-construction meeting template in the system for John's project?
Rovern: Yes, I'll get that done right away.
Jeff: We decided to move forward with pre-construction planning as of today. Everything looks good on the sales side.
Matteo: Great. John, we'll be in touch shortly to schedule your alignment meeting. This is a test meeting summary for John Smith pre-construction phase.
John: Perfect, looking forward to it.`

function extractJSON(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in Claude response. Got: ${text.slice(0, 300)}`)
  return JSON.parse(match[0])
}

async function runExtraction(transcript: string, save: boolean) {
  // 1. Claude extraction
  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: transcript }],
    max_tokens: 1500,
  })

  const rawContent = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : ''
  const extracted = extractJSON(rawContent)

  if (!save) {
    return { extracted, saved: false, db_error: null }
  }

  // 2. Run the same client-matching logic as the real webhook
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const extractedTitle = (extracted.title as string) ?? ''
  const rawDate  = extracted.date as string | undefined
  const safeDate = (rawDate && rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) ? rawDate : today

  // Parse title — two supported formats:
  //   Format 1: "John Smith — PR1m — Internal Sales to Pre-Con Pass-Off"
  //   Format 2: "PR1m Internal Sales to Pre-Con Pass-Off: John Smith"
  let candidateClientName: string | null = null
  let meetingCode: string | null = null

  // Format 1: split on " — ", client name first, code second
  const dashParts = extractedTitle.split(' — ')
  if (dashParts.length >= 2) {
    const codeMatch1 = extractedTitle.match(/\b(PR|PD|PP|PS|PB|CG|CS|CR|CF|CC)\d+(?:\.\d+)?[a-zA-Z](?:\.\d+)?\b/i)
    if (codeMatch1) {
      candidateClientName = dashParts[0].trim()
      meetingCode = codeMatch1[0]
    }
  }

  // Format 2: "PR1m ... : Client Name" — code is first word, client name follows last ":"
  if (!meetingCode) {
    const firstWord = extractedTitle.split(' ')[0] ?? ''
    const codeMatch2 = firstWord.match(/^(PR|PD|PP|PS|PB|CG|CS|CR|CF|CC)\d+(?:\.\d+)?[a-zA-Z](?:\.\d+)?$/i)
    const colonIdx = extractedTitle.lastIndexOf(':')
    if (codeMatch2 && colonIdx !== -1) {
      meetingCode = codeMatch2[0]
      candidateClientName = extractedTitle.slice(colonIdx + 1).trim() || null
    }
  }

  if (!candidateClientName || !meetingCode) {
    return {
      extracted,
      saved: false,
      db_error: `Could not parse client name or meeting code from title: "${extractedTitle}"`,
      client_matched: null,
    }
  }

  const { data: matchedClient } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', candidateClientName)
    .maybeSingle()

  if (!matchedClient) {
    return {
      extracted,
      saved: false,
      db_error: `No client found matching name: "${candidateClientName}"`,
      client_matched: null,
    }
  }

  const summaryArr    = Array.isArray(extracted.summary)       ? (extracted.summary as string[])       : []
  const decisionsArr  = Array.isArray(extracted.key_decisions) ? (extracted.key_decisions as string[])  : []
  const actionArr     = Array.isArray(extracted.action_items)  ? extracted.action_items                 : []

  const recapText = summaryArr.length > 0
    ? summaryArr.join(' ')
    : String(extracted.summary ?? 'No summary available.')

  const notesJson = JSON.stringify({
    summary:       summaryArr,
    key_decisions: decisionsArr,
    action_items:  actionArr,
    transcript:    transcript,
  })

  // Check if a row already exists for (client_id, meeting_id)
  const { data: existingRow } = await supabase
    .from('client_meetings')
    .select('id')
    .eq('client_id', matchedClient.id)
    .eq('meeting_id', meetingCode)
    .maybeSingle()

  let dbError: string | null = null

  if (existingRow) {
    const { error } = await supabase
      .from('client_meetings')
      .update({
        title:        extractedTitle,
        recap:        recapText,
        notes:        notesJson,
        completed:    true,
        completed_at: new Date().toISOString(),
        date:         safeDate,
      })
      .eq('id', existingRow.id)
    dbError = error ? error.message : null
  } else {
    const { error } = await supabase
      .from('client_meetings')
      .insert({
        client_id:    matchedClient.id,
        meeting_id:   meetingCode,
        title:        extractedTitle,
        completed:    true,
        completed_at: new Date().toISOString(),
        recap:        recapText,
        notes:        notesJson,
        date:         safeDate,
      })
    dbError = error ? error.message : null
  }

  return {
    extracted,
    saved: !dbError,
    db_error: dbError,
    client_matched: matchedClient.name,
    meeting_code: meetingCode,
    action: existingRow ? 'updated' : 'inserted',
  }
}

export async function GET(req: NextRequest) {
  const save = req.nextUrl.searchParams.get('save') === 'true'
  try {
    const result = await runExtraction(SAMPLE_TRANSCRIPT, save)
    return NextResponse.json({ success: true, ...result, model: 'claude-sonnet-4-6', transcript_used: 'sample' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[fireflies/test] error:', message, err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const save = req.nextUrl.searchParams.get('save') === 'true'
  try {
    const body = await req.json()
    const transcript: string = body?.transcript ?? SAMPLE_TRANSCRIPT
    if (!transcript.trim()) {
      return NextResponse.json({ success: false, error: 'transcript is empty' }, { status: 400 })
    }
    const result = await runExtraction(transcript, save)
    return NextResponse.json({ success: true, ...result, model: 'claude-sonnet-4-6', transcript_used: body?.transcript ? 'custom' : 'sample' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[fireflies/test] error:', message, err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
