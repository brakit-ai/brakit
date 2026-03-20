import type { BrakitAdapter } from "../adapter.js";
import { tryRequire, getPrototype, wrapQueryMethod } from "./shared.js";
import type { LibraryModule, QueryPatchConfig } from "./types.js";

type MySql2Method = "query" | "execute";
const PATCHED_METHODS: MySql2Method[] = ["query", "execute"];

const originals = new Map<string, (...args: unknown[]) => unknown>();
let proto: Record<string, unknown> | null = null;

const mysql2Config: QueryPatchConfig = {
  driver: "mysql2",
  extractSql: (args) => (typeof args[0] === "string" ? args[0] : undefined),
};

export const mysql2Adapter: BrakitAdapter = {
  name: "mysql2",

  detect() {
    return tryRequire("mysql2") !== null;
  },

  /** Monkeypatches mysql2's Connection prototype to intercept database queries and emit telemetry events. */
  patch(emit) {
    const mysql2 = tryRequire("mysql2") as LibraryModule | null;
    if (!mysql2) return;
    proto = getPrototype<Record<string, unknown>>(mysql2, "Connection");
    if (!proto) return;

    for (const method of PATCHED_METHODS) {
      const orig = proto[method];
      if (typeof orig !== "function") continue;
      originals.set(method, orig as (...args: unknown[]) => unknown);
      proto[method] = wrapQueryMethod(orig as (...args: unknown[]) => unknown, emit, mysql2Config);
    }
  },

  unpatch() {
    if (proto) {
      for (const [method, orig] of originals) {
        proto[method] = orig;
      }
      originals.clear();
      proto = null;
    }
  },
};
