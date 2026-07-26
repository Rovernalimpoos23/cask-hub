// src/app/api/extract-meeting/route.ts
// Requires ANTHROPIC_API_KEY in environment (set in Vercel dashboard + .env.local)
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const transcript: string = body?.transcript ?? ''

    if (!transcript.trim()) {
      return NextResponse.json(
        { success: false, error: 'No transcript provided' },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const year = new Date().getFullYear()

    const completion = await anthropic.messages.create({
      model: 'claude-opus-5',
      system: `You are an AI assistant for CASK Construction. Extract meeting information from this transcript and return ONLY a valid JSON object with no other text, no markdown, no backticks.

Today's date is ${today} (${year}). When extracting meeting dates, always use ${year} as the year unless the transcript explicitly mentions a different year. Never use years before ${year}.

ACTION ITEMS EXTRACTION RULES:
- Read the full transcript carefully
- Extract EVERY explicit commitment made
- Look for phrases like: "I will...", "I'll...", "We need to...", "Can you...", "Please...", "I'll follow up...", "Let me...", "I'm going to..."
- Assign correct owner based on who committed
- Include deadlines if mentioned
- Include implied action items when someone clearly agrees to do something
- Never leave action_items empty if commitments were made

KEY DECISIONS DEFINITION:
key_decisions = genuinely strategic or directional choices that were finalized during the meeting — for example: a target or deadline changed, a structure or process was approved, someone was assigned ownership of a new area, or a direction was explicitly decided between options.
Do NOT include routine tasks, logistics, or scheduling items — those belong in action_items instead.
Include EVERY decision that genuinely meets this definition, however many that is for this specific meeting — a short simple meeting may have 1-2, a long complex meeting may have 8+. Do not artificially limit or pad the count. Do not include anything that doesn't genuinely qualify just to reach a target number.

SUMMARY GUIDELINE:
Write tight, executive-readable bullets covering what genuinely matters most from this meeting. Each bullet must be a complete, standalone thought. Use as many bullets as the meeting's content actually warrants — a short simple meeting may need only 2, a long complex meeting may need 6+. Do not pad with minor details just to reach a target count, and do not compress genuinely distinct points into one bullet just to keep the count low.

ACCURACY REQUIREMENT:
Every summary bullet, key decision, and action item must be directly grounded in something actually said in this transcript — do not infer, assume, or invent details that weren't stated or clearly implied by context. If a deadline, owner, or detail wasn't mentioned, use null rather than guessing. If you're uncertain whether something qualifies as a decision or action item, err on the side of leaving it out rather than including a shaky inference.

Return this exact structure:
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "time_start": "string or null e.g. 10:00 AM",
  "time_end": "string or null",
  "attendees": ["first names only"],
  "meeting_type": "leadership or planning or coaching or education",
  "module": "ActionCOACH or President Workflow — Daily Meetings or President Workflow — Coaching Sessions or President Workflow — Department Alignment or Customer Journey — Active Clients",
  "summary": ["as many bullets as the content warrants"],
  "action_items": [{"task": "string", "owner": "string or null", "due_date": "YYYY-MM-DD or null", "done": false}],
  "key_decisions": ["as many entries as genuinely qualify"]
}

CASK Construction context:
- Company goal: $20M revenue 2026
- Key people: Calin (President), Chad (VP Ops), Lamont (VP Finance), Jeff (VP Sales), Kait (VP HR), Matteo (Ops Manager), Kai (EA), Rovern (AI Specialist), Juliet (ActionCOACH)
- If Juliet is in the meeting — module is ActionCOACH, type is coaching or leadership
- If only Calin and Kai — module is President Workflow — Coaching Sessions
- If multiple department heads present — type is leadership or planning
- Use first names only in attendees array`,
      messages: [
        {
          role: 'user',
          content: `Extract meeting information from this transcript:\n\n${transcript}`,
        },
      ],
      max_tokens: 16000,
    })

    const textBlock = completion.content.find((b) => b.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Claude response contained no JSON:', text)
      throw new Error('No JSON found in Claude response')
    }

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Claude extraction error:', message, error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
