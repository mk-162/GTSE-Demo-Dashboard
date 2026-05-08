import "server-only";
import type { DataLayer } from "./contracts";

let _impl: DataLayer | null = null;

export async function getData(): Promise<DataLayer> {
  if (_impl) return _impl;
  const choice = process.env.DATA_SOURCE === "postgres" ? "postgres" : "memory";
  if (choice === "memory") {
    _impl = (await import("./impl/memory")).default;
  } else if (process.env.NEXT_RUNTIME === "edge") {
    _impl = (await import("./impl/postgres-edge")).default;
  } else {
    _impl = (await import("./impl/postgres-node")).default;
  }
  return _impl;
}
