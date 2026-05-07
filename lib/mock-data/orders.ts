// Deterministic synthetic order history per company. Used by the account detail
// page and any "drill into one account" view. Built lazily — we don't pre-generate
// orders for all 8,000 companies, only for the ones we view.

import { createRng, intBetween, gaussian, type Rng } from "./rng";
import { SKUS, SKU_BY_CODE, type Sku } from "./skus";
import type { Company } from "./companies";

export type OrderLine = {
  skuCode: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  companyId: string;
  date: string; // ISO yyyy-mm-dd
  total: number;
  lineItems: OrderLine[];
};

function seedFromCompanyId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWeightedSku(rng: Rng, biased: string[], all: Sku[]): Sku {
  // 75% chance to pick from this account's biased list, 25% from full catalogue.
  if (biased.length > 0 && rng() < 0.75) {
    const code = biased[Math.floor(rng() * biased.length)];
    const sku = SKU_BY_CODE[code];
    if (sku) return sku;
  }
  return all[Math.floor(rng() * all.length)];
}

/**
 * Generate the order history for a single company. Output is fully deterministic
 * given the company id (different companies produce different histories; the same
 * company always produces the same history).
 *
 * Strategy:
 *   - Place lifetimeOrders orders, spaced roughly by personalCadenceDays from
 *     firstOrderDate up to lastOrderDate. Add small jitter so dates feel real.
 *   - Each order has 1–4 line items; prefer the company's top reorder SKUs
 *     plus their cross-sell SKUs as a smaller share.
 *   - Aggregate revenue should land within ~10% of company.lifetimeRevenue.
 */
export function generateOrdersFor(company: Company): Order[] {
  if (company.lifetimeOrders <= 0) return [];

  const rng = createRng(seedFromCompanyId(company.id));
  const cadence = company.personalCadenceDays ?? 90;
  const first = new Date(company.firstOrderDate);
  const last = new Date(company.lastOrderDate);
  const totalDays = Math.max(1, Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
  const orderCount = company.lifetimeOrders;

  // Cap at a sensible visualisation limit; keep last N if exceeded.
  const cap = Math.min(orderCount, 60);
  const skipFront = Math.max(0, orderCount - cap);

  const dates: Date[] = [];
  for (let i = 0; i < orderCount; i++) {
    const t = orderCount === 1 ? 0 : i / (orderCount - 1);
    const baseTs = first.getTime() + t * totalDays * 86_400_000;
    const jitter = gaussian(rng, 0, cadence * 0.15) * 86_400_000;
    dates.push(new Date(baseTs + jitter));
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  // Force first/last to actual extremes
  dates[0] = first;
  dates[dates.length - 1] = last;

  const biased = [...company.top3ReorderSkus, ...company.top3CrossSellSkus];
  const expectedAvgOrder = Math.max(50, company.lifetimeRevenue / orderCount);

  const orders: Order[] = [];
  for (let i = skipFront; i < orderCount; i++) {
    const orderDate = dates[i];
    // 1–4 lines, weighted to 2
    const linesCount = Math.max(1, Math.min(4, Math.round(gaussian(rng, 2, 0.9))));
    const lines: OrderLine[] = [];
    let orderTotal = 0;

    for (let j = 0; j < linesCount; j++) {
      const sku = pickWeightedSku(rng, biased, SKUS);
      // Quantity: scale roughly so order value ~ expectedAvgOrder
      const qtyTarget = Math.max(1, Math.round((expectedAvgOrder / linesCount) / Math.max(1, sku.unitPrice)));
      const qty = Math.max(1, Math.round(qtyTarget * (0.6 + rng() * 0.8)));
      const lineTotal = Math.round(qty * sku.unitPrice * 100) / 100;
      lines.push({
        skuCode: sku.code,
        skuName: sku.name,
        qty,
        unitPrice: sku.unitPrice,
        lineTotal,
      });
      orderTotal += lineTotal;
    }

    orders.push({
      id: `${company.id}_o${String(i + 1).padStart(3, "0")}`,
      companyId: company.id,
      date: orderDate.toISOString().slice(0, 10),
      total: Math.round(orderTotal * 100) / 100,
      lineItems: lines,
    });
  }

  return orders;
}

/** Roll up per-month revenue from a list of orders for charting. */
export function ordersByMonth(orders: Order[]): { month: string; revenue: number; orderCount: number }[] {
  const buckets = new Map<string, { revenue: number; orderCount: number }>();
  for (const o of orders) {
    const key = o.date.slice(0, 7); // yyyy-mm
    const cur = buckets.get(key) ?? { revenue: 0, orderCount: 0 };
    cur.revenue += o.total;
    cur.orderCount += 1;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, agg]) => ({
      month,
      revenue: Math.round(agg.revenue),
      orderCount: agg.orderCount,
    }));
}

/** Top-N SKUs by spend across an order list. */
export function topSkus(orders: Order[], n = 10): { sku: Sku; spend: number; qty: number; orders: number }[] {
  const map = new Map<string, { spend: number; qty: number; orders: number }>();
  for (const o of orders) {
    const seenInOrder = new Set<string>();
    for (const line of o.lineItems) {
      const cur = map.get(line.skuCode) ?? { spend: 0, qty: 0, orders: 0 };
      cur.spend += line.lineTotal;
      cur.qty += line.qty;
      if (!seenInOrder.has(line.skuCode)) {
        cur.orders += 1;
        seenInOrder.add(line.skuCode);
      }
      map.set(line.skuCode, cur);
    }
  }
  return Array.from(map.entries())
    .map(([code, agg]) => ({ sku: SKU_BY_CODE[code]!, ...agg }))
    .filter((row) => row.sku)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, n);
}

// Suppress unused warning
void intBetween;
