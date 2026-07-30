// src/app/api/big-vision/delete/route.ts
//
// Soft-deletes a hub_memory DOCUMENT (is_active = false on every row of it) and removes
// its backing object(s) from the 'hub-memory' storage bucket. Admin-only
// (president / ea / ai_specialist).
//
// A document is one or more rows: long files are chunked into several hub_memory rows
// sharing one source_ref. This route takes the id of any one of those rows and acts on
// the whole group, using the same `source_ref ?? id` key api/big-vision/chat groups on.
// Deleting a single row instead left its siblings active while the storage object they
// ALL share (upload writes the same file_path to every chunk) was already gone.
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
    // source_ref comes along because it is this row's document key.
    const { data: record, error: recordErr } = await supabaseService
      .from('hub_memory')
      .select('id, file_path, title, source_ref')
      .eq('id', id)
      .maybeSingle()

    if (recordErr) {
      console.error('[big-vision-delete] record lookup failed:', recordErr.message, recordErr.code)
      return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
    }
    if (!record) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // ── 6. Resolve the whole document (this row + its chunk siblings) ─
    // A null/blank source_ref means the row IS its own document — under the
    // `source_ref ?? id` key nothing else can share its key. It must NOT be turned into
    // `.eq('source_ref', null)`: that would match every other null-source_ref row in the
    // table (legacy manual uploads, fireflies rows whose meetings insert returned no id)
    // and delete unrelated documents.
    //
    // The target id is seeded into the set unconditionally so an already-inactive row
    // still gets included, even though the sibling query filters on is_active.
    const groupIds = new Set<string>([record.id])
    const filePaths = new Set<string>()
    if (record.file_path) filePaths.add(record.file_path)

    if (typeof record.source_ref === 'string' && record.source_ref.trim()) {
      const { data: siblings, error: siblingErr } = await supabaseService
        .from('hub_memory')
        .select('id, file_path')
        .eq('source_ref', record.source_ref)
        .eq('is_active', true)

      if (siblingErr) {
        // Fatal, unlike the storage step below: a half-deleted document is exactly the
        // inconsistency this route now exists to prevent, so fail before writing anything.
        console.error('[big-vision-delete] sibling lookup failed:', siblingErr.message, siblingErr.code)
        return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
      }

      for (const s of siblings ?? []) {
        groupIds.add(s.id)
        if (s.file_path) filePaths.add(s.file_path)
      }
    }

    const ids = Array.from(groupIds)

    // ── 7. Soft-delete every row in the document ─────────────────────
    const { error: updateErr } = await supabaseService
      .from('hub_memory')
      .update({ is_active: false })
      .in('id', ids)

    if (updateErr) {
      console.error('[big-vision-delete] soft delete failed:', updateErr.message, updateErr.code)
      return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
    }

    // ── 8. Remove the backing storage object(s) (best-effort) ────────
    // Deduped: every chunk of a manual upload carries the SAME file_path, so removing
    // per row would hit the bucket N times for one object. Storage removal stays
    // best-effort — the rows are already soft-deleted (the source of truth for the UI),
    // and failing here would leave the document un-deletable on retry.
    const paths = Array.from(filePaths)
    if (paths.length > 0) {
      const { error: storageErr } = await supabaseService.storage.from('hub-memory').remove(paths)

      if (storageErr) {
        console.error('[big-vision-delete] storage remove failed (rows already soft-deleted):', storageErr.message)
      }
    }

    console.log(`[big-vision-delete] document deleted: ${ids.length} row(s), ${paths.length} storage object(s)`)

    // `deletedIds` lets the client drop the whole group from local state — the id it sent
    // is only one row of what was deleted.
    return NextResponse.json({ success: true, id, deletedIds: ids, rowsDeleted: ids.length }, { status: 200 })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-delete] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
  }
}
