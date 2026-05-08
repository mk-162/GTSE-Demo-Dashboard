import { describe, it, expect } from "vitest";
import memoryImpl from "./impl/memory";
import postgresNodeImpl from "./impl/postgres-node";
import postgresEdgeImpl from "./impl/postgres-edge";
import type { DataLayer, InsightType } from "./contracts";

// memoryImpl always runs. The postgres impls are added when
// TEST_DATABASE_URL is set — point it at a Neon dev branch with a
// populated marts schema to validate the postgres impls against the
// same contract that memoryImpl already passes.
//
// The postgres impls are imported unconditionally (so the bundle stays
// stable) but only exercised when TEST_DATABASE_URL is present.
// Without the env var, postgres-pool / neon-http would throw on first
// query; importing them is safe because both clients lazy-init.
const impls: { name: string; impl: DataLayer }[] = [
  { name: "memory", impl: memoryImpl },
];

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL_UNPOOLED ?? process.env.TEST_DATABASE_URL;
  impls.push({ name: "postgres-node", impl: postgresNodeImpl });
  impls.push({ name: "postgres-edge", impl: postgresEdgeImpl });
}

const INSIGHT_TYPES: InsightType[] = [
  "kpi_summary",
  "whale_attention",
  "lapsed_priorities",
  "reorder_urgency",
  "cross_segment_surprise",
  "monthly_narrative",
  "health_movers",
  "cross_sell_opportunities",
];

