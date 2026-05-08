-- pgcrypto provides gen_random_uuid(), used by app.dashboard_insights and
-- app.ingestion_runs for primary keys. Neon enables it by default on most
-- projects; IF NOT EXISTS makes this idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS raw_hubspot;
CREATE SCHEMA IF NOT EXISTS raw_netsuite;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS marts;
CREATE SCHEMA IF NOT EXISTS app;
