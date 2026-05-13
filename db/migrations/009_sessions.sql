-- Session storage for HubSpot OAuth auth (M5).
--
-- app.sessions — one row per active sign-in. The session id is a random
-- 32-byte hex string stored as the `whale_session` cookie value; the
-- middleware looks up the row on every page request to confirm the user
-- is still allowed. Expires after 30 days; cleanup is in
-- app.fn_retention_cleanup() (8th migration).
--
-- app.auth_audit — immutable log of sign-in / sign-out / sign-in-rejected
-- events. Useful for "who looked at this dashboard last Tuesday" and for
-- spotting failed sign-in attempts from non-GTSE HubSpot accounts (the
-- hub_id check rejects those — see app/api/auth/hubspot/callback).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app.sessions (
  id              text        PRIMARY KEY,
  hub_user_id     text        NOT NULL,
  hub_user_email  text        NOT NULL,
  hub_user_name   text,
  hub_id          bigint      NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON app.sessions (hub_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON app.sessions (expires_at);

CREATE TABLE IF NOT EXISTS app.auth_audit (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event           text        NOT NULL,
  hub_user_id     text,
  hub_user_email  text,
  hub_id          bigint,
  reason          text,
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON app.auth_audit (created_at DESC);

-- Extend retention cleanup to prune expired sessions + old audit log
-- rows. Keep audit log for 365 days (compliance / investigation), drop
-- expired sessions immediately.
--
-- DROP first: Postgres won't let CREATE OR REPLACE FUNCTION change a
-- function's RETURN TABLE shape (the previous version returned 2 cols,
-- this one returns 4). DROP + CREATE is the only path.
DROP FUNCTION IF EXISTS app.fn_retention_cleanup() CASCADE;

CREATE OR REPLACE FUNCTION app.fn_retention_cleanup()
RETURNS TABLE(
  ingestion_runs_deleted bigint,
  api_access_log_deleted bigint,
  expired_sessions_deleted bigint,
  auth_audit_deleted bigint
) AS $$
DECLARE
  d1 bigint;
  d2 bigint;
  d3 bigint;
  d4 bigint;
BEGIN
  DELETE FROM app.ingestion_runs WHERE started_at < now() - interval '90 days';
  GET DIAGNOSTICS d1 = ROW_COUNT;

  DELETE FROM app.api_access_log WHERE logged_at < now() - interval '90 days';
  GET DIAGNOSTICS d2 = ROW_COUNT;

  DELETE FROM app.sessions WHERE expires_at < now();
  GET DIAGNOSTICS d3 = ROW_COUNT;

  DELETE FROM app.auth_audit WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS d4 = ROW_COUNT;

  RETURN QUERY SELECT d1, d2, d3, d4;
END;
$$ LANGUAGE plpgsql;
