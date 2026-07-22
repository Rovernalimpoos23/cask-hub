// src/app/api/big-vision/files/route.ts
//
// Lists hub_memory rows for a specific Big Vision agent (by category). Admin-only
// (president / ea / ai_specialist).
//
// Auth + client pattern mirrors src/app/api/big-vision/upload/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup and hub_memory query use the SERVICE-ROLE client so they
//    bypass RLS.
//
// This is a list view: the large `content` column is intentionally NOT selected.
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
// No sensitive values are logged (status codes only).
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Roles permitted to read hub memory — same admin set the upload route enforces.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Agent slug → hub_category value. Only these slugs are valid.
const AGENT_CATEGORY: Record<string, string> = {
  pit: 'pit',
  'ai-hub': 'ai_hub',
  'design-center': 'design_center',
  'dept-alignment': 'alignment',
  jeff: 'jeff',
  lamont: 'lamont',
  chad: 'chad',
  matteo: 'matteo',
  kaitlyn: 'kaitlyn',
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

export async function GET(req: Request) {
  try {
    console.log('[files] step: starting')
    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    console.log('[files] step: auth passed')

    // ── 2. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      // Missing env vars are the most common Vercel misconfiguration — name which.
      console.error('[files] service client config missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      })
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }

    let supabaseService
    try {
      supabaseService = createServiceSupabase(supabaseUrl, serviceKey)
      console.log('[files] service client created')
    } catch (err) {
      console.error('[files] service client error:', err)
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }

    // ── 3. Admin role check (by session email) ───────────────────────
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[big-vision-files] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    console.log('[files] step: admin passed')

    // ── 4. Parse + validate query params ─────────────────────────────
    const { searchParams } = new URL(req.url)

    const agent = searchParams.get('agent')
    if (!agent) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }
    const category = AGENT_CATEGORY[agent]
    if (!category) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }

    // limit: optional, default 50. Clamp to a sane range; ignore non-numeric input.
    let limit = DEFAULT_LIMIT
    const limitRaw = searchParams.get('limit')
    if (limitRaw !== null) {
      const parsed = parseInt(limitRaw, 10)
      if (Number.isInteger(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT)
      }
    }

    // ── 5. Query hub_memory (list view — no `content` column) ────────
    // categories is text[]; `.overlaps` maps to the && array-overlap operator so a
    // row matches when it carries this agent's category among any of its categories.
    console.log('[files] step: querying hub_memory')
    console.log('[files] querying for category:', category)
    const { data: rows, error: queryErr } = await supabaseService
      .from('hub_memory')
      .select('id, title, source_type, layer, categories, leader, file_name, file_path, created_at, is_active')
      .eq('is_active', true)
      .overlaps('categories', [category])
      .order('layer', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (queryErr) {
      console.error('[files] query error:', queryErr.message, queryErr.code)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }
    console.log('[files] step: query done')

    const files = (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      source_type: r.source_type,
      layer: r.layer,
      categories: r.categories,
      leader: r.leader ?? null,
      file_name: r.file_name ?? null,
      file_path: r.file_path ?? null,
      created_at: r.created_at,
    }))

    return NextResponse.json({ files, total: files.length }, { status: 200 })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-files] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}
