// src/app/api/big-vision/stats/route.ts
//
// Aggregate stats for the Big Vision main page cards. Admin-only
// (president / ea / ai_specialist).
//
// Auth + client pattern mirrors src/app/api/big-vision/files/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup and hub_memory counts use the SERVICE-ROLE client so
//    they bypass RLS.
//
// All counts use head:true + count:'exact' so no row data crosses the wire.
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Roles permitted to read hub stats — same admin set the other routes enforce.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// The four strategic (non-leader) agents; "live" = has at least one active file.
const STRATEGIC_CATEGORIES = ['ai_hub', 'pit', 'design_center', 'alignment']

// The five leader agents; "live" = has at least one active file.
const LEADER_CATEGORIES = ['jeff', 'lamont', 'chad', 'matteo', 'kaitlyn']

export async function GET() {
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

    // ── 2. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const supabaseService = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 3. Admin role check (by session email) ───────────────────────
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[big-vision-stats] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── 4. Total active files ────────────────────────────────────────
    const { count: totalFiles, error: totalErr } = await supabaseService
      .from('hub_memory')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (totalErr) {
      console.error('[big-vision-stats] total count failed:', totalErr.message, totalErr.code)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }

    // ── 5. Strategic agents that are "live" (≥1 active file) ─────────
    let agentsLive = 0
    for (const cat of STRATEGIC_CATEGORIES) {
      const { count, error: catErr } = await supabaseService
        .from('hub_memory')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .overlaps('categories', [cat])

      if (catErr) {
        console.error('[big-vision-stats] category count failed:', catErr.message, catErr.code)
        return NextResponse.json({ error: 'query_failed' }, { status: 500 })
      }
      if (count && count > 0) agentsLive++
    }

    // ── 5b. Leader agents that are "live" (≥1 active file) ──────────
    let leadersLive = 0
    for (const slug of LEADER_CATEGORIES) {
      const { count, error: leaderErr } = await supabaseService
        .from('hub_memory')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .overlaps('categories', [slug])

      if (leaderErr) {
        console.error('[big-vision-stats] leader count failed:', leaderErr.message, leaderErr.code)
        return NextResponse.json({ error: 'query_failed' }, { status: 500 })
      }
      if (count && count > 0) leadersLive++
    }

    // ── 6. Auto-routed this week (fireflies source, last 7 days) ─────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: autoRouted, error: routedErr } = await supabaseService
      .from('hub_memory')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('source_type', 'fireflies')
      .gte('created_at', sevenDaysAgo)

    if (routedErr) {
      console.error('[big-vision-stats] auto-routed count failed:', routedErr.message, routedErr.code)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }

    // ── 7. Return ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        filesInMemory: totalFiles ?? 0,
        agentsLive,
        totalAgents: STRATEGIC_CATEGORIES.length,
        leadersLive,
        totalLeaders: LEADER_CATEGORIES.length,
        autoRoutedThisWeek: autoRouted ?? 0,
        rollupReady: agentsLive === STRATEGIC_CATEGORIES.length,
      },
      { status: 200 },
    )
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-stats] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}
