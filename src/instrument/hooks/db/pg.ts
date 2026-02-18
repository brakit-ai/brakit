import { tryRequire, sendQuery } from "./shared.js";

export function patchPg(): void {
  const pg = tryRequire("pg") as Record<string, unknown> | null;
  if (!pg) return;
  const Client = (pg.default as Record<string, unknown>)?.Client ?? pg.Client;
  if (!Client || typeof Client !== "function") return;
  const proto = (Client as { prototype?: Record<string, unknown> }).prototype;
  if (!proto?.query) return;

  const origQuery = proto.query as (...args: unknown[]) => unknown;
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
    const lastIdx = args.length - 1;
    if (lastIdx >= 0 && typeof args[lastIdx] === "function") {
      const origCb = args[lastIdx] as (...cbArgs: unknown[]) => unknown;
      args[lastIdx] = function (this: unknown, err: unknown, res: { rowCount?: number } | undefined) {
        sendQuery({
          driver: "pg",
          sql,
          durationMs: performance.now() - start,
          rowCount: res?.rowCount ?? undefined,
        });
        return origCb.call(this, err, res);
      };
      return origQuery.apply(this, args);
    }

    const result = origQuery.apply(this, args);

    // Promise-based query
    if (result && typeof (result as { then?: unknown }).then === "function") {
      return (result as Promise<{ rowCount?: number }>).then((res) => {
        sendQuery({
          driver: "pg",
          sql,
          durationMs: performance.now() - start,
          rowCount: res?.rowCount ?? undefined,
        });
        return res;
      });
    }

    // Event emitter query
    if (result && typeof (result as { on?: unknown }).on === "function") {
      (result as { on: (event: string, fn: (res: { rowCount?: number }) => void) => void }).on(
        "end",
        (res) => {
          sendQuery({
            driver: "pg",
            sql,
            durationMs: performance.now() - start,
            rowCount: res?.rowCount ?? undefined,
          });
        },
      );
      return result;
    }

    return result;
  };
}
