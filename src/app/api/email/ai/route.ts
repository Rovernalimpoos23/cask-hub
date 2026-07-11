import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/email/ai
// Runs an executive-assistant AI action (summarize / draft reply / extract action
// items) over an email's contents. Calls the Anthropic Messages API directly via
// fetch (no SDK) so the ANTHROPIC_API_KEY stays server-side — the browser never
// sees it.
//
// Session identity comes from the SSR cookie client (@/lib/supabase-server), the
// same server-side auth used elsewhere in the app.
//
// Every failure path returns JSON — never an unhandled throw. The API key is
// never logged.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 2000

type Action = 'summarize' | 'draft_reply' | 'extract'

interface AiRequestBody {
  action?: string
  subject?: string
  body?: string
  senderName?: string
}

// System prompts per action (verbatim from the spec).
const SYSTEM_PROMPTS: Record<Action, string> = {
  summarize:
    'You are a senior executive communications assistant for CASK Construction. Summarize this email in 3-4 sentences. Be concise and focus on what matters most for a busy executive.',
  draft_reply:
    'You are a senior executive communications assistant for CASK Construction. Draft a professional reply to this email. Be concise, match the tone of the original, do not make up facts. Do not include a subject line.',
  extract:
    'You are a senior executive communications assistant for CASK Construction. Read this email and extract all action items, deadlines, and follow-ups. Format as a clean bullet list. Be specific and include names and dates where mentioned.',
}

function isAction(v: string): v is Action {
  return v === 'summarize' || v === 'draft_reply' || v === 'extract'
}

// Decode a handful of common HTML entities, then strip tags and collapse
// whitespace. Entities are decoded BEFORE tag stripping so numeric/named
// entities inside text survive; the stripping regex only targets < > tag markup.
function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    // Generic numeric entities (decimal + hex), e.g. &#8217; &#x2019;
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
}

// Guard against invalid code points from malformed entities.
function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

// Full HTML → plain text: decode entities, remove tags, normalise whitespace.
function stripHtml(input: string): string {
  return decodeEntities(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: Request) {
  try {
    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // ── 2. Parse + validate the request body ─────────────────────────
    let payload: AiRequestBody
    try {
      payload = (await request.json()) as AiRequestBody
    } catch {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const action = payload.action
    const subject = payload.subject
    const body = payload.body
    const senderName = payload.senderName

    // All fields are required. Strings must be present; body/subject/senderName
    // must be strings (empty body is not useful, so require non-empty content).
    if (
      typeof action !== 'string' ||
      !isAction(action) ||
      typeof subject !== 'string' ||
      typeof body !== 'string' ||
      typeof senderName !== 'string' ||
      body.trim() === ''
    ) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // ── 3. Select the system prompt for the action ───────────────────
    const system = SYSTEM_PROMPTS[action]

    // ── 4. Build the user message (plain-text body only) ─────────────
    const plainBody = stripHtml(body)
    const userMessage = `Subject: ${subject}\n\nFrom: ${senderName}\n\n${plainBody}`

    // ── 5. Call the Anthropic Messages API directly (no SDK) ─────────
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Missing server configuration — surface a generic error, never the key.
      console.error('[email-ai] ANTHROPIC_API_KEY is not configured')
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    let anthropicRes: Response
    try {
      anthropicRes = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })
    } catch {
      // Network-level failure reaching Anthropic.
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    if (!anthropicRes.ok) {
      // Log status only — never the key or response body (may echo request).
      console.error('[email-ai] anthropic error status:', anthropicRes.status)
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    const data = (await anthropicRes.json()) as {
      content?: { type?: string; text?: string }[]
    }

    // Concatenate all text blocks from the response.
    const resultText = Array.isArray(data.content)
      ? data.content
          .filter(b => b?.type === 'text' && typeof b.text === 'string')
          .map(b => b.text)
          .join('')
          .trim()
      : ''

    if (!resultText) {
      // Well-formed response but no usable text — treat as an AI failure.
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    // ── 6. Success ───────────────────────────────────────────────────
    return NextResponse.json({ result: resultText })
  } catch (err) {
    // Never throw unhandled — surface a generic error (no sensitive data).
    console.error('[email-ai] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
