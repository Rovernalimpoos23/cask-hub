-- Migration: add_construction_rep_users
-- Date: 2026-09-22
-- For: Cooper Hermansen, Scott Pfaff and Peter Deutelmoser — three new people who
--      already have Supabase Auth logins (created manually, email + temp password)
--      but have NO row in public.users yet. Each needs one, with
--      role = 'construction_rep'.
-- Status: NOT RUN. Written for review — run it yourself in the SQL Editor.
--
-- The 'construction_rep' role itself already shipped in code (all 4
-- RESTRICTED_ROLES arrays + the CONSTRUCTION_ONLY_ROLES narrowing in
-- src/middleware.ts and CONSTRUCTION_VISIBLE_HREFS in Sidebar.tsx). This file
-- only creates the three profile rows. No code is touched by it.
--
-- ─────────────────────────────────────────────────────────────────────
-- RUN THIS IN THE SQL EDITOR, NOT FROM THE APP
-- ─────────────────────────────────────────────────────────────────────
-- Nothing in the application writes to public.users at all (verified: all 40
-- `from('users')` call sites are .select()). Writes are service-role-only by
-- design — the "Allow all" policy was dropped on 2026-08-07, no INSERT policy
-- exists, and INSERT/UPDATE/DELETE grants were revoked from anon/authenticated.
-- The SQL Editor runs as `postgres` and bypasses RLS, so this works there and
-- only there.
--
-- ─────────────────────────────────────────────────────────────────────
-- THE SCHEMA I READ, AND WHY YOU SHOULD CONFIRM IT ANYWAY (STEP 0)
-- ─────────────────────────────────────────────────────────────────────
-- I have no Postgres access, so this is read from the repo, not the live DB.
-- Two byte-identical copies of the public.users DDL exist in-repo:
--     supabase-schema.sql:41                (the May 2026 MVP file)
--     src/lib/seed-data.ts:206              (same DDL, inside a template string)
--
--   CREATE TABLE IF NOT EXISTS users (
--     id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     name             text NOT NULL,
--     email            text UNIQUE,
--     role             text,
--     avatar_initials  text,
--     created_at       timestamptz DEFAULT now()
--   );
--
-- CAVEAT, and it is a big one: supabase-schema.sql is known-stale. It documents
-- 3 tables; the application code alone references 32, and the live DB has more.
-- It has not tracked the live schema since the MVP sprint, so treat the block
-- above as a lead, not as truth. Step 0 below prints the REAL column list,
-- constraints and triggers — run it first and reconcile before Step 2.
--
-- Independent code-side corroboration (this part IS re-verifiable from the repo):
-- every column the application ever touches on this table is one of
-- id / name / email / role. Nothing reads avatar_initials (it exists only as a
-- field on the `User` interface at src/types/index.ts:44 and in the DDL copies
-- above); nothing reads created_at.
--
-- ─────────────────────────────────────────────────────────────────────
-- ASSUMPTIONS I COULD NOT VERIFY — STEP 0 ANSWERS ALL FOUR
-- ─────────────────────────────────────────────────────────────────────
-- 1. `name` is the only NOT NULL column without a default. If the live table has
--    added others, the INSERT in Step 2 fails with 23502 (not-null violation) —
--    a clean failure, nothing lands. Add the missing columns and re-run.
-- 2. `id` defaults to gen_random_uuid() and is NOT a foreign key to auth.users.
--    This file therefore does not set id, which is deliberate: the standing repo
--    gotcha is that auth.users IDs are NOT public.users IDs and identity is always
--    resolved by email. If the live table has since been given
--    `id uuid REFERENCES auth.users(id)` (a common Supabase pattern), the insert
--    fails 23503 and you must instead pass each person's auth uid explicitly.
--    Step 0's constraint query shows this.
-- 3. `avatar_initials` is nullable, so it is omitted below. If the live column is
--    NOT NULL, the insert fails 23502 — see the optional UPDATE after Step 3.
-- 4. NO trigger or helper function is involved in a public.users insert. The
--    brief asked specifically about grant_creator_access(): that name appears
--    NOWHERE in this repo — not in any .sql, not in any route. No CREATE FUNCTION
--    or CREATE TRIGGER for public.users exists in any committed file either. So
--    nothing in this file calls one. Step 0's trigger query is there to confirm
--    that against the live DB, since a trigger created by hand in the SQL Editor
--    would leave no trace in the repo. If it returns rows, stop and reconcile.
--    (The same caveat applies to current_user_role() / current_user_id(): both
--    are believed to exist live as SECURITY DEFINER helpers matching by email,
--    neither is defined in this repo. They READ users; they do not gate inserts.)
--
-- ─────────────────────────────────────────────────────────────────────
-- ⚠ CASING HAZARD — READ BEFORE RUNNING. THIS IS THE REAL RISK HERE.
-- ─────────────────────────────────────────────────────────────────────
-- The brief says to preserve 'S.Pfaff@caskconstruction.com' exactly and not
-- normalize it, and this file does exactly that. But that instruction collides
-- with how the app actually looks people up, so you need to make this call
-- knowingly rather than discover it when Scott logs in:
--
--   * 35 of the 40 users lookups in the app use `.eq('email', …)` — EXACT,
--     case-SENSITIVE equality. Including the two that decide access:
--       src/middleware.ts:149          (route gating)
--       src/components/sidebar/Sidebar.tsx:242  (nav visibility)
--     Only 5 use `.ilike(…)` (microsoft callback, email/ai, okr-dashboard-v2,
--     customers/[id], customers/[id]/meetings/[meetingId]).
--   * The value those 35 compare against is the AUTH session email. Supabase
--     GoTrue normalises addresses to lowercase at signup, so auth.users.email is
--     very probably 's.pfaff@caskconstruction.com', all lower.
--   * `email text UNIQUE` is a case-SENSITIVE unique index. It will happily hold
--     both 'S.Pfaff@…' and 's.pfaff@…' as two separate rows.
--
-- If auth stores lowercase and public.users stores 'S.Pfaff@…', then for Scott
-- ONLY, every `.eq('email', …)` lookup returns no row. That does not fail loudly.
-- It resolves his role to undefined, and an undefined role is NOT treated as
-- restricted — in Sidebar.tsx the restricted check requires `role !== null`, and
-- middleware treats a genuinely missing row as "fall through", not as a lookup
-- failure. The outcome is the opposite of what this task is for: Scott would see
-- the full admin sidebar and reach pages construction_rep is meant to be kept out
-- of, while Cooper and Peter (whose addresses are already lowercase) are gated
-- correctly.
--
-- So: run the auth.users comparison in Step 0, and check `exact_case_match` in
-- Step 3. If it comes back false for Scott, apply the one-line UPDATE provided
-- after Step 3. Nothing else in this file needs to change.


