import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/email/ai
// Runs an executive-assistant AI action (summarize / draft reply / extract action
// items / revise a draft) over an email's contents. Calls the Anthropic Messages API directly via
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

type Action = 'summarize' | 'draft_reply' | 'extract' | 'revise'

interface AiRequestBody {
  action?: string
  subject?: string
  body?: string
  senderName?: string
  currentDraft?: string // the existing draft (required for 'revise')
  revision?: string // the revision instruction (required for 'revise')
  messageId?: string // Graph message id — used to fetch attachment content
  isPresidentInbox?: boolean // true → read attachments from Calin's mailbox
  hasAttachments?: boolean // hint that the message carries attachments to include
}

// Shape returned by /api/email/attachments for each attachment.
interface ProcessedAttachment {
  name?: string
  contentType?: string
  type?: 'text' | 'image' | 'unsupported'
  content?: string | null
  size?: number
}

// Anthropic message content blocks — a plain string, or (with images) an array of
// a leading text block followed by base64 image blocks (multimodal request).
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

// Appended to every system prompt so the model knows attachment content (text
// extracts and/or images) may be part of the message it's reasoning over.
const ATTACHMENT_NOTE =
  ' If attachments are provided, read them carefully and include their content in your response.'

// System prompts per action (verbatim from the spec, plus the attachment note).
const SYSTEM_PROMPTS: Record<Action, string> = {
  summarize:
    'You are a senior executive communications assistant for CASK Construction. Summarize this email in 3-4 sentences. Be concise and focus on what matters most for a busy executive.' + ATTACHMENT_NOTE,
  draft_reply:
    'You are a senior executive communications assistant for CASK Construction. Draft a professional reply to this email. Be concise, match the tone of the original, do not make up facts. Do not include a subject line.' + ATTACHMENT_NOTE,
  extract:
    'You are a senior executive communications assistant for CASK Construction. Read this email and extract all action items, deadlines, and follow-ups. Format as a clean bullet list. Be specific and include names and dates where mentioned.' + ATTACHMENT_NOTE,
  revise:
    'You are a senior executive communications assistant for CASK Construction. Revise the following email draft based on the instruction given. Keep the same general meaning but apply the requested change. Return only the revised email text, no explanation.' + ATTACHMENT_NOTE,
}

// Claude accepts only these image media types; normalize "image/jpg" → the
// canonical "image/jpeg" and drop any "; charset=…" suffix.
const CLAUDE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
function normalizeMediaType(ct: string): string | null {
  const base = ct.split(';')[0].trim().toLowerCase()
  const normalized = base === 'image/jpg' ? 'image/jpeg' : base
  return CLAUDE_IMAGE_TYPES.has(normalized) ? normalized : null
}

