// src/app/api/chat/route.ts
// Requires GROQ_API_KEY in environment (set in Vercel dashboard + .env.local)
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function buildSystemPrompt(userName: string, meetingsContext: string) {
  return `You are CASK Hub AI for CASK Construction's ActionCOACH program. Be concise and helpful.

You are currently talking to ${userName || 'a CASK team member'}. Use their first name occasionally in responses to make it feel personal and warm. If they ask who you are talking to, you know their name.

Company goal: $20M revenue in 2026.
Coach: Juliet (ActionCOACH Tampa Bay).
Always respond in the context of CASK Construction.

KEY PEOPLE:
- Calin Noonan = President + Co-Founder
- Chad Holman = VP Operations + Co-Founder
- Lamont Gilyot = VP Finance
- Jeff Azcona = VP Sales & Marketing
- Kaitlyn Grunenberg = VP Human Resources
- Matteo Carpani = Operations Manager
- Kai Mapoy = Executive Assistant
- Rovern Alimpoos = AI Workflow Specialist

You have full access to all CASK Construction meetings. Here are the details:

${meetingsContext}

Use this information to answer questions accurately.

Keep responses concise — 2-4 sentences max unless a longer answer is clearly needed. Use bullet points for lists.`
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userName } = await req.json()

    const supabase = createClient()
    const { data: meetings } = await supabase
      .from('meetings')
      .select('title, date, summary, action_items, key_decisions, attendees, meeting_type')
      .order('date', { ascending: false })
      .limit(20)

    const meetingsContext = meetings?.map(m => `
Meeting: ${m.title}
Date: ${m.date}
Attendees: ${Array.isArray(m.attendees) ? m.attendees.join(', ') : m.attendees}
Summary: ${Array.isArray(m.summary) ? m.summary.join(' ') : m.summary}
Key Decisions: ${Array.isArray(m.key_decisions) ? m.key_decisions.join(' ') : m.key_decisions}
Action Items: ${Array.isArray(m.action_items) ? m.action_items.map((a: { task: string }) => a.task).join(', ') : ''}
`).join('\n---\n') ?? 'No meetings found.'

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: buildSystemPrompt(userName, meetingsContext) },
        ...messages.slice(-10), // Last 10 messages for context window
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const content = completion.choices[0].message.content || ''
    return NextResponse.json({ content })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    )
  }
}
