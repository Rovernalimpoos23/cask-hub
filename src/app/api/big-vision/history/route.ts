// src/app/api/big-vision/history/route.ts
//
// Big Vision agent chat history — per-user, per-agent transcript persistence.
//
// Auth + client pattern mirrors the other big-vision routes
// (src/app/api/big-vision/chat/route.ts):
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - All DB reads/writes use the SERVICE-ROLE client so they bypass RLS.
//
// Rows live in the `agent_chat_history` table, keyed by (agent_slug, user_email).
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── GET: fetch this user's chat history for one agent ──────────────────
export async function GET(req: Request) {
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

    // ── 2. Validate the agent query param ────────────────────────────
    const { searchParams } = new URL(req.url)
    const agent = searchParams.get('agent')
    if (!agent) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }

    // ── 3. Service-role client for the DB read ───────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const supabaseService = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 4. Fetch the transcript (oldest first, capped at 100) ────────
    const { data: rows, error: queryErr } = await supabaseService
      .from('agent_chat_history')
      .select('id, role, content, user_name, files_used, created_at')
      .eq('agent_slug', agent)
      .eq('user_email', sessionEmail)
      .order('created_at', { ascending: true })
      .limit(100)

    if (queryErr) {
      console.error('[big-vision-history] fetch failed:', queryErr.message, queryErr.code)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }

    return NextResponse.json({ history: rows ?? [] }, { status: 200 })
  } catch (err) {
    console.error('[big-vision-history] GET error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// ── POST: save a user + assistant message pair to history ──────────────
export async function POST(req: Request) {
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

    // ── 2. Parse + validate the request body ─────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    const agent = (body as { agent?: unknown }).agent
    const userMessage = (body as { userMessage?: unknown }).userMessage
    const assistantMessage = (body as { assistantMessage?: unknown }).assistantMessage
    const rawFilesUsed = (body as { filesUsed?: unknown }).filesUsed

    if (typeof agent !== 'string' || !agent) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }
    if (typeof userMessage !== 'string' || typeof assistantMessage !== 'string') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }
    // Coerce filesUsed to a safe non-negative integer; default 0 for anything else.
    const filesUsed =
      typeof rawFilesUsed === 'number' && Number.isFinite(rawFilesUsed) && rawFilesUsed >= 0
        ? Math.floor(rawFilesUsed)
        : 0

    // ── 3. Service-role client for the DB ops ────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const supabaseService = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 4. Resolve the user's display name (non-fatal if missing) ────
    let userName: string | null = null
    const { data: userRow } = await supabaseService
      .from('users')
      .select('name')
      .eq('email', sessionEmail)
      .maybeSingle()
    userName = userRow?.name ?? null

    // ── 5. Insert the message pair ───────────────────────────────────
    // The assistant row is stamped 1ms after the user row so ORDER BY created_at ASC
    // always returns them in the correct sequence.
    const now = Date.now()
    const { error: insertErr } = await supabaseService.from('agent_chat_history').insert([
      {
        agent_slug: agent,
        user_email: sessionEmail,
        user_name: userName,
        role: 'user',
        content: userMessage,
        files_used: 0,
        created_at: new Date(now).toISOString(),
      },
      {
        agent_slug: agent,
        user_email: sessionEmail,
        user_name: userName,
        role: 'assistant',
        content: assistantMessage,
        files_used: filesUsed,
        created_at: new Date(now + 1).toISOString(),
      },
    ])

    if (insertErr) {
      console.error('[big-vision-history] insert failed:', insertErr.message, insertErr.code)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[big-vision-history] POST error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
