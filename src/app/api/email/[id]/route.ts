import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/email/[id]
// Fetches a single Microsoft Outlook message (full body + attachments) for the
// signed-in user via Microsoft Graph, using the token stored in
// user_integrations. Refreshes the access token automatically when it's expired
// or within 5 minutes of expiry.
//
// Auth + token pattern mirrors src/app/api/calendar/my-events/route.ts (inlined
// per-route to keep this change confined to the four new email routes).
// Every failure path returns JSON { error: '<reason>' } — never an unhandled
// throw. Token/secret material is never logged.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// Full-message fields for the detail view, plus expanded attachments.
const MESSAGE_SELECT =
  'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments,isRead,flag,importance'

// Build a Graph URL with properly-encoded OData query params.
function graphUrl(path: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${GRAPH_BASE}${path}?${qs}`
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params?.id
    if (!messageId) {
      return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    }

    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // ── 2. Resolve the CASK Hub user + their Microsoft integration ───
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const admin = createServiceSupabase(supabaseUrl, serviceKey)

    const { data: userRow, error: userErr } = await admin
      .from('users')
      .select('id')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[email-get] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    const { data: integration, error: integErr } = await admin
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userRow.id)
      .eq('provider', 'microsoft')
      .maybeSingle()

    if (integErr) {
      console.error('[email-get] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    if (!integration) {
      return NextResponse.json({ error: 'not_connected' }, { status: 200 })
    }

    // ── 3. Refresh the access token if expired / expiring within 5 min ─
    let accessToken: string | null = integration.access_token ?? null
    const expiresAtMs = integration.expires_at
      ? new Date(integration.expires_at).getTime()
      : 0
    const needsRefresh = Date.now() + 5 * 60 * 1000 > expiresAtMs

    if (needsRefresh) {
      const clientId = process.env.MICROSOFT_CLIENT_ID
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
      const tenantId = process.env.MICROSOFT_TENANT_ID
      if (!clientId || !clientSecret || !tenantId) {
        return NextResponse.json({ error: 'oauth_config' }, { status: 500 })
      }
      if (!integration.refresh_token) {
        return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
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
        console.error('[email-get] token refresh failed:', refreshRes.status)
        return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
      }

      const refreshJson = await refreshRes.json()
      const newAccess: string | undefined = refreshJson.access_token
      const newRefresh: string = refreshJson.refresh_token ?? integration.refresh_token
      const expiresIn: number | undefined = refreshJson.expires_in

      if (!newAccess || typeof expiresIn !== 'number') {
        return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
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
        .eq('user_id', userRow.id)
        .eq('provider', 'microsoft')

      if (updateErr) {
        console.error('[email-get] token persist failed')
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }

    // ── 4. Fetch the single message (full body + attachments) ────────
    const url = graphUrl(`/me/messages/${encodeURIComponent(messageId)}`, {
      $select: MESSAGE_SELECT,
      $expand: 'attachments',
    })

    const graphRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (graphRes.status === 401) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }
    if (graphRes.status === 404) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (!graphRes.ok) {
      console.error('[email-get] graph error status:', graphRes.status)
      return NextResponse.json({ error: 'graph_error' }, { status: 502 })
    }

    const message = await graphRes.json()
    return NextResponse.json(message)
  } catch (err) {
    console.error('[email-get] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
