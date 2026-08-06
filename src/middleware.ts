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
  const isWebhook = pathname.startsWith('/api/webhooks/')

  if (!user && !isAuthPage && !isWebhook) {
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
  // Action Items), Customer Journey (/customers/*), My Workspace (/my-workspace/*
  // — My Calendar + My Emails), and the customer portal preview (/my-project).
  // Any OTHER page (Command Center, President's Workflow,
  // Design Center, CASK Big Vision, etc.) is redirected to /dashboard. API
  // routes, webhooks and auth pages are intentionally excluded so app
  // functionality (e.g. AI chat, data fetches) keeps working for them.
  // NOTE: 'ea' (Kai) is intentionally NOT a restricted role, so it bypasses the
  // allowlist below and has full access to all non-API routes, including
  // /my-workspace/*. No allowlist entry needed.
  // NOTE: 'vp_ops' and 'ops_manager' are restricted AND further narrowed — see
  // NARROWED_ROLES below.
  const RESTRICTED_ROLES = ['vp_sales', 'ops_manager', 'vp_ops', 'vp_finance', 'vp_hr', 'member']
  // These roles are narrowed FURTHER than the other restricted roles, at their
  // holders' own request: Action Items + the three Customer Journey pages only.
  // No All Sessions, no Generate Agenda, no My Workspace (My Calendar / My
  // Emails). Dashboard stays (confirmed with both requesters).
  //   vp_ops      → Chad Holman    (c.holman@caskconstruction.com)
  //   ops_manager → Matteo Carpani (m.carpani@caskconstruction.com)
  // Verified against the `users` table that each of these roles has exactly one
  // holder, so narrowing by role affects only those two people. Mirrored in
  // src/components/sidebar/Sidebar.tsx (NARROWED_ROLES) — keep the two in sync.
  const NARROWED_ROLES = ['vp_ops', 'ops_manager']
  const isApi = pathname.startsWith('/api/')
  if (user?.email && !isAuthPage && !isApi && !isWebhook) {
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
    // /my-workspace/* (My Calendar + My Emails) — now allowed for restricted roles
    // too, matching the sidebar which surfaces My Workspace for them.
    const isMyWorkspacePage = pathname === '/my-workspace' || pathname.startsWith('/my-workspace/')
    // Narrowed roles get a strict subset: Action Items + Customer Journey.
    // /dashboard stays allowed deliberately — it is the post-login
    // landing page and the redirect target immediately below, so removing it
    // would produce a redirect loop. /my-project also stays, matching its
    // "allowed for ALL users" rule above; neither was in the removal request.
    const isAllowedPage = role && NARROWED_ROLES.includes(role)
      ? (
          isDashboardPage ||
          isActionsPage ||
          isCustomersPage ||
          isMyProjectPage
        )
      : (
          isDashboardPage ||
          isSessionsPage ||
          isGeneratePage ||
          isActionsPage ||
          isCustomersPage ||
          isMyProjectPage ||
          isMyWorkspacePage
        )
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
