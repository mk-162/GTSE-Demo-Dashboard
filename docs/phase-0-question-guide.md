# Project Whale Phase 0 Question Guide

This guide explains the Phase 0 discovery questions in plain English. Use it with the HubSpot export owner, the NetSuite administrator, and whoever understands the current NetSuite-to-HubSpot export.

The goal is not to design anything new in this meeting. The goal is to confirm where the data lives, how systems join together, what credentials are available, and whether anything blocks the first live-data build.

## How To Use This Document

For each question, capture four things:

- Answer: the direct answer from the system owner.
- Evidence: screenshot, API sample, record ID, property name, SuiteQL result, or admin setting.
- Impact: whether the build can proceed as planned.
- Follow-up: any remediation required before Milestone 2 starts.

If the answer is unknown, write "unknown" and assign an owner. Do not guess. Guessing here creates bad joins, duplicate customers, missing orders, or broken ingestion later.

## Output File

The final Phase 0 findings should be saved as:

```text
C:\AI_Project\GTSE\phase-0-findings.md
```

Recommended structure:

```markdown
# Project Whale Phase 0 Findings

## Summary
- Go / No-go:
- Open blockers:
- Auth path selected:
- Join keys confirmed:

## HubSpot Findings
...

## NetSuite Findings
...

## Cross-Source Join Findings
...

## Credentials And Access
...
```

## HubSpot Questions

### 1. Are sales orders HubSpot Deals, an Orders object, or a custom object? What pipeline and stage means "shipped"?

What this means:

Project Whale needs to know where completed customer orders appear in HubSpot. In many HubSpot setups, sales orders are represented as Deals. In others, they may live in a custom object or an ecommerce/order object. The dashboard cannot calculate revenue, reorder cadence, lapsed customers, or customer history until this is clear.

Why it matters:

The ingestion code needs to pull the correct object. The warehouse also needs to know which records count as real orders and which are quotes, open opportunities, tests, returns, or cancelled orders.

Who can answer:

HubSpot admin, CRM owner, or whoever owns the NetSuite-to-HubSpot export.

Evidence to collect:

- Object name: Deal, Order, or custom object name.
- Pipeline name.
- Stage name or stage ID that means shipped / completed / closed-won.
- One example record URL in HubSpot.
- The same order visible in NetSuite, if possible.

Good answer:

"Sales orders are HubSpot Deals in the Sales Pipeline. Stage `closedwon` means shipped. NetSuite order 12345 maps to HubSpot Deal 98765."

Warning answer:

"Orders are sometimes Deals and sometimes a custom object."

What to do if warning:

Document both paths. The build should use the source that is most complete and closest to actual shipped orders.

Blocker:

No one can identify where shipped orders live.

### 2. Are line items associated to deals with SKU codes that match NetSuite item codes?

What this means:

A sales order must have line items, and each line item needs a SKU or item code. That code should match the item code in NetSuite.

Why it matters:

This is how Project Whale connects customer buying behavior to actual products. It powers cross-sell opportunities, reorder predictions, SKU-level sales velocity, and later inventory planning.

Who can answer:

HubSpot admin, NetSuite admin, export owner, or ecommerce/operations person who understands SKU conventions.

Evidence to collect:

- One HubSpot Deal with line items.
- The HubSpot line item SKU property name.
- The matching NetSuite item record and item code.
- Five sample SKUs checked both ways.

Good answer:

"HubSpot line item property `hs_sku` matches NetSuite item `itemid`. We checked five SKUs and all matched."

Warning answer:

"HubSpot line items have product names, but not SKU codes."

What to do if warning:

Add SKU to the export before relying on SKU-level marts.

Blocker:

No stable SKU or item code exists on HubSpot line items.

### 3. Where does region, UK or US, live on Company?

What this means:

The dashboard separates UK and US customers. We need to know whether that region is stored directly as a HubSpot Company property or derived from another field like billing country.

Why it matters:

Every page, KPI, and AI answer is region-aware. Bad region logic means customers show in the wrong reports.

Who can answer:

HubSpot admin or CRM owner.

Evidence to collect:

- Property name if region is explicit.
- If derived, the source property, such as `country`, `billing_country`, or `ip_country`.
- Sample UK company and sample US company.
- List of possible values.

Good answer:

"Company property `region` is populated as `UK` or `US` for all active customers."

Acceptable answer:

"There is no region property, but `country` is reliable. United States maps to US; everything else in this scope maps to UK."

Warning answer:

"Country is free text with values like UK, United Kingdom, GB, England, USA, US."

What to do if warning:

Create a normalization map in staging SQL and document every mapped value.

### 4. Is industry populated, and what taxonomy does it use?

What this means:

Industry is the classification used for segmentation and cross-sell patterns. The question is whether it exists, how complete it is, and whether values follow a controlled list.

Why it matters:

Industry appears in account tables, filters, AI context, and opportunity analysis. If it is messy or mostly empty, those features become weaker.

Who can answer:

HubSpot admin, CRM owner, or marketing operations.

Evidence to collect:

- Property name.
- Completion percentage across active companies.
- Example values.
- Whether it is HubSpot standard, GTSE custom, SIC, NAICS, or free text.

Good answer:

"Company property `industry` is a controlled GTSE list and is populated for 90%+ of active customers."

Warning answer:

"Industry is free text and only 30% populated."

What to do if warning:

Keep industry as optional. Do not block the build, but do not over-trust industry-based recommendations.

### 5. Is `hs_lastmodifieddate` reliable for incremental cursoring?

What this means:

Incremental cursoring means each nightly import only pulls records changed since the last successful run. `hs_lastmodifieddate` is the likely timestamp used for that.

Why it matters:

If the timestamp is reliable, ingestion is fast and cheap. If not, the job may miss updates or require full reloads.

Who can answer:

HubSpot admin or export owner.

Evidence to collect:

- Confirm `hs_lastmodifieddate` changes when relevant fields change.
- Confirm it changes when associations or line items change, if applicable.
- One recently changed company, deal, and line item.

Good answer:

"Yes. `hs_lastmodifieddate` updates when record properties change. Associations are handled separately."

Warning answer:

"It updates for company fields, but not always when line items or associations change."

What to do if warning:

Use object-specific cursors and separately refresh association tables. Consider periodic full association refresh.

### 6. Is there a Company property that holds the NetSuite customer ID?

What this means:

The warehouse needs a join key between HubSpot Companies and NetSuite Customers. Ideally HubSpot Company has a property containing the NetSuite customer internal ID or external ID.

Why it matters:

Without this key, Project Whale cannot reliably join CRM activity to ledger orders, inventory, and customer records.

Who can answer:

HubSpot admin, NetSuite admin, or export owner.

Evidence to collect:

- HubSpot property name.
- Whether it stores NetSuite internal ID, entity ID, customer number, or external ID.
- Completion percentage for active companies.
- Five sample companies checked in both systems.

Good answer:

"HubSpot Company property `netsuite_customer_id` stores NetSuite Customer internal ID and is populated for 98% of active customers."

Warning answer:

"The field stores a customer code, not internal ID."

What to do if warning:

That may still work, but NetSuite queries must select the matching field and staging must join on that field.

Blocker:

No shared key exists and names are the only possible match. Name matching is not acceptable for cutover without manual review.

### 7. What is the engagement object volume?

What this means:

Engagements are emails, calls, meetings, notes, and similar activity records. We need an approximate count.

Why it matters:

If there are more than about 500,000 records, pulling them in one job may be too slow or hit API limits. The import may need to split by engagement type or date range.

Who can answer:

HubSpot admin or operations person with reporting/API access.

Evidence to collect:

- Total count of engagements.
- Counts by type, if available.
- Date range of engagement history.
- Whether old engagement history is needed for Phase 1.

Good answer:

"There are 180,000 engagements total. Pulling all with cursoring is fine."

Warning answer:

"There are 1.2 million engagements."

What to do if warning:

Split by object type and/or only backfill the last 24 months for Phase 1.

### 8. Is the HubSpot Sensitive Data flag off?

What this means:

HubSpot has a Sensitive Data setting that can restrict access to engagement data via API. If enabled, engagement reads may return 403 Forbidden.

Why it matters:

Project Whale does not need email bodies, but it may need engagement metadata such as dates, types, counts, and activity recency. If API access is blocked, engagement-based signals may be reduced.

Who can answer:

HubSpot super admin.

Evidence to collect:

- Screenshot or confirmation from HubSpot account settings.
- Test API call result for engagements.

Good answer:

"Sensitive Data is off, and engagement metadata can be read."

Warning answer:

"Sensitive Data is on."

What to do if warning:

Ask whether it can be disabled. If not, proceed without engagement-derived signals and document the gap.

### 9. What HubSpot tier is the account on, Pro or Enterprise?

What this means:

HubSpot tier affects API limits, available objects, custom objects, and some reporting capabilities.

Why it matters:

The ingestion plan needs realistic rate limits and object access assumptions.

Who can answer:

HubSpot admin or billing owner.

Evidence to collect:

- HubSpot hub and tier, for example Sales Hub Pro, Marketing Hub Enterprise, Operations Hub Pro.
- Any API add-ons or custom object access.

Good answer:

"Sales Hub Enterprise and Operations Hub Pro. API limits are sufficient."

Warning answer:

"Starter tier with limited object/API access."

What to do if warning:

Check whether the required CRM objects and associations are accessible before continuing.

## NetSuite Questions

### 1. Which auth method should we use: OAuth 2.0 or TBA?

What this means:

The integration needs a secure way to call NetSuite REST/SuiteQL APIs. OAuth 2.0 Client Credentials is preferred for new integrations. TBA, also called Token-Based Authentication, is the fallback if OAuth 2.0 is not available in the account.

Why it matters:

This decides what credentials are generated and what code is written in `lib/ingest/netsuite-client.ts`.

Who can answer:

NetSuite administrator or SuiteCloud integration owner.

Evidence to collect:

- Whether OAuth 2.0 Client Credentials / M2M is enabled and available.
- Whether TBA is enabled.
- Which path the admin approves for Phase 1.

Good answer:

"Use OAuth 2.0 Client Credentials. We can create the integration record and upload the certificate."

Acceptable fallback:

"OAuth 2.0 is not available yet. Use TBA for Phase 1 and plan migration later."

Blocker:

Neither OAuth 2.0 nor TBA can be enabled for REST Web Services.

### 2. Are REST Web Services and the selected auth feature enabled?

What this means:

SuiteQL over REST requires NetSuite REST Web Services. The chosen auth method must also be enabled.

Why it matters:

Without these account-level features, the API calls will fail regardless of code quality.

Who can answer:

NetSuite administrator.

Evidence to collect:

- Screenshot or written confirmation from Setup -> Company -> Enable Features -> SuiteCloud.
- Confirmation of REST Web Services.
- Confirmation of OAuth 2.0 or Token-Based Authentication.

Good answer:

"REST Web Services and OAuth 2.0 are enabled."

Warning answer:

"REST Web Services is enabled, but OAuth 2.0 is not."

What to do if warning:

Use TBA only if Token-Based Authentication is enabled.

### 3. For OAuth 2.0, has the integration record, certificate, and private key been set up?

What this means:

OAuth 2.0 Client Credentials uses a signed JWT. The private key stays with the app. The public certificate is uploaded to NetSuite. NetSuite uses that certificate to trust the JWT.

Why it matters:

The build agent cannot complete OAuth 2.0 without the client ID, certificate ID, account ID, and private key.

Who can answer:

NetSuite administrator and whoever manages secrets.

Evidence to collect:

- NetSuite account ID.
- Client ID.
- Certificate ID.
- Private key stored securely and available as Vercel env var.
- JWT algorithm confirmed, usually RS256 or PS256.

Good answer:

"Integration record exists. Public cert uploaded. We have Account ID, Client ID, Cert ID, and private key ready for Vercel."

Warning answer:

"We created the integration but do not know where the private key is."

What to do if warning:

Regenerate the key pair and store the private key securely.

### 4. For TBA, have the five values been generated?

What this means:

TBA requires five credential values: Account ID, Consumer Key, Consumer Secret, Token ID, and Token Secret.

Why it matters:

Without all five, the request signature cannot be generated.

Who can answer:

NetSuite administrator.

