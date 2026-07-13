import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/email/compose
// Sends a NEW email FROM the signed-in user's own Outlook account via Microsoft
// Graph (POST /me/sendMail), using the token stored in user_integrations.
// Refreshes the access token automatically when it's expired or within 5 minutes
// of expiry. saveToSentItems: true so the message lands in the Outlook Sent folder.
//
// Body: { to: string[], subject: string, body: string, cc?: string[], bcc?: string[] }
// The plain-text body is converted to HTML (newlines → <br>) so formatting is
// preserved on arrival. Auth + token pattern mirrors the other email routes
// (inlined per-route). Every failure path returns JSON { error: '<reason>' } —
// never an unhandled throw. Token/secret material is never logged.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// Convert the plain-text body into HTML so Outlook preserves line breaks. HTML-
// escape first (so a literal '<', '>' or '&' renders as text, not markup), then
// turn each newline into a <br> and wrap in a styled container.
function convertToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBreaks = escaped.replace(/\n/g, '<br>')
  return `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${withBreaks}</div>`
}

// A recipient list is valid when it's an array of non-empty strings.
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string')
}

export async function POST(request: Request) {
  try {
    // ── Parse + validate the request body ────────────────────────────
    let payload: {
      to?: unknown
      subject?: unknown
      body?: unknown
      cc?: unknown
      bcc?: unknown
    }
    try {
      payload = (await request.json()) as typeof payload
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const to = payload.to
    const subject = payload.subject
    const body = payload.body
    const cc = payload.cc
    const bcc = payload.bcc

    // to must be a non-empty string[]; subject/body must be non-empty strings.
    // cc/bcc, when present, must be string[].
    if (
      !isStringArray(to) ||
      to.length === 0 ||
      typeof subject !== 'string' ||
      subject.trim() === '' ||
      typeof body !== 'string' ||
      body.trim() === '' ||
      (cc !== undefined && !isStringArray(cc)) ||
      (bcc !== undefined && !isStringArray(bcc))
    ) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
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
      console.error('[email-compose] user lookup failed')
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
      console.error('[email-compose] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    if (!integration) {
      return NextResponse.json({ error: 'not_connected' }, { status: 400 })
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
        console.error('[email-compose] token refresh failed:', refreshRes.status)
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
        console.error('[email-compose] token persist failed')
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }

    // ── 4. Build the Graph sendMail payload ──────────────────────────
    const toGraphRecipient = (email: string) => ({ emailAddress: { address: email } })
    const graphPayload = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: convertToHtml(body),
        },
        toRecipients: to.map(toGraphRecipient),
        ccRecipients: cc?.map(toGraphRecipient) ?? [],
        bccRecipients: bcc?.map(toGraphRecipient) ?? [],
      },
      saveToSentItems: true,
    }

    // ── 5. Send via Graph ────────────────────────────────────────────
    // POST /me/sendMail sends immediately; a 202 Accepted (empty body) means success.
    const graphRes = await fetch(`${GRAPH_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphPayload),
    })

    if (graphRes.status === 401) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }
    if (!graphRes.ok) {
      console.error('[email-compose] graph error status:', graphRes.status)
      return NextResponse.json(
        { error: 'graph_error', message: graphRes.status },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[email-compose] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
