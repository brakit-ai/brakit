import { tryRequire, sendQuery, captureRequestId } from "./shared.js";

export function patchMysql2(): void {
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
      const requestId = captureRequestId();

      const lastIdx = args.length - 1;
      if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
        const origCb = args[lastIdx] as (...cbArgs: unknown[]) => unknown;
        args[lastIdx] = function (this: unknown) {
          sendQuery({ driver: "mysql2", sql, durationMs: performance.now() - start }, requestId);
          return origCb.apply(this, arguments as unknown as unknown[]);
        };
        return (orig as (...a: unknown[]) => unknown).apply(this, args);
      }

      const result = (orig as (...a: unknown[]) => unknown).apply(this, args);

      if (result && typeof (result as { then?: unknown }).then === "function") {
        return (result as Promise<unknown>).then((res) => {
          sendQuery({ driver: "mysql2", sql, durationMs: performance.now() - start }, requestId);
          return res;
        });
      }

      return result;
    };
  }
}