Evidence to collect:

- Account ID.
- Consumer Key.
- Consumer Secret.
- Token ID.
- Token Secret.
- Role/permissions assigned to the token.

Good answer:

"All five values are generated, stored in 1Password, and can be set as Vercel env vars."

Warning answer:

"We have Consumer Key/Secret but not Token ID/Secret."

What to do if warning:

Generate an Access Token for the correct user/role.

### 5. What is the NetSuite rate limit or concurrency limit?

What this means:

NetSuite limits concurrent API requests. Standard accounts often have lower concurrency than accounts with SuiteCloud Plus.

Why it matters:

The ingestion jobs should avoid sending too many requests at once. If limits are low, the code should run sequentially or with very small concurrency.

Who can answer:

NetSuite administrator or account owner.

Evidence to collect:

- Account concurrency limit.
- Whether SuiteCloud Plus is enabled.
- Any integration-specific limits.

Good answer:

"Standard tier, 5 concurrent requests. Keep ingestion sequential."

Warning answer:

"Unknown."

What to do if warning:

Assume low concurrency. Build sequentially first.

### 6. Are sales orders, items, and inventory snapshots queryable via SuiteQL?

What this means:

SuiteQL is the SQL-like query API NetSuite exposes. We need to confirm the objects required by Project Whale can be queried from the REST endpoint.

Why it matters:

The NetSuite ingestion design depends on SuiteQL. If an object is not queryable, the plan needs a different endpoint or a changed scope.

Who can answer:

NetSuite admin, SuiteAnalytics owner, or developer familiar with NetSuite schema.

Evidence to collect:

- Successful `SELECT` query for customers.
- Successful `SELECT` query for items.
- Successful `SELECT` query for sales orders.
- Successful `SELECT` query for purchase orders/vendors, if in scope.
- Successful inventory-level query.

Good answer:

"We ran SuiteQL queries for customer, item, transaction/sales order, vendor, purchase order, and inventory location data."

Warning answer:

"Sales orders are queryable, but inventory is not obvious."

What to do if warning:

Keep customer/order ingestion moving, but assign inventory schema discovery before building the inventory mart.

### 7. Where do per-location inventory levels live?

What this means:

Inventory can be held at multiple locations. We need the table or view that shows item, location, quantity on hand, and quantity available.

Why it matters:

This powers stock visibility, shipment planning, and later reorder support.

Who can answer:

NetSuite administrator, operations manager, or inventory/reporting owner.

Evidence to collect:

- Table/view names.
- Fields for item ID, location ID, quantity on hand, quantity available.
- One sample item checked against the NetSuite UI.

Good answer:

"Use `inventoryItemLocations`, joined to item/location. It has item, location, quantity on hand, and quantity available."

Warning answer:

"Inventory is tracked in bins or lots and needs additional joins."

What to do if warning:

Document the extra joins. Keep the Phase 1 inventory mart simple unless bin/lot detail is required.

### 8. How are archived or inactive records flagged?

What this means:

NetSuite records may remain in the system after they are inactive, archived, or no longer sellable. We need to know the flag field.

Why it matters:

Inactive customers, vendors, and SKUs should usually be excluded from active planning and dashboard recommendations.

Who can answer:

NetSuite administrator.

Evidence to collect:

- Field name, often `isInactive` or similar.
- Values used, such as T/F, true/false, Yes/No.
- Sample inactive customer and inactive item.

Good answer:

"Customers and items have `isInactive`; T means inactive."

Warning answer:

"Some inactive states are represented by status fields instead."

What to do if warning:

Document status values and map active/inactive in staging SQL.

## Cross-Source Join Questions

### 1. Confirm the HubSpot Company to NetSuite Customer join key.

What this means:

This confirms the exact field that links one HubSpot Company to one NetSuite Customer.

Why it matters:

This is the most important data-quality question in the project. If this join is wrong, the dashboard may attach the wrong orders, revenue, inventory behavior, and recommendations to the wrong customer.

Who can answer:

HubSpot admin, NetSuite admin, export owner.

Evidence to collect:

- HubSpot Company property name.
- NetSuite Customer field name.
- Whether the value is internal ID, entity ID, external ID, or customer code.
- Count of active HubSpot companies with the field populated.
- Five manually verified examples.