-- ═════════════════════════════════════════════════════════════════════
-- STEP 0 — READ-ONLY. BACKUP + PRE-FLIGHT. RUN THIS FIRST, ON ITS OWN.
-- Nothing here mutates anything. Export 0.4 to CSV before going further.
-- ═════════════════════════════════════════════════════════════════════

-- 0.1 — The REAL column list. Reconcile against the DDL in the header above.
--       Watch for: any NOT NULL column with no default other than `name`.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 0.2 — Constraints. Confirms whether `id` is a plain PK or an FK to auth.users,
--       and what the unique constraint on email actually is.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY conname;

-- 0.3 — Triggers (assumption 4). EXPECTED: zero rows. If this returns anything,
--       stop and read what it does before inserting.
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal
ORDER BY tgname;

-- 0.4 — FULL BEFORE-STATE BACKUP. Export this result to CSV and keep it.
--       This is your revert reference if anything needs undoing.
SELECT * FROM public.users ORDER BY created_at NULLS FIRST, name;

-- 0.5 — Confirm none of the three already has a row. EXPECTED: zero rows.
--       Case-insensitive on purpose: a row differing only in case still counts
--       as "already exists" for identity-resolution purposes.
SELECT id, name, email, role, created_at
FROM public.users
WHERE lower(email) IN (
  'c.hermansen@caskconstruction.com',
  's.pfaff@caskconstruction.com',
  'p.deutelmoser@caskconstruction.com'
);

