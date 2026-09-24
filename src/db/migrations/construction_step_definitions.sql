-- ============================================================================
-- Migration: construction_step_definitions — shared Construction Journey step content
-- File     : src/db/migrations/construction_step_definitions.sql
-- Date     : 2026-09-24
-- Status   : NOT RUN — for review. Run by hand in the Supabase SQL Editor.
--
-- PURPOSE
--   Moves the CONTENT of the 19 Construction Journey steps (today the hardcoded
--   CJ_STEPS constant in src/app/(app)/customers/[id]/page.tsx, with a byte-identical
--   duplicate `STEPS` in src/app/(app)/construction-journey-preview/page.tsx) into
--   one shared table, so an admin can later edit step text without a deploy.
--   One shared set of steps for every client, exactly as today — NOT per-client.
--   v1 is edit-only: no add / delete / reorder. step_number is fixed at 1–19 and
--   matches CJ_STEPS.n exactly.
--
-- WHAT THIS DOES NOT TOUCH — PURELY ADDITIVE
--   * Creates ONE new table and seeds it. Nothing else.
--   * Does NOT touch construction_step_completions, construction_step_marks or
--     construction_step_schedules — no ALTER, no FK added to them, no UPDATE,
--     no DELETE. Every existing row in every existing table is left exactly as is.
--   * Does NOT change the app. CJ_STEPS stays the source of truth for what renders
--     until the separate switch-over task; nothing reads this table yet.
--
-- FIELD MAPPING (CjStep in page.tsx -> this table)
--   n          -> step_number   integer, NOT NULL, UNIQUE (what the 3 state tables key on)
--   type       -> step_type     text, one of 'customer' | 'internal' | 'email' | 'window'
--   title      -> title         text
--   objective  -> objective     text
--   who        -> who           text
--   roles[]    -> roles         jsonb array, ORDER PRESERVED:
--                                 [{ "role": <CjRoleBlock.r>, "tasks": [<text>, ...] }, ...]
--                               role keys in use: pm, super, select, market
--   status     -> NOT CARRIED   (see JUDGMENT CALLS)
--   roles[].done -> NOT CARRIED (see JUDGMENT CALLS)
--
-- JUDGMENT CALLS — flagged for review
--   1. `status` and `roles[].done` are deliberately NOT columns. Both are marked
--      "NO LONGER READ" in page.tsx (CjStep.status ~5730, CjRoleBlock.done ~5719):
--      they were mock per-client progress, now replaced by construction_step_marks
--      and construction_step_completions. Seeding them into a shared definitions
--      table would store fake progress ('done' on step 1, 'current' on step 2) as
--      if it were content. Every field that IS read today is carried.
--   2. roles is jsonb rather than a child table: v1 has no reorder/delete, the
--      whole step is edited as one unit, and array order is display order.
--      Role block key renamed r -> "role" for readability; the switch-over maps it.
--   3. Task text must stay byte-identical to CJ_STEPS. construction_step_completions
--      keys each tick on (client_id, step_number, role, task_text) — see cjTaskKey
--      ~5936 — so ANY later edit to a task string (typo fixes included) orphans
--      that task's existing ticks: they stay in the table but render unchecked.
--      The edit UI/API must account for this. Seed below is generated
--      mechanically from the source array, not retyped (19 steps, 85 tasks).
--   4. RLS is ENABLED with NO policies. That is not a policy — it is deny-all for
--      anon/authenticated, service-role only. Without it, a new public table is
--      readable AND writable with the public anon key (default Supabase grants),
--      which is the exact weak-RLS pattern the hardening pass is removing. Nothing
--      reads this table yet, so deny-all breaks nothing. Remove the ALTER ... ENABLE
--      line only if you deliberately want it open.
--   5. updated_at has a default but no trigger — same convention as
--      construction_step_schedules, where the writer sends updated_at explicitly.
--      The future edit API must set it on every UPDATE.
--   6. CREATE TABLE (not IF NOT EXISTS) and a plain INSERT, inside one
--      transaction: a re-run fails loudly on "already exists" rather than silently
--      skipping or double-seeding. The guard block rolls everything back if the
--      seed is not exactly 19 steps / 85 tasks.
--
-- RLS — FOLLOW-UP (NOT IN THIS FILE)
--   The task that builds the edit API must add policies here, mirroring the
--   admin-scoped hub_memory_insert_leadership pattern
--   (src/db/migrations/hub_memory_storage_rls.sql): TO authenticated, gated on
--   current_user_role() IN ('president','ea','ai_specialist') for writes, and a
--   SELECT policy for whoever renders the journey. Not written yet because the edit
--   route's access pattern (browser session client vs. service-role route) is not
--   finalized. Until then only the service role can read or write this table.
-- ============================================================================

