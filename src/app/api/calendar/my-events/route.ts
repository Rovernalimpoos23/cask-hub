import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/calendar/my-events
// Fetches the signed-in user's Microsoft Outlook calendar (today, this week, and
// a 90-day upcoming count) via Microsoft Graph, using the token stored in
// user_integrations. Refreshes the access token automatically when it's expired
// or within 5 minutes of expiry.
//
// Auth pattern mirrors the rest of the codebase:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server),
//    the same server-side auth used by middleware.ts.
//  - user_integrations + users are read/written with the SERVICE-ROLE client
//    (same pattern as src/app/api/auth/microsoft/callback/route.ts) so the
//    email-based lookup and token upsert bypass RLS.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.

const ET = 'America/New_York'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// Event fields requested from Graph (today + week queries).
const EVENT_SELECT =
  'id,subject,start,end,location,onlineMeeting,isAllDay,recurrence,organizer,attendees'

// ── Eastern-Time helpers ─────────────────────────────────────────────
// Graph's calendarView wants startDateTime/endDateTime as ISO 8601 WITH a
// timezone offset. We anchor everything to America/New_York so the windows line
// up with how the rest of CASK Hub treats calendar dates.

// The ET UTC-offset (e.g. "-04:00" in EDT, "-05:00" in EST) that applies on the
// given instant. Uses Intl 'longOffset' (Node 18+, available on Vercel).
function etOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? ''
  const m = tz.match(/GMT([+-]\d{2}:\d{2})/)
  return m ? m[1] : '-05:00' // fall back to EST if the format is unexpected
}

// Build an ISO-8601-with-offset string for a wall-clock ET date + time.
// dateStr = 'YYYY-MM-DD', timeStr = 'HH:MM:SS'. The offset is sampled at the
// approximate instant, which is DST-correct for the 00:00 / 23:59 bounds we use.
function etDateTimeISO(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi, s] = timeStr.split(':').map(Number)
  const approx = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  return `${dateStr}T${timeStr}${etOffset(approx)}`
}

