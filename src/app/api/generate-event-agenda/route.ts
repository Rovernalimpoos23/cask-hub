// src/app/api/generate-event-agenda/route.ts
// Generates a concise professional agenda for a single calendar event.
// Requires ANTHROPIC_API_KEY in environment (set in Vercel dashboard + .env.local)
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { title, date, time } = await req.json()

    const prompt = `Generate a professional meeting agenda for:
Meeting: ${title}
Date: ${date}
Time: ${time}

Create a structured agenda with:
- Welcome & objectives (5 mins)
- Key discussion topics based on meeting title
- Action items review
- Next steps
- Closing

Keep it concise and professional.`

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
    })

    const agenda = completion.content[0].type === 'text' ? completion.content[0].text : ''
    return NextResponse.json({ agenda })
  } catch (error) {
    console.error('Generate event agenda API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate agenda' },
      { status: 500 }
    )
  }
}
