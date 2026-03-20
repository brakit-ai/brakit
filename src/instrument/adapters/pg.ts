import type { BrakitAdapter } from "../adapter.js";
import { tryRequire, getPrototype, wrapQueryMethod } from "./shared.js";
import type { LibraryModule, PgQueryConfig, QueryPatchConfig } from "./types.js";

let origQuery: ((...args: unknown[]) => unknown) | null = null;
let proto: Record<string, unknown> | null = null;

const pgConfig: QueryPatchConfig = {
  driver: "pg",
  extractSql: (args) => {
    const q = args[0];
    if (typeof q === "string") return q;
    if (typeof q === "object" && q !== null && "text" in q) return (q as PgQueryConfig).text;
    return undefined;
  },
  extractRowCount: (result) => (result as { rowCount?: number })?.rowCount,
  supportsEventEmitter: true,
};

export const pgAdapter: BrakitAdapter = {
  name: "pg",

  detect() {
    return tryRequire("pg") !== null;
  },

  /** Monkeypatches pg's Client prototype to intercept database queries and emit telemetry events. */
  patch(emit) {
    const pg = tryRequire("pg") as LibraryModule | null;
    if (!pg) return;
    proto = getPrototype<Record<string, unknown>>(pg, "Client");
    if (!proto?.query) return;

    origQuery = proto.query as (...args: unknown[]) => unknown;
    proto.query = wrapQueryMethod(origQuery, emit, pgConfig);
  },

  unpatch() {
    if (proto && origQuery) {
      proto.query = origQuery;
      origQuery = null;
      proto = null;
    }
  },
};
