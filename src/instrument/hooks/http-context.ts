import http from "node:http";
import { randomUUID } from "node:crypto";
import { requestContextStorage, type RequestContext } from "./context.js";

// Patch http.Server to wrap every incoming request in an AsyncLocalStorage
// context. This lets all async operations (fetches, queries, logs) within
// a request be correlated back to it.

export function setupHttpContextHook(): void {
  const originalEmit = http.Server.prototype.emit as (
    event: string | symbol,
    ...args: unknown[]
  ) => boolean;

  (http.Server.prototype as { emit: typeof originalEmit }).emit = function (
    event: string | symbol,
    ...args: unknown[]
  ): boolean {
    if (event === "request") {
      const req = args[0] as http.IncomingMessage;
      const ctx: RequestContext = {
        requestId: randomUUID(),
        url: req.url ?? "/",
        method: req.method ?? "GET",
      };
      return requestContextStorage.run(ctx, () =>
        originalEmit.apply(this, [event, ...args]),
      );
    }
    return originalEmit.apply(this, [event, ...args]);
  };
}
