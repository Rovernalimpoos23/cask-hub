// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hard ceiling for every Supabase call made from middleware. This runs on the Edge
// runtime (Next 14 has no Node.js middleware runtime), where Vercel kills the
// invocation at 25s — and until now neither call below had a timeout of any kind:
// @supabase/auth-js issues its fetches with no AbortSignal at all, and postgrest-js
// only attaches one when .abortSignal() is called explicitly. A Supabase that
// accepted the connection but answered slowly could hold middleware open until the
// platform killed it, on every single request to the Hub.
const SUPABASE_TIMEOUT_MS = 6000

/**
 * Races a Supabase call against the shared request deadline, resolving to `null`
 * if it overruns or throws.
 *
 * The AbortSignal alone is not a sufficient bound: auth-js retries a failed token
 * refresh internally (`retryable()` in its helpers loops while
 * `Date.now() + backoff - startedAt < 30_000`), so per-fetch aborts can still stack
 * past the Edge ceiling. This race is the authoritative bound; the signal is what
 * actually cancels the in-flight socket underneath it.
 */
function withDeadline<T>(
  call: PromiseLike<T>,
  signal: AbortSignal
): Promise<T | null> {
  return Promise.race([
    Promise.resolve(call).catch(() => null),
    new Promise<null>((resolve) => {
      if (signal.aborted) {
        resolve(null)
        return
      }
      signal.addEventListener('abort', () => resolve(null), { once: true })
    }),
  ])
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // One deadline shared by every fetch in this invocation, so auth-js's internal
  // refresh-retry loop cannot multiply the budget: once it fires, each subsequent
  // attempt aborts immediately instead of opening a fresh 6s window.
  const deadline = AbortSignal.timeout(SUPABASE_TIMEOUT_MS)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // auth-js attaches no signal of its own, so inject the shared deadline here.
        // Anything that sets its own signal (the role lookup below) keeps it.
        fetch: (input, init) =>
          fetch(input, { ...init, signal: init?.signal ?? deadline }),
      },
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

  const authResult = await withDeadline(supabase.auth.getUser(), deadline)
  if (authResult === null) {
    console.error('[middleware] auth.getUser() timed out or failed', {
      pathname: request.nextUrl.pathname,
      timedOut: deadline.aborted,
    })
  }
  // A timeout, a network failure and a thrown non-auth error all collapse to the
  // same outcome as a genuinely signed-out request: no user, so the redirect to
  // /auth/login below fires. That is deliberate — the alternative is serving the
  // app to a session we were unable to verify.
  const user = authResult?.data.user ?? null

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
    const roleResult = await withDeadline(
      supabase
        .from('users')
        .select('role')
        .eq('email', user.email)
        .abortSignal(deadline)
        .maybeSingle(),
      deadline
    )
    // `null` means the call timed out or threw. A non-null result can still carry a
    // PostgREST error (5xx, aborted fetch, malformed request). Both mean the role is
    // unknown — and both used to be invisible here, because only `{ data: profile }`
    // was destructured, so every failure silently produced `role === undefined`.
    // NOTE: a genuinely missing row — including one hidden by RLS, which returns an
    // empty result rather than an error — is NOT a lookup failure. It still yields
    // `role === undefined` and still falls through, exactly as it did before.
    const roleLookupFailed = roleResult === null || roleResult.error !== null
    const role = roleLookupFailed
      ? undefined
      : (roleResult?.data?.role as string | undefined)
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

    // ── Fail closed when the role is unknown ──────────────────────────────────
    // These four pages sit in BOTH allowlists (narrowed and non-narrowed), so they
    // are permitted for every role and need no role to decide — serving them with an
    // unknown role grants nothing extra. Every other page is role-dependent, so an
    // unknown role must deny rather than allow: the old code let those through,
    // meaning one slow or failing Supabase call handed a restricted user the
    // Command Center.
    // /dashboard being in this set is also what keeps this loop-free — the redirect
    // target can never itself trigger another redirect.
    const isRoleIndependentPage =
      isDashboardPage || isActionsPage || isCustomersPage || isMyProjectPage
    if (roleLookupFailed && !isRoleIndependentPage) {
      console.error(
        '[middleware] users.role lookup failed; denying role-dependent page',
        {
          pathname,
          timedOut: roleResult === null,
          error: roleResult?.error?.message,
        }
      )
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      dashboardUrl.search = ''
      return NextResponse.redirect(dashboardUrl)
    }

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
