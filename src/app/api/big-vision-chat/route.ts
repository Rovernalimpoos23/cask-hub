// src/app/api/big-vision-chat/route.ts
// Dedicated Claude endpoint for the CASK Big Vision AI floating assistant.
//
// Why a separate route (and not the shared /api/chat)?
// /api/chat builds its OWN system prompt server-side from pageContext and does not
// accept a client-supplied system prompt — and it never reads cask_vision_content.
// The Big Vision AI needs to send a system prompt assembled from the live
// cask_vision_content rows (built client-side in FloatingVisionAI). Since /api/chat
// can't carry that without modifying it (out of scope for this phase), this route
// accepts { messages, systemPrompt } and relays them to Claude.
//
// Requires ANTHROPIC_API_KEY in environment (same key the existing /api/chat uses).
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const FALLBACK_SYSTEM_PROMPT =
  "You are CASK Big Vision AI, the strategic intelligence assistant for CASK Construction. " +
  "You have knowledge of CASK's vision, goals, and strategic plans. Be concise, direct, and specific. " +
  "Note: full vision context could not be loaded for this session, so some answers may be limited."

interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[big-vision-chat] ANTHROPIC_API_KEY is not set')
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }
    const anthropic = new Anthropic({ apiKey })

    // Claude requires the conversation to start with a 'user' turn. Strip any leading
    // 'assistant' messages (e.g. the greeting) and keep the most recent turns.
    const rawMessages: IncomingMessage[] = Array.isArray(messages) ? messages.slice(-16) : []
    const firstUserIdx = rawMessages.findIndex((m) => m.role === 'user')
    const claudeMessages = firstUserIdx > 0 ? rawMessages.slice(firstUserIdx) : rawMessages

    if (!claudeMessages.length) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 })
    }

    const system =
      typeof systemPrompt === 'string' && systemPrompt.trim().length > 0
        ? systemPrompt
        : FALLBACK_SYSTEM_PROMPT

    console.log('[big-vision-chat] Calling Claude with', claudeMessages.length, 'messages...')
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system,
      messages: claudeMessages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 1024,
    })

    const content = completion.content[0].type === 'text' ? completion.content[0].text : ''
    console.log('[big-vision-chat] Claude responded, length:', content.length)
    return NextResponse.json({ content })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[big-vision-chat] Claude API error:', message)
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 500 })
  }
}
