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
// The "is this agent live?" checks use head:true + count:'exact' so no row data crosses
// the wire. The two FILE counts can't: hub_memory rows are CHUNKS — a long document is
// several rows sharing one source_ref — so an exact row count inflates every chunked
// document. Those two read the key columns and count distinct documents in application
// code instead (no new DB function).
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Roles permitted to read hub stats — same admin set the other routes enforce.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Distinct-document scan budget. Paged because Supabase caps a single response at the
// project's max-rows setting (1000 by default). MAX_SCAN_ROWS is the backstop against an
// unbounded scan; hitting it is logged, never silent. Only two small columns are read.
const PAGE_SIZE = 1000
const MAX_SCAN_ROWS = 20000

// Just the two columns needed to build a document key.
interface KeyRow {
  id: string
  source_ref: string | null
}

// Count DISTINCT documents among active hub_memory rows matching `narrow`.
//
// The document key is `source_ref ?? id` — the same key api/big-vision/chat groups on.
// The `?? id` fallback is load-bearing: source_ref is null on legacy manual uploads and
// on fireflies rows whose meetings insert returned no id, and folding all of those under
// one shared null key would undercount them as a single document.
//
// The paging loop is deliberately duplicated in api/big-vision/files rather than shared —
// there is no common hub_memory module today and adding one is outside this change.
async function countDistinctDocuments(
  // No generated Supabase types in this project; the builder is threaded through as-is.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseService: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  narrow: (q: any) => any,
  label: string,
): Promise<{ documents: number } | { error: string }> {
  const keys = new Set<string>()
  let scanned = 0

  for (let from = 0; from < MAX_SCAN_ROWS; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, MAX_SCAN_ROWS) - 1

    const { data, error } = await narrow(
      supabaseService.from('hub_memory').select('id, source_ref').eq('is_active', true),
    )
      // Stable order so range paging can't skip or repeat rows.
      .order('id', { ascending: true })
      .range(from, to)

    if (error) return { error: error.message }

    const batch = (data as KeyRow[] | null) ?? []
    for (const r of batch) keys.add(r.source_ref ?? r.id)
    scanned += batch.length

    // Short page = end of the result set.
    if (batch.length < to - from + 1) break
  }

  if (scanned >= MAX_SCAN_ROWS) {
    console.warn(`[big-vision-stats] scan cap hit (${MAX_SCAN_ROWS}) for ${label} — count is a floor`)
  }

  return { documents: keys.size }
}

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

    // ── 4. Total active files (DOCUMENTS, not chunk rows) ────────────
    const totalRes = await countDistinctDocuments(supabaseService, (q) => q, 'total')

    if ('error' in totalRes) {
      console.error('[big-vision-stats] total count failed:', totalRes.error)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }
    const totalFiles = totalRes.documents

    // ── 5. Strategic agents that are "live" (≥1 active file) ─────────
    // Row counts are correct here and below: these are ≥1 existence checks, so chunking
    // can't distort them. Only the two file COUNTS above/below needed the document fix.
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
    // Documents, not chunk rows — the main page divides this by filesInMemory to show a
    // percentage, and two differently-inflated row counts made that ratio meaningless
    // (transcripts chunk heavily, small manual uploads not at all).
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const routedRes = await countDistinctDocuments(
      supabaseService,
      (q) => q.eq('source_type', 'fireflies').gte('created_at', sevenDaysAgo),
      'auto-routed',
    )

    if ('error' in routedRes) {
      console.error('[big-vision-stats] auto-routed count failed:', routedRes.error)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }
    const autoRouted = routedRes.documents

    // ── 7. Return ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        filesInMemory: totalFiles,
        agentsLive,
        totalAgents: STRATEGIC_CATEGORIES.length,
        leadersLive,
        totalLeaders: LEADER_CATEGORIES.length,
        autoRoutedThisWeek: autoRouted,
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
