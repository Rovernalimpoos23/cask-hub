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

const SAMPLE_TRANSCRIPT = `Calin: Good morning everyone. Let's get started with our weekly leadership meeting.
Juliet: Morning Calin. Before we dive in, how are you tracking against the $20M goal?
Calin: We're at $14.2M YTD which puts us about 8% ahead of plan.
Chad: Operations-wise we've completed the Phoenix project handover. Two new sites starting next week.
Calin: Great. Chad, can you make sure the site safety checklist is updated before the new sites open?
Chad: Will do. I'll have that done by end of week.
Jeff: Sales pipeline is strong. We closed three contracts this week totaling $1.8M.
Calin: Excellent. Rovern, can you have the new reporting dashboard ready for the board meeting?
Rovern: Yes, I'll have it ready by May 30th.
Juliet: Key decision from today — CASK will prioritize commercial contracts over residential for Q3.
Calin: Agreed. That's the call. Kait, please update the hiring plan to reflect commercial focus.
Kait: Got it, I'll revise the hiring plan by June 3rd.
Calin: Let's wrap up. Good session everyone.`

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

  // 2. Optionally save to Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const record = {
    title:           extracted.title         ?? 'Test Meeting',
    date:            extracted.date          ?? new Date().toISOString().split('T')[0],
    time_start:      extracted.time_start    ?? null,
    time_end:        extracted.time_end      ?? null,
    attendees:       extracted.attendees     ?? [],
    meeting_type:    extracted.meeting_type  ?? null,
    module:          extracted.module        ?? null,
    summary:         extracted.summary       ?? [],
    action_items:    extracted.action_items  ?? [],
    key_decisions:   extracted.key_decisions ?? [],
    full_transcript: transcript,
    owner:           'calin',
  }

  const { error } = await supabase.from('meetings').insert(record)

  return {
    extracted,
    saved: !error,
    db_error: error ? error.message : null,
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
