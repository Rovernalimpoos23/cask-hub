-- Migration: hub_memory_storage_rls
-- Date: 2026-09-21
-- For: the Big Vision 'hub-memory' direct-upload rework.
-- Status: NOT RUN. Written for review — run it yourself in the SQL Editor.
--
-- ─────────────────────────────────────────────────────────────────────
-- THIS BUCKET HAD NO storage.objects POLICIES BEFORE THIS MIGRATION.
-- ─────────────────────────────────────────────────────────────────────
-- A repo-wide audit on 2026-09-21 found ZERO storage.objects policies of any
-- kind committed to this repo — not for 'hub-memory', not for any bucket. Every
-- hub-memory Storage operation in the app today runs with
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely:
--   src/app/api/big-vision/upload/route.ts:254   (upload)
--   src/app/api/big-vision/delete/route.ts:146   (remove)
-- So no policy has ever been exercised for this bucket, and the fact that
-- uploads work today says nothing about what RLS would allow. A client-side
-- upload is the first request that would ever hit RLS here; with no policy
-- present it fails closed.
--
-- WHAT THIS ADDS — exactly one policy
--   hub_memory_insert_leadership — INSERT, TO authenticated, restricted to
--   current_user_role() in ('president','ea','ai_specialist'): the same three
--   roles ADMIN_ROLES gates /api/big-vision/upload on today
--   (upload/route.ts:31).
--
-- WHAT THIS DELIBERATELY DOES NOT ADD
--   * UPDATE / DELETE — per the brief. The delete route is service-role and
--     needs no policy.
--     CAVEAT: INSERT alone is sufficient only while uploads use upsert:false
--     (what upload/route.ts:257 does today, with a Date.now() prefix making
--     collisions effectively impossible). An upsert-style client upload, or any
--     overwrite of an existing object key, ALSO requires an UPDATE policy.
--   * SELECT — omitted deliberately; see the decision note below.
--
-- ─────────────────────────────────────────────────────────────────────
-- SELECT POLICY: OMITTED (this was the open question in the brief)
-- ─────────────────────────────────────────────────────────────────────
-- The brief said to include SELECT only if the planned re-download in route.ts
-- runs under the session client rather than service-role. Checked, and the
-- premise does not hold yet: there is no re-download in the codebase at all,
-- planned or otherwise. upload/route.ts only uploads; delete/route.ts only
-- removes; neither reads object bytes back. Nothing anywhere mints a signed URL
-- for 'hub-memory' — every createSignedUrl/createSignedUrls call site targets
-- client-files, construction-files or cask-vision-docs instead.
--
-- Both hub-memory Storage paths are service-role, so by the brief's own
-- criterion the SELECT policy is not required today and is left out. The exact
-- statement is written out, commented, at the bottom of this file for the day
-- that changes. Add it if ANY of these become true:
--   - the browser lists, previews, downloads or signs hub-memory objects;
--   - a server route re-downloads an object using the session/cookie client
--     (@/lib/supabase-server, which is anon-key — NOT service-role) instead of
--     the service-role client.
-- A server-minted signed UPLOAD url (createSignedUploadUrl) does NOT need it —
-- that is minted with service-role, and the browser's subsequent PUT is
-- authorised by the token, not by RLS.
--
-- ─────────────────────────────────────────────────────────────────────
-- ASSUMPTIONS I COULD NOT VERIFY FROM THE REPO — CHECK BEFORE RUNNING
-- ─────────────────────────────────────────────────────────────────────
-- 1. current_user_role() is assumed to exist in the live DB as a SECURITY
--    DEFINER helper. It is NOT defined anywhere in this repo (no CREATE
--    FUNCTION exists in any committed .sql). The only in-repo evidence is a
--    comment at src/app/(app)/customers/[id]/page.tsx:6497 describing the
--    construction-files bucket policy as current_user_role() IS NOT NULL,
--    "widened from the original 'president','ea','ai_specialist' list" — i.e.
--    precisely the pattern and role list used below. Per the repo rule about
--    not trusting inline comments on security posture, treat that as a lead,
--    not as proof. The preflight block fails loudly if the function is missing.
-- 2. The brief named an existing policy 'vision_docs_read_leadership' on the
--    cask-vision-docs bucket as the thing to mirror. That name appears NOWHERE
--    in this repo, so its exact shape could not be read and could not be
--    mirrored literally. This file follows the pattern documented in the
--    comment cited above, plus the role list given in the brief. If the live
--    vision_docs policy differs (role list, TO clause, USING vs WITH CHECK,
--    schema-qualified call), reconcile against it before running.
-- 3. storage.objects already has RLS enabled (the Supabase default). This file
--    intentionally does NOT run ALTER TABLE ... ENABLE ROW LEVEL SECURITY:
--    out of scope, and typically not permitted to the SQL Editor role anyway.
-- 4. The 'authenticated' role is assumed to already hold the table-level INSERT
--    grant on storage.objects (Supabase default). A policy alone does not grant
--    privileges — if the GRANT is missing, the policy will not save you.
-- 5. Bucket-level limits apply independently of RLS and are unchanged by this
--    file. construction-files is documented in-repo as having a configured
--    file_size_limit (40MB, customers/[id]/page.tsx:6533) and
--    allowed_mime_types; whatever hub-memory has configured will constrain a
--    direct client upload exactly as it constrains today's server upload.
--
-- Re-runnable: the DROP ... IF EXISTS below only ever targets the policy this
-- file creates. Given the audit found no pre-existing policies on this bucket,
-- it can only drop a leftover from a previous run of this same file.


