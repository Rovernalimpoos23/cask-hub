// src/app/api/big-vision-upload-chat/route.ts
//
// Claude endpoint for the CASK Big Vision AI floating assistant when a file is
// attached. Mirrors /api/big-vision-chat but injects an uploaded file (PDF / image /
// best-effort binary) as a content block on the last user turn.
//
// A dedicated route (rather than editing /api/big-vision-chat or the shared /api/chat)
// keeps the existing no-file chat path untouched. Requires ANTHROPIC_API_KEY.
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

interface IncomingFile {
  base64: string
  mediaType: string
  name: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, file } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[big-vision-upload-chat] ANTHROPIC_API_KEY is not set')
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }
    const anthropic = new Anthropic({ apiKey })

    // Claude requires the conversation to start with a 'user' turn. Strip any leading
    // 'assistant' messages and keep the most recent turns.
    const rawMessages: IncomingMessage[] = Array.isArray(messages) ? messages.slice(-16) : []
    const firstUserIdx = rawMessages.findIndex((m) => m.role === 'user')
    const claudeMessages = firstUserIdx > 0 ? rawMessages.slice(firstUserIdx) : rawMessages

    if (!claudeMessages.length) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 })
    }

    const system =
      typeof systemPrompt === 'string' && systemPrompt.trim().length > 0 ? systemPrompt : FALLBACK_SYSTEM_PROMPT

    // Build the message list. When a file is attached, inject it into the last user turn.
    type MsgContent = string | Array<Record<string, unknown>>
    type ProcessedMsg = { role: 'user' | 'assistant'; content: MsgContent }

    const f = file as IncomingFile | undefined
    let processedMessages: ProcessedMsg[]

    if (f?.base64 && f?.mediaType) {
      const lastIdx = claudeMessages.length - 1
      const prior: ProcessedMsg[] = claudeMessages
        .slice(0, lastIdx)
        .map((m) => ({ role: m.role, content: m.content }))
      const questionText = claudeMessages[lastIdx]?.content?.trim() || 'Please analyze this file.'

      let fileBlock: Record<string, unknown>
      if (f.mediaType === 'application/pdf') {
        fileBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.base64 } }
      } else if (f.mediaType.startsWith('image/')) {
        fileBlock = { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.base64 } }
      } else {
        // DOCX / other binary — Claude has no native block for these, so pass the
        // base64 as labeled text and ask it to extract any readable content (best-effort).
        fileBlock = {
          type: 'text',
          text:
            `[Attached file: ${f.name} (${f.mediaType})]\n` +
            `Base64-encoded binary content below — extract and analyse any readable text:\n\n${f.base64}`,
        }
      }

      processedMessages = [
        ...prior,
        { role: 'user', content: [fileBlock, { type: 'text', text: questionText }] },
      ]
    } else {
      processedMessages = claudeMessages.map((m) => ({ role: m.role, content: m.content }))
    }

    console.log('[big-vision-upload-chat] Calling Claude with', processedMessages.length, 'messages', f?.name ? `+ file: ${f.name}` : '(no file)')
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: processedMessages as any,
      max_tokens: 1500,
    })

    const content = completion.content[0].type === 'text' ? completion.content[0].text : ''
    console.log('[big-vision-upload-chat] Claude responded, length:', content.length)
    return NextResponse.json({ content })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[big-vision-upload-chat] Claude API error:', message)
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 500 })
  }
}
