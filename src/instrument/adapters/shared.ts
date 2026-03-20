import { createRequire } from "node:module";
import { getRequestContext } from "../hooks/context.js";
import { normalizeSQL, type NormalizedOp } from "./normalize.js";
import { isThenable, getErrorMessage } from "../../utils/type-guards.js";
import { brakitDebug } from "../../utils/log.js";
import type { TelemetryEvent } from "../../types/index.js";
import type { LibraryModule, QueryPatchConfig } from "./types.js";

const appRequire = createRequire(process.cwd() + "/index.js");

export function tryRequire(id: string): unknown {
  try {
    return appRequire(id);
  } catch {
    return null;
  }
}

/**
 * Capture the current request ID eagerly before async DB operations.
 * Driver internals can break AsyncLocalStorage propagation.
 */
export function getActiveRequestId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

/**
 * Safely retrieve the prototype of a named class from a library module.
 * Handles both default and named exports.
 */
export function getPrototype<T>(
  lib: LibraryModule,
  className: string,
): T | null {
  const defaultExport = lib.default as Record<string, unknown> | undefined;
  const cls = defaultExport?.[className] ?? lib[className];
  if (!cls || typeof cls !== "function") return null;
  return (cls as { prototype?: T }).prototype ?? null;
}

/**
 * Builds a query telemetry event from the common fields.
 */
function buildQueryEvent(
  config: QueryPatchConfig,
  sql: string | undefined,
  op: NormalizedOp,
  table: string,
  start: number,
  requestId: string | null,
  rowCount?: number,
): TelemetryEvent {
  return {
    type: "query",
    data: {
      driver: config.driver as "pg" | "mysql2" | "prisma" | "asyncpg" | "sqlalchemy" | "sdk",
      source: config.driver,
      sql,
      normalizedOp: op,
      table,
      durationMs: Math.round(performance.now() - start),
      rowCount: rowCount ?? undefined,
      parentRequestId: requestId,
      timestamp: Date.now(),
    },
  };
}

/**
 * Wraps a database query method to emit telemetry events.
 * Handles callback-based, promise-based, and optionally EventEmitter-based patterns.
 */
export function wrapQueryMethod(
  original: (...args: unknown[]) => unknown,
  emit: (event: TelemetryEvent) => void,
  config: QueryPatchConfig,
): (...args: unknown[]) => unknown {
  return function (this: unknown, ...args: unknown[]) {
    const sql = config.extractSql(args);
    const start = performance.now();
    const requestId = getActiveRequestId();
    const { op, table } = normalizeSQL(sql ?? "");

    const emitQuery = (result?: unknown) => {
      const rowCount = config.extractRowCount?.(result);
      emit(buildQueryEvent(config, sql, op, table, start, requestId, rowCount));
    };

    // Callback-based
    const lastIdx = args.length - 1;
    if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
      const originalCallback = args[lastIdx] as (...cbArgs: unknown[]) => unknown;
      args[lastIdx] = function (this: unknown, ...callbackArgs: unknown[]) {
        emitQuery(callbackArgs[1]);
        return originalCallback.apply(this, callbackArgs);
      };
      return original.apply(this, args);
    }

    const result = original.apply(this, args);

    // Promise-based
    if (isThenable(result)) {
      return (result as Promise<unknown>).then((res) => {
        try {
          emitQuery(res);
        } catch (e) {
          brakitDebug(`query telemetry: ${getErrorMessage(e)}`);
        }
        return res;
      });
    }

    // EventEmitter-based
    if (config.supportsEventEmitter && result && typeof (result as { on?: unknown }).on === "function") {
      (result as { on(event: string, fn: (res: unknown) => void): void }).on("end", (res) => emitQuery(res));
      return result;
    }

    return result;
  };
}
