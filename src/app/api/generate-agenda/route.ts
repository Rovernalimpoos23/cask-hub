// src/app/api/generate-agenda/route.ts
// Requires ANTHROPIC_API_KEY in environment (set in Vercel dashboard + .env.local)
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    const { meetingType, duration, time, education, topics, date } = await req.json()

    // Fetch the 6 most recent sessions from Supabase for context
    const supabase = createClient()
    const { data: sessions } = await supabase
      .from('meetings')
      .select('title, date, summary, key_decisions')
      .order('date', { ascending: false })
      .limit(6)

    let sessionContext = ''
    if (sessions && sessions.length > 0) {
      sessionContext = `\n\nPast session context (${sessions.length} most recent sessions):\n` +
        sessions.map((s, i) => {
          const lines: string[] = [`Session ${i + 1}: ${s.title} (${s.date})`]
          if (Array.isArray(s.summary) && s.summary.length > 0) {
            lines.push('  Key themes: ' + s.summary.slice(0, 3).join(' | '))
          }
          if (Array.isArray(s.key_decisions) && s.key_decisions.length > 0) {
            lines.push('  Decisions: ' + s.key_decisions.slice(0, 2).join(' | '))
          }
          return lines.join('\n')
        }).join('\n\n')
    }

    const userPrompt = `Generate a CASK ${meetingType} agenda.
Date: ${date}
${time ? `Start time: ${time}` : ''}
Duration: ${duration}
${education ? `Education topic: ${education}` : ''}
${topics ? `Key topics to include: ${topics}` : ''}
Standard attendees: Calin, Chad, Lamont, Jeff, Matteo, Kait, Juliet
${sessionContext}
Create a complete, detailed agenda with time slots that add up to exactly ${duration}. Reference relevant themes or open items from past sessions where appropriate.`

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 1200,
    })

    const agenda = completion.content[0].type === 'text' ? completion.content[0].text : ''
    return NextResponse.json({ agenda })
  } catch (error) {
    console.error('Generate agenda API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate agenda' },
      { status: 500 }
    )
  }
}
