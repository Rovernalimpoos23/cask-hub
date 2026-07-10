import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Phase 1: Microsoft Graph OAuth callback — exchange the auth code for tokens,
// resolve the CASK Hub user by email, and persist tokens in user_integrations.
// No calendar/mail data is fetched here (that's a later phase).
//
// NOTE: The brief originally asked for `createRouteHandlerClient` from
// `@supabase/auth-helpers-nextjs`, but that package is not a dependency of this
// project. We use the service-role client (same pattern as
// `src/app/api/email-drafts/send/route.ts`) so the user lookup and integration
// upsert bypass RLS — the email-based lookup is not tied to the caller's session.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cask-hub.vercel.app'
  const dashboard = (qs: string) => NextResponse.redirect(new URL(`/dashboard${qs}`, appUrl))

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    // --- CSRF: state param must match the httpOnly cookie ---
    const cookieState = cookies().get('ms_oauth_state')?.value
    if (!state || !cookieState || state !== cookieState) {
      return dashboard('?error=oauth_state')
    }

    if (!code) {
      return dashboard('?error=oauth_no_code')
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const tenantId = process.env.MICROSOFT_TENANT_ID
    if (!clientId || !clientSecret || !tenantId) {
      return dashboard('?error=oauth_config')
    }

    const redirectUri = `${appUrl}/api/auth/microsoft/callback`

    // --- Exchange the authorization code for tokens ---
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      }
    )

    if (!tokenRes.ok) {
      // Do not log token/secret material — status only.
      console.error('[ms-oauth] token exchange failed:', tokenRes.status)
      return dashboard('?error=oauth_token')
    }

    const tokenJson = await tokenRes.json()
    const accessToken: string | undefined = tokenJson.access_token
    const refreshToken: string | undefined = tokenJson.refresh_token
    const expiresIn: number | undefined = tokenJson.expires_in

    if (!accessToken || typeof expiresIn !== 'number') {
      return dashboard('?error=oauth_token')
    }

    // --- Resolve the signed-in Microsoft account's email via Graph /me ---
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!meRes.ok) {
      console.error('[ms-oauth] graph /me failed:', meRes.status)
      return dashboard('?error=oauth_graph')
    }

    const me = await meRes.json()
    // Azure AD may return the address in either field depending on account type.
    const email: string | undefined = me.mail || me.userPrincipalName
    if (!email) {
      return dashboard('?error=oauth_graph')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // --- Look up the CASK Hub user by EMAIL (not auth id) ---
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (userErr) {
      console.error('[ms-oauth] user lookup failed')
      return dashboard('?error=user_lookup')
    }

    if (!userRow) {
      return dashboard('?error=user_not_found')
    }

    // --- Persist tokens (upsert on user_id + provider) ---
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error: upsertErr } = await supabase
      .from('user_integrations')
      .upsert(
        {
          user_id: userRow.id,
          provider: 'microsoft',
          email,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' }
      )

    if (upsertErr) {
      console.error('[ms-oauth] integration upsert failed')
      return dashboard('?error=integration_save')
    }

    // --- Success: clear the state cookie and return to the dashboard ---
    const response = dashboard('?connected=outlook')
    response.cookies.set('ms_oauth_state', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (err) {
    // Never throw unhandled — surface a generic error on the dashboard.
    console.error('[ms-oauth] callback error:', err instanceof Error ? err.message : 'unknown')
    return dashboard('?error=oauth_callback')
  }
}