for (const { name, impl } of impls) {
  describe(`DataLayer contract — ${name}`, () => {
    it("filterCompanies returns Company[] with expected shape", async () => {
      const rows = await impl.filterCompanies({
        region: "UK",
        industries: [],
        sizeBands: [],
        rfmSegments: [],
        healthBands: [],
        owners: [],
      });
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      const sample = rows[0];
      expect(sample).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        region: expect.stringMatching(/^(UK|US)$/),
        ltmRevenue: expect.any(Number),
        lapseRatio: expect.any(Number),
        healthBand: expect.stringMatching(/^(green|amber|red)$/),
      });
    });

    it("filterCompanies respects ranges", async () => {
      const rows = await impl.filterCompanies({
        region: "UK",
        industries: [],
        sizeBands: [],
        rfmSegments: [],
        healthBands: [],
        owners: [],
        lapseRatio: { min: 1.5, max: 10 },
      });
      expect(rows.every((c) => c.lapseRatio >= 1.5 && c.lapseRatio <= 10)).toBe(true);
    });

    it("filterCompanies respects categorical filters", async () => {
      const rows = await impl.filterCompanies({
        region: "UK",
        industries: [],
        sizeBands: [],
        rfmSegments: [],
        healthBands: ["red"],
        owners: [],
      });
      expect(rows.every((c) => c.healthBand === "red")).toBe(true);
    });

    it("topNByLtmRevenue returns at most n, sorted desc by ltmRevenue", async () => {
      const rows = await impl.topNByLtmRevenue("UK", 5);
      expect(rows.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1].ltmRevenue).toBeGreaterThanOrEqual(rows[i].ltmRevenue);
      }
    });

    it("companyById finds a known company", async () => {
      const all = await impl.topNByLtmRevenue("UK", 1);
      const found = await impl.companyById(all[0].id);
      expect(found?.id).toBe(all[0].id);
    });

    it("companyById returns undefined for unknown id", async () => {
      const found = await impl.companyById("co_nonexistent_99999");
      expect(found).toBeUndefined();
    });

    it("companyByName finds a known company case-insensitively", async () => {
      const all = await impl.topNByLtmRevenue("UK", 1);
      const found = await impl.companyByName(all[0].name.toLowerCase());
      expect(found?.id).toBe(all[0].id);
    });

    it("companiesByRegion returns the full region list", async () => {
      const ukAll = await impl.companiesByRegion("UK");
      expect(ukAll.length).toBeGreaterThan(100);
      expect(ukAll.every((c) => c.region === "UK")).toBe(true);
    });

    it("kpisByRegion returns expected shape", async () => {
      const k = await impl.kpisByRegion("UK");
      expect(k).toMatchObject({
        region: "UK",
        totalCustomers: expect.any(Number),
        aov: expect.any(Number),
      });
      expect(k.ltvDistribution.p50).toEqual(expect.any(Number));
      expect(Array.isArray(k.monthlyTrend)).toBe(true);
    });

    it("segmentsByRegion returns array with counts and definitions", async () => {
      const segs = await impl.segmentsByRegion("UK");
      expect(Array.isArray(segs)).toBe(true);
      expect(segs.every((s) => s.region === "UK")).toBe(true);
      expect((segs.find((s) => s.segment === "Whales")?.count ?? 0)).toBeGreaterThan(0);
    });

    it("insightsByRegion + insightOf return matching types", async () => {
      const all = await impl.insightsByRegion("UK");
      expect(all.length).toBeGreaterThan(0);
      expect(all.every((i) => i.region === "UK")).toBe(true);

      for (const type of INSIGHT_TYPES) {
        const ins = await impl.insightOf("UK", type);
        if (ins) {
          expect(ins.insightType).toBe(type);
          expect(ins.region).toBe("UK");
          expect(typeof ins.bodyMarkdown).toBe("string");
        }
      }
    });

    it("ordersForCompany returns Order[] with line items", async () => {
      const top = await impl.topNByLtmRevenue("UK", 1);
      const orders = await impl.ordersForCompany(top[0].id);
      expect(Array.isArray(orders)).toBe(true);
      if (orders.length > 0) {
        const o = orders[0];
        expect(o).toMatchObject({
          id: expect.any(String),
          companyId: top[0].id,
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          total: expect.any(Number),
        });
        expect(Array.isArray(o.lineItems)).toBe(true);
      }
    });

    it("ordersForCompany returns [] for unknown company", async () => {
      const orders = await impl.ordersForCompany("co_nonexistent_99999");
      expect(orders).toEqual([]);
    });

    it("fieldRanges returns a range per known key", async () => {
      const r = await impl.fieldRanges("UK");
      const required = [
        "lifetimeRevenue",
        "ltmRevenue",
        "l90dRevenue",
        "lapseRatio",
        "healthScore",
        "lifetimeOrders",
      ];
      for (const k of required) {
        expect(r[k]).toMatchObject({
          min: expect.any(Number),
          max: expect.any(Number),
          step: expect.any(Number),
        });
      }
    });

    it("distinctOwners returns deduped sorted strings", async () => {
      const owners = await impl.distinctOwners("UK");
      expect(Array.isArray(owners)).toBe(true);
      expect(owners.length).toBeGreaterThan(0);
      const sorted = [...owners].sort();
      expect(owners).toEqual(sorted);
      expect(new Set(owners).size).toBe(owners.length);
    });

    it("nameToIdMap returns a record where keys point to valid company ids", async () => {
      const map = await impl.nameToIdMap("UK");
      const keys = Object.keys(map);
      expect(keys.length).toBeGreaterThan(0);
      const sample = await impl.companyById(map[keys[0]]);
      expect(sample?.name.toLowerCase()).toBe(keys[0]);
    });

    it("lapsedByRegion returns lapsed companies (>=1.5x cadence)", async () => {
      const rows = await impl.lapsedByRegion("UK", 5);
      expect(rows.length).toBeLessThanOrEqual(5);
      expect(rows.every((c) => c.lapseRatio >= 1.5)).toBe(true);
    });

    it("intentBackByRegion returns lapsed-with-intent companies", async () => {
      const rows = await impl.intentBackByRegion("UK", 5);
      expect(rows.length).toBeLessThanOrEqual(5);
      expect(rows.every((c) => c.buyerIntentActive)).toBe(true);
    });
  });
}