// Step a 'YYYY-MM-DD' string by n days, anchored at UTC noon to dodge DST.
function addDays(dateStr: string, n: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

// Build a Graph URL with properly-encoded OData query params.
function graphUrl(path: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${GRAPH_BASE}${path}?${qs}`
}

// Parse a Graph event's start into epoch ms. With no Prefer:outlook.timezone
// header Graph returns UTC naive datetimes ("...T13:00:00.0000000", timeZone
// "UTC"); append 'Z' when no offset is present so Date parses it as UTC.
function graphStartMs(ev: { start?: { dateTime?: string } }): number {
  const dt = ev?.start?.dateTime
  if (!dt) return NaN
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(dt)
  return new Date(hasTz ? dt : `${dt}Z`).getTime()
}

export async function GET(request: Request) {
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
      console.error('[my-events] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 200 })
    }

    const { data: integration, error: integErr } = await admin
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userRow.id)
      .eq('provider', 'microsoft')
      .maybeSingle()

    if (integErr) {
      console.error('[my-events] integration lookup failed')
      return NextResponse.json({ error: 'integration_lookup' }, { status: 500 })
    }
    // Not connected → 200 so the client can render a "Connect Outlook" state.
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
        console.error('[my-events] token refresh failed:', refreshRes.status)
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
        // Non-fatal for this request: we still have a valid access token in memory
        // and can serve the calendar. The stale row just gets refreshed next time.
        console.error('[my-events] token persist failed')
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }

    // ── 4. Compute ET time windows ───────────────────────────────────
    const now = new Date()
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: ET }) // YYYY-MM-DD (ET)

    // ET weekday (0=Sun … 6=Sat) → Monday-based week bounds.
    const etWeekday = new Date(now.toLocaleString('en-US', { timeZone: ET })).getDay()
    const daysFromMonday = (etWeekday + 6) % 7
    const weekStartStr = addDays(todayStr, -daysFromMonday)
    const weekEndStr = addDays(weekStartStr, 6)
    const in90Str = addDays(todayStr, 90)

    const todayStart = etDateTimeISO(todayStr, '00:00:00')
    const todayEnd = etDateTimeISO(todayStr, '23:59:59')
    const weekStart = etDateTimeISO(weekStartStr, '00:00:00')
    const weekEnd = etDateTimeISO(weekEndStr, '23:59:59')
    const upcomingStart = etDateTimeISO(todayStr, '00:00:00')
    const upcomingEnd = etDateTimeISO(in90Str, '23:59:59')

    // ── Optional month/year window (calendar grid: any month) ─────────
    // /api/calendar/my-events?month=8&year=2026 → also return monthEvents for the
    // full ET month. When neither param is present we skip this and return
    // monthEvents: [] so existing callers are unaffected. A missing-but-partial
    // param defaults to the current ET month/year; invalid values fall back too.
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const wantMonth = monthParam !== null || yearParam !== null

    // ── Optional weekOffset window (list view: browse future weeks) ────
    // /api/calendar/my-events?weekOffset=1 → weekEvents covers the Mon–Sun window
    // that many weeks ahead of the current one (0 = current week = existing
    // behavior). Only positive integers shift the window; anything else falls back
    // to 0. todayEvents, upcomingCount and nextMeeting are unaffected.
    const weekOffsetParam = searchParams.get('weekOffset')
    const parsedWeekOffset = Number(weekOffsetParam)
    const weekOffset =
      weekOffsetParam !== null && Number.isInteger(parsedWeekOffset) && parsedWeekOffset > 0
        ? parsedWeekOffset
        : 0
    // Shift the Mon–Sun bounds forward by weekOffset weeks. When weekOffset is 0
    // these reduce to the current-week weekStart/weekEnd computed above.
    const offsetWeekStartStr = addDays(weekStartStr, weekOffset * 7)
    const offsetWeekEndStr = addDays(offsetWeekStartStr, 6)
    const effWeekStart = weekOffset > 0 ? etDateTimeISO(offsetWeekStartStr, '00:00:00') : weekStart
    const effWeekEnd = weekOffset > 0 ? etDateTimeISO(offsetWeekEndStr, '23:59:59') : weekEnd

    const [curYear, curMonth] = todayStr.split('-').map(Number) // curMonth is 1-indexed
    const parsedMonth = Number(monthParam)
    const parsedYear = Number(yearParam)
    const reqMonth =
      monthParam !== null && Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : curMonth
    const reqYear =
      yearParam !== null && Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 9999
        ? parsedYear
        : curYear

    // First day 00:00 ET → last day 23:59 ET. Date.UTC(y, reqMonth, 0) yields the
    // last day of reqMonth because reqMonth (1-indexed) is the 0-indexed NEXT month.
    const mm = String(reqMonth).padStart(2, '0')
    const monthFirstStr = `${reqYear}-${mm}-01`
    const monthLastDay = new Date(Date.UTC(reqYear, reqMonth, 0, 12, 0, 0)).getUTCDate()
    const monthLastStr = `${reqYear}-${mm}-${String(monthLastDay).padStart(2, '0')}`
    const monthStart = etDateTimeISO(monthFirstStr, '00:00:00')
    const monthEnd = etDateTimeISO(monthLastStr, '23:59:59')

    // ── 5. Fire the three Graph calendarView requests in parallel ────
    const authHeaders = { Authorization: `Bearer ${accessToken}` }

    const todayUrl = graphUrl('/me/calendarView', {
      startDateTime: todayStart,
      endDateTime: todayEnd,
      $orderby: 'start/dateTime',
      $select: EVENT_SELECT,
      $top: '50',
    })
    const weekUrl = graphUrl('/me/calendarView', {
      startDateTime: effWeekStart,
      endDateTime: effWeekEnd,
      $orderby: 'start/dateTime',
      // For an offset week, request isCancelled too so the list view can flag
      // cancelled meetings; the current week keeps its existing field set.
      $select: weekOffset > 0 ? `${EVENT_SELECT},isCancelled` : EVENT_SELECT,
      $top: '100',
    })
    const upcomingUrl = graphUrl('/me/calendarView', {
      startDateTime: upcomingStart,
      endDateTime: upcomingEnd,
      $select: 'id',
      $top: '500',
      $count: 'true',
    })
    // Only requested when month/year params are present (see wantMonth above).
    const monthUrl = graphUrl('/me/calendarView', {
      startDateTime: monthStart,
      endDateTime: monthEnd,
      $orderby: 'start/dateTime',
      $select: EVENT_SELECT,
      $top: '500',
    })

    const requests = [
      fetch(todayUrl, { headers: authHeaders }),
      fetch(weekUrl, { headers: authHeaders }),
      fetch(upcomingUrl, { headers: authHeaders }),
    ]
    if (wantMonth) requests.push(fetch(monthUrl, { headers: authHeaders }))

    const responses = await Promise.all(requests)
    const [todayRes, weekRes, upcomingRes] = responses
    const monthRes = wantMonth ? responses[3] : undefined
    // A 401 here means the (freshly-refreshed) token was still rejected — reconnect.
    if (responses.some(r => r.status === 401)) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 401 })
    }
    if (!responses.every(r => r.ok)) {
      const statuses = responses.map(r => r.status).join(',')
      console.error('[my-events] graph error statuses:', statuses)
      return NextResponse.json({ error: 'graph_error' }, { status: 502 })
    }

    const [todayJson, weekJson, upcomingJson] = await Promise.all([
      todayRes.json(),
      weekRes.json(),
      upcomingRes.json(),
    ])
    const monthJson = monthRes ? await monthRes.json() : null

    // ── 6. Shape the response ────────────────────────────────────────
    const todayEvents = Array.isArray(todayJson.value) ? todayJson.value : []
    const weekEvents = Array.isArray(weekJson.value) ? weekJson.value : []
    // Full-month events when requested; [] otherwise (no behavior change for
    // callers that don't pass month/year).
    const monthEvents =
      monthJson && Array.isArray(monthJson.value) ? monthJson.value : []
    // Prefer Graph's @odata.count; fall back to the returned id array length.
    const upcomingCount =
      typeof upcomingJson['@odata.count'] === 'number'
        ? upcomingJson['@odata.count']
        : Array.isArray(upcomingJson.value)
          ? upcomingJson.value.length
          : 0

    const nowMs = Date.now()
    const nextMeeting =
      todayEvents.find((e: { start?: { dateTime?: string } }) => graphStartMs(e) > nowMs) ?? null

    return NextResponse.json({
      todayEvents,
      weekEvents,
      upcomingCount,
      nextMeeting,
      monthEvents,
    })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[my-events] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
