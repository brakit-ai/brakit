import type { BrakitAdapter } from "../adapter.js";
import { tryRequire, captureRequestId } from "./shared.js";
import { normalizeSQL } from "./normalize.js";

let origQuery: ((...args: unknown[]) => unknown) | null = null;
let proto: Record<string, unknown> | null = null;

export const pgAdapter: BrakitAdapter = {
  name: "pg",

  detect() {
    return tryRequire("pg") !== null;
  },

  patch(emit) {
    const pg = tryRequire("pg") as Record<string, unknown> | null;
    if (!pg) return;
    const Client = (pg.default as Record<string, unknown>)?.Client ?? pg.Client;
    if (!Client || typeof Client !== "function") return;
    proto =
      (Client as { prototype?: Record<string, unknown> }).prototype ?? null;
    if (!proto?.query) return;

    origQuery = proto.query as (...args: unknown[]) => unknown;
    const saved = origQuery;

    proto.query = function (...args: unknown[]) {
      const first = args[0];
      const sql =
        typeof first === "string"
          ? first
          : typeof first === "object" && first !== null && "text" in first
            ? (first as { text: string }).text
            : undefined;
      const start = performance.now();
      const requestId = captureRequestId();
      const { op, table } = normalizeSQL(sql ?? "");

      const emitQuery = (rowCount?: number) => {
        emit({
          type: "query",
          data: {
            driver: "pg",
            source: "pg",
            sql,
            normalizedOp: op,
            table,
            durationMs: Math.round(performance.now() - start),
            rowCount: rowCount ?? undefined,
            parentRequestId: requestId,
            timestamp: Date.now(),
          },
        });
      };

      // Callback-based
      const lastIdx = args.length - 1;
      if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
        const origCb = args[lastIdx] as (...cbArgs: unknown[]) => unknown;
        args[lastIdx] = function (
          this: unknown,
          err: unknown,
          res: { rowCount?: number } | undefined,
        ) {
          emitQuery(res?.rowCount ?? undefined);
          return origCb.call(this, err, res);
        };
        return saved.apply(this, args);
      }

      const result = saved.apply(this, args);

      // Promise-based
      if (result && typeof (result as { then?: unknown }).then === "function") {
        return (result as Promise<{ rowCount?: number }>).then((res) => {
          emitQuery(res?.rowCount ?? undefined);
          return res;
        });
      }

      // EventEmitter-based
      if (result && typeof (result as { on?: unknown }).on === "function") {
        (
          result as {
            on: (
              event: string,
              fn: (res: { rowCount?: number }) => void,
            ) => void;
          }
        ).on("end", (res) => emitQuery(res?.rowCount ?? undefined));
        return result;
      }

      return result;
    };
  },

  unpatch() {
    if (proto && origQuery) {
      proto.query = origQuery;
      origQuery = null;
      proto = null;
    }
  },
};