-- 0.6 — THE CASING CHECK. Shows the exact casing Supabase Auth stored for each
--       of the three, next to the public.users row once it exists.
--       Before Step 2: expect 3 rows, public_email NULL, exact_case_match NULL.
--       Read auth_email carefully — it is what the app's `.eq('email', …)`
--       lookups will be comparing against.
SELECT
  a.id                 AS auth_user_id,
  a.email              AS auth_email,
  u.id                 AS public_user_id,
  u.email              AS public_email,
  u.role,
  (a.email = u.email)  AS exact_case_match
FROM auth.users a
FULL OUTER JOIN public.users u
  ON lower(a.email) = lower(u.email)
WHERE lower(coalesce(a.email, u.email)) IN (
  'c.hermansen@caskconstruction.com',
  's.pfaff@caskconstruction.com',
  'p.deutelmoser@caskconstruction.com'
)
ORDER BY auth_email;


-- ═════════════════════════════════════════════════════════════════════
-- STEPS 1 + 2 — THE ONLY MUTATING PART. Run these two together, as one
-- selection, so the pre-flight can abort the insert.
-- ═════════════════════════════════════════════════════════════════════

BEGIN;

-- STEP 1 — Pre-flight. Aborts the whole transaction if any of the three already
-- has a row (case-insensitively), so this file can never create a duplicate that
-- would break `.maybeSingle()` with PGRST116 "multiple rows returned".
DO $$
DECLARE
  existing text;
BEGIN
  SELECT string_agg(email, ', ' ORDER BY email)
    INTO existing
  FROM public.users
  WHERE lower(email) IN (
    'c.hermansen@caskconstruction.com',
    's.pfaff@caskconstruction.com',
    'p.deutelmoser@caskconstruction.com'
  );

  IF existing IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborting: public.users already has row(s) for: %. Nothing was inserted. Review Step 0.5 before proceeding.',
      existing;
  END IF;
END $$;

-- STEP 2 — The three rows.
--   id          — omitted, takes the gen_random_uuid() default (assumption 2:
--                 NOT the auth.users id; identity here is resolved by email).
--   created_at  — omitted, takes the now() default.
--   avatar_initials — omitted deliberately; see the note after Step 3.
--   email       — EXACT casing as supplied in the brief, un-normalised.
--                 Scott's is mixed-case on purpose. See the casing hazard above.
INSERT INTO public.users (name, email, role)
VALUES
  ('Cooper Hermansen',  'c.hermansen@caskconstruction.com',   'construction_rep'),
  ('Scott Pfaff',       'S.Pfaff@caskconstruction.com',       'construction_rep'),
  ('Peter Deutelmoser', 'p.deutelmoser@caskconstruction.com', 'construction_rep');

COMMIT;


-- ═════════════════════════════════════════════════════════════════════
-- STEP 3 — VERIFY. Read-only. Run after the COMMIT above.
-- ═════════════════════════════════════════════════════════════════════

-- 3.1 — EXPECTED: exactly 3 rows, every `role` = 'construction_rep'.
SELECT id, name, email, role, created_at
FROM public.users
WHERE lower(email) IN (
  'c.hermansen@caskconstruction.com',
  's.pfaff@caskconstruction.com',
  'p.deutelmoser@caskconstruction.com'
)
ORDER BY name;

