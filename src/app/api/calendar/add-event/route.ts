import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/calendar/add-event
// Creates a Microsoft Outlook calendar event for the signed-in user via Microsoft
// Graph (POST /me/events), using the token stored in user_integrations. Refreshes
// the access token automatically when it's expired or within 5 minutes of expiry.
//
// Auth + token pattern mirrors src/app/api/calendar/my-events/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - user_integrations + users are read/written with the SERVICE-ROLE client
//    (same pattern as src/app/api/auth/microsoft/callback/route.ts) so the
//    email-based lookup and token upsert bypass RLS.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
// Token/secret material is never logged.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
// Microsoft's Windows timezone name for US Eastern (NOT the IANA "America/New_York").
// Graph interprets the naive `dateTime` values below in this zone.
const GRAPH_TZ = 'Eastern Standard Time'

// Shape of the JSON body this route accepts.
interface AddEventBody {
  title?: string
  date?: string // YYYY-MM-DD
  startTime?: string // HH:MM (ET wall-clock)
  endTime?: string // HH:MM (ET wall-clock)
  location?: string
  body?: string
  isAllDay?: boolean
  isTeamsMeeting?: boolean
  attendees?: string[]
  isRecurring?: boolean
  recurringFrequency?: 'daily' | 'weekly' | 'monthly'
  recurringEndDate?: string // client sends YYYY-MM-DD (date input) or mm/dd/yyyy
}

// Combine a YYYY-MM-DD date and HH:MM time into the naive local datetime string
// Graph expects when a `timeZone` is supplied alongside (no offset — the zone is
// carried by GRAPH_TZ). e.g. ('2026-07-11', '09:00') → '2026-07-11T09:00:00'.
function toGraphDateTime(date: string, time: string): string {
  return `${date}T${time}:00`
}

// Graph's weekly recurrence pattern names the day of week in lowercase. Map a
// YYYY-MM-DD date to that name. Note: getDay() reads local time, but for a bare
// YYYY-MM-DD string the JS Date is parsed as UTC midnight, so this can be off by
// one day in zones behind UTC — kept as specified for parity with the client.
const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

function getDayOfWeek(date: string): string {
  return DAYS_OF_WEEK[new Date(date).getDay()]
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
      console.error('[add-event] user lookup failed')
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
      console.error('[add-event] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    // Not connected → 400 so the client can prompt the user to connect Outlook.
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
        // Nothing to refresh with — user must reconnect.
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
        console.error('[add-event] token refresh failed:', refreshRes.status)
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
        .eq('user_id', userRow.id)
        .eq('provider', 'microsoft')

      if (updateErr) {
        // Non-fatal: we still have a valid access token in memory and can create
        // the event. The stale row just gets refreshed next time.
        console.error('[add-event] token persist failed')
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }

    // ── 4. Parse + validate the request body ─────────────────────────
    let payload: AddEventBody
    try {
      payload = (await request.json()) as AddEventBody
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const {
      title,
      date,
      startTime,
      endTime,
      location,
      body,
      isAllDay,
      isTeamsMeeting,
      attendees,
      isRecurring,
      recurringFrequency,
      recurringEndDate,
    } = payload

    if (!title || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // ── 5. Build the Graph event object ──────────────────────────────
    // Recurrence is only attached when the caller opted in AND gave a frequency;
    // otherwise `recurrence` stays undefined and JSON.stringify drops it, leaving
    // the existing non-recurring behavior untouched.
    // NOTE: for a 'monthly' event Graph's absoluteMonthly pattern normally also
    // wants `dayOfMonth`. It is intentionally omitted here to match the agreed
    // payload shape; if Graph rejects monthly recurrences, add dayOfMonth here.
    const recurrence =
      isRecurring && recurringFrequency
        ? {
            pattern: {
              type:
                recurringFrequency === 'daily'
                  ? 'daily'
                  : recurringFrequency === 'weekly'
                  ? 'weekly'
                  : 'absoluteMonthly',
              interval: 1,
              daysOfWeek: recurringFrequency === 'weekly' ? [getDayOfWeek(date)] : undefined,
            },
            range: {
              type: recurringEndDate ? 'endDate' : 'noEnd',
              startDate: date,
              // Client may send mm/dd/yyyy; Graph needs YYYY-MM-DD.
              endDate: recurringEndDate
                ? new Date(recurringEndDate).toISOString().split('T')[0]
                : undefined,
            },
          }
        : undefined

    const graphEvent = {
      subject: title,
      body: {
        contentType: 'text',
        content: body || '',
      },
      start: {
        dateTime: toGraphDateTime(date, startTime),
        timeZone: GRAPH_TZ,
      },
      end: {
        dateTime: toGraphDateTime(date, endTime),
        timeZone: GRAPH_TZ,
      },
      location: location ? { displayName: location } : undefined,
      isAllDay: isAllDay || false,
      isOnlineMeeting: isTeamsMeeting || false,
      onlineMeetingProvider: isTeamsMeeting ? 'teamsForBusiness' : undefined,
      attendees:
        attendees?.map(email => ({
          emailAddress: { address: email },
          type: 'required',
        })) || [],
      recurrence,
    }

    // ── 6. Create the event via Graph ────────────────────────────────
    const graphRes = await fetch(`${GRAPH_BASE}/me/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphEvent),
    })

    if (!graphRes.ok) {
      // Surface the status only (no token/secret material).
      console.error('[add-event] graph error status:', graphRes.status)
      return NextResponse.json(
        { error: 'graph_error', message: String(graphRes.status) },
        { status: 502 }
      )
    }

    const createdEvent = await graphRes.json()
    return NextResponse.json({ success: true, event: createdEvent }, { status: 201 })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[add-event] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
