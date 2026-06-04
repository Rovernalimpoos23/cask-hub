// Dedicated chat route for individual client pages.
// Accepts a pre-built systemPrompt from the client page (which already
// has all client_meetings data in scope) so the global /api/chat route's
// stripping logic and calendar_events queries never interfere.
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }

    const { messages, systemPrompt } = await req.json() as {
      messages: { role: string; content: string }[]
      systemPrompt: string
    }

    // Keep only user/assistant turns — no system messages mixed in
    const claudeMessages = (messages ?? []).filter(
      m => m.role === 'user' || m.role === 'assistant'
    ) as { role: 'user' | 'assistant'; content: string }[]

    if (!claudeMessages.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    // Claude requires the conversation to start with a user turn
    const firstUserIdx = claudeMessages.findIndex(m => m.role === 'user')
    const trimmed = firstUserIdx > 0 ? claudeMessages.slice(firstUserIdx) : claudeMessages

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: systemPrompt ?? 'You are a helpful AI assistant for CASK Construction.',
      messages: trimmed,
      max_tokens: 600,
    })

    const content = completion.content[0].type === 'text' ? completion.content[0].text : ''
    return NextResponse.json({ content })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[chat/client] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
