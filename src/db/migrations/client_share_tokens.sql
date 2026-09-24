-- ============================================================================
-- Migration: client_share_tokens — per-client magic-link tokens (schema only)
-- File     : src/db/migrations/client_share_tokens.sql
-- Date     : 2026-09-24 (revised same day: tokens stored HASHED, show-once model)
-- Status   : NOT RUN — for review. Run by hand in the Supabase SQL Editor.
--
-- PURPOSE
--   Storage for the unguessable per-client links that let a real customer open a
--   read-only view of their own project WITHOUT a Hub login. One ACTIVE token per
--   client at a time; regenerating revokes the old one. 1-year expiry. Explicit
--   revocation supported.
--
-- WHAT THIS DOES NOT TOUCH — PURELY ADDITIVE
--   * Creates ONE new table, one partial unique index, and enables RLS on it.
--   * No existing table is altered. The only links to existing tables are the two
--     FOREIGN KEYs declared on THIS table (-> clients.id, -> users.id); nothing is
--     added to clients or users themselves.
--   * No application code reads or writes this table yet. The token-issuing /
--     validation API route, the "Copy client link" staff UI and the customer page
--     are later tasks.
--
-- NAME
--   client_share_tokens: the client_ prefix groups it with the other per-client
--   tables (client_files, client_meetings, client_agenda_header …), and "share"
--   says what the token is FOR (sharing a read-only view), which "magic_links" or
--   "invites" would not — nothing here signs anyone in or creates an account.
--
-- TOKENS ARE STORED HASHED — THE SHOW-ONCE MODEL (resolved design)
--   This table exists to bypass login for real customers, so a leak of it must be
--   useless. It therefore holds ONLY sha256(raw token), never the raw token:
--     * a leaked token_hash cannot be turned back into a working link (sha256 is
--       one-way, and the input is 256 random bits, so there is nothing to
--       brute-force or look up);
--     * the raw token exists in exactly two places: the issuing response shown to
--       staff ONCE, and the link itself. It is never written to the database and
--       must never be logged.
--   Accepted consequence: "Copy client link" can show a link only at creation.
--   Needing it again later means REGENERATING (revoke old, issue new) — which the
--   one-active-per-client design below already supports. There is no "view the
--   current link" feature, by design.
--
-- WHY THE DATABASE NO LONGER GENERATES THE TOKEN (structural change vs. v1)
--   v1 used `token text DEFAULT encode(gen_random_bytes(32), 'hex')`. That only
--   worked because the value it generated was also the value it stored — the
--   caller could read it back from RETURNING. With hashing, the caller needs the
--   RAW value while the row must hold only its HASH. A column DEFAULT produces one
--   value, stores it, and has no way to hand a different, unstored value back, so
--   the default is removed rather than adapted. (A generated column
--   `digest(token, …)` would need the raw token stored as its input — the thing
--   being prevented — and a trigger that hashes-then-discards a submitted value
--   would still send the raw token through INSERT payloads, PostgREST and any
--   statement logging.)
--   So, in the later issuing route (server side, service-role):
--     1. raw   = 32 bytes from a CSPRNG, hex-encoded (Node:
--                crypto.randomBytes(32).toString('hex')) — the same 256-bit
--                quality v1 had; only the place it is generated moves.
--     2. hash  = sha256(raw), lowercase hex (Node:
--                crypto.createHash('sha256').update(raw).digest('hex')).
--     3. INSERT only { client_id, token_hash: hash, created_by }.
--     4. Return `raw` to the staff UI once, inside the link. Never log it.
--   Validation (the later public route):
--     1. Take the raw token from the URL; reject it unless it is exactly 64
--        lowercase hex characters (cheap, and keeps junk out of the query).
--     2. Hash it the same way.
--     3. SELECT client_id … WHERE token_hash = $hash AND revoked_at IS NULL
--        AND expires_at > now()   — service-role client, exactly one match or none.
--     4. Scope EVERY subsequent read to that one client_id; never accept a
--        client_id from the request.
--   The lookup is by hash equality on a UNIQUE index, so there is no stored secret
--   to compare byte-by-byte and no timing-safe comparison to get wrong. No salt or
--   pepper is needed: salting protects low-entropy secrets (passwords) from
--   precomputed tables, and a 256-bit random token has no such weakness.
--
-- TOKEN_HASH FORMAT
--   token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$') —
--   sha256 is 32 bytes = 64 lowercase hex characters. The CHECK rejects an
--   uppercase, base64 or truncated digest from an inconsistent caller.
--   LIMIT OF THE CHECK: a raw token is ALSO 64 lowercase hex characters, so if the
--   issuing code forgot to hash and inserted the raw value, the CHECK would accept
--   it. No format check can tell the two apart; only the issuing code can guarantee
--   it hashes first. The later route task must include a test that the stored value
--   equals sha256(raw) and differs from raw (behaviour check 5b below does the same
--   in SQL).
--
-- "ONE ACTIVE TOKEN PER CLIENT" — MECHANISM (unchanged)
--   A PARTIAL unique index: UNIQUE (client_id) WHERE revoked_at IS NULL.
--   * Not a plain UNIQUE(client_id): that would forbid the revoked rows that must
--     remain as history once a link is regenerated.
--   * Expiry CANNOT be part of the index predicate. Index predicates must be
--     IMMUTABLE and now() is not, so "WHERE expires_at > now()" is rejected by
--     Postgres (and would be meaningless anyway — the index is evaluated at write
--     time, not at read time).
--   * CONSEQUENCE the later tasks must honour:
--       - An EXPIRED token that was never revoked still occupies the client's one
--         unrevoked slot. Regenerate must therefore ALWAYS revoke the client's
--         current unrevoked row (expired or not) before inserting the new one:
--         UPDATE … SET revoked_at = now() WHERE client_id = $1 AND revoked_at IS
--         NULL; then INSERT. Note supabase-js cannot wrap two statements in one
--         transaction; done as two calls in that order, the failure modes are safe:
--         a crash between them leaves the client with NO active link (never two),
--         and a concurrent second regenerate fails on the index rather than
--         creating a duplicate. If strict atomicity is wanted later, that is a
--         SECURITY DEFINER function — a separate, reviewed change.
--       - The validation route must check ALL THREE: hash matches, revoked_at IS
--         NULL, AND expires_at > now(). The index guarantees at most one candidate
--         per client; it does not guarantee that candidate is still valid.
--
-- JUDGMENT CALLS — flagged for review
--   1. ON DELETE CASCADE on client_id. customers/page.tsx's delete flow removes a
--      fixed list of child tables and then the clients row; with the default NO
--      ACTION, any client that had ever been given a link would become impossible
--      to delete from the UI (FK violation). A link to a deleted client is
--      meaningless, so the tokens go with it.
--   2. ON DELETE SET NULL on created_by: removing a staff member must not delete or
--      block the links they issued. Accountability is lost for those rows only.
--      created_by is public.users.id (resolve it by email, never auth.users.id —
--      the two id spaces differ, per CLAUDE.md).
--   3. RESOLVED (was open in v1): tokens are stored as sha256 hashes only, with a
--      show-once link. See "TOKENS ARE STORED HASHED" above. Plaintext storage was
--      rejected because a leak of this table would have exposed every client's
--      live project with no further work.
--   4. CHECK (expires_at > created_at) so a row cannot be born already expired.
--   5. CREATE TABLE (not IF NOT EXISTS) inside one transaction, with a type guard
--      first: a re-run fails loudly rather than silently skipping.
--   6. pgcrypto is still ensured below although the table itself no longer uses it
--      (no column default calls it now). It is kept so the optional behaviour check
--      at the bottom can hash a test token in SQL (extensions.digest), and it is a
--      no-op on Supabase, where it is enabled by default. It is NOT a dependency
--      of the schema: removing the line changes nothing about the table.
--
-- RLS — FOLLOW-UP (NOT IN THIS FILE)
--   RLS is ENABLED with NO policies = deny-all for anon/authenticated, service-role
--   only — the same posture as construction_step_definitions.sql (JUDGMENT CALL 4
--   there). Without it, a new public table is readable and writable with the public
--   anon key under Supabase's default grants.
--   * The token-validation API route (later task) uses the SERVICE-ROLE client, so
--     it needs no policy.
--   * The staff "Copy client link" feature (later task) should issue tokens through
--     a SERVICE-ROLE route (the hash has to be computed server-side anyway, and the
--     raw token must never pass through a browser-side INSERT), in which case it
--     needs no policy either. If a browser-session read is ever wanted (e.g. "link
--     issued on / expires on"), it needs its own policy scoped to staff roles via
--     current_user_role() — never anything for anon. Do not add an open policy in
--     the meantime. Even then, token_hash should not be selectable by the browser.
-- ============================================================================

-- ── STEP 0 (optional, read-only): see the FK target types for yourself ───────
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name = 'clients' and column_name = 'id')
--     or (table_name = 'users'   and column_name = 'id'));
-- Expect data_type = 'uuid' for both. The guard below enforces it anyway.

