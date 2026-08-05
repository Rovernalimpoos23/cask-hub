-- ============================================================================
-- Migration: 37-step Customer Journey renumber  (old 33-step -> new 37-step)
-- File     : src/db/migrations/37-step-renumber.sql
-- Generated to accompany commit 75ccc37 (src/lib/workflow-steps.ts 33 -> 37 steps)
--
-- WHAT THIS DOES
--   1. Full-table backups of every affected table (suffix _backup_pre37)
--   2. Deletes rows for OLD step 23 (removed from the workflow; also REQUIRED so
--      old step 18 can move into slot 23 without a unique-constraint collision)
--   3. Renumbers step_number in workflow_step_completions + journey_step_start
--   4. Renumbers meeting_code / meeting_id in journey_checklists, client_meetings,
--      client_email_drafts  ('step_NN' -> 'step_MM')
--   5. Rewrites the 28 task_text strings whose wording changed
--   6. Prints a per-statement row-count log + an unmatched-row report
--
-- ORDERING
--   Every old step maps to a HIGHER new number, so renumbering is done in strictly
--   DESCENDING old-step order (33->37 first, 13->16 last). Each target slot is
--   therefore always vacated before it is written to, so UNIQUE(client_id, step_number)
--   can never be violated mid-migration.
--
-- BACKUP SCOPE - DELIBERATE DEVIATION FROM THE BRIEF
--   The brief suggested backing up "WHERE step_number >= 13". These are FULL-table
--   snapshots instead, because the task_text rewrites in step 5 also touch steps
--   3,4,5,6,8,9,10,11,12 (all < 13). A >= 13 snapshot would NOT be restorable.
--   The tables are small (workflow_step_completions 2 rows, journey_step_start 7,
--   journey_checklists 139), so a full copy costs nothing.
--
-- ROLE KEYS ARE NOT TOUCHED
--   ROLE_NAMES.sales_pm kept its internal key; only the display label changed to
--   "Client Solution Manager". journey_checklists.role values are left alone.
--   (task_text values that *mention* "Sales PM" DO change - see step 5.)
--
-- >>> DRY RUN: change the final COMMIT to ROLLBACK to see the verification output
-- >>> without persisting anything. Recommended for the first pass.
--
-- ASSUMPTIONS: the five tables below exist with these columns:
--   workflow_step_completions.step_number   journey_step_start.step_number
--   journey_checklists(meeting_code, role, task_text)
--   client_meetings.meeting_id              client_email_drafts.meeting_id
-- If any is wrong the statement errors and the whole transaction aborts - no partial writes.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. PRE-FLIGHT GUARDS  (abort if this already ran)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM workflow_step_completions WHERE step_number > 33) THEN
    RAISE EXCEPTION 'ABORT: workflow_step_completions already has step_number > 33 - migration appears to have run already.';
  END IF;
  IF EXISTS (SELECT 1 FROM journey_step_start WHERE step_number > 33) THEN
    RAISE EXCEPTION 'ABORT: journey_step_start already has step_number > 33 - migration appears to have run already.';
  END IF;
  IF EXISTS (SELECT 1 FROM journey_checklists WHERE meeting_code IN ('step_34','step_35','step_36','step_37')) THEN
    RAISE EXCEPTION 'ABORT: journey_checklists already has step_34..step_37 - migration appears to have run already.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. BACKUPS  (CREATE TABLE fails if it already exists -> natural re-run guard)
-- ---------------------------------------------------------------------------
CREATE TABLE workflow_step_completions_backup_pre37 AS SELECT * FROM workflow_step_completions;
CREATE TABLE journey_step_start_backup_pre37 AS SELECT * FROM journey_step_start;
CREATE TABLE journey_checklists_backup_pre37 AS SELECT * FROM journey_checklists;
CREATE TABLE client_meetings_backup_pre37 AS SELECT * FROM client_meetings;
CREATE TABLE client_email_drafts_backup_pre37 AS SELECT * FROM client_email_drafts;

DROP TABLE IF EXISTS workflow_migration_log_pre37;
CREATE TABLE workflow_migration_log_pre37 (
  seq           serial PRIMARY KEY,
  tbl           text,
  op            text,
  detail        text,
  rows_affected bigint
);

INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'backup', 'rows snapshotted', count(*) FROM workflow_step_completions_backup_pre37;
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'backup', 'rows snapshotted', count(*) FROM journey_step_start_backup_pre37;
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'backup', 'rows snapshotted', count(*) FROM journey_checklists_backup_pre37;
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'backup', 'rows snapshotted', count(*) FROM client_meetings_backup_pre37;
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'backup', 'rows snapshotted', count(*) FROM client_email_drafts_backup_pre37;

