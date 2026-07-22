// src/app/api/big-vision/delete/route.ts
//
// Soft-deletes a hub_memory row (is_active = false) and removes its backing object
// from the 'hub-memory' storage bucket. Admin-only (president / ea / ai_specialist).
//
// Auth + client pattern mirrors src/app/api/big-vision/files/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup, hub_memory read/update, and storage removal all use the
//    SERVICE-ROLE client so they bypass RLS.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
// No sensitive values are logged (status codes / messages only).
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Roles permitted to delete hub memory — same admin set the other routes enforce.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

export async function DELETE(req: Request) {
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
      console.error('[big-vision-delete] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── 4. Parse + validate the request body ─────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    const id = (body as { id?: unknown }).id
    if (typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // ── 5. Load the existing record ──────────────────────────────────
    // maybeSingle (not single) so a missing row is a clean 404, not a thrown error.
    const { data: record, error: recordErr } = await supabaseService
      .from('hub_memory')
      .select('id, file_path, title')
      .eq('id', id)
      .maybeSingle()

    if (recordErr) {
      console.error('[big-vision-delete] record lookup failed:', recordErr.message, recordErr.code)
      return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
    }
    if (!record) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // ── 6. Soft-delete the row ───────────────────────────────────────
    const { error: updateErr } = await supabaseService
      .from('hub_memory')
      .update({ is_active: false })
      .eq('id', id)

    if (updateErr) {
      console.error('[big-vision-delete] soft delete failed:', updateErr.message, updateErr.code)
      return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
    }

    // ── 7. Remove the backing storage object (best-effort) ───────────
    // The row is already soft-deleted (the source of truth for the UI), so a storage
    // removal failure is logged but does not fail the request — otherwise a stale
    // object would leave the row un-deletable on retry.
    if (record.file_path) {
      const { error: storageErr } = await supabaseService.storage
        .from('hub-memory')
        .remove([record.file_path])

      if (storageErr) {
        console.error('[big-vision-delete] storage remove failed (row already soft-deleted):', storageErr.message)
      }
    }

    return NextResponse.json({ success: true, id }, { status: 200 })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-delete] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
  }
}
