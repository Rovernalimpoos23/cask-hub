import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/email/[id]/flag
// Flags or unflags a single Microsoft Outlook message via Microsoft Graph
// (PATCH /me/messages/{id} with a flag.flagStatus), using the token stored in
// user_integrations. Refreshes the access token automatically when it's expired
// or within 5 minutes of expiry. Auth + token pattern mirrors the other email
// routes (inlined per-route).
//
// Body: { flagged: boolean, isPresidentInbox?: boolean }
//   isPresidentInbox true  → flag on Calin's mailbox (president inbox)
//   isPresidentInbox false → flag on the signed-in user's own mailbox
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled
// throw. Token/secret material is never logged (status codes only).

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// The president whose mailbox the isPresidentInbox path serves.
const CALIN_EMAIL = 'c.noonan@caskconstruction.com'
// Roles allowed to act on the president's mailbox — same set the president-inbox
// and attachment routes enforce. Gating the isPresidentInbox path prevents any
// signed-in user from flagging Calin's mail by passing isPresidentInbox: true.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Ensure a valid, non-expiring access token, refreshing (and persisting) it when
// it's expired or within 5 minutes of expiry — same pattern as the other routes.
// `identity` selects which user_integrations row to read/update (by user_id or
// email). Returns the usable token, or an { error, status } to surface.
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
      console.error('[email-flag] token refresh failed:', refreshRes.status)
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
      console.error('[email-flag] token persist failed')
    }
  }

  if (!accessToken) {
    return { error: 'token_invalid', status: 401 }
  }
  return { accessToken }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ── 1. Message id from the [id] segment ──────────────────────────
    const messageId = params?.id
    if (!messageId) {
      return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    }

    // ── 2. Parse + validate the request body ─────────────────────────
    let body: { flagged?: unknown; isPresidentInbox?: unknown }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (typeof body.flagged !== 'boolean') {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    const flagged = body.flagged
    const isPresidentInbox = body.isPresidentInbox === true

    // ── 3. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // ── 4. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const admin = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 5. Resolve the Microsoft integration (token source) ──────────
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
        console.error('[email-flag] caller lookup failed')
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
        console.error('[email-flag] user lookup failed')
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
      console.error('[email-flag] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    if (!integration) {
      return NextResponse.json({ error: 'not_connected' }, { status: 400 })
    }

    // ── 6. Ensure a valid access token (refresh if needed) ───────────
    const tokenResult = await ensureAccessToken(admin, integration, identity)
    if ('error' in tokenResult) {
      return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status })
    }
    const accessToken = tokenResult.accessToken

    // ── 7. PATCH the message's flag status via Graph ─────────────────
    // Bearer resolves /me to the correct mailbox (caller's, or Calin's above).
    const graphRes = await fetch(
      `${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flag: { flagStatus: flagged ? 'flagged' : 'notFlagged' },
        }),
      }
    )

    if (graphRes.status === 401) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }
    if (graphRes.status === 404) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (!graphRes.ok) {
      console.error('[email-flag] graph error status:', graphRes.status)
      return NextResponse.json({ error: 'graph_error' }, { status: 502 })
    }

    return NextResponse.json({ success: true, flagged })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[email-flag] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