-- ---------------------------------------------------------------------------
-- 2. DELETE OLD STEP 23  ("Pass-Off: Estimator to Construction Manager", early copy)
--    Confirmed intentionally removed. Old step 32 ("Final Pass-Off: ...") is the one
--    that becomes new step 36. These rows are unreachable after the migration AND
--    must go before old step 18 -> 23 below, or that UPDATE hits a unique violation.
--    Rows are preserved in the *_backup_pre37 tables.
-- ---------------------------------------------------------------------------
WITH u AS (DELETE FROM workflow_step_completions WHERE step_number = 23 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'delete', 'old step 23 removed', count(*) FROM u;
WITH u AS (DELETE FROM journey_step_start WHERE step_number = 23 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'delete', 'old step 23 removed', count(*) FROM u;
WITH u AS (DELETE FROM journey_checklists WHERE meeting_code = 'step_23' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'delete', 'old step_23 removed', count(*) FROM u;
WITH u AS (DELETE FROM client_meetings WHERE meeting_id = 'step_23' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'delete', 'old step_23 removed', count(*) FROM u;
WITH u AS (DELETE FROM client_email_drafts WHERE meeting_id = 'step_23' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'delete', 'old step_23 removed', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 3. RENUMBER workflow_step_completions.step_number  (descending old-step order)
-- ---------------------------------------------------------------------------
WITH u AS (UPDATE workflow_step_completions SET step_number = 37 WHERE step_number = 33 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '33 -> 37', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 36 WHERE step_number = 32 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '32 -> 36', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 35 WHERE step_number = 31 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '31 -> 35', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 34 WHERE step_number = 30 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '30 -> 34', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 33 WHERE step_number = 29 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '29 -> 33', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 32 WHERE step_number = 28 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '28 -> 32', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 31 WHERE step_number = 27 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '27 -> 31', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 30 WHERE step_number = 26 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '26 -> 30', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 29 WHERE step_number = 25 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '25 -> 29', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 28 WHERE step_number = 24 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '24 -> 28', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 27 WHERE step_number = 22 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '22 -> 27', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 26 WHERE step_number = 21 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '21 -> 26', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 25 WHERE step_number = 20 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '20 -> 25', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 24 WHERE step_number = 19 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '19 -> 24', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 23 WHERE step_number = 18 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '18 -> 23', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 22 WHERE step_number = 17 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '17 -> 22', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 21 WHERE step_number = 16 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '16 -> 21', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 20 WHERE step_number = 15 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '15 -> 20', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 17 WHERE step_number = 14 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '14 -> 17', count(*) FROM u;
WITH u AS (UPDATE workflow_step_completions SET step_number = 16 WHERE step_number = 13 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'workflow_step_completions', 'renumber', '13 -> 16', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 3. RENUMBER journey_step_start.step_number  (descending old-step order)
-- ---------------------------------------------------------------------------
WITH u AS (UPDATE journey_step_start SET step_number = 37 WHERE step_number = 33 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '33 -> 37', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 36 WHERE step_number = 32 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '32 -> 36', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 35 WHERE step_number = 31 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '31 -> 35', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 34 WHERE step_number = 30 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '30 -> 34', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 33 WHERE step_number = 29 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '29 -> 33', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 32 WHERE step_number = 28 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '28 -> 32', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 31 WHERE step_number = 27 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '27 -> 31', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 30 WHERE step_number = 26 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '26 -> 30', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 29 WHERE step_number = 25 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '25 -> 29', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 28 WHERE step_number = 24 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '24 -> 28', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 27 WHERE step_number = 22 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '22 -> 27', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 26 WHERE step_number = 21 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '21 -> 26', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 25 WHERE step_number = 20 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '20 -> 25', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 24 WHERE step_number = 19 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '19 -> 24', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 23 WHERE step_number = 18 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '18 -> 23', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 22 WHERE step_number = 17 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '17 -> 22', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 21 WHERE step_number = 16 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '16 -> 21', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 20 WHERE step_number = 15 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '15 -> 20', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 17 WHERE step_number = 14 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '14 -> 17', count(*) FROM u;
WITH u AS (UPDATE journey_step_start SET step_number = 16 WHERE step_number = 13 RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_step_start', 'renumber', '13 -> 16', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 4. RENUMBER journey_checklists.meeting_code  (descending; exact 'step_NN' matches only,
--    so legacy JOURNEY_PHASES codes such as 'PR1m' are left untouched)
-- ---------------------------------------------------------------------------
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_37' WHERE meeting_code = 'step_33' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_33 -> step_37', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_36' WHERE meeting_code = 'step_32' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_32 -> step_36', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_35' WHERE meeting_code = 'step_31' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_31 -> step_35', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_34' WHERE meeting_code = 'step_30' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_30 -> step_34', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_33' WHERE meeting_code = 'step_29' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_29 -> step_33', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_32' WHERE meeting_code = 'step_28' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_28 -> step_32', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_31' WHERE meeting_code = 'step_27' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_27 -> step_31', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_30' WHERE meeting_code = 'step_26' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_26 -> step_30', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_29' WHERE meeting_code = 'step_25' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_25 -> step_29', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_28' WHERE meeting_code = 'step_24' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_24 -> step_28', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_27' WHERE meeting_code = 'step_22' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_22 -> step_27', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_26' WHERE meeting_code = 'step_21' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_21 -> step_26', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_25' WHERE meeting_code = 'step_20' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_20 -> step_25', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_24' WHERE meeting_code = 'step_19' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_19 -> step_24', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_23' WHERE meeting_code = 'step_18' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_18 -> step_23', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_22' WHERE meeting_code = 'step_17' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_17 -> step_22', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_21' WHERE meeting_code = 'step_16' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_16 -> step_21', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_20' WHERE meeting_code = 'step_15' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_15 -> step_20', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_17' WHERE meeting_code = 'step_14' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_14 -> step_17', count(*) FROM u;
WITH u AS (UPDATE journey_checklists SET meeting_code = 'step_16' WHERE meeting_code = 'step_13' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'journey_checklists', 'renumber', 'step_13 -> step_16', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 5. RENUMBER client_meetings.meeting_id  (descending; exact 'step_NN' matches only,
--    so legacy JOURNEY_PHASES codes such as 'PR1m' are left untouched)
-- ---------------------------------------------------------------------------
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_37' WHERE meeting_id = 'step_33' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_33 -> step_37', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_36' WHERE meeting_id = 'step_32' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_32 -> step_36', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_35' WHERE meeting_id = 'step_31' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_31 -> step_35', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_34' WHERE meeting_id = 'step_30' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_30 -> step_34', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_33' WHERE meeting_id = 'step_29' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_29 -> step_33', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_32' WHERE meeting_id = 'step_28' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_28 -> step_32', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_31' WHERE meeting_id = 'step_27' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_27 -> step_31', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_30' WHERE meeting_id = 'step_26' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_26 -> step_30', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_29' WHERE meeting_id = 'step_25' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_25 -> step_29', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_28' WHERE meeting_id = 'step_24' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_24 -> step_28', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_27' WHERE meeting_id = 'step_22' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_22 -> step_27', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_26' WHERE meeting_id = 'step_21' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_21 -> step_26', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_25' WHERE meeting_id = 'step_20' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_20 -> step_25', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_24' WHERE meeting_id = 'step_19' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_19 -> step_24', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_23' WHERE meeting_id = 'step_18' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_18 -> step_23', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_22' WHERE meeting_id = 'step_17' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_17 -> step_22', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_21' WHERE meeting_id = 'step_16' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_16 -> step_21', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_20' WHERE meeting_id = 'step_15' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_15 -> step_20', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_17' WHERE meeting_id = 'step_14' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_14 -> step_17', count(*) FROM u;
WITH u AS (UPDATE client_meetings SET meeting_id = 'step_16' WHERE meeting_id = 'step_13' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_meetings', 'renumber', 'step_13 -> step_16', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 6. RENUMBER client_email_drafts.meeting_id  (descending; exact 'step_NN' matches only,
--    so legacy JOURNEY_PHASES codes such as 'PR1m' are left untouched)
-- ---------------------------------------------------------------------------
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_37' WHERE meeting_id = 'step_33' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_33 -> step_37', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_36' WHERE meeting_id = 'step_32' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_32 -> step_36', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_35' WHERE meeting_id = 'step_31' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_31 -> step_35', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_34' WHERE meeting_id = 'step_30' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_30 -> step_34', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_33' WHERE meeting_id = 'step_29' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_29 -> step_33', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_32' WHERE meeting_id = 'step_28' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_28 -> step_32', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_31' WHERE meeting_id = 'step_27' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_27 -> step_31', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_30' WHERE meeting_id = 'step_26' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_26 -> step_30', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_29' WHERE meeting_id = 'step_25' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_25 -> step_29', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_28' WHERE meeting_id = 'step_24' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_24 -> step_28', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_27' WHERE meeting_id = 'step_22' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_22 -> step_27', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_26' WHERE meeting_id = 'step_21' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_21 -> step_26', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_25' WHERE meeting_id = 'step_20' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_20 -> step_25', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_24' WHERE meeting_id = 'step_19' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_19 -> step_24', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_23' WHERE meeting_id = 'step_18' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_18 -> step_23', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_22' WHERE meeting_id = 'step_17' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_17 -> step_22', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_21' WHERE meeting_id = 'step_16' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_16 -> step_21', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_20' WHERE meeting_id = 'step_15' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_15 -> step_20', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_17' WHERE meeting_id = 'step_14' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_14 -> step_17', count(*) FROM u;
WITH u AS (UPDATE client_email_drafts SET meeting_id = 'step_16' WHERE meeting_id = 'step_13' RETURNING 1)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected) SELECT 'client_email_drafts', 'renumber', 'step_13 -> step_16', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 7. REWORD journey_checklists.task_text  (28 strings)
--    Runs AFTER the meeting_code renumber above, so meeting_code below is the
--    NEW step code. Each rewrite is scoped by (meeting_code, role) so a string
--    used in several steps is only changed where it should be.
--    Verified before generating: no duplicate targets, no ambiguous targets, and
--    no old string that is still valid in the new structure.
-- ---------------------------------------------------------------------------
WITH task_map(meeting_code, role, old_text, new_text) AS (VALUES
  ('step_03', 'sales_pm',
     'Fill Customer Journey Booklet with dates & contact info; staple business card',
     'Fill Your Project Customer Journey Booklet with dates & contact info; staple business card'),
  ('step_04', 'architect',
     'Inform customer about Sewer Survey',
     'Inform Customer about Sewer Survey'),
  ('step_04', 'sales_pm',
     'Present CASK and the team',
     'Present Cask and the team'),
  ('step_05', 'architect',
     'Recap email to Sales PM (12 hr)',
     'Recap email to Client Solution Manager (12 hr)'),
  ('step_06', 'estimator',
     'Send budget update to Sales PM (48 hr before)',
     'Send budget update to Client Solution Manager (48 hr before)'),
  ('step_08', 'architect',
     'Recap email to Sales PM (12 hr)',
     'Recap email to Client Solution Manager (12 hr)'),
  ('step_09', 'architect',
     'Present 1st Design Meeting Plans',
     'Present latest design set of plans (2nd/3rd)'),
  ('step_10', 'architect',
     'Send plans to Estimator (4 days before 2nd design meeting)',
     'Send plans to Estimator for permit set prep'),
  ('step_11', 'estimator',
     'Send budget update to Sales PM (48 hr before)',
     'Send budget update to Client Solution Manager (48 hr before)'),
  ('step_12', 'sales_pm',
     'Schedule next meeting (possible 3rd design, or contract review + permit submission)',
     'Schedule next meeting (possible 3rd design, or contract review + permit submission). If a 3rd design meeting is needed, repeat the same steps as the 2nd design'),
  ('step_16', 'architect',
     'Technical recap email to Sales PM',
     'Technical recap email to Client Solution Manager'),
  ('step_17', 'architect',
     'Energy calc and engineer sign & seal',
     'Energy calc requested'),
  ('step_20', 'permit_dept',
     'Email Sales PM confirming permit submission',
     'Email Client Solution Manager confirming permit submission'),
  ('step_21', 'estimator',
     'Schedule contract review meeting with Sales PM',
     'Schedule contract review meeting with Client Solution Manager'),
  ('step_21', 'estimator',
     'Draft contract and review bid; send for scope revision',
     'Draft contract and review bid; send for scope-revision VA'),
  ('step_22', 'estimator',
     'Send finalized contract to Sales PM',
     'Send finalized contract to Client Solution Manager'),
  ('step_23', 'estimator',
     'Explain contract',
     'Explain Contract'),
  ('step_23', 'estimator',
     'Go through detail comparing Architect Agenda Notes, Drawing and Scope of work',
     'Go through detail comparing Architect Agenda Notes, Drawing and Scope of work.'),
  ('step_26', 'sales_pm',
     'Send recap email with executed contract (or, if unsigned, the decision made in the meeting)',
     'Send recap email with executed contract (or, if unsigned, the decision made in the meeting — separate workflow to follow)'),
  ('step_29', 'estimator',
     'Send email to Sales PM if we are out of price',
     'Send email to Client Solution Manager if we are out of price'),
  ('step_30', 'estimator',
     'Email Sales PM & Selection if modifications exceed $4k',
     'Email Client Solution Manager & Selection if modifications exceed $4k'),
  ('step_30', 'selection_mgr',
     'Email Estimator and Sales PM only if customer chooses items outside the allowance',
     'Email Estimator and Client Solution Manager only if customer chooses items outside the allowance'),
  ('step_32', 'selection_mgr',
     'Email Estimator & Sales PM only if customer chooses items outside the allowance',
     'Email Estimator & Client Solution Manager only if customer chooses items outside the allowance'),
  ('step_34', 'selection_mgr',
     'Email Estimator & Sales PM only if customer chooses items outside the allowance',
     'Email Estimator & Client Solution Manager only if customer chooses items outside the allowance'),
  ('step_35', 'estimator',
     'Send change-order reconciliation allowance to Sales PM',
     'Send change-order reconciliation allowance to Client Solution Manager'),
  ('step_35', 'sales_pm',
     'Send change-order reconciliation allowance to customer for approval',
     'Send change-order reconciliation allowance to Customer for approval'),
  ('step_36', 'selection_mgr',
     'Go through the selection choices from the customer',
     'Go through the Selection choice from the customer'),
  ('step_37', 'sales_pm',
     'Introduce Construction Manager and Superintendent',
     'Introduce CM and Super')
), u AS (
  UPDATE journey_checklists jc
     SET task_text = tm.new_text
    FROM task_map tm
   WHERE jc.meeting_code = tm.meeting_code
     AND jc.role         = tm.role
     AND jc.task_text    = tm.old_text
  RETURNING 1
)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected)
SELECT 'journey_checklists', 'reword task_text', '28 mapped strings', count(*) FROM u;

-- ---------------------------------------------------------------------------
-- 8. CROSS-STEP MOVE - old step 14 estimator bid -> new step 19  (ENABLED)
--
--    Old step 14 ("Permit Prep & Bid") split into new step 17 ("Permit Prep")
--    and new step 19 ("Bid"). The step map sends 14 -> 17, so the estimator's
--    bid task lands on step_17, where the estimator role no longer exists.
--    Its natural new home is step_19 / estimator - a cross-step move the numeric
--    map cannot express, hence this explicit statement. Decision made: carry it
--    over. Nothing else lands on step_19 (old 19 -> new 24), so the slot is empty
--    and this cannot collide. Runs after the section 7 rewordings, none of which
--    touch this row.
--
WITH u AS (
  UPDATE journey_checklists
     SET meeting_code = 'step_19',
         task_text    = 'Send finalized (post-buildability) set out for bid'
   WHERE meeting_code = 'step_17'
     AND role         = 'estimator'
     AND task_text    = 'Send out for bid'
  RETURNING 1
)
INSERT INTO workflow_migration_log_pre37(tbl, op, detail, rows_affected)
SELECT 'journey_checklists', 'cross-step move', 'old 14 estimator bid -> step_19', count(*) FROM u;

--    NOT carried over, deliberately (old step 14 architect):
--      'Send plans to Estimator & Permit Dept'
--    Left to retire. New step 20's similar-sounding 'Send permit set & energy calc
--    to Permit Dept' is the successor to a DIFFERENT old task (old step 15), not
--    this one, so there is no correct new home for it. It will show up in the
--    unmatched report below (8d). Delete it manually if you are happy it is
--    genuinely retired.

-- ---------------------------------------------------------------------------
-- 9. VERIFICATION  (runs inside the transaction, before COMMIT)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE expected_pre37 (meeting_code text, role text, task_text text);
INSERT INTO expected_pre37 (meeting_code, role, task_text) VALUES
  ('step_02', 'architect', 'Create a set of plans for the alignment meeting'),
  ('step_03', 'sales_pm', 'Fill Your Project Customer Journey Booklet with dates & contact info; staple business card'),
  ('step_03', 'sales_pm', 'Print contract template'),
  ('step_03', 'sales_pm', 'Print Contract Alignment Guide'),
  ('step_03', 'sales_pm', 'Prefill timeline / contract price on the Contract Alignment Guide from the internal pass-off'),
  ('step_03', 'architect', 'Prefill the design portion of the Alignment Meeting agenda with info from the internal pass-off'),
  ('step_03', 'architect', 'Print Plans and Architect Guide Agenda'),
  ('step_04', 'sales_pm', 'Present Cask and the team'),
  ('step_04', 'sales_pm', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)'),
  ('step_04', 'sales_pm', 'Timeline'),
  ('step_04', 'sales_pm', 'Schedule next meeting'),
  ('step_04', 'architect', 'Run through the Architect Guide Agenda'),
  ('step_04', 'architect', 'Inform Customer about Sewer Survey'),
  ('step_05', 'sales_pm', 'Send recap email to customer with architect''s portion (24 hr)'),
  ('step_05', 'architect', 'Recap email to Client Solution Manager (12 hr)'),
  ('step_05', 'architect', 'Work on 1st design set of plans'),
  ('step_05', 'architect', 'Send 1st design set to Estimator'),
  ('step_05', 'architect', 'Request sanitary survey'),
  ('step_06', 'sales_pm', 'Review budget update'),
  ('step_06', 'architect', 'Print Plans and Architect Guide Agenda'),
  ('step_06', 'estimator', 'Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)'),
  ('step_06', 'estimator', 'Send budget update to Client Solution Manager (48 hr before)'),
  ('step_07', 'sales_pm', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)'),
  ('step_07', 'sales_pm', 'Timeline'),
  ('step_07', 'sales_pm', 'Schedule flag meeting & 2nd design meeting'),
  ('step_07', 'architect', 'Present Alignment Meeting Plans'),
  ('step_07', 'architect', 'Run through the Architect Guide Agenda'),
  ('step_07', 'estimator', 'Join the meeting if more than 30% over their budget'),
  ('step_07', 'estimator', 'Bring Value Engineering options to align the budget update with the customer''s budget'),
  ('step_08', 'sales_pm', 'Send recap email to customer with architect''s portion (24 hr)'),
  ('step_08', 'architect', 'Recap email to Client Solution Manager (12 hr)'),
  ('step_08', 'architect', 'Work on 2nd design set of plans'),
  ('step_08', 'architect', 'Print Plans and Architect Guide Agenda'),
  ('step_09', 'architect', 'Present latest design set of plans (2nd/3rd)'),
  ('step_09', 'architect', 'Run through the Architect Guide Agenda'),
  ('step_10', 'architect', 'Technical recap email to customer with photos & notes (24 hr)'),
  ('step_10', 'architect', 'Mark up plans with technical info from flag'),
  ('step_10', 'architect', 'Send plans to Estimator for permit set prep'),
  ('step_11', 'sales_pm', 'Review budget update'),
  ('step_11', 'architect', 'Print Plans and Architect Guide Agenda'),
  ('step_11', 'estimator', 'Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)'),
  ('step_11', 'estimator', 'Send budget update to Client Solution Manager (48 hr before)'),
  ('step_12', 'sales_pm', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)'),
  ('step_12', 'sales_pm', 'Timeline'),
  ('step_12', 'sales_pm', 'Schedule next meeting (possible 3rd design, or contract review + permit submission). If a 3rd design meeting is needed, repeat the same steps as the 2nd design'),
  ('step_12', 'architect', 'Drawing questions agenda; present 2nd design set of plans'),
  ('step_12', 'estimator', 'Join the meeting if more than 30% over their budget'),
  ('step_12', 'estimator', 'Bring Value Engineering options to align the budget update with the customer''s budget'),
  ('step_13', 'sales_pm', 'Send recap email to customer with architect''s portion (24 hr)'),
  ('step_13', 'architect', 'Recap email to Client Solution Manager (12 hr)'),
  ('step_13', 'architect', 'Incorporate 2nd design meeting revisions'),
  ('step_14', 'sales_pm', 'Review budget update'),
  ('step_14', 'architect', 'Print Plans and Architect Guide Agenda'),
  ('step_14', 'estimator', 'Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)'),
  ('step_14', 'estimator', 'Send budget update to Client Solution Manager (48 hr before)'),
  ('step_15', 'sales_pm', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)'),
  ('step_15', 'sales_pm', 'Timeline'),
  ('step_15', 'sales_pm', 'Confirm final design; schedule contract review + permit submission'),
  ('step_15', 'architect', 'Drawing questions agenda; present 3rd design set of plans'),
  ('step_15', 'estimator', 'Join the meeting if more than 30% over their budget'),
  ('step_15', 'estimator', 'Bring Value Engineering options to align the budget update with the customer''s budget'),
  ('step_16', 'sales_pm', 'Send recap email to customer with architect''s portion (24 hr)'),
  ('step_16', 'architect', 'Technical recap email to Client Solution Manager'),
  ('step_16', 'architect', 'Prepare permit set of drawings with engineer details (bid-ready)'),
  ('step_17', 'architect', 'Create a 99% set of plans'),
  ('step_17', 'architect', 'Energy calc requested'),
  ('step_17', 'permit_dept', 'Draft permit application'),
  ('step_18', 'architect', 'Send permit set of plans to Construction PM'),
  ('step_18', 'architect', 'Make modifications from Construction PM red marks'),
  ('step_18', 'architect', 'Finalize the set that goes out for estimate and permit'),
  ('step_18', 'construction_pm', 'Red-mark the permit set of plans for buildability'),
  ('step_18', 'construction_pm', 'Return marked-up plans to Architect'),
  ('step_19', 'estimator', 'Send finalized (post-buildability) set out for bid'),
  ('step_20', 'sales_pm', 'Email customer that plans are in for permit'),
  ('step_20', 'architect', 'Send permit set & energy calc to Permit Dept'),
  ('step_20', 'permit_dept', 'Submit for permit'),
  ('step_20', 'permit_dept', 'Email Client Solution Manager confirming permit submission'),
  ('step_21', 'architect', 'Create 3D walkthrough with included selections'),
  ('step_21', 'estimator', 'Draft contract and review bid; send for scope-revision VA'),
  ('step_21', 'estimator', 'Schedule contract review meeting with Client Solution Manager'),
  ('step_21', 'permit_dept', 'Check permit status'),
  ('step_21', 'permit_dept', 'Send RFC to Architect, Sales & Estimator'),
  ('step_21', 'permit_dept', 'Resubmit for permit (own the resubmission turnaround)'),
  ('step_21', 'permit_dept', 'Receive permit approval'),
  ('step_22', 'estimator', 'Finalize contract'),
  ('step_22', 'estimator', 'Send finalized contract to Client Solution Manager'),
  ('step_23', 'sales_pm', 'Review contract with Estimator'),
  ('step_23', 'estimator', 'Explain Contract'),
  ('step_23', 'estimator', 'Go through detail comparing Architect Agenda Notes, Drawing and Scope of work.'),
  ('step_24', 'sales_pm', 'Call client to confirm price alignment ahead of execution'),
  ('step_25', 'sales_pm', 'Review Alignment Guide'),
  ('step_25', 'sales_pm', 'Review boilerplate'),
  ('step_25', 'sales_pm', 'Review scope'),
  ('step_25', 'sales_pm', 'Sign contract'),
  ('step_25', 'sales_pm', 'Discuss timeline & schedule tentative kick-off (~6 weeks out)'),
  ('step_25', 'sales_pm', 'Schedule selection meeting'),
  ('step_25', 'sales_pm', 'If they don''t sign, schedule a signature meeting'),
  ('step_26', 'sales_pm', 'Send recap email with executed contract (or, if unsigned, the decision made in the meeting — separate workflow to follow)'),
  ('step_27', 'estimator', 'Meet with Selection Manager to decide needed selections and allowances (e.g., $3.50/sqft for tile)'),
  ('step_27', 'selection_mgr', 'Update the selection template with the necessary items'),
  ('step_28', 'architect', 'Assist with walkthrough and any plan markups (set rules for when modifications carry a cost implication)'),
  ('step_28', 'selection_mgr', 'Run selection meeting'),
  ('step_28', 'selection_mgr', 'Schedule next meeting'),
  ('step_29', 'architect', 'Send red markups to Construction Manager for any needed change orders'),
  ('step_29', 'estimator', 'Send email to Client Solution Manager if we are out of price'),
  ('step_29', 'selection_mgr', 'Send recap email to customer'),
  ('step_30', 'sales_pm', 'Contact homeowner if selections and contract price are misaligned'),
  ('step_30', 'estimator', 'Work on change order'),
  ('step_30', 'estimator', 'Email Client Solution Manager & Selection if modifications exceed $4k'),
  ('step_30', 'estimator', 'Request sub card, create PO, organize field pass-off, reconcile change-order allowances before breaking ground'),
  ('step_30', 'selection_mgr', 'Email Estimator and Client Solution Manager only if customer chooses items outside the allowance'),
  ('step_31', 'selection_mgr', 'Run selection meeting'),
  ('step_31', 'selection_mgr', 'Schedule next meeting'),
  ('step_32', 'selection_mgr', 'Send recap email to customer'),
  ('step_32', 'selection_mgr', 'Email Estimator & Client Solution Manager only if customer chooses items outside the allowance'),
  ('step_33', 'selection_mgr', 'Run selection meeting'),
  ('step_33', 'selection_mgr', 'Schedule next meeting'),
  ('step_34', 'selection_mgr', 'Send recap email to customer'),
  ('step_34', 'selection_mgr', 'Email Estimator & Client Solution Manager only if customer chooses items outside the allowance'),
  ('step_35', 'sales_pm', 'Send change-order reconciliation allowance to Customer for approval'),
  ('step_35', 'estimator', 'Send change-order reconciliation allowance to Client Solution Manager'),
  ('step_35', 'estimator', 'Internal CM-to-Super pass-off'),
  ('step_36', 'sales_pm', 'Present customer info and purpose statement'),
  ('step_36', 'estimator', 'Run the meeting to hand off scope of work and contract info to the Construction PM'),
  ('step_36', 'selection_mgr', 'Go through the Selection choice from the customer'),
  ('step_36', 'construction_pm', 'Learn as much as possible about the project'),
  ('step_37', 'sales_pm', 'Introduce CM and Super'),
  ('step_37', 'construction_pm', 'Take over and run the agenda');

-- ---------------------------------------------------------------------------
-- 8a-8g COMBINED INTO ONE RESULT SET
--   Supabase's SQL Editor only renders the result of the LAST statement in a run,
--   so all seven checks are folded into the single SELECT below and tagged with a
--   report_name column. Each check's query is unchanged - it just lives in a CTE
--   now instead of being its own statement. Rows come back grouped in 8a..8g
--   order; sort or filter on report_name in the editor to isolate one check.
--
--   Column legend (columns a report does not use are NULL):
--     seq         8a = workflow_migration_log_pre37.seq;
--                 8e/8f = display-order index only; NULL elsewhere
--     tbl_or_code 8a/8b/8e/8f = tbl | 8d = meeting_code | 8g = meeting_code
--     op_or_role  8a/8b = op | 8d = role
--     detail      8a = detail | 8d = task_text
--     num_1       8a = rows_affected | 8b = sum(rows_affected)
--                 8c = unmatched_checklist_rows | 8d = n
--                 8e = before_rows | 8f = min(step_number)
--     num_2       8e = after_rows | 8f = max(step_number)
--     num_3       8f = count(*)
-- ---------------------------------------------------------------------------
WITH
-- 8a. per-statement row counts
r8a AS (
  SELECT seq, tbl, op, detail, rows_affected FROM workflow_migration_log_pre37 ORDER BY seq
),

-- 8b. totals per table
r8b AS (
  SELECT tbl, op, sum(rows_affected) AS rows_affected
    FROM workflow_migration_log_pre37 GROUP BY tbl, op ORDER BY tbl, op
),

-- 8c. HEADLINE CHECK - journey_checklists rows that match no current
--     (meeting_code, role, task_text) in the new 37-step structure. Target: 0.
r8c AS (
  SELECT count(*) AS unmatched_checklist_rows
    FROM journey_checklists jc
   WHERE NOT EXISTS (
           SELECT 1 FROM expected_pre37 e
            WHERE e.meeting_code = jc.meeting_code
              AND e.role         = jc.role
              AND e.task_text    = jc.task_text)
),

-- 8d. detail of any unmatched rows, so they can be judged individually
r8d AS (
  SELECT jc.meeting_code, jc.role, jc.task_text, count(*) AS n
    FROM journey_checklists jc
   WHERE NOT EXISTS (
           SELECT 1 FROM expected_pre37 e
            WHERE e.meeting_code = jc.meeting_code
              AND e.role         = jc.role
              AND e.task_text    = jc.task_text)
   GROUP BY 1, 2, 3
   ORDER BY 1, 2, 3
),

-- 8e. before/after row totals (must be equal except for the step-23 deletions)
--     'ord' is presentation only - it preserves the original top-to-bottom order.
r8e AS (
  SELECT 1 AS ord, 'journey_checklists' AS tbl,
         (SELECT count(*) FROM journey_checklists_backup_pre37) AS before_rows,
         (SELECT count(*) FROM journey_checklists)              AS after_rows
  UNION ALL SELECT 2, 'workflow_step_completions',
         (SELECT count(*) FROM workflow_step_completions_backup_pre37),
         (SELECT count(*) FROM workflow_step_completions)
  UNION ALL SELECT 3, 'journey_step_start',
         (SELECT count(*) FROM journey_step_start_backup_pre37),
         (SELECT count(*) FROM journey_step_start)
  UNION ALL SELECT 4, 'client_meetings',
         (SELECT count(*) FROM client_meetings_backup_pre37),
         (SELECT count(*) FROM client_meetings)
  UNION ALL SELECT 5, 'client_email_drafts',
         (SELECT count(*) FROM client_email_drafts_backup_pre37),
         (SELECT count(*) FROM client_email_drafts)
),

-- 8f. step_number ranges must now sit inside 1..37 with no value at 23 unless it
--     arrived there from old step 18
--     'ord' is presentation only - it preserves the original top-to-bottom order.
r8f AS (
  SELECT 1 AS ord, 'workflow_step_completions' AS tbl, min(step_number) AS min_step, max(step_number) AS max_step, count(*) AS n FROM workflow_step_completions
  UNION ALL
  SELECT 2, 'journey_step_start', min(step_number), max(step_number), count(*) FROM journey_step_start
),

-- 8g. any leftover step codes outside step_01..step_37 (excluding legacy codes)
r8g AS (
  SELECT DISTINCT meeting_code FROM journey_checklists
   WHERE meeting_code LIKE 'step_%'
     AND meeting_code NOT IN ('step_01', 'step_02', 'step_03', 'step_04', 'step_05', 'step_06', 'step_07', 'step_08', 'step_09', 'step_10', 'step_11', 'step_12', 'step_13', 'step_14', 'step_15', 'step_16', 'step_17', 'step_18', 'step_19', 'step_20', 'step_21', 'step_22', 'step_23', 'step_24', 'step_25', 'step_26', 'step_27', 'step_28', 'step_29', 'step_30', 'step_31', 'step_32', 'step_33', 'step_34', 'step_35', 'step_36', 'step_37')
   ORDER BY 1
)
SELECT report_name, seq, tbl_or_code, op_or_role, detail, num_1, num_2, num_3
FROM (
  SELECT '8a. per-statement row counts'::text AS report_name,
         1                       AS report_order,
         seq::bigint             AS seq,
         tbl::text               AS tbl_or_code,
         op::text                AS op_or_role,
         detail::text            AS detail,
         rows_affected::bigint   AS num_1,
         NULL::bigint            AS num_2,
         NULL::bigint            AS num_3
    FROM r8a
  UNION ALL
  SELECT '8b. totals per table', 2,
         NULL, tbl, op, NULL, rows_affected::bigint, NULL, NULL
    FROM r8b
  UNION ALL
  SELECT '8c. unmatched checklist rows (target 0)', 3,
         NULL, NULL, NULL, NULL, unmatched_checklist_rows::bigint, NULL, NULL
    FROM r8c
  UNION ALL
  SELECT '8d. unmatched row detail', 4,
         NULL, r8d.meeting_code, r8d.role, r8d.task_text, r8d.n::bigint, NULL, NULL
    FROM r8d
  UNION ALL
  SELECT '8e. before/after row totals', 5,
         ord::bigint, tbl, NULL, NULL, before_rows::bigint, after_rows::bigint, NULL
    FROM r8e
  UNION ALL
  SELECT '8f. step_number min/max/count', 6,
         ord::bigint, tbl, NULL, NULL, min_step::bigint, max_step::bigint, n::bigint
    FROM r8f
  UNION ALL
  SELECT '8g. leftover step codes outside step_01..step_37', 7,
         NULL, meeting_code, NULL, NULL, NULL, NULL, NULL
    FROM r8g
) combined
ORDER BY report_order, seq, tbl_or_code, op_or_role, detail;

-- ---------------------------------------------------------------------------
-- Review the combined 8a-8g result above (one row set, grouped by report_name).
-- If 8c is 0 (or only shows rows you accept losing),
-- COMMIT. Otherwise change this to ROLLBACK and re-check.
-- ---------------------------------------------------------------------------
COMMIT;
-- ROLLBACK;   -- <- swap for the line above to dry-run
