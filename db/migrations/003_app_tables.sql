-- App-internal bookkeeping: cron run history, incremental cursors, the
-- dashboard insight cache, and the API access audit log.

CREATE TABLE IF NOT EXISTS app.ingestion_runs (
  run_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,             -- 'hubspot' | 'netsuite' | 'transform' | 'insights'
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL,             -- 'running' | 'success' | 'failed'
  rows_ingested int,
  errors        jsonb
);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source_started
  ON app.ingestion_runs (source, started_at DESC);

CREATE TABLE IF NOT EXISTS app.ingestion_cursors (
  source       text NOT NULL,              -- 'hubspot' | 'netsuite'
  object_type  text NOT NULL,              -- 'companies' | 'deals' | 'line_items' | etc.
  cursor_value timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, object_type)
);

CREATE TABLE IF NOT EXISTS app.dashboard_insights (
  insight_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type   text NOT NULL,
  region         text NOT NULL,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  body_markdown  text NOT NULL,
  data_snapshot  jsonb NOT NULL,
  prompt_version text NOT NULL,
  model          text NOT NULL,
  cost_usd       numeric(10,4)
);
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_lookup
  ON app.dashboard_insights (insight_type, region, generated_at DESC);

CREATE TABLE IF NOT EXISTS app.api_access_log (
  id           bigserial PRIMARY KEY,
  logged_at    timestamptz NOT NULL DEFAULT now(),
  route        text NOT NULL,
  token_prefix text,                       -- first 8 chars of the token, never the full value
  ip           inet,
  user_agent   text,
  status       int
);
CREATE INDEX IF NOT EXISTS idx_api_access_log_logged
  ON app.api_access_log (logged_at DESC);
