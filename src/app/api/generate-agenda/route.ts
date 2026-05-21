// src/app/api/generate-agenda/route.ts
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are the AI system for CASK Construction's ActionCOACH coaching program. Generate concise, professional meeting agendas.

Style guide:
- Short bullet points, 2-3 per section
- Clear time slots with durations
- Use | separators between time and section name
- Always start with WIFLE (What I Feel Like Expressing) — 5-minute one-word check-in
- Include Education section if topic provided
- End with Wrap-Up (15 min): recap decisions, BFOs (Blinding Flashes of the Obvious), confirm ownership and deadlines

Company context:
- Company: CASK Construction, St. Petersburg FL
- Goal: $20M revenue 2026
- Coach: Juliet (ActionCOACH Tampa Bay)
- Regular attendees: Calin (President), Chad (VP Ops), Lamont (VP Finance), Jeff (VP Sales), Kait (VP HR), Matteo (Ops Manager), Juliet (Coach)
- Always include attendee list at top

Format output as plain text with the time | section name structure. No markdown headers or bold.`

export async function POST(req: NextRequest) {
  try {
    const { meetingType, duration, education, topics } = await req.json()

    const userPrompt = `Generate a CASK ${meetingType} agenda.
Duration: ${duration}
${education ? `Education topic: ${education}` : ''}
${topics ? `Key topics to include: ${topics}` : ''}
Date: May 28, 2026
Start time: 11:00 AM
Standard attendees: Calin, Chad, Lamont, Jeff, Matteo, Kait, Juliet

Create a complete, detailed agenda with time slots that add up to exactly ${duration}.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json({ agenda: data.content[0].text })
  } catch (error) {
    console.error('Generate agenda API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate agenda' },
      { status: 500 }
    )
  }
}
