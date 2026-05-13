-- INTENTIONALLY EMPTY.
--
-- Phase 1 scope was simplified to HubSpot-only on 2026-05-13. NetSuite is
-- now a Phase 2 concern. To preserve the migration sequence (the runner
-- expects 001..NNN in order, with no gaps), this file stays in place as a
-- no-op rather than being deleted.
--
-- ► Full restoration plan, including the original SQL inlined for paste-back:
--   docs/netsuite-deferred.md
--
-- Git history of this file also has the prior contents.

SELECT 1; -- no-op so the runner records the migration as applied
