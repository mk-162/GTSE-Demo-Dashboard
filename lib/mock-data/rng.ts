// Deterministic seeded PRNG (mulberry32). Same seed -> same sequence every render.
export function createRng(seed: number) {
  let s = seed >>> 0;
  return function rng(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickWeighted<T>(rng: Rng, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.value;
  }
  return items[items.length - 1].value;
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function floatBetween(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function gaussian(rng: Rng, mean: number, stdDev: number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// Pareto-like distribution useful for revenue
export function paretoRevenue(rng: Rng, min: number, max: number, alpha: number): number {
  const u = Math.max(1 - rng(), 1e-9);
  const v = min / Math.pow(u, 1 / alpha);
  return Math.min(v, max);
}
