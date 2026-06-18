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

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: `You are an AI assistant for CASK Construction. Extract meeting information from this transcript and return ONLY a valid JSON object with no other text, no markdown, no backticks.

Today's date is ${new Date().toISOString().split('T')[0]}. Always use the current year unless the transcript explicitly mentions a different year.

ACTION ITEMS EXTRACTION RULES:
- Read the full transcript carefully
- Extract EVERY explicit commitment made
- Look for phrases like: I will, I'll, Can you, Please, Let me, I'm going to
- Assign correct owner based on who committed
- Include deadlines if mentioned
- Never leave action_items empty if commitments were made

Return this exact structure:
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "time_start": "string or null e.g. 10:00 AM",
  "time_end": "string or null",
  "attendees": ["first names only"],
  "meeting_type": "leadership or planning or coaching or education",
  "module": "ActionCOACH or President Workflow — Daily Meetings or President Workflow — Coaching Sessions or President Workflow — Department Alignment or Customer Journey — Active Clients",
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "action_items": [{"task": "string", "owner": "string", "due_date": "YYYY-MM-DD or null", "done": false}],
  "key_decisions": ["string"]
}

CASK Construction context:
- Company goal: $20M revenue 2026
- Key people: Calin (President), Chad (VP Ops), Lamont (VP Finance), Jeff (VP Sales), Kait (VP HR), Matteo (Ops Manager), Kai (EA), Rovern (AI Specialist), Juliet (ActionCOACH)
- If Juliet is in the meeting — module is ActionCOACH, type is coaching or leadership
- If only Calin and Kai — module is President Workflow — Coaching Sessions
- If department heads present — type is leadership or planning`,
      messages: [
        {
          role: 'user',
          content: `Extract meeting information from this transcript:\n\n${transcript}`,
        },
      ],
      max_tokens: 2000,
    })

    const text = completion.content[0].type === 'text' ? completion.content[0].text : ''

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
