import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/email/president-inbox
// Lists President Calin Noonan's Microsoft Outlook mail for a given folder via
// Microsoft Graph — ALWAYS using Calin's stored Graph token, regardless of who
// is signed in.
//
// This mirrors /api/email/inbox, with two deliberate differences:
//  1. AUTHORIZATION: the caller must be signed in AND hold an admin role
//     (president / ea / ai_specialist). Everyone else gets 403.
//  2. TOKEN SOURCE: instead of the caller's own token, this always looks up
//     Calin's row in user_integrations (by email) and uses that token for every
//     Graph call. /me therefore resolves to Calin's mailbox.
//
// Auth/data pattern otherwise matches the rest of the codebase:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - users + user_integrations are read/written with the SERVICE-ROLE client so
//    the email-based lookups and token upsert bypass RLS.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled
// throw. Token/secret material is never logged (status codes only).

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// The president whose mailbox this route always serves.
const CALIN_EMAIL = 'c.noonan@caskconstruction.com'
// Roles allowed to view the president's inbox (same set used across the app).
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Fields requested for each message in the list view.
const MESSAGE_SELECT =
  'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,flag,importance'

// Supported folder → Graph message-collection path (or advanced filter query).
// 'flagged' is not a folder: it's a filter over all of /me/messages.
const FOLDERS = ['inbox', 'sent', 'flagged', 'drafts', 'archive', 'trash'] as const
type Folder = (typeof FOLDERS)[number]

function isFolder(v: string): v is Folder {
  return (FOLDERS as readonly string[]).includes(v)
}

// Build a Graph URL with properly-encoded OData query params.
function graphUrl(path: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${GRAPH_BASE}${path}?${qs}`
}

export async function GET(request: Request) {
  try {
    // ── 1. Require a signed-in ADMIN session ─────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    // Service-role client for ALL Supabase ops (role check + token lookup/update).
    const admin = createServiceSupabase(supabaseUrl, serviceKey)

    // Look up the caller's role and gate on the admin set.
    const { data: callerRow, error: callerErr } = await admin
      .from('users')
      .select('role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (callerErr) {
      console.error('[president-inbox] caller lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    // Unknown user or non-admin role → forbidden.
    if (!callerRow || !ADMIN_ROLES.includes(callerRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── 2. Look up CALIN'S Microsoft integration specifically ────────
    const { data: integration, error: integErr } = await admin
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('email', CALIN_EMAIL)
      .eq('provider', 'microsoft')
      .maybeSingle()

    if (integErr) {
      console.error('[president-inbox] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    // Not connected → 200 so the client can render a "Connect Outlook" state.
    if (!integration) {
      return NextResponse.json({ error: 'not_connected' }, { status: 200 })
    }

    // ── 3. Refresh Calin's access token if expired / expiring within 5 min ─
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
        // Nothing to refresh with — Calin must reconnect.
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
        // Do not log token/secret material — status only.
        console.error('[president-inbox] token refresh failed:', refreshRes.status)
        return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
      }

      const refreshJson = await refreshRes.json()
      const newAccess: string | undefined = refreshJson.access_token
      // MS returns a rotated refresh token; keep the old one if it doesn't.
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
        .eq('email', CALIN_EMAIL)
        .eq('provider', 'microsoft')

      if (updateErr) {
        // Non-fatal: we still have a valid access token in memory and can serve
        // the mailbox. The stale row just gets refreshed next time.
        console.error('[president-inbox] token persist failed')
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }

    // ── 4. Parse + validate query params ─────────────────────────────
    const { searchParams } = new URL(request.url)
    const folderParam = (searchParams.get('folder') || 'inbox').toLowerCase()
    const folder: Folder = isFolder(folderParam) ? folderParam : 'inbox'

    // top: 1..200 (Graph's page ceiling), default 50. skip: >= 0, default 0.
    const parsedTop = Number(searchParams.get('top'))
    const top =
      Number.isInteger(parsedTop) && parsedTop > 0 ? Math.min(parsedTop, 200) : 50
    const parsedSkip = Number(searchParams.get('skip'))
    const skip = Number.isInteger(parsedSkip) && parsedSkip > 0 ? parsedSkip : 0

    // ── 5. Build the Graph request for the requested folder ──────────
    // Well-known folders map to a message collection; 'flagged' is an advanced
    // filter over all messages. Bearer is CALIN'S token → /me is Calin's mailbox.
    const FOLDER_PATH: Record<Exclude<Folder, 'flagged'>, string> = {
      inbox: '/me/mailFolders/inbox/messages',
      sent: '/me/mailFolders/sentItems/messages',
      drafts: '/me/mailFolders/drafts/messages',
      archive: '/me/mailFolders/archive/messages',
      trash: '/me/mailFolders/deletedItems/messages',
    }

    const baseParams: Record<string, string> = {
      $select: MESSAGE_SELECT,
      $orderby: 'receivedDateTime desc',
      $top: String(top),
      $skip: String(skip),
      $count: 'true',
    }

    let url: string
    if (folder === 'flagged') {
      url = graphUrl('/me/messages', {
        $filter: "flag/flagStatus eq 'flagged'",
        ...baseParams,
      })
    } else {
      url = graphUrl(FOLDER_PATH[folder], baseParams)
    }

    // ConsistencyLevel: eventual is required for $count (and for the advanced
    // $filter used by the 'flagged' folder) on message collections.
    const graphRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: 'eventual',
      },
    })

    if (graphRes.status === 401) {
      // Freshly-refreshed token still rejected — Calin must reconnect.
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }
    if (!graphRes.ok) {
      console.error('[president-inbox] graph error status:', graphRes.status)
      return NextResponse.json({ error: 'graph_error' }, { status: 502 })
    }

    const graphJson = await graphRes.json()

    // ── 6. Shape the response ────────────────────────────────────────
    const messages = Array.isArray(graphJson.value) ? graphJson.value : []
    const totalCount =
      typeof graphJson['@odata.count'] === 'number'
        ? graphJson['@odata.count']
        : messages.length
    // Prefer Graph's paging link; fall back to a count-based check.
    const hasMore =
      typeof graphJson['@odata.nextLink'] === 'string'
        ? true
        : skip + messages.length < totalCount

    return NextResponse.json({ messages, totalCount, hasMore })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[president-inbox] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
