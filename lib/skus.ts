// Real GTSE SKU catalogue. Re-exported here so app/ and components/ don't
// reach into lib/mock-data/* (after M5, the canonical source moves to a
// staging.sku Postgres view; this re-export becomes a thin pass-through).
export { SKUS, SKU_BY_CODE, type Sku } from "@/lib/mock-data/skus";
