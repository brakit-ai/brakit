import type { BrakitAdapter } from "../adapter.js";
import type { TelemetryEvent } from "../../types/index.js";
import { tryRequire, captureRequestId } from "./shared.js";
import { normalizePrismaOp } from "./normalize.js";

let origConnect: ((...args: unknown[]) => Promise<unknown>) | null = null;
let prismaProto: Record<string, unknown> | null = null;

export const prismaAdapter: BrakitAdapter = {
  name: "prisma",

  detect() {
    return tryRequire("@prisma/client") !== null;
  },

  patch(emit) {
    const prismaModule = tryRequire("@prisma/client") as Record<string, unknown> | null;
    if (!prismaModule) return;
    const PrismaClient =
      (prismaModule.default as Record<string, unknown>)?.PrismaClient ?? prismaModule.PrismaClient;
    if (!PrismaClient || typeof PrismaClient !== "function") return;

    prismaProto = (PrismaClient as { prototype: Record<string, unknown> }).prototype;
    origConnect = prismaProto.$connect as (...args: unknown[]) => Promise<unknown>;
    if (typeof origConnect !== "function") return;

    const saved = origConnect;
    prismaProto.$connect = async function (this: Record<string, unknown>, ...args: unknown[]) {
      if (!this._brakitPatched) {
        this._brakitPatched = true;
        const extended = (this as Record<string, (...a: unknown[]) => unknown>).$extends({
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
                const requestId = captureRequestId();
                const start = performance.now();
                const result = await query(opArgs);
                emit({
                  type: "query",
                  data: {
                    driver: "prisma",
                    source: "prisma",
                    model,
                    operation,
                    normalizedOp: normalizePrismaOp(operation),
                    table: model,
                    durationMs: Math.round(performance.now() - start),
                    parentRequestId: requestId,
                    timestamp: Date.now(),
                  },
                });
                return result;
              },
            },
          },
        });
        Object.setPrototypeOf(this, Object.getPrototypeOf(extended));
      }
      return saved.apply(this, args);
    };
  },

  unpatch() {
    if (prismaProto && origConnect) {
      prismaProto.$connect = origConnect;
      origConnect = null;
      prismaProto = null;
    }
  },
};
