/** Monkey-patch database drivers (pg, mysql2, Prisma) to capture query telemetry. */
import { createRequire } from "node:module";
import { send } from "../transport.js";
import { getRequestContext } from "./context.js";

// Resolve modules from the target app's node_modules, not brakit's.
// The preload runs inside the app process, but import() resolves relative
// to brakit's dist/ directory. createRequire uses the app's CWD instead.
const appRequire = createRequire(process.cwd() + "/index.js");

function tryRequire(id: string): unknown {
  try {
    return appRequire(id);
  } catch {
    return null;
  }
}

function sendQuery(data: {
  driver: string;
  sql?: string;
  model?: string;
  operation?: string;
  durationMs: number;
  rowCount?: number;
}): void {
  const ctx = getRequestContext();
  send({
    type: "query",
    data: {
      ...data,
      durationMs: Math.round(data.durationMs),
      parentRequestId: ctx?.requestId ?? null,
      timestamp: Date.now(),
    },
  });
}

function patchPg(): void {
  const pg = tryRequire("pg") as Record<string, unknown> | null;
  if (!pg) return;
  const Client = (pg.default as Record<string, unknown>)?.Client ?? pg.Client;
  if (!Client || typeof Client !== "function") return;
  const proto = (Client as { prototype?: Record<string, unknown> }).prototype;
  if (!proto?.query) return;

  const origQuery = proto.query as Function;
  proto.query = function (...args: unknown[]) {
    const first = args[0];
    const sql =
      typeof first === "string"
        ? first
        : typeof first === "object" && first !== null && "text" in first
          ? (first as { text: string }).text
          : undefined;
    const start = performance.now();

    // Callback-based query: wrap the callback to measure round-trip time.
    // pg uses callback pattern internally (including Prisma's pg client).
    // Without this, we'd only measure dispatch time (~0ms).
    const lastIdx = args.length - 1;
    if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
      const origCb = args[lastIdx] as Function;
      args[lastIdx] = function (err: unknown, res: { rowCount?: number } | undefined) {
        sendQuery({
          driver: "pg",
          sql,
          durationMs: performance.now() - start,
          rowCount: res?.rowCount ?? undefined,
        });
        return origCb.apply(this, arguments);
      };
      return origQuery.apply(this, args);
    }

    const result = origQuery.apply(this, args);

    // Promise-based query (when no callback is provided)
    if (result && typeof result.then === "function") {
      return result.then((res: { rowCount?: number }) => {
        sendQuery({
          driver: "pg",
          sql,
          durationMs: performance.now() - start,
          rowCount: res?.rowCount ?? undefined,
        });
        return res;
      });
    }

    // Event emitter query (rare: no callback, no promise)
    if (result && typeof result.on === "function") {
      result.on("end", (res: { rowCount?: number }) => {
        sendQuery({
          driver: "pg",
          sql,
          durationMs: performance.now() - start,
          rowCount: res?.rowCount ?? undefined,
        });
      });
      return result;
    }

    return result;
  };
}

function patchMysql2(): void {
  const mysql2 = tryRequire("mysql2") as Record<string, unknown> | null;
  if (!mysql2) return;
  const proto =
    (mysql2 as { Connection?: { prototype: Record<string, unknown> } })
      .Connection?.prototype;
  if (!proto) return;

  for (const method of ["query", "execute"] as const) {
    const orig = proto[method];
    if (typeof orig !== "function") continue;

    proto[method] = function (...args: unknown[]) {
      const first = args[0];
      const sql = typeof first === "string" ? first : undefined;
      const start = performance.now();

      // Wrap callback if provided
      const lastIdx = args.length - 1;
      if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
        const origCb = args[lastIdx] as Function;
        args[lastIdx] = function () {
          sendQuery({ driver: "mysql2", sql, durationMs: performance.now() - start });
          return origCb.apply(this, arguments);
        };
        return (orig as Function).apply(this, args);
      }

      const result = (orig as Function).apply(this, args);

      if (result && typeof (result as { then?: unknown }).then === "function") {
        return (result as Promise<unknown>).then((res) => {
          sendQuery({ driver: "mysql2", sql, durationMs: performance.now() - start });
          return res;
        });
      }

      return result;
    };
  }
}

function patchPrisma(): void {
  const prismaModule = tryRequire("@prisma/client") as Record<string, unknown> | null;
  if (!prismaModule) return;
  const PrismaClient =
    (prismaModule.default as Record<string, unknown>)?.PrismaClient ?? prismaModule.PrismaClient;
  if (!PrismaClient || typeof PrismaClient !== "function") return;

  const prismaProto = (PrismaClient as { prototype: Record<string, unknown> }).prototype;
  const origConnect = prismaProto.$connect as Function;
  if (typeof origConnect !== "function") return;

  // Patch $connect to apply $extends after the client is ready
  prismaProto.$connect = async function (...args: unknown[]) {
    if (!this._brakitPatched) {
      this._brakitPatched = true;
      const extended = (this as Record<string, Function>).$extends({
        query: {
          $allModels: {
            async $allOperations({
              model,
              operation,
              args: opArgs,
              query,
            }: {
              model: string;
              operation: string;
              args: unknown;
              query: (args: unknown) => Promise<unknown>;
            }) {
              const start = performance.now();
              const result = await query(opArgs);
              sendQuery({
                driver: "prisma",
                model,
                operation,
                durationMs: performance.now() - start,
              });
              return result;
            },
          },
        },
      });
      // Copy extended methods back to this instance
      Object.setPrototypeOf(this, Object.getPrototypeOf(extended));
    }
    return origConnect.apply(this, args);
  };
}

export function setupDbHook(): void {
  try { patchPg(); } catch { /* driver not installed or API changed */ }
  try { patchMysql2(); } catch { /* driver not installed or API changed */ }
  try { patchPrisma(); } catch { /* driver not installed or API changed */ }
}
