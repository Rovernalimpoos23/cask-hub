-- ============================================================================
-- ROLLBACK for 37-step-renumber.sql
-- File: src/db/migrations/37-step-renumber-rollback.sql
--
-- Restores all five tables from the *_backup_pre37 full-table snapshots taken by
-- the migration. Only valid while those backup tables still exist and nothing
-- else has written to these tables since the migration ran.
--
-- NOTE: this also reverts the application-visible workflow state, so run it only
-- alongside reverting src/lib/workflow-steps.ts to the 33-step version (HEAD~1
-- of commit 75ccc37). Code and data must match.
--
-- DELETE + INSERT is used rather than TRUNCATE so foreign keys are respected.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_step_completions_backup_pre37') THEN
    RAISE EXCEPTION 'ABORT: workflow_step_completions_backup_pre37 is missing - cannot roll back.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journey_step_start_backup_pre37') THEN
    RAISE EXCEPTION 'ABORT: journey_step_start_backup_pre37 is missing - cannot roll back.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journey_checklists_backup_pre37') THEN
    RAISE EXCEPTION 'ABORT: journey_checklists_backup_pre37 is missing - cannot roll back.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_meetings_backup_pre37') THEN
    RAISE EXCEPTION 'ABORT: client_meetings_backup_pre37 is missing - cannot roll back.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_email_drafts_backup_pre37') THEN
    RAISE EXCEPTION 'ABORT: client_email_drafts_backup_pre37 is missing - cannot roll back.';
  END IF;
END $$;

DELETE FROM workflow_step_completions;
INSERT INTO workflow_step_completions SELECT * FROM workflow_step_completions_backup_pre37;

DELETE FROM journey_step_start;
INSERT INTO journey_step_start SELECT * FROM journey_step_start_backup_pre37;

DELETE FROM journey_checklists;
INSERT INTO journey_checklists SELECT * FROM journey_checklists_backup_pre37;

DELETE FROM client_meetings;
INSERT INTO client_meetings SELECT * FROM client_meetings_backup_pre37;

DELETE FROM client_email_drafts;
INSERT INTO client_email_drafts SELECT * FROM client_email_drafts_backup_pre37;

-- confirm restored counts match the snapshots
SELECT 'workflow_step_completions' AS tbl, (SELECT count(*) FROM workflow_step_completions) AS restored, (SELECT count(*) FROM workflow_step_completions_backup_pre37) AS snapshot
UNION ALL SELECT 'journey_step_start',        (SELECT count(*) FROM journey_step_start),        (SELECT count(*) FROM journey_step_start_backup_pre37)
UNION ALL SELECT 'journey_checklists',        (SELECT count(*) FROM journey_checklists),        (SELECT count(*) FROM journey_checklists_backup_pre37)
UNION ALL SELECT 'client_meetings',           (SELECT count(*) FROM client_meetings),           (SELECT count(*) FROM client_meetings_backup_pre37)
UNION ALL SELECT 'client_email_drafts',       (SELECT count(*) FROM client_email_drafts),       (SELECT count(*) FROM client_email_drafts_backup_pre37);

COMMIT;
-- ROLLBACK;   -- <- swap for the line above to dry-run

-- Once you are satisfied the rollback (or the migration) is final, drop the
-- snapshots and the log:
--   DROP TABLE workflow_step_completions_backup_pre37;
--   DROP TABLE journey_step_start_backup_pre37;
--   DROP TABLE journey_checklists_backup_pre37;
--   DROP TABLE client_meetings_backup_pre37;
--   DROP TABLE client_email_drafts_backup_pre37;
--   DROP TABLE workflow_migration_log_pre37;
