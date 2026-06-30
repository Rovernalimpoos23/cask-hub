// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/auth/')
  // Allow authenticated users to access reset-password (recovery session must land here)
  const isPasswordReset = pathname === '/auth/reset-password'
  const isSeedRoute = pathname === '/api/seed'
  const isWebhook = pathname.startsWith('/api/webhooks/')

  if (!user && !isAuthPage && !isSeedRoute && !isWebhook) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPage && !isPasswordReset) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  // ── Role-based page restriction ────────────────────────────────────────────
  // Restricted roles may only view an allowlist of pages: the Dashboard, the
  // General Meetings pages (All Sessions + individual sessions, Generate Agenda,
  // Action Items), Customer Journey (/customers/*), and the customer portal
  // preview (/my-project). Any OTHER page (Command Center, President's Workflow,
  // Design Center, CASK Big Vision, etc.) is redirected to /dashboard. API
  // routes, webhooks, the seed route and auth pages are intentionally excluded
  // so app functionality (e.g. AI chat, data fetches) keeps working for them.
  const RESTRICTED_ROLES = ['vp_sales', 'ops_manager', 'vp_ops', 'vp_finance', 'member']
  const isApi = pathname.startsWith('/api/')
  if (user?.email && !isAuthPage && !isApi && !isSeedRoute && !isWebhook) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('email', user.email)
      .maybeSingle()
    const role = profile?.role as string | undefined
    const isDashboardPage = pathname === '/dashboard'
    // All Sessions list + individual session detail pages (/sessions/[id]).
    const isSessionsPage = pathname === '/sessions' || pathname.startsWith('/sessions/')
    // Generate Agenda.
    const isGeneratePage = pathname === '/generate' || pathname.startsWith('/generate/')
    // Action Items.
    const isActionsPage = pathname === '/actions' || pathname.startsWith('/actions/')
    const isCustomersPage = pathname === '/customers' || pathname.startsWith('/customers/')
    // /my-project is the customer portal preview — allowed for ALL users,
    // including restricted roles, so it's never redirected away.
    const isMyProjectPage = pathname === '/my-project' || pathname.startsWith('/my-project/')
    const isAllowedPage =
      isDashboardPage ||
      isSessionsPage ||
      isGeneratePage ||
      isActionsPage ||
      isCustomersPage ||
      isMyProjectPage
    if (role && RESTRICTED_ROLES.includes(role) && !isAllowedPage) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      dashboardUrl.search = ''
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|cask-logo-white\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
