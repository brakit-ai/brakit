import type { BrakitAdapter } from "../adapter.js";
import { tryRequire, getActiveRequestId, getPrototype } from "./shared.js";
import { normalizePrismaOp } from "./normalize.js";
import type { LibraryModule } from "./types.js";

/** Shape of the $allOperations callback argument from Prisma's $extends API */
interface PrismaOperationArgs {
  model: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

let origConnect: ((...args: unknown[]) => Promise<unknown>) | null = null;
let prismaProto: Record<string, unknown> | null = null;

export const prismaAdapter: BrakitAdapter = {
  name: "prisma",

  detect() {
    return tryRequire("@prisma/client") !== null;
  },

  patch(emit) {
    const prismaModule = tryRequire("@prisma/client") as LibraryModule | null;
    if (!prismaModule) return;
    prismaProto = getPrototype<Record<string, unknown>>(prismaModule, "PrismaClient");
    if (!prismaProto) return;

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
              }: PrismaOperationArgs) {
                const requestId = getActiveRequestId();
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
