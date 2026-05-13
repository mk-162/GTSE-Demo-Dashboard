-- staging.customer.owner_name was returning empty strings for
-- companies whose `hubspot_owner_id` is set to "" in HubSpot (data
-- quality issue — 5,839 UK records). Also dropping the fallback to
-- showing the raw numeric owner_id when the owner is no longer in
-- staging.owner (archived/deleted user): a number is more confusing
-- than no name at all. UI shows "—" for NULL.

CREATE OR REPLACE VIEW staging.customer AS
WITH base AS (
  SELECT
    c.hs_object_id,
    c.payload,
    CASE
      WHEN c.payload->>'country' IN ('United States', 'USA', 'US') THEN 'US'
      ELSE 'UK'
    END AS region_code
  FROM (
    SELECT DISTINCT ON (hs_object_id) *
    FROM raw_hubspot.companies
    ORDER BY hs_object_id, hs_lastmodified DESC
  ) c
)
SELECT
  ('co_' || lower(b.region_code) || '_' || b.hs_object_id::text) AS id,
  b.hs_object_id                                       AS hs_company_id,
  NULLIF(b.payload->>'netsuite_customer_id', '')::bigint AS ns_customer_id,
  b.payload->>'name'                                   AS name,
  b.region_code                                        AS region,
  NULLIF(b.payload->>'industry', '')                   AS industry,
  NULLIF(b.payload->>'state', '')                      AS region_subdiv,
  -- NULL out empty-string owner IDs (~5,800 UK records have this).
  NULLIF(b.payload->>'hubspot_owner_id', '')           AS owner_id,
  (b.payload->>'createdate')::timestamptz              AS created_at,
  (b.payload->>'hs_lastmodifieddate')::timestamptz     AS updated_at,
  -- Just the resolved full name. NULL if owner_id is empty or the
  -- owner has been deleted/archived from HubSpot. The dashboard
  -- renders NULL as "—".
  o.full_name                                          AS owner_name
FROM base b
LEFT JOIN staging.owner o ON o.owner_id = NULLIF(b.payload->>'hubspot_owner_id', '');