-- ── Preflight: fail with a clear message if the helper is missing ─────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_role') THEN
    RAISE EXCEPTION
      'current_user_role() not found. Resolve assumption 1 in this migration header before running.';
  END IF;
END
$$;


-- ── INSERT: client-side direct upload into the hub-memory bucket ──────
DROP POLICY IF EXISTS "hub_memory_insert_leadership" ON storage.objects;

CREATE POLICY "hub_memory_insert_leadership"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hub-memory'
    -- The ::text cast keeps this correct whether current_user_role() returns
    -- text or an enum. users.role is text in supabase-schema.sql, but that file
    -- is a known-stale MVP relic, so the cast is not assumed away.
    AND current_user_role()::text = ANY (ARRAY['president', 'ea', 'ai_specialist']::text[])
  );


-- ─────────────────────────────────────────────────────────────────────
-- NOT ACTIVE — SELECT policy, kept for the conditions listed in the
-- "SELECT POLICY: OMITTED" note above. Uncomment only when one of those
-- conditions is actually true; do not enable it pre-emptively.
-- ─────────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "hub_memory_select_leadership" ON storage.objects;
--
-- CREATE POLICY "hub_memory_select_leadership"
--   ON storage.objects
--   FOR SELECT
--   TO authenticated
--   USING (
--     bucket_id = 'hub-memory'
--     AND current_user_role()::text = ANY (ARRAY['president', 'ea', 'ai_specialist']::text[])
--   );


-- ─────────────────────────────────────────────────────────────────────
-- VERIFICATION — read-only, run separately after applying.
-- ─────────────────────────────────────────────────────────────────────
-- Policies now on storage.objects (expect exactly the one added above):
--   select policyname, roles, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   order by policyname;
--
-- RLS actually enabled on the table (assumption 3):
--   select relrowsecurity, relforcerowsecurity
--   from pg_class where oid = 'storage.objects'::regclass;
--
-- Table-level grants held by 'authenticated' (assumption 4):
--   select privilege_type from information_schema.role_table_grants
--   where table_schema = 'storage' and table_name = 'objects'
--     and grantee = 'authenticated';
--
-- Bucket configuration, incl. the size/MIME ceilings in assumption 5:
--   select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'hub-memory';
