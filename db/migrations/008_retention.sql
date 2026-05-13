-- Retention cleanup. Folded into the transform cron (master plan §10.3
-- item 8) — no separate cron entry.
--
-- Phase 1 (HubSpot-only) cron count: 3 — ingest-hubspot, transform
-- (calls this), insights. (Was 4 when NetSuite was in scope.)
--
-- DPIA / data-retention rationale:
--   - app.ingestion_runs       — operational telemetry; 90 days is plenty
--                                for debugging, no value retaining longer.
--   - app.api_access_log       — audit log; 90 days satisfies typical
--                                breach-investigation windows. Lengthen to
--                                365 days later if compliance asks.
--   - raw_hubspot.engagements  — NOT pruned here. Engagements are PII-
--                                sensitive but the body/attachments are
--                                stripped at ingestion (PII minimisation
--                                per master plan §10.3 item 5). Headers
--                                + timestamps are useful indefinitely.
--
-- The NetSuite inventory snapshots cleanup was removed when Phase 1 scope
-- was reduced to HubSpot-only (2026-05-13).
-- ► Restoration plan + original SQL: docs/netsuite-deferred.md

CREATE OR REPLACE FUNCTION app.fn_retention_cleanup()
RETURNS TABLE(
  ingestion_runs_deleted bigint,
  api_access_log_deleted bigint
) AS $$
DECLARE
  d1 bigint;
  d2 bigint;
BEGIN
  DELETE FROM app.ingestion_runs WHERE started_at < now() - interval '90 days';
  GET DIAGNOSTICS d1 = ROW_COUNT;

  DELETE FROM app.api_access_log WHERE logged_at < now() - interval '90 days';
  GET DIAGNOSTICS d2 = ROW_COUNT;

  RETURN QUERY SELECT d1, d2;
END;
$$ LANGUAGE plpgsql;
