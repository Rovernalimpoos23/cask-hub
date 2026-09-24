-- Migration: construction_step_definitions_select_policy
-- Date: 2026-09-24
-- For: Phase 2 of moving Construction Journey step content out of code — the
--      customers/[id] page now READS public.construction_step_definitions instead
--      of the hardcoded CJ_STEPS constant.
-- Status: NOT RUN. Written for review — run it yourself in the SQL Editor.
--
-- ─────────────────────────────────────────────────────────────────────
-- RUN THIS BEFORE (OR TOGETHER WITH) DEPLOYING THE page.tsx CHANGE.
-- ─────────────────────────────────────────────────────────────────────
-- construction_step_definitions was created with RLS ENABLED and NO policies
-- (construction_step_definitions.sql, judgment call 4), i.e. deny-all to
-- anon/authenticated. Under deny-all a SELECT does not error — it returns an
-- empty 200. Confirmed read-only on 2026-09-24: the anon key gets [] today.
-- If the page change ships first, the Construction Journey Steps sub-tab shows
-- "Could not load the Construction Journey steps: no step definitions were
-- returned…" for every user until this file is run. (It fails loudly by design —
-- it does not fall back to a hardcoded list.)
--
-- WHAT THIS ADDS — exactly one policy
--   construction_step_definitions_select_authenticated — SELECT, TO
--   authenticated, USING (true).
--   Scope matches today's real exposure and no narrower: the Construction Journey
--   tab renders for ANY authenticated user (customers/[id]/page.tsx, the 5th
--   ClientTabBtn, ungated by design), and until now every one of them received
--   this exact content in the JS bundle as the CJ_STEPS constant. Anon stays
--   denied — which is actually narrower than a bundled constant, and correct.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD
--   * INSERT / UPDATE / DELETE — deferred to the Phase 3 edit-UI task. With no
--     write policy, writes remain service-role only.
--   * No change to construction_step_completions, construction_step_marks or
--     construction_step_schedules — schema or data. This file touches only the
--     policy set of construction_step_definitions.
--   * No ALTER TABLE ... ENABLE ROW LEVEL SECURITY — already enabled by the
--     Phase 1 file; the verification block below confirms it.
--
-- ─────────────────────────────────────────────────────────────────────
-- ASSUMPTIONS I COULD NOT VERIFY FROM THE REPO — CHECK BEFORE RUNNING
-- ─────────────────────────────────────────────────────────────────────
-- 1. 'authenticated' holds the table-level SELECT grant on
--    public.construction_step_definitions (Supabase's default for new public
--    tables). A policy alone does not grant privileges — if the GRANT is missing,
--    reads keep failing (as a permission error, not an empty list). Checked by
--    the grants query in VERIFICATION.
-- 2. No other policy exists on the table yet (Phase 1 created none). The
--    pg_policies query below should return exactly one row after running.
--
-- Re-runnable: the DROP ... IF EXISTS only ever targets the policy this file
-- creates.


-- ── SELECT: shared step definitions, readable by any signed-in user ──
DROP POLICY IF EXISTS "construction_step_definitions_select_authenticated"
  ON public.construction_step_definitions;

CREATE POLICY "construction_step_definitions_select_authenticated"
  ON public.construction_step_definitions
  FOR SELECT
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────────────
-- VERIFICATION — read-only, run separately after applying.
-- ─────────────────────────────────────────────────────────────────────
-- Policies now on the table (expect exactly ONE row:
--   construction_step_definitions_select_authenticated | {authenticated} | SELECT | true | NULL):
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'construction_step_definitions'
order by policyname;

-- RLS still enabled (expect relrowsecurity = true):
select relrowsecurity, relforcerowsecurity
from pg_class where oid = 'public.construction_step_definitions'::regclass;

-- Table-level grants held by 'authenticated' (assumption 1 — expect SELECT among them):
select privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'construction_step_definitions'
  and grantee = 'authenticated'
order by privilege_type;

-- Content unchanged by this file (expect 19 | 1 | 19):
select count(*), min(step_number), max(step_number)
from public.construction_step_definitions;


-- ─────────────────────────────────────────────────────────────────────
-- ROLLBACK — NOT ACTIVE. Uncomment and run only to undo this file.
-- Returns the table to deny-all (service-role only). Do NOT run it while the
-- page.tsx change is deployed: the Construction Journey Steps sub-tab would show
-- its load-failure message for every user, since the page has no fallback list.
-- ─────────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "construction_step_definitions_select_authenticated"
--   ON public.construction_step_definitions;
