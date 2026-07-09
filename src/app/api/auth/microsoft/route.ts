import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Phase 1: Microsoft Graph OAuth — kick off the authorization code flow.
// GET /api/auth/microsoft -> redirects the user to the Microsoft login page.
export async function GET(_req: NextRequest) {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const tenantId = process.env.MICROSOFT_TENANT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!clientId || !tenantId || !appUrl) {
      return NextResponse.redirect(new URL('/dashboard?error=oauth_config', appUrl || 'https://cask-hub.vercel.app'))
    }

    const redirectUri = `${appUrl}/api/auth/microsoft/callback`

    // Random state for CSRF protection — stored in an httpOnly cookie and
    // re-validated in the callback.
    const state = crypto.randomUUID()

    const scope = [
      'User.Read',
      'Calendars.Read',
      'Calendars.ReadWrite',
      'Mail.Read',
      'Mail.ReadWrite',
      'Mail.Send',
      'offline_access',
    ].join(' ')

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope,
      response_mode: 'query',
      state,
    })

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`

    const response = NextResponse.redirect(authUrl)

    // 15 minute expiry, httpOnly so client JS can't read it.
    // Set on the response object so the cookie reliably rides with the redirect.
    response.cookies.set('ms_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    })

    return response
  } catch {
    // Never throw unhandled — fall back to the dashboard with an error flag.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cask-hub.vercel.app'
    return NextResponse.redirect(new URL('/dashboard?error=oauth_init', appUrl))
  }
}
