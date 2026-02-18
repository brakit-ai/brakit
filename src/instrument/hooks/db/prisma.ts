import { tryRequire, sendQuery } from "./shared.js";

export function patchPrisma(): void {
  const prismaModule = tryRequire("@prisma/client") as Record<string, unknown> | null;
  if (!prismaModule) return;
  const PrismaClient =
    (prismaModule.default as Record<string, unknown>)?.PrismaClient ?? prismaModule.PrismaClient;
  if (!PrismaClient || typeof PrismaClient !== "function") return;

  const prismaProto = (PrismaClient as { prototype: Record<string, unknown> }).prototype;
  const origConnect = prismaProto.$connect;
  if (typeof origConnect !== "function") return;

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
      Object.setPrototypeOf(this, Object.getPrototypeOf(extended));
    }
    return (origConnect as (...a: unknown[]) => Promise<unknown>).apply(this, args);
  };
}
