// src/app/api/chat/route.ts
// Requires GROQ_API_KEY in environment (set in Vercel dashboard + .env.local)
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function buildSystemPrompt(sessionCount: number | null, userName: string) {
  return `You are CASK Hub AI for CASK Construction's ActionCOACH program. You have access to ${sessionCount ?? 'multiple'} coaching and leadership sessions from February 2026 to present. Be concise and helpful.

You are currently talking to ${userName || 'a CASK team member'}. Use their first name occasionally in responses to make it feel personal and warm. If they ask who you are talking to, you know their name.

Company goal: $20M revenue in 2026.
Coach: Juliet (ActionCOACH Tampa Bay).
Always respond in the context of CASK Construction.

SESSIONS:
Sessions are stored in Supabase and include ActionCOACH sessions, President Workflow meetings, and Customer Journey meetings from February 2026 to present.

KEY PEOPLE:
- Calin Noonan = President + Co-Founder
- Chad Holman = VP Operations + Co-Founder
- Lamont Gilyot = VP Finance
- Jeff Azcona = VP Sales & Marketing
- Kaitlyn Grunenberg = VP Human Resources
- Matteo Carpani = Operations Manager
- Kai Mapoy = Executive Assistant
- Rovern Alimpoos = AI Workflow Specialist

OPEN ACTION ITEMS (as of May 2026):
- Prepare May 28th agenda with Juliette brain dump (Calin + Kai — due May 22)
- Send prep email to Chad (Kai — due May 22)
- Confirm Donegan Design Alignment meeting May 22 (Calin)
- Set up Claude AI company account (Calin — due May 20)
- IT onboarding for Rovern (Kai — due May 20)
- Book Co-Construct onboarding (Rovern — due May 23)

COMPLETED:
- Include Rovern in department meetings ✓
- Set up Rovern with Joseph ✓

UPCOMING: May 28 Leadership Meeting — 11am to 3pm. Topics to include: Q2 KPI review, Design Center update, department wins/bottlenecks.

Keep responses concise — 2-4 sentences max unless a longer answer is clearly needed. Use bullet points for lists.`
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userName } = await req.json()

    const supabase = createClient()
    const { count } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: buildSystemPrompt(count, userName) },
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