BEGIN;

-- ── Guard: FK target types must be uuid, verified against the LIVE catalog ────
-- The repo has no DDL for public.clients at all, and only the stale MVP file for
-- public.users, so the types are checked here rather than assumed. Any mismatch
-- (or a missing table) raises and the whole transaction rolls back.
DO $$
DECLARE
  clients_id_type text;
  users_id_type   text;
BEGIN
  SELECT data_type INTO clients_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'id';

  SELECT data_type INTO users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF clients_id_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'ABORT: public.clients.id is % (expected uuid) — FK type would not match.', coalesce(clients_id_type, 'MISSING');
  END IF;
  IF users_id_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'ABORT: public.users.id is % (expected uuid) — FK type would not match.', coalesce(users_id_type, 'MISSING');
  END IF;
END
$$;

-- Not used by the table (see JUDGMENT CALL 6); ensures the optional check below runs.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.client_share_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- sha256(raw token), lowercase hex. NO default: the raw token is generated and
  -- hashed by the issuing route, and only this hash is ever inserted.
  token_hash  text        NOT NULL UNIQUE
                          CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  revoked_at  timestamptz NULL,
  created_by  uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT client_share_tokens_expires_after_created CHECK (expires_at > created_at)
);

-- At most ONE unrevoked token per client. Revoked rows coexist as history.
-- Expiry is deliberately not in the predicate (see header: now() is not IMMUTABLE).
CREATE UNIQUE INDEX client_share_tokens_one_active_per_client
  ON public.client_share_tokens (client_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.client_share_tokens IS
  'Per-client read-only share links (magic links). Stores ONLY sha256 of each token; the raw token is shown to staff once at issue and never stored. One unrevoked row per client (partial unique index). Valid = token_hash = sha256(presented token) AND revoked_at IS NULL AND expires_at > now(). Regenerate = revoke the current unrevoked row, then insert. Service-role only (RLS on, no policies) as of 2026-09-24.';
COMMENT ON COLUMN public.client_share_tokens.token_hash IS
  'sha256 of the raw 256-bit token, 64 lowercase hex chars. Computed by the issuing route; the raw token is never written here and cannot be recovered from this value. To validate, hash the presented token and match on equality.';
COMMENT ON COLUMN public.client_share_tokens.revoked_at IS
  'NULL = not revoked. Set on explicit revocation and on regenerate. An expired-but-unrevoked row still blocks a new insert for that client until revoked.';
COMMENT ON COLUMN public.client_share_tokens.created_by IS
  'public.users.id of the staff member who issued the link (NOT auth.users.id). NULL if unknown or that user was removed.';

-- Deny-all until a follow-up deliberately adds policies (see header).
ALTER TABLE public.client_share_tokens ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- VERIFICATION (read-only — run after COMMIT)
-- ============================================================================

-- 1. Columns, types, nullability, defaults.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'client_share_tokens'
order by ordinal_position;
-- Expect: id uuid NO gen_random_uuid() · client_id uuid NO · token_hash text NO
-- (NO default — column_default is NULL) · created_at timestamptz NO now()
-- · expires_at timestamptz NO (now() + '1 year'::interval) · revoked_at timestamptz YES
-- · created_by uuid YES
-- And confirm there is NO column named `token`:
select count(*) as raw_token_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'client_share_tokens'
  and column_name = 'token';   -- expect 0

-- 2. Constraints: PK, both FKs (with delete rules), token_hash UNIQUE, both CHECKs.
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.client_share_tokens'::regclass
order by contype, conname;
-- Expect 6 rows: c (token_hash ~ '^[0-9a-f]{64}$'), c (expires_after_created),
-- f (client_id … ON DELETE CASCADE), f (created_by … ON DELETE SET NULL),
-- p (id), u (token_hash).

-- 3. The partial unique index, with its WHERE clause.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'client_share_tokens'
order by indexname;
-- Expect client_share_tokens_one_active_per_client:
--   CREATE UNIQUE INDEX … ON public.client_share_tokens USING btree (client_id)
--   WHERE (revoked_at IS NULL)
-- plus the PK index and the token_hash unique index.

-- 4. RLS enabled, and NO policies.
select relrowsecurity as rls_enabled
from pg_class where oid = 'public.client_share_tokens'::regclass;   -- expect true
select count(*) as policy_count
from pg_policies where schemaname = 'public' and tablename = 'client_share_tokens';  -- expect 0

-- 5. OPTIONAL behaviour check — writes, but self-contained and ROLLED BACK.
--    Mirrors what the issuing and validation routes will do, in SQL: generate a
--    raw token, store only its hash, look it up by hashing again. Uses any one
--    real client id; nothing persists. Run it right after creation, while the
--    table is still empty (5b/5e assume the test row is the only row). Skip it if
--    you prefer.
-- BEGIN;
--   -- a) "issue": raw token generated here only for the test; only its hash is stored.
--   CREATE TEMP TABLE _raw ON COMMIT DROP AS
--     SELECT encode(extensions.gen_random_bytes(32), 'hex') AS raw;
--   INSERT INTO public.client_share_tokens (client_id, token_hash)
--   SELECT (SELECT id FROM public.clients LIMIT 1),
--          encode(extensions.digest((SELECT raw FROM _raw), 'sha256'), 'hex')
--   RETURNING length(token_hash) AS hash_len, expires_at - created_at AS lifetime;
--   -- expect hash_len = 64, lifetime = 1 year
--
--   -- b) the stored value is the hash, not the raw token
--   SELECT (SELECT raw FROM _raw) <> token_hash AS stored_value_is_not_raw
--   FROM public.client_share_tokens;                        -- expect true
--
--   -- c) "validate": hash the presented raw token, match on equality + validity
--   SELECT client_id
--   FROM public.client_share_tokens
--   WHERE token_hash = encode(extensions.digest((SELECT raw FROM _raw), 'sha256'), 'hex')
--     AND revoked_at IS NULL AND expires_at > now();        -- expect exactly 1 row
--
--   -- d) a wrong token finds nothing
--   SELECT count(*) AS wrong_token_matches
--   FROM public.client_share_tokens
--   WHERE token_hash = encode(extensions.digest('not-the-token', 'sha256'), 'hex');  -- expect 0
--
--   -- e) a second ACTIVE token for the same client is rejected
--   INSERT INTO public.client_share_tokens (client_id, token_hash)
--   SELECT client_id, encode(extensions.digest('second', 'sha256'), 'hex')
--   FROM public.client_share_tokens LIMIT 1;
--   -- expect: ERROR duplicate key … client_share_tokens_one_active_per_client
-- ROLLBACK;

-- ============================================================================
-- ROLLBACK (commented out — read the warning first)
-- ============================================================================
-- WARNING: dropping this table PERMANENTLY INVALIDATES EVERY CLIENT'S EXISTING
-- LINK. Every token ever issued stops working at once. Because only hashes are
-- stored, the links cannot be recovered or re-created from any backup of this
-- table's contents alone — every customer would need to be issued, and sent, a
-- NEW link. Only run this if no link has been shared yet, or you have
-- deliberately decided to revoke them all.
--
-- BEGIN;
--   DROP TABLE public.client_share_tokens;   -- also drops its index and constraints
-- COMMIT;
-- (pgcrypto is left installed: it is Supabase-managed and may be used elsewhere.)
