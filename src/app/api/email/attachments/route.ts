import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/email/attachments
// Fetches a message's attachments from Microsoft Graph and extracts their text
// content (PDF / DOCX / XLSX / XLS) or returns raw base64 (images) so the caller
// can feed the content to the AI. Mirrors the auth + token-refresh pattern used by
// the other email routes (src/app/api/email/inbox + president-inbox):
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - users + user_integrations are read/written with the SERVICE-ROLE client so
//    the email-based lookups and token upsert bypass RLS.
//
// Request body:
//   { messageId: string, isPresidentInbox?: boolean }
//     isPresidentInbox true  → use Calin's token (president mailbox)
//     isPresidentInbox false → use the signed-in user's own token
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled
// throw. Token/secret material is never logged (status codes only).

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// The president whose mailbox the isPresidentInbox path serves.
const CALIN_EMAIL = 'c.noonan@caskconstruction.com'
// Roles allowed to read the president's mailbox — same set the president-inbox
// route enforces. Gating the isPresidentInbox path here prevents any signed-in
// user from reading Calin's attachments by passing isPresidentInbox: true.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Processing limits (keep AI token usage bounded).
const MAX_ATTACHMENTS = 5
const MAX_TEXT_CHARS = 5000

// contentType → handling. Excel has two spellings (modern .xlsx + legacy .xls).
const PDF_TYPE = 'application/pdf'
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const XLS_TYPE = 'application/vnd.ms-excel'
const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

// A Graph fileAttachment carries base64 contentBytes; item/reference attachments
// don't (and are treated as unsupported).
interface GraphAttachment {
  '@odata.type'?: string
  id?: string
  name?: string
  contentType?: string
  size?: number
  contentBytes?: string
}

interface ProcessedAttachment {
  name: string
  contentType: string
  type: 'text' | 'image' | 'unsupported'
  content: string | null
  size: number
}

// Normalize a Graph contentType ("text/x; charset=utf-8" → "text/x").
function baseContentType(ct: string): string {
  return ct.split(';')[0].trim().toLowerCase()
}

// Ensure a valid, non-expiring access token, refreshing (and persisting) it when
// it's expired or within 5 minutes of expiry — same pattern as the other routes.
// `identity` selects which user_integrations row to update (by user_id or email).
// Returns the usable token, or an { error, status } to surface to the client.
async function ensureAccessToken(
  admin: SupabaseClient,
  integration: { access_token: string | null; refresh_token: string | null; expires_at: string | null },
  identity: Record<string, string>,
): Promise<{ accessToken: string } | { error: string; status: number }> {
  let accessToken: string | null = integration.access_token ?? null
  const expiresAtMs = integration.expires_at ? new Date(integration.expires_at).getTime() : 0
  const needsRefresh = Date.now() + 5 * 60 * 1000 > expiresAtMs

  if (needsRefresh) {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const tenantId = process.env.MICROSOFT_TENANT_ID
    if (!clientId || !clientSecret || !tenantId) {
      return { error: 'oauth_config', status: 500 }
    }
    if (!integration.refresh_token) {
      return { error: 'token_invalid', status: 401 }
    }

    const refreshRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    )

    if (!refreshRes.ok) {
      // Do not log token/secret material — status only.
      console.error('[email-attachments] token refresh failed:', refreshRes.status)
      return { error: 'token_invalid', status: 401 }
    }

    const refreshJson = await refreshRes.json()
    const newAccess: string | undefined = refreshJson.access_token
    // MS returns a rotated refresh token; keep the old one if it doesn't.
    const newRefresh: string = refreshJson.refresh_token ?? integration.refresh_token
    const expiresIn: number | undefined = refreshJson.expires_in

    if (!newAccess || typeof expiresIn !== 'number') {
      return { error: 'token_invalid', status: 401 }
    }

    accessToken = newAccess
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error: updateErr } = await admin
      .from('user_integrations')
      .update({
        access_token: newAccess,
        refresh_token: newRefresh,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .match({ ...identity, provider: 'microsoft' })

    if (updateErr) {
      // Non-fatal: we still have a valid access token in memory and can serve the
      // request. The stale row just gets refreshed next time.
      console.error('[email-attachments] token persist failed')
    }
  }

  if (!accessToken) {
    return { error: 'token_invalid', status: 401 }
  }
  return { accessToken }
}

// ── Per-type text extractors ─────────────────────────────────────────
// Each throws on failure; the caller wraps them so one bad attachment can't fail
// the whole request.

async function extractPdfText(buffer: Buffer): Promise<string> {
  // The default 'pdfjs-dist' entry auto-detects Node and runs on the main thread
  // (no browser worker file needed). Dynamic import keeps this heavy dep off the
  // hot path for non-PDF requests.
  const pdfjs = await import('pdfjs-dist')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  let text = ''
  for (let page = 1; page <= pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent()
    text += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n'
    // Stop early once we have enough — no need to parse the rest of a long PDF.
    if (text.length >= MAX_TEXT_CHARS) break
  }
  return text
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

function extractXlsxText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  let out = ''
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    out += `# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}\n\n`
    if (out.length >= MAX_TEXT_CHARS) break
  }
  return out
}

