// src/app/api/big-vision/file-url/route.ts
//
// Mints a short-lived signed URL for one manually-uploaded Big Vision file in the
// 'hub-memory' Supabase storage bucket. Admin-only (president / ea / ai_specialist).
//
// WHY THIS ROUTE EXISTS (service-role, not a browser createSignedUrl):
// 'hub-memory' has no SELECT policy on storage.objects — src/db/migrations/
// hub_memory_storage_rls.sql adds hub_memory_insert_leadership (INSERT only) and
// deliberately leaves its hub_memory_select_leadership statement commented out. A
// browser-side createSignedUrl would therefore fail closed. Signing here with the
// SERVICE-ROLE client bypasses RLS entirely, which is exactly how the other two
// hub-memory Storage call sites already work (upload/route.ts:284 downloads,
// delete/route.ts:146 removes). So this route needs no database change of any kind.
//
// Auth + client pattern is copied from src/app/api/big-vision/files/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup uses the SERVICE-ROLE client so it bypasses RLS.
//
// PATH IS CLIENT-SUPPLIED, BY DESIGN — same call the upload route already makes:
// upload/route.ts:234-238 accepts a client-supplied `storagePath` on the reasoning
// that "the bucket is hardcoded below and the caller already passed the admin gate
// above — naming an arbitrary key inside 'hub-memory' gives them nothing their role
// does not already allow." That holds for this read too: /api/big-vision/files
// returns `file_path` for every document in the category to these same three roles,
// so an id lookup here would guard nothing they cannot already enumerate. The bucket
// is hardcoded in the .from() below, so no key can reach another bucket.
//   KNOWN CONSEQUENCE: with no id lookup, this will sign ANY key in 'hub-memory',
//   including an object orphaned by a failed best-effort storage removal during a
//   soft delete (delete/route.ts:146-150). If that ever needs closing, the fix is to
//   accept an id and resolve file_path from hub_memory with .eq('is_active', true) —
//   not a path allowlist.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
// The signed URL is never logged: it is a bearer credential for the object.
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Roles permitted to read hub memory — the same admin set files/upload enforce.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// The one bucket this route will ever sign against.
const HUB_MEMORY_BUCKET = 'hub-memory'

// Seconds. Matches CJ_OPEN_TTL_SECONDS in customers/[id]/page.tsx:6542 — the
// click-time-minted, never-stored pattern, rather than client-files' 3600s.
const SIGNED_URL_TTL_SECONDS = 60

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

    // ── 2. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      // Missing env vars are the most common Vercel misconfiguration — name which.
      console.error('[file-url] service client config missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      })
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }

    let supabaseService
    try {
      supabaseService = createServiceSupabase(supabaseUrl, serviceKey)
    } catch (err) {
      console.error('[file-url] service client error:', err)
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }

    // ── 3. Admin role check (by session email) ───────────────────────
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[file-url] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── 4. Parse the JSON body ───────────────────────────────────────
    // Own try/catch, like upload/route.ts: a malformed body must report itself
    // rather than be masked by the outer catch.
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch (err) {
      console.error('[file-url] json parse error:', err)
      return NextResponse.json({ error: 'json_parse_error' }, { status: 400 })
    }

    // ── 5. Validate file_path ────────────────────────────────────────
    // `typeof === 'string'` rather than a truthiness check or `??`, per CLAUDE.md's
    // rule on trusting JSON field types: hub_memory.file_path is nullable and the
    // client reads it out of an untyped `any[]`, so a non-string can genuinely
    // arrive here. Never hand a null/non-string to createSignedUrl.
    const rawPath = typeof body.filePath === 'string' ? body.filePath : null
    const filePath = rawPath?.trim() ?? ''
    if (!filePath) {
      // The legacy-row case the client already guards: a manual upload written
      // before the two-step rework can carry a null file_path.
      return NextResponse.json(
        { error: 'missing_file_path', message: 'This file has no stored path, so it cannot be opened.' },
        { status: 400 },
      )
    }

    // ── 6. Mint the signed URL (service-role — bypasses RLS) ─────────
    const { data, error: signErr } = await supabaseService.storage
      .from(HUB_MEMORY_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)

    if (signErr || !data?.signedUrl) {
      // Surface the REAL message — a signing failure is almost always "Object not
      // found" for a path whose object was removed, and a generic string would send
      // the operator hunting in the wrong place. Status code only in the log.
      console.error('[file-url] sign failed:', signErr?.message ?? 'no signed URL returned')
      return NextResponse.json(
        {
          error: 'sign_failed',
          message: signErr?.message ?? 'no signed URL returned',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[file-url] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
