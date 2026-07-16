import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/email/download-attachment?messageId=&attachmentId=&isPresidentInbox=
// Downloads a single message attachment from Microsoft Graph and streams it back
// as a file download (Content-Disposition: attachment). Mirrors the auth +
// token-refresh pattern used by the other email routes:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - users + user_integrations are read/written with the SERVICE-ROLE client so
//    the email-based lookups and token upsert bypass RLS.
//
// Query params:
//   messageId          (required) — Graph message id
//   attachmentId       (required) — Graph attachment id
//   isPresidentInbox   'true' | 'false' (default 'false')
//     'true'  → use Calin's token (president mailbox)
//     'false' → use the signed-in user's own token
//
// Error paths return plain-text responses (this endpoint yields a file, not JSON).
// Token/secret material is never logged (status codes only).

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// The president whose mailbox the isPresidentInbox path serves.
const CALIN_EMAIL = 'c.noonan@caskconstruction.com'
// Roles allowed to read the president's mailbox — same set the president-inbox
// and attachments routes enforce. Gating the isPresidentInbox path prevents any
// signed-in user from downloading Calin's attachments by passing isPresidentInbox.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

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
      console.error('[email-download-attachment] token refresh failed:', refreshRes.status)
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
      console.error('[email-download-attachment] token persist failed')
    }
  }

  if (!accessToken) {
    return { error: 'token_invalid', status: 401 }
  }
  return { accessToken }
}

// Strip characters that would break a Content-Disposition filename header.
function sanitizeFilename(name: string): string {
  // Remove quotes / control chars / path separators; fall back to a default.
  const cleaned = name.replace(/["\\\r\n]/g, '').replace(/[/\\]/g, '_').trim()
  return cleaned || 'attachment'
}

export async function GET(request: Request) {
  try {
    // ── 1. Read + validate query params ──────────────────────────────
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const attachmentId = searchParams.get('attachmentId')
    const isPresidentInbox = searchParams.get('isPresidentInbox') === 'true'

    if (!messageId || !messageId.trim() || !attachmentId || !attachmentId.trim()) {
      return new Response('missing_params', { status: 400 })
    }

    // ── 2. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return new Response('unauthorized', { status: 401 })
    }

    // ── 3. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return new Response('server_config', { status: 500 })
    }
    const admin = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 4. Resolve the Microsoft integration (token source) ──────────
    // identity selects which user_integrations row a token refresh persists to.
    let identity: Record<string, string>

    if (isPresidentInbox) {
      // Admin-only: gate the president mailbox the same way the other routes do.
      const { data: callerRow, error: callerErr } = await admin
        .from('users')
        .select('role')
        .eq('email', sessionEmail)
        .maybeSingle()

      if (callerErr) {
        console.error('[email-download-attachment] caller lookup failed')
        return new Response('user_lookup', { status: 500 })
      }
      if (!callerRow || !ADMIN_ROLES.includes(callerRow.role)) {
        return new Response('forbidden', { status: 403 })
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
        console.error('[email-download-attachment] user lookup failed')
        return new Response('user_lookup', { status: 500 })
      }
      if (!userRow) {
        return new Response('user_not_found', { status: 404 })
      }
      identity = { user_id: userRow.id }
    }

    const { data: integration, error: integErr } = await admin
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .match({ ...identity, provider: 'microsoft' })
      .maybeSingle()

    if (integErr) {
      console.error('[email-download-attachment] integration lookup failed')
      return new Response('integration_lookup', { status: 500 })
    }
    if (!integration) {
      return new Response('not_connected', { status: 404 })
    }

    // ── 5. Ensure a valid access token (refresh if needed) ───────────
    const tokenResult = await ensureAccessToken(admin, integration, identity)
    if ('error' in tokenResult) {
      return new Response(tokenResult.error, { status: tokenResult.status })
    }
    const accessToken = tokenResult.accessToken

    // ── 6. Fetch the attachment from Graph ───────────────────────────
    // Bearer resolves /me to the correct mailbox (caller's, or Calin's above).
    const graphRes = await fetch(
      `${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (graphRes.status === 401) {
      // Freshly-refreshed token still rejected — user must reconnect.
      return new Response('token_invalid', { status: 401 })
    }
    if (graphRes.status === 404) {
      return new Response('attachment_not_found', { status: 404 })
    }
    if (!graphRes.ok) {
      console.error('[email-download-attachment] graph error status:', graphRes.status)
      return new Response('graph_error', { status: 502 })
    }

    const graphJson = await graphRes.json()
    const name: string = typeof graphJson.name === 'string' ? graphJson.name : 'attachment'
    const contentType: string =
      typeof graphJson.contentType === 'string' && graphJson.contentType.trim()
        ? graphJson.contentType
        : 'application/octet-stream'
    const contentBytes: unknown = graphJson.contentBytes

    // item/reference attachments don't carry base64 contentBytes — can't download.
    if (typeof contentBytes !== 'string' || !contentBytes) {
      return new Response('unsupported_attachment', { status: 502 })
    }

    // ── 7. Decode base64 → Buffer and stream back as a file download ──
    const buffer = Buffer.from(contentBytes, 'base64')
    const filename = sanitizeFilename(name)

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[email-download-attachment] error:', err instanceof Error ? err.message : 'unknown')
    return new Response('server_error', { status: 500 })
  }
}