-- 3.2 — EXPECTED: 3 rows, and exact_case_match = true for ALL THREE.
--       A false here (most likely Scott) means the app's 35 case-sensitive
--       `.eq('email', …)` lookups will silently miss that person's row, his role
--       will resolve to undefined, and he will NOT be gated as a construction_rep.
--       Fix it with the UPDATE immediately below — do not leave it false.
SELECT
  a.email              AS auth_email,
  u.email              AS public_email,
  u.role,
  (a.email = u.email)  AS exact_case_match
FROM auth.users a
JOIN public.users u ON lower(a.email) = lower(u.email)
WHERE lower(a.email) IN (
  'c.hermansen@caskconstruction.com',
  's.pfaff@caskconstruction.com',
  'p.deutelmoser@caskconstruction.com'
)
ORDER BY auth_email;

-- ── Casing fix — RUN ONLY IF 3.2 SHOWED exact_case_match = false ─────────────
-- Rewrites the stored address to match auth.users exactly. Safe and idempotent:
-- it changes casing only, never which person the row belongs to.
--
-- UPDATE public.users u
--    SET email = a.email
--   FROM auth.users a
--  WHERE lower(u.email) = lower(a.email)
--    AND u.email <> a.email
--    AND lower(u.email) IN (
--      'c.hermansen@caskconstruction.com',
--      's.pfaff@caskconstruction.com',
--      'p.deutelmoser@caskconstruction.com'
--    );

-- ── Optional: avatar_initials ───────────────────────────────────────────────
-- Left NULL by the insert. Nothing in the app reads this column (it exists only
-- on the `User` TypeScript interface, src/types/index.ts:44), so nothing is
-- broken by leaving it. I did not guess a value because I could not see the
-- convention existing rows use — Step 0.4's CSV shows it. If existing rows use
-- two-letter initials, this matches that:
--
-- UPDATE public.users SET avatar_initials = 'CH' WHERE email = 'c.hermansen@caskconstruction.com';
-- UPDATE public.users SET avatar_initials = 'SP' WHERE email = 'S.Pfaff@caskconstruction.com';
-- UPDATE public.users SET avatar_initials = 'PD' WHERE email = 'p.deutelmoser@caskconstruction.com';


-- ═════════════════════════════════════════════════════════════════════
-- ROLLBACK — NOT EXECUTED. Uncomment and run only if reverting.
-- ═════════════════════════════════════════════════════════════════════
-- These match the exact casing written by Step 2. If you ran the casing fix
-- above, Scott's address will have changed to lowercase — use the lower() form
-- at the bottom instead, which covers either case.
--
-- DELETE FROM public.users WHERE email = 'c.hermansen@caskconstruction.com';
-- DELETE FROM public.users WHERE email = 'S.Pfaff@caskconstruction.com';
-- DELETE FROM public.users WHERE email = 'p.deutelmoser@caskconstruction.com';
--
-- Casing-proof equivalent (deletes all three regardless of stored casing):
--
-- DELETE FROM public.users
--  WHERE lower(email) IN (
--    'c.hermansen@caskconstruction.com',
--    's.pfaff@caskconstruction.com',
--    'p.deutelmoser@caskconstruction.com'
--  );
--
-- NOTE 1: deleting the public.users row does NOT remove the Supabase Auth login.
--         Those three can still sign in; they would just have no profile row, so
--         no role, which per the note in the casing section means UNRESTRICTED
--         nav rather than locked out. Remove the auth users too if the intent is
--         to revoke access.
-- NOTE 2: if any of them has connected Microsoft in the meantime, a row will
--         exist in user_integrations keyed to this users.id. Check before
--         deleting — I could not confirm from the repo whether that FK cascades:
--           SELECT * FROM user_integrations WHERE user_id IN (
--             SELECT id FROM public.users WHERE lower(email) IN (
--               'c.hermansen@caskconstruction.com',
--               's.pfaff@caskconstruction.com',
--               'p.deutelmoser@caskconstruction.com'));
