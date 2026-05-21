// src/app/api/chat/route.ts
// Requires GROQ_API_KEY in environment (set in Vercel dashboard + .env.local)
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are CASK Hub AI for CASK Construction's ActionCOACH program. You have access to all 6 coaching sessions from February through April 2026. Be concise and helpful.

Company goal: $20M revenue in 2026.
Coach: Juliet (ActionCOACH Tampa Bay).
Always respond in the context of CASK Construction.

SESSION HISTORY:
1. Feb 27 — CASK Companies Leadership Meeting (4 hrs): Gallup Q12 engagement education, individual deep dives, leadership brainstorm.
2. Mar 18 — Top 10 Stress & Energy Drivers (2 hrs): Owner-focused session with Calin + Chad. Autonomy, recovery, role clarity.
3. Mar 27 — CASK Leadership Planning Q2 2026 (6 hrs): $10M→$20M roadmap, Q2 KPIs by department, DISC assessments. PIT Goals assigned.
4. Apr 2 — Calin and Kai Coaching Session (1.5 hrs): President's Workflow mapped, delegation framework, Kai's expanded scope.
5. Apr 8 — Team Role, Standards and Growth (2 hrs): Clarity/Standards/Development framework, Role Cards, Feedforward model.
6. Apr 30 — CASK Leadership Meeting (4 hrs): 5 Dysfunctions of a Team education, Design Center vision from Calin, department updates.

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

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
