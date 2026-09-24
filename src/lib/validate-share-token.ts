// src/lib/validate-share-token.ts
// ──────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY. Resolves a raw client share token (the last segment of a
// /client-view/<token> link) to the one client_id it grants read access to.
// Shared by every token-authorised route (the client-view data snapshot now; the
// file-signing route later) so the validation rules exist exactly once.
//
// Rules — must stay in lockstep with src/app/api/clients/[id]/share-link/route.ts
// and src/db/migrations/client_share_tokens.sql:
//   1. The raw token is exactly 64 lowercase hex chars (32 random bytes, hex).
//      Anything else is rejected BEFORE hashing or querying.
//   2. hash = sha256(raw) as lowercase hex — the same createHash call the issuer
//      uses, so the two can never disagree about the encoding.
//   3. A row matches only if ALL of: token_hash = hash, revoked_at IS NULL,
//      expires_at > now.
//
// The caller passes a SERVICE-ROLE client: client_share_tokens is RLS deny-all.
//
// SECURITY
//   * The raw token and its hash are never logged or returned. Error results carry
//     only the database error message, which cannot contain either (the query
//     filters by the hash but PostgREST does not echo filter values in errors).
//   * 'invalid' deliberately covers malformed, unknown, revoked AND expired alike.
//     Callers must answer all of them identically — the distinction is not useful
//     to an outside caller and would leak whether a token ever existed.
//   * "now" is this server's clock (new Date()), not Postgres now(). The two are
//     NTP-synced in practice; the gap only matters in the seconds around expiry.
//
// Not marked with `import 'server-only'` because that package is not installed in
// this repo. It imports Node's `crypto` and must only be imported from route
// handlers / server code.
// ──────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const RAW_TOKEN_RE = /^[0-9a-f]{64}$/

export type ShareTokenResult =
  | { ok: true; clientId: string }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'error'; message: string }

export async function validateShareToken(
  supabaseService: SupabaseClient,
  rawToken: unknown,
): Promise<ShareTokenResult> {
  if (typeof rawToken !== 'string' || !RAW_TOKEN_RE.test(rawToken)) {
    return { ok: false, reason: 'invalid' }
  }

  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const { data, error } = await supabaseService
    .from('client_share_tokens')
    .select('client_id')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    return { ok: false, reason: 'error', message: error.message }
  }
  const clientId = (data as { client_id?: unknown } | null)?.client_id
  if (typeof clientId !== 'string' || !clientId) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, clientId }
}
