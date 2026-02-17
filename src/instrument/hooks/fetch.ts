import { subscribe } from "node:diagnostics_channel";
import { send } from "../transport.js";
import { getRequestContext } from "./context.js";

interface UndiciRequest {
  origin?: string;
  method?: string;
  path?: string;
  host?: string;
  addHeader?(name: string, value: string): void;
}

interface UndiciResponse {
  statusCode?: number;
  headers?: Buffer[];
}

const pending = new WeakMap<
  object,
  { origin: string; method: string; path: string; startTime: number; parentRequestId: string | null }
>();

export function setupFetchHook(): void {
  subscribe("undici:request:create", (message: unknown) => {
    const msg = message as { request: UndiciRequest };
    const req = msg.request;
    const ctx = getRequestContext();
    pending.set(msg.request, {
      origin: req.origin ?? "",
      method: req.method ?? "GET",
      path: req.path ?? "/",
      startTime: performance.now(),
      parentRequestId: ctx?.requestId ?? null,
    });
  });

  subscribe("undici:request:headers", (message: unknown) => {
    const msg = message as { request: UndiciRequest; response: UndiciResponse };
    const info = pending.get(msg.request);
    if (!info) return;
    pending.delete(msg.request);

    send({
      type: "fetch",
      data: {
        url: info.origin + info.path,
        method: info.method,
        statusCode: msg.response.statusCode ?? 0,
        durationMs: Math.round(performance.now() - info.startTime),
        parentRequestId: info.parentRequestId,
        timestamp: Date.now(),
      },
    });
  });

  // Clean up on error so we don't leak WeakMap entries
  subscribe("undici:request:error", (message: unknown) => {
    const msg = message as { request: UndiciRequest };
    pending.delete(msg.request);
  });
}