BEGIN;

CREATE TABLE public.construction_step_definitions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number  integer     NOT NULL UNIQUE CHECK (step_number > 0),
  step_type    text        NOT NULL CHECK (step_type IN ('customer', 'internal', 'email', 'window')),
  title        text        NOT NULL,
  objective    text        NOT NULL,
  who          text        NOT NULL,
  roles        jsonb       NOT NULL CHECK (jsonb_typeof(roles) = 'array'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.construction_step_definitions IS
  'Shared Construction Journey step content (19 steps, same for every client). Seeded verbatim from CJ_STEPS in customers/[id]/page.tsx on 2026-09-24. step_number is what construction_step_completions/marks/schedules reference (no FK). Editing a task string orphans existing ticks in construction_step_completions, which key on task_text.';
COMMENT ON COLUMN public.construction_step_definitions.roles IS
  'Ordered array of {"role": text, "tasks": [text, ...]}. role is pm | super | select | market. Task strings must match construction_step_completions.task_text exactly.';

-- Deny-all until the follow-up adds policies (see JUDGMENT CALL 4).
ALTER TABLE public.construction_step_definitions ENABLE ROW LEVEL SECURITY;

-- ── Seed: EXACT content of CJ_STEPS as of 2026-09-24 ────────────────────────
-- Generated mechanically from the array literal (not retyped). Contains no single
-- quotes; the only non-ASCII characters are — · → – which are stored as UTF-8.
INSERT INTO public.construction_step_definitions
  (step_number, step_type, title, objective, who, roles)
VALUES
  (1, 'customer',
   'C1 — Kickoff Meeting with Customer',
   'Organize drawings, selections, and changes; set expectations; review BT schedule and field plans; confirm site logistics.',
   'Project manager, superintendent, customer',
   '[{"role":"pm","tasks":["Present Cask and the team","Review BT schedule and upcoming construction journey","Review permitted set of plans and marked-up field set","Review electrical, kitchen, bathroom, plumbing, HVAC, window placement, exterior wall finish","Identify neighbors of concern","Confirm backyard laydown space; coordinate owner to clear area and install temp fencing","Verify construction sign install location with flag","Confirm QR code sheet is in the job box for sub plan review","If demo required — review demo FAQs (utility shutoff, clear space, etc.)","Schedule next meeting (Foundation and Slab on Grade)"]},{"role":"super","tasks":["Walk site and confirm all field conditions noted","Mark up field set of plans with 100% of changes"]}]'::jsonb),

  (2, 'email',
   'C1 Email — Kickoff Meeting Recap',
   'Send kickoff recap to customer; confirm foundation meeting date and site survey date.',
   'Sender: Project manager · CC: Superintendent → to customer',
   '[{"role":"pm","tasks":["Include kickoff meeting agenda notes and any changes to field set of plans","Confirm date and time for Foundation and Slab on Grade meeting","Confirm date for site survey"]}]'::jsonb),

  (3, 'window',
   'Demo (if needed)',
   'If demo required — 3–6 weeks post kickoff; disconnect utilities, contact 811 Dig, prep demo site.',
   'Superintendent',
   '[{"role":"super","tasks":["Disconnect utilities","Contact 811 Dig","Prep demo site (removal of items from area)"]}]'::jsonb),

  (4, 'window',
   'Site Survey and Layout',
   'Schedule survey and request pinning of building and blue-top elevation; double-check all setbacks.',
   'Superintendent',
   '[{"role":"super","tasks":["Schedule site survey","Request pinning of building and blue-top elevation","Double-check setbacks: side, rear, front; stair setbacks if stairs planned"]}]'::jsonb),

  (5, 'internal',
   'Internal Sub Meeting — Structure',
   'Email field set of plans; superintendent walks subs and reviews scope of work.',
   'Superintendent, subs (framer, concrete, electrician, plumber)',
   '[{"role":"super","tasks":["Email field set of plans to all subs","Framer — review elevation changes, window/door/garage openings, wall finishes, truss layout","Concrete — review elevation changes, window/door/garage openings, wall finishes","Electrician — install and double-check all underground","Plumber — install and double-check all underground"]}]'::jsonb),

  (6, 'customer',
   'C2 — Foundation and Slab on Grade Meeting',
   'Review BT schedule; walk site to confirm building corners, setbacks, slab elevation, and sanitary conditions.',
   'Superintendent, customer',
   '[{"role":"super","tasks":["Review BT schedule highlighting structure timeline","Walk site: confirm corners of building, setbacks (rear, side, front), stair setback per zoning","Confirm elevation of slab on grade","Determine sanitary condition; inform owner of replacement if needed"]}]'::jsonb),

  (7, 'email',
   'C2 Email — Foundation and Slab on Grade Recap',
   'Send meeting recap; outline next stage in customer journey.',
   'Sender: Project manager · CC: Superintendent → to customer',
   '[{"role":"pm","tasks":["Include foundation and slab meeting agenda notes and any changes to field set of plans","Outline next stage in customer journey"]}]'::jsonb),

  (8, 'email',
   'C3 Email — Structure Stage Expectations',
   'Set customer expectations for the structure stage; outline schedule and site activity.',
   'Sender: Project manager · CC: Superintendent, framer, concrete subs → to customer',
   '[{"role":"pm","tasks":["Confirm structure complete celebration meeting date and time","Outline BT schedule and workflow for structure stage","Detail which subs will be on site during structure","Share best practices — notify neighbors of high-traffic period; provide FAQ post-card if needed"]}]'::jsonb),

  (9, 'customer',
   'C3 Meeting — Structure Complete Celebration',
   'Walk space; celebrate passing structure; prepare for MEP rough-in stage.',
   'Project manager, superintendent, customer',
   '[{"role":"pm","tasks":["Review BT schedule highlighting next steps in construction journey","Walk the completed structure with customer","Confirm rough-in next steps and upcoming MEP work"]},{"role":"super","tasks":["Verify construction sign and QR code sheet are in place in job box"]}]'::jsonb),

  (10, 'email',
   'C4 Email — Structure Complete Celebration Recap',
   'Send celebration meeting recap; outline rough-in stage.',
   'Sender: Project manager · CC: Superintendent → to customer',
   '[{"role":"pm","tasks":["Include celebration meeting agenda notes and any changes to field set of plans","Outline next stage (rough-in) in customer journey"]}]'::jsonb),

  (11, 'internal',
   'Internal Sub Meeting — Rough-In',
   'Walk subs with updated scope; review MEP layout before installation.',
   'Superintendent, subs',
   '[{"role":"super","tasks":["Review BT schedule highlighting rough-in stage","Review permitted plans and marked-up field plans with subs","Cover: electrical layout, kitchen layout, bathroom lighting and vanity, plumbing, HVAC"]}]'::jsonb),

  (12, 'customer',
   'C4 Meeting — Rough-In with Customer',
   'Walk space with client to lay out electrical, kitchen, plumbing, and HVAC before MEPs are installed.',
   'Project manager, superintendent, customer',
   '[{"role":"pm","tasks":["Review BT schedule highlighting next steps","Walk and confirm: electrical layout, kitchen layout, bathroom lighting/vanity, plumbing, HVAC","Determine neighbor concerns; coordinate direct communication if needed","Verify construction sign and QR code sheet are in place in job box"]},{"role":"super","tasks":["Confirm all marked-up field plans are current"]}]'::jsonb),

  (13, 'customer',
   'C5 Meeting — Finishes with Customer',
   'Post-drywall re-walk; review and confirm all finishes to be installed; celebrate framing and in-wall inspections passing.',
   'Project manager, superintendent, selections manager, customer',
   '[{"role":"pm","tasks":["Review BT schedule and selections packet","Update field drawings for all finishes to be installed","Celebrate customer passing framing and in-wall inspections","Verify construction sign and QR code sheet with updated link to plans are in job box","Confirm selections packet is in job box"]},{"role":"select","tasks":["Walk through all finish selections with customer","Confirm kitchen and bathroom layout decisions","Document any open decisions still to be made and assign due dates"]},{"role":"super","tasks":["Confirm field drawings are updated for all finishes"]}]'::jsonb),

  (14, 'internal',
   'Internal Sub Meeting — Finishes',
   'Walk subs installing finishes; review updated field drawings and selections.',
   'Superintendent, subs',
   '[{"role":"super","tasks":["Review BT schedule and selections packet with subs","Review kitchen and bathroom layout with relevant subs","Update field drawings for all finishes to be installed"]}]'::jsonb),

  (15, 'email',
   'C5 Email — Finish Meeting Recap',
   'Send finish meeting recap; confirm open decisions and due dates.',
   'Sender: Project manager · CC: Superintendent, selections manager, appropriate subs → to customer',
   '[{"role":"pm","tasks":["Recap bathroom and kitchen selections decisions; include on marked-up drawings","List items discovered during the meeting","List decisions still to be made with due dates"]}]'::jsonb),

  (16, 'email',
   'C6 Email — Close Out Steps to Customer',
   'Notify customer of punchlist walkthrough availability; outline close-out process.',
   'Sender: Project manager · CC: Superintendent → to customer',
   '[{"role":"pm","tasks":["Provide available dates and times for punchlist walkthrough","Outline close-out process: permitting, punchlist, and turnover"]}]'::jsonb),

  (17, 'customer',
   'C6 Meeting — Punchlist Walkthrough',
   'Walk punchlist items still to be addressed; receive customer confirmation all concerns are resolved.',
   'Project manager, superintendent, customer',
   '[{"role":"pm","tasks":["Review BT punchlist with customer","Identify items missing or to be repaired","Receive customer confirmation all concerns are addressed by end of meeting"]},{"role":"super","tasks":["Walk all punchlist items; note any new items raised by customer"]}]'::jsonb),

  (18, 'email',
   'C7 Email — Punchlist Walkthrough Recap',
   'Send recap of punchlist walkthrough; outline next steps and send final walkthrough invite if available.',
   'Sender: Project manager · CC: Superintendent → to customer',
   '[{"role":"pm","tasks":["Review punchlist walkthrough agenda notes","Include BT punchlist print view with timestamps of completed items","Outline next steps; include final walkthrough meeting invite if available"]}]'::jsonb),

  (19, 'customer',
   'C7 Meeting — Final Walkthrough with Customer',
   'Conduct full interior and exterior walkthrough; deliver project to customer; close out certificate of completion.',
   'Project manager, superintendent, marketing manager, customer',
   '[{"role":"pm","tasks":["Review status of Certificate of Completion (CO) and permit closing","Conduct interior walkthrough: doors and windows, appliances, walls and rooms, thermostat","Conduct exterior walkthrough: property perimeter, signage","Verify all punchlist items are complete; note any remaining items","Provide customer with ADU best practices sheet and warranty contact info","Provide CASK blueprint gift","Remove construction sign","Confirm testimonial video date/time; encourage online review"]},{"role":"super","tasks":["Confirm punchlist is fully resolved prior to walkthrough"]},{"role":"market","tasks":["Coordinate testimonial video recording","Capture project completion photos/video for marketing"]}]'::jsonb)
;

-- ── Guard: abort (rolls back the CREATE too) unless the seed is exactly right ──
DO $$
DECLARE
  n_rows     integer;
  n_distinct integer;
  n_min      integer;
  n_max      integer;
  n_tasks    integer;
  bad_steps  text;
BEGIN
  SELECT count(*), count(DISTINCT step_number), min(step_number), max(step_number)
    INTO n_rows, n_distinct, n_min, n_max
    FROM public.construction_step_definitions;

  IF n_rows <> 19 OR n_distinct <> 19 OR n_min <> 1 OR n_max <> 19 THEN
    RAISE EXCEPTION 'construction_step_definitions seed wrong: rows=%, distinct=%, min=%, max=% (expected 19/19/1/19)',
      n_rows, n_distinct, n_min, n_max;
  END IF;

  SELECT count(*) INTO n_tasks
    FROM public.construction_step_definitions d,
         jsonb_array_elements(d.roles) rb,
         jsonb_array_elements_text(rb -> 'tasks') t;
  IF n_tasks <> 85 THEN
    RAISE EXCEPTION 'construction_step_definitions seed wrong: % tasks (expected 85)', n_tasks;
  END IF;

  -- Per-step task counts, taken from CJ_STEPS at generation time.
  SELECT string_agg(e.step_number || ' (expected ' || e.expected || ', got ' || coalesce(a.actual, 0) || ')', ', ')
    INTO bad_steps
    FROM (VALUES (1,12),(2,3),(3,3),(4,3),(5,5),(6,4),(7,2),(8,4),(9,4),(10,2),
                 (11,3),(12,5),(13,9),(14,3),(15,3),(16,2),(17,4),(18,3),(19,11))
           AS e(step_number, expected)
    LEFT JOIN (
      SELECT d.step_number, count(*)::integer AS actual
        FROM public.construction_step_definitions d,
             jsonb_array_elements(d.roles) rb,
             jsonb_array_elements_text(rb -> 'tasks') t
       GROUP BY d.step_number
    ) a USING (step_number)
   WHERE coalesce(a.actual, 0) <> e.expected;
  IF bad_steps IS NOT NULL THEN
    RAISE EXCEPTION 'construction_step_definitions per-step task counts wrong: %', bad_steps;
  END IF;
END
$$;

COMMIT;

-- ── Verification (read-only; run after COMMIT) ──────────────────────────────
-- Expect exactly one row: 19 | 19 | 1 | 19 | 0 gaps | 85 tasks
SELECT
  count(*)                              AS total_rows,
  count(DISTINCT step_number)           AS distinct_step_numbers,
  min(step_number)                      AS min_step,
  max(step_number)                      AS max_step,
  (SELECT count(*)
     FROM generate_series(1, 19) g(n)
    WHERE NOT EXISTS (SELECT 1 FROM public.construction_step_definitions d
                       WHERE d.step_number = g.n))  AS missing_step_numbers,
  (SELECT count(*)
     FROM public.construction_step_definitions d,
          jsonb_array_elements(d.roles) rb,
          jsonb_array_elements_text(rb -> 'tasks') t)  AS total_tasks
FROM public.construction_step_definitions;

-- Expect 19 rows, 1..19 in order, types 7 customer / 3 internal / 7 email / 2 window.
SELECT step_number, step_type, title,
       jsonb_array_length(roles) AS role_blocks,
       (SELECT count(*) FROM jsonb_array_elements(roles) rb,
               jsonb_array_elements_text(rb -> 'tasks') t) AS tasks
  FROM public.construction_step_definitions
 ORDER BY step_number;