// Extract a single attachment into the response shape. Never throws — extraction
// failures degrade to { type: 'unsupported', content: null }.
async function processAttachment(att: GraphAttachment): Promise<ProcessedAttachment> {
  const name = att.name ?? 'attachment'
  const contentType = att.contentType ?? 'application/octet-stream'
  const size = typeof att.size === 'number' ? att.size : 0
  const base = baseContentType(contentType)
  const bytes = att.contentBytes

  // Images: return the base64 as-is (sent to Claude Vision separately). No decode.
  if (IMAGE_TYPES.has(base)) {
    return bytes
      ? { name, contentType, type: 'image', content: bytes, size }
      : { name, contentType, type: 'unsupported', content: null, size }
  }

  // Text-extractable docs need the base64 payload; item/reference attachments
  // (no contentBytes) can't be extracted.
  const isDoc = base === PDF_TYPE || base === DOCX_TYPE || base === XLSX_TYPE || base === XLS_TYPE
  if (!isDoc || !bytes) {
    return { name, contentType, type: 'unsupported', content: null, size }
  }

  try {
    const buffer = Buffer.from(bytes, 'base64')
    let text: string
    if (base === PDF_TYPE) {
      text = await extractPdfText(buffer)
    } else if (base === DOCX_TYPE) {
      text = await extractDocxText(buffer)
    } else {
      text = extractXlsxText(buffer)
    }
    return { name, contentType, type: 'text', content: text.slice(0, MAX_TEXT_CHARS), size }
  } catch (err) {
    // One failing attachment must not fail the whole request.
    console.error('[email-attachments] extraction failed for a', base, 'attachment:',
      err instanceof Error ? err.message : 'unknown')
    return { name, contentType, type: 'unsupported', content: null, size }
  }
}

export async function POST(request: Request) {
  try {
    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // ── 2. Parse + validate the request body ─────────────────────────
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }
    const messageId = (body as { messageId?: unknown }).messageId
    if (typeof messageId !== 'string' || !messageId.trim()) {
      return NextResponse.json({ error: 'missing_message_id' }, { status: 400 })
    }
    const isPresidentInbox = (body as { isPresidentInbox?: unknown }).isPresidentInbox === true

    // ── 3. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const admin = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 4. Resolve the Microsoft integration (token source) ──────────
    // identity selects which user_integrations row a token refresh persists to.
    let identity: Record<string, string>

    if (isPresidentInbox) {
      // Admin-only: gate the president mailbox the same way president-inbox does.
      const { data: callerRow, error: callerErr } = await admin
        .from('users')
        .select('role')
        .eq('email', sessionEmail)
        .maybeSingle()

      if (callerErr) {
        console.error('[email-attachments] caller lookup failed')
        return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
      }
      if (!callerRow || !ADMIN_ROLES.includes(callerRow.role)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
      identity = { email: CALIN_EMAIL }
    } else {
      // Signed-in user's own mailbox: resolve their CASK Hub user id first.
      const { data: userRow, error: userErr } = await admin
        .from('users')
        .select('id')
        .eq('email', sessionEmail)
        .maybeSingle()

      if (userErr) {
        console.error('[email-attachments] user lookup failed')
        return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
      }
      if (!userRow) {
        return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
      }
      identity = { user_id: userRow.id }
    }

    const { data: integration, error: integErr } = await admin
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .match({ ...identity, provider: 'microsoft' })
      .maybeSingle()

    if (integErr) {
      console.error('[email-attachments] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    // Not connected → 200 so the client can render a "Connect Outlook" state.
    if (!integration) {
      return NextResponse.json({ error: 'not_connected' }, { status: 200 })
    }

    // ── 5. Ensure a valid access token (refresh if needed) ───────────
    const tokenResult = await ensureAccessToken(admin, integration, identity)
    if ('error' in tokenResult) {
      return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status })
    }
    const accessToken = tokenResult.accessToken

    // ── 6. Fetch the message's attachments from Graph ────────────────
    // Bearer resolves /me to the correct mailbox (caller's, or Calin's above).
    const graphRes = await fetch(
      `${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}/attachments`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    // DEBUG: Graph response status (safe — no token/body content).
    console.log('[attachments] Graph status:', graphRes.status)

    if (graphRes.status === 401) {
      // Freshly-refreshed token still rejected — user must reconnect.
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }
    if (graphRes.status === 404) {
      return NextResponse.json({ error: 'message_not_found' }, { status: 404 })
    }
    if (!graphRes.ok) {
      console.error('[email-attachments] graph error status:', graphRes.status)
      return NextResponse.json({ error: 'graph_error' }, { status: 502 })
    }

    const graphJson = await graphRes.json()
    const rawAttachments: GraphAttachment[] = Array.isArray(graphJson.value) ? graphJson.value : []

    // DEBUG: what Graph returned. contentBytes content is never logged — only its
    // presence + length (the source variable here is graphJson, not `data`).
    console.log('[attachments] count:', graphJson.value?.length)
    if (graphJson.value?.[0]) {
      console.log('[attachments] first attachment:',
        JSON.stringify({
          name: graphJson.value[0].name,
          contentType: graphJson.value[0].contentType,
          size: graphJson.value[0].size,
          hasContentBytes: !!graphJson.value[0].contentBytes,
          contentBytesLength: graphJson.value[0].contentBytes?.length ?? 0,
        })
      )
    }

    // ── 7. Extract text/base64 per attachment (max 5, one-by-one) ────
    // Sequential so a heavy PDF parse doesn't run alongside others; each attachment
    // is isolated in processAttachment so a single failure can't fail the batch.
    const attachments: ProcessedAttachment[] = []
    for (const att of rawAttachments.slice(0, MAX_ATTACHMENTS)) {
      attachments.push(await processAttachment(att))
    }

    return NextResponse.json({ attachments })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[email-attachments] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
