-- Migration: tighten_meetings_action_items_rls
-- Date: 2026-09-23
-- For: closing unauthenticated (anon-key) access to public.meetings and
--      public.action_items. Step 3 of the RLS hardening order in CLAUDE.md is
--      the prerequisite (Fireflies webhook on service-role) and is already done.
-- Status: NOT RUN. Written for review — run it yourself in the SQL Editor.
--
-- ─────────────────────────────────────────────────────────────────────
-- BEFORE / AFTER
-- ─────────────────────────────────────────────────────────────────────
-- BEFORE: a live audit found RLS enabled on both tables (relrowsecurity = true),
-- each with a single policy "Allow all" — FOR ALL, TO public, USING (true),
-- WITH CHECK (true) — plus table-level GRANTs to anon of INSERT, SELECT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES, TRIGGER. Because the anon key ships in the browser
-- bundle, anyone on the internet could read, insert, update or delete any meeting
-- (full transcripts included) or action item with no login at all. TRUNCATE was
-- worse still: RLS does not apply to TRUNCATE, so the anon grant alone let an
-- unauthenticated caller empty either table regardless of any policy.
-- AFTER: anon holds no privileges on either table and no policy applies to it, so
-- every anon request fails at the grant layer (42501 permission denied). Each table
-- carries exactly one policy, "authenticated_full_access" — FOR ALL, TO
-- authenticated, USING (true), WITH CHECK (true) — which is precisely the access
-- every logged-in user has today, unchanged, for every role. service_role bypasses
-- RLS and is unaffected. This is deliberately NOT a per-role or per-row redesign:
-- action items live as nested JSONB inside meetings rows, and restricted roles
-- currently read every row and rewrite whole rows (see "WHY authenticated KEEPS
-- FULL ACCESS" below), so any narrower policy would break working features.
--
-- ─────────────────────────────────────────────────────────────────────
-- WHY authenticated KEEPS FULL ACCESS (code audit, 2026-09-23)
-- ─────────────────────────────────────────────────────────────────────
-- Every live app call site runs as 'authenticated' (browser client with a session,
-- or the cookie-backed server client) and assumes unconditional access; all role
-- filtering is client-side, after an unrestricted fetch. Examples that a narrower
-- policy would break:
--   src/app/(app)/dashboard/page.tsx:1358/1384 — SELECTs EVERY meetings row to find
--     the one owning an action item, then UPDATEs that whole row. Used by
--     restricted roles for their own items.
--   src/app/(app)/actions/page.tsx:684/724 — UPDATE of a meetings row the user may
--     not have attended ("My Items" matches on owner, not attendee).
--   src/app/(app)/sessions/new/page.tsx:108, AddMeetingModal.tsx:420 — INSERT by
--     any role that can reach /sessions.
-- Middleware (src/middleware.ts:94) requires a login for every route except
-- /auth/* and /api/webhooks/*; the only webhook touching these tables
-- (api/webhooks/fireflies/route.ts:288) uses SUPABASE_SERVICE_ROLE_KEY.
--
-- ─────────────────────────────────────────────────────────────────────
-- ASSUMPTIONS I COULD NOT VERIFY FROM THE REPO — CHECK BEFORE RUNNING
-- ─────────────────────────────────────────────────────────────────────
-- 1. NO EXTERNAL anon-key CONSUMER. The code audit covers this repo only. If any
--    outside integration (Make.com scenario, Zapier, a script, a spreadsheet
--    connector) reads or writes these tables with the anon key and no user
--    session, it breaks when this runs. The repo shows Make.com was used before
--    (calendar_events, MAKE_EMAIL_WEBHOOK_URL), so this is not hypothetical.
--    Check Supabase Dashboard → Logs → API for recent requests to
--    /rest/v1/meetings or /rest/v1/action_items that carry no user JWT before
--    running.
-- 2. 'authenticated' already holds the table grants it needs. This file does
--    not touch authenticated's grants (per the brief). Today's app works through
--    'authenticated', so the grants must be present — Step 0's grant query shows
--    them. A policy does not grant privileges on its own.
-- 3. The live policy name is exactly "Allow all" (case- and space-sensitive).
--    See the note on Step 1.
--
-- ─────────────────────────────────────────────────────────────────────
-- HOW TO RUN — ONE STEP AT A TIME, NOT THE WHOLE FILE
-- ─────────────────────────────────────────────────────────────────────
-- Highlight and run each STEP on its own. Pressing Run on the whole file would
-- execute Step 1 immediately after the backup SELECTs, before you have exported
-- anything — the SQL Editor only shows the last result set.
--   Step 0 → export both backups to CSV, save the policy + grant output.
--   Step 1 → the fix (one transaction).
--   Step 2 → verification.
--
-- NOT re-runnable after a successful run: Step 1's DROP POLICY "Allow all" will
-- fail on a second run (policy gone) and the transaction aborts, changing nothing.


-- ═════════════════════════════════════════════════════════════════════
-- STEP 0 — READ-ONLY BACKUP + VERIFICATION. Run first.
-- ═════════════════════════════════════════════════════════════════════

-- 0a. Row counts — note these down; Step 2 has nothing to compare them against
--     automatically, but they prove the fix changed no data.
select 'meetings' as tbl, count(*) as row_count from public.meetings
union all
select 'action_items', count(*) from public.action_items;

-- 0b. FULL BACKUP — run each SELECT on its own and use the SQL Editor's
--     "Export → CSV" (or Download) on the result BEFORE proceeding to Step 1.
--     This migration changes no data, but it touches production tables holding
--     real meeting/client content, so take the export anyway.
--     meetings includes full_transcript, so the export may be large.
select * from public.meetings order by created_at;

select * from public.action_items;

-- 0c. Current policies — expect exactly one row per table: "Allow all",
--     roles={public}, cmd=ALL, qual=true, with_check=true. If the policyname
--     differs, STOP and fix Step 1's DROP POLICY names before running it.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('meetings', 'action_items')
order by tablename, policyname;

-- 0d. Current grants for anon/authenticated. Expect anon to hold INSERT, SELECT,
--     UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on both tables. Save the
--     authenticated rows — Step 2 must show the same set, unchanged.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('meetings', 'action_items')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;


-- ═════════════════════════════════════════════════════════════════════
-- STEP 1 — THE FIX. One transaction.
-- ═════════════════════════════════════════════════════════════════════
-- Postgres DDL is transactional. If either DROP POLICY fails because the live
-- policy is not named exactly "Allow all", the whole transaction aborts and
-- NOTHING below is applied — no revokes, no drops, no new policies. In that case
-- re-check Step 0c's policyname output, correct the names here, and retry.
-- (No IF EXISTS on the DROPs on purpose: a silent no-op would leave "Allow all" in
-- place alongside the new policy, and permissive policies are OR'd, so the
-- exposure would stay open while looking fixed.)
--
-- Nothing here touches 'authenticated' grants or service_role.

begin;

-- a/b. Remove every table privilege anon holds. This is the change that actually
--      locks anon out; it also closes TRUNCATE, which RLS never covered.
revoke all privileges on table public.meetings     from anon;
revoke all privileges on table public.action_items from anon;

-- c/d. Remove the TO public policies (public includes anon AND authenticated).
drop policy "Allow all" on public.meetings;
drop policy "Allow all" on public.action_items;

-- e/f. Replace with the same unconditional access, scoped to logged-in users only.
create policy "authenticated_full_access"
  on public.meetings
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access"
  on public.action_items
  for all
  to authenticated
  using (true)
  with check (true);

commit;


-- ═════════════════════════════════════════════════════════════════════
-- STEP 2 — VERIFICATION. Run after Step 1 commits.
-- ═════════════════════════════════════════════════════════════════════

-- 2a. Expect exactly two rows: "authenticated_full_access" on each table,
--     roles={authenticated}, cmd=ALL, qual=true, with_check=true.
--     No policy with roles {public} or {anon} should remain.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('meetings', 'action_items')
order by tablename, policyname;

-- 2b. Expect ZERO rows for grantee = 'anon', and the authenticated rows identical
--     to what Step 0d showed.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('meetings', 'action_items')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 2c. Row counts — expect the same numbers as Step 0a.
select 'meetings' as tbl, count(*) as row_count from public.meetings
union all
select 'action_items', count(*) from public.action_items;

-- 2d. OPTIONAL behavioural check — read-only, and always rolled back.
--     Uncomment and run as one block. The anon SELECT should fail with
--     "permission denied for table meetings" (42501). That error aborts the
--     transaction, so run the authenticated half separately if you want it:
--     it should return the Step 0a count.
-- begin;
--   set local role anon;
--   select count(*) from public.meetings;   -- expect: ERROR 42501
-- rollback;
--
-- begin;
--   set local role authenticated;
--   select count(*) from public.meetings;   -- expect: same count as Step 0a
-- rollback;
--
-- Then in the live app: sign in as an admin and as a restricted role, load
-- Dashboard, All Sessions, a Session Detail and Action Items, and toggle one
-- action item. All should behave exactly as before.


-- ═════════════════════════════════════════════════════════════════════
-- ROLLBACK — NOT ACTIVE. Commented out on purpose.
-- ═════════════════════════════════════════════════════════════════════
-- ⚠ WARNING: running this RE-OPENS THE EXPOSURE. Unauthenticated callers with the
-- public anon key regain full read/write/delete/TRUNCATE on every meeting
-- (transcripts included) and every action item. Use it ONLY if something
-- legitimate breaks and needs immediate triage, and re-apply Step 1 as soon as the
-- cause is found. If the breakage is a missed external anon consumer
-- (assumption 1), the right fix is to move that consumer to the service-role key,
-- not to leave this rollback in place.
--
-- Restores exactly what the audit found: the "Allow all" policy (FOR ALL, TO
-- public, USING true, WITH CHECK true) and anon's seven table privileges.
-- 'authenticated' was never changed, so nothing is restored for it.
--
-- begin;
--
-- drop policy if exists "authenticated_full_access" on public.meetings;
-- drop policy if exists "authenticated_full_access" on public.action_items;
--
-- create policy "Allow all" on public.meetings
--   for all to public using (true) with check (true);
-- create policy "Allow all" on public.action_items
--   for all to public using (true) with check (true);
--
-- grant insert, select, update, delete, truncate, references, trigger
--   on table public.meetings to anon;
-- grant insert, select, update, delete, truncate, references, trigger
--   on table public.action_items to anon;
--
-- commit;
