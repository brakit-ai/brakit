import type { BrakitAdapter } from "../adapter.js";
import type { TelemetryEvent } from "../../types/index.js";
import { tryRequire, captureRequestId } from "./shared.js";
import { normalizeSQL } from "./normalize.js";

const originals = new Map<string, (...args: unknown[]) => unknown>();
let proto: Record<string, unknown> | null = null;

export const mysql2Adapter: BrakitAdapter = {
  name: "mysql2",

  detect() {
    return tryRequire("mysql2") !== null;
  },

  patch(emit) {
    const mysql2 = tryRequire("mysql2") as Record<string, unknown> | null;
    if (!mysql2) return;
    proto =
      (mysql2 as { Connection?: { prototype: Record<string, unknown> } })
        .Connection?.prototype ?? null;
    if (!proto) return;

    for (const method of ["query", "execute"] as const) {
      const orig = proto[method];
      if (typeof orig !== "function") continue;
      originals.set(method, orig as (...args: unknown[]) => unknown);

      proto[method] = function (...args: unknown[]) {
        const first = args[0];
        const sql = typeof first === "string" ? first : undefined;
        const start = performance.now();
        const requestId = captureRequestId();
        const { op, table } = normalizeSQL(sql ?? "");

        const emitQuery = () => {
          emit({
            type: "query",
            data: {
              driver: "mysql2",
              source: "mysql2",
              sql,
              normalizedOp: op,
              table,
              durationMs: Math.round(performance.now() - start),
              parentRequestId: requestId,
              timestamp: Date.now(),
            },
          });
        };

        // Callback-based
        const lastIdx = args.length - 1;
        if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
          const origCb = args[lastIdx] as (...cbArgs: unknown[]) => unknown;
          args[lastIdx] = function (this: unknown) {
            emitQuery();
            return origCb.apply(this, arguments as unknown as unknown[]);
          };
          return (orig as (...a: unknown[]) => unknown).apply(this, args);
        }

        const result = (orig as (...a: unknown[]) => unknown).apply(this, args);

        // Promise-based
        if (result && typeof (result as { then?: unknown }).then === "function") {
          return (result as Promise<unknown>).then((res) => {
            emitQuery();
            return res;
          });
        }

        return result;
      };
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