Good answer:

"HubSpot Company `netsuite_customer_id` equals NetSuite Customer internal ID. It is populated for 97% of active customers."

Warning answer:

"The field is populated for only 70% of companies."

What to do if warning:

Ask the export owner to backfill the missing key before cutover. Do not rely on fuzzy name matching for production.

### 2. Confirm the HubSpot Line Item to NetSuite Item join key.

What this means:

This confirms the exact field that links a HubSpot line item to a NetSuite item/SKU.

Why it matters:

This powers product-level reporting, reorder behavior, inventory status, and future shipment planning.

Who can answer:

HubSpot admin, NetSuite admin, operations/product owner.

Evidence to collect:

- HubSpot line item field, such as SKU.
- NetSuite item field, such as `itemid`.
- Five known SKU examples.
- Confirmation that kits, bundles, variants, and discontinued SKUs are handled.

Good answer:

"HubSpot line item `hs_sku` equals NetSuite item `itemid`. We checked five active SKUs and they match."

Warning answer:

"Some Shopify/BigCommerce SKUs differ from NetSuite item codes."

What to do if warning:

Document the mismatch. If common, add a SKU mapping table before trusting SKU-level reporting.

## Credentials And Environment Variables

### HubSpot Private App Token

Needed scopes:

- companies.read
- deals.read
- line_items.read
- contacts.read
- engagements.read

What to confirm:

- The token exists.
- It is stored securely.
- It is set as `HUBSPOT_PRIVATE_APP_TOKEN` in Vercel.
- It can read one company, one deal, one line item, one contact, and one engagement.

### NetSuite Auth Credentials

If OAuth 2.0 is selected, set:

- `NETSUITE_ACCOUNT_ID`
- `NETSUITE_CLIENT_ID`
- `NETSUITE_CERT_ID`
- `NETSUITE_PRIVATE_KEY`

If TBA is selected, set:

- `NETSUITE_ACCOUNT_ID`
- `NETSUITE_CONSUMER_KEY`
- `NETSUITE_CONSUMER_SECRET`
- `NETSUITE_TOKEN_ID`
- `NETSUITE_TOKEN_SECRET`

What to confirm:

- Credentials are stored securely.
- Credentials are set in Vercel.
- A test SuiteQL query succeeds.

## Go / No-Go Guide

### Green: Proceed

Proceed to implementation when:

- Sales orders and line items are clearly identified in HubSpot.
- HubSpot Company has a reliable NetSuite customer join key.
- HubSpot line items have SKUs that match NetSuite item codes.
- HubSpot token is generated and works.
- NetSuite REST Web Services are enabled.
- One NetSuite auth path is selected and credentials are ready.
- SuiteQL can query customers, items, sales orders, and inventory.

### Yellow: Proceed With Scope Reduction

Proceed carefully when:

- Engagements are blocked or too large, but orders/customer data is good.
- Industry is incomplete.
- Inventory requires extra schema discovery.
- Some inactive/status flags need mapping.

In this case, build customer/order/revenue reporting first and document reduced confidence areas.

### Red: Do Not Start Milestone 2

Stop before database ingestion if:

- No one can identify where shipped orders live.
- There is no reliable HubSpot Company to NetSuite Customer key.
- NetSuite REST Web Services cannot be enabled.
- No NetSuite auth path can be provided.
- HubSpot token cannot access required objects.

## Suggested Interview Script

Start with this:

"We are not asking for a new data model today. We are confirming how the existing export works so the dashboard can read the same source of truth. For each question, we need the field name or setting, one example record, and whether the answer is reliable enough for production."

Then ask:

1. "Show us one shipped order in HubSpot and the matching record in NetSuite."
2. "Show us the line items on that order and the matching NetSuite item codes."
3. "Show us the HubSpot Company field that links to the NetSuite Customer."
4. "Show us one UK and one US company and how region is determined."
5. "Show us the NetSuite feature settings and selected auth path."
6. "Run or confirm one SuiteQL query for customers, items, sales orders, and inventory."

If those six demonstrations work, the project is likely safe to start.

