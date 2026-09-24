// src/app/api/clients/[id]/share-link/route.ts
//
// Issues a fresh read-only share link (magic link) for one client. Admin-only
// (president / ea / ai_specialist). POST only.
//
// SHOW-ONCE MODEL (see src/db/migrations/client_share_tokens.sql):
//  - Every call ALWAYS issues a new token. There is no "return the existing link"
//    path, because only sha256(token) is stored — the raw token cannot be recovered.
//  - The raw token exists only in this handler's memory and in the one `url` field
//    of the 200 response. It is never stored, never logged, and never placed in an
//    error message or error response.
//
// Auth + client pattern is copied from src/app/api/big-vision/file-url/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - Everything else uses the SERVICE-ROLE client: client_share_tokens is RLS
//    deny-all (no policies), so only the service role can read or write it.
//  The one addition to file-url's users lookup: it also selects `id`, because
//  created_by must be the caller's public.users.id (resolved by session email —
//  never auth.users.id, which is a different id space; see CLAUDE.md).
//
// REGENERATE = TWO SEQUENTIAL CALLS, NOT ONE TRANSACTION (per the migration header):
//  1. UPDATE … SET revoked_at = now() WHERE client_id = $id AND revoked_at IS NULL
//  2. INSERT { client_id, token_hash, created_by }
//  A failure between them leaves the client with ZERO active links, never two. A
//  concurrent second call fails on client_share_tokens_one_active_per_client
//  (Postgres 23505) and gets a 409 here instead of creating a duplicate.
//
// ── MANUAL VERIFICATION (the one thing the schema cannot check) ───────────────
// The token_hash CHECK only enforces "64 lowercase hex", and a raw token is ALSO 64
// lowercase hex — so if this route ever stored the raw value by mistake, the
// database would accept it. Verify by hand after the first real call:
//   1. Call this route; copy the token from the returned url (the last path
//      segment after /client-view/).
//   2. In the Supabase SQL Editor, with <RAW> replaced by that token:
//        select
//          token_hash = encode(extensions.digest('<RAW>', 'sha256'), 'hex') as hash_matches,
//          token_hash <> '<RAW>'                                           as not_stored_raw,
//          revoked_at is null                                              as active,
//          expires_at - created_at                                         as lifetime,
//          created_by
//        from public.client_share_tokens
//        where client_id = '<CLIENT_ID>'
//        order by created_at desc
//        limit 1;
//      Expect hash_matches = true, not_stored_raw = true, active = true,
//      lifetime = 1 year, created_by = your public.users.id.
//   3. Then clear it from wherever you pasted it — it is a live credential.
//   (Equivalent Node check: crypto.createHash('sha256').update(RAW).digest('hex')
//   must equal the stored token_hash.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Roles permitted to issue client links — the same admin set file-url enforces.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// The customer-facing page this link opens. It does not exist yet (later task).
const CLIENT_VIEW_PATH = '/client-view'

// A uuid-shaped id, checked before querying: a malformed id would otherwise reach
// Postgres as a uuid cast error (22P02) and surface as a 500 instead of a 404.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Responses carry a bearer credential — never let a browser or proxy cache them.
const NO_STORE = { 'Cache-Control': 'no-store' }

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return json({ error: 'unauthorized' }, 401)
    }

    // ── 2. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      // Missing env vars are the most common Vercel misconfiguration — name which.
      console.error('[share-link] service client config missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      })
      return json({ error: 'server_config' }, 500)
    }

    let supabaseService
    try {
      supabaseService = createServiceSupabase(supabaseUrl, serviceKey)
    } catch (err) {
      console.error('[share-link] service client error:', err)
      return json({ error: 'server_config' }, 500)
    }

    // ── 3. Admin role check (by session email) ───────────────────────
    // Also returns the caller's public.users.id for created_by.
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('id, role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[share-link] user lookup failed')
      return json({ error: 'user_lookup' }, 500)
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return json({ error: 'forbidden' }, 403)
    }
    const createdBy = typeof userRow.id === 'string' ? userRow.id : null

    // ── 4. Validate the client id and that the client exists ─────────
    const clientId = typeof params?.id === 'string' ? params.id.trim() : ''
    if (!UUID_RE.test(clientId)) {
      return json({ error: 'client_not_found' }, 404)
    }
    const { data: clientRow, error: clientErr } = await supabaseService
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle()

    if (clientErr) {
      console.error('[share-link] client lookup failed:', clientErr.message)
      return json({ error: 'client_lookup', message: clientErr.message }, 500)
    }
    if (!clientRow) {
      return json({ error: 'client_not_found' }, 404)
    }

    // ── 5. Generate the raw token and its hash ───────────────────────
    // 32 bytes from Node's CSPRNG = 256 bits. The raw value is never logged and
    // never leaves this function except inside the success response's url.
    const raw = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(raw).digest('hex')

    // ── 6. Revoke this client's current unrevoked token (if any) ─────
    // Revokes expired-but-unrevoked rows too: they still occupy the one-active slot
    // in the partial unique index, and would otherwise block the insert below.
    const { error: revokeErr } = await supabaseService
      .from('client_share_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .is('revoked_at', null)

    if (revokeErr) {
      console.error('[share-link] revoke failed:', revokeErr.message)
      // Nothing was inserted, so any previous link is still exactly as it was.
      return json({ error: 'revoke_failed', message: revokeErr.message }, 500)
    }

    // ── 7. Insert the new token (hash only) ──────────────────────────
    const { error: insertErr } = await supabaseService
      .from('client_share_tokens')
      .insert({ client_id: clientId, token_hash: tokenHash, created_by: createdBy })

    if (insertErr) {
      // Log only the error CODE: a unique-violation message/detail can echo the
      // conflicting key, and token_hash must not be returned or spread into logs.
      console.error('[share-link] insert failed, code:', insertErr.code)
      if (insertErr.code === '23505') {
        // Another issue for this client landed between our revoke and insert.
        return json(
          { error: 'concurrent_issue', message: 'Another link was issued for this client at the same time. Try again.' },
          409,
        )
      }
      // The revoke above already ran: this client now has NO active link (the
      // documented safe failure). Say so, so staff know to retry.
      return json(
        { error: 'insert_failed', message: 'The previous link was revoked but a new one could not be issued. Try again.' },
        500,
      )
    }

    // ── 8. Build the link ────────────────────────────────────────────
    // Same base-URL convention as api/auth/microsoft/callback/route.ts:18.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://cask-hub.vercel.app').replace(/\/+$/, '')
    const url = `${appUrl}${CLIENT_VIEW_PATH}/${raw}`

    // The ONLY place the raw token appears. Never token_hash.
    return json({ url }, 200)
  } catch (err) {
    // Never throw unhandled — surface a generic error. Message only (never the
    // error object): nothing here may risk including the raw token.
    console.error('[share-link] error:', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'server_error' }, 500)
  }
}