function isAction(v: string): v is Action {
  return v === 'summarize' || v === 'draft_reply' || v === 'extract' || v === 'revise'
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
    const currentDraft = payload.currentDraft
    const revision = payload.revision
    const messageId = payload.messageId
    const isPresidentInbox = payload.isPresidentInbox
    const hasAttachments = payload.hasAttachments

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

    // 'revise' additionally requires the existing draft and the instruction.
    if (
      action === 'revise' &&
      (typeof currentDraft !== 'string' ||
        currentDraft.trim() === '' ||
        typeof revision !== 'string' ||
        revision.trim() === '')
    ) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // ── 2b. Resolve the signed-in user's display name for e-mail sign-offs ──
    // Best-effort: look up public.users by the session email using the service-role
    // client (so the read bypasses RLS). Any miss or failure falls back to
    // senderName, then a generic label, so the AI action still runs regardless.
    const userEmail = user.email
    let userName = senderName || 'CASK Team'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      try {
        const supabaseService = createServiceSupabase(supabaseUrl, serviceKey)
        const { data: userRow } = await supabaseService
          .from('users')
          .select('name')
          // Escape LIKE wildcards so an email containing % or _ matches literally.
          .ilike('email', userEmail.replace(/[%_]/g, '\\$&'))
          .maybeSingle()
        userName = userRow?.name || senderName || 'CASK Team'
      } catch (err) {
        // Non-fatal: keep the fallback userName and proceed.
        console.error('[email-ai] user name lookup failed:', err instanceof Error ? err.message : 'unknown')
      }
    }

    // ── 3. Select the system prompt for the action ───────────────────
    // NOTE: the literal string "CASK Construction Team" does NOT appear in any of
    // the SYSTEM_PROMPTS — those reference the company ("CASK Construction"), not a
    // "CASK Construction Team" sign-off (that string only ever arrived via the
    // caller's senderName). So there is nothing to find/replace in the prompts, and
    // the company name is intentionally left untouched. Instead we weave the user's
    // name into the sign-off for the email-producing actions only: draft_reply and
    // revise. summarize/extract don't produce an email, so adding a sign-off there
    // would corrupt their output — they keep their original prompt.
    const system =
      action === 'draft_reply' || action === 'revise'
        ? `${SYSTEM_PROMPTS[action]} Always sign off with: Best regards, ${userName}`
        : SYSTEM_PROMPTS[action]

    // ── 4. Build the base user message (plain-text body only) ────────
    const plainBody = stripHtml(body)
    let userMessage =
      action === 'revise'
        ? `Original email:\n${plainBody}\n\nCurrent draft:\n${currentDraft}\n\nRevision instruction: ${revision}\n\nPlease revise the draft accordingly.`
        : `Subject: ${subject}\n\nFrom: ${senderName}\n\n${plainBody}`

    // draft_reply (including the compose modal, which sends action 'draft_reply')
    // should be signed as the logged-in user, so tell the model who to sign as.
    if (action === 'draft_reply') {
      userMessage += `\n\nSign the email as: ${userName}`
    }

    // ── 4b. Fetch + fold in attachment content ───────────────────────
    // Only when the caller flags attachments AND gives us a messageId. Attachments
    // are an enhancement: any failure here is swallowed so the core AI action still
    // runs on the email body alone.
    const imageBlocks: ContentBlock[] = []
    if (hasAttachments === true && typeof messageId === 'string' && messageId.trim() !== '') {
      try {
        const attRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/email/attachments`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Forward the caller's session cookie so the attachments route
              // authenticates as the same user.
              cookie: request.headers.get('cookie') ?? '',
            },
            body: JSON.stringify({
              messageId,
              isPresidentInbox: isPresidentInbox ?? false,
            }),
          }
        )
        const attData: { attachments?: ProcessedAttachment[] } | null = attRes.ok
          ? await attRes.json()
          : null
        const attachments = Array.isArray(attData?.attachments) ? attData!.attachments : []

        // Text attachments → appended context block.
        const attachmentContext = attachments
          .filter(a => a.type === 'text' && a.content)
          .map(a => `--- Attachment: ${a.name ?? 'attachment'} ---\n${a.content}`)
          .join('\n\n')

        if (attachmentContext) {
          userMessage += `\n\nATTACHMENTS:\n${attachmentContext}`
        }

        // Image attachments → base64 blocks for Claude's multimodal API. Skip any
        // whose media type Claude can't accept.
        for (const a of attachments) {
          if (a.type !== 'image' || !a.content || !a.contentType) continue
          const mediaType = normalizeMediaType(a.contentType)
          if (!mediaType) continue
          imageBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: a.content },
          })
        }
      } catch (err) {
        // Non-fatal: proceed without attachment content.
        console.error('[email-ai] attachment fetch failed:', err instanceof Error ? err.message : 'unknown')
      }
    }

    // Final message content: a plain string, or (when images are present) a text
    // block followed by the image blocks.
    const messageContent: string | ContentBlock[] =
      imageBlocks.length > 0
        ? [
            { type: 'text', text: `${userMessage}\n\nSome attachments are images, included below. Analyze the attached images too.` },
            ...imageBlocks,
          ]
        : userMessage

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
          messages: [{ role: 'user', content: messageContent }],
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
