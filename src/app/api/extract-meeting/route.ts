// src/app/api/extract-meeting/route.ts
// Requires ANTHROPIC_API_KEY in environment (set in Vercel dashboard + .env.local)
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json()

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      system: `You are an AI assistant for CASK Construction. Extract meeting information from this transcript and return ONLY a valid JSON object with no other text, no markdown, no backticks.

Return this exact structure:
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "time_start": "string e.g. 10:00 AM",
  "time_end": "string",
  "attendees": ["first names only"],
  "meeting_type": "leadership or planning or coaching or education",
  "module": "ActionCOACH or President Workflow — Daily Meetings or President Workflow — Coaching Sessions or President Workflow — Department Alignment or Customer Journey — Active Clients",
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "action_items": [{"task": "string", "owner": "string", "due_date": "YYYY-MM-DD", "done": false}],
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
    if (!jsonMatch) throw new Error('No JSON found in Claude response')

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Claude extraction error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to extract meeting details' },
      { status: 500 }
    )
  }
}
