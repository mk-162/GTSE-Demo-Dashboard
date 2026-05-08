import "server-only";
import type { DataLayer } from "../contracts";

function notImplemented(method: string): never {
  throw new Error(
    `lib/data/impl/postgres-edge.ts: ${method}() not implemented yet. ` +
      "This stub is filled in during Milestone 5. Set DATA_SOURCE=memory until then.",
  );
}

const impl: DataLayer = {
  async filterCompanies() { return notImplemented("filterCompanies"); },
  async topNByLtmRevenue() { return notImplemented("topNByLtmRevenue"); },
  async companyById() { return notImplemented("companyById"); },
  async companyByName() { return notImplemented("companyByName"); },
  async companiesByRegion() { return notImplemented("companiesByRegion"); },
  async kpisByRegion() { return notImplemented("kpisByRegion"); },
  async segmentsByRegion() { return notImplemented("segmentsByRegion"); },
  async insightsByRegion() { return notImplemented("insightsByRegion"); },
  async insightOf() { return notImplemented("insightOf"); },
  async ordersForCompany() { return notImplemented("ordersForCompany"); },
  async fieldRanges() { return notImplemented("fieldRanges"); },
  async distinctOwners() { return notImplemented("distinctOwners"); },
  async nameToIdMap() { return notImplemented("nameToIdMap"); },
  async lapsedByRegion() { return notImplemented("lapsedByRegion"); },
  async intentBackByRegion() { return notImplemented("intentBackByRegion"); },
};

export default impl;
