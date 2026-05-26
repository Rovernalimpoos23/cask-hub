// src/app/api/chat/route.ts
// Requires ANTHROPIC_API_KEY in environment (set in Vercel dashboard + .env.local)
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

function buildSystemPrompt(
  userName: string,
  userRole: string,
  meetingsContext: string,
  clientsContext: string,
) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return `You are CASK Intelligence — the AI assistant embedded in CASK Hub for CASK Construction. Today is ${today}.

## WHO YOU ARE TALKING TO
Name: ${userName || 'a CASK team member'}
Role: ${userRole || 'CASK team member'}

Always address the user by their first name (${userName || 'there'}). If they ask "what is my name", "who am I", or similar questions, answer directly using the above — do not say you don't know.

## COMPANY CONTEXT
- Company: CASK Construction, St. Petersburg FL
- Goal: $20M revenue in 2026
- ActionCOACH: Juliet (ActionCOACH Tampa Bay)

## KEY PEOPLE
- Calin Noonan — President & Co-Founder
- Chad Holman — VP Operations & Co-Founder
- Lamont Gilyot — VP Finance
- Jeff Azcona — VP Sales & Marketing
- Kaitlyn Grunenberg — VP Human Resources
- Matteo Carpani — Operations Manager
- Kai Mapoy — Executive Assistant
- Rovern Alimpoos — AI Workflow Specialist

## MEETING & SESSION DATA
You have full access to all recorded CASK meetings and sessions. Use this data to answer questions about specific meetings, action items, decisions, and coaching themes:

${meetingsContext}

## CUSTOMER JOURNEY DATA
Active clients and their current happiness status:

${clientsContext}

## RESPONSE BEHAVIOR
- Answer personal questions (name, role, action items) directly and confidently
- Reference specific meeting data and dates when relevant
- For action items, clearly distinguish open vs completed
- For client questions, include happiness status and project context
- Be conversational, warm, and address the user by first name naturally
- Keep responses concise — 2–4 sentences unless a list or detailed answer is clearly needed
- Use bullet points for lists of 3 or more items
- Never say you don't have access to data that is provided above`
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userName, userRole } = await req.json()
    console.log('[chat] POST hit — user:', userName, '| role:', userRole, '| messages:', messages?.length)

    // Initialise client inside handler so env var is always resolved at request time
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[chat] ANTHROPIC_API_KEY is not set')
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }
    const anthropic = new Anthropic({ apiKey })

    const supabase = createClient()

    const [{ data: meetings }, { data: clients }] = await Promise.all([
      supabase
        .from('meetings')
        .select('title, date, summary, action_items, key_decisions, attendees, meeting_type, module')
        .order('date', { ascending: false })
        .limit(30),
      supabase
        .from('clients')
        .select('name, happiness, project_type, project_value, start_date')
        .order('name'),
    ])

    const meetingsContext = meetings?.length
      ? meetings.map(m => {
          const openItems = Array.isArray(m.action_items)
            ? m.action_items.filter((a: { done: boolean }) => !a.done).map((a: { task: string; owner: string }) => `${a.task} (${a.owner})`)
            : []
          const doneItems = Array.isArray(m.action_items)
            ? m.action_items.filter((a: { done: boolean }) => a.done).map((a: { task: string; owner: string }) => `${a.task} (${a.owner})`)
            : []
          return [
            `Meeting: ${m.title}`,
            `Date: ${m.date}`,
            `Type: ${m.meeting_type ?? 'unknown'} | Module: ${m.module ?? 'unknown'}`,
            `Attendees: ${Array.isArray(m.attendees) ? m.attendees.join(', ') : m.attendees ?? 'unknown'}`,
            `Summary: ${Array.isArray(m.summary) ? m.summary.join(' ') : m.summary ?? ''}`,
            `Key Decisions: ${Array.isArray(m.key_decisions) && m.key_decisions.length ? m.key_decisions.join('; ') : 'none'}`,
            openItems.length ? `Open Action Items: ${openItems.join('; ')}` : 'Open Action Items: none',
            doneItems.length ? `Completed Action Items: ${doneItems.join('; ')}` : '',
          ].filter(Boolean).join('\n')
        }).join('\n---\n')
      : 'No meetings recorded yet.'

    const clientsContext = clients?.length
      ? clients.map(c => {
          const happiness = c.happiness === 'red' ? '🔴 At Risk' : c.happiness === 'yellow' ? '🟡 Needs Attention' : '🟢 Healthy'
          return `${c.name} — ${c.project_type ?? 'project'} | ${happiness} | Value: $${c.project_value?.toLocaleString() ?? 'TBD'} | Started: ${c.start_date ?? 'TBD'}`
        }).join('\n')
      : 'No active clients on record.'

    // Claude requires the conversation to start with a 'user' turn.
    // Strip any leading 'assistant' messages (e.g. the greeting) before sending.
    const rawMessages: { role: string; content: string }[] = (messages ?? []).slice(-12)
    const firstUserIdx = rawMessages.findIndex(m => m.role === 'user')
    const claudeMessages = firstUserIdx > 0
      ? rawMessages.slice(firstUserIdx)
      : rawMessages

    if (!claudeMessages.length) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 })
    }

    console.log('[chat] Calling Claude API with', claudeMessages.length, 'messages...')
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: buildSystemPrompt(userName ?? '', userRole ?? '', meetingsContext, clientsContext),
      messages: claudeMessages as { role: 'user' | 'assistant'; content: string }[],
      max_tokens: 600,
    })

    const content = completion.content[0].type === 'text' ? completion.content[0].text : ''
    console.log('[chat] Claude responded, length:', content.length)
    return NextResponse.json({ content })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const status = (error as { status?: number })?.status ?? 500
    console.error('[chat] Claude API error:', status, message)
    return NextResponse.json(
      { error: `Claude API error: ${message}` },
      { status: 500 }
    )
  }
}
