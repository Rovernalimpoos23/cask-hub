// src/app/api/generate-agenda/route.ts
// Requires GROQ_API_KEY in environment (set in Vercel dashboard + .env.local)
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    })

    const agenda = completion.choices[0].message.content || ''
    return NextResponse.json({ agenda })
  } catch (error) {
    console.error('Generate agenda API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate agenda' },
      { status: 500 }
    )
  }
}
